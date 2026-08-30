"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { urlDeFoto } from "@/lib/places";
import type { FotoLugar } from "@/lib/types";

// Portada grande + cuadrícula de miniaturas, todas clicables — al abrir se
// bloquea el scroll de fondo y las flechas del teclado navegan entre fotos,
// como cualquier visor de imágenes al uso.
export default function GaleriaFotos({ fotos, nombre }: { fotos: FotoLugar[]; nombre: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    if (abierta === null) return;

    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowRight") setAbierta((i) => (i === null ? i : (i + 1) % fotos.length));
      if (e.key === "ArrowLeft") setAbierta((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length));
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [abierta, fotos.length]);

  if (fotos.length === 0) return null;

  const [portada, ...resto] = fotos;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(0)}
        className="block w-full overflow-hidden mt-4 mb-6 relative h-60 sm:h-80 rounded-2xl cursor-zoom-in"
        style={{ border: "2px solid var(--foreground)", boxShadow: "8px 8px 0px 0px var(--border)" }}
      >
        <Image
          src={urlDeFoto(portada, 1200)}
          alt={nombre}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </button>

      {resto.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-8">
          {resto.slice(0, 6).map((foto, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAbierta(i + 1)}
              className="relative aspect-square rounded-lg overflow-hidden cursor-zoom-in"
              style={{ border: "2px solid var(--foreground)" }}
            >
              <Image src={urlDeFoto(foto, 400)} alt={`${nombre} ${i + 2}`} fill sizes="200px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {abierta !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(30,41,59,0.92)" }}
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-modal="true"
          aria-label={nombre}
        >
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="icon-chip absolute top-4 right-4 w-10 h-10"
            style={{ background: "#fff", borderColor: "#fff" }}
            aria-label="Cerrar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierta((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length));
                }}
                className="icon-chip absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10"
                style={{ background: "#fff", borderColor: "#fff" }}
                aria-label="Anterior"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierta((i) => (i === null ? i : (i + 1) % fotos.length));
                }}
                className="icon-chip absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10"
                style={{ background: "#fff", borderColor: "#fff" }}
                aria-label="Siguiente"
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </button>
            </>
          )}

          <div className="relative w-full h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={urlDeFoto(fotos[abierta], 1600)}
              alt={`${nombre} ${abierta + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {fotos.length > 1 && (
            <span
              className="badge-pill absolute bottom-4 left-1/2 -translate-x-1/2"
              style={{ background: "#fff", color: "var(--foreground)", borderColor: "#fff" }}
            >
              {abierta + 1} / {fotos.length}
            </span>
          )}
        </div>
      )}
    </>
  );
}
