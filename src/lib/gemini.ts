import { CATEGORIAS, type Audiencia, type Categoria, type Momento, type TipoPlan } from "./types";
import type { CandidatoLugar } from "./places";
import { esFechaEspanolaValida } from "./dates";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Modelo aparte, más barato, SOLO para traducirPlanesAIngles — traducir un
// texto que ya está terminado en español es una tarea mucho más sencilla
// que la búsqueda+redacción real (que sí justifica pagar el Flash completo,
// ver GEMINI_MODEL), así que no necesita ni grounding ni el modelo caro.
// Pinneado a una versión explícita, no un alias "-latest" (ver conversación:
// los alias han dado problemas reales de estabilidad). Probado en directo
// contra gemini-3.1-flash-lite y gemini-3.5-flash-lite con el mismo prompt
// real de traducción: 3.1 tradujo mejor (3.5 dejó "El" sin traducir al
// principio de una frase) y además es más barato — no hace falta "thinking"
// para esto, ninguno de los dos lo activa por defecto.
const MODELO_TRADUCCION = "gemini-3.1-flash-lite";

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
  // 1-10, qué tan atractivo es este plan frente a otros parecidos — ver
  // CAMPOS_JSON. Alimenta el orden de los listados largos (ej. "todo lo que
  // puedes hacer todo el año"), donde no hay vigencia que ya los acote.
  relevancia?: number;
  preguntas_frecuentes?: PreguntaFrecuente[];
  // Solo relevantes cuando tipo="excepcional": alimentan la página de
  // detalle propia de ese evento (ver src/lib/eventos.ts).
  ubicacion?: string;
  horario?: string;
  precio?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  fuente?: string;
  // Solo para planes de generarPlanesZonaCercana: el plan no está en el
  // municipio de la página, sino en un pueblo/zona cerca de él — ver
  // conversación. zona_cercana es el nombre real de ese lugar (nunca uno
  // de los municipios que ya tienen página propia).
  zona_cercana?: string;
  zona_cercana_minutos?: number;
  // Solo para "generico" con patrón semanal fijo (ej. un mercadillo que
  // solo existe los jueves) — días 0-6 (0=domingo…6=sábado) en que
  // realmente aplica. Omitir para lo que está disponible cualquier día —
  // ver conversación, migración 0019.
  dias_semana?: number[];
  // Traducción al inglés — no la rellena Gemini en la generación normal,
  // se añade después con traducirPlanesAIngles() y se fusiona aquí antes
  // de guardar (ver conversación, migración 0020). Ubicación y horario no
  // llevan versión en inglés (nombres propios y horas).
  titulo_en?: string;
  descripcion_en?: string;
  precio_en?: string;
  preguntas_frecuentes_en?: PreguntaFrecuente[];
  // Procedencia real del contenido — no la decide Gemini, se estampa en
  // código tras recibir la respuesta (ver generarPlanesDesdeListado).
  // undefined en el resto de generadores equivale a "gemini" (ver
  // upsertEventosDelLote). Ver conversación: distingue en el artifact de
  // revisión qué llegó por búsqueda de Gemini y qué por importación manual
  // de un listado externo verificado.
  origen?: "gemini" | "externo";
}

interface UsoTokens {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  // Tokens de "thinking" (razonamiento interno del modelo antes de
  // responder) — gemini-3.6-flash lo usa por defecto sin que el código lo
  // pida, y Google lo factura al precio de OUTPUT, no aparte. Se
  // descubrió que faltaba en estimarCoste probando la traducción al
  // inglés: para 2 planes pequeños salieron 1947 tokens de pensamiento
  // frente a 181 de salida visible — el coste real era ~8x el reportado
  // (ver conversación). Sin esto, generation_log llevaba tiempo
  // subestimando el gasto de TODAS las llamadas, no solo la traducción.
  thoughtsTokenCount?: number;
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
    // Restos de marcadores de cita del grounding (ej. "[1]", "[1.1.1]", y
    // citas múltiples "[1, 2, 5]" cuando un mismo dato viene respaldado por
    // varias fuentes a la vez — mucho más frecuente en municipios grandes
    // con mucho contenido real y citable, como Sevilla, que en un pueblo
    // pequeño; sin cubrir esta variante, la coma suelta dentro del corchete
    // rompía el JSON justo donde se esperaba una coma o un cierre de llave,
    // ver conversación) que a veces se cuelan en medio del texto.
    .replace(/\[\s*\d+(?:\.\d+)*(?:\s*,\s*\d+(?:\.\d+)*)*\s*\]/g, "");
  return JSON.parse(escaparControlesDentroDeStrings(limpio));
}

async function llamarGemini(
  prompt: string,
  // Traducir no necesita buscar nada nuevo (el contenido real ya se
  // encontró en la llamada de generación) — desactivar el grounding en ese
  // caso ahorra su coste y simplifica el prompt, sin perder nada (ver
  // conversación sobre la traducción al inglés).
  conGrounding = true,
  // Solo traducirPlanesAIngles pasa MODELO_TRADUCCION aquí — el resto de
  // llamadas (vía llamarGeminiConReintentos) usan el modelo por defecto.
  modelo = GEMINI_MODEL
): Promise<{ texto: string; usage: UsoTokens }> {
  if (!GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en las variables de entorno");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

  // NOTA: el nombre del tool de grounding con Google Search ha cambiado
  // entre generaciones de modelo (googleSearchRetrieval -> google_search).
  // Verifica el valor correcto para GEMINI_MODEL en ai.google.dev antes de
  // desplegar a producción.
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(conGrounding ? { tools: [{ google_search: {} }] } : {}),
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

// Bloque de esquema JSON compartido por la búsqueda mixta (generarPlanesSemanales/
// generarNovedades/generarPlanesDelMes) y las búsquedas dedicadas por variable
// (generarPlanesEnfocados) — la lista de campos y sus reglas es la misma en
// los dos casos, solo cambia lo que se les pide buscar antes de esto.
function camposJson(municipioNombre: string, municipiosExcluidos: string[] = []): string {
  const notaExcluidos =
    municipiosExcluidos.length > 0
      ? ` Distingue según el "tipo" cuando la zona cercana resulte ser ${municipiosExcluidos.join(", ")} (municipios que ya cubrimos con su propia agenda dedicada en este mismo sitio): si el plan es "generico" (evergreen, sin fecha), NO lo incluyas — su catálogo de siempre ya está cubierto en la página propia de ese municipio, y repetirlo aquí sería un duplicado. Si el plan es "excepcional" (puntual, con fecha concreta) SÍ puedes incluirlo aunque esté en uno de esos municipios, siempre que sea genuinamente relevante e interesante — un evento puntual real en un municipio vecino no es un duplicado de su catálogo, es información útil para quien vive en ${municipioNombre}.`
      : "";
  return `
Cada elemento debe tener EXACTAMENTE estos campos:
- "titulo": string, corto y concreto. Si el plan es en realidad una visita de pago a un monumento/museo/recinto (necesita entrada, aunque sea gratuita con reserva), el título NO debe empezar por "Paseo" ni "Recorrido libre" — eso suena a caminar sin más, y confunde justo con el tipo de plan que se quiere evitar (ver más abajo). Usa "Visita a...", "Recorrido por..." (sin "libre") o el nombre del lugar directamente. Reserva "Paseo" para cuando el plan sea de verdad eso: caminar por una calle, parque o zona sin entrada ni recorrido guiado.
- "descripcion": string con 2-3 PÁRRAFOS separados por "\n\n" (doble salto de línea real dentro del string). Todos los planes tienen página propia, así que esto es el contenido principal, no una ficha de listado — no te cortes en longitud. Reparte el contenido así:
  - Párrafo 1: qué es el plan y por qué merece la pena, con contexto (histórico, cultural, del propio recinto...).
  - Párrafo 2: qué te vas a encontrar/hacer allí en concreto, con el máximo detalle real que puedas dar.
  - Párrafo 3 (opcional): consejos prácticos para la visita (cómo llegar, mejor momento del día, qué llevar) — solo si tienes algo concreto que aportar, no relleno genérico.
  Dentro del texto, marca en negrita con "**así**" (markdown) la información realmente relevante para decidir si ir: qué es exactamente el plan/lugar (su nombre propio), precio o si es gratis, horario o fecha límite, y cualquier requisito imprescindible (reserva obligatoria, aforo limitado, edad mínima). 2-4 negritas por párrafo, una por dato relevante — nunca marques adjetivos o frases de relleno, solo datos que alguien escaneando la página necesite ver sí o sí.
- "momento": "dia" | "noche"
- "vigencia": array de strings
- "audiencia": array — normalmente UN único valor de ["pareja", "familia", "generico"]; combina "pareja" y "familia" solo si el plan encaja excepcionalmente bien en los dos (poco frecuente), y no combines ninguno de los dos con "generico" (son alternativas, no se acumulan) — usa "generico" en solitario cuando el plan sirve para cualquier visitante sin un ángulo concreto
- "tipo": "excepcional" (evento puntual con fecha concreta) | "generico" (disponible de verdad TODO el año, cualquier mes). "generico" NO es un cajón de sastre para "no tengo una fecha exacta que ponerle" — un programa o ciclo que solo existe en una temporada concreta (ej. un ciclo de conciertos "de verano", unas "noches" estivales en un patio o jardín, una feria o mercadillo que solo se monta en unas fechas) sigue sin estar disponible siempre aunque no sepas el día exacto de cada sesión: para eso, o encuentras la fecha real de una sesión/edición concreta y lo metes como "excepcional", o lo dejas fuera por completo — nunca lo describas como si fuera un plan de todo el año. Reserva "generico" para lo que de verdad puedes visitar en cualquier época (un monumento, un museo, un parque, un mercado permanente, una ruta) — no para la versión "genérica" de algo que en realidad es estacional.
- "dias_semana": SOLO para "generico" con un patrón semanal FIJO — existe todas las semanas del año, pero solo en uno o varios días concretos de esa semana (ej. un mercadillo o rastro que solo se monta los jueves, una feria semanal de los domingos). Array de enteros 0-6 (0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado) con esos días exactos (ej. [4] para "solo jueves"). Omite este campo por completo si el plan está disponible cualquier día (la inmensa mayoría de genéricos) — no lo rellenes "por si acaso", solo cuando de verdad solo aplica días concretos de la semana.
- "categoria": elige EXACTAMENTE una de esta lista: ${CATEGORIAS.join(", ")}. Usa "conciertos"/"exposiciones"/"teatro"/"monologos"/"deporte"/"ferias"/"fiestas"/"cine" solo cuando el plan sea genuinamente eso (ej. un partido o carrera es "deporte"; una feria del libro o mercadillo es "ferias"; una verbena, romería o cabalgata es "fiestas"; una proyección o ciclo de cine, incluido cine de verano al aire libre, es "cine"). "conciertos" incluye también festivales de música (aunque duren varios días), espectáculos musicales y cualquier plan centrado en música en vivo, no solo un concierto suelto de un artista. Para todo lo demás (parques, rutas, gastronomía, monumentos sin espectáculo, danza/ópera/circo, charlas, fuegos artificiales...) usa "otros".
- "precio": para TODOS los planes, no solo los excepcionales — ej. "Entrada gratuita", "Desde 15€", "6€ adultos / 3€ niños". Muchos monumentos y recintos que parecen "de siempre" (Catedral, Alcázar, museos) en realidad cobran entrada: compruébalo siempre, no asumas que un plan genérico es gratis. Muchos museos, palacios y monumentos además tienen condiciones de entrada gratuita que no son "todo gratis" ni "todo de pago" — compruébalas y refléjalas con precisión en vez de simplificar: si existe una franja realmente abierta a cualquier visitante (un día y hora concretos, con o sin reserva previa, aunque tenga aforo limitado), empieza el texto por "Gratis" y añade la condición (ej. "Gratis los viernes a las 10:00 (solo planta baja)", "Gratis los lunes de 15:00 a 19:00 con reserva previa; el resto de días 10€"); si en cambio la entrada gratuita es solo para un colectivo concreto (residentes empadronados en la ciudad, estudiantes, menores de cierta edad, clientes de una entidad, ciudadanos UE en museos estatales...) mientras el visitante habitual paga, NO empieces por "Gratis" — indica primero el precio general y la excepción después (ej. "10€ (gratis para empadronados en Sevilla y menores de 12 años)"): sigue siendo un dato valioso que mostrar, pero no es gratis para cualquiera. Omite el campo solo si de verdad no encuentras el dato, nunca lo inventes ni lo asumas.
- "ubicacion": para TODOS los planes, no solo los excepcionales — lugar físico concreto donde ocurre o se encuentra, si es un sitio fijo e identificable (un parque, un museo, un monumento, una sala también llevan este campo, igual que un evento puntual). Usa siempre el NOMBRE OFICIAL COMPLETO del lugar, tal como aparece en mapas o en su web oficial — nunca una abreviatura, sigla o apodo (ej. "Centro Andaluz de Arte Contemporáneo", nunca "CAAC"; "Real Alcázar de Sevilla", no solo "el Alcázar"): un nombre real pero mal recortado hace que luego no se pueda localizar en el mapa. Omite el campo si el plan no ocurre en un lugar fijo (una ruta sin sede concreta, una actividad genérica "por la ciudad") o si no tienes el dato con certeza.
- "zona_cercana" / "zona_cercana_minutos": estás buscando principalmente DENTRO de ${municipioNombre}, pero si en el camino encuentras un plan real e interesante a MENOS DE 15 MINUTOS EN COCHE que en realidad ocurre en un pueblo, pedanía o zona cercana (NO dentro de ${municipioNombre} mismo), inclúyelo igualmente — no lo descartes por eso, siempre que esté dentro de ese radio — pero es OBLIGATORIO marcarlo con estos dos campos para que no se confunda con un plan del propio ${municipioNombre}: "zona_cercana" es el nombre real de ese lugar (ej. "Villanueva del Ariscal"), nunca "${municipioNombre}"; "zona_cercana_minutos" es un entero con los minutos aproximados en coche desde ${municipioNombre} hasta allí (nunca más de 15). Si el plan SÍ está dentro de ${municipioNombre}, omite los dos campos por completo. Los planes propios de ${municipioNombre} siguen teniendo prioridad sobre estos — esto es solo para no dejar fuera algo real e interesante a un paso de la ciudad cuando la propia agenda se queda corta.${notaExcluidos}
- "fuente": para TODOS los planes, no solo los excepcionales — un plan genérico que requiere reserva o entrada (ej. "previa reserva", "Desde 25€") es igual de inútil sin saber dónde reservar que un evento puntual sin esa información. SIEMPRE prioriza la fuente PRIMARIA/oficial (el ayuntamiento, la diputación, el recinto, el museo, la sala, el organizador real) por encima de webs intermediarias (agendas culturales, blogs de "qué hacer en...", portales de noticias locales que solo republican la información). Si conoces la URL exacta de esa página oficial, ponla aquí (ej. "https://..."); si no tienes una URL fiable pero sí sabes qué institución es la organizadora real, pon su nombre (ej. "Ayuntamiento de Sevilla", "Diputación de Sevilla") en vez del nombre del portal donde lo hayas visto. Usa un agregador/intermediario como último recurso, solo si de verdad no puedes identificar quién organiza el evento. Omite el campo si de verdad no encuentras ninguna fuente fiable.
- "relevancia": entero del 1 al 10 — qué tan atractivo es este plan frente a otros parecidos de la misma ciudad, para alguien sin preferencias previas. Sé exigente y usa el rango completo, no lo comprimas todo en 7-8: la mayoría de planes genéricos habituales (un parque cualquiera, una plaza, una ruta sin nada que lo distinga) deberían quedar entre 3 y 6; reserva 8-10 para lo realmente singular, icónico o con un tirón claro (un monumento emblemático, una experiencia que no se encuentra en cualquier ciudad, un evento con mucha expectación). Dentro de lo genérico, no vale lo mismo cualquier cosa: una visita guiada a un monumento o edificio CONCRETO y con nombre propio (ej. "Visita a las Cubiertas de la Catedral", "Visita al Hospital de los Venerables") pesa más que una actividad-tipo genérica (una ruta en kayak, un paseo en bici, un "tapeo y mercado tradicional") que podría pasar en casi cualquier ciudad con río o mercado — aunque las dos estén "siempre disponibles", la primera está anclada a algo único de esta ciudad concreta, la segunda es más una categoría de actividad replicable que un lugar irrepetible. Esto se usa para ordenar listados largos donde ya no hay más criterio que "cuál merece más la pena" — una nota blanda que no diferencia nada no sirve de nada.
- "preguntas_frecuentes": array de 2-3 objetos {"pregunta": string, "respuesta": string}. Usa las preguntas que un visitante real se haría de este plan concreto (¿es gratis?, ¿es apto para niños?, ¿cuánto dura?, ¿hasta cuándo está disponible?, ¿hay que reservar?...). IMPORTANTE: la respuesta debe basarse ÚNICAMENTE en los datos que ya has puesto en los demás campos de este mismo plan (horario, precio, audiencia, fechas, descripción) — no metas ningún dato nuevo que no hayas dado ya arriba. Si no tienes base para una pregunta concreta, no la incluyas.

Además, SOLO para los planes con "tipo": "excepcional" (van a tener página propia con más detalle), añade estos campos cuando la información sea real y verificable — omite el campo si no la encuentras, no la inventes:
- "horario": horario concreto (ej. "22:00h")
- "fecha_inicio" / "fecha_fin": rango de fechas del evento si lo conoces (ej. "15 de agosto de 2026" / "31 de agosto de 2026") — omite el que no sepas. IMPORTANTE: esto es para un evento/ciclo/exposición concreto (normalmente días o pocas semanas), NUNCA para la temporada operativa completa de un recinto (ej. "el parque abre de abril a noviembre") — un rango de varios MESES no es un evento puntual, es que el sitio funciona así todo ese tiempo. Si lo único que tienes es "esta temporada dura de tal mes a tal otro" sin una sesión, edición o programación concreta dentro de ese rango, no lo metas como "excepcional": descríbelo como "generico" (sin fecha) en su lugar, o busca la fecha real de algo puntual que ocurra ahí (una noche concreta, un espectáculo con fecha, un evento especial dentro de esa temporada).

Devuelve EXCLUSIVAMENTE el array JSON, sin texto adicional ni bloques de markdown.
`.trim();
}

// Instrucciones para la búsqueda MIXTA (varias temáticas y "generico" de
// relleno a la vez) — la usan generarPlanesSemanales/generarNovedades/
// generarPlanesDelMes. Las búsquedas dedicadas por variable
// (generarPlanesEnfocados) usan camposJson directamente, sin este bloque.
function instruccionesFormato(municipioNombre: string, municipiosExcluidos: string[] = []): string {
  return `
Orden de prioridad, en este orden estricto:
1. Primero, todos los eventos puntuales y temporales que encuentres (agenda concreta con fecha) DENTRO de ${municipioNombre} mismo. Estos van "tipo": "excepcional".

${TIPOS_EVENTO_PUNTUAL}

2. Solo si no encuentras suficientes eventos puntuales verificables para llegar a 10 planes, completa el resto con planes genéricos de calidad, disponibles siempre. Estos van "tipo": "generico". Busca variedad real de TIPO de lugar, no solo de actividad — como referencia orientativa (no una lista cerrada ni obligatoria), piensa en monumentos, palacios, conventos, museos, iglesias, mercados, parques/jardines, rincones únicos poco conocidos, ferias/fiestas tradicionales y calles o barrios con carácter propio. No excluyas los monumentos o museos más conocidos de la ciudad solo por ser conocidos — un lugar concreto con nombre propio (aunque sea obvio) aporta más que una actividad-tipo genérica sin anclaje real (ver el criterio de "relevancia" más abajo). Lo que sí evita es meter el MISMO lugar real dos veces disfrazado de actividades distintas (ej. no listes "Parque de María Luisa" tanto como "paseo botánico" y como "inmersión histórica" — es el mismo sitio: cuenta una sola vez, con el ángulo que mejor lo represente).

El público objetivo de este sitio es gente que YA VIVE en la ciudad, no turistas — evita planes pensados sobre todo para visitantes de fuera y con poco interés real para un vecino (un tablao flamenco genérico, un espectáculo "típico" para turistas), salvo que haya algo puntual y genuinamente noticiable ahí (en ese caso sí entra, como evento puntual). Dentro de los genéricos, prioriza planes "dinámicos" que impliquen entrar a un sitio concreto o hacer algo — una visita con entrada, un museo, una actividad, una experiencia — frente a un simple paseo por una calle o barrio sin más contenido que caminar (ej. "paseo por la Calle X"): un plan así de "paseo sin más" es el último recurso, solo si no hay suficientes alternativas con entrada/actividad real, y nunca el primero de la lista.

Los planes "generico" deben ir siempre al final del array, después de todos los "excepcional". No inventes eventos puntuales que no existan solo por rellenar — ante la duda, usa un plan genérico real en su lugar.

Dentro de cada uno de esos dos bloques (excepcional / generico), ordena de MAYOR a MENOR popularidad o interés esperado — el evento más multitudinario o relevante primero, el más de nicho al final. Además:
- Procura variedad real de temática entre los eventos puntuales: si encuentras 8 conciertos y ningún otro tipo, busca más en las demás categorías antes de rendirte — no llenes el listado a base de repetir el mismo tipo de plan.
- Sé preciso con "audiencia" — no la trates como una lista de "a quién le podría gustar esto", sino como "para quién es este plan sobre todo". Márcalo "pareja" en dos casos, dando más peso al primero: (1) tiene un ángulo claro romántico (una cata de vino nocturna, un concierto de jazz íntimo, una cena con vistas, un atardecer, cualquier plan explícitamente descrito como romántico aunque no sea la típica "cita"); o (2), sin ese ángulo romántico explícito, es un plan cultural, de ocio o de entretenimiento que funciona bien como salida en pareja — una exposición, un concierto, una obra de teatro, un monólogo, una cata, una proyección de cine — no hace falta que sea "de cita" para marcarlo así, basta con que sea un plan que dos personas disfrutarían haciendo juntas. Si es claramente pensado para ir con niños (un espectáculo infantil, un parque temático, un taller familiar) márcalo SOLO "familia". No le añadas "generico" a la vez a un plan que ya lleva "pareja" o "familia" — son alternativas, no se acumulan. Reserva "generico" para planes de infraestructura o rutina sin ningún ángulo hacia una audiencia concreta (un parque cualquiera, una plaza, un mercado, una ruta sin nada que la haga especialmente de pareja) y para eventos multitudinarios sin componente de experiencia compartida más allá de estar entre el público (un gran partido, una romería masiva). Esta etiqueta se usa para filtrar planes por audiencia en el sitio; no la apliques por inercia a cualquier plan cultural solo porque "podría valer" — resérvala para los que de verdad tienen ese carácter de salida compartida, o el filtro deja de servir de nada.

${camposJson(municipioNombre)}
`.trim();
}

// Gemini no tiene un esquema forzado (pedimos JSON libre en el prompt), así
// que de vez en cuando devuelve un valor fuera de la lista permitida en
// "momento", "tipo" o "audiencia". Sin esto, una sola fila rara rompe el
// insert de TODO el lote del municipio (el check constraint de Postgres
// rechaza el array entero).
function normalizarPlan(p: PlanGenerado): PlanGenerado {
  const audienciaValida = (Array.isArray(p.audiencia) ? p.audiencia : []).filter(
    (a): a is Audiencia => a === "pareja" || a === "familia" || a === "generico"
  );

  // Gemini a veces omite el año ("2 de diciembre" en vez de "2 de
  // diciembre de 2026") — guardar esa fecha a medias es peor que no
  // guardar ninguna: el resto del código no puede distinguir después "no
  // sé cuándo es" de "sé cuándo es pero no lo interpreté bien", y un
  // evento puntual de un mes futuro acababa colándose en listados de la
  // semana actual (ver conversación). Se corta aquí, antes de guardar nada.
  const fechaInicioValida = p.fecha_inicio && esFechaEspanolaValida(p.fecha_inicio) ? p.fecha_inicio : undefined;
  const fechaFinValida = p.fecha_fin && esFechaEspanolaValida(p.fecha_fin) ? p.fecha_fin : undefined;

  // Solo válido para "generico": enteros 0-6 sin duplicados. Un array
  // vacío o inválido no es distinto de omitirlo — sin restricción.
  const diasSemanaValidos =
    p.tipo === "generico" && Array.isArray(p.dias_semana)
      ? Array.from(new Set(p.dias_semana.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)))
      : [];

  return {
    ...p,
    momento: p.momento === "noche" ? "noche" : "dia",
    tipo: p.tipo === "excepcional" ? "excepcional" : "generico",
    audiencia: audienciaValida.length > 0 ? audienciaValida : ["generico"],
    vigencia: Array.isArray(p.vigencia) ? p.vigencia : [],
    categoria: (CATEGORIAS as readonly string[]).includes(p.categoria ?? "") ? p.categoria : "otros",
    fecha_inicio: fechaInicioValida,
    fecha_fin: fechaFinValida,
    dias_semana: diasSemanaValidos.length > 0 ? diasSemanaValidos : undefined,
  };
}

function normalizarPlanes(planes: unknown): PlanGenerado[] {
  if (!Array.isArray(planes)) return [];
  return (planes as PlanGenerado[]).map(normalizarPlan);
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Reintenta tanto si la llamada HTTP falla (ej. 503 "alta demanda" — más
// probable ahora que se lanzan varias llamadas a la vez por municipio, ver
// conversación) como si el JSON que devuelve no es válido. Antes cada
// función reintentaba solo lo segundo, con la llamada a llamarGemini fuera
// del try/catch.
async function llamarGeminiConReintentos(
  prompt: string,
  nombreFn: string,
  intentos = 4
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  let ultimoError: unknown;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const { texto, usage } = await llamarGemini(prompt);
      return { planes: normalizarPlanes(extraerJSON(texto)), usage };
    } catch (err) {
      ultimoError = err;
      // Espera creciente + aleatoria: con varias llamadas a la vez por
      // municipio (búsqueda mixta + enfocadas), si todas reintentan al
      // mismo ritmo vuelven a chocar juntas contra el mismo límite de
      // demanda — el jitter las desincroniza.
      if (intento < intentos) await esperar(2000 * intento + Math.round(Math.random() * 2000));
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error(`${nombreFn}: no debería llegar aquí`);
}

export interface TraduccionPlan {
  titulo_en?: string;
  descripcion_en?: string;
  precio_en?: string;
  preguntas_frecuentes_en?: PreguntaFrecuente[];
}

// Traduce el lote ya generado (en español) a inglés, en una sola llamada
// para toda la tanda en vez de una por plan — ver conversación: para
// posicionar en SEO en inglés de verdad hace falta que el contenido esté
// traducido de antemano (no "al vuelo" cuando alguien visita, que llega
// tarde para el rastreador de Google). No necesita buscar nada nuevo (el
// contenido real ya se encontró en la llamada de generación), así que va
// sin grounding — más barato y el prompt es mucho más simple. Ubicación y
// horario no se traducen (nombres propios y horas, iguales en los dos
// idiomas). Devuelve un array del MISMO tamaño y en el MISMO orden que
// `planes`, para poder emparejar por índice sin ambigüedad.
export async function traducirPlanesAIngles(
  planes: PlanGenerado[]
): Promise<{ traducciones: TraduccionPlan[]; usage: UsoTokens }> {
  if (planes.length === 0) return { traducciones: [], usage: {} };

  const origen = planes.map((p, i) => ({
    indice: i,
    titulo: p.titulo,
    descripcion: p.descripcion,
    ...(p.precio ? { precio: p.precio } : {}),
    ...(p.preguntas_frecuentes && p.preguntas_frecuentes.length > 0
      ? { preguntas_frecuentes: p.preguntas_frecuentes }
      : {}),
  }));

  const prompt = `
Traduce al inglés cada uno de estos planes turísticos/de ocio, EXACTAMENTE tal y como están en español — no resumas, no acortes, no añadas ni quites información, solo tradúcelo con naturalidad para un hablante nativo de inglés.

${JSON.stringify(origen)}

Reglas:
- Devuelve un array JSON de EXACTAMENTE ${origen.length} elementos, en el MISMO orden que la entrada (usa el mismo "indice" de cada uno para que no haya dudas).
- Cada elemento debe tener: "indice" (el mismo número que en la entrada), "titulo_en" (traducción de "titulo"), "descripcion_en" (traducción completa de "descripcion", con los mismos párrafos separados por "\\n\\n" y las mismas negritas "**así**" en los mismos datos).
- Si el original tenía "precio", incluye también "precio_en" (traduce solo las palabras, ej. "Gratis" → "Free", "adultos" → "adults" — los números y el símbolo € se quedan igual).
- Si el original tenía "preguntas_frecuentes", incluye también "preguntas_frecuentes_en" con el mismo array traducido (misma cantidad de preguntas, mismo orden, campos "pregunta" y "respuesta").
- No traduzcas nombres propios de lugares, calles o monumentos (ej. "Real Alcázar de Sevilla" se queda igual, no se traduce a "Royal Alcazar").
- Importante sobre los títulos: traduce SIEMPRE la parte genérica del título ("Visita a" → "Visit to", "Paseo por" → "Walk along", "Recorrido por" → "Tour of"), incluso cuando el resto sea un nombre propio. Nunca dejes el título entero sin traducir — solo el nombre propio del monumento/lugar en sí se queda igual.

Devuelve EXCLUSIVAMENTE el array JSON, sin texto adicional ni bloques de markdown.
`.trim();

  const INTENTOS = 4;
  let ultimoError: unknown;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const { texto, usage } = await llamarGemini(prompt, false, MODELO_TRADUCCION);
      const parseado = extraerJSON(texto);
      if (!Array.isArray(parseado)) throw new Error("traducirPlanesAIngles: la respuesta no es un array");

      const traducciones: TraduccionPlan[] = planes.map((_, i) => {
        const item = parseado.find((t) => t && typeof t === "object" && t.indice === i) as
          | (TraduccionPlan & { indice: number })
          | undefined;
        if (!item) return {};
        return {
          titulo_en: item.titulo_en,
          descripcion_en: item.descripcion_en,
          precio_en: item.precio_en,
          preguntas_frecuentes_en: item.preguntas_frecuentes_en,
        };
      });
      return { traducciones, usage };
    } catch (err) {
      ultimoError = err;
      if (intento < INTENTOS) await esperar(2000 * intento + Math.round(Math.random() * 2000));
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new Error("traducirPlanesAIngles: no debería llegar aquí");
}

// Generación semanal (cron de los lunes): pide de una vez la agenda de toda
// la semana en vez de repetir la búsqueda cada día — cada evento real se
// redacta una sola vez, con su fecha real, y de ahí se derivan hoy/finde/
// esta semana por día (ver src/lib/semana.ts). Se piden más planes que en
// la generación diaria de antes porque tiene que cubrir 7 días, no 1.
export async function generarPlanesSemanales(
  municipioNombre: string,
  fechaLunesLegible: string,
  fechaDomingoLegible: string,
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para la semana del ${fechaLunesLegible} al ${fechaDomingoLegible}.

Genera idealmente entre 20 y 35 planes que cubran TODA la semana (lunes a domingo) — es la agenda semanal completa, no la de un solo día, así que necesitas buena cobertura de días distintos entre semana además de fin de semana. Dicho esto, prioriza SIEMPRE la calidad y veracidad sobre acercarte a ese número: mejor 10 planes reales y bien verificados que 30 con relleno o fechas inventadas.

Para cada plan con "tipo": "excepcional", es OBLIGATORIO indicar "fecha_inicio" (y "fecha_fin" si dura más de un día) con una fecha real dentro de esta semana o que se solape con ella — sin esa fecha no se puede saber en qué día mostrarlo. Si no encuentras una fecha real y verificable para un evento puntual, no lo incluyas (usa un plan genérico en su lugar antes que inventar la fecha).

${instruccionesFormato(municipioNombre, municipiosExcluidos)}
`.trim();

  return llamarGeminiConReintentos(prompt, "generarPlanesSemanales");
}

// Una variable filtrable del sitio con página/filtro propio — audiencia
// (pareja, familia) o categoría con página dedicada (conciertos,
// exposiciones, teatro, monólogos).
export type Foco =
  | { tipo: "audiencia"; valor: "pareja" | "familia" }
  | { tipo: "categoria"; valor: "conciertos" | "exposiciones" | "teatro" | "monologos" };

export const FOCOS_SEMANALES: Foco[] = [
  { tipo: "audiencia", valor: "pareja" },
  { tipo: "audiencia", valor: "familia" },
  { tipo: "categoria", valor: "conciertos" },
  { tipo: "categoria", valor: "exposiciones" },
  { tipo: "categoria", valor: "teatro" },
  { tipo: "categoria", valor: "monologos" },
];

const DESCRIPCION_FOCO: Record<string, string> = {
  pareja:
    "planes que funcionan bien como salida en pareja — tanto los explícitamente románticos (catas nocturnas, cenas o experiencias con encanto, azoteas, miradores al atardecer) como, sin ese ángulo romántico, planes culturales o de ocio que dos personas disfrutarían haciendo juntas: exposiciones, conciertos, teatro, monólogos, catas, cine",
  familia:
    "planes pensados especialmente para ir con niños: espectáculos infantiles, parques temáticos o de atracciones, talleres familiares, exposiciones o museos con actividades para niños, cine de verano con película familiar",
  conciertos: "conciertos de cualquier género (pop, rock, flamenco, clásica, jazz, indie...) con fecha concreta",
  exposiciones: "exposiciones temporales (arte, fotografía, ciencia, historia) con fecha concreta",
  teatro:
    "obras de teatro, danza/ballet u ópera/zarzuela con fecha concreta — NO monólogos ni comedia, esa es otra categoría aparte",
  monologos: "monólogos y comedia en directo con fecha concreta",
};

function etiquetaCampoFoco(foco: Foco): string {
  return foco.tipo === "audiencia"
    ? `El campo "audiencia" debe incluir "${foco.valor}".`
    : `El campo "categoria" debe ser exactamente "${foco.valor}".`;
}

// Búsqueda dedicada a UNA sola variable (audiencia o categoría con página
// propia) en vez de competir por hueco dentro de la búsqueda mixta de 20-35
// planes de 8 temáticas a la vez — ver conversación: preguntarle a Gemini
// directamente "qué hacer con niños este finde" encontraba bastante más que
// lo que salía de esa búsqueda mixta. Sin límite de cantidad fijo: mejor 2
// reales que 8 con relleno, pero tampoco recortar a 5 si hay 8 reales.
//
// fechaHastaLegible es más amplio que "esta semana" para las categorías con
// agenda propia (conciertos, teatro...) — ver conversación (Silvio
// Rodríguez): un concierto anunciado con un mes de antelación no se
// detectaba hasta la semana en que ya tocaba, porque esta búsqueda solo
// miraba la semana en curso. Un plan con fecha fuera de la semana no genera
// fila en `planes` (ver calcularFilasPorDia), pero sí crea/actualiza ya su
// ficha real en `eventos` — que es lo que hace falta para que aparezca en
// cuanto se acerque la fecha, vía el relleno de PlanesPageLayout/
// SiempreHubLayout o el listado completo de la categoría.
export async function generarPlanesEnfocados(
  municipioNombre: string,
  fechaDesdeLegible: string,
  fechaHastaLegible: string,
  foco: Foco,
  municipiosExcluidos: string[] = [],
  // Fuentes especializadas a consultar además de la búsqueda habitual (ver
  // conversación: el recinto puede estar bien cubierto en general y aun
  // así faltar una fecha concreta) — solo se usa hoy para "conciertos" en
  // municipios grande (ver fuentesReferenciaConciertos en nivelesMunicipio.ts).
  fuentesReferencia: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) entre el ${fechaDesdeLegible} y el ${fechaHastaLegible}.

Busca específicamente ${DESCRIPCION_FOCO[foco.valor]}. Devuelve TODOS los planes reales y verificables que encuentres para esto en concreto dentro de ese periodo — no te limites a una cifra fija: si hay 2 buenos, devuelve 2; si hay 20, devuelve los 20. Mejor pocos reales y bien verificados que muchos con relleno o inventados, y no fuerces algo que no encaje de verdad solo por rellenar.
${
  fuentesReferencia.length > 0
    ? `\nAdemás de tu búsqueda habitual, consulta específicamente estas fuentes especializadas para no perderte nada de su cartelera: ${fuentesReferencia.join(", ")}`
    : ""
}

Todos los planes que devuelvas aquí llevan "tipo": "excepcional" (son eventos con fecha concreta, no genéricos) y ${etiquetaCampoFoco(foco)} Es OBLIGATORIO indicar "fecha_inicio" (y "fecha_fin" si dura más de un día) con una fecha real dentro de ese periodo o que se solape con él — si no encuentras una fecha real y verificable, no incluyas el plan. Si de verdad no encuentras ninguno real para esto en ese periodo, devuelve un array vacío — no inventes ni fuerces nada.
${
  foco.tipo === "categoria"
    ? `\nAunque el foco de esta búsqueda sea la categoría, no dejes de evaluar bien el campo "audiencia" de cada plan (ver más abajo) — no le pongas "generico" por inercia solo porque estás concentrado en encontrar ${DESCRIPCION_FOCO[foco.valor]}. Si alguno de estos planes es claramente mejor en pareja o con niños, márcalo así: también alimenta esos otros filtros del sitio.`
    : ""
}

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();

  return llamarGeminiConReintentos(prompt, "generarPlanesEnfocados");
}

// A diferencia de generarPlanesEnfocados (que le pide a Gemini que BUSQUE),
// esto recibe una lista ya extraída y confirmada (ver conversación: la
// búsqueda con grounding no lee una página entera, solo trae un puñado de
// resultados por consulta — pedirle la URL como pista no basta cuando la
// página tiene decenas de entradas). Aquí el título/fecha/recinto ya están
// dados; el trabajo de Gemini es solo redactar la ficha completa de cada
// uno (descripción, precio, audiencia...), no encontrarlos.
export async function generarPlanesDesdeListado(
  municipioNombre: string,
  categoria: Foco["valor"],
  listado: Array<{ titulo: string; fecha?: string; lugar: string }>,
  municipiosExcluidos: string[] = [],
  // "excepcional" (por defecto): cada elemento lleva fecha_inicio real,
  // obligatoria. "generico": para actividades reales pero recurrentes sin
  // una fecha propia que ponerles sin ser engañosa (ver conversación: las
  // rutas teatralizadas de Pantalunáticos se repiten en días sueltos y
  // variables cada mes, sin patrón semanal fijo — ponerles una fecha
  // concreta las haría "caducar" en la web aunque la ruta siga haciéndose).
  tipo: "excepcional" | "generico" = "excepcional"
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const listaTexto = listado
    .map((e) => `- "${e.titulo}"${e.fecha ? ` — ${e.fecha}` : ""} — ${e.lugar}`)
    .join("\n");
  const prompt = `
Eres un editor local que conoce a fondo ${municipioNombre} (España).

Esta es la lista COMPLETA y ya verificada de planes confirmados${tipo === "excepcional" ? " para este periodo" : ""} — no hace falta que la busques, ya está confirmada. Tu trabajo es redactar la ficha completa de CADA UNO, no encontrarlos ni descartarlos:
${listaTexto}

Usa el título${tipo === "excepcional" ? ", la fecha" : ""} y el recinto exactamente como aparecen arriba (no los cambies ni los inventes de nuevo). Puedes buscar información adicional (precio de entradas, descripción${tipo === "excepcional" ? " del artista/espectáculo/obra" : ""}, horario) para completar el resto de los campos, pero esos datos ya están confirmados. Redacta una ficha para los ${listado.length} elementos de la lista, ninguno menos.

Todos estos planes llevan "tipo": "${tipo}" y "categoria": "${categoria}".${
    tipo === "excepcional"
      ? ' Es OBLIGATORIO indicar "fecha_inicio" con la fecha exacta de la lista.'
      : " Son actividades reales pero recurrentes, sin una fecha de inicio/fin propia — NO les pongas fecha_inicio ni fecha_fin, y dilo así en la descripción (que se repite regularmente, sin fecha fija, consultar la fuente para el día exacto)."
  }

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();

  const { planes, usage } = await llamarGeminiConReintentos(prompt, "generarPlanesDesdeListado");
  return { planes: planes.map((p) => ({ ...p, origen: "externo" as const })), usage };
}

// Un único plan real y ya identificado, para recuperar una ficha que se
// haya corrompido o para crear una nueva sin pasar por el resto de
// mecanismos de lote — ver conversación: recuperación tras el bug de
// mismoEvento fusionando "Gigante" con una bolera real sin relación.
// Categoría abierta (no restringida a Foco) porque el sitio real puede ser
// de cualquier tipo, no solo las 4 categorías con página propia.
export async function generarPlanUnico(
  municipioNombre: string,
  descripcionBusqueda: string,
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo ${municipioNombre} (España).

Necesito la ficha de UN SOLO plan real y concreto: ${descripcionBusqueda}

Investiga y redacta su ficha completa. Si es un evento puntual con fecha real, indícala como "excepcional"; si es un lugar o actividad disponible todo el año sin una fecha propia, márcalo como "generico" sin fecha_inicio ni fecha_fin.

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();
  return llamarGeminiConReintentos(prompt, "generarPlanUnico");
}

// Búsqueda dedicada a planes "generico" (evergreen, sin fecha) — sin esto,
// los genéricos solo salían como relleno de generarPlanesSemanales cuando
// no había suficientes puntuales para llegar a su cupo, así que en
// ciudades con agenda real activa (como Sevilla) apenas se generaban, y
// además tendían a redescubrir siempre los mismos 4-5 sitios más obvios en
// vez de ampliar el catálogo — ver conversación (por eso "todo el año"
// mostraba tan pocos planes gratis reales aunque la ciudad tenga muchos
// más). Recibe los títulos de los genéricos que ya tenemos en este
// municipio para que cada tanda amplíe el catálogo con sitios NUEVOS en
// vez de volver a redactar los mismos de siempre.
export async function generarPlanesGenericos(
  municipioNombre: string,
  conocidos: string[],
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const listaConocidos =
    conocidos.length > 0
      ? `\nYa tenemos estos planes genéricos para ${municipioNombre} — NO los repitas, y no generes otro plan sobre el mismo lugar real con un título distinto:\n${conocidos.map((t) => `- ${t}`).join("\n")}\n\nBusca EXCLUSIVAMENTE lugares NUEVOS que no estén ya en esa lista.\n`
      : "";

  const prompt = `
Eres un editor local que conoce a fondo ${municipioNombre} (España) todo el año, no solo la agenda de esta semana.

Busca planes "generico" (disponibles siempre, sin fecha concreta) reales y verificables, con variedad real de TIPO de lugar — como referencia orientativa (no una lista cerrada ni obligatoria), piensa en monumentos, palacios, conventos, museos, iglesias, mercados, parques/jardines, rincones únicos poco conocidos, ferias/fiestas tradicionales y calles o barrios con carácter propio.

El público objetivo es gente que YA VIVE en la ciudad, no turistas — evita planes claramente pensados para visitantes de fuera con poco interés real para un vecino (un tablao flamenco genérico, una experiencia "típica" turística). Prioriza siempre planes "dinámicos" que impliquen entrar a un sitio concreto o hacer algo (visita con entrada, museo, actividad) frente a un simple paseo por una calle o barrio sin más contenido que caminar — un "paseo por la Calle X" sin nada más es el último recurso, no el primero.

Dentro de esta tanda, procura que al menos algún plan tenga lo GRATIS como valor real y claro (un monumento con entrada libre, un parque, una visita sin coste) — indícalo con precisión en "precio" (ver más abajo), no lo fuerces si en realidad no es gratis.
${listaConocidos}
Genera entre 10 y 20 planes si de verdad existen sitios genuinamente distintos — mejor devolver menos (o un array vacío) que rellenar con variaciones del mismo lugar o con actividades-tipo genéricas sin anclaje real (una ruta en bici sin destino, un "paseo por el barrio histórico" sin más).

Todos los planes que devuelvas aquí llevan "tipo": "generico".

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();

  return llamarGeminiConReintentos(prompt, "generarPlanesGenericos");
}

// Búsqueda dedicada a genéricos pensados específicamente para ir CON NIÑOS
// — antes esto era solo "al menos algún plan" dentro de generarPlanesGenericos,
// compitiendo por hueco con monumentos/museos/mercados generalistas, y el
// resultado real era 1-2 planes de niños como mucho (ver conversación:
// "hoy con niños" se quedaba en 3-4 planes en vez de los 10-15 buscados).
// Igual que con las variables enfocadas (FOCOS_SEMANALES), preguntar
// directamente por esto encuentra bastante más que dejarlo de relleno.
export async function generarPlanesGenericosNinos(
  municipioNombre: string,
  conocidos: string[],
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const listaConocidos =
    conocidos.length > 0
      ? `\nYa tenemos estos planes para niños en ${municipioNombre} — NO los repitas, y no generes otro plan sobre el mismo lugar real con un título distinto:\n${conocidos.map((t) => `- ${t}`).join("\n")}\n\nBusca EXCLUSIVAMENTE lugares NUEVOS que no estén ya en esa lista.\n`
      : "";

  const prompt = `
Eres un editor local que conoce a fondo ${municipioNombre} (España) todo el año, buscando específicamente planes para ir CON NIÑOS que estén disponibles siempre (sin fecha concreta, "generico").

Busca planes reales y verificables genuinamente pensados para niños — museos con salas o actividades infantiles, parques con zona de juegos o atracciones, espacios interactivos o de ciencia, granjas-escuela, parques temáticos o acuáticos, ludotecas, bibliotecas con programación infantil estable. El público objetivo son familias que YA VIVEN en la ciudad, no turistas — evita nada claramente pensado para visitantes de fuera. Prioriza planes "dinámicos" con entrada o actividad concreta frente a un simple paseo o parque sin nada más que el propio espacio — un parque sin zona de juegos ni actividad específica es el último recurso, no el primero.
${listaConocidos}
Genera entre 8 y 15 planes si de verdad existen sitios genuinamente distintos para niños — mejor devolver menos (o un array vacío) que forzar algo que no encaje de verdad.

Todos los planes que devuelvas aquí llevan "tipo": "generico" y "audiencia": ["familia"].

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();

  return llamarGeminiConReintentos(prompt, "generarPlanesGenericosNinos");
}

// Búsqueda dedicada para municipios pequeños con poca agenda propia (ej.
// Mairena del Aljarafe): en vez de forzar contenido flojo dentro del
// propio municipio, busca planes reales en pueblos o zonas cercanas —
// pero NUNCA en el municipio de la página ni en ninguno de los demás
// municipios que ya tienen página propia en el sitio (eso lo decide
// `municipiosExcluidos`, no Gemini) — ver conversación. Cada plan que
// devuelva esta búsqueda lleva "zona_cercana" (el pueblo/zona real) y
// "zona_cercana_minutos" (minutos aproximados en coche desde
// `municipioNombre`) para que la ficha dej claro que es "a X min de
// {municipio}", no que está en el propio municipio.
export async function generarPlanesZonaCercana(
  municipioNombre: string,
  municipiosExcluidos: string[]
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la zona alrededor de ${municipioNombre} (España), incluyendo los pueblos y núcleos cercanos, no solo el propio municipio.

Busca planes reales y verificables (eventos puntuales con fecha o lugares genéricos disponibles siempre) en pueblos, barrios o zonas a menos de 15 minutos en coche de ${municipioNombre}, pero que NO estén dentro del propio ${municipioNombre}.

MUY IMPORTANTE: distingue según el "tipo" cuando el sitio resulte estar en ${municipiosExcluidos.join(", ")} (municipios que ya cubrimos con su propia agenda dedicada) — si el plan es "generico" (evergreen, sin fecha), NO lo incluyas: su catálogo de siempre ya está cubierto en la página propia de ese municipio, y repetirlo aquí sería un duplicado. Si el plan es "excepcional" (puntual, con fecha concreta) SÍ puedes incluirlo aunque esté en uno de esos municipios, siempre que sea genuinamente relevante e interesante para alguien en ${municipioNombre} — un evento puntual real en un municipio vecino no es un duplicado de su catálogo, es información útil.

Para CADA plan que devuelvas, añade estos dos campos (obligatorios en esta búsqueda, a diferencia del resto):
- "zona_cercana": el nombre real del pueblo, barrio o zona donde está (ej. "San Juan de Aznalfarache"), nunca "${municipioNombre}".
- "zona_cercana_minutos": entero, minutos aproximados en coche desde ${municipioNombre} hasta ese lugar (nunca más de 15).

Genera entre 5 y 12 planes si de verdad existen sitios o eventos genuinamente distintos y cercanos dentro de ese radio de 15 minutos — mejor devolver menos (o un array vacío) que forzar algo lejano o de relleno. Para los "excepcional" (con fecha), sigue siendo obligatorio indicar "fecha_inicio" real y verificable; si no la tienes, no incluyas el plan.

${camposJson(municipioNombre, municipiosExcluidos)}
`.trim();

  return llamarGeminiConReintentos(prompt, "generarPlanesZonaCercana");
}

// Combina los resultados de la búsqueda mixta + las dedicadas por variable:
// el mismo evento real puede salir de más de una búsqueda (ej. la mixta y
// la dedicada a "pareja" encuentran el mismo concierto) — se fusiona por
// título en vez de duplicar la tarjeta, uniendo las audiencias que traiga
// cada aparición (sin repetir "generico" si ya hay alguna específica).
function normalizarTitulo(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, " ") // quita comillas, dos puntos, etc.
    .replace(/\s+/g, " ")
    .trim();
}

// Dos títulos distintos pueden ser el mismo evento real (ej. "Exposición
// 'Dinosaurios de la Patagonia' en CaixaForum" vs "Dinosaurios de la
// Patagonia en CaixaForum Sevilla", encontrados por dos búsquedas
// distintas) — se compara por contención y por solape de palabras en vez
// de exigir una igualdad exacta, que dejaba pasar justo estos casos.
// "... vs/contra RIVAL" (partidos, pero también "concierto de X contra...",
// enfrentamientos, etc.): si los dos títulos tienen esta forma y el rival
// es distinto, son eventos DIFERENTES aunque el resto del título (el
// molde de la frase, ej. "Partido de LaLiga EA Sports: Sevilla FC vs")
// coincida casi entero — el ratio de palabras compartidas por sí solo no
// sirve aquí: "vs Atlético de Madrid" y "vs FC Barcelona" comparten el
// 80% de las palabras significativas del título completo (todo el molde),
// más que casos de fusión real como "Cayetana" (75%) — subir el umbral
// general rompía esos, así que este caso necesita su propio chequeo.
function extraerTrasConector(texto: string): string | null {
  const m = texto.match(/\b(vs\.?|contra)\s+(.+)$/i);
  return m ? m[2].trim() : null;
}

// Preposiciones/conectores de 3+ letras que el filtro original (solo
// longitud > 2) dejaba pasar como si fueran palabras de contenido — dos
// títulos con la misma ESTRUCTURA genérica ("Paseo por la Plaza del
// Arenal" / "Paseo por la Plaza de la Constitución", dos plazas distintas
// de verdad) comparten "paseo/por/plaza/del" y ya superaban el umbral sin
// tener nada que ver — ver conversación (detectado limpiando duplicados
// en varios municipios). Solo las palabras de CONTENIDO real (nombres de
// sitios, temas) deben contar para el solapamiento.
const PALABRAS_VACIAS = new Set([
  "por", "del", "las", "los", "una", "uno", "sus", "con", "sin", "para",
  "este", "esta", "esto", "estos", "estas", "tras", "muy", "mas", "todo",
  "toda", "todos", "todas", "que", "como", "sobre", "entre", "hasta",
  "desde", "cada", "otro", "otra", "otros", "otras", "son", "hay",
]);

function esPalabraSignificativa(palabra: string): boolean {
  return palabra.length > 2 && !PALABRAS_VACIAS.has(palabra);
}

export function mismoEvento(a: string, b: string): boolean {
  const na = normalizarTitulo(a);
  const nb = normalizarTitulo(b);
  if (na === nb) return true;

  const rivalA = extraerTrasConector(a);
  const rivalB = extraerTrasConector(b);
  if (rivalA && rivalB) {
    const nRivalA = normalizarTitulo(rivalA);
    const nRivalB = normalizarTitulo(rivalB);
    if (nRivalA !== nRivalB && !nRivalA.includes(nRivalB) && !nRivalB.includes(nRivalA)) {
      return false;
    }
  }

  if (na.length > 8 && nb.length > 8 && (na.includes(nb) || nb.includes(na))) return true;

  const palabrasA = new Set(na.split(" ").filter(esPalabraSignificativa));
  const palabrasB = new Set(nb.split(" ").filter(esPalabraSignificativa));
  const menor = Math.min(palabrasA.size, palabrasB.size);
  // Con una sola palabra significativa en el lado menor, cualquier
  // coincidencia trivial da 100% de solape sin que sean lo mismo — bug
  // real encontrado en conversación: "Gigante" (obra de teatro) se fusionó
  // con "Bolera gigante y karting eléctrico en Mega Ozone Aleste Plaza"
  // (bolera real, nada que ver) solo por compartir esa palabra, y le
  // sobrescribió la descripción/fecha/categoría reales. Hace falta más de
  // una palabra en común para que el solape signifique algo.
  if (menor < 2) return false;
  const interseccion = [...palabrasA].filter((w) => palabrasB.has(w)).length;
  return interseccion / menor >= 0.7;
}

export function fusionarPlanesDuplicados(planes: PlanGenerado[]): PlanGenerado[] {
  const resultado: PlanGenerado[] = [];
  for (const plan of planes) {
    const existente = resultado.find((p) => mismoEvento(p.titulo, plan.titulo));
    if (!existente) {
      resultado.push({ ...plan });
      continue;
    }
    const audienciaUnida = Array.from(new Set([...existente.audiencia, ...plan.audiencia]));
    const especificas = audienciaUnida.filter((a) => a !== "generico");
    existente.audiencia = (especificas.length > 0 ? especificas : audienciaUnida) as Audiencia[];
    // Se queda con el título más largo (normalmente el más descriptivo).
    if (plan.titulo.length > existente.titulo.length) existente.titulo = plan.titulo;
  }
  return resultado;
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
  enfoqueFinde: boolean,
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const listaConocidos =
    planesConocidos.length > 0 ? planesConocidos.map((t) => `- ${t}`).join("\n") : "(ninguno todavía)";

  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para hoy, ${fechaHoyLegible}.

Esta semana ya hemos encontrado y publicado estos planes — NO los repitas ni los redactes de nuevo aunque los vuelvas a encontrar en tu búsqueda:
${listaConocidos}

Busca EXCLUSIVAMENTE planes NUEVOS que no estén en esa lista: eventos de última hora, cambios de programación, o cosas que se nos pasaron. Si no encuentras nada realmente nuevo, devuelve un array vacío — no rellenes con planes genéricos ni repitas nada de la lista de arriba solo por devolver algo.
${enfoqueFinde ? "\nHoy toca prestar atención especial a la agenda del próximo fin de semana (sábado y domingo), que suele confirmarse o ampliarse con poca antelación." : ""}

Para cada plan con "tipo": "excepcional", indica "fecha_inicio" (y "fecha_fin" si aplica) con una fecha real — si no la encuentras, mejor omite el plan.

${instruccionesFormato(municipioNombre, municipiosExcluidos)}
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
  mesSlug: string,
  fechaHoyLegible: string,
  municipiosExcluidos: string[] = []
): Promise<{ planes: PlanGenerado[]; usage: UsoTokens }> {
  const prompt = `
Eres un editor local que conoce a fondo la agenda de ${municipioNombre} (España) para el mes de ${mesSlug}. Hoy es ${fechaHoyLegible}.

Genera entre 10 y 20 planes para lo que queda de ese mes DESDE HOY en adelante (no para el mes completo desde el día 1 — cualquier evento puntual con fecha ya pasada no sirve de nada aquí), priorizando eventos puntuales de agenda por encima de planes genéricos (ver orden de prioridad más abajo). El campo "vigencia" de cada plan debe incluir "${mesSlug}".

${instruccionesFormato(municipioNombre, municipiosExcluidos)}
`.trim();

  const { planes, usage } = await llamarGeminiConReintentos(prompt, "generarPlanesDelMes");
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

// Tarifa real de gemini-3.6-flash ($/1M tokens, verificada agosto 2026) —
// las cifras anteriores (0.3/2.5) eran de Flash-Lite, no del modelo Flash
// completo que usa GEMINI_MODEL de verdad: llevaban meses subestimando el
// coste real por 3-5x (ver conversación). Si cambias de modelo o Google
// ajusta precios, actualiza estos dos valores — de ellos depende que
// generation_log refleje el coste real y no uno inventado. NOTA: esto NO
// incluye el coste del grounding con Google Search (5.000 peticiones
// gratis al mes compartidas entre modelos Gemini 3, luego $14 por cada
// 1.000 búsquedas — y una sola llamada puede disparar varias búsquedas) —
// a nuestro volumen actual probablemente seguimos dentro del tramo
// gratuito, pero no lo dábamos por hecho al escalar a más municipios.
const COSTE_INPUT_POR_MILLON = 1.5;
const COSTE_OUTPUT_POR_MILLON = 7.5;

export function estimarCoste(usage: UsoTokens): number {
  const input = ((usage.promptTokenCount ?? 0) / 1_000_000) * COSTE_INPUT_POR_MILLON;
  // El "thinking" se factura como output, aunque Gemini lo devuelva en un
  // campo aparte (thoughtsTokenCount) — ver la nota en UsoTokens.
  const tokensOutput = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const output = (tokensOutput / 1_000_000) * COSTE_OUTPUT_POR_MILLON;
  return input + output;
}

// Tarifa real de gemini-3.1-flash-lite (MODELO_TRADUCCION), verificada
// agosto 2026 — mucho más barata que el Flash completo, y aparte porque es
// un modelo distinto: sumar sus tokens a los de la generación y aplicar
// COSTE_*_POR_MILLON de arriba daría un coste inventado (esa tarifa es de
// otro modelo). Cada cron suma esta función Y estimarCoste() por separado,
// nunca los tokens en crudo de las dos llamadas.
const COSTE_INPUT_TRADUCCION_POR_MILLON = 0.25;
const COSTE_OUTPUT_TRADUCCION_POR_MILLON = 1.5;

export function estimarCosteTraduccion(usage: UsoTokens): number {
  const input = ((usage.promptTokenCount ?? 0) / 1_000_000) * COSTE_INPUT_TRADUCCION_POR_MILLON;
  const output = ((usage.candidatesTokenCount ?? 0) / 1_000_000) * COSTE_OUTPUT_TRADUCCION_POR_MILLON;
  return input + output;
}
