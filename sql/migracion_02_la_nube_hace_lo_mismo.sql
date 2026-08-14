-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 02: que la nube haga lo mismo que la PC de la oficina
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de migracion_01_solicitudes_sin_cuenta.sql.
--
-- De dónde sale esto:
--
-- servidor.js atiende catorce rutas. El esquema y la migración 01 solo
-- llevaron a la nube dos —dejar una solicitud y consultar la propia—, y
-- eso dejó al sitio de Vercel a medias: la planilla envía, pero no salen
-- las guías de "prueba esto primero", no se puede conversar con el
-- técnico, no se puede retirar lo enviado, y la bandeja se queda sin sus
-- guías ni su inventario.
--
-- Aquí se replica, una por una, cada regla que servidor.js ya aplica. No
-- se inventa nada: donde el servidor recorta a 1000 caracteres, aquí se
-- recorta a 1000; donde responde 409, aquí se levanta un 409.
--
-- Lo que NO se arregla desde aquí, porque no es cosa de la base de datos
-- (ver el final del archivo):
--   · /rest/v1/eventos       los avisos en vivo — hace falta tocar el JS
--   · /rest/v1/rpc/subir_adjunto  las fotos — hace falta Supabase Storage
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Las columnas que aún faltaban en la tabla
-- ---------------------------------------------------------------------
-- `mensajes` es la conversación entre quien pidió y el técnico. En la PC
-- vive dentro de la misma solicitud (un arreglo en el JSON), y aquí igual:
-- son pocos mensajes, siempre se leen junto a su solicitud y nunca por
-- separado, así que una tabla aparte sería más ceremonia que provecho.
--
-- `anulada_por` distingue quién la cerró: si la retiró la propia persona
-- o si fue GTIC. Sale en el seguimiento, para que el mensaje diga la
-- verdad en cada caso.
alter table gtic.solicitudes
  add column if not exists mensajes    jsonb not null default '[]'::jsonb,
  add column if not exists anulada_por text;


-- ---------------------------------------------------------------------
-- 2. Las guías: lo que GTIC ya sabe
-- ---------------------------------------------------------------------
-- La base del conocimiento. Se lee y se escribe solo con cuenta: aquí van
-- las mañas de la casa —a quién llamar, qué clave tiene tal equipo, por
-- dónde se cuelga el sistema— y eso no sale de la gerencia.
create table if not exists gtic.guias (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  categoria      text not null default 'General',
  cuerpo         text not null,
  -- Lo único de la guía que ve quien pide soporte. En blanco, la guía no
  -- sale de GTIC: así lo decide el técnico al escribirla, no un permiso.
  solucion       text,
  -- De qué solicitud salió, cuando sale de una ("003-2026"): sirve para
  -- volver al caso que la originó.
  origen         text,
  autor          text,
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

-- La bandeja las pide ordenadas por lo último que se tocó.
create index if not exists guias_actualizada_idx
  on gtic.guias (actualizada_en desc);

-- servidor.js sella la fecha en cada edición. Que lo haga la base y no el
-- navegador: una fecha que llega de fuera es una fecha que se puede mentir.
create or replace function gtic.guias_sellar()
returns trigger
language plpgsql
set search_path = gtic, pg_catalog
as $$
begin
  new.actualizada_en := now();
  return new;
end;
$$;

drop trigger if exists guias_sellar on gtic.guias;
create trigger guias_sellar
  before update on gtic.guias
  for each row execute function gtic.guias_sellar();

alter table gtic.guias enable row level security;

drop policy if exists "gtic: leer las guias"     on gtic.guias;
drop policy if exists "gtic: escribir las guias" on gtic.guias;
drop policy if exists "gtic: corregir las guias" on gtic.guias;
drop policy if exists "gtic: borrar las guias"   on gtic.guias;

create policy "gtic: leer las guias"
  on gtic.guias for select to authenticated using (true);
create policy "gtic: escribir las guias"
  on gtic.guias for insert to authenticated with check (true);
create policy "gtic: corregir las guias"
  on gtic.guias for update to authenticated using (true) with check (true);
create policy "gtic: borrar las guias"
  on gtic.guias for delete to authenticated using (true);

grant select, insert, update, delete on gtic.guias to authenticated;
-- A `anon` no se le da nada sobre esta tabla, a propósito. Lo que la casa
-- puede ver va por la vista de abajo.


-- ---------------------------------------------------------------------
-- 3. Lo que de una guía sí puede ver la casa
-- ---------------------------------------------------------------------
-- El formulario pide /rest/v1/guias_publicas sin cuenta. Devuelve SOLO el
-- título y el párrafo que el técnico escribió pensando en quien pide
-- —nunca el `cuerpo`, donde están las mañas internas— y solo de las guías
-- que lo tengan.
--
-- Es una vista aparte y no un filtro sobre la tabla a propósito, igual que
-- en servidor.js: así lo que sale de la gerencia se decide en un solo
-- sitio y se lee de un vistazo.
--
-- `security_invoker = false` es lo que hace que funcione: la vista se
-- consulta con los permisos de quien es su dueño, no con los de `anon`.
-- Por eso puede leer una tabla que `anon` tiene vedada, y por eso mismo la
-- vista no expone ni una columna de más.
create or replace view gtic.guias_publicas as
  select g.id, g.titulo, g.categoria, g.solucion
    from gtic.guias g
   where btrim(coalesce(g.solucion, '')) <> '';

alter view gtic.guias_publicas set (security_invoker = false);

grant select on gtic.guias_publicas to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. El inventario que GTIC va completando
-- ---------------------------------------------------------------------
-- Leerlo es público, como el cuadro que ya viaja en js/inventario.js: son
-- los equipos de la casa, y el formulario los necesita para mandar el
-- serial sin que nadie lo escriba de memoria. Agregar es solo con cuenta:
-- esto acaba impreso en una Hoja de Servicio.
--
-- La llave es (nombre, equipo) porque así lo trata servidor.js: si esa
-- persona ya tenía ese mismo tipo de equipo apuntado, se corrige en vez de
-- duplicarse. Nadie quiere dos CPU para el mismo puesto porque el serial
-- se escribió mal la primera vez.
create table if not exists gtic.inventario (
  nombre text not null,
  equipo text not null,
  marca  text,
  modelo text,
  serial text,
  quien  text,
  en     timestamptz not null default now(),
  primary key (nombre, equipo)
);

-- La bandeja manda un POST llano, sin pedir "upsert". Para que se comporte
-- como el servidor de la casa —reemplazar en vez de estrellarse contra la
-- llave— la fila vieja se retira justo antes de entrar la nueva.
create or replace function gtic.inventario_reemplaza()
returns trigger
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
begin
  delete from gtic.inventario i
   where i.nombre = new.nombre and i.equipo = new.equipo;
  return new;
end;
$$;

drop trigger if exists inventario_reemplaza on gtic.inventario;
create trigger inventario_reemplaza
  before insert on gtic.inventario
  for each row execute function gtic.inventario_reemplaza();

alter table gtic.inventario enable row level security;

drop policy if exists "cualquiera: ver el inventario" on gtic.inventario;
drop policy if exists "gtic: apuntar un equipo"       on gtic.inventario;

create policy "cualquiera: ver el inventario"
  on gtic.inventario for select to anon, authenticated using (true);
create policy "gtic: apuntar un equipo"
  on gtic.inventario for insert to authenticated with check (true);

grant select on gtic.inventario to anon, authenticated;
grant insert on gtic.inventario to authenticated;


-- ---------------------------------------------------------------------
-- 5. Una solicitud abierta a la vez
-- ---------------------------------------------------------------------
-- La regla que la migración 01 dejó pendiente a propósito. En la PC de la
-- oficina lleva firme desde el principio: mientras GTIC no cierre lo que
-- pediste, no puedes pedir otra cosa. Sin esto, en la nube una misma
-- persona podía llenar la cola.
--
-- El nombre se compara normalizado igual que en servidor.js: sin espacios
-- de sobra y sin distinguir mayúsculas, porque "MARIA  RODRIGUEZ" y "María
-- Rodríguez" son la misma persona escribiendo con prisa.
--
-- El `PT409` no es un número al azar: PostgREST traduce cualquier SQLSTATE
-- que empiece por PT al código HTTP de sus tres dígitos. Así el navegador
-- recibe un 409 —"choca con algo que ya existe"— y no un 500, que es lo
-- que le haría creer que fue una falla y que conviene reintentar.
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
begin
  if btrim(coalesce(p_gerencia, '')) = '' or btrim(coalesce(p_usuario, '')) = ''
     or btrim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Faltan datos obligatorios: gerencia, usuario y descripción.';
  end if;

  select * into previa
    from gtic.solicitudes s
   where s.estado in ('recibida', 'en_proceso')
     and lower(btrim(regexp_replace(s.usuario,  '\s+', ' ', 'g')))
       = lower(btrim(regexp_replace(p_usuario, '\s+', ' ', 'g')))
   order by s.creada_en
   limit 1;

  if found then
    raise exception using
      errcode = 'PT409',
      message = 'Ya tienes una solicitud abierta: la N° ' ||
                lpad(previa.numero::text, 3, '0') || '-' || previa.anio ||
                '. Cuando GTIC la cierre podrás pedir otra.',
      /* La solicitud que ya existe, para que el navegador pueda anotarla y
         seguirla desde el panel sin tener que preguntarla otra vez. Va en
         `detail` porque es el único campo por el que PostgREST deja pasar
         algo propio junto al error. */
      detail  = json_build_object(
                  'id', previa.id, 'numero', previa.numero,
                  'anio', previa.anio, 'estado', previa.estado)::text;
  end if;

  /* estado, tecnico, observaciones y atendida_en no se reciben como
     parámetro: no hay forma de colarlos por aquí. */
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
-- 6. Consultar la propia solicitud: ahora con la conversación
-- ---------------------------------------------------------------------
-- La de la migración 01 devolvía una lista fija de columnas, y `mensajes` y
-- `anulada_por` no existían todavía. Sin ellas, quien pidió soporte no ve
-- lo que el técnico le escribió ni se entera de quién cerró su solicitud.
--
-- Cambia lo que devuelve, así que hay que retirarla antes: un CREATE OR
-- REPLACE no puede cambiarle el tipo de retorno a una función.
drop function if exists gtic.consultar_solicitud(uuid);

create function gtic.consultar_solicitud(p_id uuid)
returns table(
  id uuid, numero integer, anio integer, estado text,
  gerencia text, usuario text, cedula text, telefono text, piso text, oficina text,
  descripcion text, tipo text, detalle text, cargo text,
  renglones jsonb, creada_en timestamptz, atendida_en timestamptz,
  tecnico text, tecnico_cargo text, tecnico_cedula text, tecnico_telefono text,
  observaciones text, anulada_por text, mensajes jsonb
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
         s.observaciones, s.anulada_por, s.mensajes
    from gtic.solicitudes s
   where s.id = p_id;
$$;

grant execute on function gtic.consultar_solicitud(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Hablar con el técnico
-- ---------------------------------------------------------------------
-- Los dos lados del hilo entran por aquí: quien pidió soporte —sin cuenta,
-- probando con el id imposible de adivinar— y el técnico, ya identificado.
-- Quién habla no lo dice el navegador: lo decide esta función mirando si la
-- petición trae una sesión. Así nadie puede escribir haciéndose pasar por
-- otro, y quien pide sigue sin necesitar cuenta.
--
-- Los parámetros van SIN el prefijo p_ de las otras funciones. No es un
-- descuido: js/solicitud.js y js/bandeja.js ya mandan {id, texto,
-- adjuntos}, y PostgREST busca la función por el nombre exacto de lo que
-- le llega. Con p_ delante, respondería 404 aunque la función exista.
create or replace function gtic.enviar_mensaje(
  id       uuid,
  texto    text  default '',
  adjuntos jsonb default '[]'::jsonb
)
returns setof jsonb
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  s        gtic.solicitudes;
  claims   jsonb;
  limpio   text;
  traidos  jsonb;
  de       text;
  nombre   text;
  msg      jsonb;
  porque   text;
begin
  limpio := left(btrim(coalesce(enviar_mensaje.texto, '')), 1000);

  /* Lo que llega de un navegador no se guarda tal cual. servidor.js
     comprueba que el archivo exista de verdad en datos/adjuntos/; aquí el
     equivalente es exigir que la dirección apunte al depósito de esta misma
     casa. Sin ese filtro, cualquiera podría colar en una burbuja un enlace
     a donde quisiera, y el chat lo mostraría como si fuera una foto suya.

     Y se reconstruye el objeto campo por campo —los cuatro que la burbuja
     usa, recortados— en vez de guardar lo que vino: así nada de más entra
     a la conversación. Cuatro por mensaje, como en la PC. */
  select coalesce(jsonb_agg(t.valor order by t.orden), '[]'::jsonb) into traidos
    from (
      select jsonb_build_object(
               'url',    e.valor ->> 'url',
               'nombre', left(coalesce(e.valor ->> 'nombre', ''), 120),
               'tipo',   coalesce(e.valor ->> 'tipo', ''),
               'tamano', case when e.valor ->> 'tamano' ~ '^[0-9]+$'
                              then (e.valor ->> 'tamano')::bigint else 0 end
             ) as valor,
             e.orden
        from jsonb_array_elements(
               case when jsonb_typeof(coalesce(enviar_mensaje.adjuntos, '[]'::jsonb)) = 'array'
                    then enviar_mensaje.adjuntos else '[]'::jsonb end
             ) with ordinality as e(valor, orden)
       where jsonb_typeof(e.valor) = 'object'
         and e.valor ->> 'url' like '%/storage/v1/object/public/adjuntos/%'
       order by e.orden
       limit 4
    ) t;

  /* Un mensaje puede ser solo una foto: "mira cómo quedó la pantalla" no
     necesita texto. Lo que no puede es venir vacío del todo. */
  if limpio = '' and jsonb_array_length(traidos) = 0 then
    raise exception using errcode = 'PT400', message = 'El mensaje viene vacío.';
  end if;

  select * into s from gtic.solicitudes x where x.id = enviar_mensaje.id;
  if not found then
    raise exception using errcode = 'PT404', message = 'No existe esa solicitud.';
  end if;

  /* Se habla mientras se atiende, y solo entonces. Antes de que un técnico
     la tome no hay con quién hablar; después de cerrarla, lo que quede por
     decir va en las observaciones, que sí salen impresas en la hoja. La
     regla vive aquí y no solo en la página: los botones se pueden esquivar. */
  if s.estado <> 'en_proceso' then
    porque := case s.estado
                when 'recibida' then 'Todavía no la ha tomado ningún técnico.'
                when 'anulada'  then 'Esa solicitud está anulada.'
                else 'Esa solicitud ya fue atendida.'
              end;
    raise exception using
      errcode = 'PT409',
      message = porque || ' La conversación solo está abierta mientras se atiende.';
  end if;

  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  if coalesce(claims ->> 'role', 'anon') = 'authenticated' then
    de     := 'gtic';
    nombre := coalesce(
                nullif(btrim(coalesce(claims -> 'user_metadata' ->> 'nombre', '')), ''),
                claims ->> 'email',
                'GTIC');
  else
    de     := 'usuario';
    nombre := s.usuario;
  end if;

  msg := jsonb_build_object(
           'de', de, 'nombre', nombre, 'texto', limpio,
           'en', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if jsonb_array_length(traidos) > 0 then
    msg := msg || jsonb_build_object('adjuntos', traidos);
  end if;

  /* Cien mensajes por solicitud son de sobra; más es una conversación que
     debería estar pasando por teléfono. */
  update gtic.solicitudes x
     set mensajes = (
           select coalesce(jsonb_agg(t.valor order by t.orden), '[]'::jsonb)
             from (
               select e.valor, e.orden
                 from jsonb_array_elements(x.mensajes || jsonb_build_array(msg))
                        with ordinality as e(valor, orden)
                order by e.orden
               offset greatest(jsonb_array_length(x.mensajes) + 1 - 100, 0)
             ) t)
   where x.id = enviar_mensaje.id;

  return query select msg;
end;
$$;

grant execute on function gtic.enviar_mensaje(uuid, text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. Retirar la propia solicitud
-- ---------------------------------------------------------------------
-- Uno se equivoca al escribir, o resuelve el problema solo, y con la regla
-- de una a la vez se quedaría bloqueado esperando a que GTIC cierre algo
-- que ya no hace falta. Aquí puede retirarla.
--
-- La prueba de que es suya es el mismo id imposible de adivinar que sirve
-- para consultarla. Y solo mientras nadie la haya tomado: si ya está en
-- proceso, hay un técnico trabajando y borrarla por detrás sería dejarlo
-- atendiendo un caso que en el sistema no existe.
create or replace function gtic.retirar_solicitud(id uuid)
returns setof jsonb
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  s gtic.solicitudes;
begin
  select * into s from gtic.solicitudes x where x.id = retirar_solicitud.id;
  if not found then
    raise exception using errcode = 'PT404', message = 'No existe esa solicitud.';
  end if;

  if s.estado <> 'recibida' then
    raise exception using
      errcode = 'PT409',
      message = case s.estado
                  when 'en_proceso' then 'Un técnico ya la tomó. Habla con GTIC para cerrarla.'
                  else 'Esa solicitud ya no está abierta.'
                end;
  end if;

  update gtic.solicitudes x
     set estado = 'anulada', anulada_por = 'usuario'
   where x.id = retirar_solicitud.id
  returning * into s;

  return query select jsonb_build_object(
    'id', s.id, 'numero', s.numero, 'anio', s.anio, 'estado', s.estado);
end;
$$;

grant execute on function gtic.retirar_solicitud(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 9. El depósito de las fotos y los PDF
-- ---------------------------------------------------------------------
-- En la PC los archivos se guardan en datos/adjuntos/ y los sirve el mismo
-- servidor. En la nube van a Storage, que es un depósito aparte con su
-- propia dirección; js/adjuntos.js ya sabe subir contra los dos.
--
-- El depósito es público de lectura para que una foto se vea dentro de la
-- burbuja del chat sin pedir permiso en cada imagen. Que sea público NO
-- significa que se pueda husmear: listar lo que hay dentro exige un
-- permiso de lectura sobre storage.objects que aquí no se da a nadie, así
-- que a un archivo solo se llega sabiendo su dirección completa —la
-- carpeta es el id de la solicitud, que es un UUID, y el nombre son otros
-- 32 caracteres al azar—.
--
-- El tope de 8 MB y la lista de tipos permitidos no son adorno: son lo que
-- sustituye a la comprobación que sí hace servidor.js (ver la nota al
-- final).
-- Esta parte va envuelta y con red, y no por adorno: el SQL Editor de
-- Supabase corre TODO el archivo en una sola transacción, así que un fallo
-- aquí abajo se lleva por delante las ocho secciones de arriba, que no
-- tienen nada que ver. Y fallar es posible: storage.objects no pertenece a
-- `postgres` sino a `supabase_storage_admin`, y crear una política sobre
-- una tabla ajena exige ser su dueño.
--
-- Si algo de esto no pasa, el archivo NO se cae: avisa por consola y sigue.
-- Lo que quede sin hacer se arregla en dos clics desde el panel:
--   Storage → New bucket → nombre `adjuntos`, marcarlo Public,
--             tope 8 MB, tipos image/jpeg, image/png, application/pdf
--   Storage → Policies → permitir INSERT a anon y authenticated
-- Todo lo demás de la migración funciona igual sin esto; lo único que se
-- queda esperando es el botón de adjuntar una foto al chat.
do $deposito$
begin
  begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('adjuntos', 'adjuntos', true, 8388608,
            array['image/jpeg', 'image/png', 'application/pdf'])
    on conflict (id) do update
      set public             = excluded.public,
          file_size_limit    = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
    raise notice 'Depósito `adjuntos` listo.';
  /* Se atrapa cualquier cosa, a conciencia: da igual POR QUÉ no se pudo
     —que falte el esquema, que la tabla sea de otro dueño, que Supabase
     cambie sus columnas—. Esta sección es opcional y jamás debe tumbar las
     ocho de arriba. El motivo exacto sale impreso, así que nada se oculta. */
  exception when others then
    raise notice 'No se pudo crear el depósito `adjuntos` desde aquí (%). Créalo en el panel: Storage → New bucket.', sqlerrm;
  end;

  begin
    execute $p$drop policy if exists "cualquiera: subir un adjunto" on storage.objects$p$;
    execute $p$create policy "cualquiera: subir un adjunto"
              on storage.objects for insert to anon, authenticated
              with check (bucket_id = 'adjuntos')$p$;
    raise notice 'Permiso de subida al depósito `adjuntos` puesto.';
  exception when others then
    raise notice 'No se pudo poner el permiso de subida desde aquí (%). Ponlo en el panel: Storage → Policies.', sqlerrm;
  end;
end;
$deposito$;


-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';


-- =====================================================================
-- Lo que queda fuera de este archivo, y por qué
-- =====================================================================
--
-- 1. LOS AVISOS AL INSTANTE  ·  /rest/v1/eventos
--
--    servidor.js deja una respuesta abierta para siempre y empuja por ahí
--    un aviso cada vez que algo cambia. Eso es un truco de servidor (SSE)
--    y la base de datos no lo puede imitar: Supabase tiene lo suyo,
--    Realtime, que habla por otro camino (WebSocket) y pediría traerse una
--    librería que este proyecto no usa en ninguna parte.
--
--    En vez de eso, las dos páginas preguntan cada quince segundos cuando
--    no hay línea abierta —la planilla ya lo hacía; a la bandeja se le
--    puso ahora, que era lo que de verdad faltaba—. La diferencia con la
--    PC de la oficina es de segundos, no de funcionamiento: una solicitud
--    nueva aparece sola, con su aviso y su sonido, sin tocar nada.
--
-- 2. QUIÉN PUEDE SUBIR UN ARCHIVO
--
--    servidor.js exige que la solicitud exista y no esté anulada antes de
--    aceptar una foto. Storage no puede consultar eso: recibe el archivo
--    por su propia puerta, sin pasar por ninguna función de aquí.
--
--    Lo que sí lo acota: el depósito solo acepta JPG, PNG y PDF, y nada de
--    más de 8 MB (punto 9 más arriba). Y aunque alguien suba algo suelto,
--    no entra a ninguna conversación: enviar_mensaje solo guarda adjuntos
--    cuya dirección apunte a este mismo depósito, y reconstruye el objeto
--    campo por campo antes de dejarlo en el hilo.
--
-- 3. EL FRENO CONTRA EL LLENADO DE LA COLA  ·  429
--
--    servidor.js cuenta cuántas solicitudes entraron desde una misma
--    máquina en la última hora y corta si son demasiadas. Postgres no ve
--    de qué equipo viene la petición —eso lo sabe la capa de red, no la
--    base—, así que la regla no se puede replicar aquí.
--
--    Lo que sí quedó puesto es la de "una abierta a la vez" (punto 5 más
--    arriba), que tapa el caso corriente: una persona no puede acumular
--    solicitudes. Contra un guión decidido haría falta el limitador de
--    Supabase o el de Vercel, que se configuran en sus paneles.
--
-- 4. LAS CUENTAS DE GTIC
--
--    /auth/v1/token y /auth/v1/user los atiende Supabase Auth por su
--    cuenta; no hay nada que crear aquí. Pero las cuentas que hoy viven
--    en datos/usuarios.json NO se copian solas: hay que darlas de alta en
--    el panel de Supabase (Authentication → Users). El nombre y el cargo
--    que salen impresos junto a la firma van en el user_metadata, que es
--    de donde los lee la función enviar_mensaje de más arriba.
-- =====================================================================
