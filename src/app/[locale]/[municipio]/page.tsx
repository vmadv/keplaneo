import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import FiltrosPagina from "@/components/FiltrosPagina";
import ListaEventos from "@/components/ListaEventos";
import TarjetaPlanDestacado from "@/components/TarjetaPlanDestacado";
import NearbyMunicipios from "@/components/NearbyMunicipios";
import ListadosDelMunicipio from "@/components/ListadosDelMunicipio";
import Mapa from "@/components/Mapa";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getEventosActivos, getPlanesDestacadosDeMunicipio } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";

export const revalidate = 86400;

// El hub del municipio es la franja atemporal ("siempre") de Cuándo — la
// URL corta y canónica para "qué hacer en {municipio}" (ver conversación:
// no tiene sentido una URL "/siempre", así que vive aquí, en el hub a
// secas). Iba con solo el listado plano de todo lo activo, pero eso deja
// como primer contenido cosas genéricas (un paseo por el río) en vez de lo
// mejor que ya tenemos generado — ahora lleva primero los planes puntuales
// destacados y los rankings, y el listado completo baja a ser la cola de
// la página (cobertura, no la carta de presentación).
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

  const [eventos, destacados, primarios, secundarios, tNav, tHome, tBadges, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id),
    getPlanesDestacadosDeMunicipio(municipio),
    construirFiltrosTemporales(base, "siempre"),
    construirFiltrosSecundarios(base, "siempre"),
    getTranslations("Nav"),
    getTranslations("MunicipioHome"),
    getTranslations("Badges"),
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

        {destacados.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-extrabold mb-3">{tHome("tituloDestacados", { municipio: municipio.nombre })}</h2>
            <ul className="grid sm:grid-cols-2 gap-5">
              {destacados.map((plan) => (
                <li key={plan.id}>
                  <TarjetaPlanDestacado plan={plan} etiquetaEventoPuntual={tBadges("eventoPuntual")} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <ListadosDelMunicipio municipioId={municipio.id} municipioNombre={municipio.nombre} municipioSlug={municipioSlug} />

        <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
          <h2 className="text-lg font-extrabold mb-3">{tHome("tituloTodo", { municipio: municipio.nombre })}</h2>
          <ListaEventos eventos={eventos} base={base} contexto="siempre" mensajeVacio={tPlanList("vacioSiempre")} />
        </section>

        {!imagenHero && municipio.lat !== null && municipio.lon !== null && (
          <div className="card-sticker p-2 my-8">
            <Mapa lat={municipio.lat} lon={municipio.lon} etiqueta={municipio.nombre} direccionTexto={municipio.nombre} />
          </div>
        )}

        <NearbyMunicipios municipio={municipio} />
      </div>
    </main>
  );
}
