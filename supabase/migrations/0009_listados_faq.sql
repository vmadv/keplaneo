-- Preguntas frecuentes por ranking, en el mismo formato que ya usan los
-- eventos (ver 0005_preguntas_frecuentes.sql) — bueno para contenido único
-- por página y para que los motores de IA puedan citar respuestas concretas.
-- Segura de re-ejecutar.

alter table listados add column if not exists preguntas_frecuentes jsonb not null default '[]'::jsonb;
