import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarPlanesDelMes, traducirPlanesAIngles, estimarCoste, estimarCosteTraduccion } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO, proximosMesesSlugs, fechaDeHoyLegible, numeroSemanaDesde2020, mesSlugParaLocale } from "@/lib/dates";

export const maxDuration = 300;

// Genera los 12 meses del año (no solo mes en curso + siguiente — ver
// conversación: la navegación "Por mes" solo enlaza los 2 más próximos,
// pero las 12 URLs existen igualmente y así nunca dan una página vacía a
// quien busca con más antelación, ni a Google). Programado semanal
// (vercel.json, lunes 6:00), no mensual: así el mes en curso no se queda
// una semana entera sin reflejar un evento anunciado a media semana — ver
// conversación.
//
// PERO no los 12 con la misma frecuencia (ver conversación sobre coste):
// el mes en curso y el siguiente sí se regeneran CADA semana (son los que
// enlaza la navegación y donde de verdad puede aparecer algo nuevo); los
// otros 10 (hasta 11 meses vista, ej. enero del año que viene) solo hace
// falta que existan y se posicionen, no que se repitan 4 veces al mes por
// nada — se reparten en 4 grupos rotativos por número de semana, así cada
// uno se refresca aproximadamente una vez al mes en vez de cada semana.
async function enLotes<T, R>(items: T[], tamano: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano);
    resultados.push(...(await Promise.all(lote.map(fn))));
  }
  return resultados;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }
  const admin = supabaseAdmin;

  const hoy = hoyISO();
  const todosLosMeses = proximosMesesSlugs(12);
  const mesesCercanos = todosLosMeses.slice(0, 2); // actual + siguiente: cada semana
  const mesesLejanos = todosLosMeses.slice(2); // el resto: rotación de 4 grupos (~1 vez al mes)
  const grupoEstaSemana = numeroSemanaDesde2020() % 4;
  const mesesLejanosDeEstaSemana = mesesLejanos.filter((_, i) => i % 4 === grupoEstaSemana);
  const meses = [...mesesCercanos, ...mesesLejanosDeEstaSemana];

  const { data: municipios, error } = await admin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json(
      { error: error?.message ?? "Sin municipios" },
      { status: 500 }
    );
  }

  const combos = municipios.flatMap((municipio) => meses.map((mes) => ({ municipio, mes })));

  const resultados = await enLotes(combos, 6, async ({ municipio, mes }) => {
    try {
      const municipiosExcluidos = municipios
        .filter((m) => m.id !== municipio.id)
        .map((m) => m.nombre);
      const { planes, usage: usageGeneracion } = await generarPlanesDelMes(
        municipio.nombre,
        mes,
        fechaDeHoyLegible(),
        municipiosExcluidos
      );

      // Traducción al inglés en una llamada aparte, sin grounding (ver
      // conversación). En su propio try/catch: un fallo aquí no debe tirar
      // toda la generación real en español — se queda sin inglés esta vez
      // y se traduce en la siguiente pasada.
      let traducciones: Awaited<ReturnType<typeof traducirPlanesAIngles>>["traducciones"] = [];
      let usageTraduccion: Awaited<ReturnType<typeof traducirPlanesAIngles>>["usage"] = {};
      try {
        ({ traducciones, usage: usageTraduccion } = await traducirPlanesAIngles(planes));
      } catch (err) {
        console.error(`traducirPlanesAIngles (${municipio.slug}): ${err}`);
      }
      planes.forEach((p, i) => Object.assign(p, traducciones[i]));
      // Tokens en crudo (solo informativos) sí se suman; el coste NO — cada
      // llamada usa un modelo con tarifa distinta (ver estimarCosteTraduccion
      // en gemini.ts), así que se calcula por separado y se suman los euros.
      const usage = {
        promptTokenCount: (usageGeneracion.promptTokenCount ?? 0) + (usageTraduccion.promptTokenCount ?? 0),
        candidatesTokenCount: (usageGeneracion.candidatesTokenCount ?? 0) + (usageTraduccion.candidatesTokenCount ?? 0),
      };
      const costeTotal = estimarCoste(usageGeneracion) + estimarCosteTraduccion(usageTraduccion);

      // Mismo slug que use el cron diario para el mismo evento: si ya existe
      // (porque también salió en la generación de hoy/finde), se actualiza
      // la misma fila en vez de crear una página duplicada.
      const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy);

      // Sustituye el lote de ESTE mes para este municipio, sin acumular
      // duplicados entre ejecuciones (por si el cron se relanza a mano).
      const { data: viejos, error: errorSelectViejos } = await admin
        .from("planes")
        .select("id")
        .eq("municipio_id", municipio.id)
        .contains("vigencia", [mes]);
      if (errorSelectViejos) throw new Error(`planes.select viejos: ${errorSelectViejos.message}`);

      if (viejos && viejos.length > 0) {
        const { error: errorDelete } = await admin
          .from("planes")
          .delete()
          .in("id", viejos.map((p) => p.id));
        if (errorDelete) throw new Error(`planes.delete: ${errorDelete.message}`);
      }

      const { error: errorInsert } = await admin.from("planes").insert(
        planes.map((p, i) => ({
          municipio_id: municipio.id,
          fecha_generacion: hoy,
          titulo: p.titulo,
          descripcion: p.descripcion,
          momento: p.momento,
          vigencia: p.vigencia,
          audiencia: p.audiencia,
          tipo: p.tipo,
          evento_id: vinculos.get(i)?.id ?? null,
          fuente: p.fuente ?? null,
        }))
      );
      if (errorInsert) throw new Error(`planes.insert: ${errorInsert.message}`);

      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "ok",
        tokens_input: usage.promptTokenCount ?? null,
        tokens_output: usage.candidatesTokenCount ?? null,
        coste_estimado: costeTotal,
      });

      const base = `/${municipio.slug}`;
      revalidatePath(`${base}/${mes}`);
      revalidatePath(`/en${base}/${mesSlugParaLocale(mes, "en")}`);
      Array.from(vinculos.values()).forEach((v) => {
        revalidatePath(`${base}/eventos/${v.slug}`);
        revalidatePath(`/en${base}/eventos/${v.slug}`);
      });

      return { municipio: municipio.slug, mes, estado: "ok", planes: planes.length };
    } catch (err) {
      await admin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "error",
        error_mensaje: String(err),
      });
      return { municipio: municipio.slug, mes, estado: "error", error: String(err) };
    }
  });

  return NextResponse.json({ fecha: hoy, meses, resultados });
}
