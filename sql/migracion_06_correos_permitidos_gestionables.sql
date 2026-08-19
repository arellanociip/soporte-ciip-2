-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 06: correos_permitidos se administra desde la bandeja
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 05 (necesita 03, donde nace
-- gtic.correos_permitidos y gtic.es_gtic()).
--
-- De dónde sale esto:
--
-- gtic.correos_permitidos —la lista de quién puede registrarse para pedir
-- soporte— nació deliberadamente cerrada al navegador: "ni se lee ni se
-- escribe desde ahí" (migración 03). Hasta ahora, agregar o quitar un
-- correo exigía entrar al SQL Editor de Supabase a mano, uno por uno.
--
-- Esta migración le da permiso a GTIC —autenticado, gtic.es_gtic()— para
-- leer, agregar y quitar correos desde una pantalla nueva en la bandeja
-- ("Correos permitidos"), de a uno o varios de una vez. Sigue sin ser
-- visible para `anon` ni para quien pide soporte, que es lo que había que
-- cuidar: nada cambia para ellos.
--
-- De paso, cambia la forma de entrar de dos personas —de su correo
-- institucional a su Gmail personal—, a pedido de la gerencia. Esto solo
-- cambia con qué correo se puede REGISTRAR una cuenta nueva: el disparador
-- de la migración 03 corre al crear la cuenta, no al entrar, así que la
-- cuenta vieja con el correo de la casa sigue sirviendo para entrar si
-- alguien la usa; lo que ya no se puede es volver a registrarla. La cuenta
-- con el Gmail es una cuenta nueva, sin el historial de la vieja.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GTIC puede administrar la lista desde la bandeja
-- ---------------------------------------------------------------------
drop policy if exists "gtic: leer los correos permitidos" on gtic.correos_permitidos;
drop policy if exists "gtic: agregar correos permitidos"  on gtic.correos_permitidos;
drop policy if exists "gtic: quitar correos permitidos"   on gtic.correos_permitidos;

create policy "gtic: leer los correos permitidos"
  on gtic.correos_permitidos for select to authenticated using (gtic.es_gtic());
create policy "gtic: agregar correos permitidos"
  on gtic.correos_permitidos for insert to authenticated with check (gtic.es_gtic());
create policy "gtic: quitar correos permitidos"
  on gtic.correos_permitidos for delete to authenticated using (gtic.es_gtic());

grant select, insert, delete on gtic.correos_permitidos to authenticated;
-- Sin update a propósito: la pantalla nueva agrega y quita, no corrige un
-- correo existente —correo es la llave primaria, y "corregirlo" es en
-- realidad quitar uno y agregar otro—.


-- ---------------------------------------------------------------------
-- 2. Dos cuentas que pasan de su correo de la casa a su Gmail
-- ---------------------------------------------------------------------
-- El nombre de Franklin es el mejor dato disponible —el que usa en los
-- commits de este repositorio—; si no es el correcto, se corrige desde la
-- pantalla nueva: se quita y se vuelve a agregar con el nombre bien.
delete from gtic.correos_permitidos
  where correo in ('je.arellano@ciip.com.ve', 'f.reyes@ciip.com.ve');

insert into gtic.correos_permitidos (correo, nombre) values
  ('ing.jearellano@gmail.com',   'Jesus Antonio Arellano Natera'),
  ('franklinreyes346@gmail.com', 'Franklin Reyes')
on conflict (correo) do nothing;
