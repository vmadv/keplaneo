import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import ListaEventos from "@/components/ListaEventos";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getPlanesCategoriaFinde, getEventosPorCategoria } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { ordenarParaFinde, idsEventoDePlanes } from "@/lib/semana";
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
    piezasTemporales("finde"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const title = await construirTituloConSufijo(
    tCombo("finde", { categoria: etiqueta, municipio: municipio.nombre, fecha: rangoFinDeSemanaLegible(locale) })
  );
  const description = tCombo("metaDescripcionTemporal", {
    categoria: etiqueta.toLowerCase(),
    municipio: municipio.nombre,
    temporal,
  });
  const alt = alternatesIdiomas(`/${municipioSlug}/${categoriaOMes}/fin-de-semana`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function CategoriaFindePage({
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
  const [planes, eventosCategoria, temporales, secundarios, tNav, tFiltros, tCategorias, tCombo, locale] = await Promise.all([
    getPlanesCategoriaFinde(municipio.id, categoriaOMes),
    getEventosPorCategoria(municipio.id, categoriaOMes),
    construirFiltrosTemporales(catBase, "finde"),
    // `base` (no `catBase`): mismo criterio que en la página de hoy — ver
    // ahí el porqué.
    construirFiltrosSecundarios(base, "finde", undefined, categoriaOMes),
    getTranslations("Nav"),
    getTranslations("Filtros"),
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  // Relleno — mismo criterio que la página de categoría + hoy (ver ahí el
  // porqué) y que /fin-de-semana a secas (PlanesPageLayout).
  const idsCurados = idsEventoDePlanes(planes);
  const { eventos: eventosFinde, etiquetas: etiquetasFinde } = ordenarParaFinde(eventosCategoria, locale);
  const relleno = eventosFinde.filter((e) => !idsCurados.has(e.id));

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: etiqueta, href: catBase },
            { label: tFiltros("finde") },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tCombo("finde", { categoria: etiqueta, municipio: municipio.nombre, fecha: rangoFinDeSemanaLegible(locale) })}
        />

        <FiltrosPagina primarios={temporales} secundarios={secundarios} />

        {planes.length > 0 && (
          <PlanList planes={planes} base={base} mostrarDiaFinde contexto="finde" municipioNombre={municipio.nombre} />
        )}
        {relleno.length > 0 && (
          <div className={planes.length > 0 ? "mt-5" : undefined}>
            <ListaEventos
              eventos={relleno}
              base={base}
              contexto="finde"
              obtenerEtiqueta={(evento) => etiquetasFinde.get(evento.id) ?? null}
              municipioNombre={municipio.nombre}
            />
          </div>
        )}
        {planes.length === 0 && relleno.length === 0 && (
          <PlanList planes={planes} base={base} mostrarDiaFinde contexto="finde" municipioNombre={municipio.nombre} />
        )}
      </div>
    </main>
  );
}
