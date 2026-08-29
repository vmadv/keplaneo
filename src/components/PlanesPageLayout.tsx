import { getTranslations } from "next-intl/server";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import PlanList from "./PlanList";
import HeroPortada from "./HeroPortada";
import { IntroSeleccion, TituloLista, FaqSeleccion } from "./ResumenSeleccion";
import type { Plan } from "@/lib/types";
import type { MunicipioConComunidad } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios, type Extra } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";
import { construirFaqSeleccion } from "@/lib/resumenSeleccion";
import { construirFaqJsonLd } from "@/lib/structuredData";

export default async function PlanesPageLayout({
  municipio,
  municipioSlug,
  titulo,
  fecha,
  planes,
  current,
  breadcrumbExtra,
}: {
  municipio: MunicipioConComunidad;
  municipioSlug: string;
  titulo: string;
  fecha?: string;
  planes: Plan[];
  current: { vigencia: "hoy" | "finde"; extra?: Extra };
  breadcrumbExtra: BreadcrumbItem[];
}) {
  const base = `/${municipioSlug}`;
  const [primarios, secundarios, tNav] = await Promise.all([
    construirFiltrosTemporales(base, current.vigencia, current.extra),
    construirFiltrosSecundarios(base, current.vigencia, current.extra),
    getTranslations("Nav"),
  ]);
  const imagenHero = buscarImagenHero(municipio.slug);
  const itemsResumen = planes.map((p) => ({
    categoria: p.evento_categoria,
    fechaActualizacion: p.fecha_generacion,
    puntual: p.tipo === "excepcional",
  }));
  const preguntas = await construirFaqSeleccion(itemsResumen, municipio.nombre, current.vigencia, current.extra);
  const jsonLdFaq = construirFaqJsonLd(preguntas);

  return (
    <main className="flex-1 bg-dots">
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            ...breadcrumbExtra,
          ]}
        />
        <HeroPortada imagenHero={imagenHero} alt={municipio.nombre} titulo={titulo} fecha={fecha} />
        <IntroSeleccion
          items={itemsResumen}
          municipio={municipio.nombre}
          vigencia={current.vigencia}
          extra={current.extra}
        />
        <FiltrosPagina primarios={primarios} secundarios={secundarios} />
        {planes.length > 0 && (
          <TituloLista municipio={municipio.nombre} vigencia={current.vigencia} extra={current.extra} />
        )}
        <PlanList
          planes={planes}
          base={base}
          mostrarDiaFinde={current.vigencia === "finde"}
          contexto={current.vigencia}
        />
        <FaqSeleccion preguntas={preguntas} />
      </div>
    </main>
  );
}
