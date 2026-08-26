import { supabaseAdmin } from "./supabase";
import type { HorarioLugar } from "./types";

export interface SolicitudNegocio {
  id: string;
  lugar_id: string;
  email: string;
  token: string;
  estado: "iniciada" | "enviada" | "aprobada" | "rechazada";
  descripcion_propuesta: string | null;
  telefono_propuesto: string | null;
  web_propuesta: string | null;
  instagram_propuesto: string | null;
  facebook_propuesto: string | null;
  enlace_reserva_propuesto: string | null;
  lema_propuesto: string | null;
  nivel_precio_propuesto: string | null;
  horario_propuesto: HorarioLugar[] | null;
  fotos_propuestas: { url: string; ancho: number; alto: number }[];
  // Identificadores (nombre de Google o url propia) de fotos existentes que
  // el negocio ha marcado para quitar de la ficha.
  fotos_a_eliminar: string[];
  creado_en: string;
}

const HORAS_VALIDEZ_ENLACE = 48;

// El token de "iniciada" (para rellenar el formulario) caduca a las 48h;
// una vez "enviada" ya no depende del tiempo — el aviso a Victor con el
// enlace de aprobar/rechazar no caduca solo, se resuelve a mano.
export function enlaceEdicionCaducado(solicitud: SolicitudNegocio): boolean {
  if (solicitud.estado !== "iniciada") return false;
  const horas = (Date.now() - new Date(solicitud.creado_en).getTime()) / (1000 * 60 * 60);
  return horas > HORAS_VALIDEZ_ENLACE;
}

export async function buscarSolicitudPorToken(token: string): Promise<SolicitudNegocio | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("solicitudes_negocio")
    .select(
      "id, lugar_id, email, token, estado, descripcion_propuesta, telefono_propuesto, web_propuesta, instagram_propuesto, facebook_propuesto, enlace_reserva_propuesto, lema_propuesto, nivel_precio_propuesto, horario_propuesto, fotos_propuestas, fotos_a_eliminar, creado_en"
    )
    .eq("token", token)
    .maybeSingle();
  return data;
}
