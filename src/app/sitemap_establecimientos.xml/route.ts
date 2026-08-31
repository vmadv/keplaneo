import { sitemapEstablecimientos } from "@/lib/sitemapData";
import { serializarSitemap } from "@/lib/sitemapXml";

export const revalidate = 86400;

export async function GET() {
  return new Response(serializarSitemap(await sitemapEstablecimientos()), {
    headers: { "Content-Type": "application/xml" },
  });
}
