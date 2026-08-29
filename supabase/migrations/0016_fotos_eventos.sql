-- Cartel real del evento (verificado, encontrado con Gemini + búsqueda) —
-- solo para eventos puntuales, ver conversación. NULL si no se encontró
-- ninguno verificable.
alter table eventos add column if not exists cartel_url text;

-- Caché de fotos de lugar (Google Places) por municipio+ubicación, no por
-- evento — así un mismo recinto (un estadio, un museo) que aparece en
-- muchos eventos distintos a lo largo del tiempo solo gasta una búsqueda
-- real la primera vez, nunca más. Se usa como respaldo en miniaturas
-- cuando el evento no tiene cartel (o es un plan genérico sin cartel
-- posible), nunca en la ficha del evento.
create table if not exists lugares_fotos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  ubicacion text not null,
  foto_nombre text,
  creado_en timestamptz not null default now(),
  unique (municipio_id, ubicacion)
);

alter table lugares_fotos enable row level security;
-- Sin políticas públicas: se lee/escribe solo desde supabaseAdmin (route
-- handlers de cron), mismo criterio que el resto de tablas de generación.
