import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  generarPlanesSemanales,
  generarPlanesEnfocados,
  generarPlanesGenericos,
  FOCOS_SEMANALES,
  fusionarPlanesDuplicados,
  estimarCoste,
} from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { getTitulosGenericosActivos } from "@/lib/queries";
import { lunesDeLaSemanaActual, fechasDeLaSemana, formatearFechaISO, formatearFechaLegible } from "@/lib/dates";
import { calcularFilasPorDia } from "@/lib/planesPorDia";

export const maxDuration = 300;

// Programado para los lunes: genera de una vez la agenda completa de la
// semana (lunes a domingo) por municipio, en vez de repetir la búsqueda
// cada día. Cada evento real se redacta una sola vez aquí — el repaso
// diario (generate-daily) solo añade lo que salga nuevo el resto de la
// semana, sin volver a describir esto. Ver src/lib/planesPorDia.ts para el
// reparto por día y src/lib/gemini.ts::generarPlanesSemanales para el
// prompt. Calcula la semana a partir del lunes real (no de "hoy" a secas),
// así que relanzarlo a mano cualquier día de la semana sigue generando la
// semana en curso correctamente, no una ventana desplazada.
//
// Además de la búsqueda mixta, se lanza una búsqueda dedicada por cada
// variable con página propia (FOCOS_SEMANALES: pareja/familia/conciertos/
// exposiciones/teatro/monólogos) — antes generarPlanesEnfocados existía
// pero no la llamaba ningún cron real, así que esas páginas solo recibían
// lo que la búsqueda mixta encontrara de paso (ver conversación). También
// se lanza generarPlanesGenericos, que amplía el catálogo de "siempre"
// (monumentos, museos, mercados...) con sitios nuevos que no estén ya
// activos para este municipio — sin esto, los genéricos solo salían como
// relleno de la búsqueda mixta cuando faltaban puntuales, así que en
// ciudades con agenda activa el catálogo de "todo el año" apenas crecía
// (ver conversación). Las 8 llamadas de un mismo municipio van en paralelo
// (el reintento con jitter de llamarGeminiConReintentos ya cuenta con
// esto); los municipios se procesan en lotes para no acercarse al límite
// de 300s de la función.

async function enLotes<T, R>(items: T[], tamano: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano);
    resultados.push(...(await Promise.all(lote.map(fn))));
  }
  return resultados;
}

function sumarUso(
  usos: { promptTokenCount?: number; candidatesTokenCount?: number }[]
): { promptTokenCount?: number; candidatesTokenCount?: number } {
  return usos.reduce(
    (acc, u) => ({
      promptTokenCount: (acc.promptTokenCount ?? 0) + (u.promptTokenCount ?? 0),
      candidatesTokenCount: (acc.candidatesTokenCount ?? 0) + (u.candidatesTokenCount ?? 0),
    }),
    {}
  );
}

function pathsDelMunicipio(base: string): string[] {
  return [
    base,
    `${base}/hoy`,
    `${base}/hoy/pareja`,
    `${base}/hoy/con-ninos`,
    `${base}/fin-de-semana`,
    `${base}/fin-de-semana/pareja`,
    `${base}/fin-de-semana/con-ninos`,
    `${base}/esta-semana`,
    `${base}/esta-semana/pareja`,
    `${base}/esta-semana/con-ninos`,
    `${base}/esta-semana/gratis`,
    `${base}/gratis`,
  ];
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const admin = supabaseAdmin;

  const hoy = new Date();
  const hoyISOStr = formatearFechaISO(hoy);
  // No asumir que "hoy" es lunes solo porque el cron esté pensado para
  // correr ese día — calcular el lunes de verdad hace que sea seguro
  // relanzarlo a mano cualquier día, o si el horario del cron cambia en
  // el futuro (ver conversación).
  const diasSemana = fechasDeLaSemana(lunesDeLaSemanaActual());
  const fechasISOSemana = diasSemana.map(formatearFechaISO);

  const { data: municipios, error } = await admin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json({ error: error?.message ?? "Sin municipios" }, { status: 500 });
  }

  const fechaLunesLegible = formatearFechaLegible(diasSemana[0]);
  const fechaDomingoLegible = formatearFechaLegible(diasSemana[6]);

  const resultados = await enLotes(municipios, 3, async (municipio) => {
    try {
      const conocidos = await getTitulosGenericosActivos(municipio.id);
      const [mixta, generico, ...enfocadas] = await Promise.all([
        generarPlanesSemanales(municipio.nombre, fechaLunesLegible, fechaDomingoLegible),
        generarPlanesGenericos(municipio.nombre, conocidos),
        ...FOCOS_SEMANALES.map((foco) =>
          generarPlanesEnfocados(municipio.nombre, fechaLunesLegible, fechaDomingoLegible, foco)
        ),
      ]);
      const planesCrudos = [mixta, generico, ...enfocadas].flatMap((r) => r.planes);
      const usage = sumarUso([mixta, generico, ...enfocadas].map((r) => r.usage));

      // El mismo evento real puede salir tanto en la búsqueda mixta como en
      // una enfocada (con otra redacción) — se fusiona aquí, antes de que
      // la fila repetida llegue a `planes.insert` (el vínculo con `eventos`
      // ya lo agrupa, pero eso no evita la fila de más en `planes`).
      const planes = fusionarPlanesDuplicados(planesCrudos);

      // "Foto completa" de la semana: cualquier evento de este municipio no
      // detectado aquí se marca inactivo (desactivarNoEncontrados=true).
      const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoyISOStr, true);

      const filas = calcularFilasPorDia(planes, diasSemana);

      // Sustituye por completo los planes de toda la semana para este
      // municipio (no se acumulan restos de la semana anterior).
      const { error: errorDelete } = await admin
        .from("planes")
        .delete()
        .eq("municipio_id", municipio.id)
        .in("fecha_generacion", fechasISOSemana);
      if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);

      const { error: errorInsert } = await admin.from("planes").insert(
        filas.map((f) => ({
          municipio_id: municipio.id,
          fecha_generacion: f.fechaISO,
          titulo: f.plan.titulo,
          descripcion: f.plan.descripcion,
          momento: f.plan.momento,
          vigencia: f.vigencia,
          audiencia: f.plan.audiencia,
          tipo: f.plan.tipo,
          evento_id: vinculos.get(f.indice)?.id ?? null,
          fuente: f.plan.fuente ?? null,
        }))
      );
      if (errorInsert) throw new Error(`planes.insert: ${errorInsert.message}`);

      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoyISOStr,
        estado: "ok",
        tokens_input: usage.promptTokenCount ?? null,
        tokens_output: usage.candidatesTokenCount ?? null,
        coste_estimado: estimarCoste(usage),
      });

      const base = `/${municipio.slug}`;
      [...pathsDelMunicipio(base), ...Array.from(vinculos.values()).map((v) => `${base}/eventos/${v.slug}`)].forEach(
        (path) => revalidatePath(path)
      );

      return { municipio: municipio.slug, estado: "ok", planes: planes.length, filas: filas.length };
    } catch (err) {
      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoyISOStr,
        estado: "error",
        error_mensaje: String(err),
      });
      return { municipio: municipio.slug, estado: "error", error: String(err) };
    }
  });

  return NextResponse.json({ semana: fechasISOSemana, resultados });
}
