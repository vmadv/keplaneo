import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import FiltrosPagina from "@/components/FiltrosPagina";
import ListaEventos from "@/components/ListaEventos";
import NearbyMunicipios from "@/components/NearbyMunicipios";
import ListadosDelMunicipio from "@/components/ListadosDelMunicipio";
import Mapa from "@/components/Mapa";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getEventosActivos } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";

export const revalidate = 86400;

// El hub del municipio es la franja atemporal ("siempre") de Cuándo: todo
// lo que está activo ahora mismo, sin restringir por fecha — es literalmente
// "Qué hacer en Sevilla" (ver conversación). Sigue teniendo más contenido
// propio que el resto de páginas de vigencia (foto de portada, mapa,
// rankings, municipios cercanos) para no quedar como una copia de "Esta
// semana".
export default async function MunicipioPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const imagenHero = buscarImagenHero(municipio.slug);

  const [eventos, primarios, secundarios, tNav, tHome, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id),
    construirFiltrosTemporales(base, "siempre"),
    construirFiltrosSecundarios(base, "siempre"),
    getTranslations("Nav"),
    getTranslations("MunicipioHome"),
    getTranslations("PlanList"),
  ]);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre },
          ]}
        />
        <HeroPortada imagenHero={imagenHero} alt={municipio.nombre} titulo={tHome("titulo", { municipio: municipio.nombre })} />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <ListaEventos eventos={eventos} base={base} contexto="siempre" mensajeVacio={tPlanList("vacioSiempre")} />

        {!imagenHero && municipio.lat !== null && municipio.lon !== null && (
          <div className="card-sticker p-2 my-8">
            <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
          </div>
        )}

        <ListadosDelMunicipio municipioId={municipio.id} municipioNombre={municipio.nombre} municipioSlug={municipioSlug} />

        <NearbyMunicipios municipio={municipio} />
      </div>
    </main>
  );
}
