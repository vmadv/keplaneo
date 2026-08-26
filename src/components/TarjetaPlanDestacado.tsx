import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import TextoConNegritas from "./TextoConNegritas";
import type { PlanConMunicipio } from "@/lib/queries";

// Tarjeta de la portada MVP (ver conversación): igual que las de PlanList,
// pero con la etiqueta del municipio siempre visible — de un vistazo se ve
// de qué ciudad es cada plan, y esa etiqueta hace también de enlace directo
// a esa ciudad.
export default function TarjetaPlanDestacado({
  plan,
  etiquetaEventoPuntual,
}: {
  plan: PlanConMunicipio;
  etiquetaEventoPuntual: string;
}) {
  const base = `/${plan.municipio_slug}`;
  const href = plan.evento_slug ? `${base}/eventos/${plan.evento_slug}` : base;

  return (
    <Link href={href} className="card-sticker relative block p-4 pt-6">
      <span
        className="absolute -top-3 left-4 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wide"
        style={{ background: "#000", color: "#fff", border: "2px solid var(--foreground)" }}
      >
        {plan.municipio_nombre}
      </span>
      {plan.tipo === "excepcional" && (
        <span
          className="badge-pill mb-2 inline-flex"
          style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--secondary)" }}
        >
          <Sparkles size={11} strokeWidth={2.5} className="mr-1" />
          {etiquetaEventoPuntual}
        </span>
      )}
      <h3 className="font-extrabold text-base text-balance">{plan.titulo}</h3>
      <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
        <TextoConNegritas texto={plan.descripcion.split("\n\n")[0]} />
      </p>
    </Link>
  );
}
