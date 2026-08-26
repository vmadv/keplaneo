import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import FiltrosPagina from "@/components/FiltrosPagina";
import ListaEventos from "@/components/ListaEventos";
import HeroPortada from "@/components/HeroPortada";
import { getMunicipio, getEventosActivos } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { rangoSemanaLegible } from "@/lib/dates";
import { buscarImagenHero } from "@/lib/heroImage";
import { ordenarPorDiaDeSemana } from "@/lib/semana";

export const revalidate = 86400;

// No genera contenido nuevo: se apoya en `eventos` (la ficha estable que ya
// alimenta las páginas de categoría), filtrando y ordenando por el rango
// fecha_inicio–fecha_fin de cada uno (ver src/lib/semana.ts).
export default async function EstaSemanaPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const [todos, primarios, secundarios, tNav, tFiltros, tSemana, tPlanList, locale] = await Promise.all([
    getEventosActivos(municipio.id),
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
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: tFiltros("semana") },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tSemana("titulo", { municipio: municipio.nombre })}
          fecha={rangoSemanaLegible(locale)}
        />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <ListaEventos
          eventos={eventos}
          base={base}
          contexto="semana"
          obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
          mensajeVacio={tPlanList("vacioSemana")}
        />
      </div>
    </main>
  );
}
