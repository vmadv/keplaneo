import { fechaDesdeTextoEspanol, formatearFechaISO } from "./dates";
import type { Evento, PreguntaFrecuente } from "./types";
import type { MunicipioConComunidad } from "./queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Los datos estructurados son texto plano para máquinas — la negrita en
// "**texto**" (la única convención markdown que se le pide a Gemini, ver
// TextoConNegritas) no debe llegar tal cual, con asteriscos sueltos.
export function textoPlano(texto: string): string {
  return texto.replace(/\*\*([^*]+)\*\*/g, "$1");
}

// Solo un evento puntual con fecha real es un Event de schema.org de
// verdad — un plan genérico evergreen (un parque, una ruta sin fecha) no
// tiene inicio/fin y fingir que sí es justo el tipo de dato estructurado
// incorrecto que penaliza Google. Igual que el noindex de generateMetadata,
// un evento ya finalizado tampoco se anuncia como Event vigente: Google
// desaconseja explícitamente mostrar rich results de eventos ya pasados.
export function construirEventoJsonLd(
  evento: Evento,
  municipio: MunicipioConComunidad,
  municipioSlug: string
): Record<string, unknown> | null {
  if (!evento.activo || !evento.fecha_inicio) return null;

  const inicio = fechaDesdeTextoEspanol(evento.fecha_inicio);
  if (!inicio) return null;
  const fin = evento.fecha_fin ? fechaDesdeTextoEspanol(evento.fecha_fin) : null;

  // Sin un parser de precios fiable para texto libre ("Desde 12€",
  // "Consultar", "12-15€"), solo se declara `offers` cuando el precio en
  // conjunto ES gratis, no cuando la palabra "gratis" aparece suelta —
  // "6€ (gratis menores de 16 años)" contiene "gratis" pero cuesta 6€ para
  // la mayoría, y un precio mal adivinado es peor que no declarar ninguno.
  const FRASES_GRATIS = [
    "gratis",
    "gratuito",
    "gratuita",
    "entrada libre",
    "entrada gratuita",
    "acceso libre",
    "acceso gratuito",
  ];
  const precioNormalizado = evento.precio
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const esGratis = precioNormalizado ? FRASES_GRATIS.includes(precioNormalizado) : false;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.titulo,
    description: textoPlano(evento.descripcion),
    startDate: formatearFechaISO(inicio),
    ...(fin && { endDate: formatearFechaISO(fin) }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: evento.ubicacion ?? municipio.nombre,
      address: evento.ubicacion ?? municipio.nombre,
      ...(evento.lat !== null &&
        evento.lon !== null && {
          geo: { "@type": "GeoCoordinates", latitude: evento.lat, longitude: evento.lon },
        }),
    },
    ...(esGratis && {
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/es/${municipioSlug}/eventos/${evento.slug}`,
      },
    }),
    url: `${SITE_URL}/es/${municipioSlug}/eventos/${evento.slug}`,
  };
}

export function construirFaqJsonLd(preguntas: PreguntaFrecuente[]): Record<string, unknown> | null {
  if (preguntas.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map((pf) => ({
      "@type": "Question",
      name: textoPlano(pf.pregunta),
      acceptedAnswer: { "@type": "Answer", text: textoPlano(pf.respuesta) },
    })),
  };
}
