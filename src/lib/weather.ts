// Open-Meteo — gratis, sin API key ni cuenta, hasta 10.000 llamadas/día.

const DESCRIPCIONES_POR_LOCALE: Record<string, Record<number, string>> = {
  es: {
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
  },
  en: {
    0: "clear sky",
    1: "mostly clear",
    2: "partly cloudy",
    3: "cloudy",
    45: "foggy",
    48: "foggy with frost",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "showers",
    81: "heavy showers",
    82: "very heavy showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "severe thunderstorm with hail",
  },
};

export interface TiempoPuntual {
  tipo: "puntual";
  temperatura: number;
  sensacionTermica: number;
  humedad: number;
  viento: number;
  descripcion: string;
}

export interface TiempoRango {
  tipo: "rango";
  temperaturaMin: number;
  temperaturaMax: number;
  humedad: number;
  viento: number;
  descripcion: string;
}

export type TiempoDelDia = TiempoPuntual | TiempoRango;

// Cuándo pedir el tiempo: a una hora exacta (cuando el evento tiene un
// horario conocido, ej. "22:00h") o como mínima/máxima a lo largo de un
// tramo aproximado (cuando solo sabemos que es "de día" o "de noche", sin
// hora concreta — ej. "Horario habitual del museo").
export type SolicitudTiempo =
  | { tipo: "hora"; hora: number }
  | { tipo: "rango"; horaInicio: number; horaFin: number };

function codigoMasFrecuente(codigos: number[]): number {
  const conteo = new Map<number, number>();
  for (const c of codigos) conteo.set(c, (conteo.get(c) ?? 0) + 1);
  let mejorCodigo = codigos[0];
  let mejorCuenta = 0;
  for (const [codigo, cuenta] of conteo) {
    if (cuenta > mejorCuenta) {
      mejorCuenta = cuenta;
      mejorCodigo = codigo;
    }
  }
  return mejorCodigo;
}

// Pronóstico para un día concreto (no el tiempo "de ahora"): un evento de
// hoy necesita el tiempo de hoy, uno de este fin de semana necesita el del
// sábado o domingo — no el de este preciso instante, que puede ser horas o
// días antes de que el plan ocurra. Se pide el bloque "hourly" anclado a
// start_date/end_date=fechaISO; con hora exacta se toma ese punto, con rango
// se agregan (min/max/promedio) las horas del tramo.
export async function obtenerTiempoDelDia(
  lat: number,
  lon: number,
  fechaISO: string,
  solicitud: SolicitudTiempo,
  locale: string = "es"
): Promise<TiempoDelDia | null> {
  const descripciones = DESCRIPCIONES_POR_LOCALE[locale] ?? DESCRIPCIONES_POR_LOCALE.es;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&start_date=${fechaISO}&end_date=${fechaISO}&timezone=auto`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const horas: string[] = data?.hourly?.time ?? [];
    if (horas.length === 0) return null;

    if (solicitud.tipo === "hora") {
      const horaBuscada = `${fechaISO}T${String(solicitud.hora).padStart(2, "0")}:00`;
      const indice = horas.indexOf(horaBuscada);
      const i = indice === -1 ? Math.floor(horas.length / 2) : indice;

      const temperatura = data.hourly.temperature_2m?.[i];
      if (typeof temperatura !== "number") return null;

      return {
        tipo: "puntual",
        temperatura: Math.round(temperatura),
        sensacionTermica: Math.round(data.hourly.apparent_temperature[i]),
        humedad: Math.round(data.hourly.relative_humidity_2m[i]),
        viento: Math.round(data.hourly.wind_speed_10m[i]),
        descripcion: descripciones[data.hourly.weather_code[i]] ?? "",
      };
    }

    const indices = horas
      .map((h, i) => i)
      .filter((i) => {
        const hora = Number(horas[i].slice(11, 13));
        return hora >= solicitud.horaInicio && hora <= solicitud.horaFin;
      });
    if (indices.length === 0) return null;

    const temperaturas = indices.map((i) => data.hourly.temperature_2m[i]);
    if (temperaturas.some((v: unknown) => typeof v !== "number")) return null;

    const humedades = indices.map((i) => data.hourly.relative_humidity_2m[i]);
    const vientos = indices.map((i) => data.hourly.wind_speed_10m[i]);
    const codigos = indices.map((i) => data.hourly.weather_code[i]);

    return {
      tipo: "rango",
      temperaturaMin: Math.round(Math.min(...temperaturas)),
      temperaturaMax: Math.round(Math.max(...temperaturas)),
      humedad: Math.round(humedades.reduce((a: number, b: number) => a + b, 0) / humedades.length),
      viento: Math.round(Math.max(...vientos)),
      descripcion: descripciones[codigoMasFrecuente(codigos)] ?? "",
    };
  } catch {
    return null;
  }
}
