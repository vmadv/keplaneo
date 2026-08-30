"use client";

import { createContext, useContext, useState } from "react";
import { ChevronDown } from "lucide-react";

// El botón "Más filtros" vive dentro de la fila de pastillas (se desplaza
// en horizontal con ellas, ver conversación), pero el panel que despliega
// (meses/temática) necesita su propio bloque a ancho completo debajo —
// no caben dos filas distintas dentro de la misma fila con scroll. Un
// <details>/<summary> nativo no sirve para esto (el trigger y el
// contenido tienen que ser hermanos), así que se comparte el estado
// abierto/cerrado con contexto entre MasFiltrosBoton (dentro de la fila) y
// MasFiltrosPanel (fuera, debajo).
const MasFiltrosContexto = createContext<{ abierto: boolean; alternar: () => void } | null>(null);

export function MasFiltrosProvider({
  initialOpen,
  children,
}: {
  initialOpen: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(initialOpen);
  return (
    <MasFiltrosContexto.Provider value={{ abierto, alternar: () => setAbierto((a) => !a) }}>
      {children}
    </MasFiltrosContexto.Provider>
  );
}

function useMasFiltros() {
  const ctx = useContext(MasFiltrosContexto);
  if (!ctx) throw new Error("MasFiltrosBoton/Panel deben ir dentro de MasFiltrosProvider");
  return ctx;
}

export function MasFiltrosBoton({ label }: { label: string }) {
  const { abierto, alternar } = useMasFiltros();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={abierto}
      className="btn-secondary border-[1.5px] border-[var(--border)] font-semibold text-[var(--muted-foreground)] text-xs px-3 py-1.5 sm:text-sm sm:px-6 sm:py-[0.65rem] cursor-pointer shrink-0"
    >
      {label}
      <ChevronDown
        size={18}
        strokeWidth={3}
        style={{
          color: "var(--accent)",
          transform: abierto ? "rotate(180deg)" : undefined,
          transition: "transform 0.2s ease",
        }}
      />
    </button>
  );
}

export function MasFiltrosPanel({ children }: { children: React.ReactNode }) {
  const { abierto } = useMasFiltros();
  if (!abierto) return null;
  return <div className="flex flex-col gap-3">{children}</div>;
}
