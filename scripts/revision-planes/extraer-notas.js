#!/usr/bin/env node
// Extrae el objeto NOTAS embebido en el HTML publicado del artifact de
// revisión (mismo patrón que extraer-marcas.js, ver ese fichero) — el texto
// libre que Victor deja por fila para sacar aprendizaje más adelante.
//
// Uso: node extraer-notas.js <artifact.html> <salida.json>

const fs = require("fs");

const [, , rutaHtml, rutaSalida] = process.argv;
if (!rutaHtml || !rutaSalida) {
  console.error("Uso: node extraer-notas.js <artifact.html> <salida.json>");
  process.exit(1);
}

const html = fs.readFileSync(rutaHtml, "utf8");
const m = html.match(/<script id="datos-notas"[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.error("No se encontró el bloque datos-notas en el HTML — ¿es el artifact correcto?");
  process.exit(1);
}

const notas = JSON.parse(m[1]);
fs.writeFileSync(rutaSalida, JSON.stringify(notas));
console.log(`${rutaSalida}: ${Object.keys(notas).length} notas encontradas`);
