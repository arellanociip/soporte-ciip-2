-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Esquema completo. Se pega tal cual en el SQL Editor de Supabase y se
-- ejecuta una sola vez, en un proyecto nuevo y vacío.
--
-- La idea en una línea: cualquiera en la casa puede DEJAR una solicitud sin
-- tener cuenta; solo el personal de GTIC, ya identificado, puede LEERLAS y
-- atenderlas.
-- =====================================================================

create schema if not exists gtic;

-- ---------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------
-- Refleja la Hoja de Servicio en papel, separada en dos mitades:
--   · lo que llena quien pide      (gerencia … descripcion)
--   · lo que llena GTIC al atender (tecnico … observaciones)
-- Los renglones de equipo van en jsonb: en el Excel eran seis filas fijas de
-- las que casi siempre se usaba una, y una tabla aparte para eso sería más
-- ceremonia que provecho.
create table if not exists gtic.solicitudes (
  id            uuid primary key default gen_random_uuid(),

  -- Número correlativo del año, el "N° GTIC-HS/" de la hoja. Lo pone el
  -- servidor (ver el disparador más abajo), nunca el navegador: si lo
  -- calculara el cliente, dos personas que enviaran a la vez se pisarían.
  numero        integer not null,
  anio          integer not null default extract(year from (now() at time zone 'America/Caracas')),

  -- ---- lo que llena quien pide el soporte ----
  gerencia      text not null,
  usuario       text not null,
  cedula        text,
  telefono      text,
  piso          text,
  oficina       text,
  descripcion   text not null,
  tipo          text,   -- ASISTENCIA | SOPORTE_TECNICO
  detalle       text,   -- una de las opciones que cuelgan del tipo

  -- ---- lo que llena GTIC al atender ----
  estado        text not null default 'recibida',
  tecnico       text,
  observaciones text,
  renglones     jsonb not null default '[]'::jsonb,  -- [{tipo,detalle,equipo,marca,modelo,serial}]
  atendida_en   timestamptz,

  creada_en     timestamptz not null default now(),

  constraint solicitudes_estado_check
    check (estado in ('recibida', 'en_proceso', 'atendida', 'anulada')),
  constraint solicitudes_tipo_check
    check (tipo is null or tipo in ('ASISTENCIA', 'SOPORTE_TECNICO')),
  -- Un correlativo no se repite dentro del mismo año.
  constraint solicitudes_numero_anio_unico unique (anio, numero)
);

-- Lo que la bandeja pide siempre: las pendientes, primero las más recientes.
create index if not exists solicitudes_estado_idx  on gtic.solicitudes (estado, creada_en desc);
create index if not exists solicitudes_creada_idx  on gtic.solicitudes (creada_en desc);

-- ---------------------------------------------------------------------
-- El correlativo
-- ---------------------------------------------------------------------
-- Numera 1, 2, 3… dentro de cada año y vuelve a 1 en enero, igual que la
-- numeración a mano de las hojas. Va en un disparador BEFORE INSERT para que
-- el número lo asigne el servidor en el mismo instante de la escritura.
--
-- El lock de asesoría serializa a los que insertan en el mismo año: sin él,
-- dos envíos simultáneos leerían el mismo max(numero) y ambos pedirían el
-- mismo correlativo — uno se estrellaría contra la restricción de unicidad y
-- esa solicitud se perdería. Con él, el segundo espera su turno y toma el
-- siguiente. El lock se suelta solo al cerrar la transacción.
create or replace function gtic.asignar_numero()
returns trigger
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
begin
  if new.anio is null then
    new.anio := extract(year from (now() at time zone 'America/Caracas'));
  end if;

  perform pg_advisory_xact_lock(hashtext('gtic.solicitudes'), new.anio);

  select coalesce(max(numero), 0) + 1
    into new.numero
    from gtic.solicitudes
   where anio = new.anio;

  return new;
end;
$$;

drop trigger if exists solicitudes_numero on gtic.solicitudes;
create trigger solicitudes_numero
  before insert on gtic.solicitudes
  for each row execute function gtic.asignar_numero();

-- ---------------------------------------------------------------------
-- Quién puede hacer qué
-- ---------------------------------------------------------------------
alter table gtic.solicitudes enable row level security;

-- Cualquiera, sin cuenta: dejar una solicitud. Nada más.
-- Sin política de SELECT para anon, así que ni siquiera puede releer la fila
-- que acaba de escribir (por eso el formulario pide el número con "Prefer:
-- return=representation" dentro de la misma llamada de inserción, que es lo
-- único que el servidor le devuelve).
create policy "cualquiera: dejar una solicitud"
  on gtic.solicitudes for insert to anon
  with check (
    -- El estado inicial no se negocia desde el navegador: entra como recibida.
    estado = 'recibida'
    -- Y nadie se autoasigna un cierre al enviar.
    and tecnico is null
    and observaciones is null
    and atendida_en is null
  );

-- GTIC, ya identificado: ver y atender todo.
create policy "gtic: ver las solicitudes"
  on gtic.solicitudes for select to authenticated using (true);
create policy "gtic: atender las solicitudes"
  on gtic.solicitudes for update to authenticated using (true) with check (true);

-- Los permisos de tabla van aparte de las políticas: RLS decide sobre cuáles
-- filas, y estos GRANT deciden si el rol puede tocar la tabla siquiera.
grant usage on schema gtic to anon, authenticated;
grant insert on gtic.solicitudes to anon;
grant select, insert, update on gtic.solicitudes to authenticated;

-- ---------------------------------------------------------------------
-- Exponer el esquema por la API
-- ---------------------------------------------------------------------
-- Supabase solo publica los esquemas que le digas. Falta un paso que NO se
-- hace desde aquí:
--   Panel → Project Settings → API → "Exposed schemas" → agregar  gtic
-- Sin eso, todas las llamadas responden 404 aunque la tabla exista.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Después de esto: sql/migracion_01_solicitudes_sin_cuenta.sql
-- ---------------------------------------------------------------------
-- Este archivo quedó corto frente a lo que el formulario y la bandeja ya
-- mandan (faltan columnas, y falta cómo dejar una solicitud sin abrirle a
-- `anon` la lectura de la tabla). Corre también esa migración, en
-- cualquier proyecto, nuevo o ya puesto en marcha.
