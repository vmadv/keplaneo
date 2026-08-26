import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Solo captura el interés (popup del sitio) — no manda ningún email
// todavía, así que no hace falta doble opt-in aquí; eso se añade cuando se
// active el envío real de verdad.
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

  const { email, municipioId } = (body ?? {}) as { email?: unknown; municipioId?: unknown };

  if (typeof email !== "string" || !EMAIL_VALIDO.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (typeof municipioId !== "string" || municipioId.length === 0) {
    return NextResponse.json({ error: "Falta municipioId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("suscriptores")
    .upsert(
      { email: email.trim().toLowerCase(), municipio_id: municipioId },
      { onConflict: "email,municipio_id", ignoreDuplicates: true }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
