import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import FiltroTemporal from "@/components/FiltroTemporal";
import { getMunicipio, getPlanesCategoriaHoy } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { fechaDeHoyLegible } from "@/lib/dates";
import { construirFiltrosTemporales } from "@/lib/filtros";

export const revalidate = 86400;

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
  const [planes, temporales, tNav, tFiltros, tCategorias, tCombo, locale] = await Promise.all([
    getPlanesCategoriaHoy(municipio.id, categoriaOMes),
    construirFiltrosTemporales(catBase, "hoy"),
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
            { label: tFiltros("hoy") },
          ]}
        />
        <h1 className="text-4xl font-extrabold mt-4 mb-6 text-balance">
          {tCombo("hoy", { categoria: etiqueta, municipio: municipio.nombre, fecha: fechaDeHoyLegible(locale) })}
        </h1>

        <FiltroTemporal items={temporales} />

        <PlanList planes={planes} base={base} contexto="hoy" />
      </div>
    </main>
  );
}
