import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Sun, Moon, Sparkles, CalendarDays } from "lucide-react";
import TextoConNegritas from "./TextoConNegritas";
import BadgeCategoria from "./BadgeCategoria";
import { etiquetaDiaFinde } from "@/lib/dates";
import { urlFotoProxy } from "@/lib/places";
import type { Plan } from "@/lib/types";

export default async function PlanList({
  planes,
  base,
  mostrarDiaFinde = false,
  contexto,
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
}) {
  const [t, tBadges, locale] = await Promise.all([
    getTranslations("PlanList"),
    getTranslations("Badges"),
    getLocale(),
  ]);

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

        // Cartel real primero (poco frecuente, solo destacados verificados
        // a mano — ver conversación); si no, la foto del lugar vía Google
        // Places, que sí escala gratis gracias a la caché por recinto.
        const foto = plan.evento_cartel_url ?? plan.evento_foto_lugar_nombre ?? undefined;
        const esCartel = Boolean(plan.evento_cartel_url);

        const contenido = (
          <>
            <div className="flex items-start gap-3">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={esCartel ? foto : urlFotoProxy(foto, 128)}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                  style={{ border: "2px solid var(--foreground)" }}
                />
              ) : (
                <span
                  className="icon-chip w-9 h-9 shrink-0"
                  style={{ background: plan.momento === "noche" ? "var(--foreground)" : "var(--tertiary)" }}
                >
                  {plan.momento === "noche" ? (
                    <Moon size={16} strokeWidth={2.5} color="var(--background)" />
                  ) : (
                    <Sun size={16} strokeWidth={2.5} />
                  )}
                </span>
              )}
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
                </div>
                <h3 className="font-extrabold text-base">{plan.titulo}</h3>
                <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                  <TextoConNegritas texto={plan.descripcion.split("\n\n")[0]} />
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
