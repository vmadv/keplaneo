import { CATEGORIAS, type Audiencia, type Categoria, type Momento, type TipoPlan } from "./types";
import type { CandidatoLugar } from "./places";

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
  categoria?: Categoria;
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

// Al pedir párrafos separados por "\n\n" dentro de un string JSON, Gemini a
// veces devuelve un salto de línea real (carácter de control) en vez de la
// secuencia escapada "\n" — JSON.parse rechaza eso como sintaxis inválida.
// Recorremos el texto respetando qué está dentro de comillas (sin tocar el
// formato/indentación del propio JSON) y escapamos los saltos de línea que
// encontremos únicamente ahí dentro.
function escaparControlesDentroDeStrings(texto: string): string {
  let dentro = false;
  let escapando = false;
  let resultado = "";

  for (const ch of texto) {
    if (escapando) {
      resultado += ch;
      escapando = false;
      continue;
    }
    if (ch === "\\") {
      resultado += ch;
      escapando = true;
      continue;
    }
    if (ch === '"') {
      dentro = !dentro;
      resultado += ch;
      continue;
    }
    if (dentro && (ch === "\n" || ch === "\r" || ch === "\t")) {
      resultado += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
      continue;
    }
    resultado += ch;
  }

  return resultado;
}

function extraerJSON(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    // Restos de marcadores de cita del grounding (ej. "[1]", "[1.1.1]") que
    // a veces se cuelan en medio del texto de la descripción.
    .replace(/\[\d+(?:\.\d+)*\]/g, "");
  return JSON.parse(escaparControlesDentroDeStrings(limpio));
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

const TIPOS_EVENTO_PUNTUAL = `
Busca activamente en TODAS estas categorías de eventos con fecha concreta (no te quedes solo con lo primero que encuentres — repasa cada bloque):
- Música: conciertos de cualquier género (pop, rock, flamenco, clásica, jazz, indie...), festivales, ciclos de música en directo (jardines, patios, terrazas de verano).
- Escena y proyecciones: teatro, monólogos/comedia, danza/ballet, ópera/zarzuela, cine de verano o ciclos de cine al aire libre, espectáculos de luz y sonido/videomapping, circo/magia.
- Arte y cultura: exposiciones temporales (arte, fotografía, ciencia, historia), presentaciones de libros/charlas/conferencias abiertas al público, jornadas de puertas abiertas (patrimonio, bodegas, fábricas).
- Deporte: partidos (fútbol, baloncesto, balonmano...), carreras populares/maratones/10K, torneos (pádel, tenis, ciclismo), exhibiciones deportivas, eventos náuticos si hay río o costa.
- Ferias y mercados: ferias (del libro, gastronómicas, artesanales, del vino), mercadillos temáticos puntuales (navideños, medievales, vintage), catas puntuales (vino, cerveza, aceite), food trucks o eventos gastronómicos temporales.
- Fiestas y tradición: fiestas patronales/verbenas, romerías, procesiones (Semana Santa) y eventos religiosos señalados, Carnaval, Cabalgata de Reyes/encendido de luces navideñas, desfiles (moda, comparsas).
- Infantil/familiar puntual: exposiciones o talleres pensados para niños (ciencia, dinosaurios, arte manipulativo...) en museos y centros culturales, cine de verano con película familiar, actividades infantiles dentro de ferias/fiestas locales (carreras infantiles, circo, magia), cuentacuentos y espectáculos infantiles de temporada, jornadas en parques temáticos o acuáticos con programación puntual. Este bloque alimenta un filtro real del sitio ("qué hacer con niños") — búscalo con el mismo empeño que el resto, no lo dejes de relleno: si a un buscador le preguntasen directamente "qué hacer con niños este fin de semana" en esta ciudad y encontrase varias opciones reales, esas mismas deberían aparecer aquí.
- Otros: fuegos artificiales, observación astronómica (lluvias de estrellas, eclipses), ferias de coches/motos clásicos, torneos de e-sports.

De estos bloques, "conciertos" (dentro de Música), "exposiciones" (dentro de Arte y cultura) y "teatro"/"monólogos" (dentro de Escena y proyecciones) alimentan cada uno su propia página del sitio, igual que lo infantil/familiar — búscalos con el mismo empeño real, no como relleno de la categoría genérica que les toque.
`.trim();

const INSTRUCCIONES_FORMATO = `
Orden de prioridad, en este orden estricto:
1. Primero, todos los eventos puntuales y temporales que encuentres (agenda concreta con fecha). Estos van "tipo": "excepcional".

${TIPOS_EVENTO_PUNTUAL}

2. Solo si no encuentras suficientes eventos puntuales verificables para llegar a 10 planes, completa el resto con planes genéricos de calidad, disponibles siempre (parques, rutas, gastronomía, monumentos, actividades al aire libre...). Estos van "tipo": "generico". Evita los 3-4 sitios más obvios y manidos de la ciudad (los que cualquier buscador pondría primero, tipo "paseo por el barrio histórico" o "visita a la catedral") salvo que aportes un ángulo genuinamente distinto — prioriza en su lugar mercados de abastos reales, miradores poco conocidos, rutas de naturaleza cercana, talleres artesanales visitables, rutas en bici, actividades acuáticas si hay río, museos menores, etc.

Los planes "generico" deben ir siempre al final del array, después de todos los "excepcional". No inventes eventos puntuales que no existan solo por rellenar — ante la duda, usa un plan genérico real en su lugar.

Dentro de cada uno de esos dos bloques (excepcional / generico), ordena de MAYOR a MENOR popularidad o interés esperado — el evento más multitudinario o relevante primero, el más de nicho al final. Además:
- Procura variedad real de temática entre los eventos puntuales: si encuentras 8 conciertos y ningún otro tipo, busca más en las demás categorías antes de rendirte — no llenes el listado a base de repetir el mismo tipo de plan.
- Sé preciso con "audiencia" — no la trates como una lista de "a quién le podría gustar esto", sino como "para quién es este plan sobre todo". Si tiene un ángulo claro de pareja (una cata de vino nocturna, un concierto de jazz íntimo, una cena con vistas) márcalo SOLO "pareja"; si es claramente pensado para ir con niños (un espectáculo infantil, un parque temático, un taller familiar) márcalo SOLO "familia". No le añadas "generico" a la vez a un plan que ya llevas "pareja" o "familia" — son alternativas, no se acumulan. Reserva "generico" para cuando el plan de verdad no tenga ningún ángulo hacia una audiencia concreta. Esta etiqueta se usa para filtrar planes por audiencia en el sitio; si casi todo lleva "generico" además de su etiqueta específica, el filtro deja de servir de nada.
- Busca activamente planes con ángulo de pareja, con el mismo empeño que lo infantil/familiar: catas nocturnas, conciertos o sesiones íntimas, experiencias con encanto (azoteas, miradores al atardecer, cenas con vistas, spas/relax), actividades pensadas para dos. También alimenta un filtro real del sitio ("qué hacer en pareja") — no lo dejes para lo que sobre de las demás categorías.

Cada elemento debe tener EXACTAMENTE estos campos:
- "titulo": string, corto y concreto
- "descripcion": string con 2-3 PÁRRAFOS separados por "\n\n" (doble salto de línea real dentro del string). Todos los planes tienen página propia, así que esto es el contenido principal, no una ficha de listado — no te cortes en longitud. Reparte el contenido así:
  - Párrafo 1: qué es el plan y por qué merece la pena, con contexto (histórico, cultural, del propio recinto...).
  - Párrafo 2: qué te vas a encontrar/hacer allí en concreto, con el máximo detalle real que puedas dar.
  - Párrafo 3 (opcional): consejos prácticos para la visita (cómo llegar, mejor momento del día, qué llevar) — solo si tienes algo concreto que aportar, no relleno genérico.
  Dentro del texto, marca en negrita con "**así**" (markdown) la información realmente relevante para decidir si ir: qué es exactamente el plan/lugar (su nombre propio), precio o si es gratis, horario o fecha límite, y cualquier requisito imprescindible (reserva obligatoria, aforo limitado, edad mínima). 2-4 negritas por párrafo, una por dato relevante — nunca marques adjetivos o frases de relleno, solo datos que alguien escaneando la página necesite ver sí o sí.
- "momento": "dia" | "noche"
- "vigencia": array de strings
- "audiencia": array — normalmente UN único valor de ["pareja", "familia", "generico"]; combina "pareja" y "familia" solo si el plan encaja excepcionalmente bien en los dos (poco frecuente), y no combines ninguno de los dos con "generico" (son alternativas, no se acumulan) — usa "generico" en solitario cuando el plan sirve para cualquier visitante sin un ángulo concreto
- "tipo": "excepcional" (evento puntual con fecha concreta) | "generico" (disponible siempre)
- "categoria": elige EXACTAMENTE una de esta lista: ${CATEGORIAS.join(", ")}. Usa "conciertos"/"exposiciones"/"teatro"/"monologos"/"deporte"/"ferias"/"fiestas"/"cine" solo cuando el plan sea genuinamente eso (ej. un partido o carrera es "deporte"; una feria del libro o mercadillo es "ferias"; una verbena, romería o cabalgata es "fiestas"; una proyección o ciclo de cine, incluido cine de verano al aire libre, es "cine"). Para todo lo demás (parques, rutas, gastronomía, monumentos sin espectáculo, danza/ópera/circo, charlas, fuegos artificiales...) usa "otros".
- "precio": para TODOS los planes, no solo los excepcionales — ej. "Entrada gratuita", "Desde 15€", "6€ adultos / 3€ niños". Muchos monumentos y recintos que parecen "de siempre" (Catedral, Alcázar, museos) en realidad cobran entrada: compruébalo siempre, no asumas que un plan genérico es gratis. Omite el campo solo si de verdad no encuentras el dato, nunca lo inventes ni lo asumas.
- "preguntas_frecuentes": array de 2-3 objetos {"pregunta": string, "respuesta": string}. Usa las preguntas que un visitante real se haría de este plan concreto (¿es gratis?, ¿es apto para niños?, ¿cuánto dura?, ¿hasta cuándo está disponible?, ¿hay que reservar?...). IMPORTANTE: la respuesta debe basarse ÚNICAMENTE en los datos que ya has puesto en los demás campos de este mismo plan (horario, precio, audiencia, fechas, descripción) — no metas ningún dato nuevo que no hayas dado ya arriba. Si no tienes base para una pregunta concreta, no la incluyas.

Además, SOLO para los planes con "tipo": "excepcional" (van a tener página propia con más detalle), añade estos campos cuando la información sea real y verificable — omite el campo si no la encuentras, no la inventes:
- "ubicacion": lugar concreto donde ocurre (ej. "Real Alcázar, Patio de Banderas")
- "horario": horario concreto (ej. "22:00h")
- "fecha_inicio" / "fecha_fin": rango de fechas del evento si lo conoces (ej. "15 de agosto de 2026" / "31 de agosto de 2026") — omite el que no sepas
- "fuente": SIEMPRE prioriza la fuente PRIMARIA/oficial (el ayuntamiento, la diputación, el recinto, el museo, la sala, el organizador real del evento) por encima de webs intermediarias (agendas culturales, blogs de "qué hacer en...", portales de noticias locales que solo republican la información). Si conoces la URL exacta de esa página oficial, ponla aquí (ej. "https://..."); si no tienes una URL fiable pero sí sabes qué institución es la organizadora real, pon su nombre (ej. "Ayuntamiento de Sevilla", "Diputación de Sevilla") en vez del nombre del portal donde lo hayas visto. Usa un agregador/intermediario como último recurso, solo si de verdad no puedes identificar quién organiza el evento.

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
    categoria: (CATEGORIAS as readonly string[]).includes(p.categoria ?? "") ? p.categoria : "otros",
  };
}

function normalizarPlanes(planes: unknown): PlanGenerado[] {
  if (!Array.isArray(planes)) return [];
  return (planes as PlanGenerado[]).map(normalizarPlan);
}

// Generación semanal (cron de los lunes): pide de una vez la agenda de toda
// la semana en vez de repetir la búsqueda cada día — cada evento real se
// redacta una sola vez, con su fecha real, y de ahí se derivan hoy/finde/
// esta semana por día (ver src/lib/semana.ts). Se piden más planes que en
// la generación diaria de antes porque tiene que cubrir 7 días, no 1.
export async function generarPlanesSemanales(
  municipioNombre: string,
  fechaLunesLegible: string,
  fechaDomingoLegible: string
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para la semana del ${fechaLunesLegible} al ${fechaDomingoLegible}.

Genera idealmente entre 20 y 35 planes que cubran TODA la semana (lunes a domingo) — es la agenda semanal completa, no la de un solo día, así que necesitas buena cobertura de días distintos entre semana además de fin de semana. Dicho esto, prioriza SIEMPRE la calidad y veracidad sobre acercarte a ese número: mejor 10 planes reales y bien verificados que 30 con relleno o fechas inventadas.

Para cada plan con "tipo": "excepcional", es OBLIGATORIO indicar "fecha_inicio" (y "fecha_fin" si dura más de un día) con una fecha real dentro de esta semana o que se solape con ella — sin esa fecha no se puede saber en qué día mostrarlo. Si no encuentras una fecha real y verificable para un evento puntual, no lo incluyas (usa un plan genérico en su lugar antes que inventar la fecha).

${INSTRUCCIONES_FORMATO}
`.trim();

  // Con listados largos (20-35 planes) Gemini falla a veces al devolver
  // JSON estrictamente válido — reintentar resuelve la inmensa mayoría de
  // los casos sin tener que renunciar a la semana completa.
  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const { texto, usage } = await llamarGemini(prompt);
    try {
      return { planes: normalizarPlanes(extraerJSON(texto)), usage };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("generarPlanesSemanales: no debería llegar aquí");
}

// Repaso diario (cron de martes a domingo): la semana ya se generó el
// lunes, así que esta llamada solo busca lo que se nos haya escapado o
// haya salido nuevo desde entonces — nunca vuelve a redactar lo que ya
// conocemos, que es justo lo que antes causaba duplicados (el mismo evento
// real con un título ligeramente distinto cada día).
export async function generarNovedades(
  municipioNombre: string,
  fechaHoyLegible: string,
  planesConocidos: string[],
  enfoqueFinde: boolean
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const listaConocidos =
    planesConocidos.length > 0 ? planesConocidos.map((t) => `- ${t}`).join("\n") : "(ninguno todavía)";

  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para hoy, ${fechaHoyLegible}.

Esta semana ya hemos encontrado y publicado estos planes — NO los repitas ni los redactes de nuevo aunque los vuelvas a encontrar en tu búsqueda:
${listaConocidos}

Busca EXCLUSIVAMENTE planes NUEVOS que no estén en esa lista: eventos de última hora, cambios de programación, o cosas que se nos pasaron. Si no encuentras nada realmente nuevo, devuelve un array vacío — no rellenes con planes genéricos ni repitas nada de la lista de arriba solo por devolver algo.
${enfoqueFinde ? "\nHoy es viernes: presta atención especial a la agenda de este sábado y domingo, que suele confirmarse o ampliarse a última hora." : ""}

Para cada plan con "tipo": "excepcional", indica "fecha_inicio" (y "fecha_fin" si aplica) con una fecha real — si no la encuentras, mejor omite el plan.

${INSTRUCCIONES_FORMATO}
`.trim();

  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const { texto, usage } = await llamarGemini(prompt);
    try {
      return { planes: normalizarPlanes(extraerJSON(texto)), usage };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("generarNovedades: no debería llegar aquí");
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

  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const { texto, usage } = await llamarGemini(prompt);
    try {
      const planes = normalizarPlanes(extraerJSON(texto));
      // La consulta de la página de mes busca el slug exacto ("agosto") dentro
      // de "vigencia" — Gemini casi siempre escribe una frase humana en su
      // lugar ("agosto de 2026"), así que se añade aquí el tag exacto sin
      // depender de que lo respete el prompt.
      return {
        planes: planes.map((p) => ({
          ...p,
          vigencia: p.vigencia.includes(mesSlug) ? p.vigencia : [...p.vigencia, mesSlug],
        })),
        usage,
      };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("generarPlanesDelMes: no debería llegar aquí");
}

// Google Places puntúa "buen sitio en general", no "famoso concretamente
// por esto" — un restaurante de moda con miles de reseñas puede colarse
// primero en un ranking de "mejores croquetas" sin ser especialmente
// conocido por ellas. Este paso decide QUIÉN entra (fama real específica,
// buscada de verdad, no solo popularidad) y en qué orden; Places después
// solo verifica que cada candidato existe y cumple el mínimo de calidad —
// no reordena por rating (ver verificarLugarPorNombre en places.ts).
export async function buscarCandidatosPorTema(
  municipioNombre: string,
  tema: string
): Promise<{ nombres: string[]; usage: UsoTokens }> {
  const prompt = `
Eres un experto local que conoce a fondo ${municipioNombre} (España) en la categoría de "${tema}". Busca activamente en fuentes reales (guías especializadas, blogs, prensa local, foros, rankings previos) para identificar qué sitios tienen fama GENUINA Y ESPECÍFICA por "${tema}".

No basta con que sean sitios buenos o populares en general — tienen que ser conocidos CONCRETAMENTE por esto. Un sitio de moda con muchas reseñas pero sin fama particular en "${tema}" no vale; un sitio menos conocido en general pero al que la gente acude específicamente por esto sí.

Devuelve entre 15 y 20 candidatos reales (que existan de verdad, con el nombre exacto tal y como aparece en Google Maps), ordenados de MÁS a MENOS fama/reconocimiento específico para "${tema}". Mejor menos candidatos genuinamente especializados que rellenar con sitios genéricos solo por llegar al número.

Devuelve EXCLUSIVAMENTE un array JSON de strings con los nombres exactos, sin texto adicional ni bloques de markdown. Ejemplo: ["Nombre exacto 1", "Nombre exacto 2"]
`.trim();

  // Igual que en escribirFichasLugares: Gemini falla a veces de forma
  // puramente intermitente (a la petición siguiente, idéntica, le va bien)
  // — un par de reintentos evita perder el listado entero por eso.
  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const { texto, usage } = await llamarGemini(prompt);
      const nombres = extraerJSON(texto);
      if (!Array.isArray(nombres)) {
        if (intento === INTENTOS) return { nombres: [], usage };
        continue;
      }
      const validos = nombres.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
      if (validos.length === 0 && intento < INTENTOS) continue;
      return { nombres: validos, usage };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("buscarCandidatosPorTema: no debería llegar aquí");
}

export interface FichaLugarGenerada {
  descripcion: string;
  motivo: string;
}

// Los datos objetivos (rating, dirección, nº de reseñas...) ya vienen
// verificados de Google Places — aquí solo se le pide a Gemini el texto,
// nunca que invente cifras. Se manda la lista completa en un único prompt
// (en vez de uno por restaurante) para que la redacción no repita las mismas
// frases de un puesto a otro y para minimizar llamadas.
export async function escribirFichasLugares(
  municipioNombre: string,
  tema: string,
  candidatos: CandidatoLugar[]
): Promise<{ fichas: FichaLugarGenerada[]; usage: UsoTokens }> {
  const listado = candidatos
    .map(
      (c, i) =>
        `${i + 1}. ${c.nombre} — ${c.direccion ?? "dirección no disponible"} — ${c.rating ?? "?"}★ (${c.numValoraciones ?? 0} reseñas)`
    )
    .join("\n");

  const prompt = `
Eres un crítico local que conoce bien ${municipioNombre} (España). Te paso una lista de sitios reales, con datos ya verificados de Google Maps, para un ranking sobre "${tema}". Busca información real de cada uno (su web, reseñas, prensa local, lo que se diga de él) para escribir una ficha con contenido de verdad, no una descripción genérica de relleno.

${listado}

Para cada uno, en el MISMO ORDEN, escribe:

- "descripcion": ficha completa del sitio en 2 PÁRRAFOS separados por "\\n\\n" (doble salto de línea real dentro del string), para su página propia — independiente del ranking, información que siga siendo válida si apareciera en otro listado distinto. Sé todo lo concreto que puedas con datos reales que encuentres (especialidad, estilo, ambiente, historia si la tiene, qué lo distingue de otros similares); si de verdad no encuentras nada específico más allá del nombre y la categoría, dilo con generalidades honestas del tipo de sitio, nunca inventando detalles concretos (platos, precios, anécdotas, premios) que no puedas verificar.
  - Párrafo 1: qué es exactamente, su especialidad u oferta principal, y qué tipo de ambiente o público tiene.
  - Párrafo 2: qué te vas a encontrar en concreto si vas — lo más característico o recomendable, y cualquier dato práctico real que sepas (por ejemplo si es buena idea reservar, si suele haber cola, el tipo de experiencia).
  Marca en negrita con "**así**" (markdown) los datos más relevantes para decidir — su nombre propio, su especialidad concreta, cualquier dato práctico verificable — 2-3 negritas por párrafo, nunca adjetivos de relleno.
- "motivo": 1-2 frases específicas de por qué destaca en concreto para "${tema}" — qué lo hace sobresalir en eso en particular, en un tono que suene a recomendación de alguien que lo conoce, no a ficha genérica.

No inventes ni cambies datos objetivos (rating, número de reseñas, dirección, precio) — usa solo los que ya te he dado. No cites textualmente ninguna reseña, web o fuente — parafrasea siempre con tus propias palabras.

Importante para que el JSON sea válido: NUNCA uses el carácter de comillas dobles (") dentro de "descripcion" ni "motivo", bajo ningún concepto — ni para citar, ni para nombres de sitios, ni por énfasis. Si quieres resaltar algo, usa negrita (**así**), nunca comillas.

Devuelve EXCLUSIVAMENTE un array JSON de ${candidatos.length} elementos, en el mismo orden que la lista, con este formato exacto por elemento:
{"descripcion": "...", "motivo": "..."}

Sin texto adicional ni bloques de markdown.
`.trim();

  // Con textos tan largos (2 párrafos por sitio, hasta 10 sitios) Gemini
  // falla a veces al devolver JSON estrictamente válido (alguna comilla sin
  // escapar) — reintentar resuelve la inmensa mayoría de los casos sin
  // tener que tirar todo el listado.
  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const { texto, usage } = await llamarGemini(prompt);
    try {
      const fichas = extraerJSON(texto);
      if (!Array.isArray(fichas)) return { fichas: [], usage };
      return { fichas: fichas as FichaLugarGenerada[], usage };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("escribirFichasLugares: no debería llegar aquí");
}

export interface IntroListadoGenerada {
  descripcion: string;
  preguntas_frecuentes: PreguntaFrecuente[];
}

// El listado en sí (no cada lugar) necesita su propia intro — es lo único
// de la página que habla del tema en conjunto (por qué importa en esta
// ciudad, qué se puede esperar) en vez de sitio por sitio, y hasta ahora no
// se generaba nunca (el campo "descripcion" de `listados` se quedaba
// vacío). Las FAQ, además de rellenar contenido único por página, son el
// formato que mejor citan los motores de IA (GEO): preguntas y respuestas
// concretas y autocontenidas.
export async function escribirIntroYFaqListado(
  municipioNombre: string,
  tema: string,
  top3: { nombre: string; motivo: string }[]
): Promise<{ intro: IntroListadoGenerada; usage: UsoTokens }> {
  const listadoTop3 = top3.map((p, i) => `${i + 1}. ${p.nombre} — ${p.motivo}`).join("\n");

  const prompt = `
Eres un editor local que conoce bien ${municipioNombre} (España). Estás escribiendo la página de un ranking sobre "${tema}". Ya tienes el ranking hecho — esto es solo la introducción general y las preguntas frecuentes, no una ficha de ningún sitio en concreto.

Los 3 primeros puestos del ranking, para que tengas contexto real (no los repitas literalmente, solo úsalos para que la intro suene informada):
${listadoTop3}

Escribe:
- "descripcion": 2 PÁRRAFOS separados por "\\n\\n" (doble salto de línea real dentro del string) sobre el tema en conjunto en ${municipioNombre} — no sobre ningún sitio concreto. Párrafo 1: por qué "${tema}" es relevante o tiene tradición/interés en esta ciudad. Párrafo 2: qué puede esperar alguien que use este ranking (cómo está pensado, qué tipo de sitios va a encontrar). No inventes datos históricos o estadísticos que no puedas verificar — si no tienes algo concreto que decir, sé honesto con generalidades razonables del tema en esta ciudad.
- "preguntas_frecuentes": array de 3-4 objetos {"pregunta": string, "respuesta": string} con las preguntas reales que alguien buscaría sobre "${tema}" en ${municipioNombre} (ej. cómo se elabora este ranking, qué diferencia a los primeros puestos, con qué frecuencia se actualiza, qué tener en cuenta al elegir). La respuesta debe basarse solo en lo que ya sabemos (el criterio del ranking, los datos verificados de Google Maps) — no inventes cifras ni datos nuevos.

Importante para que el JSON sea válido: NUNCA uses el carácter de comillas dobles (") dentro de "descripcion" ni dentro de "pregunta"/"respuesta" — usa negrita (**así**) si quieres resaltar algo, nunca comillas.

Devuelve EXCLUSIVAMENTE un objeto JSON con este formato exacto:
{"descripcion": "...", "preguntas_frecuentes": [{"pregunta": "...", "respuesta": "..."}]}

Sin texto adicional ni bloques de markdown.
`.trim();

  const INTENTOS = 3;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const { texto, usage } = await llamarGemini(prompt);
    try {
      const intro = extraerJSON(texto) as IntroListadoGenerada;
      if (!Array.isArray(intro.preguntas_frecuentes)) intro.preguntas_frecuentes = [];
      return { intro, usage };
    } catch (err) {
      if (intento === INTENTOS) throw err;
    }
  }
  throw new Error("escribirIntroYFaqListado: no debería llegar aquí");
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
