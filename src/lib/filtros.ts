import { Music, Palette, Drama, Laugh, Trophy, Store, PartyPopper, Clapperboard, type LucideIcon } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { esMesSlugValido, proximosMesesSlugs, mesSlugParaLocale } from "./dates";
import { CATEGORIAS, esCategoriaConPagina } from "./types";
import { hrefFiltro, segmentoVigencia, type Vigencia, type Extra } from "./rutasLocale";

// hrefFiltro/Vigencia/Extra/AUDIENCIAS_URL/etc. viven en rutasLocale.ts
// (sin imports de servidor, para que LanguageSwitcher.tsx —client— pueda
// usar traducirRutaAOtroIdioma sin arrastrar next-intl/server) — se
// reexportan aquí para no tener que tocar los ~15 archivos que ya
// importaban esto de "@/lib/filtros".
export * from "./rutasLocale";

export interface FiltroTemporalItem {
  label: string;
  href: string;
  activo: boolean;
  icono?: LucideIcon;
  // Marca la pastilla "Siempre" en concreto — nunca llega `activo: true`
  // desde el servidor en su propio hub (ver SiempreHubLayout), pero se
  // quiere un feedback visual al pincharla igualmente (ver conversación:
  // no hay forma de distinguir "por defecto" de "recién pinchada" por URL,
  // así que el efecto vive solo en el cliente, con sessionStorage).
  siempre?: boolean;
  // Igual que `activo` para la pastilla "siempre", pero SiempreHubLayout
  // nunca lo toca (a diferencia de `activo`, que fuerza a false para no
  // mostrarse marcada por defecto) — así el cliente sabe si de verdad
  // sigue en la vigencia "siempre" (con cualquier extra: gratis/con-niños/
  // en-pareja) para no perder la marca visual al combinar con esos, sin
  // tener que comparar la URL exacta (que cambia con cada extra).
  vigenciaEsSiempre?: boolean;
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
  const [t, tMeses, locale] = await Promise.all([
    getTranslations("Filtros"),
    getTranslations("Meses"),
    getLocale(),
  ]);
  const meses = proximosMesesSlugs(2);

  const itemCuando = (vigencia: Exclude<Vigencia, "siempre">, label: string): FiltroTemporalItem => {
    const activo = vigenciaActual === vigencia;
    return { label, href: hrefFiltro(locale, base, activo ? "siempre" : vigencia, extraActual), activo };
  };

  return [
    itemCuando("hoy", t("hoy")),
    itemCuando("finde", t("finde")),
    itemCuando("semana", t("semana")),
    {
      label: t("siempre"),
      href: hrefFiltro(locale, base, "siempre", extraActual),
      activo: vigenciaActual === "siempre",
      siempre: true,
      vigenciaEsSiempre: vigenciaActual === "siempre",
    },
    ...meses.map((mes) => {
      const nombre = tMeses(mes);
      return {
        label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        href: `${base}/${mesSlugParaLocale(mes, locale)}`,
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
  const [t, tCat, locale] = await Promise.all([
    getTranslations("Filtros"),
    getTranslations("Categorias"),
    getLocale(),
  ]);
  const audiencia: FiltroTemporalItem[] = [];
  const precio: FiltroTemporalItem[] = [];
  const tematica: FiltroTemporalItem[] = [];

  if (VIGENCIAS_CONOCIDAS.includes(vigenciaActual)) {
    const vigencia = vigenciaActual as Vigencia;
    const itemExtra = (extra: Extra, label: string): FiltroTemporalItem => {
      const activo = extraActual === extra;
      return { label, href: hrefFiltro(locale, base, vigencia, activo ? undefined : extra), activo };
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
        ? segmentoVigencia(locale, "hoy")
        : vigenciaActual === "finde"
          ? segmentoVigencia(locale, "finde")
          : vigenciaActual === "semana"
            ? segmentoVigencia(locale, "semana")
            : vigenciaActual === "siempre"
              ? null
              : esMesSlugValido(vigenciaActual)
                ? mesSlugParaLocale(vigenciaActual, locale)
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
