import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { EraserAddIcon } from "./icons/EraserAddIcon";
import PastillaSiempreVisual from "./PastillaSiempreVisual";
import IconoInvitacion from "./IconoInvitacion";
import type { FiltroTemporalItem } from "@/lib/filtros";

export default function FiltroTemporal({
  items,
  className = "mb-8",
  extra,
  compacto = false,
  scrollable = false,
  invita = false,
  invitaReaccionaASiempre = false,
}: {
  items: FiltroTemporalItem[];
  className?: string;
  // Elemento suelto al final de la fila (ej. el botón "Más filtros") — se
  // desplaza junto con las pastillas si la fila es scrollable, en vez de
  // tener su propia línea (ver conversación).
  extra?: ReactNode;
  // Pastillas más pequeñas en mobile (vuelven al tamaño normal desde `sm:`)
  // para que quepan más por fila — solo pensado para las filas Cuándo/Filtra más.
  compacto?: boolean;
  // En vez de saltar a una segunda línea en mobile (4 pastillas no caben en
  // una fila), una sola línea que se desliza horizontalmente — con
  // degradado en el borde para que se note que hay más y que se puede
  // arrastrar (ver conversación). Solo para la fila de Cuándo/Filtra más,
  // no para el panel de "Más filtros" (meses/temática), que sigue
  // prefiriendo saltar de línea porque ahí sí sobra espacio vertical.
  scrollable?: boolean;
  // Icono suelto al principio de la fila (sin texto, ver conversación: se
  // quitaron las etiquetas "CUÁNDO"/"FILTRA MÁS") que rebota un par de
  // veces al montar, para indicar "aquí también puedes filtrar" — solo en
  // el eje que todavía no se ha tocado. Una flecha al final de la fila no
  // señalaba hacia nada (ver conversación); un icono al principio, junto a
  // las propias pastillas de ese grupo, sí se lee como "mira aquí".
  invita?: boolean;
  // Solo la fila de "Filtra más" debe reaccionar a un clic en "Siempre" (ver
  // conversación: pinchar Siempre no navega si ya se estaba en esa página,
  // así que necesita su propio evento para saltar sin recarga). La fila de
  // Cuándo no debe reaccionar a su propia pastilla "Siempre".
  invitaReaccionaASiempre?: boolean;
}) {
  const clasesPastilla = compacto ? "text-xs px-3 py-1.5 sm:text-sm sm:px-6 sm:py-[0.65rem]" : "text-sm";
  // La pastilla activa (btn-primary) ya lleva borde grueso + sombra — es la
  // única que debe "gritar". Las inactivas antes llevaban el mismo borde
  // grueso de .btn-secondary y competían visualmente con la seleccionada;
  // aquí se suavizan (borde fino y claro, texto no tan marcado) para que la
  // jerarquía se note de un vistazo (ver conversación). Fondo sólido (no
  // transparente como el .btn-secondary base) para que se separen del
  // punteado de fondo en vez de fundirse con él — mismo criterio que
  // .card-sticker en el resto del sitio.
  const clasesInactiva =
    "pastilla-filtro-inactiva border-[1.5px] border-[var(--border)] font-semibold text-[var(--muted-foreground)]";

  return (
    <div
      className={`flex gap-1.5 items-center ${scrollable ? "flex-nowrap overflow-x-auto sin-scrollbar mascara-desvanecido py-1 pr-2" : "flex-wrap"} ${className}`}
    >
      {invitaReaccionaASiempre ? (
        <IconoInvitacion invitaServidor={invita} />
      ) : (
        invita && (
          <EraserAddIcon
            size={18}
            className="icono-invitacion shrink-0"
            style={{ color: "var(--accent)" }}
            aria-hidden
          />
        )
      )}
      {items.map((item) =>
        item.siempre ? (
          <PastillaSiempreVisual
            key={item.href}
            href={item.href}
            label={item.label}
            clasesInactiva={clasesInactiva}
            clasesTamano={clasesPastilla}
            shrink={scrollable}
            vigenciaEsSiempre={item.vigenciaEsSiempre}
          />
        ) : (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            className={`${item.activo ? "btn-primary" : `btn-secondary ${clasesInactiva}`} ${clasesPastilla} ${scrollable ? "shrink-0" : ""}`}
          >
            {item.icono && <item.icono size={14} strokeWidth={2.5} />}
            {item.label}
          </Link>
        )
      )}
      {extra}
    </div>
  );
}
