import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";

export const revalidate = 86400;

const AUDIENCIAS = ["pareja", "familia"] as const;
type AudienciaValida = (typeof AUDIENCIAS)[number];

function esAudienciaValida(valor: string): valor is AudienciaValida {
  return (AUDIENCIAS as readonly string[]).includes(valor);
}

export function generateStaticParams() {
  return AUDIENCIAS.map((audiencia) => ({ audiencia }));
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export default async function FindeAudienciaPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia } = await params;
  setRequestLocale(locale);
  if (!esAudienciaValida(audiencia)) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tFinde, tAudiencia, tFiltros] = await Promise.all([
    getPlanesFinde(municipio.id, audiencia),
    getTranslations("Finde"),
    getTranslations("Audiencia"),
    getTranslations("Filtros"),
  ]);
  const etiquetaAudiencia = minuscula(tAudiencia(audiencia));

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tFinde("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde", extra: audiencia }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: `/${municipioSlug}/fin-de-semana` },
        { label: tAudiencia(audiencia) },
      ]}
    />
  );
}
