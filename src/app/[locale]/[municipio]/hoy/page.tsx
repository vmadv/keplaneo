import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";
import { fechaDeHoyLegible } from "@/lib/dates";

export const revalidate = 86400;

export default async function HoyPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tHoy, tFiltros, locale] = await Promise.all([
    getPlanesHoy(municipio.id),
    getTranslations("Hoy"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHoy("titulo", { municipio: municipio.nombre })}
      fecha={fechaDeHoyLegible(locale)}
      planes={planes}
      current={{ vigencia: "hoy" }}
      breadcrumbExtra={[{ label: tFiltros("hoy") }]}
    />
  );
}
