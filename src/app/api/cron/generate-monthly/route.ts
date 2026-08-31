import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  generarPlanesDelMes,
  generarPlanesEnfocados,
  fusionarPlanesDuplicados,
  traducirPlanesAIngles,
  estimarCoste,
  estimarCosteTraduccion,
} from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { revalidarSitemaps } from "@/lib/sitemapData";
import {
  hoyISO,
  proximosMesesSlugs,
  fechaDeHoyLegible,
  numeroSemanaDesde2020,
  mesSlugParaLocale,
  diasDelMes,
  formatearFechaLegible,
} from "@/lib/dates";
import { llevaEnfocadas, fuentesReferenciaConciertos } from "@/lib/nivelesMunicipio";

export const maxDuration = 300;

// Genera los 12 meses del año (no solo mes en curso + siguiente — ver
// conversación: la navegación "Por mes" solo enlaza los 2 más próximos,
// pero las 12 URLs existen igualmente y así nunca dan una página vacía a
// quien busca con más antelación, ni a Google). Programado semanal
// (vercel.json, lunes 6:00), no mensual: así el mes en curso no se queda
// una semana entera sin reflejar un evento anunciado a media semana — ver
// conversación.
//
// PERO no los 12 con la misma frecuencia (ver conversación sobre coste):
// el mes en curso y el siguiente sí se regeneran CADA semana (son los que
// enlaza la navegación y donde de verdad puede aparecer algo nuevo); los
// otros 10 (hasta 11 meses vista, ej. enero del año que viene) solo hace
// falta que existan y se posicionen, no que se repitan 4 veces al mes por
// nada — se reparten en 4 grupos rotativos por número de semana, así cada
// uno se refresca aproximadamente una vez al mes en vez de cada semana.
async function enLotes<T, R>(items: T[], tamano: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano);
    resultados.push(...(await Promise.all(lote.map(fn))));
  }
  return resultados;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = supabaseAdmin;

  const hoy = hoyISO();
  const todosLosMeses = proximosMesesSlugs(12);
  const mesesCercanos = todosLosMeses.slice(0, 2); // actual + siguiente: cada semana
  const mesesLejanos = todosLosMeses.slice(2); // el resto: rotación de 4 grupos (~1 vez al mes)
  const grupoEstaSemana = numeroSemanaDesde2020() % 4;
  const mesesLejanosDeEstaSemana = mesesLejanos.filter((_, i) => i % 4 === grupoEstaSemana);
  const meses = [...mesesCercanos, ...mesesLejanosDeEstaSemana];

  const { data: municipios, error } = await admin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json(
      { error: error?.message ?? "Sin municipios" },
      { status: 500 }
    );
  }

  const combos = municipios.flatMap((municipio) => meses.map((mes) => ({ municipio, mes })));

  const resultados = await enLotes(combos, 6, async ({ municipio, mes }) => {
    try {
      const municipiosExcluidos = municipios
        .filter((m) => m.id !== municipio.id)
        .map((m) => m.nombre);
      // Búsqueda dedicada de conciertos para ESTE mes concreto, además de
      // la mixta — ver conversación (Silvio Rodríguez): la mixta reparte
      // 10-20 planes entre TODAS las categorías del mes entero, así que un
      // concierto real puede quedarse fuera del cupo. Solo para "grande"
      // (ya paga las enfocadas semanales) — mismo criterio de coste que
      // generate-weekly, y en paralelo con la mixta por la misma razón.
      const diasMes = diasDelMes(mes);
      const fechaDesdeLegible = formatearFechaLegible(diasMes[0]);
      const fechaHastaLegible = formatearFechaLegible(diasMes[diasMes.length - 1]);
      const [{ planes: planesMixtos, usage: usageMixta }, conciertos] = await Promise.all([
        generarPlanesDelMes(municipio.nombre, mes, fechaDeHoyLegible(), municipiosExcluidos),
        llevaEnfocadas(municipio.slug)
          ? generarPlanesEnfocados(
              municipio.nombre,
              fechaDesdeLegible,
              fechaHastaLegible,
              { tipo: "categoria", valor: "conciertos" },
              municipiosExcluidos,
              fuentesReferenciaConciertos(municipio.slug)
            )
          : (Promise.resolve({ planes: [], usage: {} }) as ReturnType<typeof generarPlanesEnfocados>),
      ]);
      const planesConciertos = conciertos.planes;
      const usageConciertos = conciertos.usage;

      // El mismo concierto real puede salir tanto en la mixta como en la
      // dedicada (con otra redacción) — se fusiona aquí, antes de que la
      // fila repetida llegue a `planes.insert`.
      const planes = fusionarPlanesDuplicados([...planesMixtos, ...planesConciertos]);
      // thoughtsTokenCount también se suma (ver UsoTokens en gemini.ts):
      // se factura como output y sin esto estimarCoste subestima el gasto
      // real de las dos llamadas combinadas.
      const usageGeneracion = {
        promptTokenCount: (usageMixta.promptTokenCount ?? 0) + (usageConciertos.promptTokenCount ?? 0),
        candidatesTokenCount: (usageMixta.candidatesTokenCount ?? 0) + (usageConciertos.candidatesTokenCount ?? 0),
        thoughtsTokenCount: (usageMixta.thoughtsTokenCount ?? 0) + (usageConciertos.thoughtsTokenCount ?? 0),
      };

      // Traducción al inglés en una llamada aparte, sin grounding (ver
      // conversación). En su propio try/catch: un fallo aquí no debe tirar
      // toda la generación real en español — se queda sin inglés esta vez
      // y se traduce en la siguiente pasada.
      let traducciones: Awaited<ReturnType<typeof traducirPlanesAIngles>>["traducciones"] = [];
      let usageTraduccion: Awaited<ReturnType<typeof traducirPlanesAIngles>>["usage"] = {};
      try {
        ({ traducciones, usage: usageTraduccion } = await traducirPlanesAIngles(planes));
      } catch (err) {
        console.error(`traducirPlanesAIngles (${municipio.slug}): ${err}`);
      }
      planes.forEach((p, i) => Object.assign(p, traducciones[i]));
      // Tokens en crudo (solo informativos) sí se suman; el coste NO — cada
      // llamada usa un modelo con tarifa distinta (ver estimarCosteTraduccion
      // en gemini.ts), así que se calcula por separado y se suman los euros.
      const usage = {
        promptTokenCount: (usageGeneracion.promptTokenCount ?? 0) + (usageTraduccion.promptTokenCount ?? 0),
        candidatesTokenCount: (usageGeneracion.candidatesTokenCount ?? 0) + (usageTraduccion.candidatesTokenCount ?? 0),
      };
      const costeTotal = estimarCoste(usageGeneracion) + estimarCosteTraduccion(usageTraduccion);

      // Mismo slug que use el cron diario para el mismo evento: si ya existe
      // (porque también salió en la generación de hoy/finde), se actualiza
      // la misma fila en vez de crear una página duplicada.
      const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy);

      // Sustituye el lote de ESTE mes para este municipio, sin acumular
      // duplicados entre ejecuciones (por si el cron se relanza a mano).
      const { data: viejos, error: errorSelectViejos } = await admin
        .from("planes")
        .select("id")
        .eq("municipio_id", municipio.id)
        .contains("vigencia", [mes]);
      if (errorSelectViejos) throw new Error(`planes.select viejos: ${errorSelectViejos.message}`);

      if (viejos && viejos.length > 0) {
        const { error: errorDelete } = await admin
          .from("planes")
          .delete()
          .in("id", viejos.map((p) => p.id));
        if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);
      }

      const { error: errorInsert } = await admin.from("planes").insert(
        planes.map((p, i) => ({
          municipio_id: municipio.id,
          fecha_generacion: hoy,
          titulo: p.titulo,
          descripcion: p.descripcion,
          momento: p.momento,
          vigencia: p.vigencia,
          audiencia: p.audiencia,
          tipo: p.tipo,
          evento_id: vinculos.get(i)?.id ?? null,
          fuente: p.fuente ?? null,
        }))
      );
      if (errorInsert) throw new Error(`planes.insert: ${errorInsert.message}`);

      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "ok",
        tokens_input: usage.promptTokenCount ?? null,
        tokens_output: usage.candidatesTokenCount ?? null,
        coste_estimado: costeTotal,
      });

      const base = `/${municipio.slug}`;
      revalidatePath(`${base}/${mes}`);
      revalidatePath(`/en${base}/${mesSlugParaLocale(mes, "en")}`);
      Array.from(vinculos.values()).forEach((v) => {
        revalidatePath(`${base}/eventos/${v.slug}`);
        revalidatePath(`/en${base}/eventos/${v.slug}`);
      });

      return { municipio: municipio.slug, mes, estado: "ok", planes: planes.length };
    } catch (err) {
      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "error",
        error_mensaje: String(err),
      });
      return { municipio: municipio.slug, mes, estado: "error", error: String(err) };
    }
  });

  revalidarSitemaps();
  return NextResponse.json({ fecha: hoy, meses, resultados });
}
