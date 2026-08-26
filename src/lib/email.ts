import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Remitente de pruebas de Resend: funciona sin verificar dominio propio,
// pero en modo sandbox Resend solo entrega a la dirección con la que se
// creó la cuenta — para enviar a cualquier email hace falta verificar un
// dominio propio en el dashboard de Resend.
const FROM = "Planes España <onboarding@resend.dev>";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function urlAbsoluta(ruta: string): string {
  return `${SITE_URL}${ruta}`;
}

export async function enviarEnlaceEdicion(email: string, token: string, nombreLugar: string) {
  if (!resend) throw new Error("Falta RESEND_API_KEY");
  const enlace = urlAbsoluta(`/es/negocio/editar/${token}`);
  // El SDK de Resend NO lanza excepción en un error de la API (403, etc.) —
  // lo devuelve como { error } en el resultado y sigue como si nada. Sin
  // este chequeo, un envío fallido (ej. límite del modo sandbox) se daba
  // por hecho como enviado.
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Actualiza la ficha de ${nombreLugar} en Planes España`,
    html: `
      <p>Hola,</p>
      <p>Has pedido actualizar la ficha de <strong>${nombreLugar}</strong> en Planes España.</p>
      <p><a href="${enlace}">Pulsa aquí para completarla</a> (descripción, teléfono, web y fotos).</p>
      <p>El enlace caduca en 48 horas. Los cambios no se publican al instante — los revisamos antes de que aparezcan en la página.</p>
      <p>Si no has sido tú, ignora este correo.</p>
    `,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export async function enviarAvisoRevision(params: {
  nombreLugar: string;
  email: string;
  lema: string | null;
  descripcion: string | null;
  telefono: string | null;
  web: string | null;
  instagram: string | null;
  facebook: string | null;
  enlaceReserva: string | null;
  nivelPrecio: string | null;
  numHorarioFilas: number;
  numFotos: number;
  numFotosAEliminar: number;
  webCoincide: boolean | null;
  token: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!resend || !adminEmail) throw new Error("Falta RESEND_API_KEY o ADMIN_EMAIL");

  const aprobar = urlAbsoluta(`/api/negocio/aprobar/${params.token}`);
  const rechazar = urlAbsoluta(`/api/negocio/rechazar/${params.token}`);
  const senalConfianza =
    params.webCoincide === null
      ? "Este lugar no tiene web guardada, no se puede contrastar."
      : params.webCoincide
        ? "✅ El email coincide con el dominio de la web que ya teníamos guardada."
        : "⚠️ El email NO coincide con el dominio de la web guardada — revisa con más cuidado.";

  const { error } = await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Solicitud pendiente: ${params.nombreLugar}`,
    html: `
      <p>Solicitud de <strong>${params.email}</strong> para <strong>${params.nombreLugar}</strong>.</p>
      <p>${senalConfianza}</p>
      <p><strong>Lema:</strong> ${params.lema ?? "(sin cambios)"}</p>
      <p><strong>Descripción propuesta:</strong><br>${params.descripcion ?? "(sin cambios)"}</p>
      <p><strong>Teléfono:</strong> ${params.telefono ?? "(sin cambios)"}</p>
      <p><strong>Web:</strong> ${params.web ?? "(sin cambios)"}</p>
      <p><strong>Instagram:</strong> ${params.instagram ?? "(sin cambios)"}</p>
      <p><strong>Facebook:</strong> ${params.facebook ?? "(sin cambios)"}</p>
      <p><strong>Enlace de reserva:</strong> ${params.enlaceReserva ?? "(sin cambios)"}</p>
      <p><strong>Rango de precio:</strong> ${params.nivelPrecio ?? "(sin cambios)"}</p>
      <p><strong>Horario:</strong> ${params.numHorarioFilas > 0 ? `${params.numHorarioFilas} días indicados` : "(sin cambios)"}</p>
      <p><strong>Fotos nuevas:</strong> ${params.numFotos}</p>
      <p><strong>Fotos a quitar:</strong> ${params.numFotosAEliminar}</p>
      <p>
        <a href="${aprobar}" style="background:#8b5cf6;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px;">Aprobar</a>
        <a href="${rechazar}" style="background:#f1f5f9;color:#1e293b;padding:10px 20px;text-decoration:none;border-radius:6px;">Rechazar</a>
      </p>
    `,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
