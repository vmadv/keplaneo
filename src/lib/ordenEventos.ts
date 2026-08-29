import type { Evento } from "./types";

// Agrupa por categoría, ordena cada grupo por relevancia (de mayor a
// menor, lo que no la tenga aún al final) y los intercala en round-robin
// — el resultado es una única lista variada (una visita, un concierto
// permanente, una ruta...) en vez de amontonar lo mismo seguido solo
// porque puntúa mejor. Ver conversación: "listado de todo intercalados",
// no bloques por categoría.
export function ordenarPorRelevanciaConDiversidad(eventos: Evento[]): Evento[] {
  const grupos = new Map<string, Evento[]>();
  for (const evento of eventos) {
    const clave = evento.categoria ?? "otros";
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(evento);
    else grupos.set(clave, [evento]);
  }

  const colas = Array.from(grupos.values());
  for (const cola of colas) {
    cola.sort((a, b) => (b.relevancia ?? 0) - (a.relevancia ?? 0));
  }

  const resultado: Evento[] = [];
  let quedaAlguno = true;
  while (quedaAlguno) {
    quedaAlguno = false;
    for (const cola of colas) {
      const siguiente = cola.shift();
      if (siguiente) {
        resultado.push(siguiente);
        quedaAlguno = true;
      }
    }
  }
  return resultado;
}
