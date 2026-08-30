import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesGratisPorVigencia } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { hrefFiltro, alternatesIdiomas } from "@/lib/filtros";

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
    construirMetaDescripcion(municipio.nombre, "hoy", "gratis"),
  ]);
  const title = await construirTituloConSufijo(tGratis("titulo", { municipio: municipio.nombre }));
  return { title, description, alternates: { languages: alternatesIdiomas(`/${municipioSlug}/hoy/gratis`) } };
}

export default async function HoyGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tGratis, tHoy, tFiltros, locale] = await Promise.all([
    getPlanesGratisPorVigencia(municipio.id, "hoy"),
    getTranslations("Gratis"),
    getTranslations("Hoy"),
    getTranslations("Filtros"),
    getLocale(),
  ]);
  const hrefHoy = hrefFiltro(locale, `/${municipioSlug}`, "hoy");

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("titulo", { municipio: municipio.nombre })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      current={{ vigencia: "hoy", extra: "gratis" }}
      enlaceMasPlanes={{
        href: hrefHoy,
        texto: tHoy("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("hoy"), href: hrefHoy },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
