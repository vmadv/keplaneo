import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

interface Marca {
  slug: string;
  valor: "quitar" | "potenciar";
  municipio: string; // slug del municipio, para revalidar sus rutas
}

// Aplica de verdad, sobre `eventos`, lo que Victor marcó en el artifact de
// revisión — llamada por la tarea programada diaria, nunca por el propio
// artifact (el sandbox de Artifact no puede hacer fetch a sitios externos).
// "quitar" reutiliza el mismo mecanismo reversible (activo=false) que ya usa
// el sistema para desactivar eventos caducados — nada nuevo, solo aplicado a
// una fila concreta por slug. "potenciar" sube relevancia al tope del rango
// existente (1-10): al ser el 3er criterio de desempate del sort de 4
// niveles (ver queries.ts), nunca adelanta a un tier o fecha superior, solo
// gana posición frente a otros eventos empatados en tier+fecha — ver
// conversación.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = (await request.json()) as { marcas?: Marca[] };
  const marcas = body.marcas ?? [];

  const aplicados: string[] = [];
  const errores: { slug: string; error: string }[] = [];
  const municipiosARevalidar = new Set<string>();

  for (const m of marcas) {
    const cambios = m.valor === "quitar" ? { activo: false } : { relevancia: 10 };
    const { error } = await supabaseAdmin.from("eventos").update(cambios).eq("slug", m.slug);
    if (error) {
      errores.push({ slug: m.slug, error: error.message });
      continue;
    }
    aplicados.push(m.slug);
    municipiosARevalidar.add(m.municipio);
  }

  // Un evento quitado/potenciado puede reordenar o desaparecer de cualquier
  // listado del municipio (hub, categoría, hoy/finde/mes...) — revalidar solo
  // su propia página de detalle no bastaría.
  municipiosARevalidar.forEach((slug) => revalidatePath(`/${slug}`, "layout"));

  return NextResponse.json({ aplicados: aplicados.length, aplicadosSlugs: aplicados, errores });
}
