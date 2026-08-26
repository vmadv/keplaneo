import { diasSemanaIncluidos, etiquetaDiaSemana } from "./dates";
import type { Evento } from "./types";

// Compartido por /esta-semana y sus variantes (audiencia, gratis): filtra y
// ordena por el rango fecha_inicio–fecha_fin de cada evento. Un evento sin
// fechas conocidas (exposición larga, "horario habitual"...) se incluye
// igual pero al final y sin etiqueta de día — solo se EXCLUYE cuando sí
// conocemos sus fechas y no caen esta semana.
export function ordenarPorDiaDeSemana(
  eventos: Evento[],
  locale: string = "es"
): {
  eventos: Evento[];
  etiquetas: Map<string, string | null>;
} {
  const conDias = eventos.map((evento) => ({
    evento,
    dias: diasSemanaIncluidos(evento.fecha_inicio, evento.fecha_fin),
  }));

  const relevantes = conDias.filter(({ dias }) => dias === null || dias.some(Boolean));

  relevantes.sort((a, b) => {
    const indiceA = a.dias ? a.dias.indexOf(true) : 99;
    const indiceB = b.dias ? b.dias.indexOf(true) : 99;
    if (indiceA !== indiceB) return indiceA - indiceB;
    return a.evento.titulo.localeCompare(b.evento.titulo, locale);
  });

  const etiquetas = new Map(
    relevantes.map(({ evento, dias }) => [evento.id, dias ? etiquetaDiaSemana(dias, locale) : null])
  );

  return { eventos: relevantes.map((r) => r.evento), etiquetas };
}
