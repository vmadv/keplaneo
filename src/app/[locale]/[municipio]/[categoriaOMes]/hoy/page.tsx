import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import ListaEventos from "@/components/ListaEventos";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getPlanesCategoriaHoy, getEventosPorCategoria } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { fechaDeHoyLegible } from "@/lib/dates";
import { ordenarParaHoy, idsEventoDePlanes } from "@/lib/semana";
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
    piezasTemporales("hoy"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const title = await construirTituloConSufijo(
    tCombo("hoy", { categoria: etiqueta, municipio: municipio.nombre, fecha: fechaDeHoyLegible(locale) })
  );
  const description = tCombo("metaDescripcionTemporal", {
    categoria: etiqueta.toLowerCase(),
    municipio: municipio.nombre,
    temporal,
  });
  const alt = alternatesIdiomas(`/${municipioSlug}/${categoriaOMes}/hoy`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function CategoriaHoyPage({
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
    getPlanesCategoriaHoy(municipio.id, categoriaOMes),
    getEventosPorCategoria(municipio.id, categoriaOMes),
    construirFiltrosTemporales(catBase, "hoy"),
    // `base` (no `catBase`): cambiar de temática o de "a quién va dirigido"
    // lleva a la combinación correspondiente, no se anida bajo la categoría
    // actual — mismo criterio que la página de categoría + mes.
    construirFiltrosSecundarios(base, "hoy", undefined, categoriaOMes),
    getTranslations("Nav"),
    getTranslations("Filtros"),
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  // Relleno (mismo criterio que /hoy a secas, ver PlanesPageLayout): un
  // evento real de esta categoría puede no tener ninguna fila en `planes`
  // (importado fuera del cron normal, o simplemente no recogido hoy por el
  // repaso diario) sin dejar de ser válido para hoy — sin esto, esas
  // páginas salían vacías aunque el evento existiera y fuera de hoy mismo
  // (ver conversación).
  const idsCurados = idsEventoDePlanes(planes);
  const relleno = ordenarParaHoy(eventosCategoria).filter((e) => !idsCurados.has(e.id));

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: etiqueta, href: catBase },
            { label: tFiltros("hoy") },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tCombo("hoy", { categoria: etiqueta, municipio: municipio.nombre, fecha: fechaDeHoyLegible(locale) })}
        />

        <FiltrosPagina primarios={temporales} secundarios={secundarios} />

        {planes.length > 0 && (
          <PlanList planes={planes} base={base} contexto="hoy" municipioNombre={municipio.nombre} />
        )}
        {relleno.length > 0 && (
          <div className={planes.length > 0 ? "mt-5" : undefined}>
            <ListaEventos eventos={relleno} base={base} contexto="hoy" municipioNombre={municipio.nombre} />
          </div>
        )}
        {planes.length === 0 && relleno.length === 0 && (
          <PlanList planes={planes} base={base} contexto="hoy" municipioNombre={municipio.nombre} />
        )}
      </div>
    </main>
  );
}
