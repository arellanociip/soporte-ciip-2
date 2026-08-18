-- =====================================================================
--  ALTAS Y BAJAS DE PERSONAS · para correr a mano en el SQL Editor
-- =====================================================================
--
--  Esto NO es una migración. No hay que correrlo entero ni una vez: es un
--  recetario. Se abre, se copia el bloque que hace falta, se cambia el
--  correo de arriba y se ejecuta solo eso.
--
--  Cada bloque avisa por pantalla de lo que hizo o de por qué no pudo, en
--  vez de terminar en silencio. Míralo en la pestaña de mensajes del
--  editor: un "0 rows" no distingue "ya estaba" de "no existe".
--
--  ---------------------------------------------------------------------
--  LOS DOS PAPELES, Y DÓNDE VIVE CADA UNO
--
--    gtic.correos_permitidos   quién puede REGISTRARSE.
--                              Sin estar aquí, el portero de la migración
--                              03 rechaza la creación de la cuenta.
--
--    gtic.personal             quién es de SOPORTE.
--                              Sin estar aquí, la cuenta funciona para
--                              pedir soporte pero la bandeja la rechaza
--                              en la puerta (ver js/bandeja.js).
--
--  Un usuario común está solo en la primera. Alguien de soporte, en las
--  dos. Nadie está solo en la segunda: para tener el papel hay que tener
--  antes la cuenta.
--
--  El papel NO se guarda en el user_metadata a propósito: ese campo lo
--  cambia la propia persona con una llamada a /auth/v1/user, así que
--  cualquiera se ascendería a soporte en un minuto. La migración 03 lo
--  explica largo.
--
--  ---------------------------------------------------------------------
--  CUANDO LA EDGE FUNCTION ESTÉ DESPLEGADA
--
--  El alta de soporte se hará desde la bandeja —Cuentas → + Crear una
--  cuenta—, que crea la cuenta y da el papel de una vez. Hasta entonces,
--  y para las altas de usuarios comunes siempre, se hace aquí.
-- =====================================================================


-- ---------------------------------------------------------------------
--  A · VER QUIÉN ES QUIÉN
--      Sin cambiar nada. Vale la pena antes y después de tocar.
-- ---------------------------------------------------------------------

-- Quién es de soporte hoy
select p.correo, p.agregado_en
  from gtic.personal p
 order by p.correo;

-- Quién está autorizado a registrarse, y si ya se registró
select c.correo,
       c.nombre,
       (u.id is not null)                as ya_tiene_cuenta,
       (p.uid is not null)               as es_de_soporte
  from gtic.correos_permitidos c
  left join auth.users   u on lower(u.email) = c.correo
  left join gtic.personal p on p.uid = u.id
 order by c.correo;

-- Cuentas que existen pero NO están autorizadas. Deberían salir cero: si
-- sale alguna, se registró antes de que hubiera portero, o el portero no
-- estaba puesto.
select u.email
  from auth.users u
  left join gtic.correos_permitidos c on c.correo = lower(u.email)
 where c.correo is null;


-- ---------------------------------------------------------------------
--  B · DAR DE ALTA A UN USUARIO COMÚN
--      Autorizar el correo. La persona se crea su cuenta sola en la
--      puerta, y nace como usuario común: podrá pedir soporte y ver lo
--      suyo, nada más.
-- ---------------------------------------------------------------------
do $$
declare
  v_correo text := lower(btrim('nombre.apellido@ciip.com.ve'));   -- <<< CAMBIA ESTO
  v_nombre text := 'Nombre Apellido';                             -- <<< Y ESTO (opcional)
begin
  if exists (select 1 from gtic.correos_permitidos where correo = v_correo) then
    raise notice 'Ya estaba autorizado: %', v_correo;
  else
    insert into gtic.correos_permitidos (correo, nombre) values (v_correo, v_nombre);
    raise notice 'Autorizado: %. Ya puede crearse la cuenta en la puerta.', v_correo;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  C · DAR EL PAPEL DE SOPORTE
--      Hace falta que la persona YA tenga cuenta creada. Si todavía no
--      se ha registrado, esto avisa y no hace nada: primero el bloque B,
--      luego que entre a la puerta y se registre, y después este.
-- ---------------------------------------------------------------------
do $$
declare
  v_correo text := lower(btrim('nombre.apellido@ciip.com.ve'));   -- <<< CAMBIA ESTO
  v_uid    uuid;
begin
  select id into v_uid from auth.users where lower(email) = v_correo;

  if v_uid is null then
    raise notice 'No hay ninguna cuenta con el correo %. Que se registre primero en la puerta.', v_correo;
  elsif exists (select 1 from gtic.personal where uid = v_uid) then
    raise notice 'Ya era de soporte: %', v_correo;
  else
    insert into gtic.personal (uid, correo) values (v_uid, v_correo);
    raise notice 'Ya es de soporte: %. Puede entrar a la bandeja.', v_correo;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  D · QUITAR EL PAPEL DE SOPORTE
--      La cuenta sigue viva: esa persona podrá pedir soporte como
--      cualquiera. Solo deja de entrar a la bandeja.
-- ---------------------------------------------------------------------
do $$
declare
  v_correo  text := lower(btrim('nombre.apellido@ciip.com.ve'));  -- <<< CAMBIA ESTO
  v_uid     uuid;
  v_cuantos int;
begin
  select id into v_uid from auth.users where lower(email) = v_correo;
  select count(*) into v_cuantos from gtic.personal;

  if v_uid is null or not exists (select 1 from gtic.personal where uid = v_uid) then
    raise notice 'No era de soporte: %', v_correo;
  elsif v_cuantos <= 1 then
    -- Quedarse sin nadie cierra la bandeja para siempre y la única salida
    -- sería volver aquí. Se para antes.
    raise exception 'Es la última cuenta de soporte. Da de alta a quien la sustituye antes de quitarle el papel.';
  else
    delete from gtic.personal where uid = v_uid;
    raise notice 'Ya no es de soporte: %. Su cuenta sigue sirviendo para pedir soporte.', v_correo;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  E · CERRARLE EL PASO DEL TODO
--      Para quien se fue de la casa. Quita el papel y la autorización.
--
--      OJO: esto NO cierra la cuenta que ya tenga. Impide registrarse de
--      nuevo, pero quien ya tiene cuenta sigue pudiendo entrar con ella.
--      Para cerrarla de verdad hace falta el panel:
--      Authentication → Users → Delete.
--
--      Sus solicitudes NO se borran: quedan con su nombre, que es lo que
--      se quiere para el histórico.
-- ---------------------------------------------------------------------
do $$
declare
  v_correo text := lower(btrim('nombre.apellido@ciip.com.ve'));   -- <<< CAMBIA ESTO
  v_uid    uuid;
begin
  select id into v_uid from auth.users where lower(email) = v_correo;

  delete from gtic.personal          where correo = v_correo
                                        or (v_uid is not null and uid = v_uid);
  delete from gtic.correos_permitidos where correo = v_correo;

  if v_uid is null then
    raise notice 'Retirada la autorización de %. No llegó a tener cuenta.', v_correo;
  else
    raise notice 'Retirados el papel y la autorización de %. LA CUENTA SIGUE VIVA: ciérrala en Authentication -> Users -> Delete.', v_correo;
  end if;
end $$;
