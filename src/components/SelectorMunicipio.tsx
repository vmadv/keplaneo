"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface MunicipioItem {
  slug: string;
  nombre: string;
}

// Se muestra pegado al logo, alineado por la base de línea. Con ciudad
// real en contexto, tiene el mismo peso/tamaño que "keplaneo" — se lee
// como una sola marca ("keplaneo Sevilla"). Sin ciudad (portada,
// /elige-ciudad...) cae a `placeholder`, más pequeño y apagado, para no
// competir con el logo cuando no hay nada que afirmar todavía.
export default function SelectorMunicipio({
  actual,
  municipios,
  placeholder,
}: {
  actual: string | null;
  municipios: MunicipioItem[];
  placeholder: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nombreActual = actual ? (municipios.find((m) => m.slug === actual)?.nombre ?? placeholder) : placeholder;

  useEffect(() => {
    function alClicarFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicarFuera);
    return () => document.removeEventListener("mousedown", alClicarFuera);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={`flex items-center gap-0.5 leading-none hover:opacity-70 transition-opacity ${
          actual ? "font-extrabold text-lg tracking-tight" : "font-bold text-sm"
        }`}
        style={{
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          color: actual ? "var(--accent)" : "var(--muted-foreground)",
        }}
      >
        {nombreActual}
        <ChevronDown
          size={actual ? 18 : 14}
          strokeWidth={2.5}
          style={{ transform: abierto ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
        />
      </button>

      {abierto && (
        <div
          className="absolute left-0 mt-2 z-50 min-w-[200px] rounded-xl overflow-hidden py-1"
          style={{ background: "var(--card)", border: "2px solid var(--foreground)", boxShadow: "4px 4px 0px 0px var(--foreground)" }}
        >
          {municipios.map((m) => (
            <Link
              key={m.slug}
              href={`/${m.slug}`}
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 text-sm font-bold hover:opacity-70"
              style={{ color: m.slug === actual ? "var(--accent)" : "var(--foreground)" }}
            >
              {m.nombre}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
