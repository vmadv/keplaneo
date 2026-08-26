import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { resolverCandidatos, umbralParaTipo } from "@/lib/places";
import { buscarCandidatosPorTema, escribirFichasLugares, escribirIntroYFaqListado, estimarCoste } from "@/lib/gemini";
import { slugify } from "@/lib/slug";

export const maxDuration = 120;

const TOP_N = 10;

interface CuerpoPeticion {
  comunidadSlug: string;
  municipioSlug: string;
  tipoLugar: string; // ej. "restaurante" — libre, solo se guarda como etiqueta
  tema: string; // fama específica que busca Gemini, ej. "mejores restaurantes de croquetas"
  // Query genérica de CATEGORÍA (no del tema específico) para la búsqueda
  // amplia de Places, ej. "restaurantes en Sevilla", "colegios privados en
  // Sevilla" — trae de una vez un pool real donde buscar los nombres que
  // proponga Gemini, en vez de pedir uno por uno (ver resolverCandidatos).
  consultaAmplia: string;
  slug: string; // slug del listado, ej. "mejores-restaurantes-de-croquetas"
  titulo: string; // título mostrado, ej. "Los mejores restaurantes de croquetas en Sevilla"
}

// Da un slug único dentro del array que se está insertando ahora mismo:
// si dos candidatos comparten nombre (poco común pero posible con cadenas),
// añade el municipio o un sufijo numérico antes que dejar un slug repetido.
function slugUnico(nombre: string, usados: Set<string>): string {
  const base = slugify(nombre);
  if (!usados.has(base)) {
    usados.add(base);
    return base;
  }
  let i = 2;
  while (usados.has(`${base}-${i}`)) i++;
  const slug = `${base}-${i}`;
  usados.add(slug);
  return slug;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = (await request.json()) as Partial<CuerpoPeticion>;
  const { comunidadSlug, municipioSlug, tipoLugar, tema, consultaAmplia, slug, titulo } = body;
  if (!comunidadSlug || !municipioSlug || !tipoLugar || !tema || !consultaAmplia || !slug || !titulo) {
    return NextResponse.json(
      { error: "Faltan campos: comunidadSlug, municipioSlug, tipoLugar, tema, consultaAmplia, slug, titulo" },
      { status: 400 }
    );
  }

  const { data: municipioFila } = await supabaseAdmin
    .from("municipios")
    .select("id, slug, nombre, comunidades!inner(slug), provincias(slug)")
    .eq("slug", municipioSlug)
    .eq("comunidades.slug", comunidadSlug)
    .maybeSingle();
  if (!municipioFila) {
    return NextResponse.json({ error: "Municipio no encontrado" }, { status: 404 });
  }
  const { provincias, ...municipio } = municipioFila as unknown as {
    id: string;
    slug: string;
    nombre: string;
    provincias: { slug: string } | { slug: string }[] | null;
  };
  const provinciaSlug = (Array.isArray(provincias) ? provincias[0] : provincias)?.slug;
  if (!provinciaSlug) {
    return NextResponse.json(
      { error: "El municipio no tiene provincia asignada (¿falta correr la migración 0014?)" },
      { status: 500 }
    );
  }

  // 1. Quién entra y en qué orden lo decide la fama específica en el tema
  // (buscada de verdad por Gemini), no el rating general de Google — un
  // sitio de moda con miles de reseñas no es lo mismo que un sitio famoso
  // concretamente por esto.
  const { nombres: candidatosGemini, usage: usageCandidatos } = await buscarCandidatosPorTema(
    municipio.nombre,
    tema
  );
  if (candidatosGemini.length === 0) {
    return NextResponse.json({ error: "Gemini no propuso ningún candidato para ese tema" }, { status: 422 });
  }

  // 2. Places solo verifica: que el sitio existe de verdad, que es
  // razonablemente el mismo (no otro negocio que caiga primero en la
  // búsqueda) y que cumple el mínimo de calidad — nunca reordena por
  // rating. Se conserva el orden de fama de Gemini; los candidatos que no
  // se puedan verificar simplemente se descartan. resolverCandidatos hace
  // esto con una sola búsqueda amplia en la mayoría de los casos, en vez
  // de una llamada a Places por cada nombre (ver src/lib/places.ts).
  const { candidatos: top, llamadasPlaces } = await resolverCandidatos(
    candidatosGemini,
    consultaAmplia,
    municipio.nombre,
    TOP_N,
    umbralParaTipo(tipoLugar)
  );

  if (top.length === 0) {
    return NextResponse.json(
      { error: "Ningún candidato propuesto por Gemini se pudo verificar en Google Places" },
      { status: 422 }
    );
  }

  // 3. Redacción: descripción de ficha + motivo del puesto, en un solo
  // prompt para que no se repitan frases entre puestos.
  const { fichas, usage } = await escribirFichasLugares(municipio.nombre, tema, top);

  // 3.5. Intro general del ranking (habla del tema en conjunto, no de un
  // sitio) + FAQ — lo único de la página que no es "ficha de un lugar", y
  // hasta ahora no se generaba (quedaba vacío). Se apoya en el top 3 real
  // para que la intro no suene genérica.
  const top3ParaIntro = top.slice(0, 3).map((c, i) => ({ nombre: c.nombre, motivo: fichas[i]?.motivo ?? "" }));
  const { intro, usage: usageIntro } = await escribirIntroYFaqListado(municipio.nombre, tema, top3ParaIntro);

  // 4. Upsert de la ficha estable de cada lugar (puede repetirse en futuros
  // listados sin volver a pedirle nada a Places).
  const usados = new Set<string>();
  const lugaresGuardados: { id: string; slug: string; nombre: string }[] = [];

  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    const ficha = fichas[i];

    const { data: existente } = await supabaseAdmin
      .from("lugares")
      .select("id, slug")
      .eq("municipio_id", municipio.id)
      .eq("google_place_id", c.googlePlaceId)
      .maybeSingle();

    const datos = {
      municipio_id: municipio.id,
      google_place_id: c.googlePlaceId,
      tipo: tipoLugar,
      nombre: c.nombre,
      direccion: c.direccion,
      lat: c.lat,
      lon: c.lon,
      rating: c.rating,
      num_valoraciones: c.numValoraciones,
      nivel_precio: c.nivelPrecio,
      telefono: c.telefono,
      web: c.web,
      horario: c.horario,
      fotos: c.fotos,
      descripcion: ficha?.descripcion ?? null,
      ultima_actualizacion: new Date().toISOString().slice(0, 10),
      activo: true,
    };

    if (existente) {
      await supabaseAdmin.from("lugares").update(datos).eq("id", existente.id);
      lugaresGuardados.push({ id: existente.id, slug: existente.slug, nombre: c.nombre });
    } else {
      const nuevoSlug = slugUnico(c.nombre, usados);
      const { data: creado, error } = await supabaseAdmin
        .from("lugares")
        .insert({ ...datos, slug: nuevoSlug })
        .select("id, slug")
        .single();
      if (error || !creado) throw new Error(`lugares.insert: ${error?.message}`);
      lugaresGuardados.push({ id: creado.id, slug: creado.slug, nombre: c.nombre });
    }
  }

  // 5. Upsert del listado (título/descripción de metodología) y sustitución
  // completa de sus puestos — el ranking de hoy manda, no se acumulan
  // puestos de una ejecución anterior.
  const { data: listadoExistente } = await supabaseAdmin
    .from("listados")
    .select("id")
    .eq("municipio_id", municipio.id)
    .eq("slug", slug)
    .maybeSingle();

  const datosListado = {
    tipo_lugar: tipoLugar,
    titulo,
    descripcion: intro.descripcion,
    preguntas_frecuentes: intro.preguntas_frecuentes,
    actualizado_en: new Date().toISOString().slice(0, 10),
  };

  let listadoId: string;
  if (listadoExistente) {
    listadoId = listadoExistente.id;
    await supabaseAdmin.from("listados").update(datosListado).eq("id", listadoId);
    await supabaseAdmin.from("listado_lugares").delete().eq("listado_id", listadoId);
  } else {
    const { data: creado, error } = await supabaseAdmin
      .from("listados")
      .insert({ municipio_id: municipio.id, slug, ...datosListado })
      .select("id")
      .single();
    if (error || !creado) throw new Error(`listados.insert: ${error?.message}`);
    listadoId = creado.id;
  }

  const { error: errorPuestos } = await supabaseAdmin.from("listado_lugares").insert(
    lugaresGuardados.map((l, i) => ({
      listado_id: listadoId,
      lugar_id: l.id,
      posicion: i + 1,
      motivo: fichas[i]?.motivo ?? null,
    }))
  );
  if (errorPuestos) throw new Error(`listado_lugares.insert: ${errorPuestos.message}`);

  // Los rankings viven en su propia rama de nivel superior (/rankings/...),
  // aparte de las páginas de planes de este municipio — ver conversación:
  // la miga de pan de un ranking nunca debe llevar de vuelta al hub de
  // Planes de este municipio.
  const base = `/rankings/espana/${comunidadSlug}/${provinciaSlug}/${municipioSlug}`;
  [
    `/rankings/espana/${comunidadSlug}/${provinciaSlug}`,
    base,
    `${base}/${slug}`,
    ...lugaresGuardados.map((l) => `${base}/lugares/${l.slug}`),
  ].forEach((path) => revalidatePath(path));

  // $35/1000 es el precio de lista del SKU "Enterprise" de Places (el que
  // pedimos, por incluir rating) — informativo, porque las primeras 1000
  // llamadas de ese SKU cada mes son gratis por cuenta de Google.
  const COSTE_PLACES_POR_LLAMADA = 0.035;

  return NextResponse.json({
    listado: slug,
    candidatos_propuestos: candidatosGemini.length,
    candidatos_verificados: top.length,
    llamadas_places: llamadasPlaces,
    puestos: lugaresGuardados.map((l, i) => ({ posicion: i + 1, nombre: l.nombre, slug: l.slug })),
    coste_estimado_gemini: estimarCoste(usage) + estimarCoste(usageCandidatos) + estimarCoste(usageIntro),
    coste_estimado_places_precio_lista: llamadasPlaces * COSTE_PLACES_POR_LLAMADA,
  });
}
