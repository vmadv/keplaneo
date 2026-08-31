import { diasIncluidosEnRango, diasRelevantesEstaSemana, diasFinDeSemana, diasDelMes, etiquetaDiaSemana, etiquetaDiaFinde, hoyEnMadrid } from "./dates";
import type { Evento, Plan, MesSlug } from "./types";

// Para no repetir el mismo evento real en el relleno de ordenarParaHoy/
// ordenarParaFinde cuando el lote curado (planes) ya lo trae — ver
// conversación sobre el duplicado "Dinosaurios de la Patagonia".
export function idsEventoDePlanes(planes: Plan[]): Set<string> {
  return new Set(planes.map((p) => p.evento_id).filter((id): id is string => id !== null));
}

// Núcleo compartido por ordenarPorDiaDeSemana/ordenarParaHoy/ordenarParaFinde:
// filtra a los eventos relevantes para una ventana de días concreta y los
// ordena por "cuán puntual" es cada uno dentro de esa ventana (ver criterio
// completo más abajo). `incluirSinFecha` decide si un genérico sin fecha
// alguna se cuela al final (así se comporta "esta semana", que sí quiere
// mostrar genéricos de relleno) o se descarta (así se comportan
// ordenarParaHoy/ordenarParaFinde, pensadas solo para tapar el hueco de
// eventos puntuales que el lote curado del día no llegó a cubrir — los
// genéricos de esas páginas ya vienen del lote curado, no hace falta
// duplicarlos aquí).
function relevantesOrdenados(
  eventos: Evento[],
  diasObjetivo: Date[],
  { incluirSinFecha }: { incluirSinFecha: boolean }
): Array<{ evento: Evento; dias: boolean[] | null }> {
  const conDias = eventos.map((evento) => ({
    evento,
    dias: diasIncluidosEnRango(evento.fecha_inicio, evento.fecha_fin, diasObjetivo),
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
    return incluirSinFecha && evento.fecha_inicio === null && evento.fecha_fin === null;
  });

  // Sin reordenar aquí: `eventos` ya llega con el orden de 4 niveles de
  // getEventosDelMunicipio (puntual propio > puntual zona cercana >
  // genérico propio > genérico zona cercana, con fecha real próxima como
  // desempate) — Array.filter conserva ese orden. Antes esta función volvía
  // a ordenar desde cero por "cuántos días de la ventana ocupa cada
  // evento", que enterraba exposiciones largas detrás de conciertos de un
  // solo día en cuanto había muchos conciertos reales (ver conversación:
  // "esta semana" con 89 conciertos importados vs 54 exposiciones —
  // ninguna exposición aparecía en los primeros puestos).
  return relevantes;
}

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
  const relevantes = relevantesOrdenados(eventos, diasRelevantesEstaSemana(), { incluirSinFecha: true });
  const etiquetas = new Map(
    relevantes.map(({ evento, dias }) => [evento.id, dias ? etiquetaDiaSemana(dias, locale) : null])
  );
  return { eventos: relevantes.map((r) => r.evento), etiquetas };
}

// Para tapar el hueco de "hoy"/"finde" cuando el lote curado del día
// (planes) no llegó a cubrir un evento puntual real que sí conocemos (ver
// conversación: fin-de-semana/con-ninos en Sevilla solo mostraba genéricos
// porque el lote de hoy no traía nada puntual para esa audiencia). Solo
// puntuales de verdad — los genéricos de relleno ya los aporta el lote
// curado, no hace falta duplicarlos desde aquí.
export function ordenarParaHoy(eventos: Evento[]): Evento[] {
  return relevantesOrdenados(eventos, [hoyEnMadrid()], { incluirSinFecha: false }).map((r) => r.evento);
}

export function ordenarParaFinde(
  eventos: Evento[],
  locale: string = "es"
): {
  eventos: Evento[];
  etiquetas: Map<string, string | null>;
} {
  const relevantes = relevantesOrdenados(eventos, diasFinDeSemana(), { incluirSinFecha: false });
  const etiquetas = new Map(
    relevantes.map(({ evento }) => [evento.id, etiquetaDiaFinde(evento.fecha_inicio, evento.fecha_fin, locale)])
  );
  return { eventos: relevantes.map((r) => r.evento), etiquetas };
}

// Igual que ordenarParaHoy/ordenarParaFinde, pero para las páginas de mes
// (a secas o categoría+mes) — el mismo hueco: getPlanesDelMes lee solo el
// lote curado, que compite por un cupo de 10-20 planes mezclando TODAS las
// categorías del mes entero, así que un concierto real puede quedarse
// fuera aunque ya conste en `eventos` (ver conversación). Sin etiquetas
// propias — ListaEventos ya calcula su propia etiqueta de fecha por
// evento cuando no se le pasa `obtenerEtiqueta` (día suelto, mes, o "desde
// {mes}" si está en curso), que es justo lo que hace falta aquí.
export function ordenarParaMes(eventos: Evento[], mesSlug: MesSlug): Evento[] {
  return relevantesOrdenados(eventos, diasDelMes(mesSlug), { incluirSinFecha: false }).map((r) => r.evento);
}
