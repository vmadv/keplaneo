"use client";

import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";

// H1 de la home: "Keplaneo" fijo + una palabra que rota (en Sevilla / este
// finde / hoy / conciertos...) — ver conversación. Solo esta instancia lo
// usa, así que no lleva más props de las que hacen falta aquí.
export default function TituloHeroAnimado({
  estatico,
  rotativos,
  intervalo = 2500,
}: {
  estatico: string;
  rotativos: string[];
  intervalo?: number;
}) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndice((i) => (i + 1) % rotativos.length), intervalo);
    return () => clearInterval(timer);
  }, [rotativos.length, intervalo]);

  return (
    <LazyMotion features={domAnimation}>
      <h1 className="flex flex-wrap items-baseline gap-x-3 text-5xl font-extrabold mb-3 text-balance">
        <span>{estatico}</span>
        <AnimatePresence mode="wait">
          <m.span
            key={rotativos[indice]}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="text-accent"
          >
            {rotativos[indice]}
          </m.span>
        </AnimatePresence>
      </h1>
    </LazyMotion>
  );
}
