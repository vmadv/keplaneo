-- Días de la semana (0=domingo … 6=sábado, igual que Date.getDay()) en que
-- un plan "generico" realmente está disponible — solo se rellena cuando es
-- un patrón semanal fijo (ej. un mercadillo que solo existe los jueves), no
-- para lo que está abierto todos los días. NULL/vacío = sin restricción,
-- se sigue mostrando cualquier día (comportamiento de siempre). Sin esto,
-- un genérico de un solo día a la semana aparecía en "hoy" cualquier día,
-- aunque ese día estuviera cerrado.
alter table eventos add column if not exists dias_semana smallint[];
