import { supabaseAdmin } from "./supabase";
import { slugify } from "./slug";
import { geocodificar } from "./geocode";
import { fechaDesdeTextoEspanol, hoyISO, lunesDeLaSemanaActual, fechasDeLaSemana, formatearFechaISO } from "./dates";
import { mismoEvento, type PlanGenerado } from "./gemini";
import { calcularFilasPorDia } from "./planesPorDia";

export interface EventoVinculado {
  id: string;
  slug: string;
}

// Nominatim geocodifica mejor un nombre de recinto limpio que una dirección
// completa con sala/calle/número (esas versiones detalladas suelen devolver
// cero resultados). Nos quedamos con el primer tramo antes de la coma —
// normalmente el nombre del lugar — y añadimos el municipio como contexto.
function construirConsultaGeocoding(ubicacion: string, municipioNombre: string): string {
  const sinParentesis = ubicacion.replace(/\([^)]*\)/g, "").trim();
  const nombreDelLugar = sinParentesis.split(",")[0].trim();
  return `${nombreDelLugar}, ${municipioNombre}, España`;
}

// mismoEvento compara títulos, y un plan "generico" (evergreen, sin fecha)
// se redacta de cero en cada tanda de generación — el mismo mercado o
// parque real puede salir con un título tan distinto cada vez que el
// solapamiento de palabras no llega al umbral, y se crea una ficha
// duplicada (ver conversación: 4+ fichas para "Mercado de Triana" con
// títulos como "Ruta gastronómica..." / "Jornada de inmersión cultural...").
// Como refuerzo, dos genéricos cuya UBICACIÓN es el mismo lugar real se
// tratan como el mismo evento sin más — la ubicación es un dato mucho más
// estable que el título creativo. Reutiliza el mismo algoritmo de
// mismoEvento (normaliza + solapamiento de palabras), pero solo sobre el
// PRIMER tramo de la ubicación (antes de la primera coma, igual que
// construirConsultaGeocoding) — comparar la dirección completa fundía por
// error un museo con el parque donde está dentro (ej. "La Casa de la
// Ciencia de Sevilla, Parque de María Luisa" acababa emparejado con
// "Parque de María Luisa" a secas, por compartir el nombre del parque en
// la dirección). Con solo el primer tramo, "Setas de Sevilla" y "Metropol
// Parasol (Las Setas de Sevilla)" sí se reconocen como el mismo sitio, sin
// fundir dos lugares distintos que comparten una palabra suelta (ej.
// "Centro Cerámica Triana" vs "Mercado de Triana"). Nunca se aplica a
// "excepcional": dos eventos puntuales en el mismo recinto en fechas
// distintas siguen siendo eventos distintos.
function primerTramoUbicacion(ubicacion: string): string {
  return ubicacion.split(",")[0].trim();
}

// El nombre del municipio es relleno casi universal en las ubicaciones de
// ese municipio ("Piscinas Municipales de Mairena del Aljarafe", "Ateneo
// de Mairena del Aljarafe"...) — sin quitarlo, dos lugares completamente
// distintos comparten esas palabras y el solapamiento de mismoEvento los
// funde por error (ver conversación: piscinas municipales y el ateneo
// acabaron "emparejados" solo por compartir "Mairena del Aljarafe").
function quitarMunicipio(texto: string, municipioNombre: string): string {
  const escapado = municipioNombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto.replace(new RegExp(`\\s*,?\\s*(de\\s+)?${escapado}\\s*$`, "i"), "").trim();
}

// mismoEvento a secas también se deja engañar por el nombre del municipio
// cuando aparece en el TÍTULO (no solo en la ubicación): "Visita cultural
// al Castillo de Alcalá de Guadaíra" y "Visita cultural al Museo de Alcalá
// de Guadaíra" comparten "visita/cultural/alcalá/guadaíra" y ya superan el
// umbral aunque "castillo" y "museo" no coincidan en absoluto — ver
// conversación (detectado limpiando duplicados). Quitar el nombre del
// municipio del título antes de comparar es la misma idea que ya se
// aplica a la ubicación en mismoLugarGenerico.
function mismoTitulo(a: string, b: string, municipioNombre: string): boolean {
  return mismoEvento(quitarMunicipio(a, municipioNombre), quitarMunicipio(b, municipioNombre));
}

function mismoLugarGenerico(
  a: { esGenerico: boolean; ubicacion: string | null | undefined },
  b: { esGenerico: boolean; ubicacion: string | null | undefined },
  municipioNombre: string
): boolean {
  if (!a.esGenerico || !b.esGenerico) return false;
  if (!a.ubicacion || !b.ubicacion) return false;
  const tramoA = quitarMunicipio(primerTramoUbicacion(a.ubicacion), municipioNombre);
  const tramoB = quitarMunicipio(primerTramoUbicacion(b.ubicacion), municipioNombre);
  if (!tramoA || !tramoB) return false;
  return mismoEvento(tramoA, tramoB);
}

// Da identidad estable a TODOS los planes de un lote recién generado (no
// solo los puntuales — un plan genérico como "Parque Municipal" es igual de
// clicable y, de hecho, al repetirse cada día acaba siendo una página
// evergreen con más autoridad acumulada que una puntual): si el evento ya
// existe en este municipio (de CUALQUIER ejecución anterior, no solo de
// este lote), lo actualiza en vez de crear una fila nueva. Los que no se
// detectan hoy pasan a "activo = false" — no se borran, para no romper
// enlaces ni URLs ya indexadas.
//
// "¿Ya existe?" se decide por título parecido (mismoEvento), no por slug
// exacto — el mismo evento real puede llegar con un título ligeramente
// distinto según qué búsqueda lo haya encontrado (diaria, semanal, mensual,
// o una de las dedicadas por variable), y compararlo letra a letra dejaba
// pasar justo esos casos, produciendo una URL duplicada por cada redacción
// distinta del mismo evento (ver conversación).
//
// Devuelve, por índice dentro del array `planes` original, el evento
// vinculado (id + slug) para cada plan.
export async function upsertEventosDelLote(
  municipioId: string,
  municipioNombre: string,
  planes: PlanGenerado[],
  hoy: string,
  // true (generación semanal, "foto completa"): cualquier evento de este
  // municipio no detectado hoy se marca inactivo — es correcto porque el
  // lote representa TODO lo que hay. false (repaso diario, "solo lo
  // nuevo"): el lote es parcial a propósito, así que desactivar por
  // ausencia borraría de la vista eventos que siguen vigentes y que
  // simplemente no tocaba repasar hoy.
  desactivarNoEncontrados: boolean = true
): Promise<Map<number, EventoVinculado>> {
  const vinculos = new Map<number, EventoVinculado>();
  if (!supabaseAdmin) return vinculos;

  const { data: existentes, error: errorSelectExistentes } = await supabaseAdmin
    .from("eventos")
    .select("id, slug, titulo, lat, lon, ubicacion, fecha_inicio")
    .eq("municipio_id", municipioId);
  if (errorSelectExistentes) {
    throw new Error(`eventos.select (existentes): ${errorSelectExistentes.message}`);
  }

  // Copia mutable: una vez que un evento ya guardado se empareja con un
  // grupo de este lote, se retira de la lista para que otro grupo no pueda
  // "robárselo" también.
  const disponibles = [...(existentes ?? [])];
  const slugsOcupados = new Set((existentes ?? []).map((e) => e.slug));

  // Agrupa ANTES de tocar la BD: dos planes de este mismo lote pueden ser
  // el mismo evento real (típico cuando la búsqueda mixta y una dedicada
  // encuentran el mismo concierto por separado) sin que fusionarPlanesDuplicados
  // los haya unido ya más arriba. Sin este paso, el primero de los dos se
  // empareja con la fila existente y la "consume" de `disponibles`, dejando
  // al segundo sin nada contra qué emparejar y creando un duplicado nuevo.
  const grupos: number[][] = [];
  for (let i = 0; i < planes.length; i++) {
    const grupo = grupos.find(
      (g) =>
        mismoTitulo(planes[g[0]].titulo, planes[i].titulo, municipioNombre) ||
        mismoLugarGenerico(
          { esGenerico: planes[g[0]].tipo === "generico", ubicacion: planes[g[0]].ubicacion },
          { esGenerico: planes[i].tipo === "generico", ubicacion: planes[i].ubicacion },
          municipioNombre
        )
    );
    if (grupo) grupo.push(i);
    else grupos.push([i]);
  }

  for (const grupo of grupos) {
    // El título más largo del grupo suele ser el más descriptivo (mismo
    // criterio que fusionarPlanesDuplicados), y las audiencias se unen sin
    // repetir "generico" si ya hay alguna específica.
    const indiceRepresentante = grupo.reduce(
      (mejor, i) => (planes[i].titulo.length > planes[mejor].titulo.length ? i : mejor),
      grupo[0]
    );
    const p = planes[indiceRepresentante];
    const audienciaUnida = Array.from(new Set(grupo.flatMap((i) => planes[i].audiencia)));
    const especificas = audienciaUnida.filter((a) => a !== "generico");

    // Traducción: si traducirPlanesAIngles falló esta pasada (ver
    // conversación, ahora no aborta la generación), p.descripcion_en/
    // precio_en/preguntas_frecuentes_en llegan `undefined` — en ese caso NO
    // se toca lo que ya hubiera guardado (evita borrar una traducción buena
    // de una pasada anterior por un fallo puntual de red/API). Cuando el
    // campo en español real SÍ ha desaparecido (precio ya no viene, sin
    // preguntas frecuentes), su traducción se fuerza a null/vacío igual,
    // haya fallado la traducción o no — no tiene sentido dejar un precio o
    // unas FAQ en inglés de algo que ya no está en español.
    const traduccionDescripcion = p.descripcion_en !== undefined ? { descripcion_en: p.descripcion_en } : {};
    const traduccionPrecio =
      p.precio == null ? { precio_en: null } : p.precio_en !== undefined ? { precio_en: p.precio_en } : {};
    const traduccionPreguntas =
      !p.preguntas_frecuentes || p.preguntas_frecuentes.length === 0
        ? { preguntas_frecuentes_en: null }
        : p.preguntas_frecuentes_en !== undefined
          ? { preguntas_frecuentes_en: p.preguntas_frecuentes_en }
          : {};

    const datos = {
      descripcion: p.descripcion,
      momento: p.momento,
      audiencia: especificas.length > 0 ? especificas : audienciaUnida,
      ubicacion: p.ubicacion ?? null,
      horario: p.horario ?? null,
      precio: p.precio ?? null,
      fecha_inicio: p.fecha_inicio ?? null,
      fecha_fin: p.fecha_fin ?? null,
      fuente: p.fuente ?? null,
      preguntas_frecuentes: p.preguntas_frecuentes ?? [],
      categoria: p.categoria ?? "otros",
      relevancia: p.relevancia ?? null,
      zona_cercana: p.zona_cercana ?? null,
      zona_cercana_minutos: p.zona_cercana_minutos ?? null,
      dias_semana: p.dias_semana ?? null,
      ...traduccionDescripcion,
      ...traduccionPrecio,
      ...traduccionPreguntas,
    };

    const idxExistente = disponibles.findIndex(
      (e) =>
        mismoTitulo(e.titulo, p.titulo, municipioNombre) ||
        mismoLugarGenerico(
          { esGenerico: e.fecha_inicio === null, ubicacion: e.ubicacion },
          { esGenerico: p.tipo === "generico", ubicacion: p.ubicacion },
          municipioNombre
        )
    );
    const existente = idxExistente >= 0 ? disponibles[idxExistente] : null;

    let vinculo: EventoVinculado;

    if (existente) {
      disponibles.splice(idxExistente, 1);

      // Solo geocodifica si todavía no tiene coordenadas — Nominatim es
      // gratis pero pide un uso comedido, así que nunca se repite.
      const coords =
        existente.lat === null && datos.ubicacion
          ? await geocodificar(construirConsultaGeocoding(datos.ubicacion, municipioNombre))
          : null;

      const { error: errorUpdate } = await supabaseAdmin
        .from("eventos")
        .update({
          ...datos,
          ...(coords ?? {}),
          ultima_deteccion: hoy,
          activo: true,
        })
        .eq("id", existente.id);
      if (errorUpdate) throw new Error(`eventos.update (${existente.slug}): ${errorUpdate.message}`);
      vinculo = { id: existente.id, slug: existente.slug };
    } else {
      // Sin coincidencia por título — es un evento nuevo de verdad. El slug
      // se deriva del título, pero dos títulos bien distintos podrían
      // normalizar al mismo slug (choca con la restricción unique de la
      // tabla); en ese caso raro se numera para no pisar al que ya existe.
      let slug = slugify(p.titulo);
      if (slugsOcupados.has(slug)) {
        let n = 2;
        while (slugsOcupados.has(`${slug}-${n}`)) n++;
        slug = `${slug}-${n}`;
      }
      slugsOcupados.add(slug);

      const coords = datos.ubicacion
        ? await geocodificar(construirConsultaGeocoding(datos.ubicacion, municipioNombre))
        : null;

      const { data: creado, error: errorInsert } = await supabaseAdmin
        .from("eventos")
        .insert({
          municipio_id: municipioId,
          slug,
          titulo: p.titulo,
          titulo_en: p.titulo_en ?? null,
          ...datos,
          lat: coords?.lat ?? null,
          lon: coords?.lon ?? null,
          primera_deteccion: hoy,
          ultima_deteccion: hoy,
          activo: true,
          // Solo se estampa al crear la fila — la procedencia real de un
          // evento no cambia porque una pasada posterior (búsqueda normal
          // de Gemini) lo vuelva a detectar y actualizar (ver `datos`,
          // arriba, que sí se reutiliza en el update).
          origen: p.origen ?? "gemini",
        })
        .select("id")
        .single();
      if (errorInsert) throw new Error(`eventos.insert (${slug}): ${errorInsert.message}`);
      if (!creado) continue;
      vinculo = { id: creado.id, slug };
    }

    for (const i of grupo) vinculos.set(i, vinculo);
  }

  if (desactivarNoEncontrados) {
    // Margen de gracia en vez de "no visto en este lote = terminado": con
    // generación semanal, un plan genérico evergreen (un parque, un museo)
    // puede no salir mencionado en el lote de una semana concreta sin que
    // eso signifique que ha dejado de existir. Solo si lleva varias semanas
    // seguidas sin aparecer se asume que ya no es relevante.
    const DIAS_GRACIA = 21;
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_GRACIA);
    const fechaLimiteISO = fechaLimite.toISOString().slice(0, 10);

    const { error: errorInactivarPorAusencia } = await supabaseAdmin
      .from("eventos")
      .update({ activo: false })
      .eq("municipio_id", municipioId)
      .lt("ultima_deteccion", fechaLimiteISO);
    if (errorInactivarPorAusencia) {
      throw new Error(`eventos.inactivar (ausencia): ${errorInactivarPorAusencia.message}`);
    }

    // Además, un evento puntual cuya fecha_fin ya haya pasado de verdad se
    // desactiva de inmediato — aquí no hace falta esperar al margen de
    // gracia, ya sabemos con certeza que ha terminado.
    const { data: activosConFecha, error: errorSelectFechas } = await supabaseAdmin
      .from("eventos")
      .select("id, fecha_fin")
      .eq("municipio_id", municipioId)
      .eq("activo", true)
      .not("fecha_fin", "is", null);
    if (errorSelectFechas) throw new Error(`eventos.select (fechas): ${errorSelectFechas.message}`);

    const hoyDate = new Date(hoy);
    const idsFinalizados = (activosConFecha ?? [])
      .filter((e) => {
        const fin = e.fecha_fin ? fechaDesdeTextoEspanol(e.fecha_fin) : null;
        return fin !== null && fin < hoyDate;
      })
      .map((e) => e.id);

    if (idsFinalizados.length > 0) {
      const { error: errorInactivarFinalizados } = await supabaseAdmin
        .from("eventos")
        .update({ activo: false })
        .in("id", idsFinalizados);
      if (errorInactivarFinalizados) {
        throw new Error(`eventos.inactivar (finalizados): ${errorInactivarFinalizados.message}`);
      }
    }
  }

  return vinculos;
}

// Como upsertEventosDelLote, pero además deja la(s) fila(s) de `planes` de
// esta semana (mismo bloque que ya usan generate-daily/generate-weekly) —
// pensada para importaciones manuales de un listado ya extraído (ver
// generarPlanesDesdeListado en gemini.ts). Sin esto, un evento importado a
// mano quedaba bien en `eventos` pero invisible en cualquier página que
// dependa de `planes` sin relleno propio (categoría+hoy, categoría+fin de
// semana) — bug real encontrado en conversación, ya cubierto también por
// relleno en esas dos páginas, pero esta función evita que vuelva a faltar
// la fila curada de origen la próxima vez que se importe algo a mano.
// Solo cubre la semana en curso (como el cron diario): un evento puntual
// muy lejano en el tiempo no recibe fila hasta que su semana llegue — ver
// conversación, coherente con cómo ya funciona el resto del sitio.
export async function upsertEventosYPlanesDelLote(
  municipioId: string,
  municipioNombre: string,
  planes: PlanGenerado[]
): Promise<Map<number, EventoVinculado>> {
  const hoy = hoyISO();
  const vinculos = await upsertEventosDelLote(municipioId, municipioNombre, planes, hoy, false);
  if (!supabaseAdmin) return vinculos;

  const diasRestantesSemana = fechasDeLaSemana(lunesDeLaSemanaActual()).filter(
    (d) => formatearFechaISO(d) >= hoy
  );
  const filas = calcularFilasPorDia(planes, diasRestantesSemana);

  if (filas.length > 0) {
    const { error: errorInsert } = await supabaseAdmin.from("planes").insert(
      filas.map((f) => ({
        municipio_id: municipioId,
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
    if (errorInsert) throw new Error(`planes.insert (lote manual): ${errorInsert.message}`);
  }

  return vinculos;
}
