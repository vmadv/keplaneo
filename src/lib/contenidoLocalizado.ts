// El contenido REAL de un plan (título, descripción, precio, preguntas
// frecuentes) solo existe en español en la mayoría de filas — la traducción
// al inglés es una llamada aparte de Gemini (ver traducirPlanesAIngles en
// gemini.ts) que puede no haberse hecho todavía para contenido antiguo, o
// haber fallado para un plan concreto. `null`/`undefined` en el campo "_en"
// siempre cae de vuelta al español, nunca se muestra vacío.
export function localizado<T>(es: T, en: T | null | undefined, locale: string): T {
  return locale === "en" && en != null ? en : es;
}
