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

const AUDIENCIAS = ["pareja", "familia"] as const;
type AudienciaValida = (typeof AUDIENCIAS)[number];

function esAudienciaValida(valor: string): valor is AudienciaValida {
  return (AUDIENCIAS as readonly string[]).includes(valor);
}

export function generateStaticParams() {
  return AUDIENCIAS.map((audiencia) => ({ audiencia }));
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export default async function EstaSemanaAudienciaPage({
  params,
}: {
  params: Promise<{ municipio: string; audiencia: string }>;
}) {
  const { municipio: municipioSlug, audiencia } = await params;
  if (!esAudienciaValida(audiencia)) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const [todos, primarios, secundarios, tNav, tFiltros, tSemana, tAudiencia, tPlanList, locale] =
    await Promise.all([
      getEventosActivos(municipio.id, audiencia),
      construirFiltrosTemporales(base, "semana"),
      construirFiltrosSecundarios(base, { tipo: "semana" }, audiencia),
      getTranslations("Nav"),
      getTranslations("Filtros"),
      getTranslations("Semana"),
      getTranslations("Audiencia"),
      getTranslations("PlanList"),
      getLocale(),
    ]);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);
  const etiquetaAudiencia = minuscula(tAudiencia(audiencia));

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: tFiltros("semana"), href: `${base}/esta-semana` },
            { label: tAudiencia(audiencia) },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tSemana("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
          fecha={rangoSemanaLegible(locale)}
        />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <ListaEventos
          eventos={eventos}
          base={base}
          contexto="semana"
          obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
          mensajeVacio={tPlanList("vacioSemanaFiltro")}
        />
      </div>
    </main>
  );
}
