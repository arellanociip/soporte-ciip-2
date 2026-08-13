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

/* Las dependencias del listado de control de acceso (corte 27/07/2026), que es
   el censo real del personal. Primero las del CIIP y después las de Marca País,
   marcadas, porque tres se llaman igual en los dos entes y en la Hoja de
   Servicio hay que poder distinguirlas.

   La última es la salida para quien no encuentre la suya: sin ella, alguien de
   una gerencia que el listado no recoja no podría ni pedir soporte. */
const CAT_GERENCIAS = [
  'AUDITORÍA INTERNA',
  'CONSULTORÍA JURÍDICA',
  'DIRECTORIO',
  'GERENCIA GENERAL DE GESTIÓN ADMINISTRATIVA',
  'GERENCIA GENERAL DE GESTIÓN COMUNICACIONAL',
  'GERENCIA GENERAL DE GESTIÓN HUMANA',
  'GERENCIA GENERAL DE PLANIFICACIÓN Y PRESUPUESTO',
  'GERENCIA GENERAL DE PROMOCIÓN DE INVERSIONES',
  'GERENCIA GENERAL DE PROYECTOS DE INVERSIÓN Y ACTIVOS',
  'GERENCIA GENERAL DE SEGURIDAD INTEGRAL',
  'GERENCIA GENERAL DE TECNOLOGÍA DE LA INFORMACIÓN Y COMUNICACIÓN',
  'GERENCIA GENERAL DEL DESPACHO',
  'GERENCIA GENERAL DEL OBSERVATORIO VENEZOLANO ANTIBLOQUEO',
  'PRESIDENCIA',
  'VICEPRESIDENCIA',
  'AUDITORÍA INTERNA (MARCA PAÍS)',
  'CONSULTORÍA JURÍDICA (MARCA PAÍS)',
  'GERENCIA DE ATENCIÓN CIUDADANA (MARCA PAÍS)',
  'GERENCIA DE GESTIÓN ADMINISTRATIVA (MARCA PAÍS)',
  'GERENCIA DE GESTIÓN HUMANA (MARCA PAÍS)',
  'GERENCIA DE PLANIFICACIÓN Y PRESUPUESTO (MARCA PAÍS)',
  'GERENCIA GENERAL (MARCA PAÍS)',
  'GERENCIA GENERAL DE PROMOCIÓN Y POSICIONAMIENTO DE LA MARCA PAÍS (MARCA PAÍS)',
  'GERENCIA GENERAL DE REGULACIÓN, USO Y SEGUIMIENTO DE LA MARCA PAÍS (MARCA PAÍS)',
  'GERENCIA GESTIÓN COMUNICACIONAL (MARCA PAÍS)',
  'GERENTE DE ARTICULACIÓN ESTRATÉGICA PARA EL IMPULSO DE LA MARCA PAÍS (MARCA PAÍS)',
  'PRESIDENCIA (MARCA PAÍS)',
  'OTRA (no aparece en la lista)',
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
      'RESPALDO Y/O RECUPERACIÓN DE ARCHIVOS',
    ],
  },
  {
    valor: 'SOPORTE_TECNICO',
    etiqueta: 'Soporte técnico',
    pista: 'Algo no sirve, falla, o hay que instalar o mover un equipo',
    detalles: [
      'CONFIGURACIÓN DE CUENTA DE USUARIO',
      'INSTALACIÓN Y/O CONFIGURACIÓN DE IMPRESORA',
      'INSTALACIÓN Y/O CONFIGURACIÓN DE DISPOSITIVO DE PROYECCIÓN DE IMAGEN',
      'INSTALACIÓN DE SISTEMA OPERATIVO (EQUIPOS NUEVOS)',
      'MOVILIZACIÓN Y/O REUBICACIÓN DE ACTIVOS TECNOLÓGICOS',
      'CONECTIVIDAD DE RED O INTERNET',
      'OPERATIVIDAD DE CPU',
      'OPERATIVIDAD DEL MONITOR',
      'OPERATIVIDAD DE OTROS PERIFÉRICOS DE LA COMPUTADORA',
      'SOLUCIÓN DE PROBLEMAS DE IMPRESIÓN',
      'FORMATEO Y LIMPIEZA DEL ORDENADOR Y/O INSTALACIÓN DE APLICACIONES',
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

/* Las oficinas del listado de control de acceso, en formato piso-puerta.
   Es una sugerencia, no una jaula: el campo admite cualquiera, porque la gente
   se muda y el listado se queda atrás. */
const CAT_OFICINAS = [
  '1-02', '1-07', '2-01', '2-02', '2-03', '2-04', '2-05', '2-06',
  '2-07', '3-01', '3-02', '3-04', '3-05', '4-01', '4-02', '4-03',
  '4-04', '4-05', '4-06', '4-07', '4-08', '4-09', '8-02',
];

/* Equipos y marcas: lo que de verdad se atiende en la casa, agrupado y sin las
   variantes mal escritas. */
const CAT_EQUIPOS = [
  'CPU', 'MONITOR', 'TECLADO', 'MOUSE', 'IMPRESORA', 'IMPRESORA MULTIFUNCIONAL',
  'LAPTOP', 'ESCANER', 'VIDEOBEAM', 'TELEFONO IP', 'CABLES Y PERIFÉRICOS', 'OTRO',
];

const CAT_MARCAS = [
  'LENOVO', 'DELL', 'HP', 'ACER', 'CANON', 'EPSON', 'LG', 'VIEWSONIC',
  'SAMSUNG', 'APPLE', 'BANDA', 'GENERICO', 'OTRA',
];

/* ---------- Atajos: lo que de verdad se pide ----------
   De los 241 renglones de las 207 hojas, cinco detalles cubren el 78 %. En vez
   de hacer que todo el mundo lea catorce opciones en mayúscula sostenida para
   dar con la suya, se ofrecen esos cinco en lenguaje llano y de un toque. El
   resto sigue disponible en "Otra cosa", que abre los desplegables completos.

   Cada atajo solo rellena los dos desplegables de siempre: no hay un camino de
   datos paralelo, así que la Hoja de Servicio sale idéntica. `ejemplo` cambia
   el texto guía de la descripción, que es donde la gente se traba.

   El `icono` es SVG escrito aquí, nunca dato de entrada; se inserta como
   marcado a propósito. Los números entre paréntesis son las veces que ese
   detalle aparece en el Excel. */
const CAT_ATAJOS = [
  {
    id: 'cpu',                                                        /* 55 */
    titulo: 'La computadora no sirve',
    sub: 'No enciende, se apaga, va lenta',
    tipo: 'SOPORTE_TECNICO', detalle: 'OPERATIVIDAD DE CPU',
    /* Un atajo no es un problema, es una familia de problemas: quien dice "la
       computadora no sirve" puede tener el CPU muerto, el monitor sin imagen,
       el equipo lentísimo o el teclado que no responde. Lo que se guarda sigue
       siendo una sola clasificación —la de arriba, la que va a la Hoja de
       Servicio—, pero para ofrecerle lo que GTIC ya sabe hay que mirar todas,
       y que sea la persona quien diga cuál de ellas es la suya. */
    familia: [
      'OPERATIVIDAD DE CPU',
      'OPERATIVIDAD DEL MONITOR',
      'OPERATIVIDAD DE OTROS PERIFÉRICOS DE LA COMPUTADORA',
      'FORMATEO Y LIMPIEZA DEL ORDENADOR Y/O INSTALACIÓN DE APLICACIONES',
      'MANTENIMIENTO CORRECTIVO',
      'MANTENIMIENTO PREVENTIVO',
      'INSTALACIÓN DE SISTEMA OPERATIVO (EQUIPOS NUEVOS)',
      'UPGRADE DE HARDWARE DE PCS Y PORTÁTILES (AUMENTO DE MEMORIA RAM, CAMBIO DE PROCESADOR, DISCO DURO, TARJETAS GRÁFICAS, ETC.)',
    ],
    equipos: ['CPU', 'MONITOR'],   /* los del inventario que van con la solicitud */
    ejemplo: 'Ej. El CPU se apaga solo a cada rato desde el lunes, aunque el cable esté bien conectado.',
    icono: '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="8" y2="6.01"/><line x1="8" y1="10" x2="8" y2="10.01"/></svg>',
  },
  {
    id: 'mudanza',                                                    /* 52 */
    titulo: 'Mover un equipo de sitio',
    sub: 'Cambio de oficina o de puesto',
    tipo: 'SOPORTE_TECNICO', detalle: 'MOVILIZACIÓN Y/O REUBICACIÓN DE ACTIVOS TECNOLÓGICOS',
    familia: ['MOVILIZACIÓN Y/O REUBICACIÓN DE ACTIVOS TECNOLÓGICOS',
              'INSTALACIÓN Y/O CONFIGURACIÓN DE DISPOSITIVO DE PROYECCIÓN DE IMAGEN'],
    equipos: ['CPU', 'MONITOR'],   /* los del inventario que van con la solicitud */
    ejemplo: 'Ej. Me mudo de la oficina 2-6 a la 3-01 y hay que llevar la computadora y el monitor.',
    icono: '<svg viewBox="0 0 24 24"><path d="M5 9V6a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M3 13h18"/><path d="M7 21h10a2 2 0 002-2v-6H5v6a2 2 0 002 2z"/></svg>',
  },
  {
    id: 'impresora',                                                  /* 34 + 10 */
    titulo: 'Problema con la impresora',
    sub: 'No imprime, o hay que instalarla',
    tipo: 'SOPORTE_TECNICO', detalle: 'INSTALACIÓN Y/O CONFIGURACIÓN DE IMPRESORA',
    familia: ['INSTALACIÓN Y/O CONFIGURACIÓN DE IMPRESORA',
              'SOLUCIÓN DE PROBLEMAS DE IMPRESIÓN'],
    equipos: ['IMPRESORA'],   /* y si no tiene, la del piso: son de todos */
    ejemplo: 'Ej. No puedo imprimir desde el lunes: la impresora no aparece en la lista.',
    icono: '<svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 01-2-2v-3a2 2 0 012-2h16a2 2 0 012 2v3a2 2 0 01-2 2h-2"/></svg>',
  },
  {
    id: 'usuario',                                                    /* 31 */
    titulo: 'Usuario o correo',
    sub: 'Clave, cuenta, configuración',
    tipo: 'SOPORTE_TECNICO', detalle: 'CONFIGURACIÓN DE CUENTA DE USUARIO',
    familia: ['CONFIGURACIÓN DE CUENTA DE USUARIO', 'MANEJO DE SOFTWARE',
              'RESPALDO Y/O RECUPERACIÓN DE ARCHIVOS'],
    equipos: ['CPU', 'MONITOR'],   /* los del inventario que van con la solicitud */
    ejemplo: 'Ej. Necesito que me configuren el correo institucional en el equipo nuevo.',
    icono: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/></svg>',
  },
  {
    id: 'red',                                                        /* 15 */
    titulo: 'Red o internet',
    sub: 'Sin conexión, va y viene',
    tipo: 'SOPORTE_TECNICO', detalle: 'CONECTIVIDAD DE RED O INTERNET',
    familia: ['CONECTIVIDAD DE RED O INTERNET'],
    equipos: ['CPU', 'MONITOR'],   /* los del inventario que van con la solicitud */
    ejemplo: 'Ej. Desde ayer el equipo no agarra internet; el cable está conectado.',
    icono: '<svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0114 0"/><path d="M8.5 16.11a6 6 0 017 0"/><line x1="12" y1="20" x2="12" y2="20.01"/></svg>',
  },
  {
    /* La salida para el 22 % restante: abre los desplegables completos. */
    id: 'otra',
    titulo: 'Otra cosa',
    sub: 'Lo cuento yo mismo',
    tipo: null, detalle: null,
    ejemplo: 'Ej. Cuenta con tus palabras qué está pasando y desde cuándo.',
    icono: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
  },
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
