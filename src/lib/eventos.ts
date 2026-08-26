import { supabaseAdmin } from "./supabase";
import { slugify } from "./slug";
import { geocodificar } from "./geocode";
import { fechaDesdeTextoEspanol } from "./dates";
import type { PlanGenerado } from "./gemini";

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
// evergreen con más autoridad acumulada que una puntual): si ya existe un
// evento con el mismo slug en este municipio, lo actualiza (misma URL,
// datos frescos); si no, lo crea. Los que no se detectan hoy pasan a
// "activo = false" — no se borran, para no romper enlaces ni URLs ya
// indexadas.
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

  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];

    const slug = slugify(p.titulo);
    const datos = {
      descripcion: p.descripcion,
      momento: p.momento,
      audiencia: p.audiencia,
      ubicacion: p.ubicacion ?? null,
      horario: p.horario ?? null,
      precio: p.precio ?? null,
      fecha_inicio: p.fecha_inicio ?? null,
      fecha_fin: p.fecha_fin ?? null,
      fuente: p.fuente ?? null,
      preguntas_frecuentes: p.preguntas_frecuentes ?? [],
      categoria: p.categoria ?? "otros",
    };

    const { data: existente, error: errorSelect } = await supabaseAdmin
      .from("eventos")
      .select("id, lat, lon")
      .eq("municipio_id", municipioId)
      .eq("slug", slug)
      .maybeSingle();
    if (errorSelect) throw new Error(`eventos.select (${slug}): ${errorSelect.message}`);

    if (existente) {
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
      if (errorUpdate) throw new Error(`eventos.update (${slug}): ${errorUpdate.message}`);
      vinculos.set(i, { id: existente.id, slug });
    } else {
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
      if (creado) vinculos.set(i, { id: creado.id, slug });
    }
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
