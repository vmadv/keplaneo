// Embed de OpenStreetMap: gratis, sin API key. El enlace a Google Maps es
// solo una URL de búsqueda (sin API ni key), útil para navegar de verdad.
export default function Mapa({
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
  const delta = 0.01;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join("%2C");
  const srcOsm = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat}%2C${lon}`;
  const hrefOsm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  const hrefGoogle = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionTexto ?? `${lat},${lon}`)}`;

  return (
    <div>
      <iframe
        title={`Mapa de ${etiqueta}`}
        src={srcOsm}
        className="w-full h-64 rounded-xl"
        style={{ border: "2px solid var(--foreground)" }}
        loading="lazy"
      />
      <div className="flex gap-4 text-xs font-medium mt-2 px-1" style={{ color: "var(--muted-foreground)" }}>
        <a href={hrefOsm} className="hover:underline" rel="noopener noreferrer">
          Ver mapa más grande
        </a>
        <a href={hrefGoogle} className="hover:underline" rel="noopener noreferrer">
          Abrir en Google Maps
        </a>
      </div>
    </div>
  );
}
