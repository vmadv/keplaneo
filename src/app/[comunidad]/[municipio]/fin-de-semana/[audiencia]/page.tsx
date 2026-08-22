import { notFound } from "next/navigation";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";

export const revalidate = 86400;

const AUDIENCIAS = ["pareja", "familia"] as const;
type AudienciaValida = (typeof AUDIENCIAS)[number];

function esAudienciaValida(valor: string): valor is AudienciaValida {
  return (AUDIENCIAS as readonly string[]).includes(valor);
}

export function generateStaticParams() {
  return AUDIENCIAS.map((audiencia) => ({ audiencia }));
}

const ETIQUETA: Record<AudienciaValida, string> = {
  pareja: "en pareja",
  familia: "en familia",
};

export default async function FindeAudienciaPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; audiencia: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, audiencia } = await params;
  if (!esAudienciaValida(audiencia)) notFound();

  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const planes = await getPlanesFinde(municipio.id, audiencia);

  return (
    <PlanesPageLayout
      municipio={municipio}
      comunidadSlug={comunidadSlug}
      municipioSlug={municipioSlug}
      titulo={`Qué hacer este fin de semana en ${municipio.nombre} ${ETIQUETA[audiencia]}`}
      planes={planes}
      current={{ vigencia: "finde", audiencia }}
      breadcrumbExtra={[
        { label: "Este fin de semana", href: `/${comunidadSlug}/${municipioSlug}/fin-de-semana` },
        { label: ETIQUETA[audiencia] },
      ]}
    />
  );
}
