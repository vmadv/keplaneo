import { esCategoriaConPagina, MESES, type Categoria } from "./types";
import { esPrecioGratis } from "./queries";
import { fechaDesdeTextoEspanol, hoyEnMadrid } from "./dates";

// Entrada mínima para calcular dónde aparece un evento en el sitio — un
// subconjunto de Evento, para no acoplar este módulo a la forma exacta de
// cada consumidor (usado hoy por api/interno/reporte-planes, alimentando el
// artifact de revisión de planes).
export interface EventoParaPaginas {
  categoria: Categoria | null;
  audiencia: string[];
  precio: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export interface PaginasPlan {
  paginasEstaticas: string[];
  paginasPorMes: string[];
  meses: string[];
  enCurso: boolean;
  pasado: boolean;
}

// Todos los slugs de mes (en español, el único que usa la URL) que cubre el
// rango fecha_inicio–fecha_fin, en orden — ej. un evento del 28 de agosto al
// 3 de septiembre devuelve ["agosto", "septiembre"]. null si no hay ninguna
// fecha interpretable (evento sin fecha real, o "generico").
function mesesDelRango(fechaInicio: string | null, fechaFin: string | null): string[] | null {
  const inicio = fechaInicio ? fechaDesdeTextoEspanol(fechaInicio) : null;
  const fin = fechaFin ? fechaDesdeTextoEspanol(fechaFin) : inicio;
  const desde = inicio ?? fin;
  const hasta = fin ?? inicio;
  if (!desde || !hasta) return null;

  const meses: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const limite = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  while (cursor <= limite) {
    meses.push(MESES[cursor.getMonth()]);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

// Calcula en qué páginas estáticas del municipio aparece un evento — el hub
// (todos aparecen), la página de su categoría (si tiene página propia), las
// de audiencia/gratis, y las de mes (solo puntuales, uno por cada mes que
// cubre su rango de fechas) — para el informe de revisión de planes (ver
// api/interno/reporte-planes). No existía como función única, se compone a
// partir de los criterios ya usados por separado en queries.ts/types.ts.
export function calcularPaginasPlan(evento: EventoParaPaginas, municipioSlug: string): PaginasPlan {
  const base = `/${municipioSlug}`;
  const paginasEstaticas = [`${base} (hub)`];

  const tieneCategoriaPropia = evento.categoria !== null && esCategoriaConPagina(evento.categoria);
  if (tieneCategoriaPropia) paginasEstaticas.push(`${base}/${evento.categoria}`);
  if (esPrecioGratis(evento.precio)) paginasEstaticas.push(`${base}/gratis`);
  if (evento.audiencia.includes("pareja")) paginasEstaticas.push(`${base}/en-pareja`);
  if (evento.audiencia.includes("familia")) paginasEstaticas.push(`${base}/con-ninos`);

  const meses = evento.fecha_inicio ? (mesesDelRango(evento.fecha_inicio, evento.fecha_fin) ?? []) : [];
  const paginasPorMes = meses.flatMap((mes) => [
    `${base}/${mes}`,
    ...(tieneCategoriaPropia ? [`${base}/${evento.categoria}/${mes}`] : []),
  ]);

  const hoy = hoyEnMadrid();
  const inicio = evento.fecha_inicio ? fechaDesdeTextoEspanol(evento.fecha_inicio) : null;
  const fin = evento.fecha_fin ? fechaDesdeTextoEspanol(evento.fecha_fin) : inicio;
  const enCurso = inicio !== null && inicio <= hoy && (fin === null || fin >= hoy);
  const pasado = fin !== null && fin < hoy;

  return { paginasEstaticas, paginasPorMes, meses, enCurso, pasado };
}
