import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Tarjeta simple para bloques de la portada que no muestran planes en sí
// (En pareja/Con niños/Gratis, Conciertos/Exposiciones/Teatro/Monólogos):
// solo un enlace a "elige tu ciudad" para ese filtro — ver conversación,
// evita tener que decidir a qué municipio mandar directamente desde la
// portada. `imagen` es opcional para cuando lleguen las fotos reales.
export default function TarjetaEnlaceFiltro({
  href,
  titulo,
  Icono,
  color,
}: {
  href: string;
  titulo: string;
  Icono: LucideIcon;
  color: string;
}) {
  return (
    <Link href={href} className="card-sticker flex items-center gap-3 p-5">
      <span className="icon-chip w-10 h-10 shrink-0" style={{ background: color }}>
        <Icono size={18} strokeWidth={2.5} />
      </span>
      <span className="text-lg font-bold">{titulo}</span>
    </Link>
  );
}
