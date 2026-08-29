export type Audiencia = "pareja" | "familia" | "generico";
export type Momento = "dia" | "noche";
export type TipoPlan = "excepcional" | "generico";

export interface Comunidad {
  id: string;
  slug: string;
  nombre: string;
}

export interface Municipio {
  id: string;
  comunidad_id: string;
  slug: string;
  nombre: string;
  provincia: string | null;
  // Opcional (no todas las consultas de Municipio la piden) para no
  // arrastrar la dependencia de la migración 0014 a cada sitio que ya
  // consulta municipios — ver getMunicipioConProvincia en queries.ts.
  provincia_id?: string | null;
  poblacion: number | null;
  prioridad: number;
  lat: number | null;
  lon: number | null;
}

// Entidad real de provincia (rankings/espana/{ccaa}/{provincia}/...) — no
// confundir con el campo de texto suelto `Municipio.provincia`.
export interface Provincia {
  id: string;
  comunidad_id: string;
  slug: string;
  nombre: string;
}

export interface Plan {
  id: string;
  municipio_id: string;
  fecha_generacion: string;
  titulo: string;
  descripcion: string;
  momento: Momento;
  vigencia: string[];
  audiencia: Audiencia[];
  tipo: TipoPlan;
  evento_id: string | null;
  evento_slug?: string | null;
  evento_fecha_inicio?: string | null;
  evento_fecha_fin?: string | null;
  evento_categoria?: Categoria | null;
  enlace_afiliado: string | null;
  fuente: string | null;
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

// Evento puntual con página propia y URL estable (ver src/lib/eventos.ts).
export interface Evento {
  id: string;
  municipio_id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  momento: Momento;
  audiencia: Audiencia[];
  ubicacion: string | null;
  horario: string | null;
  precio: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fuente: string | null;
  preguntas_frecuentes: PreguntaFrecuente[];
  categoria: Categoria | null;
  // 1-10, asignada por Gemini al generar/actualizar el plan — null en
  // eventos que no se han regenerado desde que existe este campo (ver
  // migración 0015). Ordena los listados largos por interés real.
  relevancia: number | null;
  lat: number | null;
  lon: number | null;
  primera_deteccion: string;
  ultima_deteccion: string;
  activo: boolean;
}

// Temáticas por las que se puede navegar además de fecha/audiencia/precio.
// El valor de la categoría ES el slug de la URL (/sevilla/conciertos) para
// no necesitar una tabla de conversión aparte — pero eso solo aplica a las
// cuatro primeras (esCategoriaConPagina), que tienen página propia.
// Deporte/ferias/fiestas son solo para la etiqueta visual en las tarjetas
// (badge de "de qué trata"), sin página de categoría propia todavía. El
// resto de planes (parques, rutas, gastronomía, monumentos genéricos) se
// quedan en "otros", que no se etiqueta en las tarjetas por no aportar
// información.
export const CATEGORIAS = [
  "conciertos",
  "exposiciones",
  "teatro",
  "monologos",
  "deporte",
  "ferias",
  "fiestas",
  "cine",
  "otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  conciertos: "Conciertos",
  exposiciones: "Exposiciones",
  teatro: "Teatro",
  monologos: "Monólogos",
  deporte: "Deporte",
  ferias: "Ferias",
  fiestas: "Fiestas",
  cine: "Cine",
  otros: "Otros planes",
};

export const CATEGORIAS_CON_PAGINA = ["conciertos", "exposiciones", "teatro", "monologos"] as const;

export function esCategoriaConPagina(
  slug: string
): slug is Exclude<Categoria, "otros" | "deporte" | "ferias" | "fiestas" | "cine"> {
  return (CATEGORIAS_CON_PAGINA as readonly string[]).includes(slug);
}

// "Listados" (rankings tipo premio) — sección totalmente aparte de
// eventos/planes. Ver src/lib/places.ts para cómo se rellenan desde
// Google Places.
export interface FotoLugar {
  nombre?: string; // "name" del recurso de Google Places, para pedir la imagen vía /api/fotos
  url?: string; // foto propia subida por el negocio a Supabase Storage — ver src/lib/places.ts::urlDeFoto
  ancho: number;
  alto: number;
}

export interface HorarioLugar {
  dia: string;
  horas: string;
}

export interface Lugar {
  id: string;
  municipio_id: string;
  google_place_id: string;
  tipo: string;
  nombre: string;
  slug: string;
  direccion: string | null;
  lat: number | null;
  lon: number | null;
  rating: number | null;
  num_valoraciones: number | null;
  nivel_precio: string | null;
  telefono: string | null;
  web: string | null;
  horario: HorarioLugar[];
  fotos: FotoLugar[];
  descripcion: string | null;
  instagram: string | null;
  facebook: string | null;
  enlace_reserva: string | null;
  lema: string | null;
  gestionado_por_negocio: boolean;
  ultima_actualizacion: string;
  activo: boolean;
}

export interface Listado {
  id: string;
  municipio_id: string;
  tipo_lugar: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  preguntas_frecuentes: PreguntaFrecuente[];
  actualizado_en: string;
}

// Un puesto del ranking: el lugar + su posición y el motivo (redactado por
// Gemini) de por qué está en ESTE listado en concreto.
export interface PuestoListado {
  lugar: Lugar;
  posicion: number;
  motivo: string | null;
}

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export type MesSlug = (typeof MESES)[number];
