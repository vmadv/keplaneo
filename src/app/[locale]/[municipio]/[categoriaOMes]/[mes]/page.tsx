import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import FiltroTemporal from "@/components/FiltroTemporal";
import { esMesSlugValido, proximosMesesSlugs } from "@/lib/dates";
import { getMunicipio, getPlanesCategoriaMes } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { construirFiltrosTemporales } from "@/lib/filtros";

export const revalidate = 86400;

export function generateStaticParams() {
  // No conocemos aquí la categoría del segmento padre, así que Next
  // combina esta lista con cada valor posible de [categoriaOMes] — de las
  // combinaciones resultantes, solo las que además pasan esCategoriaConPagina
  // (dentro del propio render) llegan a construirse igual.
  return proximosMesesSlugs(12).map((mes) => ({ mes }));
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function CategoriaMesPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; categoriaOMes: string; mes: string }>;
}) {
  const { locale, municipio: municipioSlug, categoriaOMes, mes } = await params;
  setRequestLocale(locale);
  if (!esCategoriaConPagina(categoriaOMes) || !esMesSlugValido(mes)) notFound();

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const catBase = `${base}/${categoriaOMes}`;
  const [planes, temporales, tNav, tCategorias, tCombo, tMeses] = await Promise.all([
    getPlanesCategoriaMes(municipio.id, categoriaOMes, mes),
    construirFiltrosTemporales(catBase, mes),
    getTranslations("Nav"),
    getTranslations("Categorias"),
    getTranslations("CategoriaCombo"),
    getTranslations("Meses"),
  ]);
  const etiqueta = tCategorias(categoriaOMes);
  const nombreMes = capitalizar(tMeses(mes));

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
        <h1 className="text-4xl font-extrabold mt-4 mb-6 text-balance">
          {tCombo("mes", { categoria: etiqueta, municipio: municipio.nombre, mes: nombreMes.toLowerCase() })}
        </h1>

        <FiltroTemporal items={temporales} />

        <PlanList planes={planes} base={base} contexto={mes} />
      </div>
    </main>
  );
}
