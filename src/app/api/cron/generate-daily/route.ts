import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { generarNovedades, fusionarPlanesDuplicados, traducirPlanesAIngles, estimarCoste, estimarCosteTraduccion } from "@/lib/gemini";
import { upsertEventosDelLote } from "@/lib/eventos";
import { hoyISO, hoyEnMadrid, fechaDeHoyLegible, lunesDeLaSemanaActual, fechasDeLaSemana, formatearFechaISO } from "@/lib/dates";
import { calcularFilasPorDia } from "@/lib/planesPorDia";
import { diasRepasoDiario } from "@/lib/nivelesMunicipio";
import { revalidarSitemaps } from "@/lib/sitemapData";

export const maxDuration = 300;

// Corre de martes a domingo: la agenda de la semana ya se generó por
// completo el lunes (generate-weekly), así que esto solo busca planes
// NUEVOS que no conociéramos todavía — nunca vuelve a redactar lo que ya
// existe, que es justo lo que antes causaba duplicados (el mismo evento
// real con un título ligeramente distinto cada día). Los lunes no hace
// nada: ese día ya está cubierto por el cron semanal.

function pathsDelMunicipio(base: string): string[] {
  return [
    base,
    `${base}/hoy`,
    `${base}/hoy/pareja`,
    `${base}/hoy/con-ninos`,
    `${base}/fin-de-semana`,
    `${base}/fin-de-semana/pareja`,
    `${base}/fin-de-semana/con-ninos`,
    `${base}/esta-semana`,
    `${base}/esta-semana/pareja`,
    `${base}/esta-semana/con-ninos`,
    `${base}/esta-semana/gratis`,
    `${base}/gratis`,
  ];
}

// Mismas páginas, en inglés — las URLs usan palabras distintas (ver
// conversación) así que Next las trata como rutas de caché aparte, no
// basta con revalidar la versión en español.
function pathsDelMunicipioEn(base: string): string[] {
  const baseEn = `/en${base}`;
  return [
    baseEn,
    `${baseEn}/today`,
    `${baseEn}/today/couple`,
    `${baseEn}/today/with-kids`,
    `${baseEn}/this-weekend`,
    `${baseEn}/this-weekend/couple`,
    `${baseEn}/this-weekend/with-kids`,
    `${baseEn}/this-week`,
    `${baseEn}/this-week/couple`,
    `${baseEn}/this-week/with-kids`,
    `${baseEn}/this-week/free`,
    `${baseEn}/free`,
  ];
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const hoy = hoyISO();
  const diaSemana = hoyEnMadrid().getDay(); // 0=domingo … 6=sábado

  if (diaSemana === 1) {
    return NextResponse.json({ fecha: hoy, resultados: [], nota: "Lunes: cubierto por generate-weekly" });
  }

  const enfoqueFinde = diaSemana === 5; // viernes: prestar atención especial al finde
  const diasRestantesSemana = fechasDeLaSemana(lunesDeLaSemanaActual()).filter(
    (d) => formatearFechaISO(d) >= hoy
  );

  const { data: municipios, error } = await supabaseAdmin
    .from("municipios")
    .select("id, slug, nombre")
    .order("prioridad");

  if (error || !municipios) {
    return NextResponse.json({ error: error?.message ?? "Sin municipios" }, { status: 500 });
  }

  const resultados = [];

  for (const municipio of municipios) {
    // Nivel por tamaño (ver conversación sobre coste): grande repasa
    // martes a domingo, mediano solo martes y viernes, pequeño ningún día.
    if (!diasRepasoDiario(municipio.slug).includes(diaSemana)) {
      resultados.push({ municipio: municipio.slug, estado: "omitido", nota: "no toca repaso diario hoy para su nivel" });
      continue;
    }
    try {
      const { data: conocidos, error: errorConocidos } = await supabaseAdmin
        .from("eventos")
        .select("titulo")
        .eq("municipio_id", municipio.id)
        .eq("activo", true);
      if (errorConocidos) throw new Error(`eventos.select conocidos: ${errorConocidos.message}`);

      const titulosConocidos = (conocidos ?? []).map((e) => e.titulo);
      const municipiosExcluidos = municipios
        .filter((m) => m.id !== municipio.id)
        .map((m) => m.nombre);

      const { planes: planesCrudos, usage: usageGeneracion } = await generarNovedades(
        municipio.nombre,
        fechaDeHoyLegible(),
        titulosConocidos,
        enfoqueFinde,
        municipiosExcluidos
      );
      // Gemini puede describir el mismo evento real dos veces en una misma
      // respuesta (dos redacciones distintas) sin que eso choque con
      // ninguno de los `titulosConocidos` — se fusiona aquí, antes de que
      // ese duplicado llegue a `planes.insert`, no solo al vincular con
      // `eventos` (que ya lo agrupa, pero no evita la fila repetida).
      const planes = fusionarPlanesDuplicados(planesCrudos);

      // Traducción al inglés en una llamada aparte, sin grounding (ver
      // conversación) — se hace aquí, sobre el lote ya fusionado, para no
      // traducir duplicados que luego se descartarían. En su propio
      // try/catch: es una mejora aparte del contenido real en español, así
      // que un fallo aquí (red, límite de la API...) no debe tirar toda la
      // generación de hoy — se queda sin inglés esta vez y se traduce en
      // la siguiente pasada, cuando upsertEventosDelLote vuelva a procesar
      // este mismo evento.
      let traducciones: Awaited<ReturnType<typeof traducirPlanesAIngles>>["traducciones"] = [];
      let usageTraduccion: Awaited<ReturnType<typeof traducirPlanesAIngles>>["usage"] = {};
      try {
        ({ traducciones, usage: usageTraduccion } = await traducirPlanesAIngles(planes));
      } catch (err) {
        console.error(`traducirPlanesAIngles (${municipio.slug}): ${err}`);
      }
      planes.forEach((p, i) => Object.assign(p, traducciones[i]));
      // Tokens en crudo (solo informativos) sí se suman entre las dos
      // llamadas; el coste NO — cada una usa un modelo con tarifa distinta
      // (ver estimarCosteTraduccion), así que se calcula por separado y se
      // suman los euros, nunca los tokens antes de aplicar una tarifa.
      const usage = {
        promptTokenCount: (usageGeneracion.promptTokenCount ?? 0) + (usageTraduccion.promptTokenCount ?? 0),
        candidatesTokenCount: (usageGeneracion.candidatesTokenCount ?? 0) + (usageTraduccion.candidatesTokenCount ?? 0),
      };
      const costeTotal = estimarCoste(usageGeneracion) + estimarCosteTraduccion(usageTraduccion);

      let filasInsertadas = 0;
      let vinculosNuevos: string[] = [];

      if (planes.length > 0) {
        // Repaso parcial: no desactiva nada, solo añade lo nuevo.
        const vinculos = await upsertEventosDelLote(municipio.id, municipio.nombre, planes, hoy, false);
        const filas = calcularFilasPorDia(planes, diasRestantesSemana);

        if (filas.length > 0) {
          const { error: errorInsert } = await supabaseAdmin.from("planes").insert(
            filas.map((f) => ({
              municipio_id: municipio.id,
              fecha_generacion: f.fechaISO,
              titulo: f.plan.titulo,
              descripcion: f.plan.descripcion,
              momento: f.plan.momento,
              vigencia: f.vigencia,
              audiencia: f.plan.audiencia,
              tipo: f.plan.tipo,
              evento_id: vinculos.get(f.indice)?.id ?? null,
              fuente: f.plan.fuente ?? null,
            }))
          );
          if (errorInsert) throw new Error(`planes.insert: ${errorInsert.message}`);
          filasInsertadas = filas.length;
        }
        vinculosNuevos = Array.from(vinculos.values()).map((v) => v.slug);
      }

      await supabaseAdmin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "ok",
        tokens_input: usage.promptTokenCount ?? null,
        tokens_output: usage.candidatesTokenCount ?? null,
        coste_estimado: costeTotal,
      });

      const base = `/${municipio.slug}`;
      [
        ...pathsDelMunicipio(base),
        ...pathsDelMunicipioEn(base),
        ...vinculosNuevos.flatMap((slug) => [`${base}/eventos/${slug}`, `/en${base}/eventos/${slug}`]),
      ].forEach((path) => revalidatePath(path));

      resultados.push({ municipio: municipio.slug, estado: "ok", novedades: planes.length, filas: filasInsertadas });
    } catch (err) {
      await supabaseAdmin.from("generation_log").insert({
        municipio_id: municipio.id,
        fecha: hoy,
        estado: "error",
        error_mensaje: String(err),
      });
      resultados.push({ municipio: municipio.slug, estado: "error", error: String(err) });
    }
  }

  revalidarSitemaps();
  return NextResponse.json({ fecha: hoy, resultados });
}
