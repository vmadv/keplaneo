"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { urlFotoProxy } from "@/lib/places";
import type { Momento } from "@/lib/types";

// Miniatura de tarjeta (PlanList/ListaEventos) con el mismo fallback que
// HeaderImagenEvento: algunos carteles reales fallan en el navegador por
// protección anti-hotlink (ej. Fundación Cajasol, 403 con Referer ajeno)
// aunque la URL exista — antes esto se resolvía con un <img> plano sin
// fallback y se veía roto en el listado. Cadena: cartel → foto del lugar →
// icono de día/noche.
export default function FotoTarjeta({
  cartelUrl,
  fotoLugarNombre,
  momento,
  alt,
}: {
  cartelUrl: string | null;
  fotoLugarNombre: string | null;
  momento: Momento;
  alt: string;
}) {
  const [cartelFallo, setCartelFallo] = useState(false);
  const [proxyFallo, setProxyFallo] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // El <img> ya se sirve en el HTML del servidor y puede fallar antes de
  // que React hidrate y conecte el onError — ver HeaderImagenEvento.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      if (img.dataset.rol === "cartel") setCartelFallo(true);
      else setProxyFallo(true);
    }
  }, []);

  const claseImg = "w-16 h-16 rounded-lg object-cover shrink-0";
  const estiloImg = { border: "2px solid var(--foreground)" };

  if (cartelUrl && !cartelFallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        data-rol="cartel"
        src={cartelUrl}
        alt={alt}
        className={claseImg}
        style={estiloImg}
        onError={() => setCartelFallo(true)}
      />
    );
  }

  if (fotoLugarNombre && !proxyFallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        data-rol="proxy"
        src={urlFotoProxy(fotoLugarNombre, 128)}
        alt={alt}
        className={claseImg}
        style={estiloImg}
        onError={() => setProxyFallo(true)}
      />
    );
  }

  return (
    <span
      className="icon-chip w-9 h-9 shrink-0"
      style={{ background: momento === "noche" ? "var(--foreground)" : "var(--tertiary)" }}
    >
      {momento === "noche" ? (
        <Moon size={16} strokeWidth={2.5} color="var(--background)" />
      ) : (
        <Sun size={16} strokeWidth={2.5} />
      )}
    </span>
  );
}
