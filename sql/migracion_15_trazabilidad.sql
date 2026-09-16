-- =====================================================================
-- Solicitudes de soporte · GGTIC · CIIP
-- Migración 15: trazabilidad, como en Atlas
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 14.
--
-- De dónde sale esto: Atlas —otro sistema de la casa— tiene una pantalla
-- de "Trazabilidad" para el administrador, con una bitácora que se llena
-- sola en cada cambio y que nadie puede editar ni borrar, ni siquiera él.
-- Aquí se hace lo mismo, pero repartido en dos mecanismos según de dónde
-- sale cada cambio, igual que en Atlas:
--
--   · gtic.solicitudes y gtic.correos_permitidos se tocan siempre con una
--     instrucción de la base (un UPDATE, un INSERT…), venga de donde
--     venga —una función, un PATCH de la bandeja, una migración a mano—.
--     Un disparador ahí lo ve todo sin que nadie tenga que acordarse de
--     avisarle.
--   · Las cuentas de GGTIC NO se tocan así: el nombre, el cargo y el
--     teléfono viven en el user_metadata de auth.users, que ninguna de
--     las dos tablas de arriba conoce, y un disparador sobre
--     gtic.personal se perdería justo esos datos. Por eso esa bitácora
--     la escribe a mano supabase/functions/cuentas/index.ts, que ya tiene
--     el antes y el después completos en memoria cuando actúa.
--   · Los inicios de sesión no son un cambio en ninguna tabla: son la
--     propia persona entrando. Se anotan con una función que ella misma
--     llama al entrar (gtic.registrar_acceso), y que toma el correo del
--     testigo, nunca de lo que mande el navegador.
--
-- Quién la lee: solo administrador (gtic.es_admin(), migración 08), y
-- nadie —ni el administrador— puede insertar, editar ni borrar una fila
-- a mano: no hay políticas para eso, así que RLS lo niega todo. Solo
-- escriben los disparadores (dueños de la tabla, no del navegador) y la
-- Edge Function con la llave de servicio.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · La tabla
-- ---------------------------------------------------------------------
create table if not exists gtic.bitacora (
  id          bigint generated always as identity primary key,
  ocurrido_en timestamptz not null default now(),

  -- quién lo hizo. En blanco cuando el cambio vino de una migración a
  -- mano o de la llave de servicio sin un testigo de por medio: no es un
  -- error, es que de verdad no hay una persona con sesión detrás.
  correo      text,

  operacion   text not null,
  -- qué tabla, o "cuentas"/"sesion" para lo que no vive en una tabla que
  -- el disparador pueda ver directo.
  tabla       text not null,
  -- el correo, el id o el uid de la fila afectada, como texto: las tres
  -- tablas usan una clave distinta y no vale la pena una columna por cada
  -- una.
  entidad_id  text,

  data_previa jsonb,
  data_nueva  jsonb,
  nota        text,

  constraint bitacora_operacion_check
    check (operacion in ('ALTA', 'CAMBIO', 'BAJA', 'ACCESO'))
);

create index if not exists bitacora_ocurrido_idx on gtic.bitacora (ocurrido_en desc);
create index if not exists bitacora_tabla_idx    on gtic.bitacora (tabla);

alter table gtic.bitacora enable row level security;

-- Solo lectura, y solo administrador. Sin políticas de insert/update/
-- delete: nadie puede tocar una fila desde el navegador, ni con este
-- mismo papel. Lo único que escribe es lo de más abajo, que corre con
-- privilegios propios (security definer / service_role), no con los de
-- quien llama.
drop policy if exists bitacora_solo_admin_lee on gtic.bitacora;
create policy bitacora_solo_admin_lee on gtic.bitacora
  for select to authenticated
  using (gtic.es_admin());

grant select on gtic.bitacora to authenticated;
grant usage on schema gtic to service_role;
grant select, insert on gtic.bitacora to service_role;


-- ---------------------------------------------------------------------
-- 2 · El disparador genérico, para las tablas que se tocan siempre con
--     una instrucción de la base
-- ---------------------------------------------------------------------
-- security definer: quien dispara esto no necesita permiso para escribir
-- en la bitácora, la función lo tiene por su cuenta. auth.jwt() lee el
-- testigo de la petición que causó el cambio —la misma transacción—,
-- así que ve a la persona real aunque el disparador corra con otro
-- dueño; si no hay testigo (una migración a mano, la llave de servicio
-- sin testigo), correo queda en blanco a propósito, no en un valor
-- inventado.
create or replace function gtic.registrar_bitacora()
returns trigger
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  v_correo text;
  v_id     text;
begin
  v_correo := nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), '');

  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'uid', to_jsonb(old) ->> 'correo');
    insert into gtic.bitacora (correo, operacion, tabla, entidad_id, data_previa)
      values (v_correo, 'BAJA', tg_table_name, v_id, to_jsonb(old));
    return old;
  elsif tg_op = 'INSERT' then
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'uid', to_jsonb(new) ->> 'correo');
    insert into gtic.bitacora (correo, operacion, tabla, entidad_id, data_nueva)
      values (v_correo, 'ALTA', tg_table_name, v_id, to_jsonb(new));
    return new;
  else
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'uid', to_jsonb(new) ->> 'correo');
    insert into gtic.bitacora (correo, operacion, tabla, entidad_id, data_previa, data_nueva)
      values (v_correo, 'CAMBIO', tg_table_name, v_id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists bitacora_solicitudes on gtic.solicitudes;
create trigger bitacora_solicitudes
  after insert or update or delete on gtic.solicitudes
  for each row execute function gtic.registrar_bitacora();

drop trigger if exists bitacora_correos_permitidos on gtic.correos_permitidos;
create trigger bitacora_correos_permitidos
  after insert or update or delete on gtic.correos_permitidos
  for each row execute function gtic.registrar_bitacora();

-- gtic.personal NO lleva disparador: las altas, cambios de rol y bajas de
-- cuentas de GGTIC ya quedan anotadas por supabase/functions/cuentas —con
-- nombre, cargo y teléfono incluidos, que un disparador aquí no vería—.
-- Ponerle uno también a esta tabla duplicaría cada alta y cada baja.


-- ---------------------------------------------------------------------
-- 3 · Los inicios de sesión
-- ---------------------------------------------------------------------
-- La llama js/bandeja.js justo después de entrar. El correo sale del
-- testigo que Supabase acaba de firmar, no de lo que mande el navegador
-- en el cuerpo de la llamada —no lleva ninguno—, así que nadie puede
-- anotar un acceso a nombre de otro.
create or replace function gtic.registrar_acceso()
returns void
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  v_correo text;
begin
  v_correo := lower(btrim(coalesce(
    auth.jwt() ->> 'email',
    (select email from auth.users where id = auth.uid())
  )));
  if v_correo is null or v_correo = '' then return; end if;

  insert into gtic.bitacora (correo, operacion, tabla, entidad_id, nota)
    values (v_correo, 'ACCESO', 'sesion', v_correo, 'Entró a la bandeja');
end;
$$;

revoke execute on function gtic.registrar_acceso() from public, anon;
grant  execute on function gtic.registrar_acceso() to authenticated;
