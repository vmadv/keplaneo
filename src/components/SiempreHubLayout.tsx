import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb";
import FiltrosPagina from "./FiltrosPagina";
import ListaEventos from "./ListaEventos";
import ExpandibleSeccion from "./ExpandibleSeccion";
import TarjetaPlanDestacado from "./TarjetaPlanDestacado";
import HeroPortada from "./HeroPortada";
import { IntroSeleccion, FaqSeleccion } from "./ResumenSeleccion";
import { getEventosActivos, getEventosGratisActivos, getPlanesDestacadosDeMunicipio } from "@/lib/queries";
import { construirFiltrosTemporales, construirFiltrosSecundarios, hrefFiltro, type Extra } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";
import { proximosMesesSlugs, mesSlugParaLocale } from "@/lib/dates";
import { ordenarPorRelevanciaConDiversidad } from "@/lib/ordenEventos";
import { ordenarPorDiaDeSemana } from "@/lib/semana";
import { piezasTemporales, construirFaqSeleccion } from "@/lib/resumenSeleccion";
import { construirFaqJsonLd } from "@/lib/structuredData";
import type { MunicipioConComunidad } from "@/lib/queries";

// Ver conversación: se muestran 20-25 de entrada, con "ver más" para
// desplegar el resto sin límite — ni un tope tan bajo que se sienta vacío
// en municipios con catálogo amplio, ni tan alto que abrume de entrada.
const MAX_GENERICOS_VISIBLES = 20;

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

  const [primariosSiempre, secundarios, tNav, tHome, tBadges, tPlanList, tFiltros, tMeses, locale, destacados, eventos] =
    await Promise.all([
      construirFiltrosTemporales(base, "siempre", extra),
      construirFiltrosSecundarios(base, "siempre", extra),
      getTranslations("Nav"),
      getTranslations("MunicipioHome"),
      getTranslations("Badges"),
      getTranslations("PlanList"),
      getTranslations("Filtros"),
      getTranslations("Meses"),
      getLocale(),
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
  // Se planteó distinguir "llegar por defecto" de "pinchar la pastilla
  // Siempre a propósito", pero ambos casos llevan a la misma URL exacta
  // (/sevilla) sin ningún dato que los diferencie — haría falta un query
  // param dedicado (y complicar el canonical para ignorarlo), así que se
  // descarta por ahora (ver conversación).
  const primarios = primariosSiempre.map((item) => (item.href === hrefFiltro(locale, base, "siempre", extra) ? { ...item, activo: false } : item));

  const genericos = ordenarPorRelevanciaConDiversidad(eventos.filter((e) => e.fecha_inicio === null));
  const genericosVisibles = genericos.slice(0, MAX_GENERICOS_VISIBLES);
  const genericosResto = genericos.slice(MAX_GENERICOS_VISIBLES);

  // El pool curado (planes "excepcional" de esta audiencia) no siempre
  // llega a 4 — se completa con el catálogo general de eventos de esta
  // misma semana, mismo criterio que ya usan Conciertos/Exposiciones/
  // Teatro (ordenarPorDiaDeSemana). `eventoIdsDestacados` evita mostrar dos
  // veces el mismo evento real si ya salió como destacado curado (ver
  // conversación: "Dinosaurios de la Patagonia" apareció duplicado en
  // esta-semana por dos fichas de evento distintas para lo mismo — aquí
  // solo se evita el duplicado propio de este bloque, vía evento_id).
  const eventoIdsDestacados = new Set(destacados.map((plan) => plan.evento_id).filter((id): id is string => id !== null));
  const { eventos: eventosSemana, etiquetas: etiquetasSemana } = ordenarPorDiaDeSemana(eventos, locale);
  const rellenoDestacados = eventosSemana
    .filter((e) => !eventoIdsDestacados.has(e.id))
    .slice(0, Math.max(0, 4 - destacados.length));

  // Mismo resumen narrativo + FAQ que ya llevan hoy/finde/esta semana (ver
  // ResumenSeleccion/resumenSeleccion.ts) — el sistema ya soporta la
  // vigencia "siempre" (aperturaSiempre existe desde el principio), solo
  // faltaba conectarlo aquí: sin esto, el hub del municipio (la página con
  // más autoridad de cada uno) no tenía ni un párrafo de texto único ni
  // FAQ propias, solo tarjetas — un hueco real de cara a SEO.
  const itemsResumen = eventos.map((e) => ({
    categoria: e.categoria,
    fechaActualizacion: e.ultima_deteccion,
    puntual: e.fecha_inicio !== null,
  }));
  const preguntas = await construirFaqSeleccion(itemsResumen, municipio.nombre, "siempre", extra);
  const jsonLdFaq = construirFaqJsonLd(preguntas);

  const tituloDestacados = extra ? tHome(CLAVE_DESTACADOS[extra], { municipio: municipio.nombre }) : tHome("tituloDestacados", { municipio: municipio.nombre });
  const tituloTodo = extra ? tHome(CLAVE_TODO[extra], { municipio: municipio.nombre }) : tHome("tituloTodo", { municipio: municipio.nombre });
  const { calificador } = await piezasTemporales("siempre", extra);

  const mesesProximos = proximosMesesSlugs(2);
  const pastillasRapidas = [
    { label: tFiltros("hoy"), href: hrefFiltro(locale, base, "hoy", extra) },
    { label: tFiltros("finde"), href: hrefFiltro(locale, base, "finde", extra) },
    { label: tFiltros("semana"), href: hrefFiltro(locale, base, "semana", extra) },
    ...mesesProximos.map((mes) => ({ label: capitalizar(tMeses(mes)), href: `${base}/${mesSlugParaLocale(mes, locale)}` })),
  ];

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
            // Sin más migas detrás (el hub general), esta es la página
            // actual y no debe ir enlazada; con más migas (las variantes
            // /en-pareja, /con-ninos, /gratis) sí es un tramo intermedio.
            breadcrumbExtra.length > 0 ? { label: municipio.nombre, href: base } : { label: municipio.nombre },
            ...breadcrumbExtra,
          ]}
        />
        <HeroPortada imagenHero={imagenHero} alt={municipio.nombre} titulo={titulo} />

        <FiltrosPagina primarios={primarios} secundarios={secundarios} />

        <IntroSeleccion items={itemsResumen} municipio={municipio.nombre} vigencia="siempre" extra={extra} />

        {(destacados.length > 0 || rellenoDestacados.length > 0) && (
          <section className="mb-10">
            <h2 className="text-lg font-extrabold mb-3">{tituloDestacados}</h2>
            {destacados.length > 0 && (
              <ul className="grid sm:grid-cols-2 gap-5">
                {destacados.map((plan) => (
                  <li key={plan.id}>
                    <TarjetaPlanDestacado plan={plan} etiquetaEventoPuntual={tBadges("eventoPuntual")} mostrarMunicipio={false} />
                  </li>
                ))}
              </ul>
            )}
            {rellenoDestacados.length > 0 && (
              <div className={destacados.length > 0 ? "mt-5" : undefined}>
                <ListaEventos
                  eventos={rellenoDestacados}
                  base={base}
                  contexto="semana"
                  obtenerEtiqueta={(evento) => etiquetasSemana.get(evento.id) ?? null}
                  municipioNombre={municipio.nombre}
                />
              </div>
            )}
            <p className="mt-4">
              <Link href={hrefFiltro(locale, base, "semana", extra)} className="btn-secondary text-sm">
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

        <FaqSeleccion preguntas={preguntas} />

        {children}
      </div>
    </main>
  );
}
