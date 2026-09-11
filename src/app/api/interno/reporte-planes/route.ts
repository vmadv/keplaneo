import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularPaginasPlan } from "@/lib/paginasPlan";
import type { Evento } from "@/lib/types";

export const maxDuration = 60;

// Reconstruye el informe de planes activos de un municipio (puntuales +
// genéricos, con sus páginas de aparición) que alimenta el artifact de
// revisión — ver conversación: sustituye a la ruta de un solo uso
// api/admin/reporte-planes (borrada tras generar el primer informe a mano),
// ahora reutilizable por la tarea programada diaria.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const municipioSlug = request.nextUrl.searchParams.get("municipio") ?? "sevilla";

  const { data: municipio, error: errorMunicipio } = await supabaseAdmin
    .from("municipios")
    .select("id, slug")
    .eq("slug", municipioSlug)
    .maybeSingle();
  if (errorMunicipio) return NextResponse.json({ error: errorMunicipio.message }, { status: 500 });
  if (!municipio) return NextResponse.json({ error: "Municipio no encontrado" }, { status: 404 });

  const { data: eventos, error: errorEventos } = await supabaseAdmin
    .from("eventos")
    .select(
      "titulo, slug, categoria, ubicacion, horario, precio, descripcion, fecha_inicio, fecha_fin, audiencia, origen, primera_deteccion"
    )
    .eq("municipio_id", municipio.id)
    .eq("activo", true)
    .order("titulo");
  if (errorEventos) return NextResponse.json({ error: errorEventos.message }, { status: 500 });

  type Fila = Pick<
    Evento,
    | "titulo"
    | "slug"
    | "categoria"
    | "ubicacion"
    | "horario"
    | "precio"
    | "descripcion"
    | "fecha_inicio"
    | "fecha_fin"
    | "audiencia"
    | "origen"
    | "primera_deteccion"
  >;

  const puntuales: unknown[] = [];
  const genericos: unknown[] = [];

  for (const e of (eventos ?? []) as Fila[]) {
    const paginas = calcularPaginasPlan(e, municipio.slug);
    if (e.fecha_inicio !== null) {
      puntuales.push({
        titulo: e.titulo,
        slug: e.slug,
        categoria: e.categoria,
        ubicacion: e.ubicacion,
        horario: e.horario,
        precio: e.precio,
        descripcion: e.descripcion,
        fecha_inicio: e.fecha_inicio,
        fecha_fin: e.fecha_fin,
        origen: e.origen,
        primeraDeteccion: e.primera_deteccion,
        meses: paginas.meses,
        enCurso: paginas.enCurso,
        pasado: paginas.pasado,
        paginasEstaticas: paginas.paginasEstaticas,
        paginasPorMes: paginas.paginasPorMes,
      });
    } else {
      genericos.push({
        titulo: e.titulo,
        slug: e.slug,
        categoria: e.categoria,
        ubicacion: e.ubicacion,
        horario: e.horario,
        precio: e.precio,
        descripcion: e.descripcion,
        origen: e.origen,
        primeraDeteccion: e.primera_deteccion,
        paginasEstaticas: paginas.paginasEstaticas,
      });
    }
  }

  const actividad = await construirActividadCrons(supabaseAdmin);

  return NextResponse.json({
    municipio: municipio.slug,
    totalPuntuales: puntuales.length,
    totalGenericos: genericos.length,
    puntuales,
    genericos,
    actividad,
  });
}

// Resumen de actividad de los crons (generate-daily/weekly/monthly) de los
// últimos 30 días, para la pestaña "Actividad" del artifact de revisión —
// a diferencia de puntuales/genericos, esto es de TODOS los municipios, no
// solo del que se está revisando: el gasto y los fallos son una cuenta
// compartida entre todos (ver conversación: Victor no se enteraba de que
// llevaba 3 días fallando por créditos de Gemini agotados hasta que
// preguntó por qué apenas había planes nuevos).
async function construirActividadCrons(admin: NonNullable<typeof supabaseAdmin>) {
  const DIAS = 30;
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);

  const [{ data: municipios }, { data: logs }, { data: detecciones }] = await Promise.all([
    admin.from("municipios").select("id, slug, nombre"),
    admin
      .from("generation_log")
      .select("fecha, municipio_id, estado, tokens_input, tokens_output, coste_estimado, error_mensaje")
      .gte("fecha", desde)
      .order("fecha", { ascending: false }),
    admin.from("eventos").select("municipio_id, primera_deteccion").gte("primera_deteccion", desde),
  ]);

  const nombrePorMunicipio = new Map((municipios ?? []).map((m) => [m.id, m.slug]));

  const nuevosPorDia = new Map<string, number>();
  for (const e of detecciones ?? []) {
    if (!e.primera_deteccion) continue;
    const clave = `${e.primera_deteccion}|${e.municipio_id}`;
    nuevosPorDia.set(clave, (nuevosPorDia.get(clave) ?? 0) + 1);
  }

  const entradas = (logs ?? []).map((l) => ({
    fecha: l.fecha,
    municipio: nombrePorMunicipio.get(l.municipio_id) ?? "?",
    estado: l.estado,
    tokensInput: l.tokens_input,
    tokensOutput: l.tokens_output,
    coste: l.coste_estimado,
    error: l.error_mensaje,
    nuevos: nuevosPorDia.get(`${l.fecha}|${l.municipio_id}`) ?? 0,
  }));

  const costeTotal = entradas.reduce((acc, e) => acc + (e.coste ?? 0), 0);
  // OJO: nunca sumar `nuevos` por fila de `entradas` — un mismo día puede
  // tener varias filas de generation_log para el mismo municipio (semanal +
  // mensual el mismo lunes, o relanzamientos manuales), y cada una repite el
  // mismo recuento de ese día. Sumar desde nuevosPorDia (una entrada por
  // fecha+municipio real) es lo único que no duplica.
  const nuevosTotal = [...nuevosPorDia.values()].reduce((acc, n) => acc + n, 0);
  const errores = entradas.filter((e) => e.estado === "error").length;

  return { entradas, resumen: { dias: DIAS, costeTotal, nuevosTotal, errores } };
}
