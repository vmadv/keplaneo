import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";

export const revalidate = 86400;

// Franja atemporal + audiencia "familia" — mismo dato que ya usan
// hoy/familia etc., pero con el rótulo/slug "con niños" que es como se
// busca de verdad (ver conversación), en vez de reutilizar /familia.
export default async function ConNinosPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [eventos, tAudiencia, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id, "familia"),
    getTranslations("Audiencia"),
    getTranslations("PlanList"),
  ]);

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tAudiencia("tituloSiempreConNinos", { municipio: municipio.nombre })}
      eventos={eventos}
      current={{ vigencia: "siempre", extra: "familia" }}
      contexto="siempre"
      mensajeVacio={tPlanList("vacioSiempre")}
      breadcrumbExtra={[{ label: tAudiencia("conNinos") }]}
    />
  );
}
