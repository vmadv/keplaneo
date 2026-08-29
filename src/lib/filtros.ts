import { Music, Palette, Drama, Laugh, Trophy, Store, PartyPopper, Clapperboard, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { esMesSlugValido, proximosMesesSlugs } from "./dates";
import { CATEGORIAS, esCategoriaConPagina } from "./types";

export interface FiltroTemporalItem {
  label: string;
  href: string;
  activo: boolean;
  icono?: LucideIcon;
}

// "Cuándo" (cuatro franjas, mutuamente excluyentes) y "Filtra más" (a
// quién va dirigido / precio, también mutuamente excluyente entre sí) son
// dos ejes independientes que SÍ se pueden combinar — ver conversación.
// "siempre" es la franja atemporal ("qué hacer en Sevilla" a secas, sin
// restringir por fecha): vive en las mismas rutas base que ya existían
// (/sevilla, /sevilla/gratis) en vez de un segmento "/siempre" nuevo.
export type Vigencia = "siempre" | "hoy" | "finde" | "semana";
export type Extra = "pareja" | "familia" | "gratis";

const SEGMENTO_VIGENCIA: Record<Exclude<Vigencia, "siempre">, string> = {
  hoy: "hoy",
  finde: "fin-de-semana",
  semana: "esta-semana",
};

// El slug de "en pareja" cambia según si hay vigencia o no (/hoy/pareja vs
// /en-pareja); el de "con niños" es el mismo en los dos casos, tal cual se
// busca de verdad. El valor interno sigue siendo "familia" (así está
// guardado en la base de datos y en el campo `audiencia` de Gemini) — solo
// cambia lo que se ve en la URL, ver audienciaDesdeUrl más abajo. "gratis"
// es igual en los dos casos.
const SLUG_EXTRA_TEMPORAL: Record<Extra, string> = { pareja: "pareja", familia: "con-ninos", gratis: "gratis" };
const SLUG_EXTRA_ATEMPORAL: Record<Extra, string> = { pareja: "en-pareja", familia: "con-ninos", gratis: "gratis" };

// Slugs de URL para la ruta dinámica [audiencia] (hoy/finde/esta-semana) —
// distintos del valor interno "familia" que ya usan queries.ts y la BD.
export const AUDIENCIAS_URL = ["pareja", "con-ninos"] as const;
export type AudienciaUrl = (typeof AUDIENCIAS_URL)[number];

export function esAudienciaUrlValida(valor: string): valor is AudienciaUrl {
  return (AUDIENCIAS_URL as readonly string[]).includes(valor);
}

export function audienciaDesdeUrl(slug: AudienciaUrl): Extract<Extra, "pareja" | "familia"> {
  return slug === "con-ninos" ? "familia" : "pareja";
}

export function hrefFiltro(base: string, vigencia: Vigencia, extra?: Extra): string {
  // "siempre" sin extra es el hub a secas (`base`) — es la URL corta y
  // canónica a la que ya apunta "Qué hacer" del menú, la que de verdad
  // puede posicionar para "qué hacer en {municipio}" (ver conversación:
  // "no podemos crear una url que se llame siempre").
  const segVigencia = vigencia === "siempre" ? "" : `/${SEGMENTO_VIGENCIA[vigencia]}`;
  if (!extra) return `${base}${segVigencia}`;
  const slugExtra = vigencia === "siempre" ? SLUG_EXTRA_ATEMPORAL[extra] : SLUG_EXTRA_TEMPORAL[extra];
  return `${base}${segVigencia}/${slugExtra}`;
}

// Barra de filtros tipo "entradas.com": Hoy / Este fin de semana / Esta
// semana / Siempre / los próximos meses generados, todos como pestañas de la
// misma página en vez de enlaces sueltos a páginas separadas. Los slugs de
// mes en la URL se quedan siempre en español (mismo criterio que los
// topónimos); solo la etiqueta visible se traduce.
//
// extraActual: si ya hay un filtro de "en pareja/con niños/gratis" puesto,
// las cuatro franjas lo mantienen al cambiar entre ellas (cambiando de
// slug si hace falta, ver SLUG_EXTRA_ATEMPORAL). Los meses no cruzan con
// extra — no existe página `/agosto/pareja`.
//
// Pinchar en la franja YA activa la desactiva (vuelve a "siempre" en vez
// de quedarse en la misma página) — mismo criterio que extraActual en
// construirFiltrosSecundarios, para que cualquiera de las dos pastillas
// activas actúe como toggle.
export async function construirFiltrosTemporales(
  base: string,
  vigenciaActual: string,
  extraActual?: Extra
): Promise<FiltroTemporalItem[]> {
  const [t, tMeses] = await Promise.all([getTranslations("Filtros"), getTranslations("Meses")]);
  const meses = proximosMesesSlugs(2);

  const itemCuando = (vigencia: Exclude<Vigencia, "siempre">, label: string): FiltroTemporalItem => {
    const activo = vigenciaActual === vigencia;
    return { label, href: hrefFiltro(base, activo ? "siempre" : vigencia, extraActual), activo };
  };

  return [
    itemCuando("hoy", t("hoy")),
    itemCuando("finde", t("finde")),
    itemCuando("semana", t("semana")),
    {
      label: t("siempre"),
      href: hrefFiltro(base, "siempre", extraActual),
      activo: vigenciaActual === "siempre",
    },
    ...meses.map((mes) => {
      const nombre = tMeses(mes);
      return {
        label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        href: `${base}/${mes}`,
        activo: vigenciaActual === mes,
      };
    }),
  ];
}

// Compartido con las tarjetas de listado (ListaEventos/PlanList), que lo
// usan para el badge de "de qué trata" — "otros" queda fuera a propósito,
// no aporta información suficiente para un icono propio.
export const ICONO_CATEGORIA: Partial<Record<string, LucideIcon>> = {
  conciertos: Music,
  exposiciones: Palette,
  teatro: Drama,
  monologos: Laugh,
  deporte: Trophy,
  ferias: Store,
  fiestas: PartyPopper,
  cine: Clapperboard,
};

export interface FiltrosSecundariosAgrupados {
  audiencia: FiltroTemporalItem[];
  precio: FiltroTemporalItem[];
  tematica: FiltroTemporalItem[];
}

const VIGENCIAS_CONOCIDAS: readonly string[] = ["siempre", "hoy", "finde", "semana"];

// Tres ejes independientes (a quién va dirigido, cuánto cuesta, de qué
// trata) — se devuelven agrupados en vez de en una sola lista plana, para
// que la interfaz pueda mostrarlos como grupos distintos. "Filtra más"
// (audiencia + precio) ya existe para las cuatro franjas de Cuándo;
// "temática" solo para hoy/finde/mes, que son las únicas con página propia
// por categoría.
export async function construirFiltrosSecundarios(
  base: string,
  vigenciaActual: string,
  extraActual?: Extra,
  // Cuando ya se está dentro de una página de categoría (ej.
  // /sevilla/conciertos/hoy), marca esa pastilla como activa — así "Más
  // filtros" se abre solo (ver hayActivoOculto en FiltrosPagina) y se ve
  // resaltado en qué categoría se está, en vez de tener que buscarla a
  // ciegas dentro del desplegable.
  categoriaActual?: string
): Promise<FiltrosSecundariosAgrupados> {
  const [t, tCat] = await Promise.all([getTranslations("Filtros"), getTranslations("Categorias")]);
  const audiencia: FiltroTemporalItem[] = [];
  const precio: FiltroTemporalItem[] = [];
  const tematica: FiltroTemporalItem[] = [];

  if (VIGENCIAS_CONOCIDAS.includes(vigenciaActual)) {
    const vigencia = vigenciaActual as Vigencia;
    const itemExtra = (extra: Extra, label: string): FiltroTemporalItem => {
      const activo = extraActual === extra;
      return { label, href: hrefFiltro(base, vigencia, activo ? undefined : extra), activo };
    };
    audiencia.push(itemExtra("pareja", t("enPareja")), itemExtra("familia", t("enFamilia")));
    precio.push(itemExtra("gratis", t("gratis")));
  }

  // Temática (categorías) para hoy/finde/semana/mes (combinación propia,
  // /conciertos/hoy) y para "siempre" (el hub de la categoría a secas,
  // /conciertos — ya existía, solo faltaba enlazarlo desde aquí).
  if (
    vigenciaActual === "hoy" ||
    vigenciaActual === "finde" ||
    vigenciaActual === "semana" ||
    vigenciaActual === "siempre" ||
    esMesSlugValido(vigenciaActual)
  ) {
    const sufijo =
      vigenciaActual === "hoy"
        ? "hoy"
        : vigenciaActual === "finde"
          ? "fin-de-semana"
          : vigenciaActual === "semana"
            ? "esta-semana"
            : vigenciaActual === "siempre"
              ? null
              : vigenciaActual;
    for (const cat of CATEGORIAS.filter(esCategoriaConPagina)) {
      const activo = cat === categoriaActual;
      const destinoActivo = sufijo ? `${base}/${sufijo}` : base;
      const destinoCategoria = sufijo ? `${base}/${cat}/${sufijo}` : `${base}/${cat}`;
      tematica.push({
        label: tCat(cat),
        href: activo ? destinoActivo : destinoCategoria,
        activo,
        icono: ICONO_CATEGORIA[cat],
      });
    }
  }

  return { audiencia, precio, tematica };
}
