import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { FiltroTemporalItem } from "@/lib/filtros";

export default function FiltroTemporal({
  items,
  className = "mb-8",
  extra,
}: {
  items: FiltroTemporalItem[];
  className?: string;
  extra?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.activo ? "btn-primary text-sm" : "btn-secondary text-sm"}
        >
          {item.icono && <item.icono size={14} strokeWidth={2.5} />}
          {item.label}
        </Link>
      ))}
      {extra}
    </div>
  );
}
