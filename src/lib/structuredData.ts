import { getTranslations } from "next-intl/server";
import { fechaDesdeTextoEspanol, formatearFechaISO, hoyEnMadrid } from "./dates";
import { SITE_URL } from "./rutasLocale";
import { urlDeFoto, urlFotoProxy } from "./places";
import type { Evento, PreguntaFrecuente, Lugar, Listado, PuestoListado } from "./types";
import type { MunicipioConComunidad } from "./queries";

// Los datos estructurados son texto plano para máquinas — la negrita en
// "**texto**" (la única convención markdown que se le pide a Gemini, ver
// TextoConNegritas) no debe llegar tal cual, con asteriscos sueltos.
export function textoPlano(texto: string): string {
  return texto.replace(/\*\*([^*]+)\*\*/g, "$1");
}

// Solo un evento puntual con fecha real es un Event de schema.org de
// verdad — un plan genérico evergreen (un parque, una ruta sin fecha) no
// tiene inicio/fin y fingir que sí es justo el tipo de dato estructurado
// incorrecto que penaliza Google. Un evento ya finalizado tampoco se
// anuncia como Event vigente: Google desaconseja explícitamente mostrar
// rich results de eventos ya pasados. Eso se decide con la fecha real, no
// con `evento.activo` — ese flag puede estar a `false` por otros motivos
// sin que el evento haya pasado de verdad todavía (ver conversación).
export function construirEventoJsonLd(
  evento: Evento,
  municipio: MunicipioConComunidad,
  municipioSlug: string,
  // La URL declarada en el JSON-LD debe ser la de la página que Google
  // está leyendo de verdad — antes se fijaba siempre a /es/... aunque la
  // página real fuera /en/... (bug real, ver conversación). "es" es el
  // idioma por defecto sin prefijo (ver routing.ts, localePrefix:
  // "as-needed").
  locale: string = "es"
): Record<string, unknown> | null {
  if (!evento.fecha_inicio) return null;

  const inicio = fechaDesdeTextoEspanol(evento.fecha_inicio);
  if (!inicio) return null;
  const fin = evento.fecha_fin ? fechaDesdeTextoEspanol(evento.fecha_fin) : null;
  if ((fin ?? inicio) < hoyEnMadrid()) return null;

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
  const prefijo = locale === "es" ? "" : `/${locale}`;
  const urlEvento = `${SITE_URL}${prefijo}/${municipioSlug}/eventos/${evento.slug}`;

  // Solo se declara `offers` de pago cuando el precio tiene un formato
  // claro y de un único número ("20€", "Desde 20€") — rangos ("12-15€"),
  // texto sin cifra ("Consultar") o excepciones parciales ("6€, gratis
  // menores de 16") se dejan fuera a propósito, mismo criterio que ya
  // aplica esGratis arriba: mejor no declarar offers que declarar un precio
  // mal adivinado (ver conversación, Search Console: "Falta el campo
  // offers" en eventos de pago que sí tenían precio, solo que no se
  // mandaba).
  const precioClaro = !esGratis ? evento.precio?.trim().match(/^(?:desde\s+)?(\d+(?:[.,]\d{1,2})?)\s*€\s*$/i) : null;

  // `image`: el cartel real y verificado si existe (evento.cartel_url, ya
  // absoluto), si no la foto del recinto vía nuestro propio proxy (siempre
  // servible, a diferencia de algunos carteles con protección anti-hotlink
  // — ver HeaderImagenEvento.tsx). Ninguno de los dos se declaraba antes.
  const imagen = evento.cartel_url ?? (evento.foto_lugar_nombre ? `${SITE_URL}${urlFotoProxy(evento.foto_lugar_nombre, 1200)}` : null);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.titulo,
    description: textoPlano(evento.descripcion),
    startDate: formatearFechaISO(inicio),
    // Sin fecha_fin explícita, un evento "excepcional" es de un solo día
    // por definición (ver camposJson en gemini.ts) — endDate = startDate no
    // es una suposición, es el mismo dato que ya sabemos.
    endDate: formatearFechaISO(fin ?? inicio),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(imagen && { image: imagen }),
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
        url: urlEvento,
      },
    }),
    ...(precioClaro && {
      offers: {
        "@type": "Offer",
        price: precioClaro[1].replace(",", "."),
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: urlEvento,
      },
    }),
    url: urlEvento,
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

// Ficha de un lugar del vertical de Rankings (restaurante, alojamiento,
// clínica...) — LocalBusiness genérico en vez de intentar adivinar un
// subtipo más concreto (Restaurant, Hotel...) a partir de `tipo` (un valor
// libre de Google Places, no un enum controlado): un subtipo mal elegido
// es peor que uno genérico correcto. No se declaran horarios
// estructurados (openingHoursSpecification) porque `horario` se guarda
// como texto ya formateado para mostrar ("Lunes: 9:00-14:00"), no como
// datos parseables de fiar — inventar la estructura sería peor que omitirla.
export function construirLugarJsonLd(
  lugar: Lugar,
  municipio: { nombre: string },
  url: string
): Record<string, unknown> {
  const primeraFoto = lugar.fotos[0];
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: lugar.nombre,
    ...(lugar.descripcion && { description: textoPlano(lugar.descripcion) }),
    url,
    ...(primeraFoto && { image: `${SITE_URL}${urlDeFoto(primeraFoto)}` }),
    ...(lugar.direccion && {
      address: { "@type": "PostalAddress", streetAddress: lugar.direccion, addressLocality: municipio.nombre },
    }),
    ...(lugar.telefono && { telephone: lugar.telefono }),
    ...(lugar.web && { sameAs: lugar.web }),
    ...(lugar.lat !== null &&
      lugar.lon !== null && {
        geo: { "@type": "GeoCoordinates", latitude: lugar.lat, longitude: lugar.lon },
      }),
    // Google exige al menos 1 reseña para declarar aggregateRating — con 0
    // (o sin dato) se omite del todo en vez de fingir un ratingCount falso.
    ...(lugar.rating !== null &&
      lugar.num_valoraciones !== null &&
      lugar.num_valoraciones > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: lugar.rating,
          reviewCount: lugar.num_valoraciones,
        },
      }),
  };
}

// Ranking numerado (top-N) — el propio listado como ItemList, cada puesto
// como ListItem enlazando a la ficha real del lugar. `position` es 1-based,
// igual que ya se muestra en pantalla.
export function construirItemListJsonLd(
  listado: Listado,
  puestos: PuestoListado[],
  urlBase: string
): Record<string, unknown> | null {
  if (puestos.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listado.titulo,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: puestos.length,
    itemListElement: puestos.map((p) => ({
      "@type": "ListItem",
      position: p.posicion,
      url: `${urlBase}/lugares/${p.lugar.slug}`,
      name: p.lugar.nombre,
    })),
  };
}

// Organization + WebSite, una sola vez en el layout raíz — identidad de
// marca básica que Google puede usar para el Knowledge Panel / sitelinks,
// no ligada a ninguna página en concreto. Descripción sin ciudad a
// propósito (la marca es "Keplaneo" a secas, escalable a más ciudades —
// ver conversación); sin `logo` ni `sameAs` todavía porque no existe un
// logo real ni redes sociales — mejor omitirlos que rellenarlos con algo
// falso.
export async function construirOrganizacionYSitioJsonLd(): Promise<Record<string, unknown>> {
  const t = await getTranslations("Sitio");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Keplaneo",
        url: SITE_URL,
        description: t("descripcionMarca"),
      },
      {
        "@type": "WebSite",
        name: "Keplaneo",
        url: SITE_URL,
      },
    ],
  };
}
