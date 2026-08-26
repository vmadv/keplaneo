import type { FotoLugar, HorarioLugar } from "./types";

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CAMPOS_BUSQUEDA = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.regularOpeningHours",
  "places.photos",
].join(",");

export interface CandidatoLugar {
  googlePlaceId: string;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lon: number | null;
  rating: number | null;
  numValoraciones: number | null;
  nivelPrecio: string | null;
  telefono: string | null;
  web: string | null;
  horario: HorarioLugar[];
  fotos: FotoLugar[];
}

interface RespuestaPlaceTextSearch {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
  }>;
}

// Un único Text Search con el field mask ampliado trae ya todo lo que
// necesitamos (rating, reseñas, horario, fotos...) sin tener que hacer una
// llamada de Place Details aparte por cada candidato — más barato y más
// simple. Google interpreta bien consultas en lenguaje natural del tipo
// "mejores restaurantes de croquetas en Sevilla", no hace falta trocearla.
export async function buscarLugares(consulta: string): Promise<CandidatoLugar[]> {
  if (!PLACES_API_KEY) throw new Error("Falta GOOGLE_PLACES_API_KEY");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_API_KEY,
      "X-Goog-FieldMask": CAMPOS_BUSQUEDA,
    },
    body: JSON.stringify({ textQuery: consulta, languageCode: "es" }),
  });

  if (!res.ok) {
    throw new Error(`Places API error ${res.status}: ${await res.text()}`);
  }

  const data: RespuestaPlaceTextSearch = await res.json();

  return (data.places ?? []).map((p) => ({
    googlePlaceId: p.id,
    nombre: p.displayName?.text ?? "",
    direccion: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    rating: p.rating ?? null,
    numValoraciones: p.userRatingCount ?? null,
    nivelPrecio: p.priceLevel ?? null,
    telefono: p.nationalPhoneNumber ?? null,
    web: p.websiteUri ?? null,
    horario: (p.regularOpeningHours?.weekdayDescriptions ?? []).map((texto) => {
      const [dia, ...resto] = texto.split(": ");
      return { dia, horas: resto.join(": ") || texto };
    }),
    fotos: (p.photos ?? []).slice(0, 6).map((f) => ({
      nombre: f.name,
      ancho: f.widthPx ?? 800,
      alto: f.heightPx ?? 600,
    })),
  }));
}

// Puntuación tipo "premios": rating puro favorece injustamente a sitios con
// una sola reseña de 5 estrellas frente a uno con 4.6 y 2.000 reseñas. El
// logaritmo del número de reseñas amortigua eso sin dejar que un local con
// miles de reseñas mediocres arrase a uno pequeño pero muy bien valorado.
// Umbral mínimo (rating y nº de reseñas) para no meter en el ranking un
// sitio con muy poca señal real.
// Válido para categorías de consumo con volumen real de reseñas
// (restaurantes, hoteles, peluquerías...). No vale para todas: colegios
// públicos/institutos casi nunca tienen rating en Google Maps (la gente no
// puntúa un instituto como puntúa un restaurante), así que aplicarles este
// mismo mínimo los descarta a todos aunque sean reales y reconocidos — ver
// UMBRAL_SIN_RATING más abajo para esos casos.
export const RATING_MINIMO = 4.0;
export const RESENAS_MINIMAS = 15;

export interface UmbralCalidad {
  ratingMinimo: number;
  resenasMinimas: number;
}

export const UMBRAL_POR_DEFECTO: UmbralCalidad = { ratingMinimo: RATING_MINIMO, resenasMinimas: RESENAS_MINIMAS };

// Para categorías donde el propio Google Maps casi nunca acumula reseñas
// (colegios públicos, institutos, guarderías...): aquí Places solo sirve
// para VERIFICAR que el sitio existe de verdad y traer dirección/fotos —
// la fama real, que es el criterio que importa, ya la decidió Gemini. Sin
// mínimo de calidad: un instituto real con rating null no es un dato
// falso, es que nadie lo puntúa en Maps.
export const UMBRAL_SIN_RATING: UmbralCalidad = { ratingMinimo: 0, resenasMinimas: 0 };

// Categorías cuya "fama" no se refleja de forma fiable en el rating de
// Google Maps — se detecta por `tipoLugar` para no tener que acordarse de
// pasar el umbral correcto en cada llamada. Amplía esta lista según se
// vayan probando categorías nuevas y se vea que su rating en Maps tampoco
// es representativo (ver el diagnóstico real hecho con institutos: casi
// todos con rating null).
const TIPOS_SIN_RATING_FIABLE = new Set(["colegio", "instituto", "guarderia", "universidad"]);

export function umbralParaTipo(tipoLugar: string): UmbralCalidad {
  return TIPOS_SIN_RATING_FIABLE.has(tipoLugar) ? UMBRAL_SIN_RATING : UMBRAL_POR_DEFECTO;
}

// Para que la página del listado explique la metodología real que se
// aplicó (con o sin mínimo de nota) sin tener que guardar el umbral en la
// base de datos — se deriva del mismo `tipo_lugar` que ya se guarda.
export function tieneRatingFiable(tipoLugar: string): boolean {
  return !TIPOS_SIN_RATING_FIABLE.has(tipoLugar);
}

export function puntuarLugar(
  rating: number | null,
  numValoraciones: number | null,
  umbral: UmbralCalidad = UMBRAL_POR_DEFECTO
): number {
  if (rating === null || numValoraciones === null) {
    return umbral.resenasMinimas === 0 ? 0 : -Infinity;
  }
  if (rating < umbral.ratingMinimo || numValoraciones < umbral.resenasMinimas) return -Infinity;
  return rating * Math.log10(numValoraciones + 1);
}

// Palabras que no distinguen un sitio de otro (conectores, genéricos de
// categoría, sufijos de razón social) y que Gemini y Google Maps no
// siempre incluyen por igual — ej. Gemini propone "Hospital San Juan de
// Dios Sevilla" y Maps lo tiene como "...de Dios de Sevilla (Nervión)": el
// "de" y el "Nervión" de más no deberían bastar para decir que son sitios
// distintos.
const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "y",
  "clinica", "clinicas", "centro", "hospital", "consulta", "consultas",
  "doctor", "doctora", "dr", "dra", "sl", "slu", "sa", "sau",
]);

// Comprueba que el resultado de Places es de verdad el sitio que se buscaba
// por nombre y no otro negocio que Google haya devuelto primero — comparando
// sin acentos/mayúsculas/símbolos/palabras de relleno, y sin el nombre del
// propio municipio (que casi siempre aparece en un lado y no en el otro).
function normalizarNombre(s: string, municipioNombre: string): string {
  const limpiar = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const municipioNorm = limpiar(municipioNombre).replace(/[^a-z0-9]/g, "");

  return limpiar(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0 && palabra !== municipioNorm && !PALABRAS_VACIAS.has(palabra))
    .join("");
}

function esMismoLugar(nombreBuscado: string, nombreEncontrado: string, municipioNombre: string): boolean {
  const a = normalizarNombre(nombreBuscado, municipioNombre);
  const b = normalizarNombre(nombreEncontrado, municipioNombre);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

// Busca un candidato concreto por nombre (propuesto por Gemini como "famoso
// para X") y lo verifica contra Google Places: debe existir de verdad, ser
// razonablemente el mismo sitio (no el primer resultado que caiga) y cumplir
// el mínimo de calidad. Null si no se puede verificar.
// Cada llamada a buscarLugares() con estos campos (rating incluido) cae en
// el SKU "Enterprise" de Places ($35/1000) — pedir uno por candidato sale
// caro cuando Gemini propone 15-20 nombres. Úsala directamente solo como
// repesca puntual; para el caso general usa resolverCandidatos.
export async function verificarLugarPorNombre(
  nombre: string,
  municipioNombre: string,
  umbral: UmbralCalidad = UMBRAL_POR_DEFECTO
): Promise<CandidatoLugar | null> {
  const resultados = await buscarLugares(`${nombre}, ${municipioNombre}, España`);
  const encontrado = resultados.find(
    (r) => esMismoLugar(nombre, r.nombre, municipioNombre) && puntuarLugar(r.rating, r.numValoraciones, umbral) !== -Infinity
  );
  return encontrado ?? null;
}

// Resuelve TODA la lista de nombres que propone Gemini con, en el caso
// normal, UNA sola llamada a Places en vez de una por nombre: una búsqueda
// amplia de la categoría (ej. "restaurantes en Sevilla") ya trae hasta 20
// sitios reales por el precio de una sola petición Enterprise, y la
// mayoría de los candidatos de Gemini —si de verdad son conocidos— caen
// dentro de ese primer lote. Solo se hace una llamada individual de
// repesca (verificarLugarPorNombre) para los que de verdad no aparezcan
// ahí, típicamente sitios pequeños o muy de nicho. Conserva el orden de
// fama de `nombresGemini`, no el de la búsqueda amplia.
export interface ResolucionCandidatos {
  candidatos: CandidatoLugar[];
  // Nº real de llamadas Enterprise a Places hechas (1 por la búsqueda
  // amplia + 1 por cada repesca individual) — para poder reportar el coste
  // real de generar un listado, no solo asumirlo.
  llamadasPlaces: number;
}

export async function resolverCandidatos(
  nombresGemini: string[],
  consultaAmplia: string,
  municipioNombre: string,
  limite: number,
  umbral: UmbralCalidad = UMBRAL_POR_DEFECTO
): Promise<ResolucionCandidatos> {
  const pool = await buscarLugares(consultaAmplia);
  let llamadasPlaces = 1;
  const usados = new Set<string>();
  const candidatos: CandidatoLugar[] = [];

  for (const nombre of nombresGemini) {
    if (candidatos.length >= limite) break;

    const enPool = pool.find(
      (p) =>
        !usados.has(p.googlePlaceId) &&
        esMismoLugar(nombre, p.nombre, municipioNombre) &&
        puntuarLugar(p.rating, p.numValoraciones, umbral) !== -Infinity
    );

    let encontrado = enPool;
    if (!encontrado) {
      llamadasPlaces++;
      encontrado = (await verificarLugarPorNombre(nombre, municipioNombre, umbral)) ?? undefined;
    }

    if (encontrado && !usados.has(encontrado.googlePlaceId)) {
      usados.add(encontrado.googlePlaceId);
      candidatos.push(encontrado);
    }
  }

  return { candidatos, llamadasPlaces };
}

// URL de la foto de un lugar servida a través de nuestro propio proxy
// (/api/fotos/[...ref]) — nunca se expone la API key al navegador.
export function urlFotoProxy(nombreFoto: string, anchoMax: number = 800): string {
  return `/api/fotos/${nombreFoto}?w=${anchoMax}`;
}

// Una foto puede venir de Google Places (nombre + proxy) o haberla subido
// el propio negocio a Supabase Storage (url directa) — este helper resume
// ambos casos para que los componentes no tengan que saber la diferencia.
export function urlDeFoto(foto: FotoLugar, anchoMax: number = 800): string {
  if (foto.url) return foto.url;
  if (foto.nombre) return urlFotoProxy(foto.nombre, anchoMax);
  throw new Error("FotoLugar sin url ni nombre");
}

// El campo de reserva del negocio admite un enlace o un teléfono suelto —
// aquí se decide cuál de los dos es para construir el href correcto.
export function hrefReserva(valor: string): string {
  if (/^https?:\/\//i.test(valor)) return valor;
  return `tel:${valor.replace(/[^+\d]/g, "")}`;
}

// Construye la URL real de Google (server-side, con la key) para el proxy.
export function urlFotoGoogle(nombreFoto: string, anchoMax: number = 800): string {
  return `https://places.googleapis.com/v1/${nombreFoto}/media?maxWidthPx=${anchoMax}&key=${PLACES_API_KEY}`;
}
