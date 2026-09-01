#!/usr/bin/env node
// Calcula el MARCAS final que se va a republicar: los eventos recién
// aplicados pasan a su variante ":aplicado", el resto de marcas antiguas se
// conserva tal cual, y solo se guardan marcas de eventos que siguen
// apareciendo en el informe de hoy (un evento quitado ya no sale del todo
// del informe la próxima vez — su marca queda inerte de todas formas, pero
// así MARCAS no crece para siempre con filas que no se van a volver a
// mostrar).
//
// Uso: node fusionar-marcas.js <marcas-viejas.json> <aplicados.json> <datos-nuevos.json> <salida.json>
//   marcas-viejas.json — salida de extraer-marcas.js
//   aplicados.json     — array de slugs que POST /api/interno/marcas acaba de aplicar con éxito
//   datos-nuevos.json  — salida de GET /api/interno/reporte-planes (para saber qué slugs siguen vivos)

const fs = require("fs");

const [, , rutaViejas, rutaAplicados, rutaDatosNuevos, rutaSalida] = process.argv;
if (!rutaViejas || !rutaAplicados || !rutaDatosNuevos || !rutaSalida) {
  console.error("Uso: node fusionar-marcas.js <marcas-viejas.json> <aplicados.json> <datos-nuevos.json> <salida.json>");
  process.exit(1);
}

const viejas = JSON.parse(fs.readFileSync(rutaViejas, "utf8"));
const aplicados = new Set(JSON.parse(fs.readFileSync(rutaAplicados, "utf8")));
const datosNuevos = JSON.parse(fs.readFileSync(rutaDatosNuevos, "utf8"));

const slugsVivos = new Set([...datosNuevos.puntuales, ...datosNuevos.genericos].map((d) => d.slug));

const fusionadas = {};
for (const [slug, valor] of Object.entries(viejas)) {
  if (!slugsVivos.has(slug)) continue; // ya no aparece en el informe, no hace falta conservarla
  if (aplicados.has(slug) && (valor === "quitar" || valor === "potenciar")) {
    fusionadas[slug] = `${valor}:aplicado`;
  } else {
    fusionadas[slug] = valor;
  }
}

fs.writeFileSync(rutaSalida, JSON.stringify(fusionadas));
console.log(`${rutaSalida}: ${Object.keys(fusionadas).length} marcas (de ${Object.keys(viejas).length} antes de fusionar)`);
