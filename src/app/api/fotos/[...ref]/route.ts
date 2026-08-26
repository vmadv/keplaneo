import { NextRequest, NextResponse } from "next/server";
import { urlFotoGoogle } from "@/lib/places";

// Proxy server-side hacia el endpoint de fotos de Google Places: la API
// key nunca llega al navegador. fetch() sigue la redirección 302 que
// devuelve Google por defecto, así que aquí ya llegan los bytes de la
// imagen final, no la redirección.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string[] }> }
) {
  const { ref } = await params;
  const nombreFoto = ref.join("/");
  const ancho = Number(request.nextUrl.searchParams.get("w")) || 800;

  const res = await fetch(urlFotoGoogle(nombreFoto, ancho));
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "No se pudo obtener la foto" }, { status: res.status || 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      // 30 días, a la par del refresco mensual de fotos/rating.
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
