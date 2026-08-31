import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde, getEventosActivos } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { ordenarParaFinde, idsEventoDePlanes } from "@/lib/semana";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { AUDIENCIAS_URL, normalizarAudienciaUrl, audienciaUrlParaLocale, audienciaDesdeUrl, hrefFiltro, alternatesIdiomas } from "@/lib/filtros";

export const revalidate = 86400;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  return AUDIENCIAS_URL.map((audiencia) => ({ audiencia: audienciaUrlParaLocale(audiencia, params.locale) }));
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; audiencia: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, audiencia: audienciaUrl } = await params;
  const audiencia = normalizarAudienciaUrl(audienciaUrl);
  if (!audiencia) return {};
  const extra = audienciaDesdeUrl(audiencia);
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tFinde, tAudiencia, description, locale] = await Promise.all([
    getTranslations("Finde"),
    getTranslations("Audiencia"),
    construirMetaDescripcion(municipio.nombre, "finde", extra),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(
    tFinde("tituloAudiencia", { municipio: municipio.nombre, audiencia: minuscula(tAudiencia(extra)) }),
    extra
  );
  const alt = alternatesIdiomas(`/${municipioSlug}/fin-de-semana/${audiencia}`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function FindeAudienciaPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia: audienciaUrl } = await params;
  setRequestLocale(locale);
  const audiencia = normalizarAudienciaUrl(audienciaUrl);
  if (!audiencia) notFound();
  const extra = audienciaDesdeUrl(audiencia);

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, eventosActivos, tFinde, tAudiencia, tFiltros] = await Promise.all([
    getPlanesFinde(municipio.id, extra),
    getEventosActivos(municipio.id, extra),
    getTranslations("Finde"),
    getTranslations("Audiencia"),
    getTranslations("Filtros"),
  ]);
  const idsCurados = idsEventoDePlanes(planes);
  const { eventos: eventosFinde, etiquetas: etiquetasFinde } = ordenarParaFinde(eventosActivos, locale);
  const relleno = eventosFinde.filter((e) => !idsCurados.has(e.id));
  const etiquetaAudiencia = minuscula(tAudiencia(extra));
  const hrefFinde = hrefFiltro(locale, `/${municipioSlug}`, "finde");

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tFinde("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      relleno={relleno}
      obtenerEtiquetaRelleno={(evento) => etiquetasFinde.get(evento.id) ?? null}
      current={{ vigencia: "finde", extra }}
      enlaceMasPlanes={{
        href: hrefFinde,
        texto: tFinde("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: hrefFinde },
        { label: tAudiencia(extra) },
      ]}
    />
  );
}
