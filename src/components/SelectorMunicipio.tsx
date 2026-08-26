"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface MunicipioItem {
  slug: string;
  nombre: string;
}

// Pill "Sevilla ▾" junto al logo (mismo patrón que Time Out u otros sitios
// multi-ciudad): la navegación se queda centrada en el municipio actual,
// pero siempre hay una salida rápida para saltar a otro sin volver a portada.
export default function SelectorMunicipio({
  comunidadSlug,
  actual,
  municipios,
}: {
  comunidadSlug: string;
  actual: string;
  municipios: MunicipioItem[];
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nombreActual = municipios.find((m) => m.slug === actual)?.nombre ?? actual;

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
        className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1"
      >
        <MapPin size={13} strokeWidth={2.5} />
        {nombreActual}
        <ChevronDown
          size={14}
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
              href={`/${comunidadSlug}/${m.slug}`}
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
