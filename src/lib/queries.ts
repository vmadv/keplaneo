import { supabase } from "./supabase";
import { hoyISO, hoyEnMadrid, fechaDesdeTextoEspanol } from "./dates";
import type { Categoria, Comunidad, Evento, Lugar, Listado, Municipio, Plan, Provincia, PuestoListado } from "./types";

// Un "generico" con patrón semanal fijo (ej. un mercadillo que solo existe
// los jueves) no debe aparecer en "hoy" ningún día que no sea jueves, ni en
// "finde" si no cae sábado o domingo — ver conversación, migración 0019.
// Sin restricción (null/vacío, la inmensa mayoría) siempre pasa. Para
// cualquier otra vigencia (mes, categoría sin filtro de día) no se aplica:
// sigue siendo información relevante para ese periodo más amplio.
function pasaDiaSemana(diasSemana: number[] | null | undefined, vigencia: string): boolean {
  if (!diasSemana || diasSemana.length === 0) return true;
  if (vigencia === "hoy") return diasSemana.includes(hoyEnMadrid().getDay());
  if (vigencia === "finde") return diasSemana.some((d) => d === 0 || d === 6);
  return true;
}

// Nivel base para el orden de prioridad: puntual (0) primero siempre; un
// genérico con día fijo (ej. "solo domingos") que ha sobrevivido el filtro
// de pasaDiaSemana significa que ese día es justo hoy/este finde — más
// oportuno que un genérico de siempre, así que va inmediatamente después
// de los puntuales (1), antes que el resto de genéricos (2) — ver
// conversación, migración 0019.
function nivelBase(tipo: string, diasSemana: number[] | null | undefined): number {
  if (tipo === "excepcional") return 0;
  return diasSemana && diasSemana.length > 0 ? 1 : 2;
}

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

// Sin "comunidad" en la URL de planes (ver conversación), pero se sigue
// devolviendo `.comunidad` para mostrarla en la miga de pan — informativa,
// no parte de la ruta. Solo hay una comunidad hoy, pero el slug de
// municipio no tiene unicidad global garantizada por esquema (solo
// `unique(comunidad_id, slug)`), así que esto asume una única comunidad
// mientras no se añada esa restricción.
//
// Deliberadamente NO incluye `provincia_id`/`provincias` en el select — lo
// usan todas las páginas de Planes (Fase 1, ya en producción), así que no
// puede depender del esquema de la migración 0014 (provincias). Para la
// jerarquía de rankings, que sí necesita esa columna, usar
// getMunicipioConProvincia en su lugar.
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

export interface MunicipioConProvincia extends MunicipioConComunidad {
  // Puede ser null si el municipio aún no tiene `provincia_id` asignado.
  // No confundir con `Municipio.provincia` (texto suelto).
  provinciaGeo: Provincia | null;
}

// Igual que getMunicipio, pero con la provincia real embebida — solo para
// la jerarquía de rankings (rankings/espana/{ccaa}/{provincia}/{municipio}),
// que necesita validar esos dos segmentos de la URL contra el municipio.
export async function getMunicipioConProvincia(municipioSlug: string): Promise<MunicipioConProvincia | null> {
  const { data } = await supabase
    .from("municipios")
    .select(
      "id, comunidad_id, slug, nombre, provincia, provincia_id, poblacion, prioridad, lat, lon, comunidades!inner(id, slug, nombre), provincias(id, comunidad_id, slug, nombre)"
    )
    .eq("slug", municipioSlug)
    .maybeSingle();

  if (!data) return null;

  const { comunidades, provincias, ...municipio } = data as unknown as Municipio & {
    comunidades: Comunidad;
    provincias: Provincia | Provincia[] | null;
  };
  const provinciaGeo = Array.isArray(provincias) ? (provincias[0] ?? null) : provincias;

  return { ...municipio, comunidad: comunidades, provinciaGeo };
}

// Todas las provincias de una comunidad (para el redirect de
// rankings/espana/{ccaa} a la primera con contenido, y en el futuro el
// índice real de CCAA).
export async function getProvincias(comunidadId: string): Promise<Provincia[]> {
  const { data } = await supabase
    .from("provincias")
    .select("id, comunidad_id, slug, nombre")
    .eq("comunidad_id", comunidadId)
    .order("nombre");
  return data ?? [];
}

export interface ProvinciaConComunidad extends Provincia {
  comunidad: Comunidad;
}

// Para la cabecera real de rankings/espana/{ccaa}/{provincia} — valida a la
// vez que la provincia existe y que cuelga de esa comunidad concreta.
export async function getProvincia(
  comunidadSlug: string,
  provinciaSlug: string
): Promise<ProvinciaConComunidad | null> {
  const { data } = await supabase
    .from("provincias")
    .select("id, comunidad_id, slug, nombre, comunidades!inner(id, slug, nombre)")
    .eq("slug", provinciaSlug)
    .eq("comunidades.slug", comunidadSlug)
    .maybeSingle();

  if (!data) return null;

  const { comunidades, ...provincia } = data as unknown as Provincia & { comunidades: Comunidad };
  return { ...provincia, comunidad: comunidades };
}

// Municipios de una provincia que tienen al menos un ranking publicado —
// para el hub real rankings/espana/{ccaa}/{provincia} (el único nivel de
// esta jerarquía con contenido propio hoy, aparte de municipio).
export async function getMunicipiosConRankingsPorProvincia(provinciaId: string): Promise<Municipio[]> {
  const { data } = await supabase
    .from("listados")
    .select(
      "municipios!inner(id, comunidad_id, slug, nombre, provincia, provincia_id, poblacion, prioridad, lat, lon)"
    )
    .eq("municipios.provincia_id", provinciaId);

  const vistos = new Map<string, Municipio>();
  for (const fila of (data ?? []) as unknown as Array<{ municipios: Municipio | Municipio[] | null }>) {
    const m = Array.isArray(fila.municipios) ? fila.municipios[0] : fila.municipios;
    if (!m || vistos.has(m.id)) continue;
    vistos.set(m.id, m);
  }

  return Array.from(vistos.values()).sort((a, b) => a.prioridad - b.prioridad);
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
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, fecha_inicio, fecha_fin, categoria, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en)"
    )
    .eq("municipio_id", municipioId)
    .contains("vigencia", [vigencia]);

  if (filtrarPorHoy) {
    query = query.eq("fecha_generacion", hoyISO());
  }

  if (audiencia) {
    // Estricto: solo lo etiquetado específicamente para esa audiencia, sin
    // colar automáticamente lo "generico" — ver conversación. Con casi
    // todo el contenido llevando "generico" de propina, meterlo aquí
    // dejaba /pareja y /con-ninos mostrando prácticamente la misma lista.
    query = query.contains("audiencia", [audiencia]);
  }

  const { data } = await query;

  // Un lote de "mes" se regenera semanalmente (ver generate-monthly), no a
  // diario como hoy/finde — así que un puntual con fecha ya pasada (ej. un
  // concierto del 5 de agosto, visto el día 30) puede quedar colgado hasta
  // el siguiente refresco si no se filtra aquí en la lectura. Las fechas se
  // guardan como texto en español ("30 de agosto de 2026"), no ISO — hay
  // que parsearlas para comparar de verdad; compararlas como string contra
  // hoyISO() ("2026-08-30") nunca da el resultado correcto (ver
  // conversación: ese bug llevaba así desde que se escribió este filtro).
  const hoyDate = hoyEnMadrid();
  const vigentes = (data ?? []).filter((fila) => {
    const eventos = (fila as unknown as { eventos: EventosDelPlanJoin | EventosDelPlanJoin[] | null }).eventos;
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    const finTexto = ev?.fecha_fin ?? ev?.fecha_inicio;
    const fin = finTexto ? fechaDesdeTextoEspanol(finTexto) : null;
    if (fin && fin < hoyDate) return false;
    return pasaDiaSemana(ev?.dias_semana, vigencia);
  });

  // Orden de prioridad (ver conversación): puntual propio, puntual cercano,
  // genérico de día fijo vigente hoy propio, ídem cercano, genérico normal
  // propio, genérico normal cercano. DENTRO de cada grupo, por relevancia.
  // Esto se hace en JS, no con `.order(..., {referencedTable})` de
  // PostgREST: probado en directo y ese order NO se aplica de verdad al
  // orden de las filas exteriores (se comprobó que planes de zona cercana
  // aparecían antes que los propios pese a pedir nullsFirst) — ver
  // conversación. `.order("tipo")` en la tabla principal sí funciona bien,
  // pero para evitar sorpresas se ordena todo aquí, en un único sitio fiable.
  function grupo(fila: (typeof vigentes)[number]): number {
    const eventos = (fila as unknown as { eventos: EventosDelPlanJoin | EventosDelPlanJoin[] | null }).eventos;
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    const cercano = ev?.zona_cercana ? 1 : 0;
    return nivelBase(fila.tipo, ev?.dias_semana) * 2 + cercano;
  }
  vigentes.sort((a, b) => {
    const grupoA = grupo(a);
    const grupoB = grupo(b);
    if (grupoA !== grupoB) return grupoA - grupoB;
    const evA = (a as unknown as { eventos: EventosDelPlanJoin | EventosDelPlanJoin[] | null }).eventos;
    const evB = (b as unknown as { eventos: EventosDelPlanJoin | EventosDelPlanJoin[] | null }).eventos;
    const relA = (Array.isArray(evA) ? evA[0] : evA)?.relevancia ?? 0;
    const relB = (Array.isArray(evB) ? evB[0] : evB)?.relevancia ?? 0;
    return relB - relA;
  });

  return vigentes.map((fila) => {
    const { eventos, ...plan } = fila as unknown as Plan & {
      eventos:
        | EventosDelPlanJoin
        | EventosDelPlanJoin[]
        | null;
    };
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    return {
      ...plan,
      evento_slug: ev?.slug ?? null,
      evento_fecha_inicio: ev?.fecha_inicio ?? null,
      evento_fecha_fin: ev?.fecha_fin ?? null,
      evento_categoria: ev?.categoria ?? null,
      evento_cartel_url: ev?.cartel_url ?? null,
      evento_foto_lugar_nombre: ev?.foto_lugar_nombre ?? null,
      evento_zona_cercana: ev?.zona_cercana ?? null,
      evento_zona_cercana_minutos: ev?.zona_cercana_minutos ?? null,
      evento_dias_semana: ev?.dias_semana ?? null,
      evento_titulo_en: ev?.titulo_en ?? null,
      evento_descripcion_en: ev?.descripcion_en ?? null,
      evento_precio_en: ev?.precio_en ?? null,
      evento_preguntas_frecuentes_en: ev?.preguntas_frecuentes_en ?? null,
    };
  });
}

interface EventosDelPlanJoin {
  slug: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  categoria: Categoria | null;
  relevancia: number | null;
  cartel_url: string | null;
  foto_lugar_nombre: string | null;
  zona_cercana: string | null;
  zona_cercana_minutos: number | null;
  dias_semana: number[] | null;
  titulo_en: string | null;
  descripcion_en: string | null;
  precio_en: string | null;
  preguntas_frecuentes_en: Plan["evento_preguntas_frecuentes_en"];
}

export async function getEvento(
  municipioId: string,
  slug: string
): Promise<Evento | null> {
  const { data } = await supabase
    .from("eventos")
    .select(
      "id, municipio_id, slug, titulo, descripcion, momento, audiencia, ubicacion, horario, precio, fecha_inicio, fecha_fin, fuente, preguntas_frecuentes, categoria, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en, lat, lon, primera_deteccion, ultima_deteccion, activo"
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

interface EventosDelDestacadoJoin {
  slug: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  categoria: Categoria | null;
  cartel_url: string | null;
  foto_lugar_nombre: string | null;
  zona_cercana: string | null;
  zona_cercana_minutos: number | null;
  dias_semana: number[] | null;
  titulo_en: string | null;
  descripcion_en: string | null;
  precio_en: string | null;
  preguntas_frecuentes_en: Plan["evento_preguntas_frecuentes_en"];
}

function filaAPlanConMunicipio(
  fila: Plan & {
    eventos: EventosDelDestacadoJoin | EventosDelDestacadoJoin[] | null;
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
    evento_cartel_url: ev?.cartel_url ?? null,
    evento_foto_lugar_nombre: ev?.foto_lugar_nombre ?? null,
    evento_zona_cercana: ev?.zona_cercana ?? null,
    evento_zona_cercana_minutos: ev?.zona_cercana_minutos ?? null,
    evento_dias_semana: ev?.dias_semana ?? null,
    evento_titulo_en: ev?.titulo_en ?? null,
    evento_descripcion_en: ev?.descripcion_en ?? null,
    evento_precio_en: ev?.precio_en ?? null,
    evento_preguntas_frecuentes_en: ev?.preguntas_frecuentes_en ?? null,
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
          "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, fecha_inicio, fecha_fin, categoria, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en)"
        )
        .eq("municipio_id", m.id)
        .contains("vigencia", [vigencia]);

      if (filtrarPorHoy) {
        query = query.eq("fecha_generacion", hoyISO());
      }

      const { data } = await query;

      // Orden en JS, no en SQL — ver getPlanesPorVigencia: el order de
      // PostgREST sobre una columna de la tabla enlazada (referencedTable)
      // no se aplica de verdad al orden de las filas exteriores.
      const filas = (data ?? []).filter((fila) => {
        const ev = Array.isArray(fila.eventos) ? fila.eventos[0] : fila.eventos;
        return pasaDiaSemana(ev?.dias_semana, vigencia);
      });
      filas.sort((a, b) => {
        const evA = Array.isArray(a.eventos) ? a.eventos[0] : a.eventos;
        const evB = Array.isArray(b.eventos) ? b.eventos[0] : b.eventos;
        const grupoA = nivelBase(a.tipo, evA?.dias_semana) * 2 + (evA?.zona_cercana ? 1 : 0);
        const grupoB = nivelBase(b.tipo, evB?.dias_semana) * 2 + (evB?.zona_cercana ? 1 : 0);
        if (grupoA !== grupoB) return grupoA - grupoB;
        return (evB?.relevancia ?? 0) - (evA?.relevancia ?? 0);
      });

      return filas.slice(0, porMunicipio).map((fila) => filaAPlanConMunicipio(fila as never, m));
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
  limite: number,
  filtro?: { audiencia?: "pareja" | "familia"; soloGratis?: boolean }
): Promise<PlanConMunicipio[]> {
  if (municipios.length === 0) return [];
  const municipioPorId = new Map(municipios.map((m) => [m.id, m]));

  let query = supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos!inner(slug, fecha_inicio, fecha_fin, categoria, precio, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en)"
    )
    .in(
      "municipio_id",
      municipios.map((m) => m.id)
    )
    .eq("tipo", "excepcional")
    .overlaps("vigencia", ["hoy", "finde"])
    .order("fecha_generacion", { ascending: false })
    .limit(limite * 10);

  if (filtro?.audiencia) {
    query = query.contains("audiencia", [filtro.audiencia]);
  }

  const { data } = await query;

  // "Mejores" de verdad: por relevancia (ver conversación), no por cuándo
  // se generó. Orden en JS, no en SQL — el order de PostgREST sobre una
  // columna de la tabla enlazada (referencedTable) no se aplica de verdad
  // al orden de las filas exteriores (ver getPlanesPorVigencia). La fecha
  // de generación solo desempata cuando la relevancia coincide.
  const filas = [...(data ?? [])];
  filas.sort((a: any, b: any) => {
    const evA = Array.isArray(a.eventos) ? a.eventos[0] : a.eventos;
    const evB = Array.isArray(b.eventos) ? b.eventos[0] : b.eventos;
    const relA = evA?.relevancia ?? 0;
    const relB = evB?.relevancia ?? 0;
    if (relA !== relB) return relB - relA;
    return (b.fecha_generacion as string).localeCompare(a.fecha_generacion as string);
  });

  const vistos = new Set<string>();
  const resultado: PlanConMunicipio[] = [];
  for (const fila of filas) {
    const f = fila as unknown as Plan & { eventos?: { precio: string | null } | { precio: string | null }[] };
    const clave = f.evento_id ?? f.id;
    if (vistos.has(clave)) continue;
    const m = municipioPorId.get(f.municipio_id);
    if (!m) continue;
    if (filtro?.soloGratis) {
      const ev = Array.isArray(f.eventos) ? f.eventos[0] : f.eventos;
      if (!esPrecioGratis(ev?.precio ?? null)) continue;
    }
    vistos.add(clave);
    resultado.push(filaAPlanConMunicipio(fila as never, m));
    if (resultado.length >= limite) break;
  }
  return resultado;
}

export function getPlanesDestacadosDeMunicipio(
  municipio: { id: string; slug: string; nombre: string },
  limite = 4,
  filtro?: { audiencia?: "pareja" | "familia"; soloGratis?: boolean }
) {
  return getPlanesDestacadosMulti([municipio], limite, filtro);
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
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos!inner(slug, categoria, fecha_inicio, fecha_fin, relevancia, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en)"
    )
    .eq("municipio_id", municipioId)
    .eq("eventos.categoria", categoria);

  if (vigencia) {
    query = query.contains("vigencia", [vigencia]);
  }
  if (filtrarPorHoy) {
    query = query.eq("fecha_generacion", hoyISO());
  }

  const { data } = await query;

  interface EventoCategoriaJoin {
    slug: string;
    categoria: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    relevancia: number | null;
    zona_cercana: string | null;
    zona_cercana_minutos: number | null;
    dias_semana: number[] | null;
    titulo_en: string | null;
    descripcion_en: string | null;
    precio_en: string | null;
    preguntas_frecuentes_en: Plan["evento_preguntas_frecuentes_en"];
  }

  // Mismo orden de prioridad en 4 niveles que el resto de listados (ver
  // conversación): puntual/genérico × propio del municipio/zona cercana,
  // y dentro de cada grupo siempre por relevancia. Orden en JS, no en SQL
  // — ver getPlanesPorVigencia: el order de PostgREST sobre una columna de
  // la tabla enlazada (referencedTable) no se aplica de verdad al orden de
  // las filas exteriores.
  const filas = ((data ?? []) as unknown as (Plan & {
    eventos: EventoCategoriaJoin | EventoCategoriaJoin[] | null;
  })[]).filter((fila) => {
    const ev = Array.isArray(fila.eventos) ? fila.eventos[0] : fila.eventos;
    return pasaDiaSemana(ev?.dias_semana, vigencia ?? "");
  });
  filas.sort((a, b) => {
    const evA = Array.isArray(a.eventos) ? a.eventos[0] : a.eventos;
    const evB = Array.isArray(b.eventos) ? b.eventos[0] : b.eventos;
    const grupoA = (a.tipo === "excepcional" ? 0 : 2) + (evA?.zona_cercana ? 1 : 0);
    const grupoB = (b.tipo === "excepcional" ? 0 : 2) + (evB?.zona_cercana ? 1 : 0);
    if (grupoA !== grupoB) return grupoA - grupoB;
    return (evB?.relevancia ?? 0) - (evA?.relevancia ?? 0);
  });

  return filas.map((fila) => {
    const { eventos, ...plan } = fila;
    const ev = Array.isArray(eventos) ? eventos[0] : eventos;
    return {
      ...plan,
      evento_slug: ev?.slug ?? null,
      evento_fecha_inicio: ev?.fecha_inicio ?? null,
      evento_fecha_fin: ev?.fecha_fin ?? null,
      evento_zona_cercana: ev?.zona_cercana ?? null,
      evento_zona_cercana_minutos: ev?.zona_cercana_minutos ?? null,
      evento_dias_semana: ev?.dias_semana ?? null,
      evento_titulo_en: ev?.titulo_en ?? null,
      evento_descripcion_en: ev?.descripcion_en ?? null,
      evento_precio_en: ev?.precio_en ?? null,
      evento_preguntas_frecuentes_en: ev?.preguntas_frecuentes_en ?? null,
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
      "id, municipio_id, slug, titulo, descripcion, momento, audiencia, ubicacion, horario, precio, fecha_inicio, fecha_fin, fuente, preguntas_frecuentes, categoria, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en, lat, lon, primera_deteccion, ultima_deteccion, activo"
    )
    .eq("municipio_id", municipioId)
    .eq("activo", true);
  if (categoria) query = query.eq("categoria", categoria);
  if (audiencia) {
    // Estricto, mismo criterio que getPlanesPorVigencia — ver conversación.
    query = query.contains("audiencia", [audiencia]);
  }
  const { data } = await query;

  // Orden de prioridad en 4 niveles (ver conversación): puntual del propio
  // municipio primero, luego puntual de zona cercana, luego genérico del
  // propio municipio, y genérico de zona cercana al final — un evento con
  // fecha real del municipio siempre gana a un "Mercado de Abastos" de toda
  // la vida, y lo propio del municipio siempre gana a lo de un pueblo
  // cercano, aunque ese sea puntual. Relevancia desempata dentro de cada
  // grupo. No en SQL porque aquí no hay una columna "tipo" propia (solo
  // fecha_inicio) y esta función también sirve para categoría/audiencia.
  function grupo(e: Evento): number {
    const puntual = e.fecha_inicio !== null;
    const cercano = e.zona_cercana !== null;
    if (puntual && !cercano) return 0;
    if (puntual && cercano) return 1;
    if (!puntual && !cercano) return 2;
    return 3;
  }

  return (data ?? []).sort((a, b) => {
    const grupoA = grupo(a);
    const grupoB = grupo(b);
    if (grupoA !== grupoB) return grupoA - grupoB;
    const relA = a.relevancia ?? 0;
    const relB = b.relevancia ?? 0;
    if (relA !== relB) return relB - relA;
    return a.titulo.localeCompare(b.titulo);
  });
}

// Para la página genérica de categoría (ej. /sevilla/conciertos): todos los
// eventos activos de esa temática, sin filtrar por vigencia de hoy — se lee
// directamente de `eventos` (la ficha estable), no de `planes` (que solo
// tiene la foto del día).
export function getEventosPorCategoria(municipioId: string, categoria: string): Promise<Evento[]> {
  return getEventosDelMunicipio(municipioId, categoria);
}

// Para "esta semana": todos los eventos activos del municipio, de cualquier
// temática — se filtran y ordenan por día (ventana rodante de 7 días desde
// hoy, ver diasRelevantesEstaSemana) en la propia página a partir de
// fecha_inicio/fecha_fin, no aquí (son texto libre, no se pueden filtrar en
// la consulta SQL).
export function getEventosActivos(municipioId: string, audiencia?: "pareja" | "familia"): Promise<Evento[]> {
  return getEventosDelMunicipio(municipioId, undefined, audiencia);
}

function esPrecioGratis(precio: string | null): boolean {
  // Solo cuenta como gratis lo confirmado explícitamente. Sin precio
  // verificado NO se asume gratis bajo ningún concepto — monumentos como la
  // Catedral o el Alcázar pueden generarse como plan "genérico" (son
  // recurrentes, no un evento puntual) y aun así cobrar entrada. Afirmar
  // que algo es gratis sin pruebas es peor que dejarlo fuera de la lista.
  if (precio === null) return false;

  // Si el texto EMPIEZA por "gratis"/"gratuito" (ver gemini.ts, campo
  // "precio"), es que hay una franja realmente abierta a cualquiera (un
  // día/hora concreto, con o sin reserva) aunque el resto del texto
  // mencione el precio normal del resto de días — eso sí cuenta como
  // gratis, ver conversación (ej. "Gratis los lunes 16-19h; el resto 13€").
  if (/^\s*(gratis|gratuit|entrada libre|sin coste)/i.test(precio)) return true;

  // Si en cambio "gratis" aparece de pasada en mitad del texto, es una
  // excepción parcial para un colectivo concreto, no gratis de verdad para
  // el visitante habitual: "6 € (gratis menores de 16 años y clientes
  // CaixaBank)" la contiene, pero para la mayoría el plan cuesta 6€ — si
  // además hay una cifra de dinero de por medio, no cuenta.
  const mencionaGratis = /gratis|gratuit|libre|sin coste/i.test(precio);
  const tieneCifraDeDinero = /\d+\s*(€|euros?)/i.test(precio);
  return mencionaGratis && !tieneCifraDeDinero;
}

// "Gratis" para /esta-semana/gratis y /gratis (atemporal) — mismo criterio
// de esPrecioGratis que getPlanesGratisPorVigencia, pero sobre `eventos`
// (ficha estable) en vez de `planes` del día, porque estas dos no tienen
// su propio lote diario.
export async function getEventosGratisActivos(municipioId: string): Promise<Evento[]> {
  const eventos = await getEventosDelMunicipio(municipioId);
  return eventos.filter((e) => esPrecioGratis(e.precio));
}

// Títulos de los "generico" activos de un municipio, para pasárselos a
// generarPlanesGenericos (ver gemini.ts) y que la búsqueda dedicada amplíe
// el catálogo con sitios nuevos en vez de redescubrir siempre los mismos.
export async function getTitulosGenericosActivos(municipioId: string): Promise<string[]> {
  const { data } = await supabase
    .from("eventos")
    .select("titulo")
    .eq("municipio_id", municipioId)
    .eq("activo", true)
    .is("fecha_inicio", null);
  return (data ?? []).map((e) => e.titulo);
}

// Una dimensión de filtro más (por precio) además de audiencia y vigencia,
// para hoy y finde (que salen del lote diario de `planes`, con su propio
// texto generado — "esta semana" usa getEventosGratisActivos en su lugar,
// sobre `eventos`). Consulta aparte de getPlanesPorVigencia porque
// necesita leer "precio", que vive en `eventos`, no en `planes`.
export async function getPlanesGratisPorVigencia(municipioId: string, vigencia: "hoy" | "finde"): Promise<Plan[]> {
  const { data } = await supabase
    .from("planes")
    .select(
      "id, municipio_id, fecha_generacion, titulo, descripcion, momento, vigencia, audiencia, tipo, evento_id, enlace_afiliado, fuente, eventos(slug, precio, relevancia, cartel_url, foto_lugar_nombre, zona_cercana, zona_cercana_minutos, dias_semana, titulo_en, descripcion_en, precio_en, preguntas_frecuentes_en)"
    )
    .eq("municipio_id", municipioId)
    .contains("vigencia", [vigencia])
    .eq("fecha_generacion", hoyISO());

  interface EventoGratisJoin {
    slug: string;
    precio: string | null;
    relevancia: number | null;
    cartel_url: string | null;
    foto_lugar_nombre: string | null;
    zona_cercana: string | null;
    zona_cercana_minutos: number | null;
    dias_semana: number[] | null;
    titulo_en: string | null;
    descripcion_en: string | null;
    precio_en: string | null;
    preguntas_frecuentes_en: Plan["evento_preguntas_frecuentes_en"];
  }

  // Mismo orden de prioridad en 4 niveles que el resto de listados (ver
  // conversación), hecho en JS — ver getPlanesPorVigencia: el order de
  // PostgREST sobre una columna de la tabla enlazada (referencedTable) no
  // se aplica de verdad al orden de las filas exteriores.
  const filas = ((data ?? []) as unknown as (Plan & {
    eventos: EventoGratisJoin | EventoGratisJoin[] | null;
  })[]).filter((fila) => {
    const ev = Array.isArray(fila.eventos) ? fila.eventos[0] : fila.eventos;
    return pasaDiaSemana(ev?.dias_semana, vigencia);
  });
  filas.sort((a, b) => {
    const evA = Array.isArray(a.eventos) ? a.eventos[0] : a.eventos;
    const evB = Array.isArray(b.eventos) ? b.eventos[0] : b.eventos;
    const grupoA = (a.tipo === "excepcional" ? 0 : 2) + (evA?.zona_cercana ? 1 : 0);
    const grupoB = (b.tipo === "excepcional" ? 0 : 2) + (evB?.zona_cercana ? 1 : 0);
    if (grupoA !== grupoB) return grupoA - grupoB;
    return (evB?.relevancia ?? 0) - (evA?.relevancia ?? 0);
  });

  return filas
    .map((fila) => {
      const { eventos, ...plan } = fila;
      const ev = Array.isArray(eventos) ? eventos[0] : eventos;
      return {
        plan: {
          ...plan,
          evento_slug: ev?.slug ?? null,
          evento_cartel_url: ev?.cartel_url ?? null,
          evento_foto_lugar_nombre: ev?.foto_lugar_nombre ?? null,
          evento_zona_cercana: ev?.zona_cercana ?? null,
          evento_zona_cercana_minutos: ev?.zona_cercana_minutos ?? null,
          evento_dias_semana: ev?.dias_semana ?? null,
          evento_titulo_en: ev?.titulo_en ?? null,
          evento_descripcion_en: ev?.descripcion_en ?? null,
          evento_precio_en: ev?.precio_en ?? null,
          evento_preguntas_frecuentes_en: ev?.preguntas_frecuentes_en ?? null,
        },
        precio: ev?.precio ?? null,
      };
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

export interface MunicipioConRankingGeo extends MunicipioConComunidad {
  provinciaSlug: string;
}

// Municipios que tienen al menos un ranking publicado, con su comunidad y
// provincia embebidas — para la página genérica /rankings (el "elige tu
// ciudad" del vertical de rankings, aparte de la home de Planes). Los
// municipios sin provincia asignada todavía no se pueden enlazar en la
// jerarquía /rankings/espana/... y se descartan aquí.
export async function getMunicipiosConRankings(): Promise<MunicipioConRankingGeo[]> {
  const { data } = await supabase
    .from("listados")
    .select(
      "municipios!inner(id, comunidad_id, slug, nombre, provincia, provincia_id, poblacion, prioridad, lat, lon, comunidades!inner(id, slug, nombre), provincias(slug))"
    );

  const vistos = new Map<string, MunicipioConRankingGeo>();
  for (const fila of (data ?? []) as unknown as Array<{
    municipios:
      | (Municipio & { comunidades: Comunidad; provincias: { slug: string } | { slug: string }[] | null })
      | (Municipio & { comunidades: Comunidad; provincias: { slug: string } | { slug: string }[] | null })[]
      | null;
  }>) {
    const m = Array.isArray(fila.municipios) ? fila.municipios[0] : fila.municipios;
    if (!m || vistos.has(m.id)) continue;
    const provinciaRel = Array.isArray(m.provincias) ? m.provincias[0] : m.provincias;
    if (!provinciaRel) continue;
    const { comunidades, provincias, ...municipio } = m;
    vistos.set(m.id, { ...municipio, comunidad: comunidades, provinciaSlug: provinciaRel.slug });
  }

  return Array.from(vistos.values()).sort((a, b) => a.prioridad - b.prioridad);
}
