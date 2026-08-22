import { obtenerTiempoDelDia } from "@/lib/weather";

function IconoTermometro() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0Z" />
    </svg>
  );
}

function IconoSol() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconoGota() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2.5s6 7.2 6 11.5a6 6 0 1 1-12 0c0-4.3 6-11.5 6-11.5Z" />
    </svg>
  );
}

function IconoViento() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h9" />
    </svg>
  );
}

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
    { icono: <IconoTermometro />, etiqueta: "Temperatura", valor: `${tiempo.temperatura}°C`, nota: tiempo.descripcion },
    { icono: <IconoSol />, etiqueta: "Sensación", valor: `${tiempo.sensacionTermica}°C`, nota: "térmica" },
    { icono: <IconoGota />, etiqueta: "Humedad", valor: `${tiempo.humedad}%`, nota: "" },
    { icono: <IconoViento />, etiqueta: "Viento", valor: `${tiempo.viento} km/h`, nota: "" },
  ];

  return (
    <div className="mb-6 border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">Qué tiempo hace ahora</h2>
        <span className="text-xs text-slate-400">Open-Meteo</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tarjetas.map((t) => (
          <div key={t.etiqueta} className="border rounded-lg p-3">
            <div className="text-slate-400 mb-2">{t.icono}</div>
            <div className="text-[0.7rem] uppercase tracking-wide text-slate-500">{t.etiqueta}</div>
            <div className="text-xl font-semibold">{t.valor}</div>
            {t.nota && <div className="text-xs text-slate-400">{t.nota}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
