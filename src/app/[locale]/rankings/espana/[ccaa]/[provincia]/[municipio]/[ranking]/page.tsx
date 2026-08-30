import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Star, MapPin, Trophy } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import TextoConNegritas from "@/components/TextoConNegritas";
import { getListado, getMunicipioConProvincia } from "@/lib/queries";
import { urlDeFoto, RATING_MINIMO, RESENAS_MINIMAS, tieneRatingFiable } from "@/lib/places";
import { alternatesIdiomas, SITE_URL } from "@/lib/rutasLocale";
import { construirItemListJsonLd, construirFaqJsonLd } from "@/lib/structuredData";
import type { PuestoListado } from "@/lib/types";

// Estructura inspirada en rankings tipo premio (numerado, top-3 destacado,
// nota + nº de reseñas visibles, metodología transparente) pero con
// nuestro propio sistema visual "Playful Geometric" — ver conversación:
// esto es aparte de /planes, no una página de plan más. Vive en su propia
// rama de nivel superior (/rankings/...) para que la miga de pan nunca
// tenga que "escaparse" hacia el hub de Planes de este municipio.
export const revalidate = 86400;

async function cargar(ccaaSlug: string, provinciaSlug: string, municipioSlug: string, rankingSlug: string) {
  const municipio = await getMunicipioConProvincia(municipioSlug);
  if (!municipio) return null;
  if (municipio.comunidad.slug !== ccaaSlug || municipio.provinciaGeo?.slug !== provinciaSlug) return null;
  const resultado = await getListado(municipio.id, rankingSlug);
  if (!resultado) return null;
  return { municipio, ...resultado };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ccaa: string; provincia: string; municipio: string; ranking: string }>;
}): Promise<Metadata> {
  const { ccaa, provincia, municipio, ranking } = await params;
  const datos = await cargar(ccaa, provincia, municipio, ranking);
  if (!datos) return {};
  const { listado, puestos } = datos;

  // Si aún no tiene intro propia (rankings generados antes de escribirla),
  // se compone algo mejor que repetir el título — al menos los primeros
  // nombres reales, para no dejar un meta description vacío de contenido.
  const primerParrafo = listado.descripcion?.split("\n\n")[0].replace(/\*\*/g, "");
  const description =
    primerParrafo ??
    `${listado.titulo}: ${puestos
      .slice(0, 3)
      .map((p) => p.lugar.nombre)
      .join(", ")} y más, verificados con datos de Google Maps.`;

  return {
    title: `${listado.titulo} | Keplaneo`,
    description,
    alternates: {
      languages: alternatesIdiomas(`/rankings/espana/${ccaa}/${provincia}/${municipio}/${ranking}`),
    },
  };
}

function FotoPuesto({ puesto }: { puesto: PuestoListado }) {
  const foto = puesto.lugar.fotos[0];
  if (!foto) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--muted)" }}>
        <MapPin size={28} strokeWidth={2} style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }
  return (
    <Image
      src={urlDeFoto(foto, 640)}
      alt={puesto.lugar.nombre}
      fill
      unoptimized
      sizes="(max-width: 768px) 100vw, 400px"
      className="object-cover"
    />
  );
}

function Nota({ rating, numResenas, t }: { rating: number | null; numResenas: number | null; t: Awaited<ReturnType<typeof getTranslations>> }) {
  if (rating === null) return <span style={{ color: "var(--muted-foreground)" }}>{t("sinResenasSuficientes")}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-bold">
      <Star size={15} strokeWidth={0} fill="var(--tertiary)" />
      {rating.toFixed(1)}
      <span className="font-medium" style={{ color: "var(--muted-foreground)" }}>
        · {t("resenas", { n: numResenas ?? 0 })}
      </span>
    </span>
  );
}

export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string; ccaa: string; provincia: string; municipio: string; ranking: string }>;
}) {
  const {
    locale,
    ccaa: ccaaSlug,
    provincia: provinciaSlug,
    municipio: municipioSlug,
    ranking: rankingSlug,
  } = await params;
  const datos = await cargar(ccaaSlug, provinciaSlug, municipioSlug, rankingSlug);
  if (!datos) notFound();
  const { municipio, listado, puestos } = datos;

  const [tNav, t] = await Promise.all([getTranslations("Nav"), getTranslations("Listados")]);
  const base = `/rankings/espana/${ccaaSlug}/${provinciaSlug}/${municipioSlug}`;
  const podio = puestos.slice(0, 3);
  const resto = puestos.slice(3);
  const prefijo = locale === "es" ? "" : `/${locale}`;
  const urlBase = `${SITE_URL}${prefijo}${base}`;
  const jsonLdItemList = construirItemListJsonLd(listado, puestos, urlBase);
  const jsonLdFaq = construirFaqJsonLd(listado.preguntas_frecuentes);

  return (
    <main className="flex-1 bg-dots">
      {jsonLdItemList && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }} />
      )}
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            {
              label: municipio.provinciaGeo?.nombre ?? municipio.comunidad.nombre,
              href: `/rankings/espana/${ccaaSlug}/${provinciaSlug}`,
            },
            { label: municipio.nombre, href: base },
            { label: t("breadcrumb") },
          ]}
        />

        <h1 className="text-4xl font-extrabold mt-4 mb-8 text-balance">{listado.titulo}</h1>

        {listado.descripcion && (
          <div className="grid gap-3 mb-10">
            {listado.descripcion.split("\n\n").filter(Boolean).map((parrafo, i) => (
              <p key={i} className="text-lg text-balance">
                <TextoConNegritas texto={parrafo} />
              </p>
            ))}
          </div>
        )}

        {podio.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-3 mb-10">
            {podio.map((puesto) => (
              <Link
                key={puesto.lugar.id}
                href={`${base}/lugares/${puesto.lugar.slug}`}
                className="card-sticker overflow-hidden flex flex-col"
              >
                <div className="relative h-36 w-full">
                  <FotoPuesto puesto={puesto} />
                  <span
                    className="badge-pill absolute top-2 left-2"
                    style={{ background: "var(--tertiary)", borderColor: "var(--foreground)" }}
                  >
                    <Trophy size={11} strokeWidth={2.5} className="mr-1" />
                    {t("puesto", { posicion: puesto.posicion })}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1">
                  <h2 className="font-extrabold leading-tight">{puesto.lugar.nombre}</h2>
                  <Nota rating={puesto.lugar.rating} numResenas={puesto.lugar.num_valoraciones} t={t} />
                  {puesto.motivo && (
                    <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                      <TextoConNegritas texto={puesto.motivo} />
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {resto.length > 0 && (
          <ol className="grid gap-3 mb-10">
            {resto.map((puesto) => (
              <li key={puesto.lugar.id} className="min-w-0">
                <Link href={`${base}/lugares/${puesto.lugar.slug}`} className="card-sticker flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="icon-chip w-9 h-9 shrink-0 font-extrabold"
                      style={{ background: "var(--muted)" }}
                    >
                      {puesto.posicion}
                    </span>
                    <h3 className="flex-1 min-w-0 font-bold leading-tight text-balance">{puesto.lugar.nombre}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm -mt-1 pl-12">
                    {puesto.lugar.direccion && (
                      <span className="min-w-0 truncate" style={{ color: "var(--muted-foreground)" }}>
                        {puesto.lugar.direccion}
                      </span>
                    )}
                    <Nota rating={puesto.lugar.rating} numResenas={puesto.lugar.num_valoraciones} t={t} />
                  </div>
                  {puesto.motivo && (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      <TextoConNegritas texto={puesto.motivo} />
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="card-sticker p-5 mb-10" style={{ background: "var(--muted)" }}>
          <h2 className="font-extrabold mb-2">{t("metodologiaTitulo")}</h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {tieneRatingFiable(listado.tipo_lugar)
              ? t("metodologiaTexto", { ratingMinimo: RATING_MINIMO.toFixed(1), resenasMinimas: RESENAS_MINIMAS })
              : t("metodologiaTextoSinRating")}
          </p>
        </div>

        {listado.preguntas_frecuentes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-extrabold mb-3">{t("preguntasFrecuentes")}</h2>
            <div className="grid gap-3">
              {listado.preguntas_frecuentes.map((pf) => (
                <div key={pf.pregunta} className="card-sticker p-4">
                  <p className="font-bold">
                    <TextoConNegritas texto={pf.pregunta} />
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                    <TextoConNegritas texto={pf.respuesta} />
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <MunicipioPageNav municipioSlug={municipioSlug} municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
