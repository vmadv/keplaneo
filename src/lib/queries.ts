import { supabase } from "./supabase";
import { hoyISO } from "./dates";
import type { Categoria, Comunidad, Evento, Lugar, Listado, Municipio, Plan, PuestoListado } from "./types";

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

// Sin "comunidad" en la URL (ver conversación), pero se sigue devolviendo
// `.comunidad` para mostrarla en la miga de pan — informativa, no parte de
// la ruta. Solo hay una comunidad hoy, pero el slug de municipio no tiene
// unicidad global garantizada por esquema (solo `unique(comunidad_id,
// slug)`), así que esto asume una única comunidad mientras no se añada esa
// restricción.
export async function getMunicipio(municipioSlug: string): Promise<MunicipioConComunidad | null> {
  const { data } = await supabase
    .from("municipios")
    .select(
      "id, comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon, comunidades!inner(id, slug, nombre)"
    )
    .eq("slug", municipioSlug)
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
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, fecha_inicio, fecha_fin, categoria)"
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
      eventos:
        | { slug: string; fecha_inicio: string | null; fecha_fin: string | null; categoria: Categoria | null }
        | { slug: string; fecha_inicio: string | null; fecha_fin: string | null; categoria: Categoria | null }[]
        | null;
    };
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    return {
      ...plan,
      evento_slug: ev?.slug ?? null,
      evento_fecha_inicio: ev?.fecha_inicio ?? null,
      evento_fecha_fin: ev?.fecha_fin ?? null,
      evento_categoria: ev?.categoria ?? null,
    };
  });
}

export async function getEvento(
  municipioId: string,
  slug: string
): Promise<Evento | null> {
  const { data } = await supabase
    .from("eventos")
    .select(
      "id, municipio_id, slug, titulo, descripcion, momento, audiencia, ubicacion, horario, precio, fecha_inicio, fecha_fin, fuente, preguntas_frecuentes, categoria, lat, lon, primera_deteccion, ultima_deteccion, activo"
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

export interface PlanConMunicipio extends Plan {
  municipio_slug: string;
  municipio_nombre: string;
}

function filaAPlanConMunicipio(
  fila: Plan & {
    eventos:
      | { slug: string; fecha_inicio: string | null; fecha_fin: string | null; categoria: Categoria | null }
      | { slug: string; fecha_inicio: string | null; fecha_fin: string | null; categoria: Categoria | null }[]
      | null;
  },
  municipio: { slug: string; nombre: string }
): PlanConMunicipio {
  const { eventos, ...plan } = fila;
  const ev = Array.isArray(eventos) ? eventos[0] : eventos;
  return {
    ...plan,
    evento_slug: ev?.slug ?? null,
    evento_fecha_inicio: ev?.fecha_inicio ?? null,
    evento_fecha_fin: ev?.fecha_fin ?? null,
    evento_categoria: ev?.categoria ?? null,
    municipio_slug: municipio.slug,
    municipio_nombre: municipio.nombre,
  };
}

// Versión de getPlanesPorVigencia para varios municipios a la vez (portada
// MVP centrada en la provincia): una consulta por municipio, cada una
// limitada a `porMunicipio` — así cada ciudad aparece representada por
// igual (4 por ciudad) en vez de que las más grandes (Sevilla) se coman
// todo el hueco de un top mezclado.
async function getPlanesPorVigenciaMulti(
  municipios: { id: string; slug: string; nombre: string }[],
  vigencia: string,
  filtrarPorHoy: boolean,
  porMunicipio: number
): Promise<PlanConMunicipio[]> {
  const resultados = await Promise.all(
    municipios.map(async (m) => {
      let query = supabase
        .from("planes")
        .select(
          "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, fecha_inicio, fecha_fin, categoria)"
        )
        .eq("municipio_id", m.id)
        .contains("vigencia", [vigencia]);

      if (filtrarPorHoy) {
        query = query.eq("fecha_generacion", hoyISO());
      }

      const { data } = await query.order("tipo").order("momento").limit(porMunicipio);
      return (data ?? []).map((fila) => filaAPlanConMunicipio(fila as never, m));
    })
  );

  return resultados.flat();
}

export function getPlanesHoyMulti(municipios: { id: string; slug: string; nombre: string }[], porMunicipio = 4) {
  return getPlanesPorVigenciaMulti(municipios, "hoy", true, porMunicipio);
}

export function getPlanesFindeMulti(municipios: { id: string; slug: string; nombre: string }[], porMunicipio = 4) {
  return getPlanesPorVigenciaMulti(municipios, "finde", true, porMunicipio);
}

export function getPlanesMesMulti(
  municipios: { id: string; slug: string; nombre: string }[],
  mesSlug: string,
  porMunicipio = 4
) {
  return getPlanesPorVigenciaMulti(municipios, mesSlug, false, porMunicipio);
}

// Bloques "Los mejores planes en Sevilla / en la provincia": solo planes
// "excepcional" (un evento real, no relleno genérico) de hoy o este fin de
// semana — no cualquier "excepcional" del mes, que podía sacar algo que no
// es ni de esta semana. Sin repetir el mismo evento aunque tenga varias
// filas (una por día que dura), de ahí sobreobtener y des-duplicar por
// evento_id en vez de limitar directo en SQL.
async function getPlanesDestacadosMulti(
  municipios: { id: string; slug: string; nombre: string }[],
  limite: number
): Promise<PlanConMunicipio[]> {
  if (municipios.length === 0) return [];
  const municipioPorId = new Map(municipios.map((m) => [m.id, m]));

  const { data } = await supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos!inner(slug, fecha_inicio, fecha_fin, categoria)"
    )
    .in(
      "municipio_id",
      municipios.map((m) => m.id)
    )
    .eq("tipo", "excepcional")
    .overlaps("vigencia", ["hoy", "finde"])
    .order("fecha_generacion", { ascending: false })
    .limit(limite * 10);

  const vistos = new Set<string>();
  const resultado: PlanConMunicipio[] = [];
  for (const fila of data ?? []) {
    const f = fila as unknown as Plan;
    const clave = f.evento_id ?? f.id;
    if (vistos.has(clave)) continue;
    const m = municipioPorId.get(f.municipio_id);
    if (!m) continue;
    vistos.add(clave);
    resultado.push(filaAPlanConMunicipio(fila as never, m));
    if (resultado.length >= limite) break;
  }
  return resultado;
}

export function getPlanesDestacadosDeMunicipio(
  municipio: { id: string; slug: string; nombre: string },
  limite = 4
) {
  return getPlanesDestacadosMulti([municipio], limite);
}

export function getPlanesDestacadosSinMunicipio(
  municipios: { id: string; slug: string; nombre: string }[],
  municipioIdExcluido: string,
  limite = 4
) {
  return getPlanesDestacadosMulti(
    municipios.filter((m) => m.id !== municipioIdExcluido),
    limite
  );
}

async function getPlanesPorCategoria(
  municipioId: string,
  categoria: string,
  vigencia?: string,
  filtrarPorHoy = false
): Promise<Plan[]> {
  // `eventos!inner` es necesario para poder filtrar por una columna de la
  // tabla enlazada (categoria) — con un join normal PostgREST no lo permite.
  let query = supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos!inner(slug, categoria, fecha_inicio, fecha_fin)"
    )
    .eq("municipio_id", municipioId)
    .eq("eventos.categoria", categoria);

  if (vigencia) {
    query = query.contains("vigencia", [vigencia]);
  }
  if (filtrarPorHoy) {
    query = query.eq("fecha_generacion", hoyISO());
  }

  const { data } = await query.order("tipo").order("momento");

  return (data ?? []).map((fila) => {
    const { eventos, ...plan } = fila as unknown as Plan & {
      eventos:
        | { slug: string; categoria: string; fecha_inicio: string | null; fecha_fin: string | null }
        | { slug: string; categoria: string; fecha_inicio: string | null; fecha_fin: string | null }[]
        | null;
    };
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    return {
      ...plan,
      evento_slug: ev?.slug ?? null,
      evento_fecha_inicio: ev?.fecha_inicio ?? null,
      evento_fecha_fin: ev?.fecha_fin ?? null,
    };
  });
}

export function getPlanesCategoriaHoy(municipioId: string, categoria: string) {
  return getPlanesPorCategoria(municipioId, categoria, "hoy", true);
}

export function getPlanesCategoriaFinde(municipioId: string, categoria: string) {
  return getPlanesPorCategoria(municipioId, categoria, "finde", true);
}

export function getPlanesCategoriaMes(municipioId: string, categoria: string, mesSlug: string) {
  return getPlanesPorCategoria(municipioId, categoria, mesSlug);
}

async function getEventosDelMunicipio(
  municipioId: string,
  categoria?: string,
  audiencia?: "pareja" | "familia"
): Promise<Evento[]> {
  let query = supabase
    .from("eventos")
    .select(
      "id, municipio_id, slug, titulo, descripcion, momento, audiencia, ubicacion, horario, precio, fecha_inicio, fecha_fin, fuente, preguntas_frecuentes, categoria, lat, lon, primera_deteccion, ultima_deteccion, activo"
    )
    .eq("municipio_id", municipioId)
    .eq("activo", true);
  if (categoria) query = query.eq("categoria", categoria);
  if (audiencia) {
    // El evento aparece si está etiquetado para esa audiencia o si es
    // "generico" (sirve para cualquier visitante) — mismo criterio que
    // getPlanesPorVigencia para audiencia en `planes`.
    query = query.or(`audiencia.cs.{${audiencia}},audiencia.cs.{generico}`);
  }
  const { data } = await query.order("titulo");
  return data ?? [];
}

// Para la página genérica de categoría (ej. /sevilla/conciertos): todos los
// eventos activos de esa temática, sin filtrar por vigencia de hoy — se lee
// directamente de `eventos` (la ficha estable), no de `planes` (que solo
// tiene la foto del día).
export function getEventosPorCategoria(municipioId: string, categoria: string): Promise<Evento[]> {
  return getEventosDelMunicipio(municipioId, categoria);
}

// Para "esta semana": todos los eventos activos del municipio, de cualquier
// temática — se filtran y ordenan por día (lunes-viernes) en la propia
// página a partir de fecha_inicio/fecha_fin, no aquí (son texto libre, no
// se pueden filtrar en la consulta SQL).
export function getEventosActivos(municipioId: string, audiencia?: "pareja" | "familia"): Promise<Evento[]> {
  return getEventosDelMunicipio(municipioId, undefined, audiencia);
}

function esPrecioGratis(precio: string | null): boolean {
  // Solo cuenta como gratis lo confirmado explícitamente. Sin precio
  // verificado NO se asume gratis bajo ningún concepto — monumentos como la
  // Catedral o el Alcázar pueden generarse como plan "genérico" (son
  // recurrentes, no un evento puntual) y aun así cobrar entrada. Afirmar
  // que algo es gratis sin pruebas es peor que dejarlo fuera de la lista.
  return precio !== null && /gratis|gratuit|libre|sin coste/i.test(precio);
}

// "Gratis" para /esta-semana/gratis — mismo criterio de esPrecioGratis que
// getPlanesGratisHoy, pero sobre `eventos` (ficha estable) en vez de
// `planes` del día, porque "esta semana" no tiene su propio lote diario.
export async function getEventosGratisActivos(municipioId: string): Promise<Evento[]> {
  const eventos = await getEventosDelMunicipio(municipioId);
  return eventos.filter((e) => esPrecioGratis(e.precio));
}

// Ejemplo de una nueva dimensión de filtro (por precio) además de audiencia
// y vigencia. Consulta aparte de getPlanesPorVigencia porque necesita leer
// "precio", que vive en `eventos`, no en `planes`.
export async function getPlanesGratisHoy(municipioId: string): Promise<Plan[]> {
  const { data } = await supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, precio)"
    )
    .eq("municipio_id", municipioId)
    .contains("vigencia", ["hoy"])
    .eq("fecha_generacion", hoyISO())
    .order("tipo")
    .order("momento");

  return (data ?? [])
    .map((fila) => {
      const { eventos, ...plan } = fila as unknown as Plan & {
        eventos: { slug: string; precio: string | null } | { slug: string; precio: string | null }[] | null;
      };
      const ev = Array.isArray(eventos) ? eventos[0] : eventos;
      return { plan: { ...plan, evento_slug: ev?.slug ?? null }, precio: ev?.precio ?? null };
    })
    .filter(({ precio }) => esPrecioGratis(precio))
    .map(({ plan }) => plan);
}

const CAMPOS_LUGAR =
  "id, municipio_id, google_place_id, tipo, nombre, slug, direccion, lat, lon, rating, num_valoraciones, nivel_precio, telefono, web, horario, fotos, descripcion, instagram, facebook, enlace_reserva, lema, gestionado_por_negocio, ultima_actualizacion, activo";

// Todos los listados publicados de un municipio (para enlazarlos desde su
// home), ordenados por actualización más reciente.
export async function getListadosDelMunicipio(municipioId: string): Promise<Listado[]> {
  const { data } = await supabase
    .from("listados")
    .select("id, municipio_id, tipo_lugar, slug, titulo, descripcion, preguntas_frecuentes, actualizado_en")
    .eq("municipio_id", municipioId)
    .order("actualizado_en", { ascending: false });
  return data ?? [];
}

// El ranking en sí + sus puestos ya ordenados por posición, con la ficha
// completa de cada lugar embebida (una sola consulta vía el join, en vez de
// una ficha de listado + N consultas de lugar).
export async function getListado(
  municipioId: string,
  listadoSlug: string
): Promise<{ listado: Listado; puestos: PuestoListado[] } | null> {
  const { data: listado } = await supabase
    .from("listados")
    .select("id, municipio_id, tipo_lugar, slug, titulo, descripcion, preguntas_frecuentes, actualizado_en")
    .eq("municipio_id", municipioId)
    .eq("slug", listadoSlug)
    .maybeSingle();
  if (!listado) return null;

  const { data: filas } = await supabase
    .from("listado_lugares")
    .select(`posicion, motivo, lugares(${CAMPOS_LUGAR})`)
    .eq("listado_id", listado.id)
    .order("posicion");

  const puestos: PuestoListado[] = ((filas ?? []) as unknown as Array<{
    posicion: number;
    motivo: string | null;
    lugares: Lugar | Lugar[] | null;
  }>)
    .map((fila) => {
      const lugar = Array.isArray(fila.lugares) ? fila.lugares[0] : fila.lugares;
      return lugar ? { lugar, posicion: fila.posicion, motivo: fila.motivo } : null;
    })
    .filter((p): p is PuestoListado => p !== null);

  return { listado, puestos };
}

export async function getLugar(municipioId: string, lugarSlug: string): Promise<Lugar | null> {
  const { data } = await supabase
    .from("lugares")
    .select(CAMPOS_LUGAR)
    .eq("municipio_id", municipioId)
    .eq("slug", lugarSlug)
    .maybeSingle();
  return data;
}

// Los demás listados donde aparece este lugar (para "también aparece en...")
// y en qué puesto — igual de barato que la consulta anterior, invertida.
export async function getListadosDeLugar(lugarId: string): Promise<Array<{ listado: Listado; posicion: number }>> {
  const { data } = await supabase
    .from("listado_lugares")
    .select("posicion, listados(id, municipio_id, tipo_lugar, slug, titulo, descripcion, preguntas_frecuentes, actualizado_en)")
    .eq("lugar_id", lugarId);

  return ((data ?? []) as unknown as Array<{ posicion: number; listados: Listado | Listado[] | null }>)
    .map((fila) => {
      const listado = Array.isArray(fila.listados) ? fila.listados[0] : fila.listados;
      return listado ? { listado, posicion: fila.posicion } : null;
    })
    .filter((p): p is { listado: Listado; posicion: number } => p !== null);
}

// Municipios que tienen al menos un ranking publicado, con su comunidad
// embebida — para la página genérica /rankings (el "elige tu ciudad" del
// vertical de rankings, aparte de la home de Planes).
export async function getMunicipiosConRankings(): Promise<MunicipioConComunidad[]> {
  const { data } = await supabase
    .from("listados")
    .select(
      "municipios!inner(id, comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon, comunidades!inner(id, slug, nombre))"
    );

  const vistos = new Map<string, MunicipioConComunidad>();
  for (const fila of (data ?? []) as unknown as Array<{
    municipios: (Municipio & { comunidades: Comunidad }) | (Municipio & { comunidades: Comunidad })[] | null;
  }>) {
    const m = Array.isArray(fila.municipios) ? fila.municipios[0] : fila.municipios;
    if (!m || vistos.has(m.id)) continue;
    const { comunidades, ...municipio } = m;
    vistos.set(m.id, { ...municipio, comunidad: comunidades });
  }

  return Array.from(vistos.values()).sort((a, b) => a.prioridad - b.prioridad);
}
