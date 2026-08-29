import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { AUDIENCIAS_URL, esAudienciaUrlValida, audienciaDesdeUrl } from "@/lib/filtros";

export const revalidate = 86400;

export function generateStaticParams() {
  return AUDIENCIAS_URL.map((audiencia) => ({ audiencia }));
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; audiencia: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, audiencia } = await params;
  if (!esAudienciaUrlValida(audiencia)) return {};
  const extra = audienciaDesdeUrl(audiencia);
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tFinde, tAudiencia, description] = await Promise.all([
    getTranslations("Finde"),
    getTranslations("Audiencia"),
    construirMetaDescripcion(municipio.nombre, "finde", extra),
  ]);
  const title = await construirTituloConSufijo(
    tFinde("tituloAudiencia", { municipio: municipio.nombre, audiencia: minuscula(tAudiencia(extra)) }),
    extra
  );
  return { title, description };
}

export default async function FindeAudienciaPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia } = await params;
  setRequestLocale(locale);
  if (!esAudienciaUrlValida(audiencia)) notFound();
  const extra = audienciaDesdeUrl(audiencia);

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tFinde, tAudiencia, tFiltros] = await Promise.all([
    getPlanesFinde(municipio.id, extra),
    getTranslations("Finde"),
    getTranslations("Audiencia"),
    getTranslations("Filtros"),
  ]);
  const etiquetaAudiencia = minuscula(tAudiencia(extra));

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tFinde("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde", extra }}
      enlaceMasPlanes={{
        href: `/${municipioSlug}/fin-de-semana`,
        texto: tFinde("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: `/${municipioSlug}/fin-de-semana` },
        { label: tAudiencia(extra) },
      ]}
    />
  );
}
