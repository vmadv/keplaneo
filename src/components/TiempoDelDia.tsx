import { Thermometer, Sun, Droplets, Wind } from "lucide-react";
import { obtenerTiempoDelDia } from "@/lib/weather";

export default async function TiempoDelDia({
  lat,
  lon,
}: {
  lat: number | null;
  lon: number | null;
}) {
  if (lat === null || lon === null) return null;

  const tiempo = await obtenerTiempoDelDia(lat, lon);
  if (!tiempo) return null;

  const tarjetas = [
    { icono: Thermometer, color: "var(--secondary)", etiqueta: "Temperatura", valor: `${tiempo.temperatura}°C`, nota: tiempo.descripcion },
    { icono: Sun, color: "var(--tertiary)", etiqueta: "Sensación", valor: `${tiempo.sensacionTermica}°C`, nota: "térmica" },
    { icono: Droplets, color: "var(--quaternary)", etiqueta: "Humedad", valor: `${tiempo.humedad}%`, nota: "" },
    { icono: Wind, color: "var(--accent)", etiqueta: "Viento", valor: `${tiempo.viento} km/h`, nota: "" },
  ];

  return (
    <div className="card-sticker p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-extrabold">Qué tiempo hace ahora</h2>
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Open-Meteo</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className="rounded-xl p-3" style={{ border: "2px solid var(--border)" }}>
            <span className="icon-chip w-8 h-8 mb-2" style={{ background: t.color }}>
              <t.icono size={15} strokeWidth={2.5} />
            </span>
            <div className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {t.etiqueta}
            </div>
            <div className="text-xl font-extrabold">{t.valor}</div>
            {t.nota && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t.nota}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
