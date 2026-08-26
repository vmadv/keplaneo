import { Music, Palette, Drama, Laugh, Trophy, Store, PartyPopper, Clapperboard, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { proximosMesesSlugs } from "./dates";
import { CATEGORIAS, esCategoriaConPagina } from "./types";

export interface FiltroTemporalItem {
  label: string;
  href: string;
  activo: boolean;
  icono?: LucideIcon;
}

// Barra de filtros tipo "entradas.com": Hoy / Este fin de semana / los
// próximos meses generados, todos como pestañas de la misma página en vez
// de enlaces sueltos a páginas separadas. Los slugs de mes en la URL se
// quedan siempre en español (mismo criterio que los topónimos); solo la
// etiqueta visible se traduce.
export async function construirFiltrosTemporales(base: string, activo: string): Promise<FiltroTemporalItem[]> {
  const [t, tMeses] = await Promise.all([getTranslations("Filtros"), getTranslations("Meses")]);
  const meses = proximosMesesSlugs(2);
  return [
    { label: t("hoy"), href: `${base}/hoy`, activo: activo === "hoy" },
    { label: t("finde"), href: `${base}/fin-de-semana`, activo: activo === "finde" },
    { label: t("semana"), href: `${base}/esta-semana`, activo: activo === "semana" },
    ...meses.map((mes) => {
      const nombre = tMeses(mes);
      return {
        label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        href: `${base}/${mes}`,
        activo: activo === mes,
      };
    }),
  ];
}

type ContextoSecundario =
  | { tipo: "hoy" }
  | { tipo: "finde" }
  | { tipo: "semana" }
  | { tipo: "mes"; mes: string };

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

// Tres ejes independientes (a quién va dirigido, cuánto cuesta, de qué
// trata) — se devuelven agrupados en vez de en una sola lista plana, para
// que la interfaz pueda mostrarlos como grupos distintos y no como si
// fueran opciones de la misma categoría. Solo incluye combinaciones que
// realmente existen como página: "Gratis" por ejemplo solo tiene versión
// de hoy, así que no aparece en finde ni en los meses.
export async function construirFiltrosSecundarios(
  base: string,
  contexto: ContextoSecundario,
  audienciaActiva?: "pareja" | "familia"
): Promise<FiltrosSecundariosAgrupados> {
  const [t, tCat] = await Promise.all([getTranslations("Filtros"), getTranslations("Categorias")]);
  const audiencia: FiltroTemporalItem[] = [];
  const precio: FiltroTemporalItem[] = [];
  const tematica: FiltroTemporalItem[] = [];

  if (contexto.tipo === "hoy" || contexto.tipo === "finde" || contexto.tipo === "semana") {
    const segmento =
      contexto.tipo === "hoy" ? "hoy" : contexto.tipo === "finde" ? "fin-de-semana" : "esta-semana";
    audiencia.push(
      { label: t("enPareja"), href: `${base}/${segmento}/pareja`, activo: audienciaActiva === "pareja" },
      { label: t("enFamilia"), href: `${base}/${segmento}/familia`, activo: audienciaActiva === "familia" }
    );
  }

  if (contexto.tipo === "hoy") {
    precio.push({ label: t("gratis"), href: `${base}/gratis`, activo: false });
  } else if (contexto.tipo === "semana") {
    precio.push({ label: t("gratis"), href: `${base}/esta-semana/gratis`, activo: false });
  }

  // "Esta semana" todavía no tiene páginas de categoría propias
  // (/{categoria}/esta-semana) — sin destino real, no se enlaza temática ahí.
  if (contexto.tipo === "hoy" || contexto.tipo === "finde" || contexto.tipo === "mes") {
    const sufijo = contexto.tipo === "hoy" ? "hoy" : contexto.tipo === "finde" ? "fin-de-semana" : contexto.mes;
    for (const cat of CATEGORIAS.filter(esCategoriaConPagina)) {
      tematica.push({
        label: tCat(cat),
        href: `${base}/${cat}/${sufijo}`,
        activo: false,
        icono: ICONO_CATEGORIA[cat],
      });
    }
  }

  return { audiencia, precio, tematica };
}
