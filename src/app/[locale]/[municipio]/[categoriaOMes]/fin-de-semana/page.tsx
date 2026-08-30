import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getPlanesCategoriaFinde } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { construirTituloConSufijo, piezasTemporales } from "@/lib/resumenSeleccion";
import { buscarImagenHero } from "@/lib/heroImage";

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
  return { title, description };
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
  const [planes, temporales, secundarios, tNav, tFiltros, tCategorias, tCombo, locale] = await Promise.all([
    getPlanesCategoriaFinde(municipio.id, categoriaOMes),
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

        <PlanList planes={planes} base={base} mostrarDiaFinde contexto="finde" municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
