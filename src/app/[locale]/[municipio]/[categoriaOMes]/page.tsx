import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Breadcrumb from "@/components/Breadcrumb";
import PlanList from "@/components/PlanList";
import ListaEventos from "@/components/ListaEventos";
import FiltroTemporal from "@/components/FiltroTemporal";
import FiltrosPagina from "@/components/FiltrosPagina";
import HeroPortada from "@/components/HeroPortada";
import { esMesSlugValido, proximosMesesSlugs } from "@/lib/dates";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { getMunicipio, getPlanesDelMes, getEventosPorCategoria } from "@/lib/queries";
import { esCategoriaConPagina } from "@/lib/types";
import { buscarImagenHero } from "@/lib/heroImage";
import { construirTituloConSufijo } from "@/lib/resumenSeleccion";

export const revalidate = 86400;

export function generateStaticParams() {
  return proximosMesesSlugs(12).map((mes) => ({ categoriaOMes: mes }));
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ municipio: string; categoriaOMes: string }>;
}): Promise<Metadata> {
  const { municipio: municipioSlug, categoriaOMes } = await params;
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return {};

  if (esMesSlugValido(categoriaOMes)) {
    const mes = categoriaOMes;
    const [tMes, tMeses] = await Promise.all([getTranslations("Mes"), getTranslations("Meses")]);
    const title = await construirTituloConSufijo(
      tMes("titulo", { municipio: municipio.nombre, mes: capitalizar(tMeses(mes)) })
    );
    const description = tMes("metaDescripcion", { municipio: municipio.nombre, mes: tMeses(mes) });
    return { title, description };
  }

  if (esCategoriaConPagina(categoriaOMes)) {
    const [tCategoria, tCategorias] = await Promise.all([
      getTranslations("Categoria"),
      getTranslations("Categorias"),
    ]);
    const etiqueta = tCategorias(categoriaOMes);
    const title = await construirTituloConSufijo(tCategoria("titulo", { categoria: etiqueta, municipio: municipio.nombre }));
    const description = tCategoria("metaDescripcion", { categoria: etiqueta.toLowerCase(), municipio: municipio.nombre });
    return { title, description };
  }

  return {};
}

// Esta misma ruta resuelve dos cosas distintas según lo que traiga la URL:
// un mes (/sevilla/agosto, como antes) o una categoría temática
// (/sevilla/conciertos, hub con enlaces a hoy/finde/mes de esa categoría).
// No pueden ser dos carpetas dinámicas separadas al mismo nivel — Next.js
// no lo permite — así que se resuelven aquí dentro.
export default async function CategoriaOMesPage({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; categoriaOMes: string }>;
}) {
  const { locale, municipio: municipioSlug, categoriaOMes } = await params;
  setRequestLocale(locale);

  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) notFound();

  const base = `/${municipioSlug}`;
  const tNav = await getTranslations("Nav");

  if (esMesSlugValido(categoriaOMes)) {
    const mes = categoriaOMes;
    const [planes, primarios, secundarios, tMes, tMeses] = await Promise.all([
      getPlanesDelMes(municipio.id, mes),
      construirFiltrosTemporales(base, mes),
      construirFiltrosSecundarios(base, mes),
      getTranslations("Mes"),
      getTranslations("Meses"),
    ]);
    const nombreMes = capitalizar(tMeses(mes));

    return (
      <main className="flex-1 bg-dots">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Breadcrumb
            items={[
              { label: tNav("inicio"), href: "/" },
              { label: municipio.comunidad.nombre },
              { label: municipio.nombre, href: base },
              { label: nombreMes },
            ]}
          />
          <HeroPortada
            imagenHero={buscarImagenHero(municipio.slug)}
            alt={municipio.nombre}
            titulo={tMes("titulo", { municipio: municipio.nombre, mes: nombreMes })}
          />

          <FiltrosPagina primarios={primarios} secundarios={secundarios} />

          <PlanList planes={planes} base={base} contexto={mes} municipioNombre={municipio.nombre} />
        </div>
      </main>
    );
  }

  if (esCategoriaConPagina(categoriaOMes)) {
    const categoria = categoriaOMes;
    const catBase = `${base}/${categoria}`;
    const [eventos, temporales, tCategoria, tCategorias, tFiltros] = await Promise.all([
      getEventosPorCategoria(municipio.id, categoria),
      construirFiltrosTemporales(catBase, ""),
      getTranslations("Categoria"),
      getTranslations("Categorias"),
      getTranslations("Filtros"),
    ]);
    const etiqueta = tCategorias(categoria);
    // "Todos" (esta misma página) va primero y activo; el resto son enlaces
    // a las páginas de hoy/finde/mes ya existentes, mismo patrón que el
    // resto del sitio. Se descarta de `temporales` el que apunte a la
    // misma URL que "Todos" ("Siempre", que aquí sería redundante) para no
    // duplicar la pastilla.
    const filtros = [
      { label: tFiltros("todos"), href: catBase, activo: true },
      ...temporales.filter((item) => item.href !== catBase),
    ];

    return (
      <main className="flex-1 bg-dots">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Breadcrumb
            items={[
              { label: tNav("inicio"), href: "/" },
              { label: municipio.comunidad.nombre },
              { label: municipio.nombre, href: base },
              { label: etiqueta },
            ]}
          />
          <h1 className="text-4xl font-extrabold mt-4 mb-6 text-balance">
            {tCategoria("titulo", { categoria: etiqueta, municipio: municipio.nombre })}
          </h1>

          <FiltroTemporal items={filtros} />

          <ListaEventos eventos={eventos} base={base} />

          <p className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
            <Link href={base} className="btn-primary">
              {tNav("verTodosLosPlanes", { municipio: municipio.nombre })}
            </Link>
          </p>
        </div>
      </main>
    );
  }

  notFound();
}
