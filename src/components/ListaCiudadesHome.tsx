"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import TarjetaCiudad from "./TarjetaCiudad";

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];
const VISIBLES_INICIAL = 6;
// En mobile (una sola columna) 6 tarjetas de golpe es mucho scroll antes
// de llegar al resto de la home — se enseñan solo 4 y el resto queda tras
// "Ver más" igual que en desktop (ver conversación). Es una clase CSS por
// tarjeta (max-sm:hidden), no un valor distinto de VISIBLES_INICIAL: así
// el HTML que manda el servidor es el mismo en cualquier dispositivo, sin
// depender de detectar el viewport para decidir qué renderizar.
const VISIBLES_MOBILE = 4;

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
  const hayOcultas = municipios.length > VISIBLES_MOBILE;
  const visibles = expandido ? municipios : municipios.slice(0, VISIBLES_INICIAL);

  return (
    <>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibles.map((m, i) => (
          <li key={m.id} className={!expandido && i >= VISIBLES_MOBILE ? "max-sm:hidden" : undefined}>
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
