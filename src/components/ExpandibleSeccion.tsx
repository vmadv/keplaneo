"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Envuelve contenido ya renderizado en servidor (una segunda tanda de
// tarjetas) y lo oculta/muestra con un botón — mismo patrón que
// ListaCiudadesHome, pero aquí los hijos son componentes de servidor ya
// resueltos (Server Components como children de un Client Component es
// un patrón soportado por Next.js), no datos que se recorten en cliente.
export default function ExpandibleSeccion({
  textoVerMas,
  textoVerMenos,
  children,
}: {
  textoVerMas: string;
  textoVerMenos: string;
  children: React.ReactNode;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <>
      <div style={{ display: expandido ? "block" : "none" }}>{children}</div>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="btn-secondary text-sm mt-4"
      >
        {expandido ? textoVerMenos : textoVerMas}
        <ChevronDown size={14} strokeWidth={2.5} style={{ transform: expandido ? "rotate(180deg)" : "none" }} />
      </button>
    </>
  );
}
