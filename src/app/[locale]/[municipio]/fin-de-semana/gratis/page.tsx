import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesGratisPorVigencia } from "@/lib/queries";
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
  const [tGratis, description] = await Promise.all([
    getTranslations("Gratis"),
    construirMetaDescripcion(municipio.nombre, "finde", "gratis"),
  ]);
  const title = await construirTituloConSufijo(tGratis("tituloFinde", { municipio: municipio.nombre }));
  return { title, description };
}

export default async function FindeGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tGratis, tFinde, tFiltros, locale] = await Promise.all([
    getPlanesGratisPorVigencia(municipio.id, "finde"),
    getTranslations("Gratis"),
    getTranslations("Finde"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("tituloFinde", { municipio: municipio.nombre })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde", extra: "gratis" }}
      enlaceMasPlanes={{
        href: `/${municipioSlug}/fin-de-semana`,
        texto: tFinde("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: `/${municipioSlug}/fin-de-semana` },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
