-- Coordenadas para el mapa (municipio) y para el geocoder cacheado por
-- evento. Segura de re-ejecutar.

alter table municipios add column if not exists lat double precision;
alter table municipios add column if not exists lon double precision;

alter table eventos add column if not exists lat double precision;
alter table eventos add column if not exists lon double precision;

-- Coordenadas de los municipios piloto ya cargados por seed.sql.
update municipios set lat = 37.3891, lon = -5.9845 where slug = 'sevilla';
update municipios set lat = 37.2823, lon = -5.9198 where slug = 'dos-hermanas';
update municipios set lat = 37.3391, lon = -5.8446 where slug = 'alcala-de-guadaira';
update municipios set lat = 37.3467, lon = -6.0728 where slug = 'mairena-del-aljarafe';
