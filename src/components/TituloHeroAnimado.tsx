"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";

export interface RotativoHero {
  texto: string;
  // Nodo ya renderizado (ej. <MapPin size={34} />), no el componente en
  // sí: un componente de icono es una función, y una función no se puede
  // pasar de un Server Component a uno de cliente como esta pieza — el
  // padre (page.tsx, servidor) tiene que renderizarlo antes de pasarlo.
  icono: ReactNode;
  fondo: string;
  colorTexto: string;
}

// H1 de la home: "Keplaneo" fijo + una palabra que rota (en Sevilla / este
// finde / hoy / conciertos...) dentro de un "sticker" propio — mismo
// lenguaje visual que el resto del sitio (borde grueso + sombra dura, como
// .card-sticker/.btn-primary) en vez del texto suelto de antes, con icono
// y color de fondo distintos por palabra para que el cambio se note más y
// sin el círculo decorativo que había detrás (ver conversación). Solo esta
// instancia lo usa, así que no lleva más props de las que hacen falta aquí.
export default function TituloHeroAnimado({
  estatico,
  rotativos,
  intervalo = 2500,
}: {
  estatico: string;
  rotativos: RotativoHero[];
  intervalo?: number;
}) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndice((i) => (i + 1) % rotativos.length), intervalo);
    return () => clearInterval(timer);
  }, [rotativos.length, intervalo]);

  const actual = rotativos[indice];

  return (
    <LazyMotion features={domAnimation}>
      <h1 className="flex flex-wrap items-center gap-x-4 gap-y-3 text-5xl font-extrabold mb-3 text-balance">
        <span>{estatico}</span>
        <AnimatePresence mode="wait">
          <m.span
            key={actual.texto}
            initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: -2 }}
            exit={{ opacity: 0, scale: 0.85, rotate: 4 }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-1"
            style={{
              background: actual.fondo,
              color: actual.colorTexto,
              border: "3px solid var(--foreground)",
              boxShadow: "6px 6px 0px 0px var(--foreground)",
            }}
          >
            {actual.icono}
            {actual.texto}
          </m.span>
        </AnimatePresence>
      </h1>
    </LazyMotion>
  );
}
