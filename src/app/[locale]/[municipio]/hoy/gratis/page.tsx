import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesGratisPorVigencia, getEventosGratisActivos } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";
import { ordenarParaHoy, idsEventoDePlanes } from "@/lib/semana";
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
  const [tGratis, description, locale] = await Promise.all([
    getTranslations("Gratis"),
    construirMetaDescripcion(municipio.nombre, "hoy", "gratis"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tGratis("titulo", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/hoy/gratis`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

export default async function HoyGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, eventosActivos, tGratis, tHoy, tFiltros, locale] = await Promise.all([
    getPlanesGratisPorVigencia(municipio.id, "hoy"),
    getEventosGratisActivos(municipio.id),
    getTranslations("Gratis"),
    getTranslations("Hoy"),
    getTranslations("Filtros"),
    getLocale(),
  ]);
  const idsCurados = idsEventoDePlanes(planes);
  const relleno = ordenarParaHoy(eventosActivos).filter((e) => !idsCurados.has(e.id));
  const hrefHoy = hrefFiltro(locale, `/${municipioSlug}`, "hoy");

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("titulo", { municipio: municipio.nombre })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      relleno={relleno}
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
