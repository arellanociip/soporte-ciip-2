/* ---------- La Hoja de Servicio, en PDF ----------
   Quien pide un soporte quiere su comprobante, y "abre el diálogo de imprimir y
   escoge Guardar como PDF" no es un comprobante: es un trámite. Aquí el
   servidor arma el archivo y el navegador se lo baja, igual desde el teléfono
   que desde la máquina de la oficina.

   El PDF se escribe a mano, sin librerías. Un PDF no es más que texto con una
   tabla de posiciones al final, y esta hoja son cuatro rectángulos y unas
   líneas: no hace falta traer medio megabyte de dependencias para eso, ni que
   este proyecto empiece a depender de npm cuando hasta hoy no ha necesitado
   instalar nada.

   Las fuentes son Helvetica y Helvetica-Bold, dos de las catorce que todo lector
   de PDF trae de fábrica: así el archivo no las lleva dentro y pesa cuatro veces
   menos.
   Prefijo: pdf. */
'use strict';

/* ---------- anchos de Helvetica ----------
   En milésimas de punto, del espacio al ~. Son los de la especificación, y
   hacen falta para partir los párrafos por donde de verdad se acaba la línea:
   sin esto, "MMMM" y "iiii" ocuparían lo mismo y el texto se saldría de su caja. */
const ANCHO_NORMAL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const ANCHO_NEGRITA = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

/* Los acentos y la eñe miden lo mismo que su letra base, así que para medir se
   les quita el acento. Escribir sí lo hace con su código, no descafeinado. */
const SIN_ACENTO = {'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n','Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U','Ñ':'N','°':'o','º':'o','¿':'?','¡':'!','·':'.','—':'-','–':'-','“':'"','”':'"','’':"'"};

function ancho(texto, tam, negrita){
  const tabla = negrita ? ANCHO_NEGRITA : ANCHO_NORMAL;
  let total = 0;
  for(const c of String(texto)){
    const base = SIN_ACENTO[c] || c;
    const i = base.charCodeAt(0) - 32;
    total += (i >= 0 && i < tabla.length) ? tabla[i] : 556;
  }
  return total * tam / 1000;
}

/* Un PDF lleva el texto en Latin-1 (WinAnsi), no en UTF-8, y los paréntesis y
   la barra invertida son suyos: hay que escaparlos o el archivo se rompe. */
function pdfTexto(s){
  return String(s == null ? '' : s)
    .replace(/[\\()]/g, m => '\\' + m)
    .replace(/[^\x00-\xFF]/g, c => SIN_ACENTO[c] || '?');
}

/* Partir un párrafo en líneas que quepan. Respeta los saltos que traiga escritos
   —una lista de pasos sigue siendo una lista— y parte la palabra suelta que sea
   más larga que la caja, que si no se saldría por el borde. */
function partir(texto, tam, negrita, cabe){
  const lineas = [];
  String(texto == null ? '' : texto).split(/\r?\n/).forEach(parrafo => {
    let linea = '';
    parrafo.split(/\s+/).forEach(palabra => {
      while(ancho(palabra, tam, negrita) > cabe){
        let corte = palabra.length - 1;
        while(corte > 1 && ancho(palabra.slice(0, corte), tam, negrita) > cabe) corte--;
        if(linea) { lineas.push(linea); linea = ''; }
        lineas.push(palabra.slice(0, corte));
        palabra = palabra.slice(corte);
      }
      const junto = linea ? linea + ' ' + palabra : palabra;
      if(ancho(junto, tam, negrita) <= cabe){ linea = junto; }
      else { if(linea) lineas.push(linea); linea = palabra; }
    });
    lineas.push(linea);
  });
  return lineas;
}

/* ---------- la hoja ----------
   Carta (612 x 792 puntos), como la del Excel. Se trabaja de arriba abajo con
   un cursor —así se lee como el papel— y al escribir se le da la vuelta, porque
   el PDF cuenta desde abajo. */
const ANCHO_HOJA = 612, ALTO_HOJA = 792;
const MARGEN = 40;
const CAJA = ANCHO_HOJA - MARGEN * 2;

function hojaPdf(s){
  const trozos = [];
  const pon = t => trozos.push(t);
  const yPdf = y => ALTO_HOJA - y;

  const texto = (x, y, t, tam, negrita, centrado, cabe) => {
    if(t === '' || t == null) return;
    let px = x;
    if(centrado) px = x + ((cabe || 0) - ancho(t, tam, negrita)) / 2;
    pon('BT /' + (negrita ? 'F2' : 'F1') + ' ' + tam + ' Tf ' +
        px.toFixed(2) + ' ' + yPdf(y).toFixed(2) + ' Td (' + pdfTexto(t) + ') Tj ET');
  };
  const linea = (x1, y1, x2, y2) => pon(
    x1.toFixed(2) + ' ' + yPdf(y1).toFixed(2) + ' m ' +
    x2.toFixed(2) + ' ' + yPdf(y2).toFixed(2) + ' l S');
  const caja = (x, y, w, h) => pon(
    x.toFixed(2) + ' ' + yPdf(y + h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re S');
  const fondo = (x, y, w, h) => pon('q 0.92 0.92 0.92 rg ' +
    x.toFixed(2) + ' ' + yPdf(y + h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f Q');

  pon('0.6 w');
  let y = MARGEN;

  /* ---- encabezado ---- */
  texto(MARGEN, y + 9, 'CENTRO INTERNACIONAL DE INVERSION PRODUCTIVA', 10, true);
  texto(MARGEN, y + 21, 'GERENCIA DE TECNOLOGIA DE LA INFORMACION Y COMUNICACION', 7.5, false);
  const numero = 'N° GTIC-HS/' + String(s.numero).padStart(3, '0') + '-' + s.anio;
  texto(ANCHO_HOJA - MARGEN - ancho(numero, 10, true), y + 9, numero, 10, true);
  const cuando = new Date(s.atendida_en || s.creada_en);
  const fecha = String(cuando.getDate()).padStart(2,'0') + '/' +
                String(cuando.getMonth()+1).padStart(2,'0') + '/' + cuando.getFullYear();
  texto(ANCHO_HOJA - MARGEN - ancho(fecha, 9, false), y + 21, fecha, 9, false);
  y += 30;
  linea(MARGEN, y, ANCHO_HOJA - MARGEN, y);
  y += 22;

  texto(MARGEN, y, 'HOJA DE SERVICIO', 14, true, true, CAJA);
  y += 16;

  /* ---- quién pide ---- */
  const fila = h => { caja(MARGEN, y, CAJA, h); y += h; };
  fondo(MARGEN, y, CAJA, 14);
  caja(MARGEN, y, CAJA, 14);
  texto(MARGEN + 4, y + 10, 'GERENCIA SOLICITANTE:', 8, true);
  y += 14;
  fila(16);
  texto(MARGEN, y - 5, s.gerencia || '', 9, true, true, CAJA);

  /* cinco columnas: usuario, cédula, teléfono, piso, oficina */
  const anchos = [CAJA * 0.34, CAJA * 0.16, CAJA * 0.18, CAJA * 0.12, CAJA * 0.20];
  const rotulos = ['USUARIO:', 'C.I.', 'TELEF.', 'PISO:', 'OFICINA:'];
  const valores = [s.usuario || '', s.cedula || 'S/N', s.telefono || 'S/N',
                   s.piso || '', s.oficina || ''];
  fondo(MARGEN, y, CAJA, 13);
  caja(MARGEN, y, CAJA, 13);
  let x = MARGEN;
  anchos.forEach((w, i) => {
    if(i) linea(x, y, x, y + 13 + 15);
    texto(x + 3, y + 9, rotulos[i], 7.5, true);
    x += w;
  });
  y += 13;
  caja(MARGEN, y, CAJA, 15);
  x = MARGEN;
  anchos.forEach((w, i) => {
    const t = String(valores[i]);
    /* el nombre largo se achica antes que salirse de su columna */
    let tam = 8.5;
    while(tam > 6 && ancho(t, tam, false) > w - 6) tam -= 0.5;
    texto(x + 3, y + 10, t, tam, false, i >= 3, w);
    x += w;
  });
  y += 15 + 12;

  /* ---- lo que pidió ---- */
  const titulo = t => {
    fondo(MARGEN, y, CAJA, 13);
    caja(MARGEN, y, CAJA, 13);
    texto(MARGEN + 4, y + 9, t, 8, true);
    y += 13;
  };
  const parrafo = (t, altoMinimo) => {
    const lineas = partir(t, 8.5, false, CAJA - 10);
    const alto = Math.max(altoMinimo, lineas.length * 11 + 8);
    caja(MARGEN, y, CAJA, alto);
    lineas.forEach((l, i) => texto(MARGEN + 5, y + 13 + i * 11, l, 8.5, false));
    y += alto;
  };

  titulo('DESCRIPCION DE LA SITUACION PLANTEADA POR EL USUARIO');
  parrafo(s.descripcion || '', 46);
  y += 12;

  /* ---- los renglones de equipo ---- */
  const cols = [0.05, 0.15, 0.30, 0.13, 0.12, 0.12, 0.13].map(f => CAJA * f);
  const enc = ['ITEM','TIPO DE SERVICIO','DETALLE DE SERVICIO','EQUIPO','MARCA','MODELO','SERIAL'];
  fondo(MARGEN, y, CAJA, 13);
  caja(MARGEN, y, CAJA, 13);
  x = MARGEN;
  cols.forEach((w, i) => {
    if(i) linea(x, y, x, y + 13);
    let tam = 6.5;
    texto(x + 2, y + 9, enc[i], tam, true);
    x += w;
  });
  y += 13;

  const renglones = Array.isArray(s.renglones) ? s.renglones : [];
  for(let i = 0; i < 6; i++){
    const r = renglones[i] || {};
    const celdas = [String(i + 1), r.tipo || '', r.detalle || '', r.equipo || '',
                    r.marca || '', r.modelo || '', r.serial || ''];
    caja(MARGEN, y, CAJA, 15);
    x = MARGEN;
    cols.forEach((w, c) => {
      if(c) linea(x, y, x, y + 15);
      let tam = 7;
      while(tam > 4.5 && ancho(celdas[c], tam, false) > w - 4) tam -= 0.25;
      texto(x + 2, y + 10, celdas[c], tam, false, c === 0, w);
      x += w;
    });
    y += 15;
  }
  y += 12;

  /* ---- lo que hizo GTIC ---- */
  titulo('OBSERVACIONES:');
  parrafo(s.observaciones || '', 46);
  y += 10;

  partir('LA PRESENTE DEJA CONSTANCIA Y CONFORMIDAD DE LA ATENCION PRESTADA POR LA ' +
         'GERENCIA DE TECNOLOGIA DE LA INFORMACION Y COMUNICACION.', 7.5, false, CAJA)
    .forEach((l, i) => texto(MARGEN, y + i * 10, l, 7.5, false, true, CAJA));
  y += 24;

  /* ---- las dos firmas ---- */
  const mitad = (CAJA - 12) / 2;
  const bloque = (bx, titulo, datos) => {
    let by = y;
    fondo(bx, by, mitad, 13);
    caja(bx, by, mitad, 13);
    texto(bx + 4, by + 9, titulo, 7.5, true);
    by += 13;
    caja(bx, by, mitad, 78);
    datos.forEach((d, i) => {
      const t = d[0] + ' ' + (d[1] || '');
      let tam = 7.5;
      while(tam > 5.5 && ancho(t, tam, false) > mitad - 60) tam -= 0.25;
      texto(bx + 4, by + 13 + i * 12, t, tam, false);
      if(!d[1]) linea(bx + 6 + ancho(d[0] + ' ', tam, false), by + 14 + i * 12,
                      bx + mitad - 62, by + 14 + i * 12);
    });
    /* el recuadro del sello, a la derecha del bloque */
    caja(bx + mitad - 58, by + 6, 52, 52);
    texto(bx + mitad - 58, by + 34, 'SELLO', 7, false, true, 52);
  };

  bloque(MARGEN, 'DATOS DEL USUARIO', [
    ['NOMBRE Y APELLIDO:', s.usuario || ''],
    ['C.I. N°.:', s.cedula || ''],
    ['TELEFONO:', s.telefono || ''],
    ['CARGO:', s.cargo || ''],
    ['FIRMA:', ''],
  ]);
  bloque(MARGEN + mitad + 12, 'TECNICO DE SOPORTE', [
    ['NOMBRE Y APELLIDO:', s.tecnico || ''],
    ['C.I. N°.:', s.tecnico_cedula || ''],
    ['TELEFONO:', s.tecnico_telefono || ''],
    ['CARGO:', s.tecnico_cargo || ''],
    ['FIRMA:', ''],
  ]);

  return armar(trozos.join('\n'));
}

/* ---------- el envoltorio ----------
   Un PDF son objetos numerados y, al final, una tabla que dice en qué byte
   empieza cada uno. Esa tabla es lo único delicado: si un desplazamiento no
   cuadra, el lector dice que el archivo está dañado. */
function armar(contenido){
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + ANCHO_HOJA + ' ' + ALTO_HOJA + ']' +
      ' /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(contenido, 'latin1') + ' >>\nstream\n' + contenido + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let salida = '%PDF-1.4\n';
  const donde = [];
  objetos.forEach((o, i) => {
    donde.push(Buffer.byteLength(salida, 'latin1'));
    salida += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
  });
  const inicioTabla = Buffer.byteLength(salida, 'latin1');
  salida += 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
  donde.forEach(d => { salida += String(d).padStart(10, '0') + ' 00000 n \n'; });
  salida += 'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root 1 0 R >>\n' +
            'startxref\n' + inicioTabla + '\n%%EOF';

  return Buffer.from(salida, 'latin1');
}

module.exports = {hojaPdf};
