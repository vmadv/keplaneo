import { SITE_URL } from "@/lib/rutasLocale";

export const revalidate = 86400;

// Convención emergente (llmstxt.org): un resumen en markdown plano para
// que un LLM entienda el sitio sin tener que rastrearlo entero. No hay
// downside real de tenerlo — barato de mantener, cada vez más leído.
export async function GET() {
  const texto = `# Keplaneo

> Portal de planes y actividades: qué hacer hoy, este fin de semana o este mes, con información actualizada cada día. Disponible en español (por defecto) e inglés (/en).

Actualmente centrado en Sevilla y los municipios de su provincia (Andalucía, España), con previsión de ampliar a más ciudades.

## Páginas principales

- [Inicio](${SITE_URL}/): planes destacados y accesos rápidos.
- [Qué hacer en Sevilla](${SITE_URL}/sevilla): hub principal de la ciudad, con planes de hoy, este fin de semana, este mes y todo el año.
- [Rankings](${SITE_URL}/rankings): listados verificados (mejores hoteles, restaurantes...) por municipio.

## Cómo se genera el contenido

Los planes y eventos se detectan y actualizan automáticamente cada día. Los rankings verifican cada candidato contra Google Maps (nota mínima y número de reseñas reales) antes de incluirlo, y se ordenan por ese criterio objetivo — no por popularidad genérica.

## Sitemap

${SITE_URL}/sitemap.xml
`;

  return new Response(texto, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
