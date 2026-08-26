import { getTranslations } from "next-intl/server";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import PlanList from "./PlanList";
import HeroPortada from "./HeroPortada";
import type { Plan } from "@/lib/types";
import type { MunicipioConComunidad } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";

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
  current: { vigencia: "hoy" | "finde"; audiencia?: "pareja" | "familia" };
  breadcrumbExtra: BreadcrumbItem[];
}) {
  const base = `/${municipioSlug}`;
  const [primarios, secundarios, tNav] = await Promise.all([
    construirFiltrosTemporales(base, current.vigencia, current.audiencia),
    construirFiltrosSecundarios(base, { tipo: current.vigencia }, current.audiencia),
    getTranslations("Nav"),
  ]);
  const imagenHero = buscarImagenHero(municipio.slug);

  return (
    <main className="flex-1 bg-dots">
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
        <FiltrosPagina primarios={primarios} secundarios={secundarios} />
        <PlanList
          planes={planes}
          base={base}
          mostrarDiaFinde={current.vigencia === "finde"}
          contexto={current.vigencia}
        />
      </div>
    </main>
  );
}
