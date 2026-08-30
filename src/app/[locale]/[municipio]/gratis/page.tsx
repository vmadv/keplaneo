import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const [tGratis, description] = await Promise.all([
    getTranslations("Gratis"),
    construirMetaDescripcion(municipio.nombre, "siempre", "gratis"),
  ]);
  const title = await construirTituloConSufijo(tGratis("tituloSiempre", { municipio: municipio.nombre }));
  return { title, description, alternates: { languages: alternatesIdiomas(`/${municipioSlug}/gratis`) } };
}

// Franja atemporal + precio "gratis" — antes esta URL era "gratis de hoy"
// (ver conversación); ese caso concreto se mudó a /hoy/gratis y esta pasa
// a ser la versión general, sin restringir por fecha.
export default async function GratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const tGratis = await getTranslations("Gratis");
  const tFiltros = await getTranslations("Filtros");

  return (
    <SiempreHubLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("tituloSiempre", { municipio: municipio.nombre })}
      extra="gratis"
      breadcrumbExtra={[{ label: tFiltros("gratis") }]}
    />
  );
}
