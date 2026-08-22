# Planes España

MVP del proyecto "referente en España de qué hacer por municipio". Genera
diariamente planes de hoy/fin de semana (y mensualmente planes por mes) con
Gemini, los guarda en Supabase, y los sirve como páginas estáticas con Next.js
+ ISR. Arquitectura completa y razonamiento en el documento de proyecto.

## Puesta en marcha

1. **Supabase**: crea un proyecto en [supabase.com](https://supabase.com).
   En el SQL editor, ejecuta en orden `supabase/schema.sql` y luego
   `supabase/seed.sql` (carga Andalucía + Sevilla y 3 municipios cercanos
   para probar el hub de comunidad y el bloque de "municipios cercanos").
2. **Gemini**: crea una API key en [Google AI Studio](https://aistudio.google.com).
3. Copia `.env.example` a `.env.local` y rellena las variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API Keys en Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: en proyectos nuevos, Supabase la llama
     **Publishable key** (ya no "anon key") — misma pantalla.
   - `SUPABASE_SERVICE_ROLE_KEY`: en proyectos nuevos, Supabase la llama
     **Secret key** (ya no "service_role key"). Solo se usa en los route
     handlers de cron, nunca en el navegador.
   - El plan Free no pide tarjeta y no tiene coste — si el dashboard te pide
     datos de facturación en algún paso, es para un add-on opcional, no para
     usar el plan base.
   - `GEMINI_API_KEY`: la key de AI Studio.
   - `CRON_SECRET`: cualquier cadena aleatoria larga — se reutiliza en Vercel.
4. `npm install && npm run dev` y abre `http://localhost:3000`.

## Probar la generación de contenido en local

Los crons no se disparan solos en local. Llama al endpoint a mano:

```bash
curl "http://localhost:3000/api/cron/generate-daily" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Revisa la respuesta (planes generados por municipio) y recarga
`/andalucia/sevilla/hoy` para ver el resultado.

## Desplegar

1. Sube el repo a GitHub e impórtalo en Vercel.
2. Configura las mismas variables de entorno del `.env.local` en el proyecto
   de Vercel (Settings → Environment Variables).
3. `vercel.json` ya declara los dos crons (diario a las 05:00 UTC, mensual el
   día 1 a las 04:00 UTC) — Vercel los detecta automáticamente al desplegar
   y les añade la cabecera `Authorization: Bearer <CRON_SECRET>`.

## Cosas a verificar antes de escalar

- **Nombre del modelo y del tool de grounding**: `src/lib/gemini.ts` usa
  `GEMINI_MODEL` (por defecto `gemini-flash-lite-latest`) y el tool
  `google_search`. Estos identificadores cambian entre generaciones de
  modelo — confirma los vigentes en [ai.google.dev](https://ai.google.dev)
  antes de lanzar a producción.
- **Coste real**: cada fila de `generation_log` guarda tokens y coste
  estimado por municipio/día. Después de la primera semana, compáralo con
  la estimación del documento de proyecto.
- **Municipios sin apenas planes**: si un municipio pequeño devuelve pocos
  resultados para "pareja" o "familia", valora canonicalizar esa página a la
  versión genérica en vez de dejarla casi vacía indexable (ver sección de
  SEO del documento de proyecto).

## Estructura

```
src/
  app/
    page.tsx                              → home: lista de comunidades
    [comunidad]/page.tsx                  → hub de comunidad autónoma
    [comunidad]/[municipio]/page.tsx      → hub de municipio (enlaza a las 18 páginas)
    [comunidad]/[municipio]/hoy/...       → hoy (genérico, pareja, familia)
    [comunidad]/[municipio]/fin-de-semana/... → fin de semana (genérico, pareja, familia)
    [comunidad]/[municipio]/[mes]/page.tsx → página mensual
    api/cron/generate-daily/route.ts      → cron diario (hoy + finde)
    api/cron/generate-monthly/route.ts    → cron mensual
  components/                             → Breadcrumb, PlanList, navegación cruzada
  lib/                                    → supabase, gemini, queries, tipos, fechas
supabase/
  schema.sql, seed.sql
```
