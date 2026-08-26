-- Ficha de negocio autogestionada por el propietario, sin cuentas de
-- usuario: cada solicitud es un token de un solo uso enviado por email
-- (ver src/app/api/negocio/*). Nada se publica solo — pasa a `lugares`
-- solo cuando se aprueba desde el email de aviso.
create table if not exists solicitudes_negocio (
  id uuid primary key default gen_random_uuid(),
  lugar_id uuid not null references lugares(id) on delete cascade,
  email text not null,
  token text not null unique,
  estado text not null default 'iniciada'
    check (estado in ('iniciada', 'enviada', 'aprobada', 'rechazada')),
  descripcion_propuesta text,
  telefono_propuesto text,
  web_propuesta text,
  fotos_propuestas jsonb not null default '[]',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists solicitudes_negocio_token_idx on solicitudes_negocio(token);

alter table solicitudes_negocio enable row level security;
-- Sin políticas públicas a propósito: todo pasa por supabaseAdmin desde
-- route handlers (igual que `suscriptores`), nunca directo desde el navegador.

insert into storage.buckets (id, name, public)
values ('fotos-negocios', 'fotos-negocios', true)
on conflict (id) do nothing;
