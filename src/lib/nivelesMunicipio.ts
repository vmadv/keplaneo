import { FOCOS_SEMANALES, type Foco } from "./gemini";

// Niveles de profundidad de generación por tamaño de municipio (ver
// conversación sobre coste): no todos necesitan el mismo despliegue.
// - "grande": paquete completo — semanal con las 7 búsquedas enfocadas,
//   repaso diario todos los días que ya toca (martes a domingo).
// - "mediano": semanal con 2-3 de las 7 enfocadas, rotando cada semana (ver
//   focosParaEstaSemana) — en unas 3 semanas pasan por las 7 — y repaso
//   diario recortado a 2 días por semana, con conciertos como enfocada
//   añadida esos días (ver diasRepasoDiario/focoDiarioExtra).
// - "pequeno": semanal sin ninguna enfocada, sin repaso diario en absoluto
//   — agenda real demasiado escasa para justificar el gasto.
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

// Grupos de 2-3 focos que rotan semana a semana para los municipios
// "mediano" — mismo criterio que ya usa generate-monthly para repartir los
// meses lejanos en 4 grupos (ver route.ts), aplicado aquí a los focos: en
// vez de pagar las 7 búsquedas cada semana (coste de "grande") o ninguna,
// en ~3 semanas un mediano pasa por las 7 sin disparar el gasto de golpe.
// gratis/conciertos/pareja van primero por ser los de mayor impacto
// percibido (ver conversación).
const GRUPOS_FOCOS_MEDIANO: Foco[][] = [
  [
    { tipo: "precio", valor: "gratis" },
    { tipo: "categoria", valor: "conciertos" },
    { tipo: "audiencia", valor: "pareja" },
  ],
  [
    { tipo: "audiencia", valor: "familia" },
    { tipo: "categoria", valor: "exposiciones" },
  ],
  [
    { tipo: "categoria", valor: "teatro" },
    { tipo: "categoria", valor: "monologos" },
  ],
];

// Qué focos le tocan a este municipio ESTA semana, según su nivel —
// `numeroSemana` es el mismo contador que ya usa generate-monthly
// (numeroSemanaDesde2020, en src/lib/dates.ts) para que la rotación de
// focos y la de meses lejanos avancen con el mismo reloj, aunque roten en
// grupos de tamaño distinto (3 vs 4).
export function focosParaEstaSemana(slug: string, numeroSemana: number): Foco[] {
  const nivel = nivelMunicipio(slug);
  if (nivel === "grande") return FOCOS_SEMANALES;
  if (nivel === "mediano") {
    return GRUPOS_FOCOS_MEDIANO[((numeroSemana % GRUPOS_FOCOS_MEDIANO.length) + GRUPOS_FOCOS_MEDIANO.length) % GRUPOS_FOCOS_MEDIANO.length];
  }
  return [];
}

// Foco enfocado extra que se añade al repaso DIARIO (no al semanal) de los
// municipios "mediano" los días que ya hacen ese repaso — conciertos es la
// categoría más volátil (se anuncia con poca antelación), así que es la que
// más se beneficia de un repaso más frecuente que una vez por semana. Sin
// cambios para "grande" (ya lleva las 7 focos completas cada semana) ni
// "pequeno" (sin repaso diario en absoluto).
export function focoDiarioExtra(slug: string): Foco | null {
  return nivelMunicipio(slug) === "mediano" ? { tipo: "categoria", valor: "conciertos" } : null;
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

// Fuentes especializadas de referencia por municipio y categoría, para
// reforzar la búsqueda dedicada de cada una — ver conversación: el recinto
// puede estar bien cubierto (otros conciertos del mismo sitio sí aparecen)
// y aun así faltar una fecha concreta, porque la búsqueda con grounding no
// garantiza cobertura del 100% de lo anunciado. Solo para "grande", que ya
// paga las búsquedas enfocadas — mapeo a mano igual que NIVELES.
//
// Las páginas de mes concretas de conciertosensevilla.es (más precisas que
// la raíz del sitio: van directas al listado de ese mes) llevan el año en
// la URL — 2026 hoy, hay que revisarlas/actualizarlas cuando cambie de año
// o cuando la búsqueda enfocada empiece a rebasar noviembre.
type CategoriaConPagina = "conciertos" | "exposiciones" | "teatro" | "monologos";

const FUENTES_REFERENCIA_CATEGORIA: Record<string, Partial<Record<CategoriaConPagina, string[]>>> = {
  sevilla: {
    conciertos: [
      "https://conciertosensevilla.es/",
      "https://conciertosensevilla.es/conciertos-sevilla-septiembre-2026/",
      "https://conciertosensevilla.es/conciertos-sevilla-octubre-2026/",
      "https://conciertosensevilla.es/conciertos-sevilla-noviembre-2026/",
      "https://www.agendadesevilla.com/conciertos/",
      "https://www.elcorteingles.es/entradas/conciertos/sevilla/",
    ],
    exposiciones: ["https://onsevilla.com/exposiciones-en-sevilla"],
    teatro: ["https://www.agendadesevilla.com/teatro/"],
    monologos: ["https://www.agendadesevilla.com/monologos/"],
  },
};

export function fuentesReferenciaCategoria(slug: string, categoria: CategoriaConPagina): string[] {
  return FUENTES_REFERENCIA_CATEGORIA[slug]?.[categoria] ?? [];
}
