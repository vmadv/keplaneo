import { getLocale, getTranslations } from "next-intl/server";
import {
  Thermometer,
  Droplets,
  Wind,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";
import { obtenerTiempoDelDia, type SolicitudTiempo } from "@/lib/weather";

// Códigos WMO de Open-Meteo (weather_code) agrupados por el icono que mejor
// los representa — ver DESCRIPCIONES_POR_LOCALE en weather.ts para el texto.
function iconoParaCodigo(codigo: number): LucideIcon {
  if (codigo === 0) return Sun;
  if (codigo <= 2) return CloudSun;
  if (codigo === 3) return Cloud;
  if (codigo <= 48) return CloudFog;
  if (codigo <= 55) return CloudDrizzle;
  if (codigo <= 65) return CloudRain;
  if (codigo <= 75) return CloudSnow;
  if (codigo <= 82) return CloudRain;
  return CloudLightning;
}

export default async function TiempoDelDia({
  lat,
  lon,
  fecha,
  solicitud,
  titulo,
}: {
  lat: number | null;
  lon: number | null;
  fecha: string;
  solicitud: SolicitudTiempo;
  titulo: string;
}) {
  if (lat === null || lon === null) return null;

  const [locale, t] = await Promise.all([getLocale(), getTranslations("TiempoWidget")]);
  const tiempo = await obtenerTiempoDelDia(lat, lon, fecha, solicitud, locale);
  if (!tiempo) return null;

  const condicion = tiempo.descripcion.charAt(0).toUpperCase() + tiempo.descripcion.slice(1);

  const tarjetas =
    tiempo.tipo === "puntual"
      ? [
          { icono: Thermometer, color: "var(--secondary)", etiqueta: t("temperatura"), valor: `${tiempo.temperatura}°C`, nota: "" },
          { icono: iconoParaCodigo(tiempo.codigo), color: "var(--tertiary)", etiqueta: t("condicion"), valor: condicion, nota: "" },
          { icono: Droplets, color: "var(--quaternary)", etiqueta: t("humedad"), valor: `${tiempo.humedad}%`, nota: "" },
          { icono: Wind, color: "var(--accent)", etiqueta: t("viento"), valor: `${tiempo.viento} km/h`, nota: "" },
        ]
      : [
          { icono: Thermometer, color: "var(--secondary)", etiqueta: t("minima"), valor: `${tiempo.temperaturaMin}°C`, nota: tiempo.descripcion },
          { icono: Sun, color: "var(--tertiary)", etiqueta: t("maxima"), valor: `${tiempo.temperaturaMax}°C`, nota: "" },
          { icono: Droplets, color: "var(--quaternary)", etiqueta: t("humedad"), valor: `${tiempo.humedad}%`, nota: t("media") },
          { icono: Wind, color: "var(--accent)", etiqueta: t("viento"), valor: `${tiempo.viento} km/h`, nota: t("maximo") },
        ];

  return (
    <div className="card-sticker p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-extrabold">{titulo}</h2>
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Open-Meteo</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tarjetas.map((tarjeta) => (
          <div key={tarjeta.etiqueta} className="rounded-xl p-3" style={{ border: "2px solid var(--border)" }}>
            <span className="icon-chip w-8 h-8 mb-2" style={{ background: tarjeta.color }}>
              <tarjeta.icono size={15} strokeWidth={2.5} />
            </span>
            <div className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {tarjeta.etiqueta}
            </div>
            <div className="text-xl font-extrabold">{tarjeta.valor}</div>
            {tarjeta.nota && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{tarjeta.nota}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
