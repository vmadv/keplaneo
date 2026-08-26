import { getTranslations } from "next-intl/server";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import ListaEventos from "./ListaEventos";
import HeroPortada from "./HeroPortada";
import type { Evento } from "@/lib/types";
import type { MunicipioConComunidad } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios, type Extra } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";

// Igual que PlanesPageLayout, pero para páginas que leen de `eventos`
// directamente en vez del lote diario de `planes` — "esta semana" y las
// franjas atemporales ("siempre": el hub, gratis, en pareja, con niños).
export default async function EventosPageLayout({
  municipio,
  municipioSlug,
  titulo,
  fecha,
  eventos,
  current,
  breadcrumbExtra,
  contexto,
  obtenerEtiqueta,
  mensajeVacio,
}: {
  municipio: MunicipioConComunidad;
  municipioSlug: string;
  titulo: string;
  fecha?: string;
  eventos: Evento[];
  current: { vigencia: "siempre" | "semana"; extra?: Extra };
  breadcrumbExtra: BreadcrumbItem[];
  contexto?: string;
  obtenerEtiqueta?: (evento: Evento) => string | null;
  mensajeVacio?: string;
}) {
  const base = `/${municipioSlug}`;
  const [primarios, secundarios, tNav] = await Promise.all([
    construirFiltrosTemporales(base, current.vigencia, current.extra),
    construirFiltrosSecundarios(base, current.vigencia, current.extra),
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
        <ListaEventos
          eventos={eventos}
          base={base}
          contexto={contexto}
          obtenerEtiqueta={obtenerEtiqueta}
          mensajeVacio={mensajeVacio}
        />
      </div>
    </main>
  );
}
