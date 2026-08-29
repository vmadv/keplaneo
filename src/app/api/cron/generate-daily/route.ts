import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarNovedades, fusionarPlanesDuplicados, estimarCoste } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO, hoyEnMadrid, fechaDeHoyLegible, lunesDeLaSemanaActual, fechasDeLaSemana, formatearFechaISO } from "@/lib/dates";
import { calcularFilasPorDia } from "@/lib/planesPorDia";

export const maxDuration = 300;

// Corre de martes a domingo: la agenda de la semana ya se generó por
// completo el lunes (generate-weekly), así que esto solo busca planes
// NUEVOS que no conociéramos todavía — nunca vuelve a redactar lo que ya
// existe, que es justo lo que antes causaba duplicados (el mismo evento
// real con un título ligeramente distinto cada día). Los lunes no hace
// nada: ese día ya está cubierto por el cron semanal.

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

  const hoy = hoyISO();
  const diaSemana = hoyEnMadrid().getDay(); // 0=domingo … 6=sábado

  if (diaSemana === 1) {
    return NextResponse.json({ fecha: hoy, resultados: [], nota: "Lunes: cubierto por generate-weekly" });
  }

  const enfoqueFinde = diaSemana === 5; // viernes: prestar atención especial al finde
  const diasRestantesSemana = fechasDeLaSemana(lunesDeLaSemanaActual()).filter(
    (d) => formatearFechaISO(d) >= hoy
  );

  const { data: municipios, error } = await supabaseAdmin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json({ error: error?.message ?? "Sin municipios" }, { status: 500 });
  }

  const resultados = [];

  for (const municipio of municipios) {
    try {
      const { data: conocidos, error: errorConocidos } = await supabaseAdmin
        .from("eventos")
        .select("titulo")
        .eq("municipio_id", municipio.id)
        .eq("activo", true);
      if (errorConocidos) throw new Error(`eventos.select conocidos: ${errorConocidos.message}`);

      const titulosConocidos = (conocidos ?? []).map((e) => e.titulo);

      const { planes: planesCrudos, usage } = await generarNovedades(
        municipio.nombre,
        fechaDeHoyLegible(),
        titulosConocidos,
        enfoqueFinde
      );
      // Gemini puede describir el mismo evento real dos veces en una misma
      // respuesta (dos redacciones distintas) sin que eso choque con
      // ninguno de los `titulosConocidos` — se fusiona aquí, antes de que
      // ese duplicado llegue a `planes.insert`, no solo al vincular con
      // `eventos` (que ya lo agrupa, pero no evita la fila repetida).
      const planes = fusionarPlanesDuplicados(planesCrudos);

      let filasInsertadas = 0;
      let vinculosNuevos: string[] = [];

      if (planes.length > 0) {
        // Repaso parcial: no desactiva nada, solo añade lo nuevo.
        const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy, false);
        const filas = calcularFilasPorDia(planes, diasRestantesSemana);

        if (filas.length > 0) {
          const { error: errorInsert } = await supabaseAdmin.from("planes").insert(
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
          filasInsertadas = filas.length;
        }
        vinculosNuevos = Array.from(vinculos.values()).map((v) => v.slug);
      }

      await supabaseAdmin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "ok",
        tokens_input: usage.promptTokenCount ?? null,
        tokens_output: usage.candidatesTokenCount ?? null,
        coste_estimado: estimarCoste(usage),
      });

      const base = `/${municipio.slug}`;
      [...pathsDelMunicipio(base), ...vinculosNuevos.map((slug) => `${base}/eventos/${slug}`)].forEach((path) =>
        revalidatePath(path)
      );

      resultados.push({ municipio: municipio.slug, estado: "ok", novedades: planes.length, filas: filasInsertadas });
    } catch (err) {
      await supabaseAdmin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "error",
        error_mensaje: String(err),
      });
      resultados.push({ municipio: municipio.slug, estado: "error", error: String(err) });
    }
  }

  return NextResponse.json({ fecha: hoy, resultados });
}
