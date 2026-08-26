import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import PlanesPageLayout from "@/components/PlanesPageLayout";
import { getMunicipio, getPlanesGratisPorVigencia } from "@/lib/queries";
import { rangoFinDeSemanaLegible } from "@/lib/dates";

export const revalidate = 86400;

export default async function FindeGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [planes, tGratis, tFiltros, locale] = await Promise.all([
    getPlanesGratisPorVigencia(municipio.id, "finde"),
    getTranslations("Gratis"),
    getTranslations("Filtros"),
    getLocale(),
  ]);

  return (
    <PlanesPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("tituloFinde", { municipio: municipio.nombre })}
      fecha={rangoFinDeSemanaLegible(locale)}
      planes={planes}
      current={{ vigencia: "finde", extra: "gratis" }}
      breadcrumbExtra={[
        { label: tFiltros("finde"), href: `/${municipioSlug}/fin-de-semana` },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
