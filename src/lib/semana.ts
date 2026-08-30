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

  // dias === null puede significar dos cosas muy distintas: el evento no
  // tiene fecha en absoluto (genérico de verdad, se incluye igual) o SÍ
  // tiene fecha_inicio/fecha_fin pero el texto no se pudo interpretar (ej.
  // "2 de diciembre" sin año — ver conversación). Confundir los dos colaba
  // eventos puntuales de meses futuros en "esta semana" solo porque
  // Gemini olvidó el año; si hay texto de fecha pero no se pudo parsear,
  // se excluye en vez de asumir que aplica siempre.
  const relevantes = conDias.filter(({ evento, dias }) => {
    if (dias !== null) return dias.some(Boolean);
    return evento.fecha_inicio === null && evento.fecha_fin === null;
  });

  relevantes.sort((a, b) => {
    // Cuántos días de esta semana ocupa: un puntual de un solo día (o dos)
    // es más "puntual" de verdad que uno que dura toda la semana (ej. la
    // temporada completa de un recinto) — este manda antes que el orden
    // cronológico, para que lo realmente concreto no quede por detrás de
    // algo disponible cualquier día solo porque cae antes en el calendario
    // (ver conversación). Los genéricos (sin fecha, `dias` null) siempre
    // van last, con una duración "infinita" que ningún puntual real alcanza.
    const duracionA = a.dias ? a.dias.filter(Boolean).length : 8;
    const duracionB = b.dias ? b.dias.filter(Boolean).length : 8;
    if (duracionA !== duracionB) return duracionA - duracionB;
    const indiceA = a.dias ? a.dias.indexOf(true) : 99;
    const indiceB = b.dias ? b.dias.indexOf(true) : 99;
    if (indiceA !== indiceB) return indiceA - indiceB;
    // Dentro del mismo día (o de los genéricos sin fecha, todos con índice
    // 99), lo propio del municipio ordena antes que lo de zona cercana —
    // ver conversación sobre prioridad en 4 niveles.
    const cercanoA = a.evento.zona_cercana !== null ? 1 : 0;
    const cercanoB = b.evento.zona_cercana !== null ? 1 : 0;
    if (cercanoA !== cercanoB) return cercanoA - cercanoB;
    // Y dentro de eso, relevancia decide antes que el alfabeto — ver
    // conversación (un genérico de toda la vida no debe adelantar a algo
    // más singular solo por el nombre).
    const relA = a.evento.relevancia ?? 0;
    const relB = b.evento.relevancia ?? 0;
    if (relA !== relB) return relB - relA;
    return a.evento.titulo.localeCompare(b.evento.titulo, locale);
  });

  const etiquetas = new Map(
    relevantes.map(({ evento, dias }) => [evento.id, dias ? etiquetaDiaSemana(dias, locale) : null])
  );

  return { eventos: relevantes.map((r) => r.evento), etiquetas };
}
