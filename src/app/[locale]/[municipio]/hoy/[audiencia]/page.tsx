import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { AUDIENCIAS_URL, normalizarAudienciaUrl, audienciaUrlParaLocale, audienciaDesdeUrl, hrefFiltro, alternatesIdiomas } from "@/lib/filtros";

export const revalidate = 86400;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  return AUDIENCIAS_URL.map((audiencia) => ({ audiencia: audienciaUrlParaLocale(audiencia, params.locale) }));
}

// En minúscula porque va incrustada a media frase ("Qué hacer hoy en
// Sevilla en pareja"), a diferencia del badge de audiencia de la ficha de
// evento, que sí empieza en mayúscula.
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
  const [tHoy, tAudiencia, description, locale] = await Promise.all([
    getTranslations("Hoy"),
    getTranslations("Audiencia"),
    construirMetaDescripcion(municipio.nombre, "hoy", extra),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(
    tHoy("tituloAudiencia", { municipio: municipio.nombre, audiencia: minuscula(tAudiencia(extra)) }),
    extra
  );
  const alt = alternatesIdiomas(`/${municipioSlug}/hoy/${audiencia}`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function HoyAudienciaPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia: audienciaUrl } = await params;
  // Ver [locale]/layout.tsx: necesario para que esta ruta con
  // generateStaticParams pueda pintarse estática.
  setRequestLocale(locale);
  const audiencia = normalizarAudienciaUrl(audienciaUrl);
  if (!audiencia) notFound();
  const extra = audienciaDesdeUrl(audiencia);

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tHoy, tAudiencia, tFiltros] = await Promise.all([
    getPlanesHoy(municipio.id, extra),
    getTranslations("Hoy"),
    getTranslations("Audiencia"),
    getTranslations("Filtros"),
  ]);
  const etiquetaAudiencia = minuscula(tAudiencia(extra));
  const hrefHoy = hrefFiltro(locale, `/${municipioSlug}`, "hoy");

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHoy("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      current={{ vigencia: "hoy", extra }}
      enlaceMasPlanes={{
        href: hrefHoy,
        texto: tHoy("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("hoy"), href: hrefHoy },
        { label: tAudiencia(extra) },
      ]}
    />
  );
}
