-- "Listados" (rankings tipo premio: "Mejores restaurantes de croquetas en
-- Sevilla") — sección totalmente aparte de `eventos`/`planes`. Tres tablas:
-- `lugares` es la ficha estable de un sitio real de Google Places (puede
-- aparecer en más de un listado); `listados` es el ranking en sí; y
-- `listado_lugares` es el cruce con la posición dentro de ESE ranking.
create table if not exists lugares (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  google_place_id text not null,
  tipo text not null default 'restaurante',
  nombre text not null,
  slug text not null,
  direccion text,
  lat double precision,
  lon double precision,
  rating numeric,
  num_valoraciones integer,
  nivel_precio text,
  telefono text,
  web text,
  horario jsonb not null default '[]',
  fotos jsonb not null default '[]',
  descripcion text,
  ultima_actualizacion date not null default current_date,
  activo boolean not null default true,
  unique (municipio_id, google_place_id),
  unique (municipio_id, slug)
);

create table if not exists listados (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  tipo_lugar text not null default 'restaurante',
  slug text not null,
  titulo text not null,
  descripcion text,
  actualizado_en date not null default current_date,
  unique (municipio_id, slug)
);

create table if not exists listado_lugares (
  listado_id uuid not null references listados(id) on delete cascade,
  lugar_id uuid not null references lugares(id) on delete cascade,
  posicion integer not null,
  motivo text,
  primary key (listado_id, lugar_id)
);

alter table lugares enable row level security;
alter table listados enable row level security;
alter table listado_lugares enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lugares' and policyname = 'lectura publica lugares') then
    create policy "lectura publica lugares" on lugares for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listados' and policyname = 'lectura publica listados') then
    create policy "lectura publica listados" on listados for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'listado_lugares' and policyname = 'lectura publica listado_lugares') then
    create policy "lectura publica listado_lugares" on listado_lugares for select using (true);
  end if;
end $$;
