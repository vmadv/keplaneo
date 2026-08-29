import { supabaseAdmin } from "./supabase";
import { slugify } from "./slug";
import { geocodificar } from "./geocode";
import { fechaDesdeTextoEspanol } from "./dates";
import { mismoEvento, type PlanGenerado } from "./gemini";

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
    .select("id, slug, titulo, lat, lon")
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
    const grupo = grupos.find((g) => mismoEvento(planes[g[0]].titulo, planes[i].titulo));
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
    };

    const idxExistente = disponibles.findIndex((e) => mismoEvento(e.titulo, p.titulo));
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
          ...datos,
          lat: coords?.lat ?? null,
          lon: coords?.lon ?? null,
          primera_deteccion: hoy,
          ultima_deteccion: hoy,
          activo: true,
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
