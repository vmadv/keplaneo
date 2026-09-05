#!/usr/bin/env node
// Conserva las notas de texto libre de un día para otro — a diferencia de
// fusionar-marcas.js, aquí no hay estado "aplicado" que actualizar: una
// nota simplemente sobrevive mientras el plan siga apareciendo en el
// informe (ver conversación, mismo criterio de "slug vivo" que las marcas).
//
// Uso: node fusionar-notas.js <notas-viejas.json> <datos-nuevos.json> <salida.json>

const fs = require("fs");

const [, , rutaViejas, rutaDatosNuevos, rutaSalida] = process.argv;
if (!rutaViejas || !rutaDatosNuevos || !rutaSalida) {
  console.error("Uso: node fusionar-notas.js <notas-viejas.json> <datos-nuevos.json> <salida.json>");
  process.exit(1);
}

const viejas = JSON.parse(fs.readFileSync(rutaViejas, "utf8"));
const datosNuevos = JSON.parse(fs.readFileSync(rutaDatosNuevos, "utf8"));
const slugsVivos = new Set([...datosNuevos.puntuales, ...datosNuevos.genericos].map((d) => d.slug));

const fusionadas = {};
for (const [slug, texto] of Object.entries(viejas)) {
  if (slugsVivos.has(slug)) fusionadas[slug] = texto;
}

fs.writeFileSync(rutaSalida, JSON.stringify(fusionadas));
console.log(`${rutaSalida}: ${Object.keys(fusionadas).length} notas (de ${Object.keys(viejas).length} antes de fusionar)`);
