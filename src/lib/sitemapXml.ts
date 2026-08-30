import type { MetadataRoute } from "next";

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Replica a mano el XML que generaba el archivo especial sitemap.ts de
// Next (mismo orden de campos: loc, xhtml:link por idioma, lastmod,
// changefreq, priority). Ya no podemos usar esa convención porque reserva
// /sitemap.xml para sí misma — y esa ruta la necesitamos libre para el
// índice real estilo Civitatis (ver conversación).
export function serializarSitemap(entradas: MetadataRoute.Sitemap): string {
  const urls = entradas
    .map((entrada) => {
      const partes = [`<loc>${escaparXml(entrada.url)}</loc>`];
      if (entrada.alternates?.languages) {
        for (const [hreflang, href] of Object.entries(entrada.alternates.languages)) {
          if (typeof href === "string") {
            partes.push(`<xhtml:link rel="alternate" hreflang="${hreflang}" href="${escaparXml(href)}" />`);
          }
        }
      }
      if (entrada.lastModified) {
        const fecha = entrada.lastModified instanceof Date ? entrada.lastModified.toISOString() : entrada.lastModified;
        partes.push(`<lastmod>${fecha}</lastmod>`);
      }
      if (entrada.changeFrequency) partes.push(`<changefreq>${entrada.changeFrequency}</changefreq>`);
      if (entrada.priority !== undefined) partes.push(`<priority>${entrada.priority}</priority>`);
      return `<url>\n${partes.join("\n")}\n</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}
