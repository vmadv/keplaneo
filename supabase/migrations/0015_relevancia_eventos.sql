-- Puntuación de atractivo (1-10) que Gemini asigna a cada plan al
-- generarlo/actualizarlo, para poder ordenar los listados largos (ej. "todo
-- lo que puedes hacer todo el año") por interés real en vez de alfabético.
-- Nullable: los eventos ya existentes no la tendrán hasta que se regeneren.
-- Segura de re-ejecutar.

alter table eventos add column if not exists relevancia smallint;
