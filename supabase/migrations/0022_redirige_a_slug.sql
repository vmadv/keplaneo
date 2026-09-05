-- Cuando dos eventos activos resultan ser el mismo real (duplicados
-- detectados por scripts/revision-planes/detectar-duplicados.js), el que se
-- desactiva ("Quitar") puede llevar aquí el slug del que sobrevive — su
-- página deja de servir un 404/contenido obsoleto y en su lugar hace un
-- 308 permanente (permanentRedirect) hacia el superviviente, conservando
-- cualquier backlink/indexación que tuviera. NULL = desactivado sin
-- sustituto (caso normal, evento que ya no existe de verdad).
alter table eventos add column redirige_a_slug text;
