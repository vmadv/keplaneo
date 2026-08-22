-- Preguntas frecuentes por plan, basadas solo en sus propios datos.
-- Segura de re-ejecutar.

alter table eventos add column if not exists preguntas_frecuentes jsonb not null default '[]'::jsonb;
