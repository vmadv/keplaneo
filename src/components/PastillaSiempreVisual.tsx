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
const CLAVE = "keplaneo:siempreClicada";

export default function PastillaSiempreVisual({
  href,
  label,
  clasesInactiva,
  clasesTamano,
  shrink,
}: {
  href: string;
  label: string;
  clasesInactiva: string;
  clasesTamano: string;
  shrink: boolean;
}) {
  const [marcada, setMarcada] = useState(false);

  useEffect(() => {
    setMarcada(sessionStorage.getItem(CLAVE) === href);
  }, [href]);

  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => sessionStorage.setItem(CLAVE, href)}
      className={`${marcada ? "btn-primary" : `btn-secondary ${clasesInactiva}`} ${clasesTamano} ${shrink ? "shrink-0" : ""}`}
    >
      {label}
    </Link>
  );
}
