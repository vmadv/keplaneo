import { SITE_URL } from "@/lib/rutasLocale";

export const revalidate = 86400;

// Índice que agrupa los 5 sitemaps generados por generateSitemaps en
// sitemap.ts (que Next sirve en /sitemap/[id].xml, no en /sitemap.xml) —
// así Search Console solo necesita una URL en vez de cinco. No puede
// llamarse /sitemap.xml: Next reserva ese path para la convención de
// sitemap.ts aunque esté vacío, y choca en build (ver conversación).
const NUM_SITEMAPS = 5;

export async function GET() {
  const entradas = Array.from(
    { length: NUM_SITEMAPS },
    (_, id) => `  <sitemap><loc>${SITE_URL}/sitemap/${id}.xml</loc></sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas}
</sitemapindex>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
