// Open-Meteo — gratis, sin API key ni cuenta, hasta 10.000 llamadas/día.

const DESCRIPCIONES: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "con niebla",
  48: "con niebla escarchada",
  51: "con llovizna ligera",
  53: "con llovizna",
  55: "con llovizna intensa",
  61: "con lluvia ligera",
  63: "con lluvia",
  65: "con lluvia intensa",
  71: "con nieve ligera",
  73: "con nieve",
  75: "con nieve intensa",
  80: "con chubascos",
  81: "con chubascos intensos",
  82: "con chubascos muy intensos",
  95: "con tormenta",
  96: "con tormenta y granizo",
  99: "con tormenta fuerte y granizo",
};

export interface TiempoDelDia {
  temperatura: number;
  sensacionTermica: number;
  humedad: number;
  viento: number;
  descripcion: string;
}

export async function obtenerTiempoDelDia(
  lat: number,
  lon: number
): Promise<TiempoDelDia | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const actual = data?.current;
    if (typeof actual?.temperature_2m !== "number") return null;

    return {
      temperatura: Math.round(actual.temperature_2m),
      sensacionTermica: Math.round(actual.apparent_temperature),
      humedad: Math.round(actual.relative_humidity_2m),
      viento: Math.round(actual.wind_speed_10m),
      descripcion: DESCRIPCIONES[actual.weather_code] ?? "",
    };
  } catch {
    return null;
  }
}
