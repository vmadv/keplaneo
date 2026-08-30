import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import SiempreHubLayout from "@/components/SiempreHubLayout";
import { getMunicipio } from "@/lib/queries";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { alternatesIdiomas } from "@/lib/rutasLocale";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tAudiencia, description, locale] = await Promise.all([
    getTranslations("Audiencia"),
    construirMetaDescripcion(municipio.nombre, "siempre", "pareja"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tAudiencia("tituloSiemprePareja", { municipio: municipio.nombre }), "pareja");
  const alt = alternatesIdiomas(`/${municipioSlug}/en-pareja`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

// Franja atemporal + audiencia "pareja" — ver conversación: slug propio
// (/en-pareja, no /pareja) porque así es como se busca de verdad, distinto
// del slug "pareja" que ya usan las combinaciones con Cuándo (/hoy/pareja).
export default async function EnParejaPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const tAudiencia = await getTranslations("Audiencia");

  return (
    <SiempreHubLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tAudiencia("tituloSiemprePareja", { municipio: municipio.nombre })}
      extra="pareja"
      breadcrumbExtra={[{ label: tAudiencia("pareja") }]}
    />
  );
}
