import { Sparkles, Navigation, CalendarDays } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import TextoConNegritas from "./TextoConNegritas";
import { urlFotoProxy } from "@/lib/places";
import { localizado } from "@/lib/contenidoLocalizado";
import { fechaDesdeTextoEspanol, hoyEnMadrid } from "@/lib/dates";
import type { PlanConMunicipio } from "@/lib/queries";

// Tarjeta de la portada MVP (ver conversación): igual que las de PlanList,
// pero con la etiqueta del municipio opcional — en la portada (varias
// ciudades mezcladas) hace falta para saber de un vistazo de dónde es cada
// plan; en el hub de un único municipio (ya lo dice el título de la
// sección) es redundante repetirla en cada tarjeta, así que se omite ahí.
export default async function TarjetaPlanDestacado({
  plan,
  etiquetaEventoPuntual,
  mostrarMunicipio = true,
}: {
  plan: PlanConMunicipio;
  etiquetaEventoPuntual: string;
  mostrarMunicipio?: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("PlanList"), getLocale()]);
  const base = `/${plan.municipio_slug}`;
  const href = plan.evento_slug ? `${base}/eventos/${plan.evento_slug}` : base;
  // Cartel real primero (poco frecuente); si no, foto del lugar vía Google
  // Places — mismo criterio que PlanList.tsx/ListaEventos.tsx.
  const foto = plan.evento_cartel_url ?? plan.evento_foto_lugar_nombre ?? undefined;
  const esCartel = Boolean(plan.evento_cartel_url);
  const titulo = localizado(plan.titulo, plan.evento_titulo_en, locale);
  const descripcion = localizado(plan.descripcion, plan.evento_descripcion_en, locale);

  // Misma fecha de respaldo que PlanList.tsx/ListaEventos.tsx (ver
  // conversación: esta tarjeta —la de "destacados"— era la única de las
  // tres que nunca mostraba fecha).
  const hoy = hoyEnMadrid();
  const tieneFecha = plan.tipo === "excepcional" && plan.evento_fecha_inicio;
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

  return (
    <Link href={href} className="card-sticker relative block p-4 pt-6">
      {mostrarMunicipio && (
        <span
          className="absolute -top-3 left-4 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wide"
          style={{ background: "#000", color: "#fff", border: "2px solid var(--foreground)" }}
        >
          {plan.municipio_nombre}
        </span>
      )}
      <div className="flex items-start gap-3">
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={esCartel ? foto : urlFotoProxy(foto, 128)}
            alt=""
            className="w-16 h-16 rounded-lg object-cover shrink-0"
            style={{ border: "2px solid var(--foreground)" }}
          />
        )}
        <div className="min-w-0">
          {plan.tipo === "excepcional" && (
            <span
              className="badge-pill mb-2 inline-flex"
              style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--secondary)" }}
            >
              <Sparkles size={11} strokeWidth={2.5} className="mr-1" />
              {etiquetaEventoPuntual}
            </span>
          )}
          {plan.evento_zona_cercana && plan.evento_zona_cercana_minutos != null && (
            <span
              className="badge-pill mb-2 inline-flex"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}
            >
              <Navigation size={11} strokeWidth={2.5} className="mr-1" />
              {t("aMinDe", { minutos: plan.evento_zona_cercana_minutos, municipio: plan.municipio_nombre })}
            </span>
          )}
          {etiquetaFecha && (
            <span
              className="badge-pill mb-2 inline-flex"
              style={{ background: "var(--quaternary)", color: "var(--quaternary-foreground)", borderColor: "var(--quaternary)" }}
            >
              <CalendarDays size={11} strokeWidth={2.5} className="mr-1" />
              {etiquetaFecha}
            </span>
          )}
          <h3 className="font-extrabold text-base text-balance">{titulo}</h3>
          <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
            <TextoConNegritas texto={descripcion.split("\n\n")[0]} />
          </p>
        </div>
      </div>
    </Link>
  );
}
