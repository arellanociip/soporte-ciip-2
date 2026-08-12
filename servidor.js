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
      if(datos.length > 1e6){ rechazar(new Error('Cuerpo demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
      try{ resolver(datos ? JSON.parse(datos) : {}); }
      catch(e){ rechazar(new Error('El cuerpo no es JSON válido')); }
    });
    req.on('error', rechazar);
  });
}

/* ================= la API ================= */
const CAMPOS_QUE_LLEGAN = ['gerencia','usuario','cedula','telefono','piso','oficina',
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

function crearSolicitud(datos){
  const solicitudes = leerSolicitudes();
  const anio = anioCaracas();
  const fila = {
    id: crypto.randomUUID(),
    numero: siguienteNumero(solicitudes, anio),
    anio,
    estado: 'recibida',
    tecnico: null, observaciones: null, renglones: [], atendida_en: null,
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

  /* ---- solicitudes ---- */
  if(url.pathname === '/rest/v1/solicitudes'){
    /* Dejar una solicitud: sin cuenta, como en la calle. */
    if(req.method === 'POST'){
      const fila = crearSolicitud(await cuerpoDe(req));
      console.log('  + solicitud', String(fila.numero).padStart(3,'0') + '-' + fila.anio,
                  '·', fila.usuario, '·', fila.gerencia);
      return responder(res, 201, [fila]);
    }
    /* Verlas y atenderlas: solo GTIC. */
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
  '.ico':'image/x-icon', '.md':'text/markdown; charset=utf-8',
};

function servirArchivo(res, pedido){
  /* path.normalize aplana los ".." antes de comprobar: sin esto, una petición
     a /../../algo se saldría de la carpeta del sitio. */
  const limpio = path.normalize(decodeURIComponent(pedido)).replace(/^([/\\])+/, '');
  const destino = path.join(RAIZ, limpio || 'index.html');

  if(!destino.startsWith(RAIZ)) return responder(res, 403, 'Fuera de sitio', 'text/plain');
  /* datos/ guarda las solicitudes y las huellas de las claves: no se sirve */
  if(destino.startsWith(DATOS)) return responder(res, 403, 'Prohibido', 'text/plain');

  fs.stat(destino, (err, st) => {
    if(err || !st.isFile()) return responder(res, 404, 'No está aquí', 'text/plain');
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(destino).pipe(res);
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
    responder(res, e.codigo || 500, {message: e.message});
  }
});

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
  console.log('   Deja esta ventana abierta. Para apagarlo: Ctrl+C');
  console.log('');
});
