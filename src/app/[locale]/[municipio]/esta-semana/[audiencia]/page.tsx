import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";
import { rangoSemanaLegible } from "@/lib/dates";
import { ordenarPorDiaDeSemana } from "@/lib/semana";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { AUDIENCIAS_URL, esAudienciaUrlValida, audienciaDesdeUrl } from "@/lib/filtros";

export const revalidate = 86400;

export function generateStaticParams() {
  return AUDIENCIAS_URL.map((audiencia) => ({ audiencia }));
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; audiencia: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, audiencia } = await params;
  if (!esAudienciaUrlValida(audiencia)) return {};
  const extra = audienciaDesdeUrl(audiencia);
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tSemana, tAudiencia, description] = await Promise.all([
    getTranslations("Semana"),
    getTranslations("Audiencia"),
    construirMetaDescripcion(municipio.nombre, "semana", extra),
  ]);
  const title = await construirTituloConSufijo(
    tSemana("tituloAudiencia", { municipio: municipio.nombre, audiencia: minuscula(tAudiencia(extra)) }),
    extra
  );
  return { title, description };
}

export default async function EstaSemanaAudienciaPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia } = await params;
  setRequestLocale(locale);
  if (!esAudienciaUrlValida(audiencia)) notFound();
  const extra = audienciaDesdeUrl(audiencia);

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const [todos, tFiltros, tSemana, tAudiencia, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id, extra),
    getTranslations("Filtros"),
    getTranslations("Semana"),
    getTranslations("Audiencia"),
    getTranslations("PlanList"),
  ]);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);
  const etiquetaAudiencia = minuscula(tAudiencia(extra));

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tSemana("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={rangoSemanaLegible(locale)}
      eventos={eventos}
      current={{ vigencia: "semana", extra }}
      contexto="semana"
      obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
      mensajeVacio={tPlanList("vacioSemanaFiltro")}
      enlaceMasPlanes={{ href: `${base}/esta-semana`, texto: tSemana("masPlanes", { municipio: municipio.nombre }) }}
      breadcrumbExtra={[
        { label: tFiltros("semana"), href: `${base}/esta-semana` },
        { label: tAudiencia(extra) },
      ]}
    />
  );
}
