import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";

export const revalidate = 86400;

const AUDIENCIAS = ["pareja", "familia"] as const;
type AudienciaValida = (typeof AUDIENCIAS)[number];

function esAudienciaValida(valor: string): valor is AudienciaValida {
  return (AUDIENCIAS as readonly string[]).includes(valor);
}

export function generateStaticParams() {
  return AUDIENCIAS.map((audiencia) => ({ audiencia }));
}

// En minúscula porque va incrustada a media frase ("Qué hacer hoy en
// Sevilla en pareja"), a diferencia del badge de audiencia de la ficha de
// evento, que sí empieza en mayúscula.
function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export default async function HoyAudienciaPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; audiencia: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, audiencia } = await params;
  if (!esAudienciaValida(audiencia)) notFound();

  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const [planes, tHoy, tAudiencia, tFiltros, locale] = await Promise.all([
    getPlanesHoy(municipio.id, audiencia),
    getTranslations("Hoy"),
    getTranslations("Audiencia"),
    getTranslations("Filtros"),
    getLocale(),
  ]);
  const etiquetaAudiencia = minuscula(tAudiencia(audiencia));

  return (
    <PlanesPageLayout
      municipio={municipio}
      comunidadSlug={comunidadSlug}
      municipioSlug={municipioSlug}
      titulo={tHoy("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      current={{ vigencia: "hoy", audiencia }}
      breadcrumbExtra={[
        { label: tFiltros("hoy"), href: `/${comunidadSlug}/${municipioSlug}/hoy` },
        { label: tAudiencia(audiencia) },
      ]}
    />
  );
}
