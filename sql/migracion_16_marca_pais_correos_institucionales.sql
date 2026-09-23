-- =====================================================================
-- Solicitudes de soporte · GGTIC · CIIP
-- Migración 16: Marca País entra a correos_permitidos con su correo institucional
-- Se pega en el SQL Editor de Supabase y se corre una sola vez.
--
-- De dónde sale esto:
--
-- "LISTADO DE PERSONAL 18-09-26 PARA CORREOS INSTITUCIONALES (1).xlsx" —hoja
-- "PERSONAL ADSCRITO MP", personal del Instituto Marca País al 21-08-2026,
-- 51 personas— trae por fin el correo @ciip.com.ve de cada quien. Hasta
-- ahora se autorizaban con el Gmail personal (migración 10), y esos se
-- borraron todos de correos_permitidos; desde entonces nadie de Marca País
-- podía registrarse. Esta migración les da su correo de verdad.
--
-- Se comparó contra las 165 filas que había en gtic.correos_permitidos: no
-- hay ningún correo repetido ni ningún nombre que ya estuviera con otro
-- correo, así que todo es alta limpia.
--
-- Tres cosas del listado que se tocaron, y una que NO:
--
--   · La fila 36 (Yarumi Tarazón Betancourt) venía con el correo
--     "@ciip.com.vey.tarazon" —la parte de adelante y el dominio
--     mezclados—. Se agrega como y.tarazon@ciip.com.ve, que es lo que
--     claramente quiso ser, con el mismo patrón inicial.apellido de las
--     otras 50 filas.
--   · Dos correos venían con mayúsculas (m.Griffith, d.Chediak): se pasan
--     a minúscula, que es como los guarda y compara la tabla.
--   · Los nombres van con las tildes que faltaban (Martínez, Domínguez,
--     Rubén, Ángel, Verónica…), igual que en el resto de la casa.
--   · NO se tocaron dos correos que parecen tener un error de tipeo pero
--     que son los que asignó el correo institucional, y arreglarlos aquí
--     sería inventar: ja.gerra@ciip.com.ve (¿guerra?, José Ángel Guerra) y
--     v.monsalve@ciip.com.ve (Víctor José Mosalve Rodríguez: el apellido
--     del nombre y el del correo no coinciden). Si alguno de los dos está
--     mal, la persona no va a poder registrarse; se corrige desde
--     "Correos permitidos" en la bandeja —Quitar y volver a agregar—.
--
-- on conflict do nothing: a quien ya esté en la lista no se le toca.
-- =====================================================================

insert into gtic.correos_permitidos (correo, nombre) values
  ('a.carpio@ciip.com.ve', 'ANDREA MARTÍNEZ CARPIO'),
  ('a.eekhaut@ciip.com.ve', 'ARIZAY ISMAELYN EEKHAUT MOLINA'),
  ('a.moreno@ciip.com.ve', 'AIDYN PAULINA MORENO ESCALONA'),
  ('a.ramos@ciip.com.ve', 'ANTONIO JOSÉ GREGORIO RAMOS MARTÍNEZ'),
  ('a.uribe@ciip.com.ve', 'ASTRID KARINA URIBE SÁNCHEZ'),
  ('a.velasquez@ciip.com.ve', 'ALEXIS MANUEL VELÁSQUEZ CAÑATE'),
  ('aa.martinez@ciip.com.ve', 'AIMARA ALEXANDRA MARTÍNEZ CEREZO'),
  ('ac.sanchez@ciip.com.ve', 'ADRIANA CAROLINA SÁNCHEZ'),
  ('an.tarazon@ciip.com.ve', 'ANDREINA TARAZÓN BOLÍVAR'),
  ('c.duran@ciip.com.ve', 'CARLOS ALBERTO DURÁN SÁNCHEZ'),
  ('d.alvarez@ciip.com.ve', 'DAYANNIS DEL VALLE ÁLVAREZ MILLÁN'),
  ('d.chediak@ciip.com.ve', 'DAYANA VERÓNICA CHEDIAK KASRIN'),
  ('d.guerrero@ciip.com.ve', 'DAVID ALEXANDER GUERRERO FIGUEROA'),
  ('d.lara@ciip.com.ve', 'DAYANA DEL CARMEN LARA CORNIELIS'),
  ('d.zuarce@ciip.com.ve', 'DARWIN NIVALDO ZUARCE'),
  ('e.cobarrubia@ciip.com.ve', 'ENDER JOSÉ COBARRUBIA'),
  ('e.escalante@ciip.com.ve', 'ERICH NAILEN ESCALANTE DE DULCEY'),
  ('e.lunar@ciip.com.ve', 'EDWARD EDUARDO LUNAR'),
  ('e.mata@ciip.com.ve', 'EDGAR LUIS MATA'),
  ('e.mendoza@ciip.com.ve', 'ELIZABETH MENDOZA'),
  ('e.valbuena@ciip.com.ve', 'EDIGNORELIA VALBUENA MORALES'),
  ('g.gonzalez@ciip.com.ve', 'GÉNESIS IVANOVA GONZÁLEZ DICURU'),
  ('g.liendo@ciip.com.ve', 'GABRIELA MARÍA LIENDO PAREDES'),
  ('i.dominguez@ciip.com.ve', 'IVETTE ANDREINA DOMÍNGUEZ GÓMEZ'),
  ('j.gonzalez@ciip.com.ve', 'JHOANYELI NAZARETH GONZÁLEZ GONZÁLEZ'),
  ('j.gutierrez@ciip.com.ve', 'JHON MANUEL GUTIÉRREZ MARÍN'),
  ('j.martinez@ciip.com.ve', 'JOELI VANESSA MARTÍNEZ WELMA'),
  ('j.ortiz@ciip.com.ve', 'JONEL MANUEL ORTIZ DENIS'),
  ('j.romero@ciip.com.ve', 'JUDELYS DANIELA ROMERO ESPINOZA'),
  ('ja.gerra@ciip.com.ve', 'JOSÉ ÁNGEL GUERRA'),
  ('k.monsalve@ciip.com.ve', 'KAREN LUISANA MONSALVE CEDRES'),
  ('l.padilla@ciip.com.ve', 'LISBETH AMPARO PADILLA ARNAL'),
  ('m.griffith@ciip.com.ve', 'MICHELANGELY JOSEFINA GRIFFITH AÑAZCO'),
  ('m.mendez@ciip.com.ve', 'MARCIAL MARTÍN MANUEL MÉNDEZ'),
  ('m.nadales@ciip.com.ve', 'MARITZA BEATRIZ NADALES'),
  ('m.reyes@ciip.com.ve', 'MANUEL ALEXANDER REYES RODRÍGUEZ'),
  ('m.zapata@ciip.com.ve', 'MIGUEL ÁNGEL ZAPATA TORRES'),
  ('n.garcia@ciip.com.ve', 'NINOSKA GARCÍA PÉREZ'),
  ('n.herrera@ciip.com.ve', 'NIKI BENJAMÍN HERRERA GÓMEZ'),
  ('n.quintero@ciip.com.ve', 'NIURKA CAROLINA QUINTERO CONTRERAS'),
  ('o.garcia@ciip.com.ve', 'OMAR ROGELIO GARCÍA'),
  ('p.miranda@ciip.com.ve', 'PATRICIA CAROLINA MIRANDA VILLAMIZAR'),
  ('r.calzadilla@ciip.com.ve', 'ROSA AMELIA CALZADILLA'),
  ('r.moreno@ciip.com.ve', 'RUBÉN ERNESTO MORENO VÁSQUEZ'),
  ('s.mendible@ciip.com.ve', 'STEFANY VALENTINA MENDIBLE RAMÍREZ'),
  ('t.vasquez@ciip.com.ve', 'TANA VALENTINA VÁSQUEZ ROJAS'),
  ('v.monsalve@ciip.com.ve', 'VICTOR JOSÉ MOSALVE RODRÍGUEZ'),
  ('v.oropeza@ciip.com.ve', 'VINCENT ORLANDO OROPEZA'),
  ('y.dominguez@ciip.com.ve', 'YANNELY DOMÍNGUEZ SALCEDO'),
  ('y.duarte@ciip.com.ve', 'YANETH MERCEDES DUARTE DE ORTIZ'),
  ('y.tarazon@ciip.com.ve', 'YARUMI TARAZÓN BETANCOURT')
on conflict (correo) do nothing;

-- Verificación: deberían salir 51 filas nuevas de Marca País.
select count(*) as marca_pais_agregados
  from gtic.correos_permitidos
 where correo in (
  'an.tarazon@ciip.com.ve',
  's.mendible@ciip.com.ve',
  'a.carpio@ciip.com.ve',
  'r.calzadilla@ciip.com.ve',
  'e.mata@ciip.com.ve',
  'd.lara@ciip.com.ve',
  'm.zapata@ciip.com.ve',
  'j.romero@ciip.com.ve',
  'j.martinez@ciip.com.ve',
  'j.gonzalez@ciip.com.ve',
  'a.ramos@ciip.com.ve',
  'e.mendoza@ciip.com.ve',
  'e.valbuena@ciip.com.ve',
  'a.uribe@ciip.com.ve',
  'c.duran@ciip.com.ve',
  'm.mendez@ciip.com.ve',
  'j.ortiz@ciip.com.ve',
  'g.gonzalez@ciip.com.ve',
  'a.velasquez@ciip.com.ve',
  'k.monsalve@ciip.com.ve',
  'd.alvarez@ciip.com.ve',
  'y.dominguez@ciip.com.ve',
  'd.zuarce@ciip.com.ve',
  'n.garcia@ciip.com.ve',
  'm.griffith@ciip.com.ve',
  'r.moreno@ciip.com.ve',
  'j.gutierrez@ciip.com.ve',
  'e.escalante@ciip.com.ve',
  'aa.martinez@ciip.com.ve',
  'ja.gerra@ciip.com.ve',
  't.vasquez@ciip.com.ve',
  'o.garcia@ciip.com.ve',
  'm.nadales@ciip.com.ve',
  'a.eekhaut@ciip.com.ve',
  'v.monsalve@ciip.com.ve',
  'y.tarazon@ciip.com.ve',
  'm.reyes@ciip.com.ve',
  'y.duarte@ciip.com.ve',
  'n.quintero@ciip.com.ve',
  'i.dominguez@ciip.com.ve',
  'v.oropeza@ciip.com.ve',
  'e.cobarrubia@ciip.com.ve',
  'p.miranda@ciip.com.ve',
  'e.lunar@ciip.com.ve',
  'ac.sanchez@ciip.com.ve',
  'l.padilla@ciip.com.ve',
  'd.chediak@ciip.com.ve',
  'n.herrera@ciip.com.ve',
  'a.moreno@ciip.com.ve',
  'g.liendo@ciip.com.ve',
  'd.guerrero@ciip.com.ve'
 );
