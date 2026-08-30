import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosGratisActivos } from "@/lib/queries";
import { rangoSemanaLegible } from "@/lib/dates";
import { ordenarPorDiaDeSemana } from "@/lib/semana";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { hrefFiltro, alternatesIdiomas } from "@/lib/filtros";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tSemana, description, locale] = await Promise.all([
    getTranslations("Semana"),
    construirMetaDescripcion(municipio.nombre, "semana", "gratis"),
    getLocale(),
  ]);
  const title = await construirTituloConSufijo(tSemana("tituloGratis", { municipio: municipio.nombre }));
  const alt = alternatesIdiomas(`/${municipioSlug}/esta-semana/gratis`);
  return { title, description, alternates: { languages: alt, canonical: alt[locale] } };
}

export default async function EstaSemanaGratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const [todos, tFiltros, tSemana, tPlanList, locale] = await Promise.all([
    getEventosGratisActivos(municipio.id),
    getTranslations("Filtros"),
    getTranslations("Semana"),
    getTranslations("PlanList"),
    getLocale(),
  ]);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);
  const hrefSemana = hrefFiltro(locale, base, "semana");

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tSemana("tituloGratis", { municipio: municipio.nombre })}
      fecha={rangoSemanaLegible(locale)}
      eventos={eventos}
      current={{ vigencia: "semana", extra: "gratis" }}
      contexto="semana"
      obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
      mensajeVacio={tPlanList("vacioSemanaGratis")}
      enlaceMasPlanes={{
        href: hrefSemana,
        texto: tSemana("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("semana"), href: hrefSemana },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
