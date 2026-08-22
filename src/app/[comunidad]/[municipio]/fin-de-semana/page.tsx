import { notFound } from "next/navigation";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";

export const revalidate = 86400;

export default async function FindePage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const planes = await getPlanesFinde(municipio.id);

  return (
    <PlanesPageLayout
      municipio={municipio}
      comunidadSlug={comunidadSlug}
      municipioSlug={municipioSlug}
      titulo={`Qué hacer este fin de semana en ${municipio.nombre}`}
      planes={planes}
      current={{ vigencia: "finde" }}
      breadcrumbExtra={[{ label: "Este fin de semana" }]}
    />
  );
}
