import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";

export const revalidate = 86400;

// Franja atemporal general (sin extra) — todo lo activo, sin restringir
// por fecha. El hub (`/{municipio}` a secas) sigue enseñando Hoy por
// defecto como antes (ver conversación); esta es la versión sin sesgo de
// fecha, con su propio hueco en Cuándo.
export default async function SiemprePage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [eventos, tFiltros, tHome, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id),
    getTranslations("Filtros"),
    getTranslations("MunicipioHome"),
    getTranslations("PlanList"),
  ]);

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tHome("titulo", { municipio: municipio.nombre })}
      eventos={eventos}
      current={{ vigencia: "siempre" }}
      contexto="siempre"
      mensajeVacio={tPlanList("vacioSiempre")}
      breadcrumbExtra={[{ label: tFiltros("siempre") }]}
    />
  );
}
