"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Pin propio en SVG en vez del icono por defecto de Leaflet — el default
// se rompe con bundlers como Webpack/Turbopack si no se reconfiguran las
// rutas de sus imágenes. Color acento del sistema de diseño (violeta).
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#8b5cf6" stroke="#1e293b" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="6" fill="white"/>
  </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

function formatearCoordenada(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const eo = lon >= 0 ? "E" : "O";
  return `${Math.abs(lat).toFixed(7)}° ${ns} · ${Math.abs(lon).toFixed(7)}° ${eo}`;
}

export default function MapaEventoInterno({
  lat,
  lon,
  etiqueta,
  direccionTexto,
}: {
  lat: number;
  lon: number;
  etiqueta: string;
  direccionTexto?: string;
}) {
  const hrefGoogle = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(direccionTexto ?? `${lat},${lon}`)}`;

  return (
    <div className="card-sticker p-3 mb-6">
      {direccionTexto && <p className="text-sm font-medium mb-2 px-1">{direccionTexto}</p>}

      <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--foreground)" }}>
        <MapContainer
          center={[lat, lon]}
          zoom={15}
          scrollWheelZoom={false}
          style={{ height: "18rem", width: "100%" }}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            subdomains="abc"
            maxZoom={19}
          />
          <Marker position={[lat, lon]} icon={pinIcon} title={etiqueta} />
        </MapContainer>
      </div>

      <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-3">
        <a href={hrefGoogle} rel="noopener noreferrer" className="btn-primary text-sm">
          Indicaciones para llegar →
        </a>
        <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
          {formatearCoordenada(lat, lon)}
        </span>
      </div>
    </div>
  );
}
