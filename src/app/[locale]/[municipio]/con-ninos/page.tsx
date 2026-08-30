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
    construirMetaDescripcion(municipio.nombre, "siempre", "familia"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tAudiencia("tituloSiempreConNinos", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/con-ninos`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

// Franja atemporal + audiencia "familia" — mismo dato que ya usan
// hoy/con-ninos etc., pero con el rótulo "con niños" que es como se
// busca de verdad (ver conversación), en vez de duplicar esa misma ruta.
export default async function ConNinosPage({
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
      titulo={tAudiencia("tituloSiempreConNinos", { municipio: municipio.nombre })}
      extra="familia"
      breadcrumbExtra={[{ label: tAudiencia("conNinos") }]}
    />
  );
}
