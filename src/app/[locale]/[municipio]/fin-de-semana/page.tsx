import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tFinde, description] = await Promise.all([
    getTranslations("Finde"),
    construirMetaDescripcion(municipio.nombre, "finde"),
  ]);
  const title = await construirTituloConSufijo(tFinde("titulo", { municipio: municipio.nombre }));
  return { title, description };
}

export default async function FindePage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tFinde, tFiltros, locale] = await Promise.all([
    getPlanesFinde(municipio.id),
    getTranslations("Finde"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tFinde("titulo", { municipio: municipio.nombre })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde" }}
      breadcrumbExtra={[{ label: tFiltros("finde") }]}
    />
  );
}
