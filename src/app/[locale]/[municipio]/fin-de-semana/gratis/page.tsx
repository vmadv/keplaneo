import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesGratisPorVigencia, getEventosGratisActivos } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { ordenarParaFinde, idsEventoDePlanes } from "@/lib/semana";
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
    construirMetaDescripcion(municipio.nombre, "finde", "gratis"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tGratis("tituloFinde", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/fin-de-semana/gratis`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

export default async function FindeGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, eventosActivos, tGratis, tFinde, tFiltros, locale] = await Promise.all([
    getPlanesGratisPorVigencia(municipio.id, "finde"),
    getEventosGratisActivos(municipio.id),
    getTranslations("Gratis"),
    getTranslations("Finde"),
    getTranslations("Filtros"),
    getLocale(),
  ]);
  const idsCurados = idsEventoDePlanes(planes);
  const { eventos: eventosFinde, etiquetas: etiquetasFinde } = ordenarParaFinde(eventosActivos, locale);
  const relleno = eventosFinde.filter((e) => !idsCurados.has(e.id));
  const hrefFinde = hrefFiltro(locale, `/${municipioSlug}`, "finde");

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("tituloFinde", { municipio: municipio.nombre })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      relleno={relleno}
      obtenerEtiquetaRelleno={(evento) => etiquetasFinde.get(evento.id) ?? null}
      current={{ vigencia: "finde", extra: "gratis" }}
      enlaceMasPlanes={{
        href: hrefFinde,
        texto: tFinde("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: hrefFinde },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
