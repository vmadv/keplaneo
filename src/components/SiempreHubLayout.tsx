import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import ListaEventos from "./ListaEventos";
import ExpandibleSeccion from "./ExpandibleSeccion";
import TarjetaPlanDestacado from "./TarjetaPlanDestacado";
import HeroPortada from "./HeroPortada";
import { getEventosActivos, getEventosGratisActivos, getPlanesDestacadosDeMunicipio } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios, hrefFiltro, type Extra } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";
import { proximosMesesSlugs } from "@/lib/dates";
import { ordenarPorRelevanciaConDiversidad } from "@/lib/ordenEventos";
import { piezasTemporales } from "@/lib/resumenSeleccion";
import type { MunicipioConComunidad } from "@/lib/queries";

const MAX_GENERICOS_VISIBLES = 15;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const CLAVE_DESTACADOS: Record<Extra, "tituloDestacadosPareja" | "tituloDestacadosFamilia" | "tituloDestacadosGratis"> = {
  pareja: "tituloDestacadosPareja",
  familia: "tituloDestacadosFamilia",
  gratis: "tituloDestacadosGratis",
};

const CLAVE_TODO: Record<Extra, "tituloTodoPareja" | "tituloTodoFamilia" | "tituloTodoGratis"> = {
  pareja: "tituloTodoPareja",
  familia: "tituloTodoFamilia",
  gratis: "tituloTodoGratis",
};

// El hub del municipio ("siempre") y sus tres variantes filtradas
// (/en-pareja, /con-ninos, /gratis) comparten la misma estructura en dos
// bloques: lo más destacado de esta semana (puntual, con "ver más" a la
// página de esta semana) y todo lo genérico/evergreen del resto del año
// (con diversidad de categoría + relevancia, tope de 15 y desplegar el
// resto) — ver conversación. Solo cambia qué filtro (extra) se aplica a
// ambos bloques.
export default async function SiempreHubLayout({
  municipio,
  municipioSlug,
  titulo,
  extra,
  breadcrumbExtra,
  children,
}: {
  municipio: MunicipioConComunidad;
  municipioSlug: string;
  titulo: string;
  extra?: Extra;
  breadcrumbExtra: BreadcrumbItem[];
  // Contenido propio de una variante concreta (ej. el mapa + municipios
  // cercanos que solo lleva el hub general, no las páginas filtradas) —
  // se pinta al final, dentro del mismo contenedor.
  children?: React.ReactNode;
}) {
  const base = `/${municipioSlug}`;
  const imagenHero = buscarImagenHero(municipio.slug);

  const [primariosSiempre, secundarios, tNav, tHome, tBadges, tPlanList, tFiltros, tMeses, destacados, eventos] =
    await Promise.all([
      construirFiltrosTemporales(base, "siempre", extra),
      construirFiltrosSecundarios(base, "siempre", extra),
      getTranslations("Nav"),
      getTranslations("MunicipioHome"),
      getTranslations("Badges"),
      getTranslations("PlanList"),
      getTranslations("Filtros"),
      getTranslations("Meses"),
      getPlanesDestacadosDeMunicipio(
        municipio,
        4,
        extra === "gratis" ? { soloGratis: true } : extra ? { audiencia: extra } : undefined
      ),
      extra === "gratis"
        ? getEventosGratisActivos(municipio.id)
        : getEventosActivos(municipio.id, extra === "pareja" || extra === "familia" ? extra : undefined),
    ]);

  // Ninguna pastilla de "Cuándo" queda marcada activa por defecto — "siempre"
  // es la franja atemporal que vive aquí técnicamente, pero mostrarla
  // marcada sugiere que hay que pulsarla para que aplique (ver conversación).
  const primarios = primariosSiempre.map((item) => (item.href === hrefFiltro(base, "siempre", extra) ? { ...item, activo: false } : item));

  const genericos = ordenarPorRelevanciaConDiversidad(eventos.filter((e) => e.fecha_inicio === null));
  const genericosVisibles = genericos.slice(0, MAX_GENERICOS_VISIBLES);
  const genericosResto = genericos.slice(MAX_GENERICOS_VISIBLES);

  const tituloDestacados = extra ? tHome(CLAVE_DESTACADOS[extra], { municipio: municipio.nombre }) : tHome("tituloDestacados", { municipio: municipio.nombre });
  const tituloTodo = extra ? tHome(CLAVE_TODO[extra], { municipio: municipio.nombre }) : tHome("tituloTodo", { municipio: municipio.nombre });
  const { calificador } = await piezasTemporales("siempre", extra);

  const mesesProximos = proximosMesesSlugs(2);
  const pastillasRapidas = [
    { label: tFiltros("hoy"), href: hrefFiltro(base, "hoy", extra) },
    { label: tFiltros("finde"), href: hrefFiltro(base, "finde", extra) },
    { label: tFiltros("semana"), href: hrefFiltro(base, "semana", extra) },
    ...mesesProximos.map((mes) => ({ label: capitalizar(tMeses(mes)), href: `${base}/${mes}` })),
  ];

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            // Sin más migas detrás (el hub general), esta es la página
            // actual y no debe ir enlazada; con más migas (las variantes
            // /en-pareja, /con-ninos, /gratis) sí es un tramo intermedio.
            breadcrumbExtra.length > 0 ? { label: municipio.nombre, href: base } : { label: municipio.nombre },
            ...breadcrumbExtra,
          ]}
        />
        <HeroPortada imagenHero={imagenHero} alt={municipio.nombre} titulo={titulo} />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        {destacados.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-extrabold mb-3">{tituloDestacados}</h2>
            <ul className="grid sm:grid-cols-2 gap-5">
              {destacados.map((plan) => (
                <li key={plan.id}>
                  <TarjetaPlanDestacado plan={plan} etiquetaEventoPuntual={tBadges("eventoPuntual")} mostrarMunicipio={false} />
                </li>
              ))}
            </ul>
            <p className="mt-4">
              <Link href={hrefFiltro(base, "semana", extra)} className="btn-secondary text-sm">
                {tHome("verMasEstaSemana", { municipio: municipio.nombre, calificador })} →
              </Link>
            </p>
          </section>
        )}

        <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
          <h2 className="text-lg font-extrabold mb-3">{tituloTodo}</h2>
          <ListaEventos eventos={genericosVisibles} base={base} contexto="siempre" mensajeVacio={tPlanList("vacioSiempre")} municipioNombre={municipio.nombre} />
          {genericosResto.length > 0 && (
            <ExpandibleSeccion textoVerMas={tHome("verMasPlanes")} textoVerMenos={tHome("verMenosPlanes")}>
              <div className="mt-5">
                <ListaEventos eventos={genericosResto} base={base} contexto="siempre" municipioNombre={municipio.nombre} />
              </div>
            </ExpandibleSeccion>
          )}
          <div className="flex flex-wrap gap-2 mt-6">
            {pastillasRapidas.map((p) => (
              <Link key={p.href} href={p.href} className="btn-secondary text-sm px-4 py-2">
                {p.label}
              </Link>
            ))}
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}
