import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosGratisActivos } from "@/lib/queries";

export const revalidate = 86400;

// Franja atemporal + precio "gratis" — antes esta URL era "gratis de hoy"
// (ver conversación); ese caso concreto se mudó a /hoy/gratis y esta pasa
// a ser la versión general, sin restringir por fecha.
export default async function GratisPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [eventos, tFiltros, tGratis, tPlanList] = await Promise.all([
    getEventosGratisActivos(municipio.id),
    getTranslations("Filtros"),
    getTranslations("Gratis"),
    getTranslations("PlanList"),
  ]);

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tGratis("tituloSiempre", { municipio: municipio.nombre })}
      eventos={eventos}
      current={{ vigencia: "siempre", extra: "gratis" }}
      contexto="siempre"
      mensajeVacio={tPlanList("vacioSiempreGratis")}
      breadcrumbExtra={[{ label: tFiltros("gratis") }]}
    />
  );
}
