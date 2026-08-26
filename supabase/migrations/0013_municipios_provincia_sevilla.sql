-- Amplía la cobertura a los municipios de la provincia de Sevilla para el
-- MVP de posicionamiento (ver conversación): Utrera, Écija, Carmona, Osuna
-- y Lebrija. Alcalá de Guadaíra, Dos Hermanas, Mairena del Aljarafe y
-- Sevilla ciudad ya existían.
insert into municipios (comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon)
values
  ((select id from comunidades where slug = 'andalucia'), 'utrera', 'Utrera', 'Sevilla', 52000, 65, 37.1858, -5.7797),
  ((select id from comunidades where slug = 'andalucia'), 'ecija', 'Écija', 'Sevilla', 39000, 75, 37.5427, -5.0844),
  ((select id from comunidades where slug = 'andalucia'), 'carmona', 'Carmona', 'Sevilla', 28500, 80, 37.4718, -5.6420),
  ((select id from comunidades where slug = 'andalucia'), 'lebrija', 'Lebrija', 'Sevilla', 27000, 85, 36.9247, -6.0774),
  ((select id from comunidades where slug = 'andalucia'), 'osuna', 'Osuna', 'Sevilla', 17500, 90, 37.2373, -5.1037);
