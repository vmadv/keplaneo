import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import EventosPageLayout from "@/components/EventosPageLayout";
import { getMunicipio, getEventosActivos } from "@/lib/queries";
import { rangoSemanaLegible } from "@/lib/dates";
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
  params: Promise<{ locale: string; municipio: string; audiencia: string }>;
}) {
  const { locale, municipio: municipioSlug, audiencia } = await params;
  setRequestLocale(locale);
  if (!esAudienciaValida(audiencia)) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const [todos, tFiltros, tSemana, tAudiencia, tPlanList] = await Promise.all([
    getEventosActivos(municipio.id, audiencia),
    getTranslations("Filtros"),
    getTranslations("Semana"),
    getTranslations("Audiencia"),
    getTranslations("PlanList"),
  ]);
  const { eventos, etiquetas } = ordenarPorDiaDeSemana(todos, locale);
  const etiquetaAudiencia = minuscula(tAudiencia(audiencia));

  return (
    <EventosPageLayout
      municipio={municipio}
      municipioSlug={municipioSlug}
      titulo={tSemana("tituloAudiencia", { municipio: municipio.nombre, audiencia: etiquetaAudiencia })}
      fecha={rangoSemanaLegible(locale)}
      eventos={eventos}
      current={{ vigencia: "semana", extra: audiencia }}
      contexto="semana"
      obtenerEtiqueta={(evento) => etiquetas.get(evento.id) ?? null}
      mensajeVacio={tPlanList("vacioSemanaFiltro")}
      breadcrumbExtra={[
        { label: tFiltros("semana"), href: `${base}/esta-semana` },
        { label: tAudiencia(audiencia) },
      ]}
    />
  );
}
