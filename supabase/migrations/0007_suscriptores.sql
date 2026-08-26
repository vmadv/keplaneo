-- Suscriptores de la newsletter de planes (captura desde el popup del
-- sitio). Sin política pública de lectura NI de inserción a propósito: el
-- popup no escribe directo a Supabase desde el cliente, pasa por
-- /api/suscribirse, que usa la service role key — así ningún email queda
-- expuesto ni es insertable por cualquiera con la anon key.
create table if not exists suscriptores (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  municipio_id uuid not null references municipios(id) on delete cascade,
  frecuencia text not null default 'semanal' check (frecuencia in ('diario', 'semanal', 'finde')),
  confirmado boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (email, municipio_id)
);

alter table suscriptores enable row level security;
