-- Campos adicionales que puede completar el propio negocio (ver
-- solicitudes_negocio / api/negocio) para diferenciar su ficha: redes
-- sociales, enlace de reserva directa y un lema corto propio (distinto de
-- la descripción larga). `gestionado_por_negocio` se activa al aprobar la
-- primera solicitud de ese lugar — es el sello de confianza visible al
-- visitante ("esta ficha la mantiene el propio negocio").
alter table lugares add column if not exists instagram text;
alter table lugares add column if not exists facebook text;
alter table lugares add column if not exists enlace_reserva text;
alter table lugares add column if not exists lema text;
alter table lugares add column if not exists gestionado_por_negocio boolean not null default false;

alter table solicitudes_negocio add column if not exists instagram_propuesto text;
alter table solicitudes_negocio add column if not exists facebook_propuesto text;
alter table solicitudes_negocio add column if not exists enlace_reserva_propuesto text;
alter table solicitudes_negocio add column if not exists lema_propuesto text;
