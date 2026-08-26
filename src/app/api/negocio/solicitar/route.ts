import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enviarEnlaceEdicion } from "@/lib/email";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Servicio no disponible" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { lugarId, email } = (body ?? {}) as { lugarId?: unknown; email?: unknown };
  if (typeof lugarId !== "string" || lugarId.length === 0) {
    return NextResponse.json({ error: "Falta lugarId" }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_VALIDO.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const { data: lugar } = await supabaseAdmin.from("lugares").select("id, nombre").eq("id", lugarId).maybeSingle();
  if (!lugar) {
    return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
  }

  const token = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("solicitudes_negocio").insert({
    lugar_id: lugar.id,
    email: email.trim().toLowerCase(),
    token,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await enviarEnlaceEdicion(email.trim().toLowerCase(), token, lugar.nombre);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo enviar el email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
