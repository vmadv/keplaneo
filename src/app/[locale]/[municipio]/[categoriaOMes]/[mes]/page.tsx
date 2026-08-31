import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import ListaEventos from "@/components/ListaEventos";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { normalizarMesSlug, mesSlugParaLocale, proximosMesesSlugs } from "@/lib/dates";
import { ordenarParaMes, idsEventoDePlanes } from "@/lib/semana";
import { getMunicipio, getPlanesCategoriaMes, getEventosPorCategoria } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { construirTituloConSufijo } from "@/lib/resumenSeleccion";
import { buscarImagenHero } from "@/lib/heroImage";
import { alternatesIdiomas } from "@/lib/rutasLocale";

export const revalidate = 86400;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  // No conocemos aquí la categoría del segmento padre, así que Next
  // combina esta lista con cada valor posible de [categoriaOMes] — de las
  // combinaciones resultantes, solo las que además pasan esCategoriaConPagina
  // (dentro del propio render) llegan a construirse igual.
  return proximosMesesSlugs(12).map((mes) => ({ mes: mesSlugParaLocale(mes, params.locale) }));
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; categoriaOMes: string; mes: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, categoriaOMes, mes: mesUrl } = await params;
  const mes = normalizarMesSlug(mesUrl);
  if (!esCategoriaConPagina(categoriaOMes) || !mes) return {};
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};

  const [tCategorias, tCombo, tMeses, locale] = await Promise.all([
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    getTranslations("Meses"),
    getLocale(),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const nombreMes = tMeses(mes);
  const title = await construirTituloConSufijo(
    tCombo("mes", { categoria: etiqueta, municipio: municipio.nombre, mes: nombreMes.toLowerCase() })
  );
  const description = tCombo("metaDescripcion", {
    categoria: etiqueta.toLowerCase(),
    municipio: municipio.nombre,
    mes: nombreMes,
  });
  const alt = alternatesIdiomas(`/${municipioSlug}/${categoriaOMes}/${mes}`);
  return {
    title,
    description,
    alternates: { languages: alt, canonical: alt[locale] },
  };
}

export default async function CategoriaMesPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; categoriaOMes: string; mes: string }>;
}) {
  const { locale, municipio: municipioSlug, categoriaOMes, mes: mesUrl } = await params;
  setRequestLocale(locale);
  const mes = normalizarMesSlug(mesUrl);
  if (!esCategoriaConPagina(categoriaOMes) || !mes) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const catBase = `${base}/${categoriaOMes}`;
  const [planes, eventosActivos, temporales, secundarios, tNav, tCategorias, tCombo, tMeses, tPlanList] =
    await Promise.all([
      getPlanesCategoriaMes(municipio.id, categoriaOMes, mes),
      getEventosPorCategoria(municipio.id, categoriaOMes),
      construirFiltrosTemporales(catBase, mes),
      // `base` (no `catBase`): las pastillas de temática deben cambiar de
      // categoría manteniendo el mes (/exposiciones/agosto), no anidarse
      // dentro de la categoría actual — mismo criterio que ya usa la página
      // de mes a secas para enlazar a estas combinaciones.
      construirFiltrosSecundarios(base, mes, undefined, categoriaOMes),
      getTranslations("Nav"),
      getTranslations("Categorias"),
      getTranslations("CategoriaCombo"),
      getTranslations("Meses"),
      getTranslations("PlanList"),
    ]);
  const etiqueta = tCategorias(categoriaOMes);
  const nombreMes = capitalizar(tMeses(mes));
  const idsCurados = idsEventoDePlanes(planes);
  const relleno = ordenarParaMes(eventosActivos, mes).filter((e) => !idsCurados.has(e.id));

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: etiqueta, href: catBase },
            { label: nombreMes },
          ]}
        />
        <HeroPortada
          imagenHero={buscarImagenHero(municipio.slug)}
          alt={municipio.nombre}
          titulo={tCombo("mes", { categoria: etiqueta, municipio: municipio.nombre, mes: nombreMes.toLowerCase() })}
        />

        <FiltrosPagina primarios={temporales} secundarios={secundarios} />

        {planes.length > 0 && <PlanList planes={planes} base={base} contexto={mes} municipioNombre={municipio.nombre} />}
        {relleno.length > 0 && (
          <div className={planes.length > 0 ? "mt-5" : undefined}>
            <ListaEventos eventos={relleno} base={base} contexto={mes} municipioNombre={municipio.nombre} />
          </div>
        )}
        {planes.length === 0 && relleno.length === 0 && (
          <p style={{ color: "var(--muted-foreground)" }}>{tPlanList("vacioGeneral")}</p>
        )}
      </div>
    </main>
  );
}
