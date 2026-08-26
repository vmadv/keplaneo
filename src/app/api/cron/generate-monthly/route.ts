import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarPlanesDelMes, estimarCoste } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO, proximosMesesSlugs } from "@/lib/dates";

export const maxDuration = 300;

// Genera el mes en curso y los dos siguientes (mismo criterio que la
// navegación "Por mes" — nunca se enlaza un mes que no se ha generado).
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

  const hoy = hoyISO();
  const meses = proximosMesesSlugs(2);

  const { data: municipios, error } = await supabaseAdmin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json(
      { error: error?.message ?? "Sin municipios" },
      { status: 500 }
    );
  }

  const resultados = [];

  for (const municipio of municipios) {
    for (const mes of meses) {
      try {
        const { planes, usage } = await generarPlanesDelMes(municipio.nombre, mes);

        // Mismo slug que use el cron diario para el mismo evento: si ya existe
        // (porque también salió en la generación de hoy/finde), se actualiza
        // la misma fila en vez de crear una página duplicada.
        const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy);

        // Sustituye el lote de ESTE mes para este municipio, sin acumular
        // duplicados entre ejecuciones (por si el cron se relanza a mano).
        const { data: viejos, error: errorSelectViejos } = await supabaseAdmin
          .from("planes")
          .select("id")
          .eq("municipio_id", municipio.id)
          .contains("vigencia", [mes]);
        if (errorSelectViejos) throw new Error(`planes.select viejos: ${errorSelectViejos.message}`);

        if (viejos && viejos.length > 0) {
          const { error: errorDelete } = await supabaseAdmin
            .from("planes")
            .delete()
            .in("id", viejos.map((p) => p.id));
          if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);
        }

        const { error: errorInsert } = await supabaseAdmin.from("planes").insert(
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

        await supabaseAdmin.from("generation_log").insert({
          municipio_id: municipio.id,
          fecha: hoy,
          estado: "ok",
          tokens_input: usage.promptTokenCount ?? null,
          tokens_output: usage.candidatesTokenCount ?? null,
          coste_estimado: estimarCoste(usage),
        });

        const base = `/${municipio.slug}`;
        revalidatePath(`${base}/${mes}`);
        Array.from(vinculos.values()).forEach((v) => revalidatePath(`${base}/eventos/${v.slug}`));

        resultados.push({ municipio: municipio.slug, mes, estado: "ok", planes: planes.length });
      } catch (err) {
        await supabaseAdmin.from("generation_log").insert({
          municipio_id: municipio.id,
          fecha: hoy,
          estado: "error",
          error_mensaje: String(err),
        });
        resultados.push({ municipio: municipio.slug, mes, estado: "error", error: String(err) });
      }
    }
  }

  return NextResponse.json({ fecha: hoy, meses, resultados });
}
