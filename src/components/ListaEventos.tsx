import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Sun, Moon, CalendarDays } from "lucide-react";
import TextoConNegritas from "./TextoConNegritas";
import BadgeCategoria from "./BadgeCategoria";
import { urlFotoProxy } from "@/lib/places";
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
}: {
  eventos: Evento[];
  base: string;
  contexto?: string;
  obtenerEtiqueta?: (evento: Evento) => string | null;
  mensajeVacio?: string;
}) {
  const t = await getTranslations("PlanList");
  const vacio = mensajeVacio ?? t("vacioCategoria");

  if (eventos.length === 0) {
    return <p style={{ color: "var(--muted-foreground)" }}>{vacio}</p>;
  }

  return (
    <ol className="grid gap-5">
      {eventos.map((evento) => {
        const etiquetaDia = obtenerEtiqueta?.(evento) ?? null;
        const href = contexto
          ? `${base}/eventos/${evento.slug}?desde=${contexto}`
          : `${base}/eventos/${evento.slug}`;
        // Cartel real primero (poco frecuente); si no, foto del lugar vía
        // Google Places — misma lógica que PlanList.tsx, ver conversación.
        const foto = evento.cartel_url ?? evento.foto_lugar_nombre ?? undefined;
        const esCartel = Boolean(evento.cartel_url);

        return (
          <li key={evento.id}>
            <Link href={href} className="card-sticker block p-4">
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
                    style={{ background: evento.momento === "noche" ? "var(--foreground)" : "var(--tertiary)" }}
                  >
                    {evento.momento === "noche" ? (
                      <Moon size={16} strokeWidth={2.5} color="var(--background)" />
                    ) : (
                      <Sun size={16} strokeWidth={2.5} />
                    )}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
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
                  </div>
                  <h3 className="font-extrabold text-base">{evento.titulo}</h3>
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                    <TextoConNegritas texto={evento.descripcion.split("\n\n")[0]} />
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
