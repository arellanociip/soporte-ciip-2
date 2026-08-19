-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 10: Marca País entra a correos_permitidos
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 09.
--
-- De dónde sale esto:
--
-- El "Listado de los correos" del Instituto Marca País (18/08/2026): 50
-- personas con su Gmail personal. A pedido de la gerencia, Marca País entra
-- con Gmail y no con correo institucional, igual que se hizo antes con dos
-- cuentas del CIIP.
--
-- Solo 48 de las 50 traían correo: Manuel Marcial y Miguel Angel Zapata
-- Torres se quedaron fuera también de js/directorio.js, sin correo no hay
-- forma de que se registren. En cuanto GTIC consiga el suyo, se agregan
-- los dos: uno al directorio y otro a "Correos permitidos" en la bandeja.
--
-- on conflict do nothing: si alguno ya estuviera en la lista —por ejemplo,
-- si ya se había agregado a mano por algún caso puntual—, esta migración no
-- lo toca ni lo duplica.
-- =====================================================================

insert into gtic.correos_permitidos (correo, nombre) values
  ('kirisanz97@gmail.com', 'Adriana Carolina Sánchez'),
  ('paulinam2511@gmail.com', 'Aidyn Paulina Moreno Escalona'),
  ('aimaramartinez3@gmail.com', 'Aimara Alexandra Martínez Cerezo'),
  ('alexisvelasquez216@gmail.com', 'Alexis Manuel Velásquez Cañate'),
  ('avmartinezcarpio@gmail.com', 'Andrea Martinez Carpio'),
  ('antonio.ramos2001@gmail.com', 'Antonio José Gregorio Ramos Martinez'),
  ('arizay2022@gmail.com', 'Arizay Ismaelyn Eekhaut Molina'),
  ('astridkarinauribes@gmail.com', 'Astrid Karina Uribe Sánchez'),
  ('cads0716@gmail.com', 'Carlos Alberto Durán Sánchez'),
  ('darwinzuarce1@gmail.com', 'Darwin Nivaldo Zuarce'),
  ('dguerrero787@gmail.com', 'David Alexander Guerrero Figueroa'),
  ('dayanachediak@gmail.com', 'Dayana Veronica Chediak Kasrin'),
  ('dayanalara4891@gmail.com', 'Dayana del Carmen Lara Cornielis'),
  ('dayannisalvarezdm@gmail.com', 'Dayannis del Valle Alvárez Millán'),
  ('mataedgarluis@gmail.com', 'Edgar Mata'),
  ('edignorelia@gmail.com', 'Edignorelia Valbuena Morales'),
  ('edward.lunar.molina@gmail.com', 'Edward Eduardo Lunar'),
  ('ecmlegales@gmail.com', 'Elizabeth Mendoza'),
  ('encobagra@gmail.com', 'Ender José Cobarrubia'),
  ('nailenmoncada@gmail.com', 'Erich Nailen Escalante de Dulcey'),
  ('gliendo.digital@gmail.com', 'Gabriela Liendo Paredes'),
  ('genesis.bancoex@gmail.com', 'Genesis Ivanova González Dicuru'),
  ('ivetd2@gmail.com', 'Ivette Andreina Dominguez Gomez'),
  ('gonzalezjhoanyeli@gmail.com', 'Jhoanyeli Nazareth González González'),
  ('jhongutierrez1984@gmail.com', 'Jhon Manuel Gutiérrez Marín'),
  ('joelivanessa@gmail.com', 'Joeli Vanessa Martínez Welma'),
  ('ortizjonel777@gmail.com', 'Jonel Manuel Ortiz Denis'),
  ('joseangel1885@gmail.com', 'José Angel Guerra'),
  ('danielaroess@gmail.com', 'Judelys Daniela Romero Espinoza'),
  ('karenmonsalve1999@gmail.com', 'Karen Luisana Monsalve Cedres'),
  ('padilla.lisbeth@gmail.com', 'Lisbeth Amparo Padilla Arnal'),
  ('maritza.nadales@gmail.com', 'Maritza Beatriz Nadales'),
  ('michelangely.griffith83@gmail.com', 'Michelangely Josefina Griffith Añazco'),
  ('iknibhg@gmail.com', 'Niki Benjamin Herrera Gómez'),
  ('ninoskag0605@gmail.com', 'Ninoska García Perez'),
  ('niurkaquintero@gmail.com', 'Niurka Carolina Quintero Contreras'),
  ('vivereschino@gmail.com', 'Omar Rogelio Garcia'),
  ('emevep.dg@gmail.com', 'Patricia Carolina Miranda Villamizar'),
  ('ranarvaez86@gmail.com', 'Ramon Antonio Narvaez Flores'),
  ('mareyes72@gmail.com', 'Manuel Alexander Reyes Rodriguez'),
  ('rubenmoreno02@gmail.com', 'Ruben Ernesto Moreno Vasquez'),
  ('stefanyvmr02@gmail.com', 'Stefany Valentina Mendible Ramírez'),
  ('tanavvr@gmail.com', 'Tana Valentina Vásquez Rojas'),
  ('victorj.monsalve82@gmail.com', 'Victor José Mosalve Rodríguez'),
  ('orlaando25@gmail.com', 'Vincent Orlando Oropeza'),
  ('yduarteipostel2023@gmail.com', 'Yaneth Mercedes Duarte de Ortiz'),
  ('yanneyale2117@gmail.com', 'Yannely Dominguez Salcedo'),
  ('yarumitarazon@gmail.com', 'Yarumi Tarazon Betancourt')
on conflict (correo) do nothing;
