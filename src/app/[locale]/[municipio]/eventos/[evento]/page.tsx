import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Sun, Moon, MapPin, Clock, Tag, CalendarRange, Link2, ArrowRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import TextoConNegritas from "@/components/TextoConNegritas";
import MapaEvento from "@/components/MapaEvento";
import TiempoDelDia from "@/components/TiempoDelDia";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import HeaderImagenEvento from "@/components/HeaderImagenEvento";
import {
  getEvento,
  getMunicipio,
  getPlanesDelMes,
  getPlanesFinde,
  getPlanesHoy,
  getVigenciaActualDeEvento,
} from "@/lib/queries";
import {
  esMesSlugValido,
  hoyISO,
  fechaFindeParaTiempo,
  fechasFinDeSemanaISO,
  extraerHoraDeHorario,
} from "@/lib/dates";
import type { SolicitudTiempo } from "@/lib/weather";
import type { Audiencia, Evento, Plan } from "@/lib/types";
import { construirEventoJsonLd, construirFaqJsonLd, textoPlano } from "@/lib/structuredData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Meta description/OG: nunca la descripción completa (varios párrafos, con
// "**negritas**" de markdown sin procesar) — un extracto corto y limpio,
// pensado para el snippet de búsqueda/redes, no para el cuerpo de la
// página. Ver conversación: usar la descripción entera tal cual era un bug
// real, no una mejora opcional.
function extractoMeta(descripcion: string, limite = 155): string {
  const primerParrafo = textoPlano(descripcion.split("\n\n")[0] ?? "").trim();
  if (primerParrafo.length <= limite) return primerParrafo;
  return `${primerParrafo.slice(0, limite - 1).trimEnd()}…`;
}

// Los eventos pueden pasar de activo a finalizado entre generaciones
// diarias; se revalida más a menudo que las páginas de listado.
export const revalidate = 3600;

function esUrl(texto: string): boolean {
  return /^https?:\/\//i.test(texto);
}

async function cargarEvento(municipioSlug: string, eventoSlug: string) {
  const municipio = await getMunicipio(municipioSlug);
  if (!municipio) return null;
  const evento = await getEvento(municipio.id, eventoSlug);
  if (!evento) return null;
  return { municipio, evento };
}

// El evento no guarda su propia vigencia (esa vive en la fila de `planes`
// de hoy que apunta a él) y puede tener varias a la vez (ej. hoy es sábado:
// un evento puede ser de hoy Y de finde al mismo tiempo). Sin más
// información, "hoy" gana por defecto — pero si el visitante llegó desde
// una página con vigencia concreta (?desde=finde, ?desde=agosto...) esa es
// la que manda, para que la ficha no le lleve la contraria a lo que estaba
// mirando ("si estoy en la página de este fin de semana, debe decir this
// fin de semana", no "hoy" solo porque hoy también aplique).
function elegirContexto(vigencia: string[], desde: string | undefined): string {
  if (desde && vigencia.includes(desde)) return desde;
  if (vigencia.includes("hoy")) return "hoy";
  if (vigencia.includes("finde")) return "finde";
  return vigencia.find(esMesSlugValido) ?? "hoy";
}

// Se usa para que "otros planes" muestre lo más relevante según el
// contexto elegido: si es hoy, otros de hoy; si es finde, otros del finde;
// si es un mes, otros de ese mes.
async function cargarOtrosPlanes(municipioId: string, eventoId: string, contexto: string): Promise<Plan[]> {
  let planes: Plan[];
  if (contexto === "finde") {
    planes = await getPlanesFinde(municipioId);
  } else if (esMesSlugValido(contexto)) {
    planes = await getPlanesDelMes(municipioId, contexto);
  } else {
    planes = await getPlanesHoy(municipioId);
  }
  return planes.filter((p) => p.evento_id !== eventoId);
}

function etiquetaOtrosPlanes(
  contexto: string,
  tEvento: Awaited<ReturnType<typeof getTranslations>>,
  tMeses: Awaited<ReturnType<typeof getTranslations>>
): string {
  if (contexto === "finde") return tEvento("cuandoFinde");
  if (esMesSlugValido(contexto)) return tEvento("cuandoMes", { mes: tMeses(contexto) });
  return tEvento("cuandoHoy");
}

// El widget del tiempo debe reflejar cuándo va a pasar el plan, no el
// instante en que se carga la página: en contexto "hoy" el pronóstico de
// hoy; en "finde" el del sábado o domingo que le corresponda. Si
// evento.horario da una hora concreta (ej. "22:00h") se usa esa; si no (ej.
// "Horario habitual del museo"), se pide mínima/máxima del tramo
// aproximado del plan (día u noche) en vez de inventar una hora.
function datosTiempoParaEvento(
  contexto: string,
  evento: Evento,
  tTiempo: Awaited<ReturnType<typeof getTranslations>>
): { fecha: string; solicitud: SolicitudTiempo; titulo: string } {
  const horaExacta = extraerHoraDeHorario(evento.horario);
  const solicitud: SolicitudTiempo =
    horaExacta !== null
      ? { tipo: "hora", hora: horaExacta }
      : evento.momento === "noche"
        ? { tipo: "rango", horaInicio: 19, horaFin: 23 }
        : { tipo: "rango", horaInicio: 9, horaFin: 20 };
  const sufijoHora = horaExacta !== null ? tTiempo("sufijoHora", { hora: `${String(horaExacta).padStart(2, "0")}:00` }) : "";

  if (contexto === "finde") {
    const fecha = fechaFindeParaTiempo(evento.fecha_inicio, evento.fecha_fin);
    const { sabado } = fechasFinDeSemanaISO();
    const dia = fecha === sabado ? tTiempo("diaSabado") : tTiempo("diaDomingo");
    return { fecha, solicitud, titulo: tTiempo("tituloFinde", { dia, sufijoHora }) };
  }

  return { fecha: hoyISO(), solicitud, titulo: tTiempo("tituloHoy", { sufijoHora }) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; municipio: string; evento: string }>;
}): Promise<Metadata> {
  const { locale, municipio, evento: eventoSlug } = await params;
  const encontrado = await cargarEvento(municipio, eventoSlug);
  if (!encontrado) return {};

  const titulo = `${encontrado.evento.titulo} — ${encontrado.municipio.nombre}`;
  const descripcion = extractoMeta(encontrado.evento.descripcion);
  // Sin el parámetro ?desde= — cambia qué "otros planes" se muestran al
  // final, pero es la misma ficha; sin canonical, Google podía indexar
  // /eventos/x, /eventos/x?desde=hoy y /eventos/x?desde=finde como páginas
  // casi duplicadas en vez de una sola (ver conversación).
  const prefijo = locale === "es" ? "" : `/${locale}`;
  const canonical = `${SITE_URL}${prefijo}/${municipio}/eventos/${eventoSlug}`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical },
    openGraph: {
      title: titulo,
      description: descripcion,
      url: canonical,
      siteName: "Keplaneo",
      locale,
      type: "article",
    },
    // Un evento ya finalizado se mantiene accesible (no rompemos la URL),
    // pero no debe competir en el índice con contenido vigente.
    robots: encontrado.evento.activo ? undefined : { index: false, follow: true },
  };
}

export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ municipio: string; evento: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { municipio: municipioSlug, evento: eventoSlug } = await params;
  const { desde } = await searchParams;
  const encontrado = await cargarEvento(municipioSlug, eventoSlug);
  if (!encontrado) notFound();
  const { municipio, evento } = encontrado;

  const base = `/${municipioSlug}`;
  const [vigencia, tNav, tBadges, tAudiencia, tEvento, tTiempo, tMeses] = await Promise.all([
    getVigenciaActualDeEvento(evento.id),
    getTranslations("Nav"),
    getTranslations("Badges"),
    getTranslations("Audiencia"),
    getTranslations("Evento"),
    getTranslations("Tiempo"),
    getTranslations("Meses"),
  ]);
  const contexto = elegirContexto(vigencia, desde);
  const otrosPlanes = await cargarOtrosPlanes(municipio.id, evento.id, contexto);
  const etiquetaOtros = etiquetaOtrosPlanes(contexto, tEvento, tMeses);
  const tiempo = datosTiempoParaEvento(contexto, evento, tTiempo);

  const esNoche = evento.momento === "noche";
  const jsonLdEvento = construirEventoJsonLd(evento, municipio, municipioSlug);
  const jsonLdFaq = construirFaqJsonLd(evento.preguntas_frecuentes);

  return (
    <main className="flex-1 bg-dots">
      {jsonLdEvento && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdEvento) }} />
      )}
      {jsonLdFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      )}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <HeaderImagenEvento
          cartelUrl={evento.cartel_url}
          fotoLugarNombre={evento.foto_lugar_nombre}
          ubicacion={evento.ubicacion}
          titulo={evento.titulo}
          textoFotoUbicacion={evento.ubicacion ? tEvento("fotoDeLaUbicacion", { lugar: evento.ubicacion }) : ""}
        />
        <Breadcrumb
          items={[
            { label: tNav("inicio"), href: "/" },
            { label: municipio.comunidad.nombre },
            { label: municipio.nombre, href: base },
            { label: evento.titulo },
          ]}
        />

        {/* Franja de cabecera: sustituye a la foto que no tenemos — icono de
            día/noche a color, más las etiquetas de audiencia del plan. */}
        <div
          className="mt-4 mb-6 rounded-2xl p-5 flex items-center gap-4"
          style={{
            border: "2px solid var(--foreground)",
            boxShadow: "6px 6px 0px 0px var(--border)",
            background: esNoche ? "var(--foreground)" : "var(--tertiary)",
          }}
        >
          <div
            className="icon-chip w-12 h-12 shrink-0"
            style={{ background: esNoche ? "var(--accent)" : "var(--card)" }}
          >
            {esNoche ? (
              <Moon size={22} strokeWidth={2.5} color="var(--accent-foreground)" />
            ) : (
              <Sun size={22} strokeWidth={2.5} color="var(--tertiary-foreground)" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="badge-pill"
              style={{
                background: esNoche ? "var(--background)" : "var(--card)",
                borderColor: "var(--foreground)",
              }}
            >
              {esNoche ? tBadges("deNoche") : tBadges("deDia")}
            </span>
            {evento.audiencia.map((a: Audiencia) => (
              <span
                key={a}
                className="badge-pill"
                style={{
                  background: esNoche ? "var(--background)" : "var(--card)",
                  borderColor: "var(--foreground)",
                }}
              >
                {tAudiencia(a)}
              </span>
            ))}
            {!evento.activo && (
              <span className="badge-pill" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--foreground)" }}>
                {tBadges("finalizado")}
              </span>
            )}
          </div>
        </div>

        <h1 className="text-4xl font-extrabold mb-4 text-balance">{evento.titulo}</h1>

        <div className="grid gap-3 mb-6">
          {evento.descripcion.split("\n\n").filter(Boolean).map((parrafo, i) => (
            <p key={i} className="text-base" style={{ color: "var(--foreground)" }}>
              <TextoConNegritas texto={parrafo} />
            </p>
          ))}
        </div>

        <dl className="card-sticker grid gap-3 text-sm p-5 mb-6">
          {evento.ubicacion && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--quaternary)" }}>
                <MapPin size={12} strokeWidth={3} />
              </span>
              <span><span className="font-bold">{tEvento("donde")}: </span>{evento.ubicacion}</span>
            </div>
          )}
          {evento.horario && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--secondary)" }}>
                <Clock size={12} strokeWidth={3} color="var(--secondary-foreground)" />
              </span>
              <span><span className="font-bold">{tEvento("horario")}: </span>{evento.horario}</span>
            </div>
          )}
          {evento.precio && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--tertiary)" }}>
                <Tag size={12} strokeWidth={3} />
              </span>
              <span><span className="font-bold">{tEvento("precio")}: </span>{evento.precio}</span>
            </div>
          )}
          {(evento.fecha_inicio || evento.fecha_fin) && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--accent)" }}>
                <CalendarRange size={12} strokeWidth={3} color="var(--accent-foreground)" />
              </span>
              <span>
                <span className="font-bold">{tEvento("fechas")}: </span>
                {evento.fecha_inicio && tEvento("desdeEl", { fecha: evento.fecha_inicio })}
                {evento.fecha_inicio && evento.fecha_fin && " — "}
                {evento.fecha_fin && tEvento("hastaEl", { fecha: evento.fecha_fin })}
              </span>
            </div>
          )}
          {evento.fuente && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--muted)" }}>
                <Link2 size={12} strokeWidth={3} />
              </span>
              <span>
                <span className="font-bold">{tEvento("fuente")}: </span>
                {esUrl(evento.fuente) ? (
                  <a href={evento.fuente} className="hover:underline" style={{ color: "var(--accent)" }} rel="noopener noreferrer nofollow">
                    {tEvento("verMasInformacion")}
                  </a>
                ) : (
                  evento.fuente
                )}
              </span>
            </div>
          )}
        </dl>

        {evento.preguntas_frecuentes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-extrabold mb-3">{tEvento("preguntasFrecuentes")}</h2>
            <div className="grid gap-3">
              {evento.preguntas_frecuentes.map((pf) => (
                <div key={pf.pregunta} className="card-sticker p-4">
                  <p className="font-bold">{pf.pregunta}</p>
                  <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{pf.respuesta}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <TiempoDelDia
          lat={evento.lat ?? municipio.lat}
          lon={evento.lon ?? municipio.lon}
          fecha={tiempo.fecha}
          solicitud={tiempo.solicitud}
          titulo={tiempo.titulo}
        />

        {evento.lat !== null && evento.lon !== null ? (
          <MapaEvento lat={evento.lat} lon={evento.lon} etiqueta={evento.titulo} direccionTexto={evento.ubicacion ?? undefined} />
        ) : (
          evento.ubicacion && (
            <p className="mb-6 text-sm">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evento.ubicacion)}`}
                className="hover:underline font-medium"
                style={{ color: "var(--accent)" }}
                rel="noopener noreferrer"
              >
                {tEvento("verEnGoogleMaps", { lugar: evento.ubicacion })}
              </a>
            </p>
          )
        )}

        {otrosPlanes.length > 0 && (
          <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
            <h2 className="text-lg font-extrabold mb-3">
              {tEvento("otrosPlanesEn", { municipio: municipio.nombre, cuando: etiquetaOtros })}
            </h2>
            <ul className="grid gap-2 text-sm">
              {otrosPlanes.slice(0, 6).map((p) => (
                <li key={p.id}>
                  {p.evento_slug ? (
                    <Link
                      href={`${base}/eventos/${p.evento_slug}?desde=${contexto}`}
                      className="hover:underline font-medium inline-flex items-start gap-1"
                      style={{ color: "var(--foreground)" }}
                    >
                      <ArrowRight size={12} strokeWidth={2.5} className="shrink-0 mt-1" />
                      {p.titulo}
                    </Link>
                  ) : (
                    p.titulo
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <MunicipioPageNav municipioSlug={municipioSlug} municipioNombre={municipio.nombre} />
      </div>
    </main>
  );
}
