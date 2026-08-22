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
  poblacion: number | null;
  prioridad: number;
  lat: number | null;
  lon: number | null;
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
  lat: number | null;
  lon: number | null;
  primera_deteccion: string;
  ultima_deteccion: string;
  activo: boolean;
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
