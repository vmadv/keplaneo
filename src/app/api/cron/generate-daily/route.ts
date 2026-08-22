import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarPlanesDiarios, estimarCoste } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO } from "@/lib/dates";

export const maxDuration = 300;

interface MunicipioConComunidadSlug {
  id: string;
  slug: string;
  nombre: string;
  comunidades: { slug: string } | { slug: string }[] | null;
}

function comunidadSlugDe(m: MunicipioConComunidadSlug): string | null {
  const c = m.comunidades;
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.slug ?? null) : c.slug;
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

  const hoy = hoyISO();

  const { data: municipios, error } = await supabaseAdmin
    .from("municipios")
    .select("id, slug, nombre, comunidades(slug)")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json(
      { error: error?.message ?? "Sin municipios" },
      { status: 500 }
    );
  }

  const resultados = [];

  for (const municipio of municipios as unknown as MunicipioConComunidadSlug[]) {
    try {
      const { planes, usage } = await generarPlanesDiarios(municipio.nombre);

      // Los planes "excepcional" obtienen (o mantienen) una página propia
      // con URL estable; el mismo evento no cambia de slug entre días.
      const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy);

      // El lote de hoy sustituye por completo al del día anterior para este
      // municipio: no se acumulan planes viejos. Esto es solo el listado —
      // el detalle de los eventos vive en la tabla `eventos`, que no se toca.
      const { error: errorDelete } = await supabaseAdmin
        .from("planes")
        .delete()
        .eq("municipio_id", municipio.id)
        .eq("fecha_generacion", hoy);
      if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);

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

      const comunidadSlug = comunidadSlugDe(municipio);
      if (comunidadSlug) {
        const base = `/${comunidadSlug}/${municipio.slug}`;
        [
          base,
          `${base}/hoy`,
          `${base}/hoy/pareja`,
          `${base}/hoy/familia`,
          `${base}/fin-de-semana`,
          `${base}/fin-de-semana/pareja`,
          `${base}/fin-de-semana/familia`,
          ...Array.from(vinculos.values()).map((v) => `${base}/eventos/${v.slug}`),
        ].forEach((path) => revalidatePath(path));
      }

      resultados.push({ municipio: municipio.slug, estado: "ok", planes: planes.length });
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
