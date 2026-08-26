import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";
import { rangoSemanaLegible } from "@/lib/dates";
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

  const [todos, tFiltros, tSemana, tPlanList, locale] = await Promise.all([
    getEventosActivos(municipio.id),
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
      titulo={tSemana("titulo", { municipio: municipio.nombre })}
      fecha={rangoSemanaLegible(locale)}
      eventos={eventos}
      current={{ vigencia: "semana" }}
      contexto="semana"
      obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
      mensajeVacio={tPlanList("vacioSemana")}
      breadcrumbExtra={[{ label: tFiltros("semana") }]}
    />
  );
}
