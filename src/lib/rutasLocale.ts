// Construcción/traducción de segmentos de URL por idioma — sin imports de
// servidor (next-intl/server, etc.) a propósito: LanguageSwitcher.tsx es un
// client component y necesita poder importar traducirRutaAOtroIdioma sin
// arrastrar código server-only al bundle del cliente. filtros.ts reexporta
// todo esto para que el resto del código (que ya importaba de ahí) no
// tenga que cambiar sus imports.
import { esMesSlugValido, normalizarMesSlug, mesSlugParaLocale } from "./dates";

// Fuente única para el dominio real del sitio — antes cada archivo repetía
// `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` por su
// cuenta; con metadataBase/hreflang tocando ahora casi todas las páginas,
// mejor un solo sitio donde cambiarlo.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// "Cuándo" (cuatro franjas, mutuamente excluyentes) y "Filtra más" (a
// quién va dirigido / precio, también mutuamente excluyente entre sí) son
// dos ejes independientes que SÍ se pueden combinar — ver conversación.
// "siempre" es la franja atemporal ("qué hacer en Sevilla" a secas, sin
// restringir por fecha): vive en las mismas rutas base que ya existían
// (/sevilla, /sevilla/gratis) en vez de un segmento "/siempre" nuevo.
export type Vigencia = "siempre" | "hoy" | "finde" | "semana";
export type Extra = "pareja" | "familia" | "gratis";

type Locale = "es" | "en";

function loc(locale: string): Locale {
  return locale === "en" ? "en" : "es";
}

// Segmentos de URL por idioma (ver conversación: antes solo existían en
// español; ahora /en/... usa las palabras en inglés para posicionar de
// verdad, no solo cambiar el prefijo).
const SEGMENTO_VIGENCIA: Record<Locale, Record<Exclude<Vigencia, "siempre">, string>> = {
  es: { hoy: "hoy", finde: "fin-de-semana", semana: "esta-semana" },
  en: { hoy: "today", finde: "this-weekend", semana: "this-week" },
};

// El slug de "en pareja" cambia según si hay vigencia o no (/hoy/pareja vs
// /en-pareja); el de "con niños" es el mismo en los dos casos, tal cual se
// busca de verdad. El valor interno sigue siendo "familia" (así está
// guardado en la base de datos y en el campo `audiencia` de Gemini) — solo
// cambia lo que se ve en la URL, ver audienciaDesdeUrl más abajo.
const SLUG_EXTRA_TEMPORAL: Record<Locale, Record<Extra, string>> = {
  es: { pareja: "pareja", familia: "con-ninos", gratis: "gratis" },
  en: { pareja: "couple", familia: "with-kids", gratis: "free" },
};
const SLUG_EXTRA_ATEMPORAL: Record<Locale, Record<Extra, string>> = {
  es: { pareja: "en-pareja", familia: "con-ninos", gratis: "gratis" },
  en: { pareja: "for-couples", familia: "with-kids", gratis: "free" },
};

export function hrefFiltro(locale: string, base: string, vigencia: Vigencia, extra?: Extra): string {
  const l = loc(locale);
  // "siempre" sin extra es el hub a secas (`base`) — es la URL corta y
  // canónica a la que ya apunta "Qué hacer" del menú, la que de verdad
  // puede posicionar para "qué hacer en {municipio}" (ver conversación:
  // "no podemos crear una url que se llame siempre").
  const segVigencia = vigencia === "siempre" ? "" : `/${SEGMENTO_VIGENCIA[l][vigencia]}`;
  if (!extra) return `${base}${segVigencia}`;
  const slugExtra = vigencia === "siempre" ? SLUG_EXTRA_ATEMPORAL[l][extra] : SLUG_EXTRA_TEMPORAL[l][extra];
  return `${base}${segVigencia}/${slugExtra}`;
}

// Para construir el segmento de una vigencia concreta fuera de hrefFiltro
// (ej. el sufijo de categoría+vigencia en construirFiltrosSecundarios).
export function segmentoVigencia(locale: string, vigencia: Exclude<Vigencia, "siempre">): string {
  return SEGMENTO_VIGENCIA[loc(locale)][vigencia];
}

// Slugs de URL para la ruta dinámica [audiencia] (hoy/finde/esta-semana) —
// distintos del valor interno "familia" que ya usan queries.ts y la BD. El
// valor canónico (el que entienden queries.ts/audienciaDesdeUrl) sigue
// siendo el español — normalizarAudienciaUrl hace la vuelta desde inglés.
export const AUDIENCIAS_URL = ["pareja", "con-ninos"] as const;
export type AudienciaUrl = (typeof AUDIENCIAS_URL)[number];

export function esAudienciaUrlValida(valor: string): valor is AudienciaUrl {
  return (AUDIENCIAS_URL as readonly string[]).includes(valor);
}

export function audienciaDesdeUrl(slug: AudienciaUrl): Extract<Extra, "pareja" | "familia"> {
  return slug === "con-ninos" ? "familia" : "pareja";
}

const AUDIENCIA_URL_EN: Record<AudienciaUrl, string> = { pareja: "couple", "con-ninos": "with-kids" };
const AUDIENCIA_URL_EN_A_ES: Record<string, AudienciaUrl> = { couple: "pareja", "with-kids": "con-ninos" };

// Acepta el slug de [audiencia] en cualquiera de los dos idiomas y siempre
// devuelve el español (canónico) — igual que normalizarMesSlug en dates.ts.
export function normalizarAudienciaUrl(valor: string): AudienciaUrl | null {
  if (esAudienciaUrlValida(valor)) return valor;
  return AUDIENCIA_URL_EN_A_ES[valor] ?? null;
}

export function audienciaUrlParaLocale(valor: AudienciaUrl, locale: string): string {
  return locale === "en" ? AUDIENCIA_URL_EN[valor] : valor;
}

// Traduce un pathname completo de un idioma a otro, segmento a segmento —
// para el selector de idioma (LanguageSwitcher.tsx), que solo tiene el
// pathname actual, no la estructura de la página. Cualquier segmento que
// no coincida con una vigencia/extra/audiencia/mes conocidos (el slug del
// municipio, una categoría, el slug de un evento, "rankings"...) se
// devuelve tal cual, sin tocar.
export function traducirRutaAOtroIdioma(pathname: string, localeDestino: string): string {
  const destino = loc(localeDestino);
  const otro: Locale = destino === "en" ? "es" : "en";

  return pathname
    .split("/")
    .map((seg) => {
      if (!seg) return seg;

      for (const vig of ["hoy", "finde", "semana"] as const) {
        if (seg === SEGMENTO_VIGENCIA[destino][vig] || seg === SEGMENTO_VIGENCIA[otro][vig]) {
          return SEGMENTO_VIGENCIA[destino][vig];
        }
      }
      for (const extra of ["pareja", "familia", "gratis"] as const) {
        if (seg === SLUG_EXTRA_ATEMPORAL[destino][extra] || seg === SLUG_EXTRA_ATEMPORAL[otro][extra]) {
          return SLUG_EXTRA_ATEMPORAL[destino][extra];
        }
        if (seg === SLUG_EXTRA_TEMPORAL[destino][extra] || seg === SLUG_EXTRA_TEMPORAL[otro][extra]) {
          return SLUG_EXTRA_TEMPORAL[destino][extra];
        }
      }
      const mes = normalizarMesSlug(seg);
      if (mes) return mesSlugParaLocale(mes, localeDestino);

      return seg;
    })
    .join("/");
}

// Reexportado para que traducirRutaAOtroIdioma/quien la use pueda validar
// un segmento de mes sin importar dates.ts aparte.
export { esMesSlugValido };

// Para el hreflang (alternates.languages en generateMetadata): a partir de
// la ruta española canónica de ESTA página (la que ya calcula cada page.tsx
// para sus propios enlaces internos, ej. `${base}/hoy`), calcula las dos
// URLs absolutas equivalentes — se apoya en traducirRutaAOtroIdioma, que ya
// sabe traducir cada segmento conocido y dejar intacto el resto (slug de
// municipio, categoría, evento...). "es" es el idioma por defecto sin
// prefijo (ver routing.ts, localePrefix: "as-needed").
export function alternatesIdiomas(rutaEspanola: string): Record<string, string> {
  const rutaIngles = traducirRutaAOtroIdioma(rutaEspanola, "en");
  const urlEs = `${SITE_URL}${rutaEspanola}`;
  // La home ("/") es un caso especial: "/en" + "/" daría "/en/", que Next
  // redirige con un 308 a "/en" — nunca declarar en un sitemap/hreflang una
  // URL que ni siquiera es la final de verdad (ver conversación).
  const sufijoIngles = rutaIngles === "/" ? "" : rutaIngles;
  return {
    es: urlEs,
    en: `${SITE_URL}/en${sufijoIngles}`,
    "x-default": urlEs,
  };
}
