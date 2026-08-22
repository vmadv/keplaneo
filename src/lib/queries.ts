import { supabase } from "./supabase";
import { hoyISO } from "./dates";
import type { Comunidad, Evento, Municipio, Plan } from "./types";

export async function getComunidades(): Promise<Comunidad[]> {
  const { data } = await supabase
    .from("comunidades")
    .select("id, slug, nombre")
    .order("nombre");
  return data ?? [];
}

export async function getComunidadBySlug(
  slug: string
): Promise<Comunidad | null> {
  const { data } = await supabase
    .from("comunidades")
    .select("id, slug, nombre")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getMunicipiosByComunidad(
  comunidadId: string
): Promise<Municipio[]> {
  const { data } = await supabase
    .from("municipios")
    .select("id, comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon")
    .eq("comunidad_id", comunidadId)
    .order("prioridad");
  return data ?? [];
}

export interface MunicipioConComunidad extends Municipio {
  comunidad: Comunidad;
}

export async function getMunicipio(
  comunidadSlug: string,
  municipioSlug: string
): Promise<MunicipioConComunidad | null> {
  const { data } = await supabase
    .from("municipios")
    .select(
      "id, comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon, comunidades!inner(id, slug, nombre)"
    )
    .eq("slug", municipioSlug)
    .eq("comunidades.slug", comunidadSlug)
    .maybeSingle();

  if (!data) return null;

  const { comunidades, ...municipio } = data as unknown as Municipio & {
    comunidades: Comunidad;
  };

  return { ...municipio, comunidad: comunidades };
}

export async function getMunicipiosCercanos(
  municipio: Municipio,
  limite = 4
): Promise<Municipio[]> {
  const { data } = await supabase
    .from("municipios")
    .select("id, comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon")
    .eq("comunidad_id", municipio.comunidad_id)
    .neq("id", municipio.id)
    .order("prioridad")
    .limit(limite);
  return data ?? [];
}

async function getPlanesPorVigencia(
  municipioId: string,
  vigencia: string,
  audiencia?: "pareja" | "familia",
  filtrarPorHoy = false
): Promise<Plan[]> {
  let query = supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug)"
    )
    .eq("municipio_id", municipioId)
    .contains("vigencia", [vigencia]);

  if (filtrarPorHoy) {
    query = query.eq("fecha_generacion", hoyISO());
  }

  if (audiencia) {
    // El plan aparece si está etiquetado para esa audiencia o si es "generico"
    // (sirve para cualquier visitante).
    query = query.or(`audiencia.cs.{${audiencia}},audiencia.cs.{generico}`);
  }

  // "excepcional" ordena antes que "generico" alfabéticamente: los planes
  // puntuales van primero y los genéricos de relleno quedan al final,
  // como pide el prompt de generación.
  const { data } = await query.order("tipo").order("momento");

  return (data ?? []).map((fila) => {
    const { eventos, ...plan } = fila as unknown as Plan & {
      eventos: { slug: string } | { slug: string }[] | null;
    };
    const evento_slug = Array.isArray(eventos) ? (eventos[0]?.slug ?? null) : (eventos?.slug ?? null);
    return { ...plan, evento_slug };
  });
}

export async function getEvento(
  municipioId: string,
  slug: string
): Promise<Evento | null> {
  const { data } = await supabase
    .from("eventos")
    .select(
      "id, municipio_id, slug, titulo, descripcion, momento, audiencia, ubicacion, horario, precio, fecha_inicio, fecha_fin, fuente, preguntas_frecuentes, lat, lon, primera_deteccion, ultima_deteccion, activo"
    )
    .eq("municipio_id", municipioId)
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

// La tabla `eventos` no guarda vigencia (es la ficha estable del evento);
// la vigencia real vive en la fila de `planes` de hoy que apunta a él. Se
// usa para decidir si el bloque de "otros planes" de la ficha debe mostrar
// los de hoy, los del finde o los del mes correspondiente.
export async function getVigenciaActualDeEvento(eventoId: string): Promise<string[]> {
  const { data } = await supabase
    .from("planes")
    .select("vigencia")
    .eq("evento_id", eventoId)
    .eq("fecha_generacion", hoyISO())
    .limit(1)
    .maybeSingle();
  return data?.vigencia ?? [];
}

export function getPlanesHoy(municipioId: string, audiencia?: "pareja" | "familia") {
  return getPlanesPorVigencia(municipioId, "hoy", audiencia, true);
}

export function getPlanesFinde(municipioId: string, audiencia?: "pareja" | "familia") {
  return getPlanesPorVigencia(municipioId, "finde", audiencia, true);
}

export function getPlanesDelMes(municipioId: string, mesSlug: string) {
  return getPlanesPorVigencia(municipioId, mesSlug);
}
