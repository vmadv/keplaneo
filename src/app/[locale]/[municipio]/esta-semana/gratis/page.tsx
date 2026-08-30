import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosGratisActivos } from "@/lib/queries";
import { rangoSemanaLegible } from "@/lib/dates";
import { ordenarPorDiaDeSemana } from "@/lib/semana";
import { construirMetaDescripcion, construirTituloConSufijo } from "@/lib/resumenSeleccion";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};
  const [tSemana, description] = await Promise.all([
    getTranslations("Semana"),
    construirMetaDescripcion(municipio.nombre, "semana", "gratis"),
  ]);
  const title = await construirTituloConSufijo(tSemana("tituloGratis", { municipio: municipio.nombre }));
  return { title, description };
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
        href: `/${municipioSlug}/esta-semana`,
        texto: tSemana("masPlanes", { municipio: municipio.nombre }),
      }}
      breadcrumbExtra={[
        { label: tFiltros("semana"), href: `${base}/esta-semana` },
        { label: tFiltros("gratis") },
      ]}
    />
  );
}
