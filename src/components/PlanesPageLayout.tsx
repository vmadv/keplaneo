import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import PlanList from "./PlanList";
import ListaEventos from "./ListaEventos";
import HeroPortada from "./HeroPortada";
import { IntroSeleccion, TituloLista, FaqSeleccion } from "./ResumenSeleccion";
import type { Plan, Evento } from "@/lib/types";
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
  relleno,
  obtenerEtiquetaRelleno,
  current,
  breadcrumbExtra,
  enlaceMasPlanes,
}: {
  municipio: MunicipioConComunidad;
  municipioSlug: string;
  titulo: string;
  fecha?: string;
  planes: Plan[];
  // Eventos puntuales reales que el lote curado del día (planes) no llegó
  // a cubrir para esta vigencia+audiencia — ver conversación: el lote se
  // genera una vez al día y puede quedarse corto para una combinación
  // concreta aunque el evento ya conste en el catálogo. Mismo criterio que
  // ya usa SiempreHubLayout para "destacados esta semana" (relleno desde
  // el catálogo real cuando el pool curado no basta), aplicado aquí a la
  // página completa en vez de a un widget de 4.
  relleno?: Evento[];
  obtenerEtiquetaRelleno?: (evento: Evento) => string | null;
  current: { vigencia: "hoy" | "finde"; extra?: Extra };
  breadcrumbExtra: BreadcrumbItem[];
  // Enlace a la variante sin filtro de audiencia de esta misma vigencia
  // (p. ej. desde "este finde en pareja" a "este finde" a secas) — un
  // filtro de audiencia estricto puede dejar pocos resultados, y este
  // botón al final de la página es la salida para quien quiera ver más.
  enlaceMasPlanes?: { href: string; texto: string };
}) {
  const base = `/${municipioSlug}`;
  const [primarios, secundarios, tNav, tPlanList] = await Promise.all([
    construirFiltrosTemporales(base, current.vigencia, current.extra),
    construirFiltrosSecundarios(base, current.vigencia, current.extra),
    getTranslations("Nav"),
    getTranslations("PlanList"),
  ]);
  const imagenHero = buscarImagenHero(municipio.slug);
  // El relleno (eventos reales que el lote curado del día no llegó a
  // cubrir, ver arriba) también cuenta para el resumen narrativo/FAQ — si
  // no, el texto podía decir "sin eventos puntuales" mientras la propia
  // lista de debajo mostraba una docena (ver conversación).
  const itemsResumen = [
    ...planes.map((p) => ({
      categoria: p.evento_categoria,
      fechaActualizacion: p.fecha_generacion,
      puntual: p.tipo === "excepcional",
    })),
    ...(relleno ?? []).map((e) => ({
      categoria: e.categoria,
      fechaActualizacion: e.ultima_deteccion,
      puntual: true,
    })),
  ];
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
        <FiltrosPagina primarios={primarios} secundarios={secundarios} />
        <IntroSeleccion
          items={itemsResumen}
          municipio={municipio.nombre}
          vigencia={current.vigencia}
          extra={current.extra}
        />
        {(planes.length > 0 || (relleno?.length ?? 0) > 0) && (
          <TituloLista municipio={municipio.nombre} vigencia={current.vigencia} extra={current.extra} />
        )}
        {planes.length > 0 && (
          <PlanList
            planes={planes}
            base={base}
            mostrarDiaFinde={current.vigencia === "finde"}
            contexto={current.vigencia}
            municipioNombre={municipio.nombre}
          />
        )}
        {relleno && relleno.length > 0 && (
          <div className={planes.length > 0 ? "mt-5" : undefined}>
            <ListaEventos
              eventos={relleno}
              base={base}
              contexto={current.vigencia}
              obtenerEtiqueta={obtenerEtiquetaRelleno}
              municipioNombre={municipio.nombre}
            />
          </div>
        )}
        {planes.length === 0 && (relleno?.length ?? 0) === 0 && (
          <p style={{ color: "var(--muted-foreground)" }}>{tPlanList("vacioGeneral")}</p>
        )}
        {enlaceMasPlanes ? (
          <p className="mt-8 text-center">
            <Link href={enlaceMasPlanes.href} className="btn-primary text-base px-6 py-3">
              {enlaceMasPlanes.texto} →
            </Link>
          </p>
        ) : (
          <p className="mt-8 text-center">
            <Link href={base} className="btn-secondary text-base px-6 py-3">
              {tPlanList("masPlanesTodoElAno", { municipio: municipio.nombre })} →
            </Link>
          </p>
        )}
        <FaqSeleccion preguntas={preguntas} />
      </div>
    </main>
  );
}
