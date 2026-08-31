import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Sparkles, CalendarDays, Navigation } from "lucide-react";
import TextoConNegritas from "./TextoConNegritas";
import BadgeCategoria from "./BadgeCategoria";
import FotoTarjeta from "./FotoTarjeta";
import { etiquetaDiasSemanaGenerico, fechaDesdeTextoEspanol, hoyEnMadrid } from "@/lib/dates";
import { localizado } from "@/lib/contenidoLocalizado";
import type { Evento } from "@/lib/types";

// Como PlanList, pero para Evento[] — se usa en páginas que leen
// directamente de la ficha estable del evento en vez de un lote diario de
// `planes` con vigencia concreta (categoría, esta semana).
export default async function ListaEventos({
  eventos,
  base,
  contexto,
  obtenerEtiqueta,
  mensajeVacio,
  municipioNombre,
}: {
  eventos: Evento[];
  base: string;
  contexto?: string;
  obtenerEtiqueta?: (evento: Evento) => string | null;
  mensajeVacio?: string;
  // Nombre del municipio de ESTA página (no el del evento) — para la
  // etiqueta "A X min de {municipio}" en planes de zona cercana (ver
  // conversación, generarPlanesZonaCercana en gemini.ts).
  municipioNombre?: string;
}) {
  const [t, tBadges, locale] = await Promise.all([getTranslations("PlanList"), getTranslations("Badges"), getLocale()]);
  const vacio = mensajeVacio ?? t("vacioCategoria");
  const hoy = hoyEnMadrid();

  if (eventos.length === 0) {
    return <p style={{ color: "var(--muted-foreground)" }}>{vacio}</p>;
  }

  return (
    <ol className="grid gap-5">
      {eventos.map((evento) => {
        const etiquetaDia = obtenerEtiqueta?.(evento) ?? null;
        // Fecha real, solo cuando no hay ya una etiqueta de día de semana
        // (esta semana/destacados) ni de patrón recurrente — es el fallback
        // para el listado "Todos", que hasta ahora no mostraba ninguna
        // fecha (ver conversación). Un día concreto se muestra tal cual
        // ("11 sept"); un rango de varios días no tiene "un" día que
        // mostrar sin ser engañoso, así que se muestra solo el mes en el
        // que cae su inicio ("Septiembre") — salvo que ese rango ya esté en
        // marcha hoy (ej. una exposición de abril a octubre): ahí "Abril" a
        // secas confunde (parece que es EN abril), así que se antepone
        // "Desde" (bug real encontrado en conversación: salía "Abril" en el
        // bloque de destacados de ESTA SEMANA para algo que sigue abierto).
        const tieneFecha = !etiquetaDia && evento.fecha_inicio;
        const esRango = tieneFecha && evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio;
        const fechaInicio = tieneFecha ? fechaDesdeTextoEspanol(evento.fecha_inicio!) : null;
        const fechaFinRango = esRango ? fechaDesdeTextoEspanol(evento.fecha_fin!) : null;
        const rangoEnCurso = esRango && fechaInicio && fechaInicio <= hoy && (!fechaFinRango || fechaFinRango >= hoy);
        const etiquetaFechaCruda = fechaInicio
          ? new Intl.DateTimeFormat(locale, esRango ? { month: "long" } : { day: "numeric", month: "short" }).format(
              fechaInicio
            )
          : null;
        const etiquetaFecha = (() => {
          if (!etiquetaFechaCruda) return null;
          if (!esRango) return etiquetaFechaCruda;
          const mes = etiquetaFechaCruda.charAt(0).toUpperCase() + etiquetaFechaCruda.slice(1);
          return rangoEnCurso ? t("desdeMes", { mes }) : mes;
        })();
        const href = contexto
          ? `${base}/eventos/${evento.slug}?desde=${contexto}`
          : `${base}/eventos/${evento.slug}`;
        const esPuntual = evento.fecha_inicio !== null;
        const titulo = localizado(evento.titulo, evento.titulo_en, locale);
        const descripcion = localizado(evento.descripcion, evento.descripcion_en, locale);

        return (
          <li key={evento.id}>
            <Link href={href} className="card-sticker block p-4">
              <div className="flex items-start gap-3">
                <FotoTarjeta
                  cartelUrl={evento.cartel_url}
                  fotoLugarNombre={evento.foto_lugar_nombre}
                  momento={evento.momento}
                  alt=""
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {esPuntual && (
                      <span className="badge-pill" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--secondary)" }}>
                        <Sparkles size={11} strokeWidth={2.5} className="mr-1" />
                        {tBadges("eventoPuntual")}
                      </span>
                    )}
                    <BadgeCategoria categoria={evento.categoria} />
                    {etiquetaDia && (
                      <span
                        className="badge-pill"
                        style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}
                      >
                        <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                        {etiquetaDia}
                      </span>
                    )}
                    {!etiquetaDia && evento.dias_semana && evento.dias_semana.length > 0 && (
                      <span
                        className="badge-pill"
                        style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}
                      >
                        <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                        {etiquetaDiasSemanaGenerico(evento.dias_semana, locale)}
                      </span>
                    )}
                    {!etiquetaDia && !(evento.dias_semana && evento.dias_semana.length > 0) && etiquetaFecha && (
                      <span
                        className="badge-pill"
                        style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}
                      >
                        <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                        {etiquetaFecha}
                      </span>
                    )}
                    {evento.zona_cercana && evento.zona_cercana_minutos != null && municipioNombre && (
                      <span className="badge-pill" style={{ background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                        <Navigation size={11} strokeWidth={2.5} className="mr-1" />
                        {t("aMinDe", { minutos: evento.zona_cercana_minutos, municipio: municipioNombre })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-base">{titulo}</h3>
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                    <TextoConNegritas texto={descripcion.split("\n\n")[0]} />
                  </p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
