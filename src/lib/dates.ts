import { MESES, type MesSlug } from "./types";

// Todas las fechas de "hoy"/"esta semana"/"este mes" del sitio son las del
// calendario de España, no las del huso horario del proceso que ejecuta el
// código (en Vercel, UTC) — sin esto, justo después de medianoche en
// España pero antes de medianoche UTC (hasta 2h en verano, 1h en invierno)
// el sitio seguía pensando que era "ayer": el partido de "hoy", la agenda
// de "esta semana", el mes en curso... todo se quedaba con la fecha del
// día anterior durante esa ventana (ver conversación). Se usa en vez de
// "new Date()" en cualquier cálculo de "hoy" de este archivo — el resto de
// getters (getDate, getMonth, getDay...) siguen siendo del huso horario
// del proceso, pero como aquí construimos el Date a partir de los números
// del calendario de Madrid, devuelven el valor correcto igualmente.
export function hoyEnMadrid(): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return new Date(valor("year"), valor("month") - 1, valor("day"));
}

export function hoyISO(): string {
  return formatearFechaISO(hoyEnMadrid());
}

export function mesActualSlug(): MesSlug {
  return MESES[hoyEnMadrid().getMonth()];
}

export function mesSiguienteSlug(): MesSlug {
  return MESES[(hoyEnMadrid().getMonth() + 1) % 12];
}

// Mes en curso + los siguientes — usado tanto para qué meses generar
// (cron) como para qué meses enlazar en la navegación, así los dos
// coinciden siempre: no se enlaza un mes que no se ha generado.
export function proximosMesesSlugs(cantidad: number): MesSlug[] {
  const mesActual = hoyEnMadrid().getMonth();
  return Array.from({ length: cantidad }, (_, i) => MESES[(mesActual + i) % 12]);
}

export function esMesSlugValido(valor: string): valor is MesSlug {
  return (MESES as readonly string[]).includes(valor);
}

function nombreMes(fecha: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(fecha);
}

// Todas las funciones "legible" de aquí abajo formatean para MOSTRAR en la
// interfaz (no confundir con parsearFechaEspanola, que interpreta el texto
// en español que siempre devuelve Gemini, independientemente del idioma de
// la interfaz) — por eso llevan locale y las de parseo no.
export function formatearFechaLegible(fecha: Date, locale: string = "es"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(fecha);
}

// Para que los títulos de "hoy" digan la fecha real (mejor SEO/frescura que
// dejarlo implícito) — ej. "Qué hacer hoy en Sevilla (22 de agosto de 2026)".
export function fechaDeHoyLegible(locale: string = "es"): string {
  return formatearFechaLegible(hoyEnMadrid(), locale);
}

// El lunes de la semana natural en curso (a diferencia de
// diasRelevantesEstaSemana, que es una ventana rodante de 7 días desde hoy,
// no la semana natural) — lo usa el repaso diario para saber qué días
// quedan por delante hasta el domingo de ESTA semana natural.
export function lunesDeLaSemanaActual(): Date {
  const hoy = hoyEnMadrid();
  const diaSemana = hoy.getDay(); // 0=domingo … 6=sábado
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diasDesdeLunes);
  return lunes;
}

// El sábado y domingo de "este fin de semana": si hoy ya es sábado o
// domingo, ese es el fin de semana en curso, no el siguiente.
function proximoFinDeSemana(hoy: Date): { sabado: Date; domingo: Date } {
  const diaSemana = hoy.getDay(); // 0=domingo … 6=sábado
  const diasHastaSabado = diaSemana === 6 ? 0 : diaSemana === 0 ? -1 : 6 - diaSemana;
  const sabado = new Date(hoy);
  sabado.setDate(hoy.getDate() + diasHastaSabado);
  const domingo = new Date(sabado);
  domingo.setDate(sabado.getDate() + 1);
  return { sabado, domingo };
}

function formatearRangoFechas(inicio: Date, fin: Date, locale: string = "es"): string {
  const mesInicio = nombreMes(inicio, locale);
  const mesFin = nombreMes(fin, locale);
  const esEspanol = locale === "es";

  if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
    return esEspanol
      ? `${inicio.getDate()}-${fin.getDate()} de ${mesInicio} de ${fin.getFullYear()}`
      : `${mesInicio} ${inicio.getDate()}-${fin.getDate()}, ${fin.getFullYear()}`;
  }
  if (inicio.getFullYear() === fin.getFullYear()) {
    return esEspanol
      ? `${inicio.getDate()} de ${mesInicio} - ${fin.getDate()} de ${mesFin} de ${fin.getFullYear()}`
      : `${mesInicio} ${inicio.getDate()} - ${mesFin} ${fin.getDate()}, ${fin.getFullYear()}`;
  }
  return `${formatearFechaLegible(inicio, locale)} - ${formatearFechaLegible(fin, locale)}`;
}

export function rangoFinDeSemanaLegible(locale: string = "es"): string {
  const { sabado, domingo } = proximoFinDeSemana(hoyEnMadrid());
  return formatearRangoFechas(sabado, domingo, locale);
}

// Ventana real de "esta semana": los 7 días desde hoy (inclusive) hasta
// dentro de una semana — no la semana natural (lunes-domingo, que en
// jueves ya habría dejado atrás lunes-miércoles) ni solo días laborables.
// Ver conversación: "esta semana" debe contemplar de hoy a dentro de 7
// días desde el día en que se consulta, sea cual sea.
export function diasRelevantesEstaSemana(): Date[] {
  const hoy = hoyEnMadrid();
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() + i);
    return dia;
  });
}

export function rangoSemanaLegible(locale: string = "es"): string {
  const dias = diasRelevantesEstaSemana();
  return formatearRangoFechas(dias[0], dias[dias.length - 1], locale);
}

const NOMBRES_MES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

// fecha_inicio/fecha_fin de un evento son texto libre en español pensado
// para mostrarse tal cual en su ficha (ej. "7 de julio de 2026") — no hay
// columna de fecha estructurada. Se interpreta aquí el patrón "D de MES de
// AAAA" que pide el prompt de Gemini; cualquier otro formato no reconocido
// simplemente no genera fecha (y por tanto tampoco etiqueta).
function parsearFechaEspanola(texto: string): Date | null {
  const m = texto.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  const mes = NOMBRES_MES[m[2]];
  if (mes === undefined) return null;
  return new Date(Number(m[3]), mes, Number(m[1]));
}

// Ataja el problema en el origen (ver conversación: Gemini guardó "2 de
// diciembre" sin año, y eso colaba el evento en "esta semana" meses
// después porque el parser fallaba en silencio y el resto del código
// trataba "no se pudo interpretar" igual que "no tiene fecha"). Se usa al
// normalizar lo que devuelve Gemini, antes de guardar nada: una fecha que
// no cumpla el formato completo ("D de MES de AAAA") no se guarda en vez
// de guardarse a medias.
export function esFechaEspanolaValida(texto: string): boolean {
  return parsearFechaEspanola(texto) !== null;
}

function diaEpoch(fecha: Date): number {
  return Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86400000);
}

export function formatearFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Interpreta el texto libre en español de fecha_inicio/fecha_fin (ej. "7 de
// julio de 2026"). Expuesta para el cron semanal, que necesita calcular
// solapamientos contra la semana que está generando, no contra "esta
// semana actual" — a diferencia de diasSemanaIncluidos/etiquetaDiaFinde,
// que sí asumen "ahora mismo".
export function fechaDesdeTextoEspanol(texto: string): Date | null {
  return parsearFechaEspanola(texto);
}

// Los 7 días (como Date) desde fechaLunes hasta el domingo siguiente,
// inclusive — para el cron semanal, que genera y guarda una semana
// completa de una vez.
export function fechasDeLaSemana(fechaLunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(fechaLunes);
    dia.setDate(fechaLunes.getDate() + i);
    return dia;
  });
}

// Versión de diasSemanaIncluidos que acepta cualquier semana objetivo (no
// solo "esta semana actual") — la usa el cron semanal para saber, de la
// semana que está generando, qué días concretos cubre cada evento
// excepcional a partir de su fecha_inicio/fecha_fin en texto libre.
export function diasIncluidosEnRango(
  fechaInicio: string | null,
  fechaFin: string | null,
  diasObjetivo: Date[]
): boolean[] | null {
  const inicio = fechaInicio ? parsearFechaEspanola(fechaInicio) : null;
  const fin = fechaFin ? parsearFechaEspanola(fechaFin) : null;
  const desde = inicio ?? fin;
  const hasta = fin ?? inicio;
  if (!desde || !hasta) return null;

  const desdeEp = diaEpoch(desde);
  const hastaEp = diaEpoch(hasta);
  return diasObjetivo.map((dia) => {
    const ep = diaEpoch(dia);
    return desdeEp <= ep && ep <= hastaEp;
  });
}

export function fechasFinDeSemanaISO(): { sabado: string; domingo: string } {
  const { sabado, domingo } = proximoFinDeSemana(hoyEnMadrid());
  return { sabado: formatearFechaISO(sabado), domingo: formatearFechaISO(domingo) };
}

// Qué día(s) del próximo fin de semana cubre el rango fecha_inicio–fecha_fin
// de un evento. null si no se pudo interpretar ninguna fecha (evento sin
// fecha conocida, o fuera del formato "D de MES de AAAA" esperado).
function diasFindeIncluidos(
  fechaInicio: string | null,
  fechaFin: string | null
): { sabado: boolean; domingo: boolean } | null {
  const inicio = fechaInicio ? parsearFechaEspanola(fechaInicio) : null;
  const fin = fechaFin ? parsearFechaEspanola(fechaFin) : null;
  // Si solo se conoce una de las dos fechas, se asume que el evento dura
  // ese único día (frecuente en conciertos/funciones puntuales).
  const desde = inicio ?? fin;
  const hasta = fin ?? inicio;
  if (!desde || !hasta) return null;

  const { sabado, domingo } = proximoFinDeSemana(hoyEnMadrid());
  const desdeEp = diaEpoch(desde);
  const hastaEp = diaEpoch(hasta);
  const sabadoEp = diaEpoch(sabado);
  const domingoEp = diaEpoch(domingo);

  return {
    sabado: desdeEp <= sabadoEp && sabadoEp <= hastaEp,
    domingo: desdeEp <= domingoEp && domingoEp <= hastaEp,
  };
}

const ETIQUETAS_FINDE: Record<string, { ambos: string; soloSabado: string; soloDomingo: string }> = {
  es: { ambos: "Sábado y domingo", soloSabado: "Solo sábado", soloDomingo: "Solo domingo" },
  en: { ambos: "Saturday & Sunday", soloSabado: "Saturday only", soloDomingo: "Sunday only" },
};

// Para eventos puntuales en la página de fin de semana: si el rango
// fecha_inicio–fecha_fin del evento solo cubre uno de los dos días, lo
// decimos explícitamente en vez de dejar que el usuario lo asuma y se
// encuentre el evento ya terminado.
export function etiquetaDiaFinde(
  fechaInicio: string | null,
  fechaFin: string | null,
  locale: string = "es"
): string | null {
  const incluidos = diasFindeIncluidos(fechaInicio, fechaFin);
  if (!incluidos) return null;
  const e = ETIQUETAS_FINDE[locale] ?? ETIQUETAS_FINDE.es;
  if (incluidos.sabado && incluidos.domingo) return e.ambos;
  if (incluidos.sabado) return e.soloSabado;
  if (incluidos.domingo) return e.soloDomingo;
  return null;
}

// Qué fecha ISO usar para pedir el tiempo de un evento de fin de semana: el
// domingo si el evento es solo de domingo, el sábado en cualquier otro caso
// (incluye "ambos días" y "sin fecha conocida", donde el sábado es la mejor
// referencia disponible).
export function fechaFindeParaTiempo(fechaInicio: string | null, fechaFin: string | null): string {
  const incluidos = diasFindeIncluidos(fechaInicio, fechaFin);
  const { sabado, domingo } = fechasFinDeSemanaISO();
  if (incluidos?.domingo && !incluidos.sabado) return domingo;
  return sabado;
}

// evento.horario es texto libre (ej. "22:00h", "21:00 horas",
// "12:00h - 20:00h", pero también "Horario habitual del museo" o "Consultar
// horarios"). Se extrae la primera hora "HH:MM" que aparezca — si el
// horario cita varias (una franja, varios pases), la primera es un punto de
// partida razonable. Si no hay ninguna hora reconocible, devuelve null.
export function extraerHoraDeHorario(horario: string | null): number | null {
  if (!horario) return null;
  const m = horario.match(/(\d{1,2})[:.]\d{2}/);
  if (!m) return null;
  const hora = Number(m[1]);
  return hora >= 0 && hora <= 23 ? hora : null;
}

// Qué días de diasRelevantesEstaSemana() cubre el rango fecha_inicio–
// fecha_fin de un evento (mismo índice que ese array, no necesariamente
// lunes=0). null si no se pudo interpretar ninguna fecha (evento sin fecha
// conocida) — se trata distinto de "se interpretó pero no cae esta semana"
// (array de todo false), que sí es un resultado válido para excluir el
// evento de la lista.
export function diasSemanaIncluidos(fechaInicio: string | null, fechaFin: string | null): boolean[] | null {
  const inicio = fechaInicio ? parsearFechaEspanola(fechaInicio) : null;
  const fin = fechaFin ? parsearFechaEspanola(fechaFin) : null;
  const desde = inicio ?? fin;
  const hasta = fin ?? inicio;
  if (!desde || !hasta) return null;

  const desdeEp = diaEpoch(desde);
  const hastaEp = diaEpoch(hasta);
  return diasRelevantesEstaSemana().map((dia) => {
    const ep = diaEpoch(dia);
    return desdeEp <= ep && ep <= hastaEp;
  });
}

const NOMBRES_DIA_POR_LOCALE: Record<string, Record<number, string>> = {
  es: { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado" },
  en: { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" },
};

// A partir del resultado de diasSemanaIncluidos, arma una etiqueta legible:
// un solo día ("Miércoles"), un tramo consecutivo ("Jueves a viernes") o
// días sueltos no consecutivos — usando el nombre real del día de la
// semana de cada fecha, no una posición fija.
export function etiquetaDiaSemana(dias: boolean[], locale: string = "es"): string | null {
  const fechas = diasRelevantesEstaSemana();
  const nombresDia = NOMBRES_DIA_POR_LOCALE[locale] ?? NOMBRES_DIA_POR_LOCALE.es;
  const indices = dias.reduce<number[]>((acc, incluido, i) => {
    if (incluido) acc.push(i);
    return acc;
  }, []);
  if (indices.length === 0) return null;

  const nombres = indices.map((i) => nombresDia[fechas[i].getDay()]);
  if (nombres.length === 1) return nombres[0];

  const esConsecutivo = indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
  const conector = locale === "en" ? "to" : "a";
  if (esConsecutivo) return `${nombres[0]} ${conector} ${nombres[nombres.length - 1].toLowerCase()}`;
  return nombres.join(", ");
}
