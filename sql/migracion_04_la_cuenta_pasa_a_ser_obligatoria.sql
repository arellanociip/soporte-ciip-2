-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 04: la cuenta pasa a ser obligatoria
-- Se pega en el SQL Editor de Supabase DESPUÉS de la migración 03.
--
-- QUÉ CAMBIA
--
-- Hasta la migración 03 la cuenta era opcional: se podía mandar una
-- solicitud sin entrar, y el seguimiento vivía en el navegador. A partir
-- de aquí no: para pedir soporte hay que identificarse.
--
-- La puerta se cierra AQUÍ y no solo en la página. Esconder el formulario
-- en el navegador no impide nada —una petición se puede armar a mano—, y
-- una regla que solo vive en la pantalla no es una regla.
--
-- LO QUE ESTO IMPLICA, PARA QUE NADIE SE LLEVE LA SORPRESA
--
-- Quien no tenga cuenta no puede pedir soporte por el sistema. Eso
-- incluye:
--
--   · a quien todavía no se haya registrado
--   · a quien olvide su contraseña
--   · a quien tenga el correo mal escrito en gtic.correos_permitidos
--
-- Los tres casos acaban en la misma llamada de teléfono que este sistema
-- vino a sustituir. No es un fallo del diseño: es el precio de exigir
-- identidad, y hay que asumirlo a sabiendas. Conviene tener la lista de
-- correos corregida ANTES de correr esto.
--
-- LO QUE NO CAMBIA
--
-- Las solicitudes que ya existen sin dueño siguen ahí y se pueden
-- consultar por su id, como siempre: cerrar la puerta de entrada no borra
-- lo que ya estaba dentro. Y quien entre por primera vez sigue pudiendo
-- adoptarlas con adoptar_solicitudes() (migración 03).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Sin cuenta no se deja una solicitud
-- ---------------------------------------------------------------------
-- Dos cierres, no uno. El `revoke` quita el permiso de llamar a la
-- función; la comprobación de dentro la deja inútil aunque el permiso
-- vuelva por cualquier vía. Una sola de las dos cosas se olvida o se
-- deshace sin que nadie lo note.
create or replace function gtic.crear_solicitud(
  p_gerencia    text,
  p_usuario     text,
  p_cedula      text default null,
  p_telefono    text default null,
  p_piso        text default null,
  p_oficina     text default null,
  p_cargo       text default null,
  p_descripcion text default null,
  p_tipo        text default null,
  p_detalle     text default null,
  p_renglones   jsonb default '[]'::jsonb
)
returns table(id uuid, numero integer, anio integer, estado text, creada_en timestamptz)
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  fila   gtic.solicitudes;
  previa gtic.solicitudes;
  quien  uuid := auth.uid();
begin
  /* La puerta. PT401 para que el navegador reciba un 401 y sepa que lo que
     falta es identificarse, no que algo se rompió. */
  if quien is null then
    raise exception using
      errcode = 'PT401',
      message = 'Para pedir soporte hay que entrar con tu correo de la casa.';
  end if;

  if btrim(coalesce(p_gerencia, '')) = '' or btrim(coalesce(p_usuario, '')) = ''
     or btrim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Faltan datos obligatorios: gerencia, usuario y descripción.';
  end if;

  /* Una abierta a la vez, ahora siempre por cuenta: el nombre escrito ya no
     hace falta como respaldo, porque sin cuenta no se llega hasta aquí. */
  select * into previa
    from gtic.solicitudes s
   where s.estado in ('recibida', 'en_proceso') and s.solicitante = quien
   order by s.creada_en limit 1;

  if found then
    raise exception using
      errcode = 'PT409',
      message = 'Ya tienes una solicitud abierta: la N° ' ||
                lpad(previa.numero::text, 3, '0') || '-' || previa.anio ||
                '. Cuando GTIC la cierre podrás pedir otra.',
      detail  = json_build_object(
                  'id', previa.id, 'numero', previa.numero,
                  'anio', previa.anio, 'estado', previa.estado)::text;
  end if;

  insert into gtic.solicitudes
    (gerencia, usuario, cedula, telefono, piso, oficina, cargo, descripcion,
     tipo, detalle, renglones, solicitante)
  values
    (p_gerencia, p_usuario, p_cedula, p_telefono, p_piso, p_oficina,
     p_cargo, p_descripcion, p_tipo, p_detalle, coalesce(p_renglones, '[]'::jsonb),
     quien)
  returning * into fila;

  return query select fila.id, fila.numero, fila.anio, fila.estado, fila.creada_en;
end;
$$;

revoke execute on function gtic.crear_solicitud(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from anon;
grant execute on function gtic.crear_solicitud(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

-- Y la puerta de atrás: la política de esquema.sql que dejaba insertar
-- directamente en la tabla sin cuenta. Con la función cerrada pero esto
-- abierto, bastaría con saltarse la función.
drop policy if exists "cualquiera: dejar una solicitud" on gtic.solicitudes;
revoke insert on gtic.solicitudes from anon;


-- ---------------------------------------------------------------------
-- 2. Hablar y retirar, solo el dueño o GTIC
-- ---------------------------------------------------------------------
-- Antes bastaba el id porque no había con qué identificarse. Ahora sí la
-- hay, así que el id deja de ser prueba suficiente: quien lo tuviera de
-- una captura o de un enlace reenviado podría escribir en el hilo de otro.
create or replace function gtic.puede_con(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = gtic, pg_catalog
as $$
  select gtic.es_gtic() or exists (
    select 1 from gtic.solicitudes s
     where s.id = p_id and s.solicitante is not null and s.solicitante = auth.uid());
$$;

grant execute on function gtic.puede_con(uuid) to authenticated;


-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';


-- =====================================================================
-- CÓMO VOLVER ATRÁS
-- =====================================================================
-- Si la cuenta obligatoria resulta ser un estorbo —gente que no puede
-- pedir soporte y acaba llamando— se deshace corriendo otra vez la
-- migración 03, que devuelve crear_solicitud a su versión con cuenta
-- opcional, y luego:
--
--   grant execute on function gtic.crear_solicitud(
--     text, text, text, text, text, text, text, text, text, text, jsonb
--   ) to anon;
--
--   create policy "cualquiera: dejar una solicitud"
--     on gtic.solicitudes for insert to anon
--     with check (estado = 'recibida' and tecnico is null
--                 and observaciones is null and atendida_en is null);
--   grant insert on gtic.solicitudes to anon;
--
-- No hay que tocar nada más: las solicitudes sin dueño nunca se borraron.
-- =====================================================================
