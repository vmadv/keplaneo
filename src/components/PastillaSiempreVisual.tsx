"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

// Efecto puramente visual, sin URL ni servidor de por medio (ver
// conversación): el servidor nunca manda `activo: true` para "Siempre" en
// su propio hub (no hay forma de distinguir "llegaste por defecto" de
// "pinchaste la pastilla" con la misma URL) — pero al pincharla se marca
// en violeta igualmente, recordado en sessionStorage mientras dure la
// pestaña. Recargar la página o abrir una nueva pestaña la vuelve a dejar
// sin marcar, que es justo el comportamiento por defecto que se quería
// conservar.
export const CLAVE_SIEMPRE = "keplaneo:siempreClicada";
// Evento propio (no el "storage" nativo, que solo llega a OTRAS pestañas)
// para que la fila de "Filtra más" reaccione al instante en la MISMA
// página — ver IconoInvitacion.tsx.
export const EVENTO_SIEMPRE = "keplaneo:siempre-marcada";

export default function PastillaSiempreVisual({
  href,
  label,
  clasesInactiva,
  clasesTamano,
  shrink,
  vigenciaEsSiempre,
}: {
  href: string;
  label: string;
  clasesInactiva: string;
  clasesTamano: string;
  shrink: boolean;
  // Si de verdad seguimos en la vigencia "siempre" (con cualquier extra:
  // gratis/con-niños/en-pareja) — a diferencia de `activo` (que
  // SiempreHubLayout fuerza a false para no mostrarse marcada por
  // defecto), esto no se toca nunca, así que sirve para saber si hay que
  // conservar la marca al combinar con un extra o limpiarla al pasar a
  // una vigencia temporal real (Hoy/Finde/Esta semana).
  vigenciaEsSiempre?: boolean;
}) {
  const [marcada, setMarcada] = useState(false);

  useEffect(() => {
    if (!vigenciaEsSiempre) {
      sessionStorage.removeItem(CLAVE_SIEMPRE);
      setMarcada(false);
      return;
    }
    setMarcada(sessionStorage.getItem(CLAVE_SIEMPRE) === "1");
  }, [vigenciaEsSiempre]);

  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        sessionStorage.setItem(CLAVE_SIEMPRE, "1");
        setMarcada(true);
        // Un clic en "Siempre" sin cambio real de página (ya estábamos ahí)
        // no dispara ningún re-render de la fila hermana — este evento es
        // lo único que se lo avisa al instante (ver conversación).
        window.dispatchEvent(new Event(EVENTO_SIEMPRE));
      }}
      className={`${marcada ? "btn-primary" : `btn-secondary ${clasesInactiva}`} ${clasesTamano} ${shrink ? "shrink-0" : ""}`}
    >
      {label}
    </Link>
  );
}
