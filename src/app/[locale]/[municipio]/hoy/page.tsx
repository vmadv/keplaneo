import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy, getEventosActivos } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";
import { ordenarParaHoy, idsEventoDePlanes } from "@/lib/semana";
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
  const [tHoy, description, locale] = await Promise.all([
    getTranslations("Hoy"),
    construirMetaDescripcion(municipio.nombre, "hoy"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tHoy("titulo", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/hoy`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

export default async function HoyPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, eventosActivos, tHoy, tFiltros, locale] = await Promise.all([
    getPlanesHoy(municipio.id),
    getEventosActivos(municipio.id),
    getTranslations("Hoy"),
    getTranslations("Filtros"),
    getLocale(),
  ]);
  const idsCurados = idsEventoDePlanes(planes);
  const relleno = ordenarParaHoy(eventosActivos).filter((e) => !idsCurados.has(e.id));

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHoy("titulo", { municipio: municipio.nombre })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      relleno={relleno}
      current={{ vigencia: "hoy" }}
      breadcrumbExtra={[{ label: tFiltros("hoy") }]}
    />
  );
}
