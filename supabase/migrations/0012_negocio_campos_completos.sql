-- Resto de campos que el propio negocio puede gestionar (horario, nivel de
-- precio, quitar fotos existentes) — se excluyen a propósito nombre,
-- dirección, coordenadas, rating/reseñas y categoría: son el dato
-- verificado con Google Maps que sostiene la confianza de los rankings.
alter table solicitudes_negocio add column if not exists nivel_precio_propuesto text;
alter table solicitudes_negocio add column if not exists horario_propuesto jsonb;
alter table solicitudes_negocio add column if not exists fotos_a_eliminar jsonb not null default '[]';
