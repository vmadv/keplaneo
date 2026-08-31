import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Sparkles, CalendarDays, Navigation } from "lucide-react";
import TextoConNegritas from "./TextoConNegritas";
import BadgeCategoria from "./BadgeCategoria";
import FotoTarjeta from "./FotoTarjeta";
import { etiquetaDiaFinde, etiquetaDiasSemanaGenerico, fechaDesdeTextoEspanol, hoyEnMadrid } from "@/lib/dates";
import { localizado } from "@/lib/contenidoLocalizado";
import type { Plan } from "@/lib/types";

export default async function PlanList({
  planes,
  base,
  mostrarDiaFinde = false,
  contexto,
  municipioNombre,
}: {
  planes: Plan[];
  base: string;
  mostrarDiaFinde?: boolean;
  // "hoy" | "finde" | un slug de mes — de dónde viene el listado, para que
  // la ficha del evento sepa qué vigencia mostrar (tiempo, "otros planes")
  // en vez de adivinarlo solo con la vigencia propia del evento, que puede
  // incluir varias a la vez (ej. hoy es sábado: un evento puede ser de hoy
  // Y de finde simultáneamente).
  contexto?: string;
  // Nombre del municipio de ESTA página (no el del plan) — para la
  // etiqueta "A X min de {municipio}" en planes de zona cercana (ver
  // conversación, generarPlanesZonaCercana en gemini.ts).
  municipioNombre?: string;
}) {
  const [t, tBadges, locale] = await Promise.all([
    getTranslations("PlanList"),
    getTranslations("Badges"),
    getLocale(),
  ]);
  const hoy = hoyEnMadrid();

  if (planes.length === 0) {
    return <p style={{ color: "var(--muted-foreground)" }}>{t("vacioGeneral")}</p>;
  }

  return (
    <ol className="grid gap-5">
      {planes.map((plan) => {
        const diaFinde =
          mostrarDiaFinde && plan.tipo === "excepcional"
            ? etiquetaDiaFinde(plan.evento_fecha_inicio ?? null, plan.evento_fecha_fin ?? null, locale)
            : null;
        // Fecha real, solo cuando no hay ya una etiqueta de día de finde ni
        // de patrón recurrente — mismo criterio que ListaEventos.tsx (ver
        // conversación: esta tarjeta nunca mostraba fecha fuera de "Este
        // finde", así que un evento puntual real de cualquier otra página
        // de categoría/mes se veía sin ninguna pista de cuándo es).
        const tieneFecha = !diaFinde && plan.tipo === "excepcional" && plan.evento_fecha_inicio;
        const esRango = tieneFecha && plan.evento_fecha_fin && plan.evento_fecha_fin !== plan.evento_fecha_inicio;
        const fechaInicio = tieneFecha ? fechaDesdeTextoEspanol(plan.evento_fecha_inicio!) : null;
        const fechaFinRango = esRango ? fechaDesdeTextoEspanol(plan.evento_fecha_fin!) : null;
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
        const titulo = localizado(plan.titulo, plan.evento_titulo_en, locale);
        const descripcion = localizado(plan.descripcion, plan.evento_descripcion_en, locale);

        const contenido = (
          <>
            <div className="flex items-start gap-3">
              <FotoTarjeta
                cartelUrl={plan.evento_cartel_url ?? null}
                fotoLugarNombre={plan.evento_foto_lugar_nombre ?? null}
                momento={plan.momento}
                alt=""
              />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {plan.tipo === "excepcional" && (
                    <span className="badge-pill" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--secondary)" }}>
                      <Sparkles size={11} strokeWidth={2.5} className="mr-1" />
                      {tBadges("eventoPuntual")}
                    </span>
                  )}
                  <BadgeCategoria categoria={plan.evento_categoria} />
                  {diaFinde && (
                    <span className="badge-pill" style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}>
                      <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                      {diaFinde}
                    </span>
                  )}
                  {!diaFinde && plan.evento_dias_semana && plan.evento_dias_semana.length > 0 && (
                    <span className="badge-pill" style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}>
                      <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                      {etiquetaDiasSemanaGenerico(plan.evento_dias_semana, locale)}
                    </span>
                  )}
                  {!diaFinde && !(plan.evento_dias_semana && plan.evento_dias_semana.length > 0) && etiquetaFecha && (
                    <span className="badge-pill" style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}>
                      <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
                      {etiquetaFecha}
                    </span>
                  )}
                  {plan.evento_zona_cercana && plan.evento_zona_cercana_minutos != null && municipioNombre && (
                    <span className="badge-pill" style={{ background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                      <Navigation size={11} strokeWidth={2.5} className="mr-1" />
                      {t("aMinDe", { minutos: plan.evento_zona_cercana_minutos, municipio: municipioNombre })}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-base">{titulo}</h3>
                <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                  <TextoConNegritas texto={descripcion.split("\n\n")[0]} />
                </p>
              </div>
            </div>
            {plan.enlace_afiliado && (
              <a
                href={plan.enlace_afiliado}
                className="inline-block mt-3 text-sm font-bold hover:underline"
                style={{ color: "var(--accent)" }}
                rel="nofollow sponsored"
              >
                {t("reservar")}
              </a>
            )}
          </>
        );

        const href = contexto
          ? `${base}/eventos/${plan.evento_slug}?desde=${contexto}`
          : `${base}/eventos/${plan.evento_slug}`;

        return (
          <li key={plan.id}>
            {plan.evento_slug ? (
              <Link href={href} className="card-sticker block p-4">
                {contenido}
              </Link>
            ) : (
              <div className="card-sticker p-4">{contenido}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
