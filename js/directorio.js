/* ---------- Directorio de la casa ----------
   Quién trabaja dónde. Dos fuentes:

   · CIIP: "Listado_de_personal_150926_Correos_Completo.xlsx", el corte del
     15/09/2026, 158 personas. Antes traía 176, del "Listado General correos
     activos" de agosto; se comparó nombre por nombre contra este corte
     nuevo —27 ya no aparecen y se sacaron, 9 son altas que no estaban antes—
     y de paso corrigió tres cruces de nombre que venían mal desde agosto:
     Frenddy Enrique Santana Buitriago -> Buitrago, "Bracho Angel" -> Angel
     Domingo Bracho Garcia, y Rosbely del Carmen Bracho Indriago -> Godoy
     Briceño (el apellido de otra persona, copiado por error al restaurar
     piso y oficina en agosto —ver más abajo—).
   · Marca País: "Listado de los correos" del Instituto (18/08/2026), 48
     de sus 50 personas —quedaron fuera dos sin correo en ese listado, sin
     forma de registrar una cuenta—, cruzadas por cédula contra el corte de
     control de acceso del 27/07/2026 para recuperar gerencia, piso,
     oficina y cargo: ese Excel solo traía cédula, nombre y el Gmail. No se
     tocó con el corte del 15/09: ese listado es solo del CIIP.

   206 personas en total (158 + 48). Sirve para que nadie escriba su
   gerencia ni su cargo: escribe su nombre, se elige de la lista y el resto
   se llena solo.

   NO LLEVA CÉDULA, a propósito. La versión anterior sí la llevaba, con esta
   nota: "vale mientras esto viva en la red interna; el día que el sitio salga
   a internet, esta columna hay que sacarla". El sitio ya salió a internet
   (https://soporte-ciip.vercel.app, público, sin clave), así que se saca
   ahora: la Hoja de Servicio sigue pudiendo llevar cédula, pero la escribe
   quien pide, no la sirve este archivo a cualquiera que abra la página.

   Piso y oficina: el corte del 15/09 no los trae —solo dependencia, cargo
   y correo—, así que para las 149 personas del CIIP que ya estaban aquí se
   conservó lo que había (cruzado por nombre, sin mirar tildes ni mayúsculas,
   contra el corte anterior). Las 9 altas del corte nuevo quedan sin piso ni
   oficina, igual que cualquiera sin ese dato: el formulario ya sabe llenar
   ese hueco a mano.

   No lleva correo ni contraseña, ni falta que hacen aquí: los correos van
   en gtic.correos_permitidos (ver sql/), que decide quién puede REGISTRARSE,
   no quién aparece al elegirse de esta lista — son dos preguntas distintas,
   y una de las dos sí puede vivir en un archivo que el navegador de
   cualquiera descarga sin clave. La otra, nunca.
   Prefijo: DIRECTORIO. */
const DIRECTORIO = [
  {nombre:'Aimee Estefania Ruiz Galavis', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Profesional'},
  {nombre:'Airuth del Valle Irazabal Hurtado', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Alejandro Enrique Puglia Costas', gerencia:'PRESIDENCIA', piso:'9', oficina:'', cargo:'Presidente'},
  {nombre:'Alexander Daniel Blanco Ladino', gerencia:'GERENCIA GENERAL DEL DESPACHO', piso:'8', oficina:'8-02', cargo:'Coordinador'},
  {nombre:'Alfredo Antonio Carrera Pérez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Gerente'},
  {nombre:'Amarielys Gisel González Muñoz', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Profesional'},
  {nombre:'Ana María Arraiz de Conde', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Bachiller'},
  {nombre:'Ana María Villarroel', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Andry Jesús Tovar Cabrera', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Profesional'},
  {nombre:'Ángel Domingo Bracho García', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'', oficina:'', cargo:'Coordinador'},
  {nombre:'Angelica María Ramírez Arellano', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-03', cargo:'Bachiller'},
  {nombre:'Anghela Jacqueline Andrius Dávila Márquez', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Annelin del Carmen Pérez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'', oficina:'', cargo:'Gerente'},
  {nombre:'Aquiles Augusto Figueroa Mendoza', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Bachiller'},
  {nombre:'Barbara Yaneth Depablos Torres', gerencia:'GERENCIA GENERAL DE SEGURIDAD INTEGRAL', piso:'', oficina:'', cargo:'Bachiller'},
  {nombre:'Carlos Alberto Belisario Silva', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Profesional'},
  {nombre:'Carlos Eduardo Barreto González', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Carlos Eduardo Galindo Suárez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Carlos Eduardo Perea Rangel', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Bachiller'},
  {nombre:'Carlos Enrique Manzano Kossik', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Gerente'},
  {nombre:'Carlos Manuel Rodríguez López', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-06', cargo:'Bachiller'},
  {nombre:'Carmen Oviedo Urrutia', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Bachiller'},
  {nombre:'Carolina Forgione Franco', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Tecnico'},
  {nombre:'Carolina Isabel Vargas Julio', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Asesor Tecnico'},
  {nombre:'Chuaima Felipe Salas Camacho', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'', oficina:'', cargo:'Gerente'},
  {nombre:'Dailyn Alejandra Romero Ardiles', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Tecnico'},
  {nombre:'Dan Keisdert Moreno', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Bachiller'},
  {nombre:'Danger Luis Rivero Ruiz', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Bachiller'},
  {nombre:'Daniela Patricia Fermín Bandres', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'', oficina:'', cargo:'Coordinador'},
  {nombre:'Danny Joel Aponte Aponte', gerencia:'GERENCIA GENERAL DE SEGURIDAD INTEGRAL', piso:'4', oficina:'4-07', cargo:'Gerente'},
  {nombre:'Danyil Rafael Lugo Celis', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Obrero Certificado'},
  {nombre:'Deinyelbert Jocksaniel Rodríguez Sarmiento', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Bachiller Iii - Vii'},
  {nombre:'Desiree Alejandra Cordero Lobo', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-04', cargo:'Bachiller'},
  {nombre:'Diana Carolina Bracho Indriago', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Tecnico'},
  {nombre:'Dilia Yamilet Serrano Pérez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Gerente'},
  {nombre:'Divarlys Nakarith Ocando Faneyte', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Gerente'},
  {nombre:'Douglas Emilio Prin Pereira', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Tecnico'},
  {nombre:'Eddy Yolanda Peña de Granado', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Gerente'},
  {nombre:'Edgar Alejandro Bolívar Sánchez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'', oficina:'', cargo:'Obrero Certificado'},
  {nombre:'Edward Jhonny González', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'2', oficina:'2-03', cargo:'Coordinador'},
  {nombre:'Elías Josué Martínez Luque', gerencia:'PRESIDENCIA', piso:'9', oficina:'', cargo:'Asistente Ejecutivo'},
  {nombre:'Eliub Ricardo Solórzano Pérez', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Gerente'},
  {nombre:'Ellius Enrique Ríos Hernández', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Emely Miraidy García Osuna', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-06', cargo:'Tecnico'},
  {nombre:'Emely Nazaret Escalona Correa', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-09', cargo:'Asesor Profesional'},
  {nombre:'Enry Josué Durán', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'', oficina:'', cargo:'Gerente General'},
  {nombre:'Ericka Dubraska Flores Acevedo', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Gerente'},
  {nombre:'Felix Armando Arraiz Planchart', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Profesional'},
  {nombre:'Franklin David Reyes Delgado', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Bachiller'},
  {nombre:'Franklin Nayit Acosta Angarita', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Bachiller'},
  {nombre:'Fravia Vanessa Márquez de Fernández', gerencia:'PRESIDENCIA', piso:'8', oficina:'8-02', cargo:'Asesor Profesional'},
  {nombre:'Frenddy Enrique Santana Buitrago', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Gabriel Ramón Reyes Rangel', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'8', oficina:'8-02', cargo:'Obrero Certificado'},
  {nombre:'Gabriela Carolina de los Ángeles Brito Gómez', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Geraldyn de los Ángeles López Rojas', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Asistente Ejecutivo'},
  {nombre:'Germán Javier Gerardino Díaz', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Coordinador'},
  {nombre:'Guillermo Alexander Torres', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'Gustavo José Zúñiga', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Bachiller'},
  {nombre:'Héctor José Bravo Osuna', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Coordinador'},
  {nombre:'Hedwing José Gutiérrez Blanco', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Gerente'},
  {nombre:'Hernán Enrique Marcano Oberto', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Asesor Tecnico'},
  {nombre:'Hilda Anais Newman Mijares', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Imari del Valle Vásquez Capote', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Tecnico'},
  {nombre:'Isabel María Peñaranda', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Isbelis Marielys Pérez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Isolimar Coromoto Sánchez Fernández', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Coordinador'},
  {nombre:'Iván Arley Llanos', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Asesor Tecnico'},
  {nombre:'Jackelyn Josefina Bermejo', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Jesly Oriana Báez Macedo', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-04', cargo:'Bachiller'},
  {nombre:'Jessica Erlynes Rodríguez Álvarez', gerencia:'GERENCIA GENERAL DEL DESPACHO', piso:'8', oficina:'8-02', cargo:'Profesional'},
  {nombre:'Jesús Antonio Arellano Natera', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Gerente General'},
  {nombre:'Jipson Jesús Granadillo Albarrán', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Bachiller'},
  {nombre:'Joel Román Aguilar Castro', gerencia:'VICEPRESIDENCIA', piso:'9', oficina:'', cargo:'Asistente Ejecutivo'},
  {nombre:'Johanna Betzabeth de Almada Nieves', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-06', cargo:'Profesional'},
  {nombre:'Jojan José Valbuena García', gerencia:'GERENCIA GENERAL DEL DESPACHO', piso:'8', oficina:'8-02', cargo:'Coordinador'},
  {nombre:'Jonathan Avisai Morales Martínez', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Jonathan George Urbina Fernández', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Obrero Certificado'},
  {nombre:'José Gregorio Hernández Villegas', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Gerente'},
  {nombre:'José Manuel Barrios Riera', gerencia:'GERENCIA GENERAL DE SEGURIDAD INTEGRAL', piso:'4', oficina:'4-07', cargo:'Gerente General'},
  {nombre:'José Rafael Olivares Rodríguez', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Gerente'},
  {nombre:'Juber Anulfo Mendoza', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Tecnico'},
  {nombre:'Julmar Enrique Morón Vásquez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Gerente'},
  {nombre:'Karelys Juliett Sánchez López', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Profesional'},
  {nombre:'Karen de Jesús Pérez Muñoz', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-09', cargo:'Asesor Profesional'},
  {nombre:'Karina Valeria Valero Zárraga', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'', oficina:'', cargo:'Gerente'},
  {nombre:'Karla Rosibel Sierra Palacios', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'', oficina:'', cargo:'Coordinador'},
  {nombre:'Katiuska del Valle Díaz Yáñez', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Gerente General'},
  {nombre:'Katiuska Elizabeth Sánchez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Kristina Dugnas Sulcas', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Gerente General'},
  {nombre:'Leomary Andreina Malavé Moreno', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-06', cargo:'Gerente'},
  {nombre:'Loisbeth Mariana Corvos Arismendi', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Asistente Ejecutivo'},
  {nombre:'Lucía Sampaio Martins', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-09', cargo:'Asesor Profesional'},
  {nombre:'Luigersy Enrique Correa Méndez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Bachiller Iii - Vii'},
  {nombre:'Luis Alberto Ortega', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-03', cargo:'Asesor Profesional'},
  {nombre:'Luis Alejandro Flores González', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Bachiller'},
  {nombre:'Luis Miguel Ferrer Belgoderi', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Asesor Profesional'},
  {nombre:'Luis Vicente García Lamas', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-06', cargo:'Profesional'},
  {nombre:'Mairin Celeste Camacho Escobar', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-09', cargo:'Asesor Profesional'},
  {nombre:'Manuel Eduardo Rodríguez Pereira', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Asesor Profesional'},
  {nombre:'Marbelis Eva Dávila Santaella', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Profesional'},
  {nombre:'Marco Antonio Magallanes Grillet', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-07', cargo:'Consultor Juridico'},
  {nombre:'María Emilia Torres Bonten', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'María Fernanda Ruiz González', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'María José Hernández Morales', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Profesional'},
  {nombre:'María Patricia Ferreira Mendoza', gerencia:'PRESIDENCIA', piso:'9', oficina:'', cargo:'Asistente Ejecutivo'},
  {nombre:'María Rosana Rodríguez Guzmán', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Bachiller Iii - Vii'},
  {nombre:'Maribella Aguilar Peraza', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Profesional'},
  {nombre:'Mariela Andrea Curvelo Hernández', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Bachiller'},
  {nombre:'Mariela Josefina Rodríguez Peralta', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'', oficina:'', cargo:'Asesor Profesional'},
  {nombre:'Marienny Daniela Santos González', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Marilin Andreina Núñez Arraiz', gerencia:'GERENCIA GENERAL DE SEGURIDAD INTEGRAL', piso:'4', oficina:'4-07', cargo:'Tecnico'},
  {nombre:'Marinel Luzey Colmenares Blanco', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Martín Rafael Jiménez Calvo', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Asesor Profesional'},
  {nombre:'Marysabel Aguilar Peraza', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Profesional'},
  {nombre:'Mazuris Jiraly Azócar Benítez', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Profesional'},
  {nombre:'Miguel Ángel Cárdenas Yépez', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Tecnico'},
  {nombre:'Miguel Ángel Espinoza', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Milagros de Jesús Torres González', gerencia:'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN', piso:'2', oficina:'2-01', cargo:'Asistente Ejecutivo'},
  {nombre:'Morella Carmona de Hernández', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Profesional'},
  {nombre:'Nahiry de Jesús Alcina Velásquez', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Tecnico'},
  {nombre:'Nancy del Carmen Tovar Sánchez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Asesor Profesional'},
  {nombre:'Nathalia Yusmairi Guillén López', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Bachiller Iii - Vii'},
  {nombre:'Nelly del Carmen Ríos Deal', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Nelson José Berrios', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Obrero General'},
  {nombre:'Noraima del Milagro Coy Parra', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Asistente Ejecutivo'},
  {nombre:'Oriana Gabriela Reina Mayora', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'Oriana Patricia Pérez Cabello', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Bachiller'},
  {nombre:'Orlando José Yáñez Sáez', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'3', oficina:'3-02', cargo:'Obrero Certificado'},
  {nombre:'Rahelenys Josué Burgos Santaella', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-03', cargo:'Gerente General'},
  {nombre:'Rayda Ysabel Vera Parra', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Auditor Interno'},
  {nombre:'Renny Moisés Poleo Gascón', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Profesional'},
  {nombre:'Romelis María Viña García', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'Ronnie Percak Mendoza', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Asesor Profesional'},
  {nombre:'Rosbely del Carmen Godoy Briceño', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'Rosmary Mariana Pantoja Blanco', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Asistente Ejecutivo'},
  {nombre:'Saray Ailemar Verdú Aragot', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Profesional'},
  {nombre:'Saskia Catheryn Victoria Calderón Véliz', gerencia:'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL', piso:'2', oficina:'2-04', cargo:'Profesional'},
  {nombre:'Saudy Coromoto Contreras', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Bachiller'},
  {nombre:'Solangel Nailyn Suinagas Rada', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'2', oficina:'2-03', cargo:'Coordinador'},
  {nombre:'Solisver Coromoto Urbáez de Sandoval', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Coordinador'},
  {nombre:'Treizen Guanipa', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-01', cargo:'Profesional'},
  {nombre:'Valeria Carolina Ramos Ramos', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'', oficina:'', cargo:'Profesional'},
  {nombre:'Vicente Paul Castillo Castellanos', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Profesional'},
  {nombre:'Víctor Alejandro Jesús Corredor Suárez', gerencia:'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS', piso:'', oficina:'', cargo:'Asesor Profesional'},
  {nombre:'Wilfredo Niebles Villasmil', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Tecnico'},
  {nombre:'William Alfredo Castillo Bolle', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Gerente General'},
  {nombre:'Xiomara Sandoval Narváez', gerencia:'GERENCIA GENERAL DE GESTIÓN HUMANA', piso:'4', oficina:'4-09', cargo:'Coordinador'},
  {nombre:'Yarizmit Gheinsy Herrera Medina', gerencia:'AUDITORÍA INTERNA', piso:'2', oficina:'2-05', cargo:'Profesional'},
  {nombre:'Yeitson José Laguna Leal', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'', oficina:'', cargo:'Obrero Certificado'},
  {nombre:'Yelinet Alexandra Ibarra Isturiz', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Yelitza Yatzyl Armas Liendo', gerencia:'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO', piso:'3', oficina:'3-02', cargo:'Tecnico'},
  {nombre:'Yenaida Fagúndez Vera', gerencia:'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO', piso:'4', oficina:'4-05', cargo:'Profesional'},
  {nombre:'Yender Yuhuare Mendoza', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero General'},
  {nombre:'Yeniffer del Carmen Betancourt', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-08', cargo:'Obrero Supervisor'},
  {nombre:'Yesenia Janerys Martínez Escalona', gerencia:'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA', piso:'4', oficina:'4-02', cargo:'Gerente'},
  {nombre:'Yoliskar de los Ángeles Díaz Velásquez', gerencia:'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES', piso:'1', oficina:'1-02', cargo:'Profesional'},
  {nombre:'Yosmary Vanesa Valero Paredes', gerencia:'GERENCIA GENERAL DE SEGURIDAD INTEGRAL', piso:'', oficina:'', cargo:'Bachiller'},
  {nombre:'Yuraima Karina Martínez Díaz', gerencia:'CONSULTORÍA JURÍDICA', piso:'2', oficina:'2-02', cargo:'Asesor Especialista'},

  /* Marca País, del "Listado de los correos" del Instituto Marca País
     (18/08/2026): 48 personas —de 50, quedaron fuera Manuel Marcial y
     Miguel Angel Zapata Torres, sin correo en ese listado y por lo tanto
     sin forma de registrar una cuenta—, cruzadas por cédula contra el
     corte de control de acceso del 27/07/2026 para recuperar gerencia,
     piso, oficina y cargo. Ese Excel no traía esos datos, solo cédula,
     nombre y el Gmail personal (ver gtic.correos_permitidos).

     Cuatro no cruzaron —dadas de alta después del corte de acceso, o con
     la cédula mal tecleada en alguno de los dos listados— y se agregan
     solo con el nombre, sin gerencia: el formulario ya sabe llenar ese
     hueco a mano, igual que con piso y oficina. */
  {nombre:'Adriana Carolina Sánchez', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Administrativo'},
  {nombre:'Aidyn Paulina Moreno Escalona', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Profesional'},
  {nombre:'Aimara Alexandra Martínez Cerezo', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Profesional'},
  {nombre:'Alexis Manuel Velásquez Cañate', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Andrea Martínez Carpio', gerencia:'PRESIDENCIA (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Antonio José Gregorio Ramos Martínez', gerencia:'CONSULTORÍA JURÍDICA (MARCA PAÍS)', piso:'3', oficina:'3-04', cargo:'Apoyo Profesional'},
  {nombre:'Arizay Ismaelyn Eekhaut Molina', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Aseadora'},
  {nombre:'Astrid Karina Uribe Sánchez', gerencia:'GERENTE DE ARTICULACIÓN ESTRATÉGICA PARA EL IMPULSO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Gerente de Articulación'},
  {nombre:'Carlos Alberto Durán Sánchez', gerencia:'GERENTE DE ARTICULACIÓN ESTRATÉGICA PARA EL IMPULSO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Darwin Nivaldo Zuarce', gerencia:'GERENCIA DE GESTIÓN HUMANA (MARCA PAÍS)', piso:'3', oficina:'3-04', cargo:'Apoyo Profesional'},
  {nombre:'David Alexander Guerrero Figueroa', gerencia:'', piso:'', oficina:'', cargo:''},
  {nombre:'Dayana Verónica Chediak Kasrin', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Honorarios Profesionales'},
  {nombre:'Dayana del Carmen Lara Cornielis', gerencia:'AUDITORÍA INTERNA (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Profesional'},
  {nombre:'Dayannis del Valle Álvarez Millán', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Edgar Mata', gerencia:'', piso:'', oficina:'', cargo:''},
  {nombre:'Edignorelia Valbuena Morales', gerencia:'GERENCIA GENERAL DE REGULACIÓN, USO Y SEGUIMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Institucional'},
  {nombre:'Edward Eduardo Lunar', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Administrativo'},
  {nombre:'Elizabeth Mendoza', gerencia:'GERENCIA GENERAL DE REGULACIÓN, USO Y SEGUIMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Gerente General de Regulación'},
  {nombre:'Ender José Cobarrubia', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Técnico'},
  {nombre:'Erich Nailen Escalante de Dulcey', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Profesional'},
  {nombre:'Gabriela Liendo Paredes', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Técnico'},
  {nombre:'Génesis Ivanova González Dicuru', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Institucional'},
  {nombre:'Ivette Andreina Domínguez Gómez', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Profesional'},
  {nombre:'Jhoanyeli Nazareth González González', gerencia:'', piso:'', oficina:'', cargo:''},
  {nombre:'Jhon Manuel Gutiérrez Marín', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Profesional'},
  {nombre:'Joeli Vanessa Martínez Welma', gerencia:'GERENCIA GENERAL (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Jonel Manuel Ortiz Denis', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'José Ángel Guerra', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Profesional'},
  {nombre:'Judelys Daniela Romero Espinoza', gerencia:'GERENCIA GENERAL (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Gerente General'},
  {nombre:'Karen Luisana Monsalve Cedres', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Lisbeth Amparo Padilla Arnal', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Honorarios Profesionales'},
  {nombre:'Maritza Beatriz Nadales', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Institucional'},
  {nombre:'Michelangely Josefina Griffith Añazco', gerencia:'GERENCIA DE ATENCIÓN CIUDADANA (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Gerente'},
  {nombre:'Niki Benjamín Herrera Gómez', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Honorarios Profesionales'},
  {nombre:'Ninoska García Pérez', gerencia:'GERENCIA DE GESTIÓN HUMANA (MARCA PAÍS)', piso:'3', oficina:'3-04', cargo:'Apoyo Profesional'},
  {nombre:'Niurka Carolina Quintero Contreras', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Gerente'},
  {nombre:'Omar Rogelio García', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Institucional'},
  {nombre:'Patricia Carolina Miranda Villamizar', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Técnico'},
  {nombre:'Ramón Antonio Narváez Flores', gerencia:'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Gerente General de Promociones'},
  {nombre:'Manuel Alexander Reyes Rodríguez', gerencia:'', piso:'4', oficina:'4-06', cargo:''},
  {nombre:'Rubén Ernesto Moreno Vásquez', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Gerente'},
  {nombre:'Stefany Valentina Mendible Ramírez', gerencia:'PRESIDENCIA (MARCA PAÍS)', piso:'3', oficina:'3-01', cargo:'Apoyo Profesional'},
  {nombre:'Tana Valentina Vásquez Rojas', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Administrativo'},
  {nombre:'Víctor José Mosalve Rodríguez', gerencia:'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Chofer'},
  {nombre:'Vincent Orlando Oropeza', gerencia:'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)', piso:'3', oficina:'3-05', cargo:'Apoyo Profesional'},
  {nombre:'Yaneth Mercedes Duarte de Ortiz', gerencia:'GERENCIA DE PLANIFICACIÓN Y PRESUPUESTO (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Apoyo Profesional'},
  {nombre:'Yannely Domínguez Salcedo', gerencia:'GERENCIA DE GESTIÓN HUMANA (MARCA PAÍS)', piso:'3', oficina:'3-04', cargo:'Gerente'},
  {nombre:'Yarumi Tarazon Betancourt', gerencia:'GERENCIA DE PLANIFICACIÓN Y PRESUPUESTO (MARCA PAÍS)', piso:'4', oficina:'4-06', cargo:'Gerente'},
];

/* Busca por nombre exacto, sin distinguir mayúsculas, espacios de sobra ni
   tildes: "Jesus" y "Jesús" son el mismo nombre mal tecleado, no dos personas
   distintas, así que exigirle la tilde exacta solo rompía el auto-completado
   sin evitar ningún homónimo real. Sigue siendo el nombre completo, letra por
   letra salvo el acento: no se adivina por parecido. */
function directorioBuscar(nombre){
  const limpiar = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const n = limpiar(nombre);
  if(!n) return null;
  return DIRECTORIO.find(p => limpiar(p.nombre) === n) || null;
}
