/* ---------- El servidor de la casa ----------
   Sustituye al `python -m http.server`: además de servir las páginas, guarda
   las solicitudes en un archivo de este disco. Así todas las máquinas de la
   oficina escriben en el mismo sitio y la bandeja las ve al instante, que es
   justo lo que el modo prueba no podía hacer.

   Habla el mismo dialecto que Supabase (/rest/v1/… y /auth/v1/token) a
   propósito: el día que se monte el proyecto en la nube, el navegador no se
   entera del cambio y solo hay que tocar js/config.js.

   Arranque:   node servidor.js
   Un usuario: node servidor.js --crear-usuario correo@ciip.gob.ve suClave

   No necesita internet ni instalar nada: solo Node, que ya está.
   Prefijo de los datos en disco: datos/. */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ    = __dirname;
const DATOS   = path.join(RAIZ, 'datos');
const F_SOLIC = path.join(DATOS, 'solicitudes.json');
const F_USERS = path.join(DATOS, 'usuarios.json');
const F_GUIAS = path.join(DATOS, 'guias.json');
/* Lo que GTIC le va agregando al inventario desde la bandeja. El grueso viene
   del cuadro de Patrimonio (js/inventario.js, que es código); esto es lo que
   se descubre atendiendo, y por eso vive con los datos y no con el código. */
const F_INV   = path.join(DATOS, 'inventario.json');
const PUERTO  = Number(process.env.PUERTO) || 8123;

/* ================= el archivo como base de datos ================= */
/* Node atiende una petición a la vez, así que no hay dos escrituras a la vez
   que puedan pisarse: alcanza con leer, cambiar y volver a escribir. Lo que sí
   hay que cuidar es un corte a media escritura, y para eso se escribe en un
   archivo aparte y se renombra encima, que el sistema hace de un solo golpe. */
function leerJson(archivo, siNoHay){
  try{ return JSON.parse(fs.readFileSync(archivo, 'utf8')); }
  catch(e){ return siNoHay; }
}

function escribirJson(archivo, valor){
  fs.mkdirSync(path.dirname(archivo), {recursive: true});
  const temp = archivo + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(valor, null, 1), 'utf8');
  fs.renameSync(temp, archivo);
}

const leerSolicitudes = () => leerJson(F_SOLIC, []);
const leerUsuarios    = () => leerJson(F_USERS, []);
const leerGuias       = () => leerJson(F_GUIAS, []);
const leerInventario  = () => leerJson(F_INV, []);

/* ================= usuarios y claves ================= */
/* La clave nunca se guarda: se guarda su huella con scrypt y una sal propia.
   Quien abra usuarios.json no puede sacar de ahí la contraseña de nadie. */
function huella(clave, sal){
  return crypto.scryptSync(clave, sal, 32).toString('hex');
}

/* Una clave que se pueda dictar por teléfono sin deletrear: sílabas y un
   número. No es para guardar secretos de Estado, es para que el compañero
   entre hoy y la cambie cuando quiera. */
function claveLegible(){
  const s = ['ba','ce','di','fo','gu','la','me','ni','po','ru','sa','te','vi','zo'];
  const trozo = () => s[crypto.randomInt(s.length)];
  return trozo() + trozo() + '-' + trozo() + trozo() + '-' + crypto.randomInt(10, 100);
}

/* Las banderas sueltas del comando: --nombre "Dan Moreno" --cargo "Técnico".
   Devuelve undefined si no se puso la bandera y '' si se puso vacía. Esa
   diferencia importa: no ponerla conserva lo que hubiera, y ponerla vacía
   (--cedula "") lo borra, que es como se corrige un dato que no era de esa
   persona. */
function bandera(nombre){
  const i = process.argv.indexOf('--' + nombre);
  if(i < 0) return undefined;
  const v = process.argv[i + 1];
  if(v === undefined || v.startsWith('--')) return '';
  return v.trim();
}

/* Lo que sale impreso en el bloque "TECNICO DE SOPORTE" de la Hoja de Servicio.
   Guardarlo en la cuenta es lo que permite que el técnico no lo reescriba en
   cada solicitud, y que la hoja salga completa en vez de con rayas en blanco. */
const DATOS_TECNICO = ['nombre', 'cargo', 'cedula', 'telefono'];

function crearUsuario(correo, clave){
  if(!correo){
    console.error('Uso: node servidor.js --crear-usuario correo@ciip.gob.ve [clave] \\');
    console.error('       --nombre "Dan Moreno" --cargo "Técnico de soporte" \\');
    console.error('       --cedula 26.610.022 --telefono 0412-5425243');
    console.error('');
    console.error('  Sin clave, se inventa una y se muestra para que se la pases.');
    console.error('  El nombre y el cargo salen impresos en la Hoja de Servicio.');
    process.exit(1);
  }
  /* si la "clave" empieza por -- es en realidad la primera bandera */
  if(clave && clave.startsWith('--')) clave = null;

  const usuarios = leerUsuarios();
  const buscado = correo.toLowerCase().trim();
  const previo = usuarios.find(u => u.correo === buscado);

  /* Corregirle el cargo a alguien no puede dejarlo fuera de su propia cuenta.
     Sin clave: si ya existía, se conserva la suya; si es nuevo, se inventa una
     y se muestra. (Este mismo comando le cambió la clave a alguien por
     corregirle un dato; de ahí la distinción.) */
  const conservaClave = !clave && !!previo;
  const inventada = !clave && !previo;
  if(inventada) clave = claveLegible();
  if(clave && clave.length < 6){
    console.error('La clave es muy corta: pon al menos 6 caracteres.');
    process.exit(1);
  }

  const sal = conservaClave ? previo.sal : crypto.randomBytes(16).toString('hex');
  const hash = conservaClave ? previo.hash : huella(clave, sal);

  const fila = {correo: buscado, sal, hash,
                creado_en: (previo && previo.creado_en) || new Date().toISOString()};
  /* lo que no se vuelva a indicar se conserva: cambiar la clave no debe borrar
     el cargo de nadie. Indicarlo vacío sí borra. */
  DATOS_TECNICO.forEach(k => {
    const b = bandera(k);
    fila[k] = (b === undefined) ? ((previo && previo[k]) || null) : (b || null);
  });
  /* sin nombre, el de la Hoja de Servicio sería un correo electrónico */
  if(!fila.nombre) fila.nombre = buscado.split('@')[0].replace(/[._]/g, ' ');

  const i = usuarios.findIndex(u => u.correo === buscado);
  if(i >= 0){ usuarios[i] = fila; console.log('\n  Cuenta actualizada: ' + fila.correo); }
  else      { usuarios.push(fila); console.log('\n  Usuario creado: ' + fila.correo); }
  escribirJson(F_USERS, usuarios);

  console.log('  Nombre:   ' + fila.nombre);
  if(fila.cargo)    console.log('  Cargo:    ' + fila.cargo);
  if(fila.cedula)   console.log('  Cédula:   ' + fila.cedula);
  if(fila.telefono) console.log('  Teléfono: ' + fila.telefono);
  if(inventada){
    console.log('  Clave:    ' + clave);
    console.log('\n  Pásasela y que la cambie cuando quiera, con este mismo comando.');
  }else if(conservaClave){
    console.log('  Clave:    la de siempre, no se tocó.');
  }
  const faltan = ['cargo','cedula','telefono'].filter(k => !fila[k]);
  if(faltan.length){
    console.log('\n  Ojo: sin ' + faltan.join(' ni ') + ', la Hoja de Servicio sale con');
    console.log('  esas rayas en blanco para llenar a mano. Se agregan así:');
    console.log('    node servidor.js --crear-usuario ' + fila.correo +
                ' ' + faltan.map(k => '--' + k + ' "…"').join(' '));
  }
  console.log('');
}

function listarUsuarios(){
  const usuarios = leerUsuarios();
  if(!usuarios.length){
    console.log('\n  No hay ningún usuario. Sin uno, nadie puede entrar a la bandeja:');
    console.log('    node servidor.js --crear-usuario tu.correo@ciip.gob.ve\n');
    return;
  }
  console.log('\n  Quién puede entrar a la bandeja (' + usuarios.length + '):');
  usuarios.forEach(u => console.log('    · ' + u.correo +
    (u.creado_en ? '   desde ' + u.creado_en.slice(0, 10) : '')));
  console.log('\n  Las claves no se guardan: solo su huella. Si alguien la olvida,');
  console.log('  no se puede recuperar — se le pone una nueva con --crear-usuario.\n');
}

function borrarUsuario(correo){
  if(!correo){
    console.error('Uso: node servidor.js --borrar-usuario correo@ciip.gob.ve');
    process.exit(1);
  }
  const usuarios = leerUsuarios();
  const buscado = correo.toLowerCase().trim();
  const quedan = usuarios.filter(u => u.correo !== buscado);
  if(quedan.length === usuarios.length){
    console.error('\n  No existe ningún usuario con ese correo: ' + buscado + '\n');
    process.exit(1);
  }
  /* Quedarse sin nadie deja la bandeja cerrada para siempre, y la única
     salida sería volver a la línea de comandos. Mejor avisar que permitirlo. */
  if(!quedan.length){
    console.error('\n  Ese es el último usuario. Si lo borras, nadie puede entrar a la');
    console.error('  bandeja. Crea antes al sustituto y vuelve a intentarlo.\n');
    process.exit(1);
  }
  escribirJson(F_USERS, quedan);
  console.log('\n  Usuario borrado: ' + buscado);
  console.log('  Quedan ' + quedan.length + ': ' + quedan.map(u => u.correo).join(', ') + '\n');
}

function claveCorrecta(correo, clave){
  const u = leerUsuarios().find(x => x.correo === String(correo || '').toLowerCase().trim());
  if(!u) return false;
  const dado = Buffer.from(huella(clave, u.sal), 'hex');
  const bueno = Buffer.from(u.hash, 'hex');
  /* comparación de tiempo constante: comparar con === filtra claves por el
     tiempo que tarda en fallar */
  return dado.length === bueno.length && crypto.timingSafeEqual(dado, bueno);
}

/* ================= sesiones ================= */
/* Viven en memoria: si se reinicia el servidor, GTIC vuelve a entrar. Para una
   herramienta de oficina que se apaga cada noche, guardarlas en disco sería
   más riesgo que comodidad. */
const sesiones = new Map();   /* token -> {correo, expira} */
const refrescos = new Map();  /* refresco -> correo */
const UNA_HORA = 3600 * 1000;

function abrirSesion(correo){
  const token = crypto.randomBytes(32).toString('hex');
  const refresco = crypto.randomBytes(32).toString('hex');
  sesiones.set(token, {correo, expira: Date.now() + UNA_HORA});
  refrescos.set(refresco, correo);
  /* Van el nombre y el cargo, no solo el correo: la bandeja los necesita para
     dar por atendida una solicitud sin que el técnico se reescriba cada vez.
     La sal y la huella de la clave, evidentemente, no salen de aquí. */
  const u = leerUsuarios().find(x => x.correo === correo) || {};
  const quien = {email: correo};
  DATOS_TECNICO.forEach(k => { if(u[k]) quien[k] = u[k]; });
  return {access_token: token, refresh_token: refresco, expires_in: 3600,
          token_type: 'bearer', user: quien};
}

function sesionDe(req){
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : '';
  const s = sesiones.get(token);
  if(!s) return null;
  if(Date.now() > s.expira){ sesiones.delete(token); return null; }
  /* Dar de baja a alguien se hace desde la línea de comandos, en otro proceso,
     que no puede tocar esta memoria. Sin esta comprobación, quien ya estuviera
     dentro seguiría dentro hasta que venciera su hora. Se relee el archivo en
     cada petición: son cuatro líneas de JSON, no cuesta nada. */
  if(!leerUsuarios().some(u => u.correo === s.correo)){
    sesiones.delete(token);
    return null;
  }
  return s;
}

/* Quién firma lo que escribe: el nombre de la cuenta, y el correo si nadie se
   lo puso. La sesión solo guarda el correo, que es lo que no cambia. */
function quienEs(sesion){
  const u = leerUsuarios().find(x => x.correo === sesion.correo);
  return (u && u.nombre) || sesion.correo;
}

/* ================= avisar en cuanto algo cambia =================
   Preguntar cada quince segundos deja una espera que se siente. Aquí el
   servidor avisa: cada página abierta deja una conexión escuchando y recibe un
   empujón en cuanto una solicitud entra o cambia de estado.

   El aviso NO lleva datos, solo dice "algo cambió". Así no hay que decidir qué
   puede ver cada quien por este canal: cada página vuelve a preguntar por su
   vía de siempre, con sus permisos. Un cambio en la solicitud de alguien no le
   filtra nada a los demás.

   Si esto falla —o el día que los datos se muden a Supabase, que no tiene esta
   ruta— las páginas siguen preguntando cada tanto por su cuenta. */
const oyentes = new Set();

/* El aviso dice de qué se trata —"nueva" o "cambio"— y nada más. Las páginas
   ni lo miran: ellas vuelven a pedir la lista con su sesión, que es lo que
   decide qué puede ver cada quien. Quien lo usa es el vigía (vigia.ps1), que
   solo tiene que traer la bandeja al frente cuando entra algo nuevo y no cada
   vez que un técnico toma o cierra una. Saber que entró una solicitud, sin
   saber de quién ni de qué, es lo único que viaja por ahí. */
function avisarCambio(que){
  const linea = 'data: ' + (que || 'cambio') + '\n\n';
  for(const res of oyentes){
    try{ res.write(linea); }
    catch(e){ oyentes.delete(res); }
  }
}

/* Una línea de vida cada 25 segundos. Sin ella, una conexión que lleva rato
   callada la puede dar por muerta el sistema operativo o un proxy, y el aviso
   no llegaría nunca. Los ':' son un comentario del protocolo: el navegador lo
   recibe y lo descarta. */
setInterval(() => {
  for(const res of oyentes){
    try{ res.write(': sigo aqui\n\n'); }
    catch(e){ oyentes.delete(res); }
  }
}, 25000).unref();

/* ================= respuestas ================= */
function responder(res, codigo, cuerpo, tipo){
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': tipo || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(texto);
}

function cuerpoDe(req){
  return new Promise((resolver, rechazar) => {
    let datos = '';
    req.on('data', t => {
      datos += t;
      /* un cuerpo desmedido solo puede ser un error o una travesura */
      /* un mensaje de texto no llega a 1 KB, pero una foto de 8 MB en base64
         ocupa 11: el tope tiene que dar para eso y nada mas */
      if(datos.length > 16e6){ rechazar(new Error('Cuerpo demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
      try{ resolver(datos ? JSON.parse(datos) : {}); }
      catch(e){ rechazar(new Error('El cuerpo no es JSON válido')); }
    });
    req.on('error', rechazar);
  });
}

/* ================= adjuntos: fotos y PDF =================
   Una foto de la pantalla dice en un segundo lo que cuesta tres mensajes
   escribir, y un PDF es a veces lo único que hay (una factura, un informe de
   error impreso). Se guardan en datos/adjuntos/, fuera del repositorio como
   todo lo demás de la casa.

   Solo tres tipos, y se comprueba lo que el archivo ES, no lo que dice ser: el
   navegador manda un "tipo" que cualquiera puede falsear, así que se miran los
   primeros bytes. Un .exe renombrado a .jpg no pasa.

   El nombre en disco es un azar de 32 caracteres, no el que traía: así dos
   personas pueden mandar "foto.jpg" sin pisarse, y la dirección del archivo no
   se adivina —que es lo que hace las veces de permiso, igual que el id de la
   solicitud para quien la pidió. */
const ADJUNTOS = path.join(DATOS, 'adjuntos');
const TOPE_ADJUNTO = 8 * 1024 * 1024;   /* 8 MB: un PDF escaneado cabe */

const FIRMAS = [
  {tipo: 'image/jpeg', ext: '.jpg', firma: [0xFF, 0xD8, 0xFF]},
  {tipo: 'image/png',  ext: '.png', firma: [0x89, 0x50, 0x4E, 0x47]},
  {tipo: 'application/pdf', ext: '.pdf', firma: [0x25, 0x50, 0x44, 0x46]},
];

function queEs(buf){
  return FIRMAS.find(f => f.firma.every((b, i) => buf[i] === b)) || null;
}

/* El nombre que la persona verá al descargarlo. Se le quitan las rutas y los
   caracteres que no pintan nada en un nombre de archivo. */
function nombreLimpio(nombre, ext){
  const base = String(nombre || '').split(/[\\/]/).pop()
    .replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '').trim().slice(0, 80);
  return base || ('archivo' + ext);
}

function guardarAdjunto(datos){
  const crudo = String(datos.datos || '');
  /* viene como data:image/jpeg;base64,XXXX o solo el base64 */
  const b64 = crudo.includes(',') ? crudo.slice(crudo.indexOf(',') + 1) : crudo;
  const buf = Buffer.from(b64, 'base64');
  if(!buf.length) throw Object.assign(new Error('El archivo llegó vacío.'), {codigo: 400});
  if(buf.length > TOPE_ADJUNTO){
    throw Object.assign(new Error('El archivo pesa más de 8 MB.'), {codigo: 413});
  }
  const que = queEs(buf);
  if(!que){
    throw Object.assign(new Error('Solo se pueden mandar fotos (JPG o PNG) y documentos PDF.'),
                        {codigo: 415});
  }
  fs.mkdirSync(ADJUNTOS, {recursive: true});
  const archivo = crypto.randomBytes(16).toString('hex') + que.ext;
  fs.writeFileSync(path.join(ADJUNTOS, archivo), buf);
  return {
    url: '/adjuntos/' + archivo,
    nombre: nombreLimpio(datos.nombre, que.ext),
    tipo: que.tipo,
    tamano: buf.length,
  };
}

/* Lo que el navegador dice haber subido, comprobado contra lo que hay en
   disco: sin esto, cualquiera podría inventarse una dirección en un mensaje. */
function adjuntosValidos(lista){
  if(!Array.isArray(lista)) return [];
  return lista.filter(a => a && typeof a.url === 'string' &&
      /^\/adjuntos\/[0-9a-f]{32}\.(jpg|png|pdf)$/.test(a.url) &&
      fs.existsSync(path.join(ADJUNTOS, path.basename(a.url))))
    .slice(0, 4)
    .map(a => ({url: a.url, nombre: nombreLimpio(a.nombre, ''), tipo: String(a.tipo || ''),
                tamano: Number(a.tamano) || 0}));
}

/* ---------- imprimir con el navegador que ya está instalado ----------
   Edge trae un modo sin ventana que imprime una página a PDF. Es lo que
   convierte la Hoja de Servicio en un archivo idéntico al que sale por la
   impresora, sin librerías ni plantillas duplicadas.

   Devuelve null —sin ruido— si no encuentra el navegador o si algo falla: la
   ruta que llama a esto tiene su plan B. */
const NAVEGADORES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function pdfDelNavegador(id){
  return new Promise(listo => {
    const navegador = NAVEGADORES.find(p => fs.existsSync(p));
    if(!navegador) return listo(null);

    const os = require('os');
    const salida = path.join(os.tmpdir(), 'hoja-' + crypto.randomBytes(6).toString('hex') + '.pdf');
    const perfil = path.join(os.tmpdir(), 'edge-hoja-' + crypto.randomBytes(4).toString('hex'));

    const {execFile} = require('child_process');
    execFile(navegador, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--user-data-dir=' + perfil,
      /* la página pide sus datos al servidor; hay que darle tiempo a que
         llegue la respuesta antes de imprimir */
      '--virtual-time-budget=8000',
      '--no-pdf-header-footer',
      '--print-to-pdf=' + salida,
      'http://127.0.0.1:' + PUERTO + '/hoja.html?id=eq.' + id,
    ], {timeout: 25000}, () => {
      let cuerpo = null;
      try{
        if(fs.existsSync(salida) && fs.statSync(salida).size > 800) cuerpo = fs.readFileSync(salida);
      }catch(e){}
      try{ fs.unlinkSync(salida); }catch(e){}
      try{ fs.rmSync(perfil, {recursive: true, force: true}); }catch(e){}
      listo(cuerpo);
    });
  });
}

/* ================= la API ================= */
const CAMPOS_QUE_LLEGAN = ['gerencia','usuario','cedula','telefono','piso','oficina','cargo',
                           'descripcion','tipo','detalle'];
/* tecnico es el nombre; los tres de al lado salen impresos junto a su firma */
const CAMPOS_QUE_ATIENDE = ['estado','tecnico','tecnico_cargo','tecnico_cedula',
                            'tecnico_telefono','observaciones','renglones','atendida_en'];
const ESTADOS = ['recibida','en_proceso','atendida','anulada'];

/* El correlativo del año, igual que el disparador de sql/esquema.sql. Aquí no
   hacen falta cerrojos: Node atiende una petición a la vez. */
function siguienteNumero(solicitudes, anio){
  return solicitudes.filter(s => s.anio === anio)
    .reduce((mayor, s) => Math.max(mayor, s.numero || 0), 0) + 1;
}

/* Caracas no cambia de hora, así que basta con restar cuatro horas a UTC para
   que una solicitud de las 9 de la noche no cuente como del día siguiente. */
function anioCaracas(){
  return new Date(Date.now() - 4 * 3600 * 1000).getUTCFullYear();
}

/* Una solicitud abierta por persona. Se compara por el nombre, normalizado,
   que es lo único que siempre viene (la cédula es opcional). No es a prueba de
   pillos —quien quiera escribirá su nombre distinto— pero no es de eso de lo
   que protege: evita que la misma persona mande cinco veces lo mismo porque
   "no le han respondido", que es lo que de verdad pasa. */
const ABIERTAS = ['recibida', 'en_proceso'];
const normNombre = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function abiertaDe(solicitudes, usuario){
  const n = normNombre(usuario);
  if(!n) return null;
  return solicitudes.find(s => ABIERTAS.includes(s.estado) && normNombre(s.usuario) === n) || null;
}

function crearSolicitud(datos){
  const solicitudes = leerSolicitudes();
  const anio = anioCaracas();

  const yaTiene = abiertaDe(solicitudes, datos.usuario);
  if(yaTiene){
    const e = new Error('Ya tienes una solicitud abierta: la N° ' +
      String(yaTiene.numero).padStart(3, '0') + '-' + yaTiene.anio +
      '. Cuando GTIC la cierre podrás pedir otra.');
    e.codigo = 409;                    /* 409 = choca con algo que ya existe */
    e.abierta = {id: yaTiene.id, numero: yaTiene.numero, anio: yaTiene.anio,
                 estado: yaTiene.estado};
    throw e;
  }
  const fila = {
    id: crypto.randomUUID(),
    numero: siguienteNumero(solicitudes, anio),
    anio,
    estado: 'recibida',
    tecnico: null, observaciones: null, renglones: [], atendida_en: null,
    mensajes: [],
    creada_en: new Date().toISOString(),
  };
  /* solo se copia lo que le toca escribir a quien pide: el estado, el técnico
     y las observaciones no se aceptan desde el formulario */
  CAMPOS_QUE_LLEGAN.forEach(k => {
    if(datos[k] !== undefined && datos[k] !== null && String(datos[k]).trim() !== ''){
      fila[k] = String(datos[k]).slice(0, 2000);
    }else if(!(k in fila)){
      fila[k] = null;
    }
  });
  if(!fila.gerencia || !fila.usuario || !fila.descripcion){
    const e = new Error('Faltan datos obligatorios: gerencia, usuario y descripción.');
    e.codigo = 400; throw e;
  }

  /* El equipo, si el formulario lo mandó: sale del inventario de la casa —el
     serial que nadie se sabe de memoria— y llega ya escrito en el primer
     renglón de la hoja. Se copia campo por campo y recortado: viene del
     navegador, y de ahí no se acepta nada tal cual. */
  if(Array.isArray(datos.renglones)){
    fila.renglones = datos.renglones.slice(0, 6).map(r => ({
      tipo:    String((r && r.tipo)    || '').slice(0, 120),
      detalle: String((r && r.detalle) || '').slice(0, 200),
      equipo:  String((r && r.equipo)  || '').slice(0, 60),
      marca:   String((r && r.marca)   || '').slice(0, 60),
      modelo:  String((r && r.modelo)  || '').slice(0, 80),
      serial:  String((r && r.serial)  || '').slice(0, 80),
    })).filter(r => Object.values(r).some(v => v));
  }
  solicitudes.push(fila);
  escribirJson(F_SOLIC, solicitudes);
  return fila;
}

function atenderSolicitud(id, cambios){
  const solicitudes = leerSolicitudes();
  const i = solicitudes.findIndex(s => s.id === id);
  if(i < 0){ const e = new Error('No existe esa solicitud.'); e.codigo = 404; throw e; }
  const fila = solicitudes[i];
  CAMPOS_QUE_ATIENDE.forEach(k => {
    if(!(k in cambios)) return;
    if(k === 'estado'){
      if(!ESTADOS.includes(cambios.estado)){
        const e = new Error('Estado desconocido: ' + cambios.estado); e.codigo = 400; throw e;
      }
      fila.estado = cambios.estado;
    }else if(k === 'renglones'){
      fila.renglones = Array.isArray(cambios.renglones) ? cambios.renglones.slice(0, 6) : [];
    }else{
      fila[k] = cambios[k];
    }
  });
  escribirJson(F_SOLIC, solicitudes);
  return fila;
}

async function atenderApi(req, res, url){
  /* ---- la línea abierta por la que llegan los avisos ----
     Sin cuenta, porque el aviso no dice nada: solo que algo cambió. Esta
     respuesta no se cierra; se queda abierta hasta que la página se va. */
  if(url.pathname === '/rest/v1/eventos' && req.method === 'GET'){
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    });
    /* si la conexión se cae, que el navegador vuelva en tres segundos */
    res.write('retry: 3000\n\n');
    oyentes.add(res);
    req.on('close', () => oyentes.delete(res));
    return;
  }

  /* ---- entrar ---- */
  if(url.pathname === '/auth/v1/token'){
    const tipo = url.searchParams.get('grant_type');
    const cuerpo = await cuerpoDe(req);

    if(tipo === 'refresh_token'){
      const correo = refrescos.get(cuerpo.refresh_token);
      if(!correo) return responder(res, 400, {error_description: 'La sesión venció.'});
      refrescos.delete(cuerpo.refresh_token);
      return responder(res, 200, abrirSesion(correo));
    }
    if(!claveCorrecta(cuerpo.email, cuerpo.password)){
      /* el mismo mensaje para correo inexistente y clave mala: decir cuál de
         los dos falló es regalar la mitad del trabajo */
      return responder(res, 400, {error_description: 'Correo o contraseña incorrectos.'});
    }
    return responder(res, 200, abrirSesion(cuerpo.email.toLowerCase().trim()));
  }

  /* ---- mis datos ----
     Cada quien corrige los suyos desde la bandeja, sin pasar por la línea de
     comandos. Solo los cuatro que salen impresos: el correo no se toca (es la
     llave de la cuenta) y la clave tiene su propio camino. */
  if(url.pathname === '/auth/v1/user' && req.method === 'PATCH'){
    const s = sesionDe(req);
    if(!s) return responder(res, 401, {message: 'Hace falta iniciar sesión.'});

    const cuerpo = await cuerpoDe(req);
    const datos = cuerpo.data || cuerpo;
    const usuarios = leerUsuarios();
    const i = usuarios.findIndex(u => u.correo === s.correo);
    if(i < 0) return responder(res, 404, {message: 'Esa cuenta ya no existe.'});

    DATOS_TECNICO.forEach(k => {
      if(!(k in datos)) return;
      usuarios[i][k] = String(datos[k] == null ? '' : datos[k]).trim().slice(0, 120) || null;
    });
    /* sin nombre, la Hoja de Servicio saldría firmada por un correo */
    if(!usuarios[i].nombre){
      return responder(res, 400, {message: 'El nombre y apellido hace falta: sale impreso en la hoja.'});
    }
    escribirJson(F_USERS, usuarios);
    console.log('  ~ datos de ' + s.correo + ' actualizados');

    const quien = {email: s.correo};
    DATOS_TECNICO.forEach(k => { if(usuarios[i][k]) quien[k] = usuarios[i][k]; });
    return responder(res, 200, quien);
  }

  /* ---- escribirle al técnico, o al usuario ----
     Una sola ruta para los dos lados. Quién habla no lo dice el cuerpo del
     mensaje —eso sería confiar en el navegador— sino cómo llegó la petición:
     con sesión de GTIC, habla el técnico; sin ella, habla quien pidió, y su
     prueba es el id imposible de adivinar de su propia solicitud.

     Así nadie puede escribir haciéndose pasar por otro, y quien pide sigue sin
     necesitar cuenta. */
  if(url.pathname === '/rest/v1/rpc/enviar_mensaje' && req.method === 'POST'){
    const cuerpo = await cuerpoDe(req);
    const {id, texto} = cuerpo;
    if(!/^[0-9a-f-]{36}$/i.test(id || '')){
      return responder(res, 400, {message: 'Falta el identificador de la solicitud.'});
    }
    const limpio = String(texto == null ? '' : texto).trim().slice(0, 1000);
    /* Un mensaje puede ser solo una foto: "mira cómo quedó la pantalla" no
       necesita texto. Lo que no puede es venir vacío del todo. */
    const traidos = adjuntosValidos(cuerpo.adjuntos);
    if(!limpio && !traidos.length){
      return responder(res, 400, {message: 'El mensaje viene vacío.'});
    }

    const solicitudes = leerSolicitudes();
    const i = solicitudes.findIndex(s => s.id === id);
    if(i < 0) return responder(res, 404, {message: 'No existe esa solicitud.'});
    const s = solicitudes[i];
    if(s.estado === 'anulada'){
      return responder(res, 409, {message: 'Esa solicitud está anulada; ya no se puede escribir en ella.'});
    }

    const ses = sesionDe(req);
    let de, nombre;
    if(ses){
      const u = leerUsuarios().find(x => x.correo === ses.correo) || {};
      de = 'gtic';
      nombre = u.nombre || ses.correo;
    }else{
      de = 'usuario';
      nombre = s.usuario;
    }

    if(!Array.isArray(s.mensajes)) s.mensajes = [];
    const msg = {de, nombre, texto: limpio, en: new Date().toISOString()};
    if(traidos.length) msg.adjuntos = traidos;
    s.mensajes.push(msg);
    /* cien mensajes por solicitud son de sobra; más es una conversación que
       debería estar pasando por teléfono */
    if(s.mensajes.length > 100) s.mensajes = s.mensajes.slice(-100);

    escribirJson(F_SOLIC, solicitudes);
    console.log('  » mensaje en ' + String(s.numero).padStart(3,'0') + '-' + s.anio +
                ' de ' + de + ' (' + nombre + ')');
    avisarCambio();
    return responder(res, 200, [s.mensajes[s.mensajes.length - 1]]);
  }

  /* ---- la Hoja de Servicio en PDF ----
     El mismo papel que sale por la impresora de la bandeja, para quien pidió el
     soporte. Se hace abriendo hoja.html con el navegador sin ventana y
     diciéndole que imprima a PDF: así el documento es exactamente el que ya
     existe —con su logo y su formato— y no una segunda versión hecha a mano que
     se iría separando de la primera con cada retoque.

     Si el navegador no está o falla, se arma un PDF más sencillo aquí mismo
     (pdf.js), que dice lo mismo aunque se vea más pobre. Antes de eso, nadie se
     queda sin su comprobante. */
  if(url.pathname === '/rest/v1/hoja' && req.method === 'GET'){
    const filtro = url.searchParams.get('id') || '';
    const id = filtro.startsWith('eq.') ? filtro.slice(3) : filtro;
    if(!/^[0-9a-f-]{36}$/i.test(id)){
      return responder(res, 400, {message: 'Falta el identificador de la solicitud.'});
    }
    const s = leerSolicitudes().find(x => x.id === id);
    if(!s) return responder(res, 404, {message: 'No existe esa solicitud.'});

    const nombre = 'Hoja de Servicio ' + String(s.numero).padStart(3, '0') + '-' + s.anio + '.pdf';
    let cuerpo = await pdfDelNavegador(id);
    if(!cuerpo) cuerpo = require('./pdf.js').hojaPdf(s);

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': cuerpo.length,
      'Content-Disposition': 'attachment; filename="' + nombre.replace(/[^ -~]/g, '') + '"',
      'Cache-Control': 'no-store',
    });
    return res.end(cuerpo);
  }

  /* ---- subir una foto o un PDF ----
     Sin cuenta, como el resto de la conversación: la prueba de que uno tiene
     algo que ver con esa solicitud es su id imposible de adivinar, el mismo
     que ya hace de llave para escribir en el hilo. */
  if(url.pathname === '/rest/v1/rpc/subir_adjunto' && req.method === 'POST'){
    const cuerpo = await cuerpoDe(req);
    if(!/^[0-9a-f-]{36}$/i.test(cuerpo.id || '')){
      return responder(res, 400, {message: 'Falta el identificador de la solicitud.'});
    }
    const s = leerSolicitudes().find(x => x.id === cuerpo.id);
    if(!s) return responder(res, 404, {message: 'No existe esa solicitud.'});
    if(s.estado === 'anulada'){
      return responder(res, 409, {message: 'Esa solicitud está anulada.'});
    }
    try{
      return responder(res, 201, [guardarAdjunto(cuerpo)]);
    }catch(e){
      return responder(res, e.codigo || 400, {message: e.message});
    }
  }

  /* ---- retirar la propia solicitud, sin cuenta ----
     Uno se equivoca al escribir, o resuelve el problema solo, y con la regla de
     una a la vez se quedaría bloqueado esperando a que GTIC cierre algo que ya
     no hace falta. Aquí puede retirarla.

     La prueba de que es suya es el mismo id imposible de adivinar que sirve
     para consultarla. Y solo mientras nadie la haya tomado: si ya está en
     proceso, hay un técnico trabajando y borrarla por detrás sería dejarlo
     atendiendo un caso que en el sistema no existe. */
  if(url.pathname === '/rest/v1/rpc/retirar_solicitud' && req.method === 'POST'){
    const {id} = await cuerpoDe(req);
    if(!/^[0-9a-f-]{36}$/i.test(id || '')){
      return responder(res, 400, {message: 'Falta el identificador de la solicitud.'});
    }
    const solicitudes = leerSolicitudes();
    const i = solicitudes.findIndex(s => s.id === id);
    if(i < 0) return responder(res, 404, {message: 'No existe esa solicitud.'});

    const s = solicitudes[i];
    if(s.estado !== 'recibida'){
      return responder(res, 409, {message: s.estado === 'en_proceso'
        ? 'Un técnico ya la tomó. Habla con GTIC para cerrarla.'
        : 'Esa solicitud ya no está abierta.'});
    }
    s.estado = 'anulada';
    s.anulada_por = 'usuario';
    escribirJson(F_SOLIC, solicitudes);
    console.log('  - retirada ' + String(s.numero).padStart(3,'0') + '-' + s.anio +
                ' por ' + s.usuario);
    avisarCambio();
    return responder(res, 200, [{id: s.id, numero: s.numero, anio: s.anio, estado: s.estado}]);
  }

  /* ---- el inventario que GTIC va completando ----
     Leerlo es público, como el cuadro que ya viaja en js/inventario.js: son los
     equipos de la casa, y el formulario los necesita para mandar el serial sin
     que nadie lo escriba. Agregar es solo con sesión: esto acaba impreso en una
     Hoja de Servicio y no puede escribirlo cualquiera. */
  if(url.pathname === '/rest/v1/inventario'){
    if(req.method === 'GET'){
      return responder(res, 200, leerInventario());
    }
    if(req.method === 'POST'){
      const sesion = sesionDe(req);
      if(!sesion) return responder(res, 401, {message: 'Hace falta iniciar sesión.'});

      const d = await cuerpoDe(req);
      const limpio = t => String(t == null ? '' : t).trim().slice(0, 80);
      const fila = {
        nombre: limpio(d.nombre), equipo: limpio(d.equipo), marca: limpio(d.marca),
        modelo: limpio(d.modelo), serial: limpio(d.serial),
        quien: quienEs(sesion), en: new Date().toISOString(),
      };
      if(!fila.nombre || !fila.equipo){
        return responder(res, 400, {message: 'Hacen falta la persona y el tipo de equipo.'});
      }
      const inv = leerInventario();
      /* Si esa persona ya tenía ese mismo tipo de equipo apuntado aquí, se
         corrige en vez de duplicarse: nadie quiere dos CPU para el mismo
         puesto porque el serial se escribió mal la primera vez. */
      const i = inv.findIndex(x => x.nombre === fila.nombre && x.equipo === fila.equipo);
      if(i >= 0) inv[i] = fila; else inv.push(fila);
      escribirJson(F_INV, inv);
      console.log('  » inventario:', fila.nombre, '·', fila.equipo,
                  fila.serial ? '· serial ' + fila.serial : '', '(' + fila.quien + ')');
      return responder(res, 201, [fila]);
    }
  }

  /* ---- lo que de una guía puede ver la casa ----
     Sin cuenta, como el formulario. Devuelve SOLO el título y el párrafo que
     el técnico escribió pensando en quien pide —nunca el cuerpo de la guía,
     donde están las mañas internas— y solo de las guías que lo tengan. Una
     guía sin ese párrafo no existe para esta ruta.

     Es una ruta aparte y no un filtro sobre la otra a propósito: así lo que
     sale de la gerencia se decide en un solo sitio y se lee de un vistazo. */
  if(url.pathname === '/rest/v1/guias_publicas' && req.method === 'GET'){
    const publicas = leerGuias()
      .filter(g => String(g.solucion || '').trim())
      .map(g => ({id: g.id, titulo: g.titulo, categoria: g.categoria, solucion: g.solucion}));
    return responder(res, 200, publicas);
  }

  /* ---- las guías: lo que GTIC ya sabe ----
     Solo con sesión, las cuatro operaciones. No hay lectura anónima a
     propósito: aquí se escriben mañas de la casa —a quién llamar, qué clave
     tiene tal equipo, por dónde se cuelga el sistema— y eso no sale de la
     gerencia. La página del usuario ni las pide. */
  if(url.pathname === '/rest/v1/guias'){
    const sesion = sesionDe(req);
    if(!sesion) return responder(res, 401, {message: 'Hace falta iniciar sesión.'});

    if(req.method === 'GET'){
      const guias = leerGuias()
        .sort((a, b) => String(b.actualizada_en).localeCompare(String(a.actualizada_en)));
      return responder(res, 200, guias);
    }

    if(req.method === 'POST'){
      const datos = await cuerpoDe(req);
      const titulo = String(datos.titulo || '').trim();
      const cuerpo = String(datos.cuerpo || '').trim();
      if(!titulo || !cuerpo){
        return responder(res, 400, {message: 'Una guía necesita título y contenido.'});
      }
      const guias = leerGuias();
      const ahora = new Date().toISOString();
      const fila = {
        id: crypto.randomUUID(),
        titulo: titulo.slice(0, 160),
        categoria: String(datos.categoria || '').trim().slice(0, 120) || 'General',
        cuerpo: cuerpo.slice(0, 20000),
        /* lo unico de la guia que ve quien pide; en blanco, no sale de GTIC */
        solucion: String(datos.solucion || '').trim().slice(0, 4000) || null,
        /* de qué solicitud salió, cuando sale de una: sirve para volver al caso */
        origen: datos.origen ? String(datos.origen).slice(0, 40) : null,
        autor: quienEs(sesion),
        creada_en: ahora,
        actualizada_en: ahora,
      };
      guias.push(fila);
      escribirJson(F_GUIAS, guias);
      console.log('  » guía nueva:', fila.titulo, '·', fila.autor);
      return responder(res, 201, [fila]);
    }

    /* el navegador pide ?id=eq.<id>, como haría contra Supabase */
    const filtro = url.searchParams.get('id') || '';
    const id = filtro.startsWith('eq.') ? filtro.slice(3) : '';
    const guias = leerGuias();
    const i = guias.findIndex(g => g.id === id);
    if(i < 0) return responder(res, 404, {message: 'No existe esa guía.'});

    if(req.method === 'PATCH'){
      const datos = await cuerpoDe(req);
      ['titulo', 'categoria', 'cuerpo', 'solucion'].forEach(k => {
        if(datos[k] !== undefined) guias[i][k] = String(datos[k]).trim().slice(0, 20000);
      });
      if(!guias[i].titulo || !guias[i].cuerpo){
        return responder(res, 400, {message: 'Una guía necesita título y contenido.'});
      }
      guias[i].actualizada_en = new Date().toISOString();
      guias[i].autor = quienEs(sesion);
      escribirJson(F_GUIAS, guias);
      return responder(res, 200, [guias[i]]);
    }

    if(req.method === 'DELETE'){
      const fuera = guias.splice(i, 1)[0];
      escribirJson(F_GUIAS, guias);
      console.log('  » guía borrada:', fuera.titulo);
      return responder(res, 200, [fuera]);
    }
  }

  /* ---- solicitudes ---- */
  if(url.pathname === '/rest/v1/solicitudes'){
    /* Dejar una solicitud: sin cuenta, como en la calle. */
    if(req.method === 'POST'){
      const fila = crearSolicitud(await cuerpoDe(req));
      console.log('  + solicitud', String(fila.numero).padStart(3,'0') + '-' + fila.anio,
                  '·', fila.usuario, '·', fila.gerencia);
      avisarCambio('nueva');
      return responder(res, 201, [fila]);
    }
    /* ---- consultar el estado de LA PROPIA solicitud, sin cuenta ----
       Solo de una en una y solo dando su id, que es un UUID: 122 bits al azar
       que nadie adivina ni recorre en orden. Es lo que hace que se pueda
       consultar sin clave sin que eso permita leer las de los demás — a
       diferencia del número correlativo, que sería 001, 002, 003…
       El navegador de quien pidió guarda esos id al enviar; nadie más los
       tiene. Y se devuelve un resumen: lo que a esa persona le sirve saber,
       no la ficha entera. */
    if(req.method === 'GET' && !sesionDe(req)){
      const filtro = url.searchParams.get('id') || '';
      const id = filtro.startsWith('eq.') ? filtro.slice(3) : '';
      if(!/^[0-9a-f-]{36}$/i.test(id)){
        return responder(res, 401, {message: 'Hace falta iniciar sesión.'});
      }
      const s = leerSolicitudes().find(x => x.id === id);
      if(!s) return responder(res, 200, []);
      /* Sus propios datos van completos: son los que esa misma persona
         escribió, y hacen falta para que su Hoja de Servicio en PDF salga
         igual que la que firma en papel. Del técnico va lo que la hoja
         imprime, que es lo que ella va a tener delante de todos modos. */
      return responder(res, 200, [{
        id: s.id, numero: s.numero, anio: s.anio, estado: s.estado,
        gerencia: s.gerencia, usuario: s.usuario, cedula: s.cedula,
        telefono: s.telefono, piso: s.piso, oficina: s.oficina,
        descripcion: s.descripcion, tipo: s.tipo, detalle: s.detalle,
        cargo: s.cargo || null,
        renglones: Array.isArray(s.renglones) ? s.renglones : [],
        creada_en: s.creada_en, atendida_en: s.atendida_en,
        tecnico: s.tecnico, tecnico_cargo: s.tecnico_cargo || null,
        tecnico_cedula: s.tecnico_cedula || null,
        tecnico_telefono: s.tecnico_telefono || null,
        observaciones: s.observaciones,
        anulada_por: s.anulada_por || null,
        mensajes: Array.isArray(s.mensajes) ? s.mensajes : [],
      }]);
    }

    /* Verlas todas y atenderlas: solo GTIC. */
    if(!sesionDe(req)) return responder(res, 401, {message: 'Hace falta iniciar sesión.'});

    if(req.method === 'GET'){
      const filas = leerSolicitudes()
        .sort((a, b) => String(b.creada_en).localeCompare(String(a.creada_en)));
      return responder(res, 200, filas);
    }
    if(req.method === 'PATCH'){
      /* el navegador pide ?id=eq.<id>, como haría contra Supabase */
      const filtro = url.searchParams.get('id') || '';
      const id = filtro.startsWith('eq.') ? filtro.slice(3) : '';
      const fila = atenderSolicitud(id, await cuerpoDe(req));
      console.log('  ~ atendida', String(fila.numero).padStart(3,'0') + '-' + fila.anio,
                  '→', fila.estado);
      avisarCambio();
      return responder(res, 200, [fila]);
    }
  }
  return responder(res, 404, {message: 'Ruta desconocida.'});
}

/* ================= archivos ================= */
const TIPOS = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.pdf':'application/pdf', '.jpeg':'image/jpeg', '.md':'text/markdown; charset=utf-8',
};

function servirArchivo(res, pedido){
  /* path.normalize aplana los ".." antes de comprobar: sin esto, una petición
     a /../../algo se saldría de la carpeta del sitio. */
  const limpio = path.normalize(decodeURIComponent(pedido)).replace(/^([/\\])+/, '');

  /* Los adjuntos del chat viven en datos/adjuntos/ —fuera del sitio, con el
     resto de lo que es de la casa— pero se piden como /adjuntos/xxx. Solo por
     su nombre exacto: 32 caracteres al azar. Cualquier otra cosa ni se busca,
     así que por aquí no se llega al resto de datos/ ni se lista la carpeta. */
  if(limpio === 'adjuntos' || limpio.startsWith('adjuntos' + path.sep)){
    const nombre = path.basename(limpio);
    if(!/^[0-9a-f]{32}\.(jpg|png|pdf)$/.test(nombre)){
      return responder(res, 403, 'Prohibido', 'text/plain');
    }
    return enviarArchivo(res, path.join(ADJUNTOS, nombre));
  }

  const destino = path.join(RAIZ, limpio || 'index.html');

  if(!destino.startsWith(RAIZ)) return responder(res, 403, 'Fuera de sitio', 'text/plain');
  /* datos/ guarda las solicitudes y las huellas de las claves: no se sirve */
  if(destino.startsWith(DATOS)) return responder(res, 403, 'Prohibido', 'text/plain');

  enviarArchivo(res, destino);
}

function enviarArchivo(res, destino){
  fs.stat(destino, (err, st) => {
    if(err || !st.isFile()) return responder(res, 404, 'No está aquí', 'text/plain');
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    /* Un navegador corta la descarga de una imagen a media asta cada dos por
       tres —se cambia de página, se cierra la ventana— y ese corte llega aquí
       como un error del flujo. Sin estas dos líneas, ese error no lo atrapa
       nadie: no está dentro del try del servidor, porque ocurre después, y un
       error suelto tumba el proceso entero. Es decir, alguien cerrando una
       pestaña dejaba a toda la oficina sin servidor. */
    const flujo = fs.createReadStream(destino);
    flujo.on('error', () => { try{ res.destroy(); }catch(e){} });
    res.on('close', () => flujo.destroy());
    flujo.pipe(res);
  });
}

/* ================= arranque ================= */
const ORDEN = process.argv[2];
if(ORDEN === '--crear-usuario'){ crearUsuario(process.argv[3], process.argv[4]); process.exit(0); }
if(ORDEN === '--usuarios'){ listarUsuarios(); process.exit(0); }
if(ORDEN === '--borrar-usuario'){ borrarUsuario(process.argv[3]); process.exit(0); }
if(ORDEN && ORDEN.startsWith('--')){
  console.log('\n  Órdenes disponibles:');
  console.log('    node servidor.js                                   levanta el sitio');
  console.log('    node servidor.js --usuarios                        quién puede entrar');
  console.log('    node servidor.js --crear-usuario correo [clave]    alta, o cambio de clave');
  console.log('    node servidor.js --borrar-usuario correo           baja\n');
  process.exit(ORDEN === '--ayuda' ? 0 : 1);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  try{
    if(url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')){
      return await atenderApi(req, res, url);
    }
    if(req.method !== 'GET') return responder(res, 405, {message: 'Método no permitido.'});
    return servirArchivo(res, url.pathname);
  }catch(e){
    console.error('  ! ', e.message);
    /* el 409 viaja con la solicitud que ya estaba abierta: el formulario la
       muestra en vez de limitarse a decir que no */
    responder(res, e.codigo || 500,
      Object.assign({message: e.message}, e.abierta ? {abierta: e.abierta} : {}));
  }
});

/* ---------- dejar dicho por qué se murió ----------
   Este servidor corre en una ventana negra que casi siempre está minimizada, y
   cuando se caía no quedaba rastro: la oficina se enteraba porque la página
   dejaba de cargar y aquí no había nada que leer. Ahora todo lo que lo tumbe
   queda escrito con su hora en datos/servidor.log. */
function anotarFallo(que, e){
  const linea = '\n[' + new Date().toISOString() + '] ' + que + '\n' +
                ((e && e.stack) || String(e)) + '\n';
  try{
    fs.mkdirSync(DATOS, {recursive: true});
    fs.appendFileSync(path.join(DATOS, 'servidor.log'), linea, 'utf8');
  }catch(x){}
  console.error(linea);
}

process.on('uncaughtException', e => {
  anotarFallo('Error suelto', e);
  /* Se sigue sirviendo. Un error atendiendo una petición no puede dejar sin
     sistema a toda la casa; y si de verdad quedó algo roto, el registro lo
     dice y servir.cmd vuelve a levantarlo cuando haga falta. */
});
process.on('unhandledRejection', e => anotarFallo('Promesa sin atender', e));

/* La IP de esta máquina en la red de la oficina. Se descartan la de loopback y
   la del VPN de Cloudflare (172.16.x), con la que nadie podría entrar. */
function ipDeRed(){
  const redes = require('os').networkInterfaces();
  for(const nombre of Object.keys(redes)){
    for(const d of redes[nombre] || []){
      if(d.family === 'IPv4' && !d.internal && !d.address.startsWith('172.16.')) return d.address;
    }
  }
  return 'localhost';
}

servidor.listen(PUERTO, '0.0.0.0', () => {
  const ip = ipDeRed();
  const n = leerSolicitudes().length;
  const u = leerUsuarios().length;
  console.log('');
  console.log('  ============================================================');
  console.log('   SOLICITUD DE SOPORTE · GTIC · CIIP');
  console.log('  ============================================================');
  console.log('');
  console.log('   En esta máquina:     http://localhost:' + PUERTO + '/index.html');
  console.log('   Desde la oficina:    http://' + ip + ':' + PUERTO + '/index.html');
  console.log('   La bandeja de GTIC:  http://' + ip + ':' + PUERTO + '/bandeja.html');
  console.log('');
  console.log('   Solicitudes guardadas: ' + n + '   ·   Usuarios de GTIC: ' + u);
  if(!u){
    console.log('');
    console.log('   ¡Falta crear el primer usuario para entrar a la bandeja!');
    console.log('     node servidor.js --crear-usuario tu.correo@ciip.gob.ve tuClave');
  }
  console.log('');
  console.log('   Todo se guarda en:   datos\\solicitudes.json');
  /* Corre sin ventana, así que ya no vale aquello de "no la cierres": lo que
     hace falta es saber dónde mirar y con qué apagarlo. */
  console.log('   Cómo va todo:        estado.cmd');
  console.log('   Para apagarlo:       detener.cmd');
  console.log('');
});
