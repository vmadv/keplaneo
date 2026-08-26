import { getTranslations } from "next-intl/server";
import TarjetaCiudad from "@/components/TarjetaCiudad";
import TarjetaPlanDestacado from "@/components/TarjetaPlanDestacado";
import { mesActualSlug } from "@/lib/dates";
import {
  getComunidadBySlug,
  getMunicipiosByComunidad,
  getPlanesDestacadosCategoria,
  getPlanesDestacadosDeMunicipio,
  getPlanesDestacadosSinMunicipio,
  getPlanesFamiliaMulti,
  getPlanesFindeMulti,
  getPlanesGratisMulti,
  getPlanesHoyMulti,
  getPlanesMesMulti,
  getPlanesParejaMulti,
} from "@/lib/queries";
import type { PlanConMunicipio } from "@/lib/queries";
import type { Categoria } from "@/lib/types";

export const revalidate = 3600;

const COLORES = ["var(--secondary)", "var(--tertiary)", "var(--quaternary)"];
const CATEGORIAS_HOME: Categoria[] = ["conciertos", "exposiciones", "teatro", "monologos"];

// MVP temporal centrado en la provincia de Sevilla (ver conversación): en
// vez de un simple selector de municipios, la portada enseña primero las
// ciudades disponibles y luego tira de agenda real por varios ángulos
// (hoy/finde/mes, destacados de Sevilla y de la provincia, audiencia,
// gratis, categoría) mezclando las 9 ciudades — más contenido real desde
// el primer scroll, sin "Keplaneo Sevilla" en el título.
export default async function HomePage() {
  const comunidad = await getComunidadBySlug("andalucia");
  const municipios = comunidad ? await getMunicipiosByComunidad(comunidad.id) : [];
  const municipiosLigero = municipios.map((m) => ({ id: m.id, slug: m.slug, nombre: m.nombre }));
  const sevilla = municipiosLigero.find((m) => m.slug === "sevilla") ?? null;
  const hayMunicipios = municipiosLigero.length > 0;

  const [
    planesHoy,
    planesFinde,
    planesMes,
    planesSevilla,
    planesProvincia,
    planesPareja,
    planesFamilia,
    planesGratis,
    planesPorCategoria,
    tHome,
    tBadges,
    tCategorias,
  ] = await Promise.all([
    hayMunicipios ? getPlanesHoyMulti(municipiosLigero) : Promise.resolve([]),
    hayMunicipios ? getPlanesFindeMulti(municipiosLigero) : Promise.resolve([]),
    hayMunicipios ? getPlanesMesMulti(municipiosLigero, mesActualSlug()) : Promise.resolve([]),
    sevilla ? getPlanesDestacadosDeMunicipio(sevilla) : Promise.resolve([]),
    sevilla && hayMunicipios ? getPlanesDestacadosSinMunicipio(municipiosLigero, sevilla.id) : Promise.resolve([]),
    hayMunicipios ? getPlanesParejaMulti(municipiosLigero) : Promise.resolve([]),
    hayMunicipios ? getPlanesFamiliaMulti(municipiosLigero) : Promise.resolve([]),
    hayMunicipios ? getPlanesGratisMulti(municipiosLigero) : Promise.resolve([]),
    hayMunicipios
      ? Promise.all(CATEGORIAS_HOME.map((c) => getPlanesDestacadosCategoria(municipiosLigero, c)))
      : Promise.resolve([]),
    getTranslations("Home"),
    getTranslations("Badges"),
    getTranslations("Categorias"),
  ]);

  const comunidadSlug = comunidad?.slug ?? "andalucia";

  const secciones: { titulo: string; planes: PlanConMunicipio[] }[] = [
    { titulo: tHome("tituloHoy"), planes: planesHoy },
    { titulo: tHome("tituloFinde"), planes: planesFinde },
    { titulo: tHome("tituloMes"), planes: planesMes },
    { titulo: tHome("tituloSevilla"), planes: planesSevilla },
    { titulo: tHome("tituloProvincia"), planes: planesProvincia },
    { titulo: tHome("tituloPareja"), planes: planesPareja },
    { titulo: tHome("tituloFamilia"), planes: planesFamilia },
    { titulo: tHome("tituloGratis"), planes: planesGratis },
    ...CATEGORIAS_HOME.map((c, i) => ({ titulo: tCategorias(c), planes: planesPorCategoria[i] ?? [] })),
  ];

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="relative mb-14">
          <div
            className="absolute -top-8 -left-6 w-40 h-40 rounded-full -z-10"
            style={{ background: "var(--tertiary)", opacity: 0.5 }}
            aria-hidden="true"
          />
          <h1 className="text-5xl font-extrabold mb-3 text-balance">{tHome("titulo")}</h1>
          <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
            {tHome("descripcion")}
          </p>
        </div>

        {municipios.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }}>{tHome("sinMunicipios")}</p>
        ) : (
          <div className="grid gap-14">
            <section>
              <h2 className="text-2xl font-extrabold mb-5">{tHome("tituloCiudades")}</h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {municipios.map((m, i) => (
                  <li key={m.id}>
                    <TarjetaCiudad
                      nombre={m.nombre}
                      slug={m.slug}
                      href={`/${comunidadSlug}/${m.slug}`}
                      color={COLORES[i % COLORES.length]}
                    />
                  </li>
                ))}
              </ul>
            </section>

            {secciones.map((seccion) => (
              <section key={seccion.titulo}>
                <h2 className="text-2xl font-extrabold mb-5">{seccion.titulo}</h2>
                {seccion.planes.length === 0 ? (
                  <p style={{ color: "var(--muted-foreground)" }}>{tHome("vacioSeccion")}</p>
                ) : (
                  <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {seccion.planes.map((plan) => (
                      <li key={plan.id}>
                        <TarjetaPlanDestacado
                          plan={plan}
                          comunidadSlug={comunidadSlug}
                          etiquetaEventoPuntual={tBadges("eventoPuntual")}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
