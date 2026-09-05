#!/usr/bin/env node
// Genera el HTML final del artifact de revisión de planes a partir de la
// plantilla "shell.html" (misma carpeta) + el informe de planes activos +
// las marcas actuales — ver conversación: reemplaza el script inline de
// Node que se usaba a mano en la sesión donde se construyó esto, para que
// la tarea programada diaria pueda reconstruir el artifact sin depender de
// nada efímero (scratchpad de una sesión concreta).
//
// Uso: node build.js <datos.json> <marcas.json> <notas.json> <salida.html>
//   datos.json  — la respuesta de GET /api/interno/reporte-planes
//   marcas.json — objeto { [slug]: "quitar"|"potenciar"|"mantener"|"quitar:aplicado"|"potenciar:aplicado" }
//   notas.json  — objeto { [slug]: "texto libre" }, contexto que deja Victor por fila
//   salida.html — dónde escribir el HTML final, listo para Artifact.publish()

const fs = require("fs");
const path = require("path");

const [, , rutaDatos, rutaMarcas, rutaNotas, rutaSalida] = process.argv;
if (!rutaDatos || !rutaMarcas || !rutaNotas || !rutaSalida) {
  console.error("Uso: node build.js <datos.json> <marcas.json> <notas.json> <salida.html>");
  process.exit(1);
}

const shell = fs.readFileSync(path.join(__dirname, "shell.html"), "utf8");
const datos = JSON.parse(fs.readFileSync(rutaDatos, "utf8"));
const marcas = JSON.parse(fs.readFileSync(rutaMarcas, "utf8"));
const notas = JSON.parse(fs.readFileSync(rutaNotas, "utf8"));

datos.generadoEn = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
}).format(new Date());

// Fecha de "hoy" en formato ISO, huso de Madrid — para que los filtros de
// semana del propio artifact (esta semana / semana que viene) calculen
// contra la misma referencia que usa el resto del sitio, no contra el
// reloj del navegador de quien lo mire.
{
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).formatToParts(new Date());
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  datos.hoyISO = `${valor("year")}-${valor("month")}-${valor("day")}`;
}

const [antes, resto1] = shell.split("__DATOS_JSON__");
const [medio, resto2] = resto1.split("__MARCAS_JSON__");
const [medio2, resto3] = resto2.split("__NOTAS_JSON__");
const [entre, final] = resto3.split("<!--INSERTAR_CONSTANTES_AQUI-->");

// JSON.stringify no escapa "<" — antes/medio/medio2/entre SIEMPRE contienen
// un "</script>" literal de verdad (son precisamente los tramos entre dos
// <script> del propio shell), así que embeberlos sin escapar corta la
// etiqueta <script> a mitad de camino en cuanto el navegador la parsea —
// no es un error de JavaScript, es el HTML partiéndose por la mitad. Bug
// real encontrado en producción (ver conversación): las constantes
// quedaban presentes como texto pero nunca llegaban a ejecutarse como JS,
// así que ninguna marca se guardaba pese a que este bloque ya existía.
// Mismo criterio en jsonSeguro() de shell.html — deben coincidir.
function jsonSeguro(valor) {
  return JSON.stringify(valor).replace(/</g, "\\u003c");
}

const constantes =
  "<scr" +
  "ipt>" +
  "const SHELL_ANTES=" + jsonSeguro(antes) + ";" +
  "const SHELL_MEDIO=" + jsonSeguro(medio) + ";" +
  "const SHELL_MEDIO2=" + jsonSeguro(medio2) + ";" +
  "const SHELL_ENTRE=" + jsonSeguro(entre) + ";" +
  "const SHELL_FINAL=" + jsonSeguro(final) + ";" +
  "</scr" + "ipt>";

// Sin doctype propio: Artifact.publish ya envuelve el contenido en su
// propio <!doctype html>...<body> — ver plantilla() en shell.html, debe
// generar exactamente lo mismo.
const doc =
  antes +
  jsonSeguro(datos) +
  medio +
  jsonSeguro(marcas) +
  medio2 +
  jsonSeguro(notas) +
  entre +
  constantes +
  final;

fs.writeFileSync(rutaSalida, doc);
console.log(
  `${rutaSalida}: ${doc.length} bytes (${datos.totalPuntuales} puntuales, ${datos.totalGenericos} genéricos, ${Object.keys(marcas).length} marcas, ${Object.keys(notas).length} notas)`
);
