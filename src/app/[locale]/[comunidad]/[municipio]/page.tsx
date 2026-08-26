import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import FiltrosPagina from "@/components/FiltrosPagina";
import PlanList from "@/components/PlanList";
import NearbyMunicipios from "@/components/NearbyMunicipios";
import ListadosDelMunicipio from "@/components/ListadosDelMunicipio";
import Mapa from "@/components/Mapa";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getPlanesHoy } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { fechaDeHoyLegible } from "@/lib/dates";
import { buscarImagenHero } from "@/lib/heroImage";

export const revalidate = 86400;

// El hub del municipio ahora muestra directamente los planes de hoy (con
// las mismas dos filas de filtros que el resto del sitio) en vez de ser
// solo un menú de enlaces — sigue teniendo más contenido propio que /hoy
// (foto de portada, municipios cercanos) para no quedar como una copia.
export default async function MunicipioPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const base = `/${comunidadSlug}/${municipioSlug}`;
  const imagenHero = buscarImagenHero(municipio.slug);

  const [planes, primarios, secundarios, tNav, tHome, locale] = await Promise.all([
    getPlanesHoy(municipio.id),
    construirFiltrosTemporales(base, "hoy"),
    construirFiltrosSecundarios(base, { tipo: "hoy" }),
    getTranslations("Nav"),
    getTranslations("MunicipioHome"),
    getLocale(),
  ]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
            { label: municipio.nombre },
          ]}
        />
        <HeroPortada
          imagenHero={imagenHero}
          alt={municipio.nombre}
          titulo={tHome("titulo", { municipio: municipio.nombre })}
          fecha={tHome("hoyFecha", { fecha: fechaDeHoyLegible(locale) })}
        />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <PlanList planes={planes} base={base} contexto="hoy" />

        {!imagenHero && municipio.lat !== null && municipio.lon !== null && (
          <div className="card-sticker p-2 my-8">
            <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
          </div>
        )}

        <ListadosDelMunicipio
          municipioId={municipio.id}
          municipioNombre={municipio.nombre}
          comunidadSlug={comunidadSlug}
          municipioSlug={municipioSlug}
        />

        <NearbyMunicipios municipio={municipio} comunidadSlug={comunidadSlug} />
      </div>
    </main>
  );
}
