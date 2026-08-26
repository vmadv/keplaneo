import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesFinde } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";

export const revalidate = 86400;

export default async function FindePage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const [planes, tFinde, tFiltros, locale] = await Promise.all([
    getPlanesFinde(municipio.id),
    getTranslations("Finde"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      comunidadSlug={comunidadSlug}
      municipioSlug={municipioSlug}
      titulo={tFinde("titulo", { municipio: municipio.nombre })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde" }}
      breadcrumbExtra={[{ label: tFiltros("finde") }]}
    />
  );
}
