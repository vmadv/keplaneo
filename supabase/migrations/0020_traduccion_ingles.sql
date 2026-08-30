-- Versión en inglés del contenido real de cada evento (no solo la interfaz
-- del sitio, que ya estaba traducida) — para que el inglés se posicione en
-- SEO de verdad, no solo el envoltorio (menús, botones). NULL = todavía no
-- traducido (contenido antiguo, generado antes de este cambio); el
-- renderizado cae de vuelta al español mientras tanto. Ubicación y horario
-- no llevan versión en inglés: son nombres propios y horas, no cambian.
alter table eventos add column if not exists titulo_en text;
alter table eventos add column if not exists descripcion_en text;
alter table eventos add column if not exists precio_en text;
alter table eventos add column if not exists preguntas_frecuentes_en jsonb;
