-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 08: administrador, un rol de verdad
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 07.
--
-- De dónde sale esto:
--
-- Hasta ahora no había roles: cualquier cuenta de GTIC podía lo mismo,
-- incluida la gestión de accesos —dar de alta o de baja a otro técnico,
-- decidir quién puede pedir soporte—. Eso deja de ser así solo para esas
-- dos cosas: "Cuentas" y "Correos permitidos" pasan a ser de administrador
-- nada más. Atender solicitudes, escribir guías, tocar el inventario y ver
-- estadísticas siguen siendo de cualquiera con cuenta de GTIC, como
-- siempre.
--
-- De paso, se cierra un hueco que tenía la Edge Function de Cuentas desde
-- que existe: comprobaba que hubiera sesión, pero nunca que esa sesión
-- fuera de GTIC. Cualquiera con cuenta para pedir soporte podía llamarla
-- directo —sin pasar por la bandeja, que es lo único que ocultaba el
-- botón— y listar, crear o borrar cuentas de GTIC. Con el rol de
-- administrador puesto, la función exige ese papel para las tres cosas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. El papel, en la misma tabla que ya dice quién es de GTIC
-- ---------------------------------------------------------------------
alter table gtic.personal
  add column if not exists es_admin boolean not null default false;

/* La misma pregunta que gtic.es_gtic(), pero por el papel de administrador.
   security definer por la misma razón: gtic.personal está cerrada a cal y
   canto, y la función corre con los permisos de su dueño para poder
   mirarla igual. */
create or replace function gtic.es_admin()
returns boolean
language sql
stable
security definer
set search_path = gtic, pg_catalog
as $$
  select exists (
    select 1 from gtic.personal p where p.uid = auth.uid() and p.es_admin
  );
$$;

grant execute on function gtic.es_admin() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Correos permitidos pasa de "cualquiera de GTIC" a "solo admin"
-- ---------------------------------------------------------------------
drop policy if exists "gtic: leer los correos permitidos" on gtic.correos_permitidos;
drop policy if exists "gtic: agregar correos permitidos"  on gtic.correos_permitidos;
drop policy if exists "gtic: quitar correos permitidos"   on gtic.correos_permitidos;

create policy "gtic: leer los correos permitidos"
  on gtic.correos_permitidos for select to authenticated using (gtic.es_admin());
create policy "gtic: agregar correos permitidos"
  on gtic.correos_permitidos for insert to authenticated with check (gtic.es_admin());
create policy "gtic: quitar correos permitidos"
  on gtic.correos_permitidos for delete to authenticated using (gtic.es_admin());

-- Las Cuentas (auth.users + gtic.personal) no tenían políticas de RLS para
-- el navegador —se manejan por la Edge Function, con la llave de
-- administrador—, así que el candado de "solo admin" para esas se pone
-- allá, no aquí: ver supabase/functions/cuentas/index.ts.


-- ---------------------------------------------------------------------
-- 3. El primer administrador
-- ---------------------------------------------------------------------
-- Cubre el correo que tenga hoy en gtic.personal, sea el institucional
-- viejo o el Gmail nuevo: el que no exista, esta línea lo ignora sin
-- quejarse.
update gtic.personal set es_admin = true
  where correo in ('f.reyes@ciip.com.ve', 'franklinreyes346@gmail.com');
