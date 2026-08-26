import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";

export const revalidate = 86400;

// Franja atemporal + audiencia "pareja" — ver conversación: slug propio
// (/en-pareja, no /pareja) porque así es como se busca de verdad, distinto
// del slug "pareja" que ya usan las combinaciones con Cuándo (/hoy/pareja).
export default async function EnParejaPage({
  params,
}: {
  params: Promise<{ municipio: string }>;
}) {
  const { municipio: municipioSlug } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const [eventos, tAudiencia, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id, "pareja"),
    getTranslations("Audiencia"),
    getTranslations("PlanList"),
  ]);

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tAudiencia("tituloSiemprePareja", { municipio: municipio.nombre })}
      eventos={eventos}
      current={{ vigencia: "siempre", extra: "pareja" }}
      contexto="siempre"
      mensajeVacio={tPlanList("vacioSiempre")}
      breadcrumbExtra={[{ label: tAudiencia("pareja") }]}
    />
  );
}
