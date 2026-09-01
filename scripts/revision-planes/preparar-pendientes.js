#!/usr/bin/env node
// A partir de las marcas leídas del artifact, arma el cuerpo que espera
// POST /api/interno/marcas: solo las que todavía no se aplicaron (excluye
// "mantener", que no requiere ningún cambio en BD, y cualquier variante
// ":aplicado" ya procesada en una ejecución anterior).
//
// Uso: node preparar-pendientes.js <marcas.json> <municipio> <salida.json>

const fs = require("fs");

const [, , rutaMarcas, municipio, rutaSalida] = process.argv;
if (!rutaMarcas || !municipio || !rutaSalida) {
  console.error("Uso: node preparar-pendientes.js <marcas.json> <municipio> <salida.json>");
  process.exit(1);
}

const marcas = JSON.parse(fs.readFileSync(rutaMarcas, "utf8"));
const pendientes = Object.entries(marcas)
  .filter(([, valor]) => valor === "quitar" || valor === "potenciar")
  .map(([slug, valor]) => ({ slug, valor, municipio }));

fs.writeFileSync(rutaSalida, JSON.stringify({ marcas: pendientes }));
console.log(`${rutaSalida}: ${pendientes.length} pendientes de aplicar`);
