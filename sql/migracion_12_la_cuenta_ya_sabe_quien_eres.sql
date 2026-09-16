-- =====================================================================
-- Solicitudes de soporte · GGTIC · CIIP
-- Migración 12: la cuenta ya sabe quién eres
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 11.
--
-- De dónde sale esto:
--
-- Entrar con el correo de la casa y tener que escribir después el nombre,
-- la gerencia, el piso y la oficina es pedir dos veces lo mismo. El
-- vínculo ya existía —gtic.correos_permitidos guarda (correo, nombre)
-- desde la migración 03, y las migraciones 10 y 11 lo llenaron con los
-- Gmail de Marca País y los correos del CIIP—, pero esa tabla nació
-- cerrada al navegador a propósito: "si se pudiera leer, sería el
-- directorio de la casa servido a quien lo pida".
--
-- Esa razón sigue siendo buena, y esta migración no la toca. Lo que abre
-- es UNA FILA: la de quien llama, la suya y ninguna otra. Con eso basta,
-- porque el nombre que devuelve es el mismo del "Listado General correos
-- activos" que alimenta js/directorio.js, y ahí sí están la gerencia, el
-- piso, la oficina y el cargo de las 224 personas. El navegador cruza las
-- dos cosas y la planilla sale llena.
--
-- Por qué el nombre y no la gerencia: la gerencia no vive en esta tabla ni
-- tiene por qué. js/directorio.js ya es público y la trae; lo que nunca
-- fue público es QUÉ CORREO ES DE QUIÉN, y eso se queda donde está. La
-- función devuelve el nombre de uno mismo, que es un dato que quien llama
-- ya conoce de sobra.
--
-- Lo que NO resuelve, y hay que seguir arrastrando:
--
--   · Daniel Alberto Yepes Rivas sigue sin correo (decía "N/A" en el
--     listado), así que no tiene cuenta ni ficha que devolver.
--   · c.forgione@ciip.com.ve sigue compartido entre Ana Maria Arraiz de
--     Conde y Carolina Forgione Franco por un error de captura de la casa
--     (ver migración 11). Su fila lleva de nombre la nota que lo explica,
--     no un nombre, así que no cruza contra el directorio: quien entre con
--     ese correo verá la planilla como hasta ahora, escribiéndolo a mano.
--     El navegador solo acepta el nombre cuando calza con alguien de la
--     lista, justamente para que esa nota no acabe impresa en una Hoja de
--     Servicio. Se arregla el día que IT le dé correo propio a una de las
--     dos, desde "Correos permitidos" en la bandeja y sin tocar código.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. El nombre de Franklin, como lo dice el listado
-- ---------------------------------------------------------------------
-- La migración 06 lo agregó como 'Franklin Reyes' advirtiendo que era "el
-- mejor dato disponible —el que usa en los commits de este repositorio—;
-- si no es el correcto, se corrige". El listado de la casa dice 'Franklin
-- David Reyes Delgado', que es como está en js/directorio.js, y hasta hoy
-- la diferencia no costaba nada. Desde esta migración sí: 'Franklin Reyes'
-- no cruza contra el directorio y él sería el único de los 224 que entra
-- con su correo y aun así tiene que escribirlo todo a mano.
update gtic.correos_permitidos
   set nombre = 'Franklin David Reyes Delgado'
 where correo = 'franklinreyes346@gmail.com';


-- ---------------------------------------------------------------------
-- 2. Mi ficha, y nada más que la mía
-- ---------------------------------------------------------------------
-- security definer porque gtic.correos_permitidos no tiene política de
-- lectura para quien pide soporte, y no se le va a poner una: una política
-- abre la tabla y luego hay que confiar en que el filtro del navegador la
-- vuelva a cerrar. Una función devuelve lo que devuelve y se acabó.
--
-- El correo sale del testigo (auth.jwt()), que es lo que Supabase firmó al
-- entrar y quien llama no puede cambiar. La vuelta por auth.users es la
-- red por si un testigo viejo no trajera el claim: el mismo uid, el mismo
-- correo, sin depender de la forma del JWT.
--
-- Sin sesión no devuelve nada. Ni una fila vacía ni un error: quien no
-- entró no tiene ficha, y la página ya sabe seguir sin ella.
create or replace function gtic.mi_ficha()
returns table(correo text, nombre text)
language sql
stable
security definer
set search_path = gtic, pg_catalog
as $$
  select c.correo, c.nombre
    from gtic.correos_permitidos c
   where auth.uid() is not null
     and c.correo = lower(btrim(coalesce(
           auth.jwt() ->> 'email',
           (select u.email from auth.users u where u.id = auth.uid())
         )));
$$;

revoke execute on function gtic.mi_ficha() from public, anon;
grant  execute on function gtic.mi_ficha() to authenticated;
