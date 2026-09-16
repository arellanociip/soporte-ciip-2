-- =====================================================================
-- Solicitudes de soporte · GGTIC · CIIP
-- Migración 13: je.arellano@ciip.com.ve, administrador
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 12.
--
-- De dónde sale esto:
--
-- La migración 08 ya le había dado el rol de administrador a esta cuenta,
-- junto con franklin y con el Gmail que reemplazó a este mismo correo
-- (migración 06). Esta migración reafirma el rol específicamente para
-- je.arellano@ciip.com.ve, por si esa fila no existía todavía cuando
-- corrió la 08, o si se perdió en algún punto.
--
-- No toca gtic.correos_permitidos: ese correo se sacó de la lista a
-- propósito en la migración 06 (Marca País y esta cuenta pasaron a Gmail).
-- Sacarlo de ahí no afecta si la cuenta YA existe: correos_permitidos solo
-- decide quién puede REGISTRARSE de cero, nunca quién puede entrar con una
-- cuenta que ya tiene. Si esta migración no encuentra ninguna fila que
-- actualizar, es porque esa cuenta ya no existe en auth.users (se borró, o
-- nunca se creó con ese correo exacto) — en ese caso hace falta otro paso,
-- no este.
-- =====================================================================

insert into gtic.personal (uid, correo, es_admin)
  select id, email, true
    from auth.users
   where email = 'je.arellano@ciip.com.ve'
on conflict (uid) do update set es_admin = true;
