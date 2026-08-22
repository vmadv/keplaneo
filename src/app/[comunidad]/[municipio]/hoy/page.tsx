import { notFound } from "next/navigation";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";

export const revalidate = 86400;

export default async function HoyPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const planes = await getPlanesHoy(municipio.id);

  return (
    <PlanesPageLayout
      municipio={municipio}
      comunidadSlug={comunidadSlug}
      municipioSlug={municipioSlug}
      titulo={`Qué hacer hoy en ${municipio.nombre}`}
      planes={planes}
      current={{ vigencia: "hoy" }}
      breadcrumbExtra={[{ label: "Hoy" }]}
    />
  );
}
