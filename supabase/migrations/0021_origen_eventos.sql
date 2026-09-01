-- Procedencia real de cada evento: "gemini" (búsqueda normal con grounding)
-- o "externo" (importado desde un listado ya extraído de una fuente externa
-- verificada, ver generarPlanesDesdeListado en src/lib/gemini.ts). Sirve para
-- distinguir procedencia en el artifact de revisión de planes.
alter table eventos add column origen text not null default 'gemini';

-- Sin backfill: se intentó identificar los ~139 eventos importados
-- manualmente esta sesión (conciertos/exposiciones/teatro de septiembre
-- 2026, vía generarPlanesDesdeListado) por el dominio citado en `fuente`
-- (conciertosensevilla.es/onsevilla.com), pero en la práctica Gemini cita
-- ahí la web oficial del recinto/artista (ej. "FIBES Sevilla",
-- "cartujacenter.com"), nunca el listado del que se extrajo el título — el
-- heurístico no encontró ninguna coincidencia real (ver conversación). Esos
-- ~139 eventos quedan con origen='gemini' por defecto, indistinguibles de
-- una búsqueda normal; de aquí en adelante todo evento nuevo queda estampado
-- con precisión en el código (ver upsertEventosDelLote en eventos.ts).
