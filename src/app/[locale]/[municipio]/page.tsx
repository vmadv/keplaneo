import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import NearbyMunicipios from "@/components/NearbyMunicipios";
import Mapa from "@/components/Mapa";
import SiempreHubLayout from "@/components/SiempreHubLayout";
import { getMunicipio } from "@/lib/queries";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { buscarImagenHero } from "@/lib/heroImage";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tHome, description] = await Promise.all([
    getTranslations("MunicipioHome"),
    construirMetaDescripcion(municipio.nombre, "siempre"),
  ]);
  const title = await construirTituloConSufijo(tHome("titulo", { municipio: municipio.nombre }));
  return { title, description };
}

// El hub del municipio es la franja atemporal ("siempre") de Cuándo — la
// URL corta y canónica para "qué hacer en {municipio}" (ver conversación:
// no tiene sentido una URL "/siempre", así que vive aquí, en el hub a
// secas). La estructura en dos bloques (destacados de esta semana + todo
// el año) la comparte con /en-pareja, /con-ninos y /gratis — ver
// SiempreHubLayout; aquí solo se añade el mapa y municipios cercanos, que
// no tiene sentido repetir en las variantes filtradas.
export default async function MunicipioPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const tHome = await getTranslations("MunicipioHome");
  const imagenHero = buscarImagenHero(municipio.slug);

  return (
    <SiempreHubLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHome("titulo", { municipio: municipio.nombre })}
      breadcrumbExtra={[]}
    >
      {!imagenHero && municipio.lat !== null && municipio.lon !== null && (
        <div className="card-sticker p-2 my-8">
          <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
        </div>
      )}
      <NearbyMunicipios municipio={municipio} />
    </SiempreHubLayout>
  );
}
