import Link from "next/link";
import { Sun, Moon, Sparkles } from "lucide-react";
import type { Plan } from "@/lib/types";

export default function PlanList({ planes, base }: { planes: Plan[]; base: string }) {
  if (planes.length === 0) {
    return (
      <p style={{ color: "var(--muted-foreground)" }}>
        Todavía no hay planes específicos para esta combinación. Vuelve a
        revisar en unas horas, o consulta las otras variantes más abajo.
      </p>
    );
  }

  return (
    <ol className="grid gap-5">
      {planes.map((plan) => {
        const contenido = (
          <>
            <div className="flex items-start gap-3">
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
              <div className="min-w-0">
                {plan.tipo === "excepcional" && (
                  <span className="badge-pill mb-1.5" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--secondary)" }}>
                    <Sparkles size={11} strokeWidth={2.5} className="mr-1" />
                    Evento puntual
                  </span>
                )}
                <h3 className="font-extrabold text-base">{plan.titulo}</h3>
                <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
                  {plan.descripcion}
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
                Reservar →
              </a>
            )}
          </>
        );

        return (
          <li key={plan.id}>
            {plan.evento_slug ? (
              <Link href={`${base}/eventos/${plan.evento_slug}`} className="card-sticker block p-4">
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
