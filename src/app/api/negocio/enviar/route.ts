import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarSolicitudPorToken, enlaceEdicionCaducado } from "@/lib/solicitudesNegocio";
import { enviarAvisoRevision } from "@/lib/email";

const BUCKET = "fotos-negocios";

function dominioDe(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const conProtocolo = valor.includes("@") ? `mailto:${valor}` : valor.startsWith("http") ? valor : `https://${valor}`;
    if (valor.includes("@")) return valor.split("@")[1]?.toLowerCase() ?? null;
    return new URL(conProtocolo).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Servicio no disponible" }, { status: 500 });
  }

  const formData = await request.formData();
  const token = formData.get("token");
  if (typeof token !== "string") {
    return NextResponse.json({ error: "Falta token" }, { status: 400 });
  }

  const solicitud = await buscarSolicitudPorToken(token);
  if (!solicitud) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (solicitud.estado !== "iniciada") {
    return NextResponse.json({ error: "Esta solicitud ya no admite cambios" }, { status: 409 });
  }
  if (enlaceEdicionCaducado(solicitud)) {
    return NextResponse.json({ error: "El enlace ha caducado" }, { status: 410 });
  }

  const lema = String(formData.get("lema") ?? "").trim() || null;
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const web = String(formData.get("web") ?? "").trim() || null;
  const instagram = String(formData.get("instagram") ?? "").trim() || null;
  const facebook = String(formData.get("facebook") ?? "").trim() || null;
  const enlaceReserva = String(formData.get("enlaceReserva") ?? "").trim() || null;
  const nivelPrecio = String(formData.get("nivelPrecio") ?? "").trim() || null;

  let horario: { dia: string; horas: string }[] = [];
  try {
    horario = JSON.parse(String(formData.get("horario") ?? "[]"));
  } catch {
    horario = [];
  }

  let fotosAEliminar: string[] = [];
  try {
    fotosAEliminar = JSON.parse(String(formData.get("fotosAEliminar") ?? "[]"));
  } catch {
    fotosAEliminar = [];
  }

  const archivos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);

  const fotosSubidas: { url: string; ancho: number; alto: number }[] = [];
  for (const archivo of archivos) {
    const extension = archivo.name.split(".").pop() ?? "jpg";
    const ruta = `${solicitud.lugar_id}/${crypto.randomUUID()}.${extension}`;
    const { error: errorSubida } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type || "image/jpeg" });
    if (errorSubida) {
      return NextResponse.json({ error: `Error subiendo foto: ${errorSubida.message}` }, { status: 500 });
    }
    const { data: publica } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);
    // Sin librería de procesado de imágenes en el proyecto: se guarda un
    // tamaño por defecto — no se usa para el layout (todas las fotos se
    // muestran con `fill`), solo para completar la forma de FotoLugar.
    fotosSubidas.push({ url: publica.publicUrl, ancho: 1200, alto: 900 });
  }

  const { error: errorUpdate } = await supabaseAdmin
    .from("solicitudes_negocio")
    .update({
      lema_propuesto: lema,
      descripcion_propuesta: descripcion,
      telefono_propuesto: telefono,
      web_propuesta: web,
      instagram_propuesto: instagram,
      facebook_propuesto: facebook,
      enlace_reserva_propuesto: enlaceReserva,
      nivel_precio_propuesto: nivelPrecio,
      horario_propuesto: horario.length > 0 ? horario : null,
      fotos_propuestas: fotosSubidas,
      fotos_a_eliminar: fotosAEliminar,
      estado: "enviada",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", solicitud.id);
  if (errorUpdate) {
    return NextResponse.json({ error: errorUpdate.message }, { status: 500 });
  }

  const { data: lugar } = await supabaseAdmin
    .from("lugares")
    .select("nombre, web")
    .eq("id", solicitud.lugar_id)
    .maybeSingle();

  const dominioWebGuardada = dominioDe(lugar?.web ?? null);
  const webCoincide = dominioWebGuardada === null ? null : dominioWebGuardada === dominioDe(solicitud.email);

  await enviarAvisoRevision({
    nombreLugar: lugar?.nombre ?? "Lugar",
    email: solicitud.email,
    lema,
    descripcion,
    telefono,
    web,
    instagram,
    facebook,
    enlaceReserva,
    nivelPrecio,
    numHorarioFilas: horario.length,
    numFotos: fotosSubidas.length,
    numFotosAEliminar: fotosAEliminar.length,
    webCoincide,
    token,
  });

  return NextResponse.json({ ok: true });
}
