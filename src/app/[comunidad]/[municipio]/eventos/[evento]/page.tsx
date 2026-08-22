import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

// Sin fotos, el peso visual de la ficha recae en icono + color + tipografía
// en vez de una imagen. Iconos simples en línea, mismo estilo que los de
// TiempoDelDia, para no añadir una librería de iconos solo para esto.
function IconoSol() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

function IconoPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-0.5">
      <path d="M12 21s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function IconoReloj() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function IconoEtiqueta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-0.5">
      <path d="M3 11.5 11.5 3H19a2 2 0 0 1 2 2v7.5L12.5 21 3 11.5Z" />
      <circle cx="15" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoCalendario() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-0.5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconoEnlace() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 mt-0.5">
      <path d="M9.5 14.5 14.5 9.5M8 6.5H6.5A3.5 3.5 0 0 0 3 10v0a3.5 3.5 0 0 0 3.5 3.5H8M16 6.5h1.5A3.5 3.5 0 0 1 21 10v0a3.5 3.5 0 0 1-3.5 3.5H16" />
    </svg>
  );
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
    <main className="max-w-3xl mx-auto px-6 py-16">
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
        className={`mt-4 mb-6 rounded-xl p-5 flex items-center gap-4 ${
          esNoche ? "bg-slate-900 text-slate-50" : "bg-amber-50 text-slate-900"
        }`}
      >
        <div
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            esNoche ? "bg-slate-100 text-slate-900" : "bg-amber-400 text-amber-950"
          }`}
        >
          {esNoche ? <IconoLuna /> : <IconoSol />}
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded-full ${
              esNoche ? "bg-slate-700 text-slate-100" : "bg-white/70 text-slate-700"
            }`}
          >
            {esNoche ? "De noche" : "De día"}
          </span>
          {evento.audiencia.map((a) => (
            <span
              key={a}
              className={`text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded-full ${
                esNoche ? "bg-slate-700 text-slate-100" : "bg-white/70 text-slate-700"
              }`}
            >
              {ETIQUETA_AUDIENCIA[a]}
            </span>
          ))}
          {!evento.activo && (
            <span className="text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded-full bg-red-100 text-red-800">
              Finalizado
            </span>
          )}
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-4 text-balance">{evento.titulo}</h1>

      <p className="text-slate-700 mb-6">{evento.descripcion}</p>

      <dl className="grid gap-3 text-sm text-slate-700 mb-6 border rounded-lg p-4">
        {evento.ubicacion && (
          <div className="flex gap-2">
            <IconoPin />
            <span><span className="font-medium text-slate-900">Dónde: </span>{evento.ubicacion}</span>
          </div>
        )}
        {evento.horario && (
          <div className="flex gap-2">
            <IconoReloj />
            <span><span className="font-medium text-slate-900">Horario: </span>{evento.horario}</span>
          </div>
        )}
        {evento.precio && (
          <div className="flex gap-2">
            <IconoEtiqueta />
            <span><span className="font-medium text-slate-900">Precio: </span>{evento.precio}</span>
          </div>
        )}
        {(evento.fecha_inicio || evento.fecha_fin) && (
          <div className="flex gap-2">
            <IconoCalendario />
            <span>
              <span className="font-medium text-slate-900">Fechas: </span>
              {evento.fecha_inicio && `Desde el ${evento.fecha_inicio}`}
              {evento.fecha_inicio && evento.fecha_fin && " — "}
              {evento.fecha_fin && `Hasta el ${evento.fecha_fin}`}
            </span>
          </div>
        )}
        {evento.fuente && (
          <div className="flex gap-2">
            <IconoEnlace />
            <span>
              <span className="font-medium text-slate-900">Fuente: </span>
              {esUrl(evento.fuente) ? (
                <a href={evento.fuente} className="text-blue-700 hover:underline" rel="noopener noreferrer nofollow">
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
          <h2 className="text-lg font-semibold mb-3">Preguntas frecuentes</h2>
          <div className="grid gap-3">
            {evento.preguntas_frecuentes.map((pf) => (
              <div key={pf.pregunta} className="border rounded-lg p-4">
                <p className="font-medium text-slate-900">{pf.pregunta}</p>
                <p className="text-sm text-slate-600 mt-1">{pf.respuesta}</p>
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
              className="text-blue-700 hover:underline"
              rel="noopener noreferrer"
            >
              Ver "{evento.ubicacion}" en Google Maps
            </a>
          </p>
        )
      )}

      {otrosPlanes.length > 0 && (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">
            Otros planes en {municipio.nombre} {etiquetaOtrosPlanes}
          </h2>
          <ul className="grid gap-2 text-sm">
            {otrosPlanes.slice(0, 6).map((p) => (
              <li key={p.id}>
                {p.evento_slug ? (
                  <Link href={`${base}/eventos/${p.evento_slug}`} className="hover:underline">
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
    </main>
  );
}
