"use client";

import { useEffect, useRef, useState } from "react";
import { urlFotoProxy } from "@/lib/places";

// Algunos carteles reales vienen de webs con protección anti-hotlink por
// Referer (ej. la Fundación Cajasol devuelve 403 si el Referer no es el
// suyo) — la URL responde bien probada directamente (curl sin Referer),
// pero falla en cualquier navegador real, así que no basta con confiar en
// que el cartel "existe": hace falta un fallback en cliente a la foto del
// lugar cuando la carga de verdad falla (ver conversación).
export default function HeaderImagenEvento({
  cartelUrl,
  fotoLugarNombre,
  ubicacion,
  titulo,
  textoFotoUbicacion,
}: {
  cartelUrl: string | null;
  fotoLugarNombre: string | null;
  ubicacion: string | null;
  titulo: string;
  textoFotoUbicacion: string;
}) {
  const [cartelFallo, setCartelFallo] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // El <img> del cartel se sirve ya en el HTML del servidor y el navegador
  // empieza a cargarlo (y puede fallar) antes de que React hidrate y
  // conecte el onError — ese fallo se perdía en silencio. Al montar,
  // "complete && naturalWidth === 0" detecta un fallo que ya ocurrió antes
  // de que hubiera nadie escuchando.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setCartelFallo(true);
  }, []);

  if (cartelUrl && !cartelFallo) {
    return (
      // Cartel real y verificado (poco frecuente, solo destacados) — se
      // muestra tal cual, sin leyenda: es del evento en sí.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={cartelUrl}
        alt={titulo}
        className="w-full rounded-2xl mb-2 object-cover max-h-96"
        style={{ border: "2px solid var(--foreground)", boxShadow: "6px 6px 0px 0px var(--border)" }}
        onError={() => setCartelFallo(true)}
      />
    );
  }

  if (fotoLugarNombre && ubicacion) {
    return (
      <div className="mb-6">
        {/* Foto del lugar (Google Places), no del evento en sí — la
            leyenda lo deja claro para que nadie la confunda con un
            cartel, ver conversación. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urlFotoProxy(fotoLugarNombre, 800)}
          alt={ubicacion}
          className="w-full rounded-2xl mb-2 object-cover max-h-96"
          style={{ border: "2px solid var(--foreground)", boxShadow: "6px 6px 0px 0px var(--border)" }}
        />
        <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
          {textoFotoUbicacion}
        </p>
      </div>
    );
  }

  return null;
}
