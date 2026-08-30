import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { alternatesIdiomas } from "@/lib/rutasLocale";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tHoy, description] = await Promise.all([
    getTranslations("Hoy"),
    construirMetaDescripcion(municipio.nombre, "hoy"),
  ]);
  const title = await construirTituloConSufijo(tHoy("titulo", { municipio: municipio.nombre }));
  return { title, description, alternates: { languages: alternatesIdiomas(`/${municipioSlug}/hoy`) } };
}

export default async function HoyPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tHoy, tFiltros, locale] = await Promise.all([
    getPlanesHoy(municipio.id),
    getTranslations("Hoy"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHoy("titulo", { municipio: municipio.nombre })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      current={{ vigencia: "hoy" }}
      breadcrumbExtra={[{ label: tFiltros("hoy") }]}
    />
  );
}
