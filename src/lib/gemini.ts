import type { Audiencia, Momento, TipoPlan } from "./types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export interface PlanGenerado {
  titulo: string;
  descripcion: string;
  momento: Momento;
  vigencia: string[];
  audiencia: Audiencia[];
  tipo: TipoPlan;
  preguntas_frecuentes?: PreguntaFrecuente[];
  // Solo relevantes cuando tipo="excepcional": alimentan la página de
  // detalle propia de ese evento (ver src/lib/eventos.ts).
  ubicacion?: string;
  horario?: string;
  precio?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  fuente?: string;
}

interface UsoTokens {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

function extraerJSON(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "");
  return JSON.parse(limpio);
}

async function llamarGemini(
  prompt: string
): Promise<{ texto: string; usage: UsoTokens }> {
  if (!GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en las variables de entorno");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // NOTA: el nombre del tool de grounding con Google Search ha cambiado
  // entre generaciones de modelo (googleSearchRetrieval -> google_search).
  // Verifica el valor correcto para GEMINI_MODEL en ai.google.dev antes de
  // desplegar a producción.
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  };

  const res = await fetch(url, {
    method: "POST",
    // Las keys nuevas ("Auth keys", prefijo AQ.) se autentican por cabecera;
    // el antiguo `?key=` en la URL era para las keys "Standard" (AIza),
    // retiradas en septiembre de 2026.
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const texto: string =
    data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";

  return { texto, usage: data.usageMetadata ?? {} };
}

const INSTRUCCIONES_FORMATO = `
Orden de prioridad, en este orden estricto:
1. Primero, todos los eventos puntuales y temporales que encuentres (agenda concreta con fecha: conciertos, ferias, exposiciones temporales, festivales, espectáculos). Estos van "tipo": "excepcional".
2. Solo si no encuentras suficientes eventos puntuales verificables para llegar a 10 planes, completa el resto con planes genéricos de calidad, disponibles siempre (parques, rutas, gastronomía, monumentos). Estos van "tipo": "generico".

Los planes "generico" deben ir siempre al final del array, después de todos los "excepcional". No inventes eventos puntuales que no existan solo por rellenar — ante la duda, usa un plan genérico real en su lugar.

Cada elemento debe tener EXACTAMENTE estos campos:
- "titulo": string, corto y concreto
- "descripcion": string. Para "tipo": "generico", 1-2 frases. Para "tipo": "excepcional" (tiene página propia), 3-4 frases con contexto, qué esperar y algún detalle práctico — no te cortes en longitud aquí, es el contenido principal de esa página.
- "momento": "dia" | "noche"
- "vigencia": array de strings
- "audiencia": array con al menos uno de ["pareja", "familia", "generico"] — usa "generico" cuando el plan sirve para cualquier visitante
- "tipo": "excepcional" (evento puntual con fecha concreta) | "generico" (disponible siempre)
- "preguntas_frecuentes": array de 2-3 objetos {"pregunta": string, "respuesta": string}. Usa las preguntas que un visitante real se haría de este plan concreto (¿es gratis?, ¿es apto para niños?, ¿cuánto dura?, ¿hasta cuándo está disponible?, ¿hay que reservar?...). IMPORTANTE: la respuesta debe basarse ÚNICAMENTE en los datos que ya has puesto en los demás campos de este mismo plan (horario, precio, audiencia, fechas, descripción) — no metas ningún dato nuevo que no hayas dado ya arriba. Si no tienes base para una pregunta concreta, no la incluyas.

Además, SOLO para los planes con "tipo": "excepcional" (van a tener página propia con más detalle), añade estos campos cuando la información sea real y verificable — omite el campo si no la encuentras, no la inventes:
- "ubicacion": lugar concreto donde ocurre (ej. "Real Alcázar, Patio de Banderas")
- "horario": horario concreto (ej. "22:00h")
- "precio": ej. "Entrada gratuita", "Desde 15€"
- "fecha_inicio" / "fecha_fin": rango de fechas del evento si lo conoces (ej. "15 de agosto de 2026" / "31 de agosto de 2026") — omite el que no sepas
- "fuente": si conoces la URL exacta de la página oficial del evento o recinto, ponla aquí (ej. "https://..."). Si no tienes una URL fiable, pon el nombre de la institución (ej. "Ayuntamiento de Sevilla").

Devuelve EXCLUSIVAMENTE el array JSON, sin texto adicional ni bloques de markdown.
`.trim();

// Gemini no tiene un esquema forzado (pedimos JSON libre en el prompt), así
// que de vez en cuando devuelve un valor fuera de la lista permitida en
// "momento", "tipo" o "audiencia". Sin esto, una sola fila rara rompe el
// insert de TODO el lote del municipio (el check constraint de Postgres
// rechaza el array entero).
function normalizarPlan(p: PlanGenerado): PlanGenerado {
  const audienciaValida = (Array.isArray(p.audiencia) ? p.audiencia : []).filter(
    (a): a is Audiencia => a === "pareja" || a === "familia" || a === "generico"
  );

  return {
    ...p,
    momento: p.momento === "noche" ? "noche" : "dia",
    tipo: p.tipo === "excepcional" ? "excepcional" : "generico",
    audiencia: audienciaValida.length > 0 ? audienciaValida : ["generico"],
    vigencia: Array.isArray(p.vigencia) ? p.vigencia : [],
  };
}

function normalizarPlanes(planes: unknown): PlanGenerado[] {
  if (!Array.isArray(planes)) return [];
  return (planes as PlanGenerado[]).map(normalizarPlan);
}

export async function generarPlanesDiarios(
  municipioNombre: string
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para hoy y para este fin de semana.

Genera entre 10 y 20 planes, priorizando eventos puntuales de agenda por encima de planes genéricos (ver orden de prioridad más abajo). El campo "vigencia" de cada plan debe incluir "hoy" y, si además aplica a este fin de semana, también "finde".

${INSTRUCCIONES_FORMATO}
`.trim();

  const { texto, usage } = await llamarGemini(prompt);
  return { planes: normalizarPlanes(extraerJSON(texto)), usage };
}

export async function generarPlanesDelMes(
  municipioNombre: string,
  mesSlug: string
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para el mes de ${mesSlug}.

Genera entre 10 y 20 planes para ese mes completo (no solo para un día concreto), priorizando eventos puntuales de agenda por encima de planes genéricos (ver orden de prioridad más abajo). El campo "vigencia" de cada plan debe incluir "${mesSlug}".

${INSTRUCCIONES_FORMATO}
`.trim();

  const { texto, usage } = await llamarGemini(prompt);
  return { planes: normalizarPlanes(extraerJSON(texto)), usage };
}

// Tarifa de gemini-3.5-flash-lite ($/1M tokens), el modelo real al que
// resuelve el alias GEMINI_MODEL a fecha de escribir esto. Si cambias de
// modelo o Google ajusta precios, actualiza estos dos valores — de ellos
// depende que generation_log refleje el coste real y no uno inventado.
const COSTE_INPUT_POR_MILLON = 0.3;
const COSTE_OUTPUT_POR_MILLON = 2.5;

export function estimarCoste(usage: UsoTokens): number {
  const input = ((usage.promptTokenCount ?? 0) / 1_000_000) * COSTE_INPUT_POR_MILLON;
  const output = ((usage.candidatesTokenCount ?? 0) / 1_000_000) * COSTE_OUTPUT_POR_MILLON;
  return input + output;
}
