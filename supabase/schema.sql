-- Planes España — esquema mínimo
-- Ejecutar en el SQL editor de Supabase (Project > SQL Editor).

create extension if not exists "pgcrypto";

create table comunidades (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null
);

create table municipios (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references comunidades(id) on delete cascade,
  slug text not null,
  nombre text not null,
  provincia text,
  poblacion integer,
  -- menor número = mayor prioridad de escalado (ciudades grandes primero)
  prioridad integer not null default 100,
  -- centro aproximado del municipio, para el mapa y la temperatura de hoy.
  lat double precision,
  lon double precision,
  unique (comunidad_id, slug)
);

-- Eventos puntuales con página propia y URL estable. Se identifican por
-- slug (derivado del título) dentro de un municipio: mientras el evento
-- siga apareciendo en la agenda generada, se actualiza esta misma fila en
-- vez de crear una nueva — así la página no cambia de URL cada día que
-- dura el evento. `activo` pasa a false el primer día que deja de
-- detectarse (el evento ya terminó), pero la fila y la URL se conservan.
create table eventos (
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
  fecha_inicio text,
  fecha_fin text,
  fuente text,
  -- array de {pregunta, respuesta}, basadas solo en los demás campos del
  -- mismo plan (nunca datos nuevos) para minimizar el riesgo de invención.
  preguntas_frecuentes jsonb not null default '[]'::jsonb,
  -- temática (conciertos/exposiciones/teatro/monologos/otros) — permite
  -- navegar por categoría además de por fecha/audiencia/precio.
  categoria text not null default 'otros',
  -- puntuación de atractivo (1-10) que asigna Gemini al generar/actualizar
  -- el plan — ordena los listados largos por interés real, no alfabético.
  -- Nullable: los eventos existentes no la tienen hasta que se regeneran.
  relevancia smallint,
  -- geocodificadas una sola vez a partir de "ubicacion" (Nominatim/OSM),
  -- cacheadas aquí para no volver a llamar al geocoder en cada generación.
  lat double precision,
  lon double precision,
  primera_deteccion date not null,
  ultima_deteccion date not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (municipio_id, slug)
);

create table planes (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  fecha_generacion date not null,
  titulo text not null,
  descripcion text not null,
  momento text not null check (momento in ('dia', 'noche')),
  -- 'hoy' | 'finde' | slug de mes ('julio', 'agosto', ...)
  vigencia text[] not null,
  -- 'pareja' | 'familia' | 'generico'
  audiencia text[] not null,
  tipo text not null check (tipo in ('excepcional', 'generico')),
  -- si el plan es "excepcional" y tiene página propia, apunta a esa fila.
  evento_id uuid references eventos(id) on delete set null,
  enlace_afiliado text,
  fuente text,
  created_at timestamptz not null default now()
);

create index planes_municipio_fecha_idx on planes (municipio_id, fecha_generacion);
create index planes_vigencia_idx on planes using gin (vigencia);
create index planes_audiencia_idx on planes using gin (audiencia);

create table generation_log (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references municipios(id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('ok', 'error')),
  tokens_input integer,
  tokens_output integer,
  coste_estimado numeric(10, 4),
  error_mensaje text,
  created_at timestamptz not null default now()
);

-- Lectura pública para las tablas de contenido; escritura solo desde el
-- service role key (usada exclusivamente en los route handlers de cron,
-- nunca en el navegador).
alter table comunidades enable row level security;
alter table municipios enable row level security;
alter table eventos enable row level security;
alter table planes enable row level security;
alter table generation_log enable row level security;

create policy "lectura publica comunidades" on comunidades for select using (true);
create policy "lectura publica municipios" on municipios for select using (true);
create policy "lectura publica eventos" on eventos for select using (true);
create policy "lectura publica planes" on planes for select using (true);
-- generation_log no lleva policy de select: no es pública, solo se lee
-- desde el panel de Supabase o con la service role key.
