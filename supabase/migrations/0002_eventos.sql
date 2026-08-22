-- Migración para bases de datos que ya corrieron schema.sql antes de que
-- existiera la tabla `eventos`. Segura de re-ejecutar (usa if not exists).

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  slug text not null,
  titulo text not null,
  descripcion text not null,
  momento text not null check (momento in ('dia', 'noche')),
  audiencia text[] not null,
  ubicacion text,
  horario text,
  precio text,
  fecha_fin text,
  fuente text,
  primera_deteccion date not null,
  ultima_deteccion date not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (municipio_id, slug)
);

alter table planes add column if not exists evento_id uuid references eventos(id) on delete set null;

alter table eventos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'eventos' and policyname = 'lectura publica eventos'
  ) then
    create policy "lectura publica eventos" on eventos for select using (true);
  end if;
end $$;
