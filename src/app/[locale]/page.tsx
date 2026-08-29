import { Heart, Users, Gift, MapPin, CalendarDays, Sun, Music } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ListaCiudadesHome from "@/components/ListaCiudadesHome";
import TituloHeroAnimado from "@/components/TituloHeroAnimado";
import TarjetaEnlaceFiltro from "@/components/TarjetaEnlaceFiltro";
import TarjetaPlanDestacado from "@/components/TarjetaPlanDestacado";
import { ICONO_CATEGORIA } from "@/lib/filtros";
import { buscarImagenHero } from "@/lib/heroImage";
import { getComunidadBySlug, getMunicipiosByComunidad, getPlanesDestacadosDeMunicipio, getPlanesDestacadosSinMunicipio } from "@/lib/queries";
import { CATEGORIAS_CON_PAGINA } from "@/lib/types";

export const revalidate = 3600;

// MVP temporal centrado en la provincia de Sevilla (ver conversación): la
// portada enseña primero las ciudades disponibles, luego atajos a los
// filtros que necesitan elegir ciudad (En pareja/Con niños/Gratis y
// categorías — no sabemos a qué municipio mandar directamente, así que
// pasan por /elige-ciudad), y solo dos bloques con planes reales ya
// resueltos (Sevilla y el resto de la provincia, lo mejor de hoy/esta
// semana) porque esos sí tienen una respuesta clara sin preguntar ciudad.
export default async function HomePage() {
  const comunidad = await getComunidadBySlug("andalucia");
  const municipios = comunidad ? await getMunicipiosByComunidad(comunidad.id) : [];
  const municipiosLigero = municipios.map((m) => ({ id: m.id, slug: m.slug, nombre: m.nombre }));
  const sevilla = municipiosLigero.find((m) => m.slug === "sevilla") ?? null;

  const [planesSevilla, planesProvincia, tHome, tBadges, tAudiencia, tCategorias] = await Promise.all([
    sevilla ? getPlanesDestacadosDeMunicipio(sevilla) : Promise.resolve([]),
    sevilla ? getPlanesDestacadosSinMunicipio(municipiosLigero, sevilla.id) : Promise.resolve([]),
    getTranslations("Home"),
    getTranslations("Badges"),
    getTranslations("Audiencia"),
    getTranslations("Categorias"),
  ]);

  const filtrosAudiencia = [
    { filtro: "pareja", titulo: tAudiencia("pareja"), Icono: Heart, color: "var(--secondary)" },
    { filtro: "con-ninos", titulo: tAudiencia("familia"), Icono: Users, color: "var(--quaternary)" },
    { filtro: "gratis", titulo: tHome("tituloGratis"), Icono: Gift, color: "var(--tertiary)" },
  ];

  const bloquesContenido: { titulo: string; planes: typeof planesSevilla; href?: string }[] = [
    { titulo: tHome("tituloSevilla"), planes: planesSevilla, href: sevilla ? `/${sevilla.slug}` : undefined },
    { titulo: tHome("tituloProvincia"), planes: planesProvincia },
  ];

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-14">
          <TituloHeroAnimado
            estatico={tHome("titulo")}
            rotativos={[
              { texto: tHome("rotativoEnSevilla"), icono: <MapPin size={34} strokeWidth={2.5} />, fondo: "var(--secondary)", colorTexto: "var(--secondary-foreground)" },
              { texto: tHome("rotativoEsteFinde"), icono: <CalendarDays size={34} strokeWidth={2.5} />, fondo: "var(--tertiary)", colorTexto: "var(--tertiary-foreground)" },
              { texto: tHome("rotativoHoy"), icono: <Sun size={34} strokeWidth={2.5} />, fondo: "var(--quaternary)", colorTexto: "var(--quaternary-foreground)" },
              { texto: tHome("rotativoConciertos"), icono: <Music size={34} strokeWidth={2.5} />, fondo: "var(--accent)", colorTexto: "var(--accent-foreground)" },
            ]}
          />
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
              <ListaCiudadesHome
                municipios={municipios.map((m) => ({ ...m, imagen: buscarImagenHero(m.slug) }))}
                textoVerMas={tHome("verMasCiudades")}
                textoVerMenos={tHome("verMenosCiudades")}
              />
            </section>

            <section>
              <h2 className="text-2xl font-extrabold mb-5">{tHome("tituloFiltros")}</h2>
              <ul className="grid sm:grid-cols-3 gap-5">
                {filtrosAudiencia.map((f) => (
                  <li key={f.filtro}>
                    <TarjetaEnlaceFiltro href={`/elige-ciudad/${f.filtro}`} titulo={f.titulo} Icono={f.Icono} color={f.color} />
                  </li>
                ))}
              </ul>
            </section>

            {bloquesContenido.map((seccion) => (
              <section key={seccion.titulo}>
                <h2 className="text-2xl font-extrabold mb-5">{seccion.titulo}</h2>
                {seccion.planes.length === 0 ? (
                  <p style={{ color: "var(--muted-foreground)" }}>{tHome("vacioSeccion")}</p>
                ) : (
                  <>
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {seccion.planes.map((plan) => (
                        <li key={plan.id}>
                          <TarjetaPlanDestacado plan={plan} etiquetaEventoPuntual={tBadges("eventoPuntual")} />
                        </li>
                      ))}
                    </ul>
                    {seccion.href && (
                      <p className="mt-4">
                        <Link href={seccion.href} className="btn-secondary text-sm">
                          {tHome("verMasSevilla")} →
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-extrabold mb-5">{tHome("tituloCategorias")}</h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {CATEGORIAS_CON_PAGINA.map((c) => (
                  <li key={c}>
                    <TarjetaEnlaceFiltro
                      href={`/elige-ciudad/${c}`}
                      titulo={tCategorias(c)}
                      Icono={ICONO_CATEGORIA[c]!}
                      color="var(--accent)"
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
