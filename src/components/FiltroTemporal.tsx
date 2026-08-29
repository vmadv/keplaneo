import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FiltroTemporalItem } from "@/lib/filtros";

export default function FiltroTemporal({
  items,
  className = "mb-8",
  extra,
  etiqueta,
  compacto = false,
  invita = false,
}: {
  items: FiltroTemporalItem[];
  className?: string;
  extra?: ReactNode;
  // Etiqueta en la misma fila que las pastillas (en vez de encima, en su
  // propia línea) — ahorra una línea entera en mobile, ver conversación.
  etiqueta?: string;
  // Pastillas más pequeñas en mobile (vuelven al tamaño normal desde `sm:`)
  // para que quepan más por fila — solo pensado para las filas Cuándo/Filtra más.
  compacto?: boolean;
  // Un par de rebotes cortos al montar, para invitar a mirar este grupo
  // justo después de elegir algo en el otro eje (Cuándo <-> Filtra más) —
  // ver conversación ("cuando el usuario clica sobre hoy o en pareja").
  invita?: boolean;
}) {
  const clasesPastilla = compacto ? "text-xs px-3 py-1.5 sm:text-sm sm:px-6 sm:py-[0.65rem]" : "text-sm";
  // La pastilla activa (btn-primary) ya lleva borde grueso + sombra — es la
  // única que debe "gritar". Las inactivas antes llevaban el mismo borde
  // grueso de .btn-secondary y competían visualmente con la seleccionada;
  // aquí se suavizan (borde fino y claro, texto no tan marcado) para que la
  // jerarquía se note de un vistazo (ver conversación).
  const clasesInactiva = "border-[1.5px] border-[var(--border)] font-semibold text-[var(--muted-foreground)]";

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {etiqueta && (
        <span
          className="text-xs font-bold uppercase tracking-wide shrink-0 inline-flex items-center gap-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {etiqueta}
          {invita && <ChevronRight size={13} strokeWidth={3} className="icono-invitacion" aria-hidden />}
        </span>
      )}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          className={`${item.activo ? "btn-primary" : `btn-secondary ${clasesInactiva}`} ${clasesPastilla}`}
        >
          {item.icono && <item.icono size={14} strokeWidth={2.5} />}
          {item.label}
        </Link>
      ))}
      {extra}
    </div>
  );
}
