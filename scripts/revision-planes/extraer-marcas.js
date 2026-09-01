#!/usr/bin/env node
// Extrae el objeto MARCAS embebido en el HTML publicado del artifact de
// revisión (Artifact action:"read" devuelve ese HTML, o lo guarda en un
// fichero si es grande) — para que la tarea programada diaria sepa qué
// marcó Victor desde la última vez sin tener que parsear el HTML a mano en
// el prompt.
//
// Uso: node extraer-marcas.js <artifact.html> <salida.json>

const fs = require("fs");

const [, , rutaHtml, rutaSalida] = process.argv;
if (!rutaHtml || !rutaSalida) {
  console.error("Uso: node extraer-marcas.js <artifact.html> <salida.json>");
  process.exit(1);
}

const html = fs.readFileSync(rutaHtml, "utf8");
const m = html.match(/<script id="datos-marcas"[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("No se encontró el bloque datos-marcas en el HTML — ¿es el artifact correcto?");
  process.exit(1);
}

const marcas = JSON.parse(m[1]);
fs.writeFileSync(rutaSalida, JSON.stringify(marcas));
console.log(`${rutaSalida}: ${Object.keys(marcas).length} marcas encontradas`);
