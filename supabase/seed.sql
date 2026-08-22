-- Datos de arranque para la fase piloto: Andalucía + Sevilla y 3 municipios
-- cercanos, suficiente para probar el hub de comunidad y el bloque de
-- "municipios cercanos" con más de un resultado.

-- `on conflict do nothing` hace que este script se pueda re-ejecutar sin
-- error si ya se había cargado parte de los datos.

insert into comunidades (slug, nombre)
values ('andalucia', 'Andalucía')
on conflict (slug) do nothing;

insert into municipios (comunidad_id, slug, nombre, provincia, poblacion, prioridad, lat, lon)
select id, 'sevilla', 'Sevilla', 'Sevilla', 688711, 1, 37.3891, -5.9845
from comunidades where slug = 'andalucia'
union all
select id, 'dos-hermanas', 'Dos Hermanas', 'Sevilla', 133369, 50, 37.2823, -5.9198
from comunidades where slug = 'andalucia'
union all
select id, 'alcala-de-guadaira', 'Alcalá de Guadaíra', 'Sevilla', 75000, 60, 37.3391, -5.8446
from comunidades where slug = 'andalucia'
union all
select id, 'mairena-del-aljarafe', 'Mairena del Aljarafe', 'Sevilla', 45000, 70, 37.3467, -6.0728
from comunidades where slug = 'andalucia'
on conflict (comunidad_id, slug) do nothing;
