// Nominatim (OpenStreetMap) — gratis, sin API key, pero su política de uso
// exige como máximo 1 petición/segundo. Un cron que geocodifica varios
// eventos nuevos seguidos puede disparar muchas llamadas en pocos segundos,
// así que espaciamos cada llamada respecto a la anterior dentro del mismo
// proceso. Solo se llama desde los route handlers de cron, nunca desde una
// página.
let ultimaLlamada = 0;

async function respetarLimiteDeUso() {
  const espera = ultimaLlamada + 1100 - Date.now();
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
  ultimaLlamada = Date.now();
}

export async function geocodificar(
  direccion: string
): Promise<{ lat: number; lon: number } | null> {
  await respetarLimiteDeUso();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccion)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PlanesEspana/0.1 (proyecto personal, sin dominio aun)" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const resultado = data?.[0];
    if (!resultado) return null;

    return { lat: parseFloat(resultado.lat), lon: parseFloat(resultado.lon) };
  } catch {
    // Un fallo de red al geocodificar no debe tumbar la generación del día:
    // el evento simplemente se queda sin mapa hasta el próximo intento.
    return null;
  }
}
