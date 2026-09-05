import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularPaginasPlan } from "@/lib/paginasPlan";
import type { Evento } from "@/lib/types";

export const maxDuration = 60;

// Reconstruye el informe de planes activos de un municipio (puntuales +
// genéricos, con sus páginas de aparición) que alimenta el artifact de
// revisión — ver conversación: sustituye a la ruta de un solo uso
// api/admin/reporte-planes (borrada tras generar el primer informe a mano),
// ahora reutilizable por la tarea programada diaria.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const municipioSlug = request.nextUrl.searchParams.get("municipio") ?? "sevilla";

  const { data: municipio, error: errorMunicipio } = await supabaseAdmin
    .from("municipios")
    .select("id, slug")
    .eq("slug", municipioSlug)
    .maybeSingle();
  if (errorMunicipio) return NextResponse.json({ error: errorMunicipio.message }, { status: 500 });
  if (!municipio) return NextResponse.json({ error: "Municipio no encontrado" }, { status: 404 });

  const { data: eventos, error: errorEventos } = await supabaseAdmin
    .from("eventos")
    .select(
      "titulo, slug, categoria, ubicacion, precio, fecha_inicio, fecha_fin, audiencia, origen, primera_deteccion"
    )
    .eq("municipio_id", municipio.id)
    .eq("activo", true)
    .order("titulo");
  if (errorEventos) return NextResponse.json({ error: errorEventos.message }, { status: 500 });

  type Fila = Pick<
    Evento,
    | "titulo"
    | "slug"
    | "categoria"
    | "ubicacion"
    | "precio"
    | "fecha_inicio"
    | "fecha_fin"
    | "audiencia"
    | "origen"
    | "primera_deteccion"
  >;

  const puntuales: unknown[] = [];
  const genericos: unknown[] = [];

  for (const e of (eventos ?? []) as Fila[]) {
    const paginas = calcularPaginasPlan(e, municipio.slug);
    if (e.fecha_inicio !== null) {
      puntuales.push({
        titulo: e.titulo,
        slug: e.slug,
        categoria: e.categoria,
        ubicacion: e.ubicacion,
        precio: e.precio,
        fecha_inicio: e.fecha_inicio,
        fecha_fin: e.fecha_fin,
        origen: e.origen,
        primeraDeteccion: e.primera_deteccion,
        meses: paginas.meses,
        enCurso: paginas.enCurso,
        pasado: paginas.pasado,
        paginasEstaticas: paginas.paginasEstaticas,
        paginasPorMes: paginas.paginasPorMes,
      });
    } else {
      genericos.push({
        titulo: e.titulo,
        slug: e.slug,
        categoria: e.categoria,
        ubicacion: e.ubicacion,
        precio: e.precio,
        origen: e.origen,
        primeraDeteccion: e.primera_deteccion,
        paginasEstaticas: paginas.paginasEstaticas,
      });
    }
  }

  return NextResponse.json({
    municipio: municipio.slug,
    totalPuntuales: puntuales.length,
    totalGenericos: genericos.length,
    puntuales,
    genericos,
  });
}
