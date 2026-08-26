"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import TarjetaCiudad from "./TarjetaCiudad";

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];
const VISIBLES_INICIAL = 6;

interface MunicipioItem {
  id: string;
  slug: string;
  nombre: string;
  imagen: string | null;
}

// 9 ciudades (y subiendo) hacen la portada muy larga de golpe — se
// muestran solo las VISIBLES_INICIAL primeras (ya vienen ordenadas por
// prioridad/población) y el resto queda plegado tras "Ver más ciudades".
export default function ListaCiudadesHome({
  municipios,
  textoVerMas,
  textoVerMenos,
}: {
  municipios: MunicipioItem[];
  textoVerMas: string;
  textoVerMenos: string;
}) {
  const [expandido, setExpandido] = useState(false);
  const hayOcultas = municipios.length > VISIBLES_INICIAL;
  const visibles = expandido ? municipios : municipios.slice(0, VISIBLES_INICIAL);

  return (
    <>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibles.map((m, i) => (
          <li key={m.id}>
            <TarjetaCiudad
              nombre={m.nombre}
              href={`/${m.slug}`}
              color={COLORES[i % COLORES.length]}
              imagen={m.imagen}
            />
          </li>
        ))}
      </ul>

      {hayOcultas && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="btn-secondary text-sm px-4 py-2 mt-5"
        >
          {expandido ? textoVerMenos : textoVerMas}
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            style={{ transform: expandido ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
          />
        </button>
      )}
    </>
  );
}
