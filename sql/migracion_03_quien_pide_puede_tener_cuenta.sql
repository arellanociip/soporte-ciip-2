-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 03: quien pide soporte también puede tener cuenta
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql, de la migración 01 y de la 02.
--
-- QUÉ RESUELVE
--
-- El seguimiento de una solicitud vive hoy en el navegador de quien la
-- mandó: es lo que dice la propia página, "esto se guarda en este
-- navegador". Quien cambia de equipo —o le limpian el suyo— pierde el
-- rastro de lo que pidió, aunque la solicitud siga viva en la cola.
--
-- Con cuenta, el rastro deja de ser del navegador y pasa a ser de la
-- persona. Entra desde donde sea y ve lo suyo.
--
-- SEGUIR SIN CUENTA SIGUE SIENDO POSIBLE, Y ES LO IMPORTANTE
--
-- Nada de esto vuelve obligatoria la cuenta. Quien no la tenga manda su
-- solicitud igual que hasta ahora y la sigue por el id de siempre. Una
-- clave olvidada no puede dejar a nadie sin poder pedir ayuda: entonces
-- llamaría por teléfono, que es justo lo que este sistema vino a
-- sustituir.
--
-- ================= LO QUE HAY QUE ENTENDER ANTES DE CORRER ESTO ======
--
-- Hasta hoy, en este esquema `authenticated` significaba "es de GTIC".
-- Por eso esquema.sql dice, tal cual:
--
--     grant select, insert, update on gtic.solicitudes to authenticated;
--     create policy "gtic: ver las solicitudes"
--       on gtic.solicitudes for select to authenticated using (true);
--
-- En cuanto quien pide soporte pueda entrar, ese supuesto DEJA DE SER
-- CIERTO: pasaría a ser `authenticated` también. Con las reglas de arriba
-- sin tocar, cualquiera de las 224 personas de la casa podría leer la
-- cola entera y cambiar solicitudes ajenas. Y las guías son peores: ahí
-- se anotan a propósito las mañas internas —claves de equipos, a quién
-- llamar—, y hoy las puede leer cualquier `authenticated`.
--
-- Así que esta migración no "añade un login": rehace quién puede qué.
-- Ser de GTIC pasa a ser una cosa explícita —estar en gtic.personal— y
-- no un efecto secundario de tener cuenta.
--
-- POR QUÉ UNA TABLA Y NO UNA MARCA EN EL PERFIL
--
-- La tentación es poner {"gtic": true} en el user_metadata. No sirve:
-- ese campo lo puede cambiar la propia persona con una llamada a
-- /auth/v1/user, así que cualquiera se ascendería a GTIC en un minuto.
-- Una tabla que solo escribe el administrador no se puede falsificar
-- desde el navegador.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quién es de GTIC
-- ---------------------------------------------------------------------
create table if not exists gtic.personal (
  uid         uuid primary key,
  correo      text,
  agregado_en timestamptz not null default now()
);

alter table gtic.personal enable row level security;
-- Nadie la lee ni la escribe desde el navegador. Se consulta solo desde
-- dentro de es_gtic(), que corre con los permisos de su dueño; y se llena
-- desde el panel o desde la Edge Function de cuentas, que llevan la llave
-- de administrador. Sin políticas, RLS lo niega todo, que es lo que se
-- quiere: una tabla que decide permisos no se toca desde fuera.

-- Todas las cuentas que existen HOY son de GTIC: hasta ahora no había otra
-- forma de tener uná. Se las siembra de una vez para que nadie se quede
-- fuera de su propia bandeja al correr esto.
insert into gtic.personal (uid, correo)
  select id, email from auth.users
  on conflict (uid) do nothing;

/* La pregunta que hacen todas las políticas de abajo. `security definer`
   porque gtic.personal está cerrada a cal y canto: la función puede
   mirarla, quien la llama no. */
create or replace function gtic.es_gtic()
returns boolean
language sql
stable
security definer
set search_path = gtic, pg_catalog
as $$
  select exists (select 1 from gtic.personal p where p.uid = auth.uid());
$$;

grant execute on function gtic.es_gtic() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 1 bis. Quién puede hacerse una cuenta
-- ---------------------------------------------------------------------
-- Restringir por dominio —que el correo acabe en @ciip.com.ve— deja entrar
-- a buzones compartidos, a cuentas de servicio y a cualquiera que consiga
-- una dirección de la casa. Aquí la lista es explícita: se registra quien
-- esté en ella y nadie más.
--
-- La clave NO va en esta tabla, y eso es a propósito. Lo que se autoriza es
-- el correo; la contraseña se la pone cada quien al registrarse y no la
-- sabe nadie más —ni GTIC—, que es como funciona el resto del sistema.
create table if not exists gtic.correos_permitidos (
  correo      text primary key,
  nombre      text,
  agregado_en timestamptz not null default now()
);

alter table gtic.correos_permitidos enable row level security;
-- Sin políticas: no se lee ni se escribe desde el navegador. Si se pudiera
-- leer, sería el directorio de la casa servido a quien lo pida.

-- Los correos de GTIC que ya tienen cuenta entran solos en la lista: si no,
-- el disparador de abajo les impediría volver a crearse una.
insert into gtic.correos_permitidos (correo, nombre)
  select lower(btrim(email)), coalesce(raw_user_meta_data ->> 'nombre', '')
    from auth.users where email is not null
  on conflict (correo) do nothing;

/* El portero. Va sobre auth.users porque el registro lo hace Supabase por su
   cuenta —no pasa por ninguna función nuestra—, así que este es el único
   sitio donde se puede decir que no.

   Envuelto y con red, por lo que ya pasó con Storage en la migración 02: el
   SQL Editor corre TODO el archivo en una sola transacción, y auth.users
   pertenece a supabase_auth_admin. Si no se puede poner el disparador, esto
   avisa y sigue, en vez de tumbar las siete secciones de arriba. */
create or replace function gtic.solo_correos_de_la_casa()
returns trigger
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
begin
  if not exists (select 1 from gtic.correos_permitidos c
                  where c.correo = lower(btrim(new.email))) then
    raise exception 'Ese correo no está autorizado. Pídele a GTIC que lo agregue.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $portero$
begin
  begin
    execute $t$drop trigger if exists solo_correos_de_la_casa on auth.users$t$;
    execute $t$create trigger solo_correos_de_la_casa
              before insert on auth.users
              for each row execute function gtic.solo_correos_de_la_casa()$t$;
    raise notice 'Portero puesto: solo se registran los correos de gtic.correos_permitidos.';
  exception when others then
    raise notice 'NO se pudo poner el portero sobre auth.users (%). Sin el, cualquiera con un correo valido podria registrarse: limita al menos el dominio en Authentication -> Providers -> Email.', sqlerrm;
  end;
end;
$portero$;


-- ---------------------------------------------------------------------
-- 2. De quién es cada solicitud
-- ---------------------------------------------------------------------
-- Nulo en todas las de antes, y nulo en las que se manden sin cuenta. Eso
-- no es un hueco: esas se siguen por su id, como siempre.
alter table gtic.solicitudes
  add column if not exists solicitante uuid;

create index if not exists solicitudes_solicitante_idx
  on gtic.solicitudes (solicitante, creada_en desc);


-- ---------------------------------------------------------------------
-- 3. Quién puede ver y tocar qué
-- ---------------------------------------------------------------------
drop policy if exists "gtic: ver las solicitudes"     on gtic.solicitudes;
drop policy if exists "gtic: atender las solicitudes" on gtic.solicitudes;
drop policy if exists "ver: gtic todo, cada quien lo suyo" on gtic.solicitudes;
drop policy if exists "solo gtic atiende"             on gtic.solicitudes;

-- GTIC ve la cola entera. Quien pide, solo lo suyo — y solo si entró con
-- su cuenta y la solicitud lleva su nombre puesto.
create policy "ver: gtic todo, cada quien lo suyo"
  on gtic.solicitudes for select to authenticated
  using (gtic.es_gtic() or (solicitante is not null and solicitante = auth.uid()));

-- Atender —tomar, cerrar, escribir observaciones— sigue siendo solo de
-- GTIC. Que alguien pueda ver su solicitud no lo autoriza a darla por
-- resuelta.
create policy "solo gtic atiende"
  on gtic.solicitudes for update to authenticated
  using (gtic.es_gtic()) with check (gtic.es_gtic());

-- Las guías llevan dentro las mañas de la casa. Esto es lo que más
-- importa de esta migración: sin ello, dar cuenta a los 224 sería
-- repartirles las claves de los equipos.
drop policy if exists "gtic: leer las guias"     on gtic.guias;
drop policy if exists "gtic: escribir las guias" on gtic.guias;
drop policy if exists "gtic: corregir las guias" on gtic.guias;
drop policy if exists "gtic: borrar las guias"   on gtic.guias;

create policy "gtic: leer las guias"
  on gtic.guias for select to authenticated using (gtic.es_gtic());
create policy "gtic: escribir las guias"
  on gtic.guias for insert to authenticated with check (gtic.es_gtic());
create policy "gtic: corregir las guias"
  on gtic.guias for update to authenticated using (gtic.es_gtic()) with check (gtic.es_gtic());
create policy "gtic: borrar las guias"
  on gtic.guias for delete to authenticated using (gtic.es_gtic());

-- El inventario se lee público —son los equipos de la casa, y el
-- formulario los necesita— pero apuntarlos sigue siendo de GTIC: acaba
-- impreso en una Hoja de Servicio.
drop policy if exists "gtic: apuntar un equipo" on gtic.inventario;
create policy "gtic: apuntar un equipo"
  on gtic.inventario for insert to authenticated with check (gtic.es_gtic());


-- ---------------------------------------------------------------------
-- 4. Dejar una solicitud, con cuenta o sin ella
-- ---------------------------------------------------------------------
-- Cambia una sola cosa respecto a la migración 02: si quien la manda entró
-- con su cuenta, queda anotado. El navegador no lo dice —eso sería creerle
-- a quien escribe— sino que se toma de la sesión.
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
  if btrim(coalesce(p_gerencia, '')) = '' or btrim(coalesce(p_usuario, '')) = ''
     or btrim(coalesce(p_descripcion, '')) = '' then
    raise exception 'Faltan datos obligatorios: gerencia, usuario y descripción.';
  end if;

  /* Una abierta a la vez. Con cuenta se compara por la cuenta, que no se
     escribe mal; sin ella, por el nombre normalizado, como hasta ahora. */
  if quien is not null then
    select * into previa
      from gtic.solicitudes s
     where s.estado in ('recibida', 'en_proceso') and s.solicitante = quien
     order by s.creada_en limit 1;
  else
    select * into previa
      from gtic.solicitudes s
     where s.estado in ('recibida', 'en_proceso')
       and lower(btrim(regexp_replace(s.usuario,  '\s+', ' ', 'g')))
         = lower(btrim(regexp_replace(p_usuario, '\s+', ' ', 'g')))
     order by s.creada_en limit 1;
  end if;

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

grant execute on function gtic.crear_solicitud(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. "¿Qué he pedido yo?", desde cualquier equipo
-- ---------------------------------------------------------------------
-- Lo que hace que la cuenta valga la pena. Devuelve lo de quien llama y
-- nada más; sin sesión, no devuelve nada —ni un error que se pueda leer
-- como una pista—.
create or replace function gtic.mis_solicitudes()
returns table(
  id uuid, numero integer, anio integer, estado text,
  descripcion text, tipo text, detalle text,
  creada_en timestamptz, atendida_en timestamptz,
  tecnico text, observaciones text, anulada_por text, mensajes jsonb
)
language sql
stable
security definer
set search_path = gtic, pg_catalog
as $$
  select s.id, s.numero, s.anio, s.estado,
         s.descripcion, s.tipo, s.detalle,
         s.creada_en, s.atendida_en,
         s.tecnico, s.observaciones, s.anulada_por, s.mensajes
    from gtic.solicitudes s
   where auth.uid() is not null and s.solicitante = auth.uid()
   order by s.creada_en desc;
$$;

grant execute on function gtic.mis_solicitudes() to authenticated;


-- ---------------------------------------------------------------------
-- 6. Adoptar lo que se mandó sin cuenta
-- ---------------------------------------------------------------------
-- Quien ya había pedido soporte sin cuenta tiene esos id guardados en su
-- navegador. Al entrar por primera vez, la página se los ofrece a esta
-- función y quedan atados a su cuenta: si no, estrenar cuenta sería
-- empezar de cero y perder el historial que ya tenía delante.
--
-- El id es la única prueba de que una solicitud es suya —122 bits al azar,
-- que es lo mismo que la deja consultarla sin cuenta—, así que no se
-- concede nada que no tuviera ya. Y solo se adoptan las huérfanas: una que
-- ya tenga dueño no cambia de manos.
create or replace function gtic.adoptar_solicitudes(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = gtic, pg_catalog
as $$
declare
  quien uuid := auth.uid();
  cuantas integer;
begin
  if quien is null then return 0; end if;
  update gtic.solicitudes s
     set solicitante = quien
   where s.id = any(coalesce(p_ids, '{}'::uuid[]))
     and s.solicitante is null;
  get diagnostics cuantas = row_count;
  return cuantas;
end;
$$;

grant execute on function gtic.adoptar_solicitudes(uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Hablar y retirar: también valen para el dueño con cuenta
-- ---------------------------------------------------------------------
-- Las dos siguen aceptando el id como prueba, que es como funcionan sin
-- cuenta. Lo que cambia es quién firma el mensaje: con cuenta de GTIC
-- habla el técnico; con cuenta de quien pidió, o sin ninguna, habla quien
-- pidió. Antes bastaba con no ser GTIC; ahora se distingue de verdad.
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

  if limpio = '' and jsonb_array_length(traidos) = 0 then
    raise exception using errcode = 'PT400', message = 'El mensaje viene vacío.';
  end if;

  select * into s from gtic.solicitudes x where x.id = enviar_mensaje.id;
  if not found then
    raise exception using errcode = 'PT404', message = 'No existe esa solicitud.';
  end if;

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

  /* Ser de GTIC ya no es "tener cuenta": es estar en gtic.personal. Sin
     esto, cualquiera de los 224 aparecería en el hilo como si fuera el
     técnico que atiende. */
  if gtic.es_gtic() then
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
notify pgrst, 'reload schema';


-- =====================================================================
-- DESPUÉS DE CORRER ESTO
-- =====================================================================
--
-- 1. COMPRUEBA QUE NO TE DEJASTE FUERA A NADIE DE GTIC
--
--    select p.correo from gtic.personal p;
--
--    Deberían salir todas las cuentas que ya usabais. Si falta alguna
--    —porque se creó entre medias— se agrega así:
--
--      insert into gtic.personal (uid, correo)
--        select id, email from auth.users where email = 'quien.falta@ciip.com.ve'
--        on conflict (uid) do nothing;
--
--    Esto importa: quien no esté en esa tabla deja de ver la cola.
--
-- 2. CARGA LOS CORREOS DE LA CASA
--
--    Sin esto no se puede registrar nadie: la lista arranca solo con las
--    cuentas de GTIC que ya existían. Se cargan de una vez así —una línea
--    por persona, el nombre es opcional—:
--
--      insert into gtic.correos_permitidos (correo, nombre) values
--        ('maria.rodriguez@ciip.com.ve', 'María Rodríguez'),
--        ('jose.perez@ciip.com.ve',      'José Pérez')
--      on conflict (correo) do nothing;
--
--    Para agregar a alguien más adelante, la misma sentencia con una sola
--    línea. Para quitarle el permiso a quien se fue de la casa:
--
--      delete from gtic.correos_permitidos where correo = 'quien.sea@ciip.com.ve';
--
--    Ojo: eso impide que se REGISTRE, no cierra la cuenta que ya tenga.
--    Para darla de baja del todo, Authentication → Users → Delete.
--
-- 3. EL REGISTRO PÚBLICO AHORA SÍ TIENE QUE ESTAR ABIERTO
--
--    Es al revés que antes. Para que quien pide soporte pueda hacerse su
--    cuenta hace falta Authentication → Sign In → "Allow new users to
--    sign up" ENCENDIDO.
--
--    Ya no es el agujero que era, por dos motivos: el portero de la
--    sección 1 bis solo deja pasar los correos de la lista, y aunque
--    alguien colara uno, una cuenta recién hecha no ve la cola, no lee
--    las guías y no toca el inventario. Solo ve lo suyo.
--
--    Si el disparador no se pudo poner —mira el aviso al correr esto—,
--    limita al menos el dominio: Authentication → Providers → Email →
--    "Restrict sign ups to...". Es más flojo, pero es algo.
--
-- 4. Y LA CONFIRMACIÓN POR CORREO
--
--    Si está encendida, quien se registre no podrá entrar hasta pinchar
--    un enlace. Decide cuál de las dos quieres:
--      · encendida  → prueba que el correo es suyo de verdad
--      · apagada    → entra al momento; con la lista de arriba, basta
-- =====================================================================
