-- Copia denormalizada de lugares_fotos.foto_nombre directamente en el
-- evento — evita tener que hacer un JOIN por texto (municipio+ubicacion)
-- en cada consulta de listado; es solo una referencia corta, el coste de
-- duplicarla en cada evento que comparte recinto es insignificante.
-- Se recalcula desde lugares_fotos con un UPDATE, no cuesta ninguna
-- llamada a la API.
alter table eventos add column if not exists foto_lugar_nombre text;
