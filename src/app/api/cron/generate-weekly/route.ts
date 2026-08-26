import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarPlanesSemanales, estimarCoste } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { fechasDeLaSemana, formatearFechaISO, formatearFechaLegible } from "@/lib/dates";
import { calcularFilasPorDia } from "@/lib/planesPorDia";

export const maxDuration = 300;

// Corre los lunes: genera de una vez la agenda completa de la semana
// (lunes a domingo) por municipio, en vez de repetir la búsqueda cada día.
// Cada evento real se redacta una sola vez aquí — el repaso diario
// (generate-daily) solo añade lo que salga nuevo el resto de la semana, sin
// volver a describir esto. Ver src/lib/planesPorDia.ts para el reparto por
// día y src/lib/gemini.ts::generarPlanesSemanales para el prompt.

function pathsDelMunicipio(base: string): string[] {
  return [
    base,
    `${base}/hoy`,
    `${base}/hoy/pareja`,
    `${base}/hoy/familia`,
    `${base}/fin-de-semana`,
    `${base}/fin-de-semana/pareja`,
    `${base}/fin-de-semana/familia`,
    `${base}/esta-semana`,
    `${base}/esta-semana/pareja`,
    `${base}/esta-semana/familia`,
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

  const hoy = new Date();
  const hoyISOStr = formatearFechaISO(hoy);
  const diasSemana = fechasDeLaSemana(hoy); // el cron corre en lunes, así que "hoy" ya es el lunes de la semana a generar
  const fechasISOSemana = diasSemana.map(formatearFechaISO);

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
      const { planes, usage } = await generarPlanesSemanales(
        municipio.nombre,
        formatearFechaLegible(diasSemana[0]),
        formatearFechaLegible(diasSemana[6])
      );

      // "Foto completa" de la semana: cualquier evento de este municipio no
      // detectado aquí se marca inactivo (desactivarNoEncontrados=true).
      const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoyISOStr, true);

      const filas = calcularFilasPorDia(planes, diasSemana);

      // Sustituye por completo los planes de toda la semana para este
      // municipio (no se acumulan restos de la semana anterior).
      const { error: errorDelete } = await supabaseAdmin
        .from("planes")
        .delete()
        .eq("municipio_id", municipio.id)
        .in("fecha_generacion", fechasISOSemana);
      if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);

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

      await supabaseAdmin.from("generation_log").insert({
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

      resultados.push({ municipio: municipio.slug, estado: "ok", planes: planes.length, filas: filas.length });
    } catch (err) {
      await supabaseAdmin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoyISOStr,
        estado: "error",
        error_mensaje: String(err),
      });
      resultados.push({ municipio: municipio.slug, estado: "error", error: String(err) });
    }
  }

  return NextResponse.json({ semana: fechasISOSemana, resultados });
}
