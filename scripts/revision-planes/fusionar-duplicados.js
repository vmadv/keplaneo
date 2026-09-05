#!/usr/bin/env node
// Aplica de verdad la fusión de un grupo de duplicados confirmados (ver
// detectar-duplicados.js): desactiva cada "perdedor" y deja su página
// haciendo un 308 permanente hacia el "superviviente" (migración 0022,
// columna eventos.redirige_a_slug) — nunca borra filas ni toca el
// superviviente.
//
// Uso: node fusionar-duplicados.js <mapping.json>
//   mapping.json: { "slug-superviviente": ["slug-perdedor-1", "slug-perdedor-2"], ... }

const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const rutaMapping = process.argv[2];
if (!rutaMapping) {
  console.error("Uso: node fusionar-duplicados.js <mapping.json>");
  process.exit(1);
}
const mapping = JSON.parse(fs.readFileSync(rutaMapping, "utf8"));

(async () => {
  for (const [superviviente, perdedores] of Object.entries(mapping)) {
    const { data: existe } = await supabase.from("eventos").select("slug").eq("slug", superviviente).eq("activo", true).maybeSingle();
    if (!existe) {
      console.error(`SALTADO: "${superviviente}" no existe o no está activo — revisa el slug antes de reintentar.`);
      continue;
    }
    for (const perdedor of perdedores) {
      const { error, count } = await supabase
        .from("eventos")
        .update({ activo: false, redirige_a_slug: superviviente }, { count: "exact" })
        .eq("slug", perdedor);
      if (error) console.error(`ERROR "${perdedor}" -> "${superviviente}": ${error.message}`);
      else if (count === 0) console.error(`AVISO: "${perdedor}" no coincidió con ninguna fila.`);
      else console.log(`"${perdedor}" desactivado, redirige a "${superviviente}"`);
    }
  }
})();
