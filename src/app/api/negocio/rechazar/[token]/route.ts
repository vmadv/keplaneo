import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarSolicitudPorToken } from "@/lib/solicitudesNegocio";

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

  await supabaseAdmin
    .from("solicitudes_negocio")
    .update({ estado: "rechazada", actualizado_en: new Date().toISOString() })
    .eq("id", solicitud.id);

  return paginaHtml("Rechazada", "La solicitud ha sido descartada. No se ha publicado ningún cambio.");
}
