import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sun, Moon, MapPin, Clock, Tag, CalendarRange, Link2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import MapaEvento from "@/components/MapaEvento";
import TiempoDelDia from "@/components/TiempoDelDia";
import MunicipioPageNav from "@/components/MunicipioPageNav";
import {
  getEvento,
  getMunicipio,
  getPlanesDelMes,
  getPlanesFinde,
  getPlanesHoy,
  getVigenciaActualDeEvento,
} from "@/lib/queries";
import { esMesSlugValido } from "@/lib/dates";
import type { Audiencia, Plan } from "@/lib/types";

// Los eventos pueden pasar de activo a finalizado entre generaciones
// diarias; se revalida más a menudo que las páginas de listado.
export const revalidate = 3600;

function esUrl(texto: string): boolean {
  return /^https?:\/\//i.test(texto);
}

const ETIQUETA_AUDIENCIA: Record<Audiencia, string> = {
  pareja: "En pareja",
  familia: "En familia",
  generico: "Para todos",
};

async function cargarEvento(comunidadSlug: string, municipioSlug: string, eventoSlug: string) {
  const municipio = await getMunicipio(comunidadSlug, municipioSlug);
  if (!municipio) return null;
  const evento = await getEvento(municipio.id, eventoSlug);
  if (!evento) return null;
  return { municipio, evento };
}

// El evento no guarda su propia vigencia (esa vive en la fila de `planes`
// de hoy que apunta a él) — se usa para que "otros planes" muestre lo más
// relevante: si es de hoy, otros de hoy; si es del finde, otros del finde;
// si solo aparece en la agenda de un mes, otros de ese mes.
async function cargarOtrosPlanes(
  municipioId: string,
  eventoId: string
): Promise<{ etiqueta: string; planes: Plan[] }> {
  const vigencia = await getVigenciaActualDeEvento(eventoId);

  let etiqueta = "hoy";
  let planes: Plan[] = [];

  if (vigencia.includes("hoy")) {
    etiqueta = "hoy";
    planes = await getPlanesHoy(municipioId);
  } else if (vigencia.includes("finde")) {
    etiqueta = "este fin de semana";
    planes = await getPlanesFinde(municipioId);
  } else {
    const mes = vigencia.find(esMesSlugValido);
    if (mes) {
      etiqueta = `en ${mes}`;
      planes = await getPlanesDelMes(municipioId, mes);
    } else {
      planes = await getPlanesHoy(municipioId);
    }
  }

  return { etiqueta, planes: planes.filter((p) => p.evento_id !== eventoId) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; evento: string }>;
}): Promise<Metadata> {
  const { comunidad, municipio, evento: eventoSlug } = await params;
  const encontrado = await cargarEvento(comunidad, municipio, eventoSlug);
  if (!encontrado) return {};

  return {
    title: `${encontrado.evento.titulo} — ${encontrado.municipio.nombre}`,
    description: encontrado.evento.descripcion,
    // Un evento ya finalizado se mantiene accesible (no rompemos la URL),
    // pero no debe competir en el índice con contenido vigente.
    robots: encontrado.evento.activo ? undefined : { index: false, follow: true },
  };
}

export default async function EventoPage({
  params,
}: {
  params: Promise<{ comunidad: string; municipio: string; evento: string }>;
}) {
  const { comunidad: comunidadSlug, municipio: municipioSlug, evento: eventoSlug } = await params;
  const encontrado = await cargarEvento(comunidadSlug, municipioSlug, eventoSlug);
  if (!encontrado) notFound();
  const { municipio, evento } = encontrado;

  const base = `/${comunidadSlug}/${municipioSlug}`;
  const { etiqueta: etiquetaOtrosPlanes, planes: otrosPlanes } = await cargarOtrosPlanes(
    municipio.id,
    evento.id
  );

  const esNoche = evento.momento === "noche";

  return (
    <main className="flex-1 bg-dots">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: municipio.comunidad.nombre, href: `/${comunidadSlug}` },
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
              {esNoche ? "De noche" : "De día"}
            </span>
            {evento.audiencia.map((a) => (
              <span
                key={a}
                className="badge-pill"
                style={{
                  background: esNoche ? "var(--background)" : "var(--card)",
                  borderColor: "var(--foreground)",
                }}
              >
                {ETIQUETA_AUDIENCIA[a]}
              </span>
            ))}
            {!evento.activo && (
              <span className="badge-pill" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", borderColor: "var(--foreground)" }}>
                Finalizado
              </span>
            )}
          </div>
        </div>

        <h1 className="text-4xl font-extrabold mb-4 text-balance">{evento.titulo}</h1>

        <p className="mb-6 text-base" style={{ color: "var(--foreground)" }}>{evento.descripcion}</p>

        <dl className="card-sticker grid gap-3 text-sm p-5 mb-6">
          {evento.ubicacion && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--quaternary)" }}>
                <MapPin size={12} strokeWidth={3} />
              </span>
              <span><span className="font-bold">Dónde: </span>{evento.ubicacion}</span>
            </div>
          )}
          {evento.horario && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--secondary)" }}>
                <Clock size={12} strokeWidth={3} color="var(--secondary-foreground)" />
              </span>
              <span><span className="font-bold">Horario: </span>{evento.horario}</span>
            </div>
          )}
          {evento.precio && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--tertiary)" }}>
                <Tag size={12} strokeWidth={3} />
              </span>
              <span><span className="font-bold">Precio: </span>{evento.precio}</span>
            </div>
          )}
          {(evento.fecha_inicio || evento.fecha_fin) && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--accent)" }}>
                <CalendarRange size={12} strokeWidth={3} color="var(--accent-foreground)" />
              </span>
              <span>
                <span className="font-bold">Fechas: </span>
                {evento.fecha_inicio && `Desde el ${evento.fecha_inicio}`}
                {evento.fecha_inicio && evento.fecha_fin && " — "}
                {evento.fecha_fin && `Hasta el ${evento.fecha_fin}`}
              </span>
            </div>
          )}
          {evento.fuente && (
            <div className="flex gap-2.5 items-start">
              <span className="icon-chip w-6 h-6 shrink-0 mt-0.5" style={{ background: "var(--muted)" }}>
                <Link2 size={12} strokeWidth={3} />
              </span>
              <span>
                <span className="font-bold">Fuente: </span>
                {esUrl(evento.fuente) ? (
                  <a href={evento.fuente} className="hover:underline" style={{ color: "var(--accent)" }} rel="noopener noreferrer nofollow">
                    {evento.fuente}
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
            <h2 className="text-lg font-extrabold mb-3">Preguntas frecuentes</h2>
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

        <TiempoDelDia lat={evento.lat ?? municipio.lat} lon={evento.lon ?? municipio.lon} />

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
                Ver "{evento.ubicacion}" en Google Maps
              </a>
            </p>
          )
        )}

        {otrosPlanes.length > 0 && (
          <section className="mt-10 pt-8" style={{ borderTop: "2px dashed var(--border)" }}>
            <h2 className="text-lg font-extrabold mb-3">
              Otros planes en {municipio.nombre} {etiquetaOtrosPlanes}
            </h2>
            <ul className="grid gap-2 text-sm">
              {otrosPlanes.slice(0, 6).map((p) => (
                <li key={p.id}>
                  {p.evento_slug ? (
                    <Link href={`${base}/eventos/${p.evento_slug}`} className="hover:underline font-medium">
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

        <MunicipioPageNav
          comunidadSlug={comunidadSlug}
          municipioSlug={municipioSlug}
          municipioNombre={municipio.nombre}
        />
      </div>
    </main>
  );
}
