-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 01: lo que le faltaba a esquema.sql para que la nube sirviera
-- de verdad. Se pega en el SQL Editor de Supabase y se corre una sola vez,
-- DESPUÉS de esquema.sql — tanto si el proyecto ya lo tenía corrido como
-- si es uno nuevo.
--
-- Qué arregla:
--
--  1. Faltaban columnas que el formulario y la bandeja ya mandan desde
--     hace rato: `cargo` (de quien pide soporte) y los tres datos del
--     técnico que van impresos junto a su firma. Sin ellas, Supabase
--     rechaza la petición entera con "column not found", así tuviera
--     todo lo demás bien.
--
--  2. Quien pide soporte no tiene cuenta, y a propósito la tabla no le da
--     permiso de LEER — para que no pueda ver la cola de los demás. Pero
--     sin poder leer tampoco puede recibir de vuelta la fila que acaba de
--     escribir, que es como el navegador se entera de su propio número de
--     solicitud. Insertar y devolver el número en el mismo paso, sin
--     abrir la lectura de la tabla entera, es exactamente para lo que
--     sirve una función `security definer`: corre con los permisos de
--     quien es dueño de la tabla, no con los de quien la llama.
--
--     Por lo mismo hace falta una segunda función para el seguimiento:
--     "¿en qué va mi solicitud?", dando el id que solo tiene el navegador
--     de quien la mandó — la misma idea que ya usa servidor.js en la PC.
--
-- Lo que queda pendiente, a propósito: la regla de "una solicitud abierta
-- a la vez" no está replicada aquí todavía (en la PC de la oficina sigue
-- firme). En la nube, por ahora, alguien podría enviar más de una. Avisa
-- si hace falta cerrarlo también.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las columnas que faltaban
-- ---------------------------------------------------------------------
alter table gtic.solicitudes
  add column if not exists cargo             text,
  add column if not exists tecnico_cargo     text,
  add column if not exists tecnico_cedula    text,
  add column if not exists tecnico_telefono  text;

-- ---------------------------------------------------------------------
-- 2. Dejar una solicitud, sin cuenta, y recibir su número al momento
-- ---------------------------------------------------------------------
-- Los parámetros van con el prefijo p_ para que no se puedan confundir con
-- las columnas de la tabla del mismo nombre dentro de esta función.
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
  fila gtic.solicitudes;
begin
  if btrim(coalesce(p_gerencia, '')) = '' or btrim(coalesce(p_usuario, '')) = ''
     or btrim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Faltan datos obligatorios: gerencia, usuario y descripción.';
  end if;

  /* estado, tecnico, observaciones y atendida_en no se reciben como
     parámetro: no hay forma de colarlos por aquí. Toman su valor por
     omisión de la tabla — 'recibida' y nulo —, que es exactamente lo que
     antes exigía la política de inserción que esta función reemplaza. */
  insert into gtic.solicitudes
    (gerencia, usuario, cedula, telefono, piso, oficina, cargo, descripcion, tipo, detalle, renglones)
  values
    (p_gerencia, p_usuario, p_cedula, p_telefono, p_piso, p_oficina,
     p_cargo, p_descripcion, p_tipo, p_detalle, coalesce(p_renglones, '[]'::jsonb))
  returning * into fila;

  return query select fila.id, fila.numero, fila.anio, fila.estado, fila.creada_en;
end;
$$;

grant execute on function gtic.crear_solicitud(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to anon;

-- ---------------------------------------------------------------------
-- 3. Ver en qué va LA PROPIA solicitud, sin cuenta, dando su id
-- ---------------------------------------------------------------------
-- El id es un UUID —122 bits al azar— y es la única prueba de que una
-- solicitud es tuya, la misma idea que servidor.js usa en la PC. Esta
-- función no permite listar ni buscar por número: solo entrega la fila
-- exacta cuyo id se le dio, y nada si ese id no existe.
create or replace function gtic.consultar_solicitud(p_id uuid)
returns table(
  id uuid, numero integer, anio integer, estado text,
  gerencia text, usuario text, cedula text, telefono text, piso text, oficina text,
  descripcion text, tipo text, detalle text, cargo text,
  renglones jsonb, creada_en timestamptz, atendida_en timestamptz,
  tecnico text, tecnico_cargo text, tecnico_cedula text, tecnico_telefono text,
  observaciones text
)
language sql
security definer
set search_path = gtic, pg_catalog
stable
as $$
  select s.id, s.numero, s.anio, s.estado,
         s.gerencia, s.usuario, s.cedula, s.telefono, s.piso, s.oficina,
         s.descripcion, s.tipo, s.detalle, s.cargo,
         s.renglones, s.creada_en, s.atendida_en,
         s.tecnico, s.tecnico_cargo, s.tecnico_cedula, s.tecnico_telefono,
         s.observaciones
    from gtic.solicitudes s
   where s.id = p_id;
$$;

grant execute on function gtic.consultar_solicitud(uuid) to anon;

-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
