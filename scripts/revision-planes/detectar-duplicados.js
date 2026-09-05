#!/usr/bin/env node
// Escanea los eventos activos de un municipio en busca de posibles
// duplicados, reutilizando el MISMO criterio que ya usa el sistema de
// generación (mismoEvento + comprobación de ubicación para genéricos, ver
// src/lib/gemini.ts y src/lib/eventos.ts) — pero aquí solo para DIAGNÓSTICO
// sobre lo que ya está en la base de datos, no para fusionar nada solo. La
// lógica se copia en vez de importarse porque este script corre con node
// plano (sin transpilar TypeScript) — si cambia mismoEvento en gemini.ts,
// hay que traer el cambio aquí también.
//
// Uso: node detectar-duplicados.js [municipio-slug]  (por defecto "sevilla")

const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const municipioSlug = process.argv[2] || "sevilla";

function normalizarTitulo(titulo) {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extraerTrasConector(texto) {
  const m = texto.match(/\b(vs\.?|contra)\s+(.+)$/i);
  return m ? m[2].trim() : null;
}

const PALABRAS_VACIAS = new Set([
  "por", "del", "las", "los", "una", "uno", "sus", "con", "sin", "para",
  "este", "esta", "esto", "estos", "estas", "tras", "muy", "mas", "todo",
  "toda", "todos", "todas", "que", "como", "sobre", "entre", "hasta",
  "desde", "cada", "otro", "otra", "otros", "otras", "son", "hay",
]);

function esPalabraSignificativa(palabra) {
  return palabra.length > 2 && !PALABRAS_VACIAS.has(palabra);
}

function mismoEvento(a, b) {
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
  if (menor < 2) return false;
  const interseccion = [...palabrasA].filter((w) => palabrasB.has(w)).length;
  return interseccion / menor >= 0.7;
}

function quitarMunicipio(texto, municipioNombre) {
  const escapado = municipioNombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto.replace(new RegExp(`\\s*,?\\s*(de\\s+)?${escapado}\\s*$`, "i"), "").trim();
}

function primerTramoUbicacion(ubicacion) {
  return ubicacion.split(",")[0].trim();
}

function mismoTitulo(a, b, municipioNombre) {
  return mismoEvento(quitarMunicipio(a, municipioNombre), quitarMunicipio(b, municipioNombre));
}

function mismoLugarGenerico(a, b, municipioNombre) {
  if (!a.esGenerico || !b.esGenerico) return false;
  if (!a.ubicacion || !b.ubicacion) return false;
  const tramoA = quitarMunicipio(primerTramoUbicacion(a.ubicacion), municipioNombre);
  const tramoB = quitarMunicipio(primerTramoUbicacion(b.ubicacion), municipioNombre);
  if (!tramoA || !tramoB) return false;
  return mismoEvento(tramoA, tramoB);
}

(async () => {
  const { data: municipio, error: errorMunicipio } = await supabase
    .from("municipios")
    .select("id, nombre, slug")
    .eq("slug", municipioSlug)
    .maybeSingle();
  if (errorMunicipio || !municipio) {
    console.error("Municipio no encontrado:", errorMunicipio?.message);
    process.exit(1);
  }

  const { data: eventos, error } = await supabase
    .from("eventos")
    .select("id, slug, titulo, ubicacion, categoria, fecha_inicio, fecha_fin, precio")
    .eq("municipio_id", municipio.id)
    .eq("activo", true)
    .order("titulo");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const usados = new Set();
  const grupos = [];

  for (let i = 0; i < eventos.length; i++) {
    if (usados.has(i)) continue;
    const grupo = [i];
    for (let j = i + 1; j < eventos.length; j++) {
      if (usados.has(j)) continue;
      const a = eventos[i];
      const b = eventos[j];
      const esGenericoA = a.fecha_inicio === null;
      const esGenericoB = b.fecha_inicio === null;
      if (esGenericoA !== esGenericoB) continue; // solo compara dentro del mismo tipo, igual que el dedup real
      const mismo =
        mismoTitulo(a.titulo, b.titulo, municipio.nombre) ||
        mismoLugarGenerico(
          { esGenerico: esGenericoA, ubicacion: a.ubicacion },
          { esGenerico: esGenericoB, ubicacion: b.ubicacion },
          municipio.nombre
        );
      if (mismo) grupo.push(j);
    }
    if (grupo.length > 1) {
      grupo.forEach((idx) => usados.add(idx));
      grupos.push(grupo.map((idx) => eventos[idx]));
    }
  }

  console.log(`${eventos.length} eventos activos en ${municipio.nombre}. ${grupos.length} grupos con posibles duplicados:\n`);
  grupos.forEach((grupo, i) => {
    console.log(`--- Grupo ${i + 1} (${grupo.length} filas) ---`);
    grupo.forEach((e) => {
      console.log(`  [${e.slug}] "${e.titulo}" — ${e.ubicacion || "sin ubicación"} — ${e.fecha_inicio || "genérico"}${e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? " a " + e.fecha_fin : ""}`);
    });
  });
})();
