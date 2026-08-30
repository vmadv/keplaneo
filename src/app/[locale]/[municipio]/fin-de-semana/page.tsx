import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
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
  const [tFinde, description, locale] = await Promise.all([
    getTranslations("Finde"),
    construirMetaDescripcion(municipio.nombre, "finde"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tFinde("titulo", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/fin-de-semana`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
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
