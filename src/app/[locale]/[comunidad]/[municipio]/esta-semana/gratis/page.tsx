import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import FiltrosPagina from "@/components/FiltrosPagina";
import ListaEventos from "@/components/ListaEventos";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getEventosGratisActivos } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { rangoSemanaLegible } from "@/lib/dates";
import { buscarImagenHero } from "@/lib/heroImage";
import { ordenarPorDiaDeSemana } from "@/lib/semana";

export const revalidate = 86400;

export default async function EstaSemanaGratisPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) notFound();

  const base = `/${comunidadSlug}/${municipioSlug}`;
  const [todos, primarios, secundarios, tNav, tFiltros, tSemana, tPlanList, locale] = await Promise.all([
    getEventosGratisActivos(municipio.id),
    construirFiltrosTemporales(base, "semana"),
    construirFiltrosSecundarios(base, { tipo: "semana" }),
    getTranslations("Nav"),
    getTranslations("Filtros"),
    getTranslations("Semana"),
    getTranslations("PlanList"),
    getLocale(),
  ]);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
            { label: municipio.nombre, href: base },
            { label: tFiltros("semana"), href: `${base}/esta-semana` },
            { label: tFiltros("gratis") },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tSemana("tituloGratis", { municipio: municipio.nombre })}
          fecha={rangoSemanaLegible(locale)}
        />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <ListaEventos
          eventos={eventos}
          base={base}
          contexto="semana"
          obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
          mensajeVacio={tPlanList("vacioSemanaGratis")}
        />
      </div>
    </main>
  );
}
