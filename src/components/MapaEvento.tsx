"use client";

import dynamic from "next/dynamic";

// Leaflet toca `window` al cargarse, así que no puede pasar por SSR ni
// siquiera como Client Component normal (Next igualmente pre-renderiza el
// HTML inicial). `ssr: false` solo se permite dentro de un Client
// Component, de ahí este wrapper.
const MapaEventoInterno = dynamic(() => import("./MapaEventoInterno"), {
  ssr: false,
  loading: () => <div className="mb-6 h-72 rounded-lg border bg-slate-50 animate-pulse" />,
});

export default function MapaEvento(props: {
  lat: number;
  lon: number;
  etiqueta: string;
  direccionTexto?: string;
}) {
  return <MapaEventoInterno {...props} />;
}
