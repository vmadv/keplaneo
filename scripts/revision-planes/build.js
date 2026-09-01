#!/usr/bin/env node
// Genera el HTML final del artifact de revisión de planes a partir de la
// plantilla "shell.html" (misma carpeta) + el informe de planes activos +
// las marcas actuales — ver conversación: reemplaza el script inline de
// Node que se usaba a mano en la sesión donde se construyó esto, para que
// la tarea programada diaria pueda reconstruir el artifact sin depender de
// nada efímero (scratchpad de una sesión concreta).
//
// Uso: node build.js <datos.json> <marcas.json> <salida.html>
//   datos.json  — la respuesta de GET /api/interno/reporte-planes
//   marcas.json — objeto { [slug]: "quitar"|"potenciar"|"mantener"|"quitar:aplicado"|"potenciar:aplicado" }
//   salida.html — dónde escribir el HTML final, listo para Artifact.publish()

const fs = require("fs");
const path = require("path");

const [, , rutaDatos, rutaMarcas, rutaSalida] = process.argv;
if (!rutaDatos || !rutaMarcas || !rutaSalida) {
  console.error("Uso: node build.js <datos.json> <marcas.json> <salida.html>");
  process.exit(1);
}

const shell = fs.readFileSync(path.join(__dirname, "shell.html"), "utf8");
const datos = JSON.parse(fs.readFileSync(rutaDatos, "utf8"));
const marcas = JSON.parse(fs.readFileSync(rutaMarcas, "utf8"));

datos.generadoEn = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
}).format(new Date());

const [antes, resto1] = shell.split("__DATOS_JSON__");
const [medio, resto2] = resto1.split("__MARCAS_JSON__");
const [entre, final] = resto2.split("<!--INSERTAR_CONSTANTES_AQUI-->");

const doc = "<!doctype html>\n" + antes + JSON.stringify(datos) + medio + JSON.stringify(marcas) + entre + final;

fs.writeFileSync(rutaSalida, doc);
console.log(`${rutaSalida}: ${doc.length} bytes (${datos.totalPuntuales} puntuales, ${datos.totalGenericos} genéricos, ${Object.keys(marcas).length} marcas)`);
