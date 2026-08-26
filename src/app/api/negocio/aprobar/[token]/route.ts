import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarSolicitudPorToken } from "@/lib/solicitudesNegocio";
import type { FotoLugar } from "@/lib/types";

function paginaHtml(titulo: string, texto: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title></head>
     <body style="font-family: system-ui; max-width: 480px; margin: 80px auto; text-align: center;">
       <h1>${titulo}</h1><p>${texto}</p>
     </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!supabaseAdmin) return paginaHtml("Error", "Servicio no disponible.");

  const solicitud = await buscarSolicitudPorToken(token);
  if (!solicitud) return paginaHtml("No encontrada", "Esta solicitud no existe.");
  if (solicitud.estado !== "enviada") {
    return paginaHtml("Ya procesada", `Esta solicitud ya está en estado "${solicitud.estado}".`);
  }

  const { data: lugar } = await supabaseAdmin
    .from("lugares")
    .select("id, nombre, fotos, horario, municipio_id, slug, municipios(slug, comunidades(slug))")
    .eq("id", solicitud.lugar_id)
    .maybeSingle();
  if (!lugar) return paginaHtml("Error", "El lugar de esta solicitud ya no existe.");

  // Se quitan primero las marcadas para eliminar (por nombre de Google o
  // url propia) y luego se añaden las fotos nuevas subidas en la solicitud.
  const idsAEliminar = new Set(solicitud.fotos_a_eliminar);
  const fotosActuales = ((lugar.fotos ?? []) as FotoLugar[]).filter(
    (f) => !idsAEliminar.has(f.url ?? f.nombre ?? "")
  );
  const fotosFusionadas = [...fotosActuales, ...solicitud.fotos_propuestas];

  const { error } = await supabaseAdmin
    .from("lugares")
    .update({
      lema: solicitud.lema_propuesto,
      descripcion: solicitud.descripcion_propuesta,
      telefono: solicitud.telefono_propuesto,
      web: solicitud.web_propuesta,
      instagram: solicitud.instagram_propuesto,
      facebook: solicitud.facebook_propuesto,
      enlace_reserva: solicitud.enlace_reserva_propuesto,
      nivel_precio: solicitud.nivel_precio_propuesto,
      horario: solicitud.horario_propuesto ?? lugar.horario,
      fotos: fotosFusionadas,
      gestionado_por_negocio: true,
    })
    .eq("id", lugar.id);
  if (error) return paginaHtml("Error", error.message);

  await supabaseAdmin
    .from("solicitudes_negocio")
    .update({ estado: "aprobada", actualizado_en: new Date().toISOString() })
    .eq("id", solicitud.id);

  const municipios = lugar.municipios as unknown as { slug: string; comunidades: { slug: string } | { slug: string }[] } | null;
  const comunidadSlug = municipios
    ? Array.isArray(municipios.comunidades)
      ? municipios.comunidades[0]?.slug
      : municipios.comunidades?.slug
    : undefined;
  if (comunidadSlug && municipios) {
    revalidatePath(`/rankings/${comunidadSlug}/${municipios.slug}/lugares/${lugar.slug}`);
  }

  return paginaHtml("Aprobado ✅", `Los cambios de "${lugar.nombre}" ya están publicados.`);
}
