-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 14: correos_permitidos al día con el corte del 15/09/2026
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 13.
--
-- De dónde sale esto:
--
-- "Listado_de_personal_150926_Correos_Completo.xlsx" —158 personas,
-- CORREOS INSTITUCIONALES en la columna H— es el mismo tipo de listado
-- que ya se usó en la migración 11, pero más nuevo. Se comparó fila por
-- fila contra gtic.correos_permitidos (169 correos @ciip.com.ve en ese
-- momento) para ver quién entró, quién salió y a quién le cambiaron el
-- correo desde entonces.
--
-- ---------------------------------------------------------------------
-- A · DOS CORREOS QUE CAMBIARON, NO UNA BAJA Y UN ALTA SUELTAS
--
-- Anghela Andrius Dávila Márquez y Frenddy Santana Buitrago siguen en la
-- casa; el listado nuevo les asigna un correo distinto al que tenían
-- aquí. Se actualiza en el lugar —mismo registro, correo nuevo—, no se
-- borra uno y se crea otro suelto, para no perder de dónde viene.
--
-- B · TRES NOMBRES QUE EL LISTADO TRAE MÁS COMPLETOS O MÁS CORRECTOS
--
--   a.bracho@ciip.com.ve   tenía solo "BRACHO ANGEL" (le faltaban dos
--                          nombres); el listado trae "ANGEL DOMINGO
--                          BRACHO GARCIA".
--   je.arellano@ciip.com.ve tenía el nombre en blanco —la migración 13
--                          solo tocó el rol de administrador, nunca el
--                          nombre—; el listado trae "JESUS ANTONIO
--                          ARELLANO NATERA".
--   r.godoy@ciip.com.ve    tenía "ROSBELY DEL CARMEN BRACHO INDRIAGO":
--                          el apellido no coincide ni con el correo
--                          (r.GODOY) ni con el listado nuevo, que trae
--                          "ROSBELY DEL CARMEN GODOY BRICEÑO" —un cruce
--                          de datos de cuando se cargó por primera vez,
--                          se corrige aquí—.
--
-- C · UN TYPO DE DOMINIO, IGUAL QUE EN LA MIGRACIÓN 11
--
-- 'g.zuniga@ciip.cpm.ve' —Gustavo José Zúñiga— se agrega ya corregido a
-- 'g.zuniga@ciip.com.ve', el dominio real en las otras 157 filas.
--
-- D · UN CORREO QUE EL LISTADO DUPLICA, Y AQUÍ NO SE TOCA
--
-- El listado nuevo le pone 'k.sanchez@ciip.com.ve' TANTO a Katiuska
-- Elizabeth Sanchez COMO a Karelys Juliett Sanchez Lopez. Ese correo ya
-- es de Katiuska aquí; Karelys ya tiene el suyo, distinto a propósito
-- ('kj.sanchez@ciip.com.ve', para no chocar con Katiuska). Esta
-- migración no mueve nada de los dos: el error está en el listado nuevo,
-- no en lo que ya había. Queda para que GTIC lo confirme con Gestión
-- Humana, no para resolverlo a ciegas aquí.
--
-- E · QUINCE ALTAS, VEINTICUATRO BAJAS
--
-- Los que aparecen en el listado y no estaban en correos_permitidos se
-- agregan (trece, descontando los dos renombrados de la sección A y el
-- typo de dominio de la C, que van aparte). Los que estaban y ya no
-- aparecen en el listado se quitan —veinticuatro—: como con cualquier
-- baja (ver sql/altas_y_bajas.sql, bloque E), esto NO cierra ninguna
-- cuenta que ya exista, solo impide registrarse de cero con ese correo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A · dos correos que cambiaron
-- ---------------------------------------------------------------------
update gtic.correos_permitidos
   set correo = 'a.marquez@ciip.com.ve',
       nombre = 'ANGHELA JACQUELINE ANDRIUS DAVILA MARQUEZ'
 where correo = 'a.davila@ciip.com.ve';

update gtic.correos_permitidos
   set correo = 'fr.santana@ciip.com.ve',
       nombre = 'FRENDDY ENRIQUE SANTANA BUITRAGO'
 where correo = 'f.santana@ciip.com.ve';


-- ---------------------------------------------------------------------
-- B · tres nombres más completos o más correctos
-- ---------------------------------------------------------------------
update gtic.correos_permitidos set nombre = 'ANGEL DOMINGO BRACHO GARCIA'
 where correo = 'a.bracho@ciip.com.ve';

update gtic.correos_permitidos set nombre = 'JESUS ANTONIO ARELLANO NATERA'
 where correo = 'je.arellano@ciip.com.ve';

update gtic.correos_permitidos set nombre = 'ROSBELY DEL CARMEN GODOY BRICEÑO'
 where correo = 'r.godoy@ciip.com.ve';


-- ---------------------------------------------------------------------
-- C, E · trece altas nuevas más el typo de dominio corregido
-- ---------------------------------------------------------------------
insert into gtic.correos_permitidos (correo, nombre) values
  ('a.arraiz@ciip.com.ve', 'ANA MARIA ARRAIZ DE CONDE'),
  ('f.reyes@ciip.com.ve', 'FRANKLIN DAVID REYES DELGADO'),
  ('k.sulcas@ciip.com.ve', 'KRISTINA DUGNAS SULCAS'),
  ('y.loaguna@ciip.com.ve', 'YEITSON JOSE LAGUNA LEAL'),
  ('e.bolivar@ciip.com.ve', 'EDGAR ALEJANDRO BOLIVAR SANCHEZ'),
  ('a.perez@ciip.com.ve', 'ANNELIN DEL CARMEN PEREZ'),
  ('g.zuniga@ciip.com.ve', 'GUSTAVO JOSE ZUÑIGA'),
  ('v.ramos@ciip.com.ve', 'VALERIA CAROLINA RAMOS RAMOS'),
  ('k.valero@ciip.com.ve', 'KARINA VALERIA VALERO ZÁRRAGA'),
  ('e.duran@ciip.com.ve', 'ENRY JOSUE DURAN'),
  ('d.fermin@ciip.com.ve', 'DANIELA PATRICIA FERMIN BANDRES'),
  ('m.peralta@ciip.com.ve', 'MARIELA JOSEFINA RODRIGUEZ PERALTA'),
  ('v.corredor@ciip.com.ve', 'VICTOR ALEJANDRO JESUS CORREDOR SUAREZ')
on conflict (correo) do nothing;


-- ---------------------------------------------------------------------
-- E · veinticuatro bajas: ya no aparecen en el listado
-- ---------------------------------------------------------------------
delete from gtic.correos_permitidos
 where correo in (
  'a.arellano@ciip.com.ve', 'a.figueroa@ciip.com.ve', 'a.robles@ciip.com.ve',
  'b.petterson@ciip.com.ve', 'c.garcia@ciip.com.ve', 'ca.torres@ciip.com.ve',
  'e.martinez@ciip.com.ve', 'f.martinez@ciip.com.ve', 'f.rincon@ciip.com.ve',
  'f.rodriguez@ciip.com.ve', 'j.munoz@ciip.com.ve', 'j.sella@ciip.com.ve',
  'l.guacache@ciip.com.ve', 'l.narvaez@ciip.com.ve', 'l.varela@ciip.com.ve',
  'm.gonzalez@ciip.com.ve', 'm.sanz@ciip.com.ve', 'm.savoia@ciip.com.ve',
  'r.ramirez@ciip.com.ve', 's.osuna@ciip.com.ve', 'v.cuello@ciip.com.ve',
  'v.vizcaya@ciip.com.ve', 'y.gomez@ciip.com.ve', 'y.pinto@ciip.com.ve'
 );


-- ---------------------------------------------------------------------
-- Verificación: debería quedar en 158 el total de @ciip.com.ve, más lo
-- que ya hubiera de otros dominios (Marca País con gmail, si queda
-- alguno; el gob.ve de Alejandro Puglia).
-- ---------------------------------------------------------------------
select count(*) filter (where correo like '%@ciip.com.ve') as ciip_com_ve,
       count(*) as total
  from gtic.correos_permitidos;
