"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

// El scroll-to-top automático de Next.js al navegar con <Link> no siempre
// dispara (p. ej. cambiando de pestaña Hoy/Finde/Esta semana estando
// desplazado hacia abajo) — se refuerza a mano en cada cambio de ruta para
// no dejar al usuario a media página con contenido nuevo.
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
