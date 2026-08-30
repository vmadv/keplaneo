-- Planes de pueblos/zonas cercanas a un municipio pequeño (ej. Mairena del
-- Aljarafe) que no tiene página propia en el sitio, pero que están cerca
-- y no son ninguno de los municipios que sí cubrimos — ver conversación.
-- Cuando están rellenas, la ficha/tarjeta muestra "A X min de {municipio}"
-- en vez de tratarlo como si el plan fuera del propio municipio.
alter table eventos add column if not exists zona_cercana text;
alter table eventos add column if not exists zona_cercana_minutos integer;
