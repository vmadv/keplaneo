import { SITE_URL } from "@/lib/rutasLocale";

export const revalidate = 86400;

// Índice real en la raíz (estilo Civitatis: /sitemap.xml apuntando a
// varios sitemaps hijos por tipo de página) — solo posible dejando de usar
// la convención especial sitemap.ts de Next, que reserva ese path para sí
// misma incluso cuando se divide con generateSitemaps (ver conversación).
const FICHEROS = [
  "sitemap_home.xml",
  "sitemap_paginas.xml",
  "sitemap_variables.xml",
  "sitemap_eventos.xml",
  "sitemap_rankings.xml",
];

export async function GET() {
  const entradas = FICHEROS.map(
    (fichero) => `  <sitemap><loc>${SITE_URL}/${fichero}</loc></sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas}
</sitemapindex>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
