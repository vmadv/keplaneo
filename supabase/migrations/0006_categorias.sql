-- Temática del plan (conciertos/exposiciones/teatro/monologos/otros), para
-- poder navegar por categoría además de por fecha/audiencia/precio.
-- Segura de re-ejecutar.

alter table eventos add column if not exists categoria text not null default 'otros';
