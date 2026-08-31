import type { MetadataRoute } from "next";
import { revalidatePath } from "next/cache";
import {
  getComunidadBySlug,
  getMunicipiosByComunidad,
  getEventosActivosParaSitemap,
  getMunicipiosConRankings,
  getListadosDelMunicipio,
  getLugaresParaSitemap,
} from "@/lib/queries";
import { alternatesIdiomas, hrefFiltro, segmentoVigencia } from "@/lib/rutasLocale";
import { fechaDesdeTextoEspanol, hoyEnMadrid } from "@/lib/dates";
import { CATEGORIAS_CON_PAGINA, MESES } from "@/lib/types";

// Llamado una sola vez por ejecución de cron (no por municipio) — los
// sitemaps son globales, no específicos de un municipio. `revalidate =
// 86400` en cada route.ts de sitemap significa hasta 24h de desfase si no
// se fuerza aquí tras generar contenido nuevo.
export function revalidarSitemaps(): void {
  [
    "/sitemap.xml",
    "/sitemap_home.xml",
    "/sitemap_paginas.xml",
    "/sitemap_variables.xml",
    "/sitemap_eventos.xml",
    "/sitemap_rankings.xml",
    "/sitemap_establecimientos.xml",
  ].forEach((path) => revalidatePath(path));
}

// Datos de los sitemaps, separados por tipo de página en varios ficheros
// (home / genéricas / variables / eventos / rankings) en vez de uno solo
// — para que sea fácil de revisar/mantener, no por límite de tamaño (muy
// lejos de las 50.000 URLs que permite un solo sitemap). Cada uno se sirve
// desde su propio route.ts (ver /sitemap_*.xml), no desde la convención
// especial sitemap.ts de Next: esa reserva /sitemap.xml para sí misma, y
// esa ruta la necesitamos libre para el índice real (ver conversación).

// Cada entrada española + inglesa por separado (recomendación de Google
// para sitemaps multilingües), ambas con el mismo bloque alternates.
// languages (autorreferencia + la otra + x-default) — mismo helper que ya
// usa el hreflang de generateMetadata en cada página real.
function entradasBilingues(
  rutaEspanola: string,
  extra?: Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority" | "lastModified">
): MetadataRoute.Sitemap {
  const languages = alternatesIdiomas(rutaEspanola);
  return [
    { url: languages.es, alternates: { languages }, ...extra },
    { url: languages.en, alternates: { languages }, ...extra },
  ];
}

async function municipiosDeLaProvincia() {
  const comunidad = await getComunidadBySlug("andalucia");
  return comunidad ? getMunicipiosByComunidad(comunidad.id) : [];
}

export async function sitemapHome(): Promise<MetadataRoute.Sitemap> {
  return entradasBilingues("/", { changeFrequency: "daily", priority: 1 });
}

// Una página por (municipio × una sola variable): la franja de "Cuándo" a
// secas (siempre/hoy/finde/esta-semana), las tres variantes atemporales
// (gratis/con-ninos/en-pareja) y el hub de cada categoría a secas.
export async function sitemapPaginas(): Promise<MetadataRoute.Sitemap> {
  const municipios = await municipiosDeLaProvincia();
  const entradas: MetadataRoute.Sitemap = [];

  for (const m of municipios) {
    const base = `/${m.slug}`;
    const rutas = [
      hrefFiltro("es", base, "siempre"),
      hrefFiltro("es", base, "hoy"),
      hrefFiltro("es", base, "finde"),
      hrefFiltro("es", base, "semana"),
      hrefFiltro("es", base, "siempre", "gratis"),
      hrefFiltro("es", base, "siempre", "familia"),
      hrefFiltro("es", base, "siempre", "pareja"),
      ...CATEGORIAS_CON_PAGINA.map((cat) => `${base}/${cat}`),
    ];
    for (const ruta of rutas) {
      entradas.push(...entradasBilingues(ruta, { changeFrequency: "daily", priority: 0.8 }));
    }
  }
  return entradas;
}

// Combinaciones de DOS variables: vigencia+audiencia/precio, categoría+
// vigencia, categoría+mes, y el mes a secas (12 meses, mismo criterio que
// generateStaticParams de [categoriaOMes]/page.tsx: no solo los 2 más
// próximos que enlaza la navegación, también el resto — ver conversación).
export async function sitemapVariables(): Promise<MetadataRoute.Sitemap> {
  const municipios = await municipiosDeLaProvincia();
  const entradas: MetadataRoute.Sitemap = [];
  const VIGENCIAS_TEMPORALES = ["hoy", "finde", "semana"] as const;
  const EXTRAS = ["pareja", "familia", "gratis"] as const;

  for (const m of municipios) {
    const base = `/${m.slug}`;
    const rutas: string[] = [];

    for (const vigencia of VIGENCIAS_TEMPORALES) {
      for (const extra of EXTRAS) {
        rutas.push(hrefFiltro("es", base, vigencia, extra));
      }
      for (const categoria of CATEGORIAS_CON_PAGINA) {
        rutas.push(`${base}/${categoria}/${segmentoVigencia("es", vigencia)}`);
      }
    }
    for (const mes of MESES) {
      rutas.push(`${base}/${mes}`);
      for (const categoria of CATEGORIAS_CON_PAGINA) {
        rutas.push(`${base}/${categoria}/${mes}`);
      }
    }

    for (const ruta of rutas) {
      entradas.push(...entradasBilingues(ruta, { changeFrequency: "weekly", priority: 0.7 }));
    }
  }
  return entradas;
}

// Un evento ya finalizado tiene `robots: {index:false}` en su propia
// página (ver eventos/[evento]/page.tsx) — no tiene sentido anunciarlo en
// el sitemap, Google desaconseja listar ahí páginas noindex. Se descarta
// con la misma fecha real que usa esa página, no con el flag `activo`
// (puede seguir activo unos días de margen tras finalizar, ver
// upsertEventosDelLote).
export async function sitemapEventos(): Promise<MetadataRoute.Sitemap> {
  const eventos = await getEventosActivosParaSitemap();
  const hoy = hoyEnMadrid();
  const entradas: MetadataRoute.Sitemap = [];

  for (const e of eventos) {
    if (e.fechaInicio) {
      const finTexto = e.fechaFin ?? e.fechaInicio;
      const fin = finTexto ? fechaDesdeTextoEspanol(finTexto) : null;
      if (fin && fin < hoy) continue;
    }
    const ruta = `/${e.municipioSlug}/eventos/${e.slug}`;
    entradas.push(
      ...entradasBilingues(ruta, {
        changeFrequency: "weekly",
        priority: e.fechaInicio ? 0.4 : 0.5,
        lastModified: new Date(e.ultimaDeteccion),
      })
    );
  }
  return entradas;
}

// Fichas de lugar individuales (/rankings/.../lugares/[lugar]) — antes
// deliberadamente fuera del sitemap por no disparar las consultas a la BD
// solo para esto (ver el comentario que llevaba sitemapRankings), pero el
// usuario las quiere anunciadas: "establecimientos" un escalón por debajo
// de las páginas genéricas con variable/rankings, y por encima de los
// eventos puntuales (ver conversación sobre el orden de prioridades).
export async function sitemapEstablecimientos(): Promise<MetadataRoute.Sitemap> {
  const [lugares, municipios] = await Promise.all([getLugaresParaSitemap(), getMunicipiosConRankings()]);
  const municipioPorId = new Map(municipios.map((m) => [m.id, m]));
  const entradas: MetadataRoute.Sitemap = [];

  for (const lugar of lugares) {
    const municipio = municipioPorId.get(lugar.municipioId);
    // Un lugar de un municipio sin ranking publicado no es alcanzable desde
    // ninguna página real todavía (la ficha vive bajo la jerarquía de
    // rankings) — se descarta, mismo criterio que sitemapRankings.
    if (!municipio) continue;
    const ruta = `/rankings/espana/${municipio.comunidad.slug}/${municipio.provinciaSlug}/${municipio.slug}/lugares/${lugar.slug}`;
    entradas.push(
      ...entradasBilingues(ruta, {
        changeFrequency: "weekly",
        priority: 0.6,
        lastModified: new Date(lugar.ultimaActualizacion),
      })
    );
  }
  return entradas;
}

// Vertical de Rankings: el índice de cada municipio con rankings
// publicados + cada ranking numerado — no se enumeran aquí las fichas de
// lugar/sección individuales (van en sitemapEstablecimientos, más arriba).
export async function sitemapRankings(): Promise<MetadataRoute.Sitemap> {
  const municipios = await getMunicipiosConRankings();
  const entradas: MetadataRoute.Sitemap = [
    ...entradasBilingues("/rankings", { changeFrequency: "weekly", priority: 0.5 }),
  ];

  for (const m of municipios) {
    const base = `/rankings/espana/${m.comunidad.slug}/${m.provinciaSlug}/${m.slug}`;
    entradas.push(...entradasBilingues(base, { changeFrequency: "weekly", priority: 0.7 }));

    const listados = await getListadosDelMunicipio(m.id);
    for (const listado of listados) {
      entradas.push(
        ...entradasBilingues(`${base}/${listado.slug}`, {
          changeFrequency: "weekly",
          priority: 0.7,
          lastModified: new Date(listado.actualizado_en),
        })
      );
    }
  }
  return entradas;
}
