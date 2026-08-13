/* ---------- Qué equipo usa cada quien ----------
   Sale del CUADRO_INVENTARIO_OFICINA de Patrimonio. De cada renglón se toma
   solo lo que va impreso en la Hoja de Servicio —equipo, marca, modelo y
   serial— y se pega a la persona que lo usa.

   Para qué: el serial es el dato que nadie se sabe de memoria y el que más
   retrasa una hoja. Con esto, quien pide soporte por su computadora manda el
   serial sin escribirlo, y el técnico se lo encuentra puesto.

   Cómo se pegó cada equipo a su dueño: primero por cédula, que es exacta, y
   si el cuadro no la traía, por nombre —solo cuando el nombre del cuadro
   señala a una única persona del directorio—. Ante la duda, se deja fuera:
   más vale una hoja sin serial que una con el serial de otro.

   245 equipos de 94 personas. Los 124 restantes son de
   equipos sin dueño asignado en el cuadro ("VACANTE", "SIN USUARIO") o de
   gente que ya no está en el listado del personal.

   Esto es un punto de partida, no una autoridad: si el técnico ve que el
   equipo no es ese, lo corrige en la ficha y manda lo que corrigió.
   Prefijo: INVENTARIO. */
const INVENTARIO = {
  'Aimee Estefania Ruiz Galavis': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ30DR2'},
  ],
  'Alfredo Antonio Carrera Perez': [
    {equipo:'MONITOR', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'1S3209A86MJ724TY'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR40203120296'},
  ],
  'Amarielys Gisel Gonzalez Muñoz': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ30EB6'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR420320452'},
  ],
  'Ana Maria Arraiz de Conde': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ7870E'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL ABI', serial:'MMLY8AA00501OACB6850B'},
  ],
  'Andry Jesus Tovar Cabrera': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ0820A'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922042'},
  ],
  'Anghela Jacqueline Andrius Davila Marquez': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTF45U787'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ39R53'},
  ],
  'Annelin del Carmen Perez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ08L6P'},
  ],
  'Aquiles Augusto Figueroa Mendoza': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJYXGYZ'},
    {equipo:'MONITOR', marca:'LG', modelo:'V206HQL AB', serial:'007NTWG5U593'},
  ],
  'Barbara Yaismely Petterson Delgado': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ30DK8'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922006'},
  ],
  'Carlos Alberto Belisario Silva': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ392ET'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR202922024'},
    {equipo:'MOUSE', marca:'OTRA', modelo:'XTK-230', serial:'INC24061407237'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'XTK-130', serial:'INC24061413896'},
  ],
  'Carlos Eduardo Perea Rangel': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ92A48'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'00NTDV57658'},
  ],
  'Carmen Oviedo Urrutia': [
    {equipo:'CPU', marca:'VIEWSONIC', modelo:'TINKCENTRE M92P', serial:'MJ04T8V'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922054'},
  ],
  'Carolina Forgione Franco': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79725'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NFTA5L1763'},
  ],
  'Carolina Isabel Vargas Julio': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202120334'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79X60'},
  ],
  'Dailyn Alejandra Romero Ardiles': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ78Y7K'},
  ],
  'Dan Keisdert Moreno': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ956FF'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'10501673042'},
  ],
  'Danger Luis Rivero Ruiz': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ724NN'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTJJ5U788'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'008NTXR78002'},
    {equipo:'OTRO', marca:'OTRA', modelo:'V-1501', serial:'201017040101'},
  ],
  'Deiber Jose Francisco Sella Dominguez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ725MD'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTVS5U791'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTGY5T895'},
  ],
  'Desiree Alejandra Cordero Lobo': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ948VR'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4201921918'},
  ],
  'Diana Carolina Bracho Indriago': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR202922095'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ948XZ'},
    {equipo:'CPU', marca:'DELL', modelo:'ALL IN ONE', serial:'W14B8661TB001'},
  ],
  'Dilia Yamilet Serrano Perez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391KV'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922074'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4203120415'},
  ],
  'Divarlys Nakarith Ocando Faneyte': [
    {equipo:'MONITOR', marca:'OTRA', modelo:'G2712', serial:'CD5T572160039*5'},
    {equipo:'CPU', marca:'OTRA', modelo:'CS515XTK02', serial:'IWC2164310595'},
  ],
  'Douglas Emilio Prin Pereira': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ956RZ'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'V206HQL AB', serial:'VR4203120308'},
  ],
  'Eddy Yolanda Peña de Granado': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJWFRWW'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTRL54022'},
  ],
  'Edward Jhonny Gonzalez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79Z19'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTSU5T918'},
  ],
  'Eliub Ricardo Solorzano Perez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'1S3209A86MJ95F8'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922083'},
  ],
  'Elys Daniel Martinez Zambrano': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ725HT'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'10501671842'},
  ],
  'Emely Miraidy Garcia Osuna': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ0829L'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLY6AA0050510ACA4850B'},
  ],
  'Felix Armando Arraiz Planchart': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391RV'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTRL54790'},
  ],
  'Franklin David Reyes Delgado': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJVMTEK'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922043'},
  ],
  'Frenddy Enrique Santana Buitrago': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ91Y14'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLYGAA00505107D91850E'},
  ],
  'Geraldyn de los Angeles Lopez Rojas': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ91Y49'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922079'},
  ],
  'German Javier Gerardino Diaz': [
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0561788'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0560741'},
  ],
  'Guillermo Alexander Torres': [
    {equipo:'CPU', marca:'DELL', modelo:'ALL IN ONE', serial:'W14B86B1TB0007'},
  ],
  'Hedwing Jose Gutierrez Blanco': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ95CEW'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4203120408'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0661779'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0561783'},
  ],
  'Herrera Medina Herrera Medina': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ541P5'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLXKAA022105041804258'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'1576', serial:'65820236291'},
  ],
  'Imari del Valle Vasquez Capote': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922030'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79W88'},
  ],
  'Isolimar Coromoto Sanchez Fernandez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ724NM'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR42031203773'},
  ],
  'Jesly Oriana Baez Macedo': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'1S3209A86MJ391RV'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922012'},
  ],
  'Jesus Antonio Arellano Natera': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922007'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ956XD'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTUW5T662'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'00TNTTQ5U801'},
    {equipo:'IMPRESORA', marca:'CANON', modelo:'F171902', serial:'YCG68244'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1200', serial:'211105-0560009'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1200', serial:'211105-0560789'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1201', serial:'211105-0561507'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1202', serial:'211105-0560003'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1203', serial:'211105-0561785'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC-1204', serial:'21105-0561782'},
  ],
  'Jipson Jesus Granadillo Albarran': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJZXHWZ'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202921898'},
  ],
  'Johanna Betzabeth De Almada Nieves': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ91Y49'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922089'},
  ],
  'Jonathan Avisai Morales Martinez': [
    {equipo:'CPU', marca:'DELL', modelo:'ALL IN ONE', serial:'W14B86B1TB006'},
  ],
  'Jose Gregorio Hernandez Villegas': [
    {equipo:'TECLADO', marca:'OTRA', modelo:'A1644', serial:'579C-A2450'},
    {equipo:'MOUSE', marca:'OTRA', modelo:'A1657', serial:'579C-A1657'},
    {equipo:'CPU', marca:'OTRA', modelo:'A2115', serial:'579C-A2439'},
  ],
  'Jose Rafael Olivares Rodriguez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ04T7Z'},
    {equipo:'MONITOR', marca:'ACER', modelo:'20MK400H', serial:'007NTRL5T670'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007ntuw5u782'},
    {equipo:'OTRO', marca:'OTRA', modelo:'V-1500', serial:'201017040163'},
  ],
  'Juber Anulfo Mendoza': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ92A54'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4203120404'},
  ],
  'Julmar Enrique Moron Vasquez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJVDMKT'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922039'},
  ],
  'Karelys Juliett Sanchez Lopez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79V9P'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922053'},
  ],
  'Katiuska del Valle Diaz Yanez': [
    {equipo:'IMPRESORA', marca:'CANON', modelo:'MF445DW', serial:'2TC32254'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'11SOB4593OZVJ7BR2CZ1MF'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922022'},
  ],
  'Kristina Dugnas Sulcas': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ80E52'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4203120388'},
    {equipo:'IMPRESORA', marca:'CANON', modelo:'MF445DW', serial:'2TC32057'},
  ],
  'Loisbeth Mariana Corvos Arismendi': [
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL ABI', serial:'MMLY6AA0050510ACA6850B'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ78W1L'},
  ],
  'Luigersy Enrique Correa Mendez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ0826T'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922074'},
  ],
  'Luis Alejandro Flores Gonzalez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79X97'},
  ],
  'Luis Leopoldo Narvaez Gonzalez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ80629'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'510441935'},
  ],
  'Luis Vicente Garcia Lamas': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ540P1'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL', serial:'MMLYGAA00105107D80850E'},
  ],
  'Marbelis Eva Davila Santaella': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79P39'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLXKAA0221050416A4258'},
  ],
  'Maria Emilia Torres Bonten': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTC25T675'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ39R03'},
  ],
  'Maria Fernanda Ruiz Gonzalez': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'TINKCENTRE M92P', serial:'VR202922018'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ3916T'},
  ],
  'Maria Jose Hernandez Morales': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ26EPX'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922034'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'1576', serial:'65820236795'},
  ],
  'Maria Pia Savoia Rojas': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391AL'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTAB76950'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'1576', serial:'65820236792'},
  ],
  'Maria Rosana Rodriguez Guzman': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ7840H'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922033'},
  ],
  'Maribella Aguilar Peraza': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ918T2'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTKF5U781'},
  ],
  'Mariela Andrea Curvelo Hernández': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ78V9E'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTXR5U78L'},
  ],
  'Marilin Andreina Nuñez Arraiz': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ0818T'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922032'},
  ],
  'Marinel Luzey Colmenares Blanco': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTJJ5U764'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJZKDYC'},
  ],
  'Mazuris Jiraly Azocar Benitez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79Z19'},
    {equipo:'MONITOR', marca:'LG', modelo:'V206HQL AB', serial:'007NTSUSU774'},
  ],
  'Migdalia Isabel Sanz Vaamondes': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ725GM'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTZ5T677'},
  ],
  'Miguel Angel Cardenas Yepez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79V22'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922063'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4203120306'},
  ],
  'Milagros de Jesus Torres Gonzalez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ778YSB'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'XR78002'},
  ],
  'Morella Carmona de Hernandez': [
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4203120371'},
  ],
  'Nathalia Yusmairi Guillen Lopez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ541L8'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4203120418'},
  ],
  'Noraima del Milagro Coy Parra': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTLE5U776'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79N89'},
  ],
  'Oriana Gabriela Reina Mayora': [
    {equipo:'TECLADO', marca:'OTRA', modelo:'1576', serial:'90108616656374'},
    {equipo:'MOUSE', marca:'OTRA', modelo:'1576', serial:'X821932-004'},
    {equipo:'CPU', marca:'DELL', modelo:'ALL IN ONE', serial:'ONK4D4D'},
  ],
  'Oriana Patricia Perez Cabello': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ91W09'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922078'},
  ],
  'Orlando Jose Yanez Saez': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTAB5T66H'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJZKDYC'},
  ],
  'Rahelenys Josue Burgos Santaella': [
    {equipo:'IMPRESORA', marca:'CANON', modelo:'D1600', serial:'2SN08116'},
    {equipo:'IMPRESORA', marca:'HP', modelo:'2775', serial:'CN1B99R523'},
  ],
  'Rayda Ysabel Vera Parra': [
    {equipo:'IMPRESORA', marca:'CANON', modelo:'MF445DW', serial:'2TC32230'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ2969R'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'1576', serial:'65820236794'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLXKAA022105041824258'},
  ],
  'Renny Moises Poleo Gascon': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ30DR2'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922096'},
    {equipo:'MOUSE', marca:'OTRA', modelo:'XTK-230', serial:'INC24061407235'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'XTK-130', serial:'INC24061412799'},
  ],
  'Romelis Maria Viña Garcia': [
    {equipo:'CPU', marca:'OTRA', modelo:'CS515XTK02', serial:'INC200802871'},
    {equipo:'MONITOR', marca:'OTRA', modelo:'G2712', serial:'CB5T592600392'},
  ],
  'Ronnie Percak Mendoza': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ78W1G'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTS454798'},
  ],
  'Rosbely del Carmen Godoy Briceño': [
    {equipo:'MONITOR', marca:'OTRA', modelo:'G2712', serial:'C04T0335003M'},
    {equipo:'CPU', marca:'OTRA', modelo:'CS515XTK02', serial:'INC2104310538'},
  ],
  'Rosmary Mariana Pantoja Blanco': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ956MM'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922052'},
  ],
  'Saray Ailemar Verdu Aragot': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391HR'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922027'},
  ],
  'Saskia Catheryn Victoria Calderon Veliz': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ79R91'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4202922005'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'XTK-130', serial:'INC24061413234'},
    {equipo:'MOUSE', marca:'OTRA', modelo:'91705', serial:'X821908'},
  ],
  'Solisver Coromoto Urbaez de Sandoval': [
    {equipo:'MONITOR', marca:'OTRA', modelo:'2708JXH', serial:'C272024120188'},
    {equipo:'CPU', marca:'OTRA', modelo:'CS515XTK02', serial:'INC2104310594'},
  ],
  'Treizen Guanipa': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391VE'},
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ391KH'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VS16216', serial:'VR4203120311'},
  ],
  'Vicente Paul Castillo Castellanos': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ91747'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR4202922045'},
  ],
  'Viviana Isabel Cuello Pino': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ2977M'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'5103214885'},
  ],
  'William Alfredo Castillo Bolle': [
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTLE50800'},
    {equipo:'TECLADO', marca:'OTRA', modelo:'A1644', serial:'BCGA1644'},
    {equipo:'CPU', marca:'OTRA', modelo:'VS16216', serial:'H4TFG01KPN77'},
  ],
  'Yelitza Yatzyl Armas Liendo': [
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'MMLY6AA0050510ACB585013'},
  ],
  'Yenaida Fagundez Vera': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ399R62'},
  ],
  'Yesenia Janerys Martinez Escalona': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ390YP'},
    {equipo:'MONITOR', marca:'LG', modelo:'20MK400H', serial:'007NTUW5U758'},
  ],
  'Yoliskar de los Angeles Diaz Velasquez': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ2986M'},
    {equipo:'MONITOR', marca:'ACER', modelo:'V206HQL AB', serial:'51032146854'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0561787'},
    {equipo:'OTRO', marca:'OTRA', modelo:'U-PTC1200', serial:'211105-0561784'},
  ],
  'Yosmary Vanesa Valero Paredes': [
    {equipo:'CPU', marca:'LENOVO', modelo:'TINKCENTRE M92P', serial:'MJ724Y2'},
    {equipo:'MONITOR', marca:'VIEWSONIC', modelo:'VA1903H', serial:'VR42031202331'},
  ],
};

/* Todo lo que usa esa persona. */
function inventarioDe(nombre){
  const n = String(nombre || '').trim();
  return INVENTARIO[n] || [];
}

/* El equipo de un tipo —CPU, IMPRESORA, MONITOR…— de esa persona. Si tiene
   varios del mismo tipo devuelve el primero: con dos monitores iguales, el
   técnico corrige el serial en la ficha si hace falta. */
function inventarioEquipo(nombre, tipo){
  return inventarioDe(nombre).find(e => e.equipo === tipo) || null;
}

/* Lo que GTIC fue agregando desde la bandeja, encima de lo que trajo el cuadro
   de Patrimonio. Se mezcla al vuelo: lo apuntado a mano manda, porque es más
   nuevo y porque alguien lo miró de frente. */
function inventarioMezclar(lista){
  (Array.isArray(lista) ? lista : []).forEach(x => {
    const n = String((x && x.nombre) || '').trim();
    if(!n || !x.equipo) return;
    const suyos = (INVENTARIO[n] = INVENTARIO[n] || []);
    const i = suyos.findIndex(e => e.equipo === x.equipo);
    const fila = {equipo: x.equipo, marca: x.marca || '', modelo: x.modelo || '',
                  serial: x.serial || ''};
    if(i >= 0) suyos[i] = fila; else suyos.push(fila);
  });
}

/* Traerlo del servidor. Las dos páginas lo llaman al arrancar; si falla, cada
   una sigue con lo que trajo el cuadro, que es la mayor parte. */
function inventarioTraer(){
  if(typeof soporteHayBackend !== 'function' || !soporteHayBackend()) return Promise.resolve();
  return fetch(SOPORTE_BACKEND.url + '/rest/v1/inventario', {headers: soporteCabeceras()})
    .then(r => r.ok ? r.json() : [])
    .then(inventarioMezclar)
    .catch(() => {});
}
