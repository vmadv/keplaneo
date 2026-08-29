import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarPlanesDelMes, estimarCoste } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO, proximosMesesSlugs } from "@/lib/dates";

export const maxDuration = 300;

// Genera los 12 meses del año (no solo mes en curso + siguiente — ver
// conversación: la navegación "Por mes" solo enlaza los 2 más próximos,
// pero las 12 URLs existen igualmente y así nunca dan una página vacía a
// quien busca con más antelación, ni a Google). Con 9 municipios × 12
// meses son 108 llamadas a Gemini — en lotes concurrentes en vez de una a
// una, para caber en el límite de 300s de la función. Programado semanal
// (vercel.json, lunes 6:00), no mensual: así el mes en curso no se queda
// una semana entera sin reflejar un evento anunciado a media semana — ver
// conversación.
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
  const meses = proximosMesesSlugs(12);

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
      const { planes, usage } = await generarPlanesDelMes(municipio.nombre, mes);

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
        coste_estimado: estimarCoste(usage),
      });

      const base = `/${municipio.slug}`;
      revalidatePath(`${base}/${mes}`);
      Array.from(vinculos.values()).forEach((v) => revalidatePath(`${base}/eventos/${v.slug}`));

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

  return NextResponse.json({ fecha: hoy, meses, resultados });
}
