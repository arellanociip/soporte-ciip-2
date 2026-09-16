-- =====================================================================
-- Solicitudes de soporte · GGTIC · CIIP
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
-- no en lo que ya había. Queda para que GGTIC lo confirme con Gestión
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
--
-- F · LOS ACENTOS, EN LAS OTRAS 80 QUE SE QUEDAN IGUAL
--
-- El listado de RRHH viene sin tildes casi siempre —se cargó en su día
-- tal cual, letra por letra—, y esta migración ya corrige de paso las
-- de los renombrados (A) y las tres de la B; a las trece altas de la C
-- también se les puso el acento aquí mismo, no en el Excel. Faltaban
-- las de las 80 personas que ni entran ni salen ni cambian de correo,
-- y no tenía sentido dejarlas mal escritas solo porque a esta migración
-- no le tocaba nada más de ellas. Van en su propio bloque al final.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A · dos correos que cambiaron
-- ---------------------------------------------------------------------
update gtic.correos_permitidos
   set correo = 'a.marquez@ciip.com.ve',
       nombre = 'ANGHELA JACQUELINE ANDRIUS DÁVILA MÁRQUEZ'
 where correo = 'a.davila@ciip.com.ve';

update gtic.correos_permitidos
   set correo = 'fr.santana@ciip.com.ve',
       nombre = 'FRENDDY ENRIQUE SANTANA BUITRAGO'
 where correo = 'f.santana@ciip.com.ve';


-- ---------------------------------------------------------------------
-- B · tres nombres más completos o más correctos
-- ---------------------------------------------------------------------
update gtic.correos_permitidos set nombre = 'ÁNGEL DOMINGO BRACHO GARCÍA'
 where correo = 'a.bracho@ciip.com.ve';

update gtic.correos_permitidos set nombre = 'JESÚS ANTONIO ARELLANO NATERA'
 where correo = 'je.arellano@ciip.com.ve';

update gtic.correos_permitidos set nombre = 'ROSBELY DEL CARMEN GODOY BRICEÑO'
 where correo = 'r.godoy@ciip.com.ve';


-- ---------------------------------------------------------------------
-- C, E · trece altas nuevas más el typo de dominio corregido
-- ---------------------------------------------------------------------
insert into gtic.correos_permitidos (correo, nombre) values
  ('a.arraiz@ciip.com.ve', 'ANA MARÍA ARRAIZ DE CONDE'),
  ('f.reyes@ciip.com.ve', 'FRANKLIN DAVID REYES DELGADO'),
  ('k.sulcas@ciip.com.ve', 'KRISTINA DUGNAS SULCAS'),
  ('y.loaguna@ciip.com.ve', 'YEITSON JOSÉ LAGUNA LEAL'),
  ('e.bolivar@ciip.com.ve', 'EDGAR ALEJANDRO BOLÍVAR SÁNCHEZ'),
  ('a.perez@ciip.com.ve', 'ANNELIN DEL CARMEN PÉREZ'),
  ('g.zuniga@ciip.com.ve', 'GUSTAVO JOSÉ ZÚÑIGA'),
  ('v.ramos@ciip.com.ve', 'VALERIA CAROLINA RAMOS RAMOS'),
  ('k.valero@ciip.com.ve', 'KARINA VALERIA VALERO ZÁRRAGA'),
  ('e.duran@ciip.com.ve', 'ENRY JOSUÉ DURÁN'),
  ('d.fermin@ciip.com.ve', 'DANIELA PATRICIA FERMÍN BANDRES'),
  ('m.peralta@ciip.com.ve', 'MARIELA JOSEFINA RODRÍGUEZ PERALTA'),
  ('v.corredor@ciip.com.ve', 'VÍCTOR ALEJANDRO JESÚS CORREDOR SUÁREZ')
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
-- F · los acentos de las otras 80 personas, las que se quedan igual
-- ---------------------------------------------------------------------
update gtic.correos_permitidos set nombre = 'ALFREDO ANTONIO CARRERA PÉREZ' where correo = 'a.carrera@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'AMARIELYS GISEL GONZÁLEZ MUÑOZ' where correo = 'a.gonzalez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ANGELICA MARÍA RAMÍREZ ARELLANO' where correo = 'a.ramirez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ANDRY JESÚS TOVAR CABRERA' where correo = 'a.tovar@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ANA MARÍA VILLARROEL' where correo = 'a.villaroel@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'CARLOS EDUARDO BARRETO GONZÁLEZ' where correo = 'c.barreto@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'CARLOS EDUARDO GALINDO SUÁREZ' where correo = 'c.galindo@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'CARLOS MANUEL RODRÍGUEZ LÓPEZ' where correo = 'c.rodriguez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'DEINYELBERT JOCKSANIEL RODRÍGUEZ SARMIENTO' where correo = 'd.rodriguez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'DILIA YAMILET SERRANO PÉREZ' where correo = 'd.serrano@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'EDWARD JHONNY GONZÁLEZ' where correo = 'e.gonzalez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ELÍAS JOSUÉ MARTÍNEZ LUQUE' where correo = 'e.luque@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ELLIUS ENRIQUE RÍOS HERNÁNDEZ' where correo = 'e.rios@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ELIUB RICARDO SOLÓRZANO PÉREZ' where correo = 'e.solorzano@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'EMELY MIRAIDY GARCÍA OSUNA' where correo = 'em.garcia@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'FRAVIA VANESSA MÁRQUEZ DE FERNÁNDEZ' where correo = 'f.marquez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'GABRIELA CAROLINA DE LOS ÁNGELES BRITO GÓMEZ' where correo = 'g.brito@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'GERMÁN JAVIER GERARDINO DÍAZ' where correo = 'g.gerardino@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'GERALDYN DE LOS ÁNGELES LÓPEZ ROJAS' where correo = 'g.lopez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'GABRIEL RAMÓN REYES RANGEL' where correo = 'g.reyes@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'HÉCTOR JOSÉ BRAVO OSUNA' where correo = 'h.bravo@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'HEDWING JOSÉ GUTIÉRREZ BLANCO' where correo = 'h.gutierrez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'IVÁN ARLEY LLANOS' where correo = 'i.llanos@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ISABEL MARÍA PEÑARANDA' where correo = 'i.penaranda@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ISBELIS MARIELYS PÉREZ' where correo = 'i.perez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ISOLIMAR COROMOTO SÁNCHEZ FERNÁNDEZ' where correo = 'i.sanchez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'IMARI DEL VALLE VÁSQUEZ CAPOTE' where correo = 'i.vasquez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JOEL ROMÁN AGUILAR CASTRO' where correo = 'j.aguilar@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JESLY ORIANA BÁEZ MACEDO' where correo = 'j.baez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JOSÉ MANUEL BARRIOS RIERA' where correo = 'j.barrios@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JIPSON JESÚS GRANADILLO ALBARRÁN' where correo = 'j.granadillo@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JOSÉ GREGORIO HERNÁNDEZ VILLEGAS' where correo = 'j.hernandez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JULMAR ENRIQUE MORÓN VÁSQUEZ' where correo = 'j.moron@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JOSÉ RAFAEL OLIVARES RODRÍGUEZ' where correo = 'j.olivares@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JESSICA ERLYNES RODRÍGUEZ ÁLVAREZ' where correo = 'j.rodriguez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JONATHAN GEORGE URBINA FERNÁNDEZ' where correo = 'j.urbina@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'JOJAN JOSÉ VALBUENA GARCÍA' where correo = 'j.valbuena@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'KATIUSKA DEL VALLE DÍAZ YÁÑEZ' where correo = 'k.diaz@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'KAREN DE JESÚS PÉREZ MUÑOZ' where correo = 'k.perez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'KATIUSKA ELIZABETH SÁNCHEZ' where correo = 'k.sanchez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'KARELYS JULIETT SÁNCHEZ LÓPEZ' where correo = 'kj.sanchez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'LUIGERSY ENRIQUE CORREA MÉNDEZ' where correo = 'l.correa@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'LUIS ALEJANDRO FLORES GONZÁLEZ' where correo = 'l.flores@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'LUIS VICENTE GARCÍA LAMAS' where correo = 'l.lamas@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'LEOMARY ANDREINA MALAVÉ MORENO' where correo = 'l.malave@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'LUCÍA SAMPAIO MARTINS' where correo = 'l.sampaio@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MAZURIS JIRALY AZÓCAR BENÍTEZ' where correo = 'm.azocar@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARÍA EMILIA TORRES BONTEN' where correo = 'm.bonten@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MIGUEL ÁNGEL CÁRDENAS YÉPEZ' where correo = 'm.cardenas@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARBELIS EVA DÁVILA SANTAELLA' where correo = 'm.davila@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MIGUEL ÁNGEL ESPINOZA' where correo = 'm.espinoza@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARÍA JOSÉ HERNÁNDEZ MORALES' where correo = 'm.hernandez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARTÍN RAFAEL JIMÉNEZ CALVO' where correo = 'm.jimenez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARILIN ANDREINA NÚÑEZ ARRAIZ' where correo = 'm.nunez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MANUEL EDUARDO RODRÍGUEZ PEREIRA' where correo = 'm.rodriguez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARÍA FERNANDA RUIZ GONZÁLEZ' where correo = 'm.ruiz@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARIENNY DANIELA SANTOS GONZÁLEZ' where correo = 'm.santos@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MILAGROS DE JESÚS TORRES GONZÁLEZ' where correo = 'm.torre@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MORELLA CARMONA DE HERNÁNDEZ' where correo = 'mc.gonzalez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARÍA ROSANA RODRÍGUEZ GUZMÁN' where correo = 'mr.rodriguez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'NAHIRY DE JESÚS ALCINA VELÁSQUEZ' where correo = 'n.alcina@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'NELSON JOSÉ BERRIOS' where correo = 'n.berrios@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'NATHALIA YUSMAIRI GUILLÉN LÓPEZ' where correo = 'n.guillen@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'NELLY DEL CARMEN RÍOS DEAL' where correo = 'n.rios@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'NANCY DEL CARMEN TOVAR SÁNCHEZ' where correo = 'n.tovar@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'HERNÁN ENRIQUE MARCANO OBERTO' where correo = 'o.marcano@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ORIANA PATRICIA PÉREZ CABELLO' where correo = 'o.perez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ORLANDO JOSÉ YÁÑEZ SÁEZ' where correo = 'o.yanez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'MARÍA PATRICIA FERREIRA MENDOZA' where correo = 'p.ferreira@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'RAHELENYS JOSUÉ BURGOS SANTAELLA' where correo = 'r.burgos@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'RENNY MOISÉS POLEO GASCÓN' where correo = 'r.poleo@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'ROMELIS MARÍA VIÑA GARCÍA' where correo = 'r.vina@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'SASKIA CATHERYN VICTORIA CALDERÓN VÉLIZ' where correo = 's.calderon@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'SOLISVER COROMOTO URBÁEZ DE SANDOVAL' where correo = 's.urbaez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'SARAY AILEMAR VERDÚ ARAGOT' where correo = 's.verdu@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'XIOMARA SANDOVAL NARVÁEZ' where correo = 'x.sandoval@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'YOLISKAR DE LOS ÁNGELES DÍAZ VELÁSQUEZ' where correo = 'y.diaz@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'YENAIDA FAGÚNDEZ VERA' where correo = 'y.fagundez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'YURAIMA KARINA MARTÍNEZ DÍAZ' where correo = 'y.martinez@ciip.com.ve';
update gtic.correos_permitidos set nombre = 'YESENIA JANERYS MARTÍNEZ ESCALONA' where correo = 'ye.martinez@ciip.com.ve';


-- ---------------------------------------------------------------------
-- Verificación: debería quedar en 158 el total de @ciip.com.ve, más lo
-- que ya hubiera de otros dominios (Marca País con gmail, si queda
-- alguno; el gob.ve de Alejandro Puglia).
-- ---------------------------------------------------------------------
select count(*) filter (where correo like '%@ciip.com.ve') as ciip_com_ve,
       count(*) as total
  from gtic.correos_permitidos;
