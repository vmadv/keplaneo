import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import ListaEventos from "@/components/ListaEventos";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getEventosPorCategoria } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { rangoSemanaLegible } from "@/lib/dates";
import { ordenarPorDiaDeSemana } from "@/lib/semana";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { construirTituloConSufijo, piezasTemporales } from "@/lib/resumenSeleccion";
import { buscarImagenHero } from "@/lib/heroImage";
import { alternatesIdiomas } from "@/lib/rutasLocale";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; categoriaOMes: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, categoriaOMes } = await params;
  if (!esCategoriaConPagina(categoriaOMes)) return {};
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};

  const [tCategorias, tCombo, { temporal }, locale] = await Promise.all([
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    piezasTemporales("semana"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const title = await construirTituloConSufijo(tCombo("semana", { categoria: etiqueta, municipio: municipio.nombre }));
  const description = tCombo("metaDescripcionTemporal", {
    categoria: etiqueta.toLowerCase(),
    municipio: municipio.nombre,
    temporal,
  });
  const alt = alternatesIdiomas(`/${municipioSlug}/${categoriaOMes}/esta-semana`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

// Combinación categoría + esta semana (ej. /conciertos/esta-semana) — como
// las de hoy/fin de semana, pero leyendo de `eventos` directamente y
// filtrando por rango de la semana en vez del lote diario de `planes`
// (mismo criterio que /esta-semana a secas, ver src/lib/semana.ts).
export default async function CategoriaSemanaPage({
  params,
}: {
  params: Promise<{ municipio: string; categoriaOMes: string }>;
}) {
  const { municipio: municipioSlug, categoriaOMes } = await params;
  if (!esCategoriaConPagina(categoriaOMes)) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const catBase = `${base}/${categoriaOMes}`;
  const [todos, temporales, secundarios, tNav, tFiltros, tCategorias, tCombo, tPlanList, locale] = await Promise.all([
    getEventosPorCategoria(municipio.id, categoriaOMes),
    construirFiltrosTemporales(catBase, "semana"),
    construirFiltrosSecundarios(base, "semana", undefined, categoriaOMes),
    getTranslations("Nav"),
    getTranslations("Filtros"),
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    getTranslations("PlanList"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: etiqueta, href: catBase },
            { label: tFiltros("semana") },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tCombo("semana", { categoria: etiqueta, municipio: municipio.nombre })}
          fecha={rangoSemanaLegible(locale)}
        />

        <FiltrosPagina primarios={temporales} secundarios={secundarios} />

        <ListaEventos
          eventos={eventos}
          base={base}
          contexto="semana"
          obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
          mensajeVacio={tPlanList("vacioSemanaFiltro")}
        />
      </div>
    </main>
  );
}
