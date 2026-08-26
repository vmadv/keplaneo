// Agrupación editorial de los listados por sección (Restaurantes, Salud...)
// para el índice de /rankings/{comunidad}/{municipio} — vive aparte de
// `tipo_lugar` (que es libre,
// pensado para guardar/filtrar por categoría concreta) porque una sección
// agrupa varios tipos ("salud" cubre dentista, dermatólogo, otorrino...).
export type SeccionListado =
  | "restaurantes"
  | "alojamiento"
  | "salud"
  | "educacion"
  | "bellezaBienestar"
  | "ocio"
  | "servicios"
  | "otros";

const SECCION_POR_TIPO: Record<string, SeccionListado> = {
  restaurante: "restaurantes",
  hotel: "alojamiento",
  dermatologo: "salud",
  otorrino: "salud",
  dentista: "salud",
  fisioterapeuta: "salud",
  optica: "salud",
  colegio: "educacion",
  guarderia: "educacion",
  instituto: "educacion",
  universidad: "educacion",
  peluqueria: "bellezaBienestar",
  yoga: "bellezaBienestar",
  gimnasio: "bellezaBienestar",
  discoteca: "ocio",
  inmobiliaria: "servicios",
  autoescuela: "servicios",
  sastreria: "servicios",
  desguace: "servicios",
};

// Orden fijo de aparición en el índice — "otros" siempre al final, como
// cajón de sastre para tipos nuevos que aún no se hayan clasificado aquí.
export const ORDEN_SECCIONES: SeccionListado[] = [
  "restaurantes",
  "alojamiento",
  "salud",
  "educacion",
  "bellezaBienestar",
  "ocio",
  "servicios",
  "otros",
];

export function seccionDeTipoLugar(tipoLugar: string): SeccionListado {
  return SECCION_POR_TIPO[tipoLugar] ?? "otros";
}

// Slug de URL para /rankings/{comunidad}/{municipio}/seccion/[seccion] — en kebab-case aunque la
// clave interna esté en camelCase (bellezaBienestar -> belleza-bienestar).
const SLUG_POR_SECCION: Record<SeccionListado, string> = {
  restaurantes: "restaurantes",
  alojamiento: "alojamiento",
  salud: "salud",
  educacion: "educacion",
  bellezaBienestar: "belleza-bienestar",
  ocio: "ocio",
  servicios: "servicios",
  otros: "otros",
};

export function slugDeSeccion(seccion: SeccionListado): string {
  return SLUG_POR_SECCION[seccion];
}

export function seccionDesdeSlug(slug: string): SeccionListado | null {
  const entrada = (Object.entries(SLUG_POR_SECCION) as [SeccionListado, string][]).find(([, s]) => s === slug);
  return entrada ? entrada[0] : null;
}

export function agruparPorSeccion<T extends { tipo_lugar: string }>(
  items: T[]
): Array<{ seccion: SeccionListado; items: T[] }> {
  const grupos = new Map<SeccionListado, T[]>();
  for (const item of items) {
    const seccion = seccionDeTipoLugar(item.tipo_lugar);
    if (!grupos.has(seccion)) grupos.set(seccion, []);
    grupos.get(seccion)!.push(item);
  }
  return ORDEN_SECCIONES.filter((s) => grupos.has(s)).map((seccion) => ({ seccion, items: grupos.get(seccion)! }));
}
