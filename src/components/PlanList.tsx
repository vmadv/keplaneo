import Link from "next/link";
import type { Plan } from "@/lib/types";

export default function PlanList({ planes, base }: { planes: Plan[]; base: string }) {
  if (planes.length === 0) {
    return (
      <p className="text-slate-500">
        Todavía no hay planes específicos para esta combinación. Vuelve a
        revisar en unas horas, o consulta las otras variantes más abajo.
      </p>
    );
  }

  return (
    <ol className="grid gap-4">
      {planes.map((plan) => (
        <li key={plan.id} className="border rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-1">
            <span>{plan.momento === "dia" ? "Día" : "Noche"}</span>
            {plan.tipo === "excepcional" && (
              <span className="text-amber-700">· Evento puntual</span>
            )}
          </div>
          <h3 className="font-semibold text-base">
            {plan.evento_slug ? (
              <Link href={`${base}/eventos/${plan.evento_slug}`} className="hover:underline">
                {plan.titulo}
              </Link>
            ) : (
              plan.titulo
            )}
          </h3>
          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{plan.descripcion}</p>
          <div className="mt-2 flex gap-4 text-sm">
            {plan.evento_slug && (
              <Link href={`${base}/eventos/${plan.evento_slug}`} className="font-medium text-blue-700 hover:underline">
                Más información →
              </Link>
            )}
            {plan.enlace_afiliado && (
              <a
                href={plan.enlace_afiliado}
                className="font-medium text-blue-700 hover:underline"
                rel="nofollow sponsored"
              >
                Reservar →
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
