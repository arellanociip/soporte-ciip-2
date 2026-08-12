/* ---------- Los catálogos de la Hoja de Servicio ----------
   Todo lo de aquí salió del propio Excel "HOJA DE SERVICIO NUEVA": las
   gerencias de la lista GERENCIAS (Hoja2!B3:B22), los dos tipos de la lista
   TIPO_S y los detalles que cuelgan de cada uno (las listas ASISTENCIA y
   SOPORTE_TECNICO, que el Excel encadenaba con INDIRECT).

   Equipos y marcas no venían de ninguna lista: se escribían a mano, y por eso
   en las 207 hojas llenadas hay CANON, CANNON y CANOM para la misma marca, y
   MAUSE, MUSE y LAPTO conviviendo con MONITOR. Aquí se vuelven listas cerradas
   para que eso deje de pasar; la opción "Otra" recoge lo que falte.
   Prefijo: CAT. */

/* Hoja2!B3:B22 — en el orden del Excel, que es el orden protocolar del CIIP.
   Las tres últimas no estaban en la lista pero sí aparecen en hojas llenadas,
   así que se agregan al final para no obligar a nadie a elegir mal. */
const CAT_GERENCIAS = [
  'AUDITORIA INTERNA',
  'PRESIDENCIA',
  'DIRECCION GRAL. DE DESPACHO',
  'CONSULTORIA JURIDICA',
  'GCIA. PLANIFICACION Y PRESUPUESTO',
  'GCIA. GESTION HUMANA',
  'GCIA. GESTION ADMINISTRATIVA',
  'GCIA. GESTION COMUNICACIONAL',
  'GCIA. GRAL. OBSERVATORIO NACIONAL ANTIBLOQUEO',
  'GCIA. GRAL. PROYECTOS DE INVERSION Y ACTIVOS',
  'GCIA. GRAL. PROMOCION DE INVERSION',
  'GCIA. MONITOREO DEL IMPACTO DE MCU Y OTRAS MEDIDAS RESTRICTIVAS O PUNITIVAS',
  'GCIA. ESTUDIOS COMPARADOS Y SISTEMATIZACION DE MEDIDAS ANTIBLOQUEO',
  'GCIA. SEGUIMIENTO DE ACTIVOS',
  'GCIA. REGISTRO DE PROYECTOS DE INVERSION Y ACTIVOS',
  'GCIA. FACTIBILIDAD Y EVALUACION DE PROYECTOS',
  'BANCO DE PROYECTOS DE INVERSION Y ACTIVOS',
  'GCIA. ATENCION AL INVERSIONISTA',
  'GCIA. ARTICULACION SECTORIAL DE INVERSIONES',
  'GCIA. MODELOS ASOCIATIVOS',
  /* usadas en hojas reales, ausentes de la lista del Excel */
  'GCIA. TECNOLOGIA DE LA INFORMACION Y COMUNICACION',
  'FUNDACION MARCA PAIS',
  'VICEMINISTERIO DE ECONOMIA PRODUCTIVA',
];

/* Hoja2!D3:D4 (TIPO_S) y las listas que INDIRECT resolvía por su nombre.
   La etiqueta es lo que ve el usuario; el valor es el del Excel, para que la
   hoja impresa salga idéntica a la de siempre. */
const CAT_SERVICIOS = [
  {
    valor: 'ASISTENCIA',
    etiqueta: 'Asistencia',
    pista: 'Necesito que me acompañen o me enseñen a usar algo',
    detalles: [
      'MANEJO DE SOFTWARE',
      'MANEJO DE DISPOSITIVOS',
      'RESPALDO Y/O RECUPERACION DE ARCHIVOS',
    ],
  },
  {
    valor: 'SOPORTE_TECNICO',
    etiqueta: 'Soporte técnico',
    pista: 'Algo no sirve, falla, o hay que instalar o mover un equipo',
    detalles: [
      'CONFIGURACION DE CUENTA USUARIO',
      'INSTALACION Y/O CONFIGURACION DE IMPRESORA',
      'INSTALACION Y/O CONFIGURACION DE DISPOSITIVO DE PROYECCION DE IMAGEN',
      'INSTALACION DE SISTEMA OPERATIVO (EQUIPOS NUEVOS)',
      'MOVILIZACION Y/O REUBICACION DE ACTIVOS TECNOLOGICOS',
      'CONECTIVIDAD DE RED O INTERNET',
      'OPERATIVIDAD DE CPU',
      'OPERATIVIDAD DEL MONITOR',
      'OPERATIVIDAD DE OTROS PERIFERICOS DE LA COMPUTADORA',
      'SOLUCION DE PROBLEMAS DE IMPRESIÓN',
      'FORMATEO Y LIMPIEZA DEL ORDENADOR Y/O INSTALACION DE APLICACIONES',
      'MANTENIMIENTO PREVENTIVO',
      /* En el Excel el rango SOPORTE_TECNICO llega hasta G17, así que estas dos
         quedaban fuera del desplegable aunque estuvieran escritas debajo o se
         usaran a mano en las hojas. Aquí sí se pueden elegir. */
      'MANTENIMIENTO CORRECTIVO',
      'UPGRADE DE HARDWARE DE PCS Y PORTÁTILES (AUMENTO DE MEMORIA RAM, CAMBIO DE PROCESADOR, DISCO DURO, TARJETAS GRÁFICAS, ETC.)',
    ],
  },
];

/* Los pisos que aparecen en las hojas: PB y del 1 al 9. */
const CAT_PISOS = ['PB', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/* Oficinas vistas en las hojas, ya normalizadas (el Excel mezclaba "4-1" y
   "4-01" para la misma). Es una sugerencia, no una jaula: el campo admite
   cualquier cosa, porque la lista de oficinas cambia sola con el tiempo. */
const CAT_OFICINAS = [
  '1-02', '1-07', '1-08',
  '2-01', '2-02', '2-03', '2-04', '2-05', '2-06', '2-07', '2-09',
  '3-01', '3-02', '3-04', '3-05',
  '4-01', '4-02', '4-03', '4-04', '4-05', '4-06', '4-07', '4-09',
  '8-06', 'LOBBY',
];

/* Equipos y marcas: lo que de verdad se atiende en la casa, agrupado y sin las
   variantes mal escritas. */
const CAT_EQUIPOS = [
  'CPU', 'MONITOR', 'TECLADO', 'MOUSE', 'IMPRESORA', 'IMPRESORA MULTIFUNCIONAL',
  'LAPTOP', 'ESCANER', 'VIDEOBEAM', 'TELEFONO IP', 'CABLES Y PERIFERICOS', 'OTRO',
];

const CAT_MARCAS = [
  'LENOVO', 'DELL', 'HP', 'ACER', 'CANON', 'EPSON', 'LG', 'VIEWSONIC',
  'SAMSUNG', 'APPLE', 'BANDA', 'GENERICO', 'OTRA',
];

/* Los detalles del tipo elegido, o una lista vacía si aún no eligió. */
function catDetallesDe(tipo){
  const s = CAT_SERVICIOS.find(x => x.valor === tipo);
  return s ? s.detalles : [];
}

/* "SOPORTE_TECNICO" → "Soporte técnico", para no gritarle al usuario. */
function catTipoEtiqueta(tipo){
  const s = CAT_SERVICIOS.find(x => x.valor === tipo);
  return s ? s.etiqueta : (tipo || '');
}

/* El detalle se muestra tal cual viene del Excel, en mayúscula sostenida: es el
   texto que el técnico lleva años leyendo y el que va a salir impreso en la
   Hoja de Servicio. Cambiarlo aquí solo serviría para que no se reconozcan. */
