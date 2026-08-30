import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import TarjetaCiudad from "@/components/TarjetaCiudad";
import { buscarImagenHero } from "@/lib/heroImage";
import { getComunidadBySlug, getMunicipiosByComunidad } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { alternatesIdiomas } from "@/lib/rutasLocale";

export const revalidate = 86400;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];

// A qué URL de cada municipio lleva cada filtro — ver conversación: los
// bloques "En pareja/Con niños/Gratis" y de categoría de la portada no
// saben a qué ciudad ir, así que primero pasan por aquí a elegirla.
// "con-ninos" es el slug de URL (igual que en /esta-semana/con-ninos); el
// valor interno para traducciones/BD sigue siendo "familia".
function construirHref(filtro: string, municipioSlug: string): string | null {
  const base = `/${municipioSlug}`;
  if (filtro === "pareja" || filtro === "con-ninos") return `${base}/esta-semana/${filtro}`;
  if (filtro === "gratis") return `${base}/gratis`;
  if (esCategoriaConPagina(filtro)) return `${base}/${filtro}`;
  return null;
}

async function tituloDelFiltro(filtro: string): Promise<string | null> {
  if (filtro === "pareja" || filtro === "con-ninos") {
    const t = await getTranslations("Audiencia");
    return t(filtro === "con-ninos" ? "familia" : filtro);
  }
  if (filtro === "gratis") {
    const t = await getTranslations("Home");
    return t("tituloGratis");
  }
  if (esCategoriaConPagina(filtro)) {
    const t = await getTranslations("Categorias");
    return t(filtro);
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ filtro: string }>;
}): Promise<Metadata> {
  const { filtro } = await params;
  const titulo = await tituloDelFiltro(filtro);
  if (!titulo) return {};
  const [tElegirCiudad, locale] = await Promise.all([getTranslations("ElegirCiudad"), getLocale()]);
  const alt = alternatesIdiomas(`/elige-ciudad/${filtro}`);
  return {
    title: titulo,
    description: tElegirCiudad("subtitulo"),
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function ElegirCiudadPage({
  params,
}: {
  params: Promise<{ filtro: string }>;
}) {
  const { filtro } = await params;
  const titulo = await tituloDelFiltro(filtro);
  if (!titulo) notFound();

  const [comunidad, tNav, tElegirCiudad] = await Promise.all([
    getComunidadBySlug("andalucia"),
    getTranslations("Nav"),
    getTranslations("ElegirCiudad"),
  ]);
  const municipios = comunidad ? await getMunicipiosByComunidad(comunidad.id) : [];

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb items={[{ label: tNav("inicio"), href: "/" }, { label: titulo }]} />
        <h1 className="text-4xl font-extrabold mt-4 mb-2 text-balance">{titulo}</h1>
        <p className="mb-8 text-lg" style={{ color: "var(--muted-foreground)" }}>
          {tElegirCiudad("subtitulo")}
        </p>

        <ul className="grid sm:grid-cols-2 gap-5">
          {municipios.map((m, i) => {
            const href = construirHref(filtro, m.slug);
            if (!href) return null;
            return (
              <li key={m.id}>
                <TarjetaCiudad
                  nombre={m.nombre}
                  href={href}
                  color={COLORES[i % COLORES.length]}
                  imagen={buscarImagenHero(m.slug)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
