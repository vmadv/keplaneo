// Niveles de profundidad de generación por tamaño de municipio (ver
// conversación sobre coste): no todos necesitan el mismo despliegue.
// - "grande": paquete completo — semanal con las 6 búsquedas enfocadas,
//   repaso diario todos los días que ya toca (martes a domingo).
// - "mediano": semanal sin las 6 enfocadas (mixta + genéricos + niños se
//   mantienen), repaso diario recortado a 2 días por semana.
// - "pequeno": igual que mediano en lo semanal, pero SIN repaso diario.
//
// Mapeo a mano por slug, no en base de datos — con 9 municipios no
// compensa la migración; si esto se valida y escalamos a muchos más,
// promocionarlo a una columna real en `municipios`. Cualquier municipio
// nuevo no listado aquí cae en "mediano" por defecto (opción intermedia,
// no la más cara ni la más recortada).
export type NivelMunicipio = "grande" | "mediano" | "pequeno";

const NIVELES: Record<string, NivelMunicipio> = {
  sevilla: "grande",
  "dos-hermanas": "mediano",
  "alcala-de-guadaira": "mediano",
  utrera: "mediano",
  "mairena-del-aljarafe": "mediano",
  ecija: "mediano",
  carmona: "pequeno",
  lebrija: "pequeno",
  osuna: "pequeno",
};

export function nivelMunicipio(slug: string): NivelMunicipio {
  return NIVELES[slug] ?? "mediano";
}

export function llevaEnfocadas(slug: string): boolean {
  return nivelMunicipio(slug) === "grande";
}

// Días de la semana (0=domingo…6=sábado) en que un municipio de este nivel
// hace el repaso diario de "novedades" — grande conserva todos los días en
// que ya corre el cron (martes a domingo), mediano/pequeño se reducen a 2
// (martes y viernes: el viernes ya tenía lógica especial de "presta
// atención al finde", así que encaja bien mantenerlo), pequeño no hace
// repaso diario en absoluto.
export function diasRepasoDiario(slug: string): number[] {
  const nivel = nivelMunicipio(slug);
  if (nivel === "grande") return [2, 3, 4, 5, 6, 0]; // martes a domingo
  if (nivel === "mediano") return [2, 5]; // martes y viernes
  return []; // pequeño: sin repaso diario
}

// Fuentes especializadas de referencia por municipio, para reforzar la
// búsqueda dedicada de una categoría — ver conversación: el recinto puede
// estar bien cubierto (otros conciertos del mismo sitio sí aparecen) y aun
// así faltar una fecha concreta, porque la búsqueda con grounding no
// garantiza cobertura del 100% de lo anunciado. Solo para "grande", que ya
// paga las búsquedas enfocadas — mapeo a mano igual que NIVELES.
const FUENTES_REFERENCIA_CONCIERTOS: Record<string, string[]> = {
  sevilla: ["https://conciertosensevilla.es/"],
};

export function fuentesReferenciaConciertos(slug: string): string[] {
  return FUENTES_REFERENCIA_CONCIERTOS[slug] ?? [];
}
