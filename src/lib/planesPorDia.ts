import { diasIncluidosEnRango, formatearFechaISO } from "./dates";
import type { PlanGenerado } from "./gemini";

export interface FilaPlanDia {
  fechaISO: string;
  plan: PlanGenerado;
  // Índice dentro del array `planes` original — para casar con el Map de
  // upsertEventosDelLote (evento_id por índice) sin tener que repetir el
  // upsert por cada día.
  indice: number;
  vigencia: string[];
}

// Reparte un lote de planes (generado de una vez, semanal o de repaso)
// entre los días concretos a los que aplica, calculando "hoy"/"finde" por
// día a partir de fecha_inicio/fecha_fin — antes esto se lo pedíamos a
// Gemini de nuevo cada día; ahora se calcula aquí para poder precomputar
// varios días con una sola llamada.
// Un plan "generico" (sin fecha) aplica a todos los días objetivo, como
// siempre. Un plan "excepcional" sin fecha reconocible no genera ninguna
// fila (no sabemos en qué día colocarlo) — sigue existiendo en `eventos`
// vía upsertEventosDelLote, pero no aparece en los listados por día.
export function calcularFilasPorDia(planes: PlanGenerado[], diasObjetivo: Date[]): FilaPlanDia[] {
  const filas: FilaPlanDia[] = [];
  const indicesFinde = diasObjetivo.reduce<number[]>((acc, dia, i) => {
    if (dia.getDay() === 0 || dia.getDay() === 6) acc.push(i);
    return acc;
  }, []);

  planes.forEach((plan, indice) => {
    const esGenerico = plan.tipo !== "excepcional";
    const dias = esGenerico
      ? diasObjetivo.map(() => true)
      : diasIncluidosEnRango(plan.fecha_inicio ?? null, plan.fecha_fin ?? null, diasObjetivo);

    if (dias === null) return;

    const aplicaAlgunDiaDeFinde = indicesFinde.some((i) => dias[i]);

    diasObjetivo.forEach((diaObjetivo, i) => {
      const vigencia: string[] = [];
      if (dias[i]) vigencia.push("hoy");
      if (aplicaAlgunDiaDeFinde) vigencia.push("finde");
      if (vigencia.length === 0) return;
      filas.push({ fechaISO: formatearFechaISO(diaObjetivo), plan, indice, vigencia });
    });
  });

  return filas;
}
