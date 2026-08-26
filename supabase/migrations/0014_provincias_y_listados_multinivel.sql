-- Fase 2 de la reestructuración de rankings (ver conversación): permite que
-- un ranking viva a nivel municipio, provincia, CCAA o nacional, no solo
-- municipio. "provincia" pasa de ser texto suelto a una entidad real con su
-- propio slug/URL.

create table if not exists provincias (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references comunidades(id) on delete cascade,
  slug text not null,
  nombre text not null,
  unique (comunidad_id, slug)
);

alter table provincias enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'provincias' and policyname = 'lectura publica provincias') then
    create policy "lectura publica provincias" on provincias for select using (true);
  end if;
end $$;

alter table municipios add column if not exists provincia_id uuid references provincias(id);

insert into provincias (comunidad_id, slug, nombre)
select id, 'sevilla', 'Sevilla' from comunidades where slug = 'andalucia'
on conflict (comunidad_id, slug) do nothing;

update municipios
set provincia_id = (select id from provincias where slug = 'sevilla')
where comunidad_id = (select id from comunidades where slug = 'andalucia')
  and provincia_id is null;

-- listados: municipio_id deja de ser obligatorio, y se añaden los otros dos
-- niveles posibles. Exactamente una de las tres columnas (o ninguna, para
-- nacional) debe estar rellena — no se fuerza con un CHECK todavía, se
-- confía en que solo se rellene desde el código de generación.
alter table listados alter column municipio_id drop not null;
alter table listados add column if not exists provincia_id uuid references provincias(id) on delete cascade;
alter table listados add column if not exists comunidad_id uuid references comunidades(id) on delete cascade;

-- El unique(municipio_id, slug) original no sirve tal cual con municipio_id
-- nullable (NULL nunca es igual a NULL, así que dejaría duplicar slugs
-- nacionales) — se sustituye por un índice único parcial por nivel.
alter table listados drop constraint if exists listados_municipio_id_slug_key;

create unique index if not exists listados_municipio_slug_uidx
  on listados (municipio_id, slug) where municipio_id is not null;
create unique index if not exists listados_provincia_slug_uidx
  on listados (provincia_id, slug) where provincia_id is not null;
create unique index if not exists listados_comunidad_slug_uidx
  on listados (comunidad_id, slug) where comunidad_id is not null;
create unique index if not exists listados_nacional_slug_uidx
  on listados (slug) where municipio_id is null and provincia_id is null and comunidad_id is null;
