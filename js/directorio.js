/* ---------- Directorio de la casa ----------
   Quién trabaja dónde, sacado de las 207 hojas de servicio ya llenadas del
   Excel. Sirve para que nadie tenga que escribir su gerencia, su piso y su
   oficina: escribe su nombre, se elige de la lista y el resto se llena solo.

   Cuando alguien de aquí manda una solicitud con datos distintos —porque se
   mudó de oficina o cambió de gerencia—, mandan los que escribió: esta lista
   es un punto de partida, no una autoridad.

   NO LLEVA CÉDULA NI TELÉFONO, a propósito. Este archivo viaja al navegador de
   cualquiera que abra la página, que no pide clave; publicar la cédula de 112
   compañeros ahí sería regalarlas. Los dos campos siguen siendo opcionales y
   los escribe cada quien.

   Se generó una vez a partir del Excel; de aquí en adelante se corrige a mano.
   Donde una persona aparecía en dos oficinas o dos gerencias (porque se mudó),
   se dejó la que más veces se repite.
   Prefijo: DIRECTORIO. */
const DIRECTORIO = [
  {nombre:'Alexander Blanco', gerencia:'GCIA. GRAL. PROYECTOS DE INVERSION Y ACTIVOS', piso:'2', oficina:'2-03'},
  {nombre:'Alexis Antelis', gerencia:'GCIA. SEGUIMIENTO DE ACTIVOS', piso:'3', oficina:'3-02'},
  {nombre:'Alfredo Carrera', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Amarielys Gonzalez', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Ana Maria Arraiz', gerencia:'AUDITORIA INTERNA', piso:'2', oficina:'2-05'},
  {nombre:'Andrea Moreno', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-04'},
  {nombre:'Andrymar Arellano', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Angelica Ramirez', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'4', oficina:'4-03'},
  {nombre:'Argelia Hernadez', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Camila Medina', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Carlos Fagundez', gerencia:'GCIA. PLANIFICACION Y PRESUPUESTO', piso:'4', oficina:'4-06'},
  {nombre:'Carlos Manzano', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-04'},
  {nombre:'Carly Alejandra Mendes', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'4', oficina:'4-02'},
  {nombre:'Carmen Oviedo', gerencia:'FUNDACION MARCA PAIS', piso:'3', oficina:'3-01'},
  {nombre:'Carolina Vargas', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Cesar Medina', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'4', oficina:'4-02'},
  {nombre:'Cristina Leon', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Dailin Romero', gerencia:'CONSULTORIA JURIDICA', piso:'2', oficina:'2-02'},
  {nombre:'Daniela Cabello', gerencia:'FUNDACION MARCA PAIS', piso:'3', oficina:'3-01'},
  {nombre:'Daniela Hernadez', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Deinyelbert Rodriguez', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-02'},
  {nombre:'Deisy Hernandez', gerencia:'GCIA. ESTUDIOS COMPARADOS Y SISTEMATIZACION DE MEDIDAS ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Deria Mescia', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Diego Marion', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Digna Plaza', gerencia:'CONSULTORIA JURIDICA', piso:'2', oficina:'2-02'},
  {nombre:'Dilia Serrano', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Edward Gonzalez', gerencia:'GCIA. GRAL. PROYECTOS DE INVERSION Y ACTIVOS', piso:'2', oficina:'2-03'},
  {nombre:'Enyiner Garcia', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-06'},
  {nombre:'Genesis Melendez', gerencia:'GCIA. GESTION HUMANA', piso:'2', oficina:'2-04'},
  {nombre:'Hanlly Mendoza', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Harold Delgado', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'4', oficina:'4-02'},
  {nombre:'Hector Alviarez', gerencia:'GCIA. GESTION HUMANA', piso:'2', oficina:'2-04'},
  {nombre:'Hedwing Gutierrez', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Hendrick Perdomo', gerencia:'GCIA. REGISTRO DE PROYECTOS DE INVERSION Y ACTIVOS', piso:'1', oficina:'1-08'},
  {nombre:'Jean Herrera', gerencia:'FUNDACION MARCA PAIS', piso:'3', oficina:'3-01'},
  {nombre:'Jessika Martinez', gerencia:'GCIA. GRAL. PROYECTOS DE INVERSION Y ACTIVOS', piso:'2', oficina:'2-07'},
  {nombre:'Jesus Madera', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'4', oficina:'4-02'},
  {nombre:'Johanna de Almada', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-02'},
  {nombre:'Jose Alexis Anteliz', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Jose G. Hernandez', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Jose Gregorio Hernandez', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Jose Monsalve', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'4', oficina:'4-09'},
  {nombre:'Jose Muñoz', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Jose Scrimaldi', gerencia:'GCIA. GRAL. PROYECTOS DE INVERSION Y ACTIVOS', piso:'2', oficina:'2-03'},
  {nombre:'Juan de Dios', gerencia:'GCIA. MONITOREO DEL IMPACTO DE MCU Y OTRAS MEDIDAS RESTRICTIVAS O PUNITIVAS', piso:'3', oficina:'3-05'},
  {nombre:'Juan Sanchez', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Julmar Moron', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Katiuska Diaz', gerencia:'GCIA. PLANIFICACION Y PRESUPUESTO', piso:'4', oficina:'4-05'},
  {nombre:'Loisbeth Corvos', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Loisver Corvos', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Lugersy Correa', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Luis Baclini', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'3', oficina:'1-07'},
  {nombre:'Luis Castillo', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Luis Dao', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Luis Elvis Castillo', gerencia:'GCIA. ESTUDIOS COMPARADOS Y SISTEMATIZACION DE MEDIDAS ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Luis Ferrer', gerencia:'CONSULTORIA JURIDICA', piso:'2', oficina:'2-07'},
  {nombre:'Luis Narvaez', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Manuel Colmenzrez', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'2', oficina:'2-07'},
  {nombre:'Marcos Magallanes', gerencia:'CONSULTORIA JURIDICA', piso:'2', oficina:'2-07'},
  {nombre:'Maria Campero', gerencia:'GCIA. MONITOREO DEL IMPACTO DE MCU Y OTRAS MEDIDAS RESTRICTIVAS O PUNITIVAS', piso:'3', oficina:'32-02'},
  {nombre:'Maria Guevara', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-04'},
  {nombre:'Maria Prado', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Maria Rodriguez', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Maria Rosana', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Maria Savoia', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Marianny Martinez', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Martin Hernadez', gerencia:'PRESIDENCIA', piso:'8', oficina:'8-06'},
  {nombre:'Nahiry Alcinas', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-04'},
  {nombre:'Nathalia Guillen', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-02'},
  {nombre:'Nereida Cardenas', gerencia:'GCIA. PLANIFICACION Y PRESUPUESTO', piso:'4', oficina:'4-06'},
  {nombre:'Noraima Coy', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Omar Garcia', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Onasi Maldonado', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Paola Franceschi', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'4', oficina:'4-04'},
  {nombre:'Pedro Godoy', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Rayda Vera', gerencia:'AUDITORIA INTERNA', piso:'2', oficina:'2-05'},
  {nombre:'Renny Poleo', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'1', oficina:'1-02'},
  {nombre:'Ricardo Licett', gerencia:'GCIA. GESTION COMUNICACIONAL', piso:'2', oficina:'2-04'},
  {nombre:'Rosbely Godoy', gerencia:'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO', piso:'3', oficina:'3-02'},
  {nombre:'Rosmeli Viña', gerencia:'GCIA. MONITOREO DEL IMPACTO DE MCU Y OTRAS MEDIDAS RESTRICTIVAS O PUNITIVAS', piso:'3', oficina:'3-05'},
  {nombre:'Scarle Herrera', gerencia:'GCIA. PLANIFICACION Y PRESUPUESTO', piso:'4', oficina:'4-05'},
  {nombre:'Tony Leon', gerencia:'GCIA. GESTION HUMANA', piso:'2', oficina:'2-04'},
  {nombre:'Treizen Guanipa', gerencia:'GCIA. GESTION HUMANA', piso:'4', oficina:'4-01'},
  {nombre:'Valentina Varacierto', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'2', oficina:'2-09'},
  {nombre:'Winfield Romero', gerencia:'DIRECCION GRAL. DE DESPACHO', piso:'4', oficina:'4-02'},
  {nombre:'Wuendy Innamorati', gerencia:'AUDITORIA INTERNA', piso:'2', oficina:'2-05'},
  {nombre:'Yessika Velasquez', gerencia:'CONSULTORIA JURIDICA', piso:'2', oficina:'2-02'},
  {nombre:'Yoliskar Diaz', gerencia:'GCIA. GRAL. PROMOCION DE INVERSION', piso:'1', oficina:'1-02'},
  {nombre:'Yosmary Valero', gerencia:'GCIA. GESTION ADMINISTRATIVA', piso:'PB', oficina:'LOBBY'},
];

/* Busca por nombre exacto, sin distinguir mayúsculas ni espacios de sobra. */
function directorioBuscar(nombre){
  const n = String(nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if(!n) return null;
  return DIRECTORIO.find(p => p.nombre.toLowerCase() === n) || null;
}
