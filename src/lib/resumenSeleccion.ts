import { getLocale, getTranslations } from "next-intl/server";
import { formatearFechaLegible } from "./dates";
import type { Categoria, PreguntaFrecuente } from "./types";
import type { Vigencia, Extra } from "./filtros";

export interface ItemResumible {
  categoria?: Categoria | null;
  // true si es un evento real y puntual (con fecha propia), no un plan
  // evergreen (un parque, una ruta) — matiza el texto de intro ("solo estos
  // días" vs un clásico de siempre). Para Plan: p.tipo === "excepcional".
  // Para Evento: e.fecha_inicio !== null (mismo criterio que decide si
  // lleva JSON-LD de Event, ver structuredData.ts).
  puntual?: boolean;
  // ISO (fecha_generacion de Plan, o ultima_deteccion de Evento) — de dónde
  // sacar la fecha de "última actualización" real de la selección.
  fechaActualizacion?: string | null;
}

export interface ConteoCategoria {
  categoria: Categoria;
  cantidad: number;
  // Si AL MENOS uno de los planes de esta categoría en el grupo es puntual
  // — con eso basta para redactar la frase como "solo estos días" en vez
  // de la variante evergreen.
  puntual: boolean;
}

// "otros" (parques, rutas, monumentos genéricos...) es un cajón de sastre
// demasiado amplio para aportar información real en el resumen — se
// excluye del desglose, igual que ya se excluye de las badges de PlanList.
export function contarCategorias(items: ItemResumible[]): ConteoCategoria[] {
  const conteo = new Map<Categoria, { cantidad: number; puntual: boolean }>();
  for (const item of items) {
    if (!item.categoria || item.categoria === "otros") continue;
    const actual = conteo.get(item.categoria) ?? { cantidad: 0, puntual: false };
    conteo.set(item.categoria, {
      cantidad: actual.cantidad + 1,
      puntual: actual.puntual || Boolean(item.puntual),
    });
  }
  return [...conteo.entries()]
    .map(([categoria, { cantidad, puntual }]) => ({ categoria, cantidad, puntual }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

// La fecha más reciente entre todos los planes de la selección — sirve
// como "última actualización" real (no una fecha de sistema arbitraria).
export function fechaActualizacionMasReciente(items: ItemResumible[]): Date | null {
  let masReciente: Date | null = null;
  for (const item of items) {
    if (!item.fechaActualizacion) continue;
    const fecha = new Date(item.fechaActualizacion);
    if (Number.isNaN(fecha.getTime())) continue;
    if (!masReciente || fecha > masReciente) masReciente = fecha;
  }
  return masReciente;
}

// Frases propias en vez de reutilizar las etiquetas de los filtros
// (tFiltros("gratis") = "Gratis"/"Free", pensadas para una pastilla, no
// para encajar en gramática de frase — en inglés "free" necesita ir antes
// del sustantivo y "en pareja"/"con niños" después, así que un único
// hueco de texto no sirve para los tres casos). Sin depender de la lista
// de planes: la usan tanto el resumen en pantalla (ResumenSeleccion) como
// generateMetadata de cada página, que no siempre necesita cargar la lista
// completa solo para construir el title/description.
export async function piezasTemporales(
  vigencia: Vigencia,
  extra?: Extra
): Promise<{ calificador: string; temporal: string }> {
  const [tFiltros, tResumen] = await Promise.all([
    getTranslations("Filtros"),
    getTranslations("ResumenSeleccion"),
  ]);

  const calificador = extra
    ? {
        pareja: tResumen("calificadorPareja"),
        familia: tResumen("calificadorFamilia"),
        gratis: tResumen("calificadorGratis"),
      }[extra]
    : "";
  const temporal = vigencia === "siempre" ? "" : ` ${tFiltros(vigencia).toLowerCase()}`;

  return { calificador, temporal };
}

// Meta-descripción por página: mismo criterio que el párrafo de intro en
// pantalla (ver ResumenSeleccion), pero sin necesitar la lista completa de
// planes — generateMetadata no debería pagar el coste de esa consulta solo
// para el <meta description>.
export async function construirMetaDescripcion(
  municipioNombre: string,
  vigencia: Vigencia,
  extra?: Extra
): Promise<string> {
  const [t, { calificador, temporal }] = await Promise.all([
    getTranslations("ResumenSeleccion"),
    piezasTemporales(vigencia, extra),
  ]);
  // "Pareja" tiene su propia variante que también menciona "románticos" —
  // esa es otra forma real de búsqueda para lo mismo (ver conversación),
  // y solo aquí (no en el H1/H2, que ya leen bien con "en pareja" a secas).
  if (extra === "pareja") {
    return t("metaDescripcionPareja", { municipio: municipioNombre, temporal });
  }
  return t("metaDescripcion", { municipio: municipioNombre, calificador, temporal });
}

// El <title> (a diferencia del H1, que se queda como está) añade un sufijo
// que cubre otra forma real de buscar lo mismo — "planes" en general, o
// "planes románticos" cuando la página es de pareja — sin necesitar una
// URL ni una página aparte para cada variante de búsqueda (ver conversación).
export async function construirTituloConSufijo(tituloBase: string, extra?: Extra): Promise<string> {
  const t = await getTranslations("ResumenSeleccion");
  const sufijo = extra === "pareja" ? t("sufijoTituloRomantico") : t("sufijoTituloPlanes");
  return `${tituloBase}${sufijo}`;
}

// H2 justo antes de la lista de planes — el H1 ya se queda con "Qué
// hacer...", así que este encabezado refuerza "planes" en un encabezado de
// verdad (no solo en un párrafo suelto), y evita el salto H1→H3 directo
// (cada tarjeta de plan ya es un H3, ver PlanList/ListaEventos).
export async function construirTituloLista(
  municipioNombre: string,
  vigencia: Vigencia,
  extra?: Extra
): Promise<string> {
  const [t, { calificador, temporal }] = await Promise.all([
    getTranslations("ResumenSeleccion"),
    piezasTemporales(vigencia, extra),
  ]);
  return t("tituloLista", { municipio: municipioNombre, calificador, temporal });
}

// Categorías con matiz propio de puntual/evergreen — el resto (deporte,
// ferias, fiestas...) se queda solo en número + nombre, sin frase extra:
// no son lo bastante frecuentes en el desglose como para justificar
// redactar una frase a medida para cada una.
const CATEGORIAS_CON_MATIZ = ["conciertos", "teatro", "monologos", "exposiciones", "cine"] as const;

function esCategoriaConMatiz(categoria: Categoria): categoria is (typeof CATEGORIAS_CON_MATIZ)[number] {
  return (CATEGORIAS_CON_MATIZ as readonly string[]).includes(categoria);
}

function clavesMatiz(categoria: Categoria, puntual: boolean): string | null {
  if (!esCategoriaConMatiz(categoria)) return null;
  switch (categoria) {
    case "conciertos":
      return "flavorConciertos";
    case "teatro":
      return "flavorTeatro";
    case "monologos":
      return "flavorMonologos";
    case "exposiciones":
      return puntual ? "flavorExposicionesPuntual" : "flavorExposicionesEvergreen";
    case "cine":
      return puntual ? "flavorCinePuntual" : "flavorCineEvergreen";
  }
}

// "Teatro" y "cine" son sustantivos que no pluralizan en español ("2
// teatro", "2 cine") — se leen mal pegados a un número sin más contexto,
// a diferencia de "conciertos"/"exposiciones"/"monólogos", que ya son
// plurales de por sí. Para estos dos se usa una frase con cabeza plural de
// verdad ("2 funciones de teatro", "2 sesiones de cine").
function etiquetaParaFrase(
  categoria: Categoria,
  t: Awaited<ReturnType<typeof getTranslations>>,
  tCategorias: Awaited<ReturnType<typeof getTranslations>>
): string {
  if (categoria === "teatro") return t("etiquetaTeatroFrase");
  if (categoria === "cine") return t("etiquetaCineFrase");
  return tCategorias(categoria).toLowerCase();
}

// Una cláusula por categoría destacada, ej. "3 exposiciones que solo están
// estos días" — el matiz puntual/evergreen se decide por grupo (ver
// contarCategorias), no por plan individual.
function construirFraseCategoria(
  t: Awaited<ReturnType<typeof getTranslations>>,
  tCategorias: Awaited<ReturnType<typeof getTranslations>>,
  conteo: ConteoCategoria
): string {
  const etiqueta = etiquetaParaFrase(conteo.categoria, t, tCategorias);
  const clave = clavesMatiz(conteo.categoria, conteo.puntual);
  const matiz = clave ? ` ${t(clave)}` : "";
  return `${conteo.cantidad} ${etiqueta}${matiz}`;
}

const TOP_CATEGORIAS_INTRO = 3;

// Párrafo de intro con más chicha que un simple recuento: abre con un
// gancho según cuándo/para quién, y en vez de un desglose seco por
// categoría ("3 exposiciones, 2 conciertos"), cada categoría destacada
// lleva su propio matiz (ver construirFraseCategoria) — sigue siendo 100%
// real (nada inventado, solo mejor contado), y varía solo con lo que haya
// de verdad en cada carga, así que no se repite igual en todas las páginas
// (ver conversación sobre contenido fino a escala).
export async function construirIntroNarrativa(
  items: ItemResumible[],
  municipioNombre: string,
  vigencia: Vigencia,
  extra?: Extra
): Promise<string | null> {
  if (items.length === 0) return null;

  const [t, tCategorias, locale] = await Promise.all([
    getTranslations("ResumenSeleccion"),
    getTranslations("Categorias"),
    getLocale(),
  ]);

  const { calificador } = await piezasTemporales(vigencia, extra);
  const apertura =
    vigencia === "siempre"
      ? t("aperturaSiempre", { municipio: municipioNombre, calificador })
      : t(`apertura${vigencia.charAt(0).toUpperCase()}${vigencia.slice(1)}`, {
          municipio: municipioNombre,
          calificadorElegir: extra
            ? t(`calificadorElegir${extra.charAt(0).toUpperCase()}${extra.slice(1)}`)
            : "",
        });

  const top = contarCategorias(items).slice(0, TOP_CATEGORIAS_INTRO);
  const frasesCategorias = top.map((c) => construirFraseCategoria(t, tCategorias, c));
  const frases = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(frasesCategorias);

  return frases
    ? t("introConDesglose", { apertura, total: items.length, frases })
    : t("introSinDesglose", { apertura, total: items.length });
}

// Dos preguntas, calculadas con los mismos datos que ya usan el párrafo de
// intro y la nota de cierre — nada generado por IA aparte (sin coste
// extra), y el contenido varía de verdad con cada carga. La primera separa
// puntuales de evergreen (ver conversación: cuántos son eventos de estos
// días de verdad, no solo un recuento total); la segunda reutiliza el
// mismo criterio/fecha que ya se muestra al pie de la página.
export async function construirFaqSeleccion(
  items: ItemResumible[],
  municipioNombre: string,
  vigencia: Vigencia,
  extra?: Extra
): Promise<PreguntaFrecuente[]> {
  if (items.length === 0) return [];

  const [t, tCategorias, locale] = await Promise.all([
    getTranslations("ResumenSeleccion"),
    getTranslations("Categorias"),
    getLocale(),
  ]);
  const { calificador, temporal } = await piezasTemporales(vigencia, extra);

  const total = items.length;
  const puntual = items.filter((i) => i.puntual).length;
  const generico = total - puntual;

  const top = contarCategorias(items)
    .filter((c) => c.puntual)
    .slice(0, TOP_CATEGORIAS_INTRO);
  const listaCategorias = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    top.map((c) => `${c.cantidad} ${etiquetaParaFrase(c.categoria, t, tCategorias)}`)
  );
  const desglose = listaCategorias ? t("faq1Desglose", { lista: listaCategorias }) : "";

  const respuesta1 =
    puntual > 0 && generico > 0
      ? t("faq1RespuestaMixta", { total, puntual, generico, desglose })
      : puntual > 0
        ? t("faq1RespuestaSoloPuntual", { total, desglose })
        : t("faq1RespuestaSoloGenerico", { total, temporal });

  const fecha = fechaActualizacionMasReciente(items);
  const respuesta2 =
    t("criterio", { municipio: municipioNombre, calificador, temporal }) +
    (fecha ? ` ${t("actualizado", { fecha: formatearFechaLegible(fecha, locale) })}` : "");

  return [
    { pregunta: t("faq1Pregunta", { calificador, municipio: municipioNombre, temporal }), respuesta: respuesta1 },
    { pregunta: t("faq2Pregunta"), respuesta: respuesta2 },
  ];
}
