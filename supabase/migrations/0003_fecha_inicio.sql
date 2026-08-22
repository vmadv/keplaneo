-- Añade el rango de fechas completo a los eventos (antes solo había
-- fecha_fin). Segura de re-ejecutar.

alter table eventos add column if not exists fecha_inicio text;
