/* ---------- La bandeja de GGTIC ----------
   Ver lo que pidió la casa, atenderlo, dejar la constancia e imprimir la Hoja
   de Servicio para firmar y sellar.

   El acceso va contra Supabase Auth con correo y contraseña: quien manda una
   solicitud no necesita cuenta, pero para LEER las de los demás hay que estar
   identificado. Eso lo decide el servidor (sql/esquema.sql), no esta página:
   sin sesión, el servidor sencillamente no devuelve filas.
   Prefijo: ban. */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const B = window.SOPORTE_BACKEND;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const ESTADOS = [
    ['pendientes', 'Pendientes'],
    ['recibida',   'Recibidas'],
    ['en_proceso', 'En proceso'],
    ['atendida',   'Atendidas'],
    ['todas',      'Todas'],
  ];
  const ESTADO_ETIQUETA = {
    recibida:'Recibida', en_proceso:'En proceso', atendida:'Atendida', anulada:'Anulada',
  };

  let solicitudes = [];
  let filtro = 'pendientes';
  let busqueda = '';
  let abierta = null;   /* la solicitud que está en la ficha */

  /* Sin servidor configurado, la bandeja trabaja contra el almacén del propio
     navegador (js/local.js), el mismo donde escribe el formulario. Sirve para
     recorrer el circuito completo antes de montar Supabase. No hay clave que
     pedir, porque no hay nada de nadie más que proteger. */
  const enPrueba = !soporteHayBackend();

  /* El correo de recuperación lo manda Supabase Auth; el servidor de la
     oficina no sabe mandar correos, así que ahí este atajo no tiene
     destino y se esconde en vez de prometer algo que no puede cumplir. */
  if(B.servidor !== 'supabase' && $('botonOlvido')) $('botonOlvido').hidden = true;

  /* ---------- volver del correo de recuperación ----------
     Supabase manda el enlace con el testigo en el propio hash de la URL
     (#access_token=...&type=recovery&...), nunca en la ruta ni en la
     query: así no queda registrado en ningún historial de accesos. Se lee
     una sola vez, al cargar la página, y se borra del hash enseguida —
     dejarlo ahí sobrevive a un refresco y bastaría para poner la clave
     dos veces con el mismo enlace ya usado. */
  let testigoRecuperacion = null;
  /* Un enlace vencido, o ya usado una vez, no manda un testigo: manda esto.
     Pasa de verdad y seguido —el correo de la casa suele tener un filtro
     de seguridad que "visita" los enlaces solos para revisarlos antes de
     que la persona los pinche, y eso ya los gasta—. Sin este aviso la
     bandeja se quedaba calladita con el error crudo en la URL. */
  let enlaceRecuperacionVencido = false;
  (function(){
    const testigo = location.hash.match(/access_token=([^&]+)/);
    const tipo = location.hash.match(/type=([^&]+)/);
    if(testigo && tipo && tipo[1] === 'recovery'){
      testigoRecuperacion = decodeURIComponent(testigo[1]);
      history.replaceState(null, '', location.pathname + location.search);
    }else if(/error=/.test(location.hash)){
      enlaceRecuperacionVencido = true;
      history.replaceState(null, '', location.pathname + location.search);
    }
  })();

  /* ================= sesión ================= */
  const LLAVE_SESION = 'soporte_sesion';

  function sesion(){
    try{ return JSON.parse(localStorage.getItem(LLAVE_SESION)); }catch(e){ return null; }
  }
  function guardarSesion(s){ localStorage.setItem(LLAVE_SESION, JSON.stringify(s)); }
  function borrarSesion(){ localStorage.removeItem(LLAVE_SESION); }

  function desdeRespuesta(datos){
    const u = datos.user || {};
    /* Supabase no manda estos cuatro sueltos en el usuario: los guarda en
       user_metadata, que es también de donde los lee la Edge Function de las
       cuentas. Pedirlos sueltos devolvía undefined, así que la bandeja daba
       por hecho que la cuenta no tenía nombre ni cargo. */
    const d = u.user_metadata || {};
    return {
      token: datos.access_token,
      refresco: datos.refresh_token,
      /* un minuto de margen: más vale refrescar de sobra que fallar justo al vencer */
      expira: Date.now() + ((datos.expires_in || 3600) - 60) * 1000,
      correo: u.email || '',
      /* quién es, para no volver a escribirlo en cada solicitud que atienda */
      nombre: d.nombre || '',
      cargo: d.cargo || '',
      cedula: d.cedula || '',
      telefono: d.telefono || '',
    };
  }

  /* El técnico que atiende, tomado de la sesión. Contra Supabase estos datos
     viven en el user_metadata de la cuenta —lo desarma desdeRespuesta—; si
     salen en blanco es que nadie los ha llenado todavía en «Mis datos», y
     entonces se cae al correo y el resto queda para escribir a mano. */
  function yoTecnico(){
    const s = sesion() || {};
    return {
      nombre: s.nombre || s.correo || '',
      cargo: s.cargo || '',
      cedula: s.cedula || '',
      telefono: s.telefono || '',
    };
  }

  /* ---------- lo que Supabase contesta, en español y sin tecnicismos ----------
     Mismo criterio que en js/cuenta.js: GoTrue manda sus errores en inglés,
     tal cual, y aquí los ve el personal de GGTIC, no solo quien pide
     soporte —igual merece un mensaje en español, no un texto de proveedor—.
     Lo que no se reconoce no sale crudo: se cae a un genérico, pero en
     español siempre. */
  function traducirErrorAuth(mensaje){
    const m = String(mensaje || '');
    const reglas = [
      [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
      [/email not confirmed/i, 'Todavía falta confirmar este correo.'],
      [/password should be at least/i, 'La contraseña necesita al menos 6 caracteres.'],
      [/unable to validate email address/i, 'Ese correo no tiene un formato válido.'],
      [/email rate limit exceeded/i, 'Se mandaron muchos correos en poco tiempo. Espera unos minutos y vuelve a intentar.'],
      [/error sending (confirmation|recovery) email/i, 'No se pudo enviar el correo. Intenta de nuevo en un momento.'],
      [/same.password/i, 'La contraseña nueva no puede ser igual a la anterior.'],
      [/for security purposes.*after (\d+) ?seconds?/i, c => 'Espera ' + c[1] + ' segundos antes de volver a pedirlo.'],
    ];
    for(const [patron, salida] of reglas){
      const c = m.match(patron);
      if(c) return typeof salida === 'function' ? salida(c) : salida;
    }
    return '';
  }

  async function entrar(correo, clave){
    const r = await fetch(B.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
      body: JSON.stringify({email: correo, password: clave}),
    });
    if(!r.ok){
      const cuerpo = await r.json().catch(() => ({}));
      const original = cuerpo.error_description || cuerpo.msg || ('HTTP ' + r.status);
      throw new Error(traducirErrorAuth(original) || 'No se pudo entrar. Intenta de nuevo en un momento.');
    }
    const s = desdeRespuesta(await r.json());
    guardarSesion(s);
    /* Se comprueba aquí, pegado al guardado: si esta cuenta no es de GGTIC,
       la sesión que acabamos de guardar no debe durar ni un instante. */
    if(!(await esDeSoporte())){
      borrarSesion();
      const e = new Error('Esta cuenta no es de GGTIC.');
      e.noEsDeSoporte = true;
      throw e;
    }
    soyAdmin = await esAdministrador();
    return s;
  }

  /* Renovar el testigo con el de refresco.
     NO se llama `refrescar` a propósito. Más abajo hay otra función con ese
     nombre —la que recarga la lista— y como las declaraciones se izan, la de
     abajo pisaba a esta en TODO el archivo. Así que pedir() creía estar
     renovando la sesión y lo que hacía era recargar la bandeja: el testigo
     vencido no se renovaba nunca, y la primera petición que caducaba echaba
     al técnico a la pantalla de acceso. Dos funciones distintas, dos nombres
     distintos. */
  async function renovarSesion(){
    const s = sesion();
    if(!s || !s.refresco) return null;
    const r = await fetch(B.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
      body: JSON.stringify({refresh_token: s.refresco}),
    });
    if(!r.ok){ borrarSesion(); return null; }
    const nueva = desdeRespuesta(await r.json());
    guardarSesion(nueva);
    return nueva;
  }

  /* Llamada al servidor con la sesión puesta. Si el token venció o el servidor
     lo rechaza, refresca una vez y reintenta; si tampoco, manda a la pantalla
     de acceso en vez de dejar la bandeja en blanco sin explicación. */
  async function pedir(ruta, opts, reintento){
    let s = sesion();
    if(s && s.expira && Date.now() > s.expira) s = (await renovarSesion()) || s;
    if(!s){ mostrarAcceso(); throw new Error('Sin sesión'); }

    opts = opts || {};
    /* Accept-Profile y Content-Profile son de PostgREST: le dicen en qué
       esquema mirar, y sin ellas contesta sobre 'public' en vez de 'gtic'.
       Fuera de /rest/v1 no significan nada, y en las Edge Functions estorban
       de verdad: su preflight no las autoriza —la lista de cabeceras
       permitidas la pone la plataforma y no las incluye—, así que el
       navegador bloquea la petición entera antes de mandarla. Se veía como
       'Failed to fetch' al crear una cuenta, que parece un problema de red
       y no lo es. */
    const cabeceras = Object.assign({'Authorization': 'Bearer ' + s.token},
                                    soporteCabeceras(), opts.headers || {});
    if(!ruta.startsWith('/rest/v1/')){
      delete cabeceras['Accept-Profile'];
      delete cabeceras['Content-Profile'];
    }
    /* Y a las Edge Functions, la llave nueva. La anon de siempre vale para
       REST y Auth, pero esa pasarela la rechaza con 401 INVALID_CREDENTIALS
       —ver el comentario en js/config.js—. El testigo de la persona sigue
       yendo en Authorization: la llave dice de qué proyecto es la petición,
       el testigo dice quién la hace, y la función necesita las dos. */
    if(ruta.startsWith('/functions/v1/') && B.llaveFunciones){
      cabeceras['apikey'] = B.llaveFunciones;
    }

    const r = await fetch(B.url + ruta, Object.assign({}, opts, {headers: cabeceras}));

    if((r.status === 401 || r.status === 403) && !reintento){
      if(await renovarSesion()) return pedir(ruta, opts, true);
      borrarSesion(); mostrarAcceso();
      throw new Error('La sesión venció');
    }
    if(!r.ok){
      const cuerpo = await r.text().catch(() => '');
      throw new Error('HTTP ' + r.status + (cuerpo ? ' · ' + cuerpo.slice(0, 300) : ''));
    }
    return r;
  }

  /* ---------- quién puede estar aquí ----------
     La bandeja es de quien atiende, no de cualquiera que tenga cuenta. Y ser
     de GGTIC no es una marca en el perfil —esa la cambia la propia persona con
     una llamada a /auth/v1/user, y se ascendería sola en un minuto—: es estar
     en gtic.personal, una tabla que solo escribe el administrador. Por eso la
     pregunta va al servidor, que es el único que puede responderla sin que le
     mientan. Ver la migración 03.

     Esto no añade seguridad: las políticas de la base ya impedían que quien
     pide soporte viera la cola o las guías. Añade claridad. Hasta ahora esa
     persona entraba, se encontraba una bandeja vacía y unos botones de
     atender que le iban a fallar. Ahora se le dice en la puerta, y se le
     manda a la suya.

     En modo oficina no aplica: servidor.js no sabe de gtic.personal, y allí
     quien llega a la bandeja es de GGTIC por definición. */
  async function esDeSoporte(){
    if(enPrueba || B.servidor !== 'supabase') return true;
    const r = await pedir('/rest/v1/rpc/es_gtic', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}',
    });
    return (await r.json()) === true;
  }

  /* Administrador es un papel dentro de GGTIC, no un tipo de cuenta aparte
     (migración 08): gestiona accesos —Cuentas, Correos permitidos—; el
     resto es igual para cualquiera. Se guarda en una variable del módulo
     porque se pregunta una vez al entrar y de ahí se lee en todos lados
     —esconder los dos enlaces, no cargar sus paneles de balde—, no en cada
     clic. */
  let soyAdmin = false;

  async function esAdministrador(){
    if(enPrueba || B.servidor !== 'supabase') return true;
    const r = await pedir('/rest/v1/rpc/es_admin', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}',
    });
    return (await r.json()) === true;
  }

  /* Mostrar u ocultar lo que es solo de administrador. Se llama cada vez que
     se sabe soyAdmin —al entrar, y al llegar con sesión guardada—, para que
     alguien que dejó de serlo no siga viendo los enlaces tras recargar. */
  function pintarAdmin(){
    const cuentas = $('botonCuentas'), correos = $('botonCorreos'), traza = $('botonTrazabilidad');
    if(cuentas) cuentas.hidden = !soyAdmin;
    if(correos) correos.hidden = !soyAdmin;
    if(traza) traza.hidden = !soyAdmin;
  }

  /* El mismo aviso en los dos sitios donde se puede rebotar a alguien: al
     entrar, y al llegar con una sesión ya guardada. */
  function avisarQueNoEsDeSoporte(){
    const aviso = $('avisoAcceso');
    aviso.innerHTML = '<span>⚠</span><div>Esta bandeja es de GGTIC, y esta cuenta '
      + 'no lo es. Para pedir soporte, entra por <a href="index.html">la '
      + 'puerta</a>.</div>';
    aviso.hidden = false;
  }

  /* ================= pantallas ================= */
  function mostrarAcceso(){
    /* Cerrar antes lo que hubiera abierto. Los paneles —Cuentas,
       Estadísticas, la base del conocimiento— son hermanos de la bandeja y
       no hijos suyos: esconder pantallaBandeja no los toca. Salir con el de
       Cuentas delante dejaba a la vista los nombres, correos y papeles de
       toda la casa, con la sesión ya cerrada y la pantalla de acceso debajo.

       Va primero porque verPanel(null) vuelve a enseñar la bandeja, y lo de
       abajo tiene que ser lo último en hablar. */
    verPanel(null);

    /* Y las ventanas de encima. Son siete —la ficha, el chat, Mis datos, la
       guía, el equipo, la cuenta, el correo— y ninguna se entera de que la
       sesión se cerró. La de la ficha es la que más importa: lleva dentro la
       solicitud entera y la conversación con quien la pidió.

       Se cierran por la clase y no una a una, para que añadir una octava no
       vuelva a abrir el agujero sin que nadie se acuerde de esta línea. */
    document.querySelectorAll('.velo').forEach(v => { v.hidden = true; });
    /* Al abrir una ventana se le quita el scroll a la página de detrás; si
       se cierra por aquí, nadie se lo devuelve. */
    document.body.style.overflow = '';
    $('pantallaAcceso').hidden = false;
    $('pantallaBandeja').hidden = true;
    /* Sin sesión no hay menú: la barra se va y el cuerpo recupera su ancho. */
    $('cabDerecha').hidden = true;
    $('botonMenu').hidden = true;
    $('latVelo').hidden = true;
    document.body.classList.remove('con-lat', 'lat-abierta');
    /* el cursor donde va a escribir, sin tener que buscarlo con el ratón */
    requestAnimationFrame(() => {
      const c = $('correo');
      if(c && !c.value) c.focus(); else $('clave').focus();
    });
  }

  /* Ver la contraseña: la mitad de los "no me deja entrar" son una tecla mal
     dada, y sin poder mirar lo escrito no hay forma de darse cuenta. */
  $('verClave').addEventListener('click', () => {
    const campo = $('clave'), boton = $('verClave');
    const viendo = campo.type === 'text';
    campo.type = viendo ? 'password' : 'text';
    boton.setAttribute('aria-pressed', String(!viendo));
    boton.title = viendo ? 'Mostrar la contraseña' : 'Ocultar la contraseña';
    boton.setAttribute('aria-label', boton.title);
    campo.focus();
  });
  function mostrarBandeja(){
    $('pantallaAcceso').hidden = true;
    $('pantallaBandeja').hidden = false;
    $('cabDerecha').hidden = false;
    $('botonMenu').hidden = false;
    document.body.classList.add('con-lat');
    pintarMenu();
    /* volver a la cola cierra lo que hubiera delante: nunca dos a la vez */
    verPanel(null);
  }

  /* ================= enterarse en el momento =================
     El servidor avisa cuando entra una solicitud o cambia una: así la cola se
     actualiza sola mientras el técnico la tiene abierta, sin recargar.
     El aviso no dice qué cambió, solo que algo cambió, y la bandeja vuelve a
     pedir la lista con su sesión.

     La cola se actualiza aunque haya una ficha abierta: lo que se escribe en
     ella es una copia aparte —no sale de la lista—, así que repintar la cola
     de atrás no le borra nada a nadie. Lo que sí se espera al cierre es mover
     la pantalla: eso está en avisarDe(). */
  let linea = null;

  function escuchar(){
    if(linea || enPrueba || typeof EventSource === 'undefined') return;
    if(B.servidor !== 'local') return;
    try{
      linea = new EventSource(B.url + '/rest/v1/eventos');
      linea.onmessage = () => {
        cargar()
          .then(() => { if(!$('veloChat').hidden) pintarChat(); })
          .catch(e => console.warn('No se pudo actualizar sola:', e));
      };
      linea.onerror = () => {};
    }catch(e){ linea = null; }
  }

  /* La línea de avisos es del servidor de casa. Contra Supabase no existe
     —los avisos en vivo allá hablan por otro camino— y sin nada que la
     reemplace la cola se quedaba quieta: al técnico le entraba una solicitud
     y no se enteraba hasta pulsar "Actualizar".

     Así que se pregunta cada tanto, igual que hace la planilla. Con la línea
     abierta se pregunta cada minuto, que es solo una red por si un aviso se
     perdiera; sin ella es lo único que hay, y entonces se pregunta más
     seguido. Con la pestaña de atrás no se pregunta: nadie está mirando. */
  const CADA_ESCUCHANDO = 60000;
  const CADA_SIN_LINEA  = 15000;
  let reloj = null;

  function refrescar(){
    return cargar()
      .then(() => { if(!$('veloChat').hidden) pintarChat(); })
      .catch(e => console.warn('No se pudo actualizar sola:', e));
  }

  function vigilar(){
    clearInterval(reloj);
    if(enPrueba) return;
    escuchar();
    reloj = setInterval(() => { if(!document.hidden) refrescar(); },
                        linea ? CADA_ESCUCHANDO : CADA_SIN_LINEA);
  }

  function dejarDeVigilar(){
    clearInterval(reloj);
    reloj = null;
    if(linea){ linea.close(); linea = null; }
  }

  /* Volver a la pestaña es el momento en que a uno le interesa lo que pasó
     mientras no miraba: no hay por qué esperar al siguiente turno del reloj. */
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && reloj) refrescar();
  });

  /* ================= el aviso de que llegó algo =================
     El servidor avisa al instante, pero de nada sirve si el técnico está
     mirando otra ventana o tiene la cola filtrada por "Atendidas". Así que al
     entrar una solicitud nueva:

       · suena un aviso corto y sale un cartel en la esquina,
       · el título de la pestaña lleva la cuenta —(2) Bandeja…— para que se vea
         en la barra de tareas sin tener la página delante,
       · Windows la anuncia con su propia notificación, si el navegador deja, y
       · la cola se coloca sola en la recién llegada: cierra las estadísticas,
         suelta el filtro y la búsqueda si la estaban escondiendo, la trae a la
         vista y la deja marcada un rato.

     Lo único que no hace es abrir la ficha: eso es del técnico, y una ventana
     que se abre sola encima de lo que uno estaba escribiendo es un estorbo, no
     un aviso. */
  const TITULO = document.title;

  let conocidas = null;    /* null = todavía no se ha cargado nada */
  let sinLeer = 0;         /* llegadas mientras la pestaña no se mira */
  const recien = new Set();/* las que están marcadas en la cola */

  /* El aviso en el escritorio de Windows, si el navegador lo da: solo existe en
     "contexto seguro" —localhost o https— y solo si esa máquina le dio permiso.
     No se pide ni se explica: quien lo tenga lo tiene, y quien no, tiene el
     vigía (vigia.cmd), que trae la bandeja al frente sin depender de nada de
     esto, y la ventana del aviso, que sale igual. */
  const hayNotificaciones = () => typeof Notification !== 'undefined' && window.isSecureContext;

  /* Cuáles de estas no estaban antes. La primera carga solo toma nota: si no,
     al entrar saltarían de golpe todas las solicitudes del año. */
  function llegadas(lista){
    const ids = new Set(lista.map(s => s.id));
    if(conocidas === null){ conocidas = ids; return []; }
    const nuevas = lista.filter(s => !conocidas.has(s.id) && s.estado === 'recibida');
    conocidas = ids;
    return nuevas;
  }

  /* Dos notas cortas, hechas por el navegador: no hay archivo de sonido que
     cargar ni que se pueda perder. El navegador no deja sonar hasta que la
     persona haya tocado la página, y para cuando llega la primera solicitud ya
     hizo clic en Entrar. */
  let sonido = null;
  function sonar(){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      sonido = sonido || new AC();
      if(sonido.state === 'suspended') sonido.resume();
      const t = sonido.currentTime;
      [[784, 0], [1046.5, 0.13]].forEach(([hz, d]) => {
        const o = sonido.createOscillator(), g = sonido.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        o.connect(g).connect(sonido.destination);
        o.start(t + d); o.stop(t + d + 0.14);
      });
    }catch(e){ /* sin sonido se sigue viendo el cartel */ }
  }

  function marcarTitulo(){
    document.title = sinLeer ? '(' + sinLeer + ') ' + TITULO : TITULO;
  }
  function leido(){ if(sinLeer){ sinLeer = 0; marcarTitulo(); } }
  window.addEventListener('focus', leido);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) leido(); });

  function notificar(s){
    if(!hayNotificaciones() || Notification.permission !== 'granted') return;
    try{
      const n = new Notification('Llegó una solicitud · N° ' + String(s.numero).padStart(3,'0'), {
        body: s.usuario + '\n' + (s.descripcion || ''),
        icon: 'assets/logo_ciip.png',
        tag: 'solicitud-' + s.id,   /* si llega dos veces el mismo aviso, no se duplica */
      });
      n.onclick = () => { window.focus(); leido(); irA(s.id); n.close(); };
    }catch(e){}
  }

  /* ---------- la ventana del aviso ----------
     Delante de todo y con la solicitud entera dentro: quién es, dónde está,
     su teléfono y qué le pasa. Con eso el técnico decide sin abrir nada más, y
     puede tomarla desde aquí mismo.

     Si mientras está abierta entra otra, no se apila otra ventana encima: se
     repinta esta con la última y avisa de cuántas van. */
  let nuevasEnCola = [];

  function abrirNueva(nuevas){
    /* la más reciente primero, y sin repetir si el aviso llega dos veces */
    nuevas.forEach(s => { if(!nuevasEnCola.some(x => x.id === s.id)) nuevasEnCola.unshift(s); });
    if(!nuevasEnCola.length) return;
    pintarNueva();
    $('veloNueva').hidden = false;
    document.body.style.overflow = 'hidden';
    /* el foco en el botón principal: así Enter y Escape hacen lo obvio y quien
       usa el teclado no queda perdido detrás de la ventana */
    requestAnimationFrame(() => { const b = $('nuevaTomar'); if(b) b.focus(); });
  }

  function pintarNueva(){
    const s = nuevasEnCola[0];
    if(!s) return;
    const otras = nuevasEnCola.length - 1;
    const donde = [s.gerencia, s.piso ? 'Piso ' + s.piso : '', s.oficina ? 'of. ' + s.oficina : '']
      .filter(Boolean).join(' · ');
    const clasificacion = [s.tipo, s.detalle].filter(Boolean).join(' · ');

    $('hojaNueva').innerHTML = `
      <div class="nueva-cinta">
        <span class="punto"></span>Llegó una solicitud
        ${otras ? `<span class="nueva-mas">y ${otras} más sin ver</span>` : ''}
      </div>
      <div class="nueva-num">N° ${String(s.numero).padStart(3,'0')}-${esc(String(s.anio))}
        <small>${esc(hora(s.creada_en))}</small></div>
      <div class="nueva-quien">${esc(s.usuario)}</div>
      <div class="nueva-donde">${esc(donde)}</div>
      ${s.telefono ? `<div class="nueva-tel">Teléfono: <b>${esc(s.telefono)}</b></div>` : ''}
      ${clasificacion ? `<div class="nueva-clase">${esc(clasificacion)}</div>` : ''}
      <div class="nueva-que">${esc(s.descripcion)}</div>
      <div class="botones">
        <button type="button" class="boton primario" id="nuevaTomar">Atenderla ahora</button>
        <button type="button" class="boton plano" id="nuevaVer">Ver la ficha</button>
        <button type="button" class="boton plano" id="nuevaDespues">Después</button>
      </div>`;
  }

  /* Cerrar la del frente. Si detrás quedan más, se pasa a la siguiente en vez
     de irse: si no, las de en medio se perderían de vista. */
  function cerrarNueva(todas){
    if(todas) nuevasEnCola = [];
    else nuevasEnCola.shift();
    if(nuevasEnCola.length){ pintarNueva(); return; }
    $('veloNueva').hidden = true;
    /* el desplazamiento del fondo solo se devuelve si no queda otra ventana */
    if($('velo').hidden && $('veloChat').hidden && $('veloPerfil').hidden){
      document.body.style.overflow = '';
    }
  }

  /* Colocar la pantalla en una solicitud: lo que haga falta para que se vea. */
  function irA(id){
    if(abierto('panelStats') || abierto('panelSaber') || abierto('panelCuentas') || abierto('panelCorreos') || abierto('panelTrazabilidad')) verPanel(null);
    if(!solicitudes.some(s => s.id === id)) return;
    /* si el filtro o la búsqueda la esconden, se sueltan: más vale perder el
       filtro que perder la solicitud */
    if(!visibles().some(s => s.id === id)){
      busqueda = ''; $('buscar').value = '';
      filtro = 'pendientes';
      pintar();
    }
    const fila = $('lista').querySelector('.fila[data-id="' + id + '"]');
    if(fila) fila.scrollIntoView({block: 'center', behavior: 'smooth'});
  }

  function avisarDe(nuevas){
    if(document.hidden){ sinLeer += nuevas.length; marcarTitulo(); }
    sonar();
    nuevas.slice().reverse().forEach(notificar);

    /* La cola de atrás se coloca primero —para que al cerrar la ventana la
       solicitud esté a la vista y no haya que buscarla— y encima va el aviso. */
    irA(nuevas[0].id);
    abrirNueva(nuevas);

    /* la marca dura lo que dura la sorpresa */
    setTimeout(() => {
      nuevas.forEach(s => recien.delete(s.id));
      if(!$('pantallaBandeja').hidden) pintar();
    }, 30000);
  }

  /* ================= traer y pintar ================= */
  async function cargar(){
    if(enPrueba){
      solicitudes = soporteLocal.leer();
    }else{
      const r = await pedir('/rest/v1/solicitudes?select=*&order=creada_en.desc', {});
      solicitudes = await r.json();
    }
    const nuevas = llegadas(solicitudes);
    nuevas.forEach(s => recien.add(s.id));
    pintar();
    if(nuevas.length) avisarDe(nuevas);
  }

  function visibles(){
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter(s => {
      if(filtro === 'pendientes' && !['recibida','en_proceso'].includes(s.estado)) return false;
      if(!['pendientes','todas'].includes(filtro) && s.estado !== filtro) return false;
      if(!q) return true;
      return [s.numero, s.usuario, s.gerencia, s.oficina, s.descripcion, s.tecnico]
        .some(v => String(v == null ? '' : v).toLowerCase().includes(q));
    });
  }

  function cuenta(clave){
    if(clave === 'todas') return solicitudes.length;
    if(clave === 'pendientes') return solicitudes.filter(s => ['recibida','en_proceso'].includes(s.estado)).length;
    return solicitudes.filter(s => s.estado === clave).length;
  }

  const numeroDe = s => 'GGTIC-HS/' + String(s.numero).padStart(3, '0') + '-' + s.anio;

  function fechaCorta(iso){
    if(!iso) return '';
    return new Date(iso).toLocaleDateString('es-VE', {day:'2-digit', month:'short', year:'numeric'});
  }

  function pintar(){
    /* La cuenta de la barra son las pendientes, no el total: lo que importa de
       una cola es lo que queda por atender. Vacía cuando no hay ninguna, que
       para eso .cnt:empty se esconde — un 0 permanente es ruido. */
    const pend = cuenta('pendientes');
    $('latCuentaCola').textContent = pend ? String(pend) : '';

    $('fichas').innerHTML = ESTADOS.map(([k, l]) => {
      const n = cuenta(k);
      return `<button type="button" class="ficha ${filtro===k?'on':''}" data-filtro="${k}">${l}${n?`<span class="n">${n}</span>`:''}</button>`;
    }).join('');

    const filas = visibles();
    $('lista').innerHTML = filas.length ? `<div class="lista">${filas.map(filaHtml).join('')}</div>`
      : `<div class="vacio">${solicitudes.length
          ? 'Ninguna solicitud coincide con lo que buscas.'
          : 'Todavía no ha entrado ninguna solicitud.'}</div>`;
    /* si las estadísticas están delante, se rehacen con lo recién llegado */
    if($('panelStats') && !$('panelStats').hidden) pintarStats();
  }

  /* Cuánto lleva esperando, en palabras. Se cuenta por días de calendario, no
     por horas cumplidas: lo que entró anoche a las once es "ayer" a las ocho de
     la mañana, aunque no hayan pasado veinticuatro horas. Así lo cuenta quien
     lo espera. */
  function edadHtml(s){
    if(s.estado === 'atendida' || s.estado === 'anulada'){
      return `<span class="edad fin">${esc(fechaCorta(s.creada_en))}</span>`;
    }
    const dia = x => { const d = new Date(x); d.setHours(0,0,0,0); return d.getTime(); };
    const dias = Math.round((dia(Date.now()) - dia(s.creada_en)) / 86400000);
    const txt = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
    const clase = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : 'viejo';
    return `<span class="edad ${clase}">${esc(txt)}</span>`;
  }

  /* Lo que se hace veinte veces al día, en la propia fila: tomarla o cerrarla.
     Abrir la ficha sigue estando para lo demás —renglones, observaciones,
     imprimir— pero deja de ser obligatorio para lo de siempre. */
  function accionesHtml(s){
    if(s.estado === 'recibida'){
      return `<div class="acc"><button type="button" data-accion="en_proceso"
        data-id="${esc(s.id)}" title="Marcarla como tuya y ponerla en proceso">Tomar</button></div>`;
    }
    if(s.estado === 'en_proceso'){
      return `<div class="acc"><button type="button" class="cerrar-r" data-accion="atendida"
        data-id="${esc(s.id)}" title="Darla por resuelta">Cerrar</button></div>`;
    }
    return '';
  }

  function filaHtml(s){
    return `<div class="fila${recien.has(s.id) ? ' recien' : ''}" data-id="${esc(s.id)}">
      <div class="num">${String(s.numero).padStart(3,'0')}<small>${esc(String(s.anio))}</small></div>
      <div>
        <div class="quien">${esc(s.usuario)}</div>
        <div class="donde">${esc(s.gerencia)} · Piso ${esc(s.piso)}, of. ${esc(s.oficina)}</div>
        <div class="que">${esc(s.descripcion)}</div>
      </div>
      <div class="der">
        ${edadHtml(s)}
        <span class="etiqueta ${esc(s.estado)}">${esc(ESTADO_ETIQUETA[s.estado] || s.estado)}</span>
        ${hojaBotonHtml(s)}
        ${chatBotonHtml(s)}
        ${accionesHtml(s)}
      </div>
    </div>`;
  }

  /* ================= estadísticas =================
     Se calculan con lo que ya está cargado; no piden nada al servidor. Todo
     mide lo mismo —cuántas veces— así que son listas ordenadas con una barra,
     no gráficos de colores: lo que distingue una fila de otra es su rótulo. */

  /* Cuenta cuántas veces aparece cada valor y devuelve el top, ya ordenado.
     Lo que no llegue al corte se suma en "Otras", que es más honesto que
     esconderlo: si no, los porcentajes no cuadran con el total. */
  function contar(lista, deQuien, cuantas){
    const c = new Map();
    lista.forEach(s => {
      const v = deQuien(s);
      if(!v) return;
      c.set(v, (c.get(v) || 0) + 1);
    });
    const orden = [...c].sort((a, b) => b[1] - a[1]);
    if(orden.length <= cuantas) return orden;
    const cabeza = orden.slice(0, cuantas);
    const cola = orden.slice(cuantas).reduce((s, x) => s + x[1], 0);
    return cola ? [...cabeza, ['Otras', cola]] : cabeza;
  }

  /* ---------- de la mayúscula sostenida a algo que se lea ----------
     Los detalles y las gerencias vienen del Excel en mayúscula sostenida, que
     es como se escribía cuando se llenaban a máquina. En la Hoja de Servicio se
     respeta —es el documento de siempre y así lo reconoce quien lo firma— pero
     en una pantalla de estadísticas eso es un muro que grita: seis renglones en
     mayúscula cuestan de leer y no dicen nada más.

     Las siglas se quedan como están: "Operatividad de CPU", no "Cpu". */
  const SIGLAS = new Set(['CPU','PC','PCS','RAM','IP','GGTIC','CIIP','TIC','UPS','USB',
                          'HDMI','VGA','SO','TV','LED','LCD','HP','LG','CD','DVD','S/N']);

  /* El mismo texto que hoy está bien escrito en el catálogo: así una solicitud
     vieja —guardada cuando los detalles no llevaban tilde— se enseña con las
     tildes puestas, sin tocar lo que quedó registrado. */
  const COMO_SE_ESCRIBE = new Map();
  const desnudo = s => String(s || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  if(typeof CAT_SERVICIOS !== 'undefined'){
    CAT_SERVICIOS.forEach(s => s.detalles.forEach(d => COMO_SE_ESCRIBE.set(desnudo(d), d)));
  }

  function enBonito(texto){
    let t = String(texto == null ? '' : texto).trim();
    if(!t) return t;
    t = COMO_SE_ESCRIBE.get(desnudo(t)) || t;
    /* si ya viene escrito como se debe —el nombre de un técnico, por ejemplo—
       no se toca: solo se arregla lo que está todo en mayúsculas */
    if(/[a-záéíóúñü]/.test(t)) return t;
    const palabras = t.toLowerCase().split(/(\s+|\/)/);
    let primera = true;
    return palabras.map(p => {
      if(!p.trim() || p === '/') return p;
      const arriba = p.toUpperCase().replace(/[(),.:]/g, '');
      if(SIGLAS.has(arriba)) return p.toUpperCase();
      if(primera){ primera = false; return p.charAt(0).toUpperCase() + p.slice(1); }
      return p;
    }).join('')
      /* Marca País es un nombre propio, no dos palabras cualesquiera */
      .replace(/marca pa[íi]s/gi, 'Marca País');
  }

  function barrasHtml(titulo, sub, filas){
    if(!filas.length){
      return `<div class="barrio"><h2>${esc(titulo)}</h2><div class="s">${esc(sub)}</div>
        <div class="vacio-b">Todavía no hay datos.</div></div>`;
    }
    /* Las barras se miden contra el mayor, no contra el total: así la
       diferencia entre el primero y el segundo se ve, que es lo que se lee. */
    const mayor = filas[0][1];
    return `<div class="barrio"><h2>${esc(titulo)}</h2><div class="s">${esc(sub)}</div>
      ${filas.map(([et, n]) => `<div class="bfila" title="${esc(et)}: ${n}">
        <div class="et">${esc(et)}</div><div class="n">${n}</div>
        <div class="riel"><i style="width:${Math.round(n / mayor * 100)}%"></i></div>
      </div>`).join('')}</div>`;
  }

  /* Cuánto se tarda de recibida a atendida, en promedio. Solo cuenta las que
     tienen las dos fechas: sin eso el promedio sería inventado. */
  function tiempoMedio(lista){
    const cerradas = lista.filter(s => s.estado === 'atendida' && s.atendida_en && s.creada_en);
    if(!cerradas.length) return null;
    const horas = cerradas.reduce((suma, s) =>
      suma + (new Date(s.atendida_en) - new Date(s.creada_en)) / 3600000, 0) / cerradas.length;
    return {horas, sobre: cerradas.length};
  }

  /* ---------- el tramo de tiempo ----------
     La misma pregunta —cuánto entró y de dónde— cambia de respuesta según se
     mire el día, la semana, el mes o el año, y son cuatro preguntas distintas
     que se hacen en momentos distintos: el día para saber cómo va la jornada,
     el año para el informe. Se elige arriba y todo lo demás se recalcula.

     El corte es por fecha de entrada, no por fecha de cierre: lo que se está
     contando es lo que la casa pidió en ese tramo. */
  const PERIODOS = [
    ['hoy',    'Hoy'],
    ['semana', 'Esta semana'],
    ['mes',    'Este mes'],
    ['anio',   'Este año'],
    ['todo',   'Todo'],
  ];
  let periodo = 'mes';

  function desdeDe(cual){
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if(cual === 'hoy') return d;
    if(cual === 'semana'){
      /* la semana empieza el lunes, no el domingo como cuenta el navegador */
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d;
    }
    if(cual === 'mes')  return new Date(d.getFullYear(), d.getMonth(), 1);
    if(cual === 'anio') return new Date(d.getFullYear(), 0, 1);
    return null;   /* todo */
  }

  /* Las anuladas quedan fuera de todas las cuentas: una solicitud que se
     retiró —porque se resolvió sola o se mandó por error— no fue trabajo de
     nadie, y contarla infla lo que entró y hunde el porcentaje de resueltas.
     Siguen en la cola, en su pestaña, que ahí sí hacen falta. */
  function delPeriodo(){
    const desde = desdeDe(periodo);
    const vivas = solicitudes.filter(s => s.estado !== 'anulada');
    if(!desde) return vivas;
    return vivas.filter(s => s.creada_en && new Date(s.creada_en) >= desde);
  }

  function rotuloPeriodo(){
    const hoy = new Date();
    const dm = {day: 'numeric', month: 'long'};
    if(periodo === 'hoy')    return 'hoy, ' + hoy.toLocaleDateString('es-VE', dm);
    if(periodo === 'semana') return 'esta semana, desde el lunes ' +
                                    desdeDe('semana').toLocaleDateString('es-VE', dm);
    if(periodo === 'mes')    return hoy.toLocaleDateString('es-VE', {month:'long', year:'numeric'});
    if(periodo === 'anio')   return 'el año ' + hoy.getFullYear();
    return 'desde el principio';
  }

  function pintarStats(){
    const lista = delPeriodo();
    const atendidas = lista.filter(s => s.estado === 'atendida');
    /* Lo que está sin resolver es de ahora mismo, no del tramo: una solicitud
       de la semana pasada que sigue abierta sigue siendo trabajo de hoy. */
    const abiertas = solicitudes.filter(s => ['recibida','en_proceso'].includes(s.estado));
    const t = tiempoMedio(lista);

    $('statsPeriodos').innerHTML = PERIODOS.map(([k, l]) => {
      const n = k === periodo ? lista.length : null;
      return `<button type="button" class="ficha ${k===periodo?'on':''}" data-periodo="${k}">${l}` +
             (n ? `<span class="n">${n}</span>` : '') + '</button>';
    }).join('');

    $('statsPeriodo').textContent = 'Lo que entró ' + rotuloPeriodo() + '.';

    const tiempo = !t ? '—'
      : t.horas < 1 ? Math.round(t.horas * 60) + '<small>min</small>'
      : t.horas < 48 ? t.horas.toFixed(1).replace('.', ',') + '<small>h</small>'
      : (t.horas / 24).toFixed(1).replace('.', ',') + '<small>días</small>';

    $('statsKpis').innerHTML = `
      <div class="kpi">
        <div class="r">Entraron</div>
        <div class="v">${lista.length}</div>
        <div class="s">${esc(rotuloPeriodo())}</div>
      </div>
      <div class="kpi">
        <div class="r">Resueltas</div>
        <div class="v">${atendidas.length}</div>
        <div class="s">${lista.length ? Math.round(atendidas.length / lista.length * 100) + '% de las que entraron'
                                      : 'nada que resolver'}</div>
      </div>
      <div class="kpi">
        <div class="r">Tiempo medio</div>
        <div class="v">${tiempo}</div>
        <div class="s">${t ? 'sobre ' + t.sobre + ' resueltas' : 'aún sin resolver ninguna'}</div>
      </div>
      <div class="kpi ${abiertas.length ? 'urge' : ''}">
        <div class="r">Sin resolver ahora</div>
        <div class="v">${abiertas.length}</div>
        <div class="s">${abiertas.filter(s => s.estado === 'en_proceso').length} ya en proceso,
          de todas las fechas</div>
      </div>`;

    $('statsBarras').innerHTML =
      /* Tres listas y en este orden: qué se pide, quién lo pide, quién lo
         resuelve. Estaban además "de qué oficina" y "en qué piso", que decían
         lo mismo dos veces —la oficina ya lleva el piso delante— y con tan
         pocas solicitudes al día no dicen nada que no se sepa. */
      barrasHtml('Lo que más se pide', 'Por detalle de servicio',
        contar(lista, s => enBonito(s.detalle) || (s.tipo ? catTipoEtiqueta(s.tipo) : 'Sin clasificar'), 8)) +
      barrasHtml('De qué gerencia vienen', 'Quién pide más soporte',
        contar(lista, s => enBonito(s.gerencia), 6)) +
      barrasHtml('Quién atiende', 'Solicitudes cerradas por técnico',
        contar(atendidas, s => enBonito(s.tecnico), 6));
  }

  $('statsPeriodos').addEventListener('click', e => {
    const b = e.target.closest('[data-periodo]');
    if(!b) return;
    periodo = b.dataset.periodo;
    pintarStats();
  });

  /* ================= los paneles que sustituyen a la cola =================
     Eran dos y se apagaban el uno al otro a mano. Con tres, esa cuenta cruzada
     se vuelve un enredo en el que es fácil dejar dos abiertos a la vez o la
     cola escondida sin que haya nada delante. Aquí se nombra el que se quiere
     ver —o ninguno, que es volver a la cola— y los demás se cierran solos. */
  const PANELES = [
    {panel: 'panelStats',   boton: 'botonStats',   texto: 'Estadísticas',
     pinta: () => pintarStats()},
    {panel: 'panelSaber',   boton: 'botonSaber',   texto: 'Base del conocimiento',
     pinta: () => pintarGuias()},
    {panel: 'panelCuentas', boton: 'botonCuentas', texto: 'Cuentas',
     pinta: () => pintarCuentas()},
    {panel: 'panelCorreos', boton: 'botonCorreos', texto: 'Correos permitidos',
     pinta: () => pintarCorreos()},
    {panel: 'panelTrazabilidad', boton: 'botonTrazabilidad', texto: 'Trazabilidad',
     pinta: () => cargarTrazabilidad()},
  ];

  function verPanel(cual){
    PANELES.forEach(p => {
      const caja = $(p.panel);
      if(!caja) return;
      const abierto = p.panel === cual;
      caja.hidden = !abierto;
      /* El rótulo ya no cambia de texto. En una fila de botones, renombrar el
         del panel abierto a "Ver la cola" era la única forma de ofrecer la
         vuelta; en una barra lateral el nombre de un destino tiene que
         quedarse quieto —si no, no se puede aprender dónde está nada— y lo
         que se mueve es la marca de dónde estás. La vuelta a la cola tiene
         ahora su propio enlace, el primero de la barra. */
      const boton = $(p.boton);
      if(boton) boton.classList.toggle('activo', abierto);
      if(abierto) p.pinta();
    });
    const cola = $('botonCola');
    if(cola) cola.classList.toggle('activo', !cual);
    $('pantallaBandeja').hidden = !!cual;
    /* En móvil la barra es un cajón que tapa el contenido: elegir destino la
       cierra, o taparía justo lo que acabas de pedir. */
    document.body.classList.remove('lat-abierta');
    $('latVelo').hidden = true;
  }

  const abierto = cual => { const c = $(cual); return c && !c.hidden; };

  const verStats   = si => verPanel(si ? 'panelStats'   : null);
  const verSaber   = si => verPanel(si ? 'panelSaber'   : null);
  const verCuentas = si => verPanel(si ? 'panelCuentas' : null);
  const verCorreos = si => verPanel(si ? 'panelCorreos' : null);

  $('botonStats').addEventListener('click', e => {
    e.preventDefault();
    verPanel(abierto('panelStats') ? null : 'panelStats');
  });
  $('botonSaber').addEventListener('click', e => {
    e.preventDefault();
    verPanel(abierto('panelSaber') ? null : 'panelSaber');
  });
  $('botonCuentas').addEventListener('click', e => {
    e.preventDefault();
    verPanel(abierto('panelCuentas') ? null : 'panelCuentas');
  });
  $('botonCorreos').addEventListener('click', e => {
    e.preventDefault();
    verPanel(abierto('panelCorreos') ? null : 'panelCorreos');
  });
  $('botonTrazabilidad').addEventListener('click', e => {
    e.preventDefault();
    verPanel(abierto('panelTrazabilidad') ? null : 'panelTrazabilidad');
  });
  /* La vuelta a la cola, que antes hacía el enlace renombrado del panel
     abierto y ahora tiene su propio sitio arriba del todo. */
  $('botonCola').addEventListener('click', e => { e.preventDefault(); verPanel(null); });

  /* ---------- plegar las secciones de la barra ----------
     El estado de cada una se recuerda en este navegador: quien no usa
     "Cuenta y accesos" no tiene por qué volver a cerrarla cada mañana. */
  const LAT_SECCIONES = 'soporte_lat_secciones';
  const latEstado = () => {
    try{ return JSON.parse(localStorage.getItem(LAT_SECCIONES)) || {}; }
    catch(e){ return {}; }
  };
  function latAplicar(sec, abierta){
    const h = document.querySelector('.lat-sec[data-sec="' + sec + '"]');
    const c = document.querySelector('.lat-sec-cuerpo[data-sec="' + sec + '"]');
    if(!h || !c) return;
    h.setAttribute('aria-expanded', String(abierta));
    c.setAttribute('data-abierta', abierta ? '1' : '0');
  }
  const guardado = latEstado();
  Object.keys(guardado).forEach(sec => latAplicar(sec, !!guardado[sec]));

  $('menuLateral').addEventListener('click', e => {
    const h = e.target.closest('.lat-sec');
    if(!h) return;
    const sec = h.getAttribute('data-sec');
    const abierta = h.getAttribute('aria-expanded') !== 'true';
    latAplicar(sec, abierta);
    const est = latEstado(); est[sec] = abierta;
    try{ localStorage.setItem(LAT_SECCIONES, JSON.stringify(est)); }catch(e){}
  });

  /* ---------- esconder y sacar la barra entera ---------- */
  const LAT_PLEGADA = 'soporte_lat_plegada';
  const enEstrecho = () => window.matchMedia('(max-width:900px)').matches;
  try{
    if(!enEstrecho() && localStorage.getItem(LAT_PLEGADA) === '1'){
      document.body.classList.add('lat-plegada');
    }
  }catch(e){}

  function pintarMenu(){
    const visible = enEstrecho()
      ? document.body.classList.contains('lat-abierta')
      : !document.body.classList.contains('lat-plegada');
    $('botonMenu').setAttribute('aria-expanded', String(visible));
    $('latVelo').hidden = !(enEstrecho() && visible);
  }

  $('botonMenu').addEventListener('click', () => {
    if(enEstrecho()){
      document.body.classList.toggle('lat-abierta');
    }else{
      const plegada = document.body.classList.toggle('lat-plegada');
      try{ localStorage.setItem(LAT_PLEGADA, plegada ? '1' : '0'); }catch(e){}
    }
    pintarMenu();
  });
  $('latVelo').addEventListener('click', () => {
    document.body.classList.remove('lat-abierta');
    pintarMenu();
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && document.body.classList.contains('lat-abierta')){
      document.body.classList.remove('lat-abierta');
      pintarMenu();
    }
  });

  /* ================= qué sabemos =================
     Las guías de la gerencia. Dos maneras de que sirvan, porque son dos
     momentos distintos: buscarlas aquí cuando uno se acuerda de que existe
     algo escrito, y que salgan solas en la ficha cuando no se acuerda —que es
     casi siempre—.

     Se guardan en el servidor y no en el navegador a propósito: lo que
     aprendió uno tiene que estar en la máquina del otro. */
  let guias = [];

  async function cargarGuias(){
    if(enPrueba){ guias = []; return; }
    try{
      const r = await pedir('/rest/v1/guias?select=*', {});
      guias = await r.json();
    }catch(e){ console.warn('No se pudieron traer las guías:', e); }
    /* La cuenta de la barra se pone aquí y no solo en pintarGuias(): esa solo
       corre al abrir el panel, así que el número no aparecía hasta haber
       entrado una vez. */
    $('latCuentaGuias').textContent = guias.length ? String(guias.length) : '';
    if(!$('panelSaber').hidden) pintarGuias();
  }

  /* Lo que hace que una guía venga al caso de una solicitud: comparte el tipo
     de servicio, o su título aparece nombrado en lo que pidió el usuario. */
  function guiasDe(s){
    const detalle = String(s.detalle || '').trim().toUpperCase();
    const texto = (String(s.descripcion || '') + ' ' + String(s.detalle || '')).toLowerCase();
    return guias.filter(g => {
      const cat = String(g.categoria || '').trim().toUpperCase();
      if(detalle && cat === detalle) return true;
      /* palabras del título de la guía que aparezcan en lo que se pidió: las
         cortas ("de", "el") no cuentan, o todo se parecería a todo */
      const claves = String(g.titulo || '').toLowerCase().split(/[^a-záéíóúñü]+/)
        .filter(p => p.length > 5);
      return claves.length >= 2 && claves.filter(p => texto.includes(p)).length >= 2;
    }).slice(0, 4);
  }

  function fichaGuiaHtml(g, compacta){
    const cuando = g.actualizada_en ? fechaCorta(g.actualizada_en) : '';
    /* En la ficha de una solicitud (compacta) el recorte es fijo: es una
       referencia al margen, no la lectura principal. Aquí, en cambio, es lo
       que se vino a leer —los pasos técnicos completos, que con contenido
       real son varias líneas— así que arranca recortada, pero con un botón
       para desplegarla entera sin salir de la cuadrícula. */
    return `<article class="guia${compacta ? ' chica' : ''}" data-guia="${esc(g.id)}">
      <div class="guia-h">
        ${g.categoria ? `<span class="guia-cat" title="${esc(g.categoria)}">${esc(g.categoria)}</span>` : ''}
        <h3>${esc(g.titulo)}</h3>
      </div>
      <div class="guia-cuerpo${compacta ? '' : ' recortada'}">${esc(g.cuerpo)}</div>
      <div class="guia-pie">
        <span class="guia-meta">${esc(g.autor || '')}${cuando ? ' · ' + esc(cuando) : ''}${g.origen ? ' · de la N° ' + esc(g.origen) : ''}</span>
        <div class="guia-acciones">
          ${compacta ? '' : '<button type="button" class="enlace" data-vermas>Ver completa</button>'}
          <button type="button" class="enlace" data-editar="${esc(g.id)}">Corregirla</button>
        </div>
      </div>
    </article>`;
  }

  function pintarGuias(){
    $('latCuentaGuias').textContent = guias.length ? String(guias.length) : '';

    const q = $('buscarGuia').value.trim().toLowerCase();
    const vistas = !q ? guias : guias.filter(g =>
      [g.titulo, g.cuerpo, g.categoria, g.autor]
        .some(v => String(v || '').toLowerCase().includes(q)));

    $('listaGuias').innerHTML = vistas.length
      ? `<div class="guias">${vistas.map(g => fichaGuiaHtml(g, false)).join('')}</div>`
      : `<div class="vacio">${guias.length
          ? 'Ninguna guía coincide con lo que buscas.'
          : 'Todavía no hay ninguna guía escrita. La primera sale sola de una ' +
            'solicitud ya resuelta: ábrela y pulsa "Guardar esto como guía".'}</div>`;
  }

  $('buscarGuia').addEventListener('input', pintarGuias);
  $('listaGuias').addEventListener('click', e => {
    const v = e.target.closest('[data-vermas]');
    if(v){
      const cuerpo = v.closest('.guia').querySelector('.guia-cuerpo');
      const recortada = cuerpo.classList.toggle('recortada');
      v.textContent = recortada ? 'Ver completa' : 'Ver menos';
      return;
    }
    const b = e.target.closest('[data-editar]');
    if(b) abrirGuia(guias.find(g => g.id === b.dataset.editar));
  });

  /* ---------- escribir una guía ---------- */
  let guiaEnMano = null;   /* la que se está corrigiendo, o null si es nueva */

  function abrirGuia(g, semilla){
    guiaEnMano = g || null;
    const detalles = CAT_SERVICIOS.reduce((t, s) => t.concat(s.detalles), []);
    const cat = (g && g.categoria) || (semilla && semilla.categoria) || 'General';
    $('gCategoria').innerHTML = ['General'].concat(detalles)
      .map(d => `<option value="${esc(d)}" ${d === cat ? 'selected' : ''}>${esc(d)}</option>`).join('');
    $('gTitulo').value = (g && g.titulo) || (semilla && semilla.titulo) || '';
    $('gCuerpo').value = (g && g.cuerpo) || (semilla && semilla.cuerpo) || '';
    /* lo que ve la casa no se siembra de un caso: hay que escribirlo pensando
       en quien no es técnico, y copiarlo de las observaciones sería justo lo
       que no se puede publicar */
    $('gSolucion').value = (g && g.solucion) || '';
    $('tituloVentanaGuia').textContent = g ? 'Corregir la guía' : 'Escribir una guía';
    $('borrarGuia').hidden = !g;
    $('avisoGuia').hidden = true;
    guiaSemilla = semilla || null;
    $('veloGuia').hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('gTitulo').focus());
  }
  let guiaSemilla = null;

  function cerrarGuia(){
    $('veloGuia').hidden = true;
    guiaEnMano = null; guiaSemilla = null;
    if($('velo').hidden && $('veloChat').hidden && $('veloPerfil').hidden && $('veloNueva').hidden){
      document.body.style.overflow = '';
    }
  }

  async function guardarGuia(){
    const titulo = $('gTitulo').value.trim();
    const cuerpo = $('gCuerpo').value.trim();
    if(!titulo || !cuerpo){
      $('avisoGuia').innerHTML = '<span>⚠</span><div>Hacen falta el título y los pasos: ' +
        'una guía sin una de las dos cosas no le sirve a nadie.</div>';
      $('avisoGuia').hidden = false;
      return;
    }
    const boton = $('guardarGuia');
    boton.disabled = true; boton.textContent = 'Guardando…';
    const cuerpoJson = {titulo, cuerpo, categoria: $('gCategoria').value,
                        solucion: $('gSolucion').value.trim()};
    if(!guiaEnMano && guiaSemilla && guiaSemilla.origen) cuerpoJson.origen = guiaSemilla.origen;
    try{
      const r = await pedir('/rest/v1/guias' + (guiaEnMano ? '?id=eq.' + guiaEnMano.id : ''), {
        method: guiaEnMano ? 'PATCH' : 'POST',
        headers: {'Content-Type': 'application/json', 'Prefer': 'return=representation'},
        body: JSON.stringify(cuerpoJson),
      });
      const guardada = (await r.json())[0];
      const i = guias.findIndex(g => g.id === guardada.id);
      if(i >= 0) guias[i] = guardada; else guias.unshift(guardada);
      cerrarGuia();
      if(!$('panelSaber').hidden) pintarGuias();
      if(!$('velo').hidden) pintarFicha();
    }catch(err){
      $('avisoGuia').innerHTML = '<span>⚠</span><div>No se pudo guardar: ' + esc(err.message) + '</div>';
      $('avisoGuia').hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Guardar';
  }

  async function borrarLaGuia(){
    if(!guiaEnMano) return;
    if(!confirm('Se borra la guía "' + guiaEnMano.titulo + '". ¿Seguimos?')) return;
    try{
      await pedir('/rest/v1/guias?id=eq.' + guiaEnMano.id, {method: 'DELETE'});
      guias = guias.filter(g => g.id !== guiaEnMano.id);
      cerrarGuia();
      pintarGuias();
      if(!$('velo').hidden) pintarFicha();
    }catch(err){
      $('avisoGuia').innerHTML = '<span>⚠</span><div>No se pudo borrar: ' + esc(err.message) + '</div>';
      $('avisoGuia').hidden = false;
    }
  }

  /* Reclamar un campo que falta, y retirar el reclamo. La planilla del usuario
     tiene lo suyo en js/solicitud.js; aquí hacía falta lo mismo en pequeño. */
  function marcarError(id, texto){
    const campo = $(id).closest('.campo');
    if(!campo) return;
    campo.classList.add('mal');
    const hueco = campo.querySelector('.error');
    if(hueco) hueco.textContent = texto;
  }

  function limpiarErrores(caja){
    (caja || document).querySelectorAll('.campo.mal').forEach(c => {
      c.classList.remove('mal');
      const hueco = c.querySelector('.error');
      if(hueco) hueco.textContent = '';
    });
  }

  /* ================= quién puede entrar =================
     Dar de alta a un compañero exigía hasta ahora la línea de comandos en la
     máquina que sirve las páginas. Eso obligaba a que siempre hubiera alguien
     capaz de arrancar un servidor, y dejaba fuera a quien tuviera que hacerlo
     desde su puesto un lunes por la mañana.

     No hay jefes: cualquiera que ya esté dentro puede dar de alta a otro. Es
     lo coherente con cómo funciona el resto —todas las cuentas ven y atienden
     todas las solicitudes—, y un escalón de permisos solo para esto sería una
     ceremonia que no protege de nada.

     Las claves no viajan nunca: el servidor guarda su huella y devuelve las
     cuentas sin ella. La única que se ve es la recién inventada, una vez. */
  /* Contra el servidor de casa esto va por /auth/v1/admin/users, que es el
     dialecto que ya habla. Supabase no deja crear cuentas desde el navegador
     —haría falta su llave de administrador, y esa bypasea los permisos de
     todas las tablas, así que no puede vivir en una página—. Allá la misma
     petición va a una Edge Function que la guarda del lado del servidor y
     comprueba antes que quien llama sea de GGTIC. Las dos hablan igual: mismos
     verbos, mismos campos, misma respuesta.
     Ver supabase/functions/cuentas/. */
  const RUTA_CUENTAS = B.servidor === 'supabase'
    ? '/functions/v1/cuentas'
    : '/auth/v1/admin/users';

  let cuentas = [];
  let cuentaEnMano = null;

  async function cargarCuentas(){
    if(enPrueba){ cuentas = []; return; }
    try{
      const r = await pedir(RUTA_CUENTAS, {});
      cuentas = await r.json();
    }catch(e){ console.warn('No se pudieron traer las cuentas:', e); }
    if(abierto('panelCuentas')) pintarCuentas();
  }

  function fichaCuentaHtml(u){
    const yo = sesion() && sesion().correo === u.correo;
    const desde = u.creado_en ? fechaCorta(u.creado_en) : '';
    return `<article class="cuenta" data-cuenta="${esc(u.correo)}">
      <div class="cuenta-q">
        <b>${esc(u.nombre || u.correo)}${yo ? ' <span class="cuenta-yo">tú</span>' : ''}</b>
        <span>${esc(u.correo)}${u.es_admin ? ' · <span class="cuenta-admin">Administrador</span>' : ''}</span>
      </div>
      <div class="cuenta-d">
        ${u.cargo ? `<span>${esc(u.cargo)}</span>` : '<span class="falta">sin cargo</span>'}
        ${u.telefono ? `<span>${esc(u.telefono)}</span>` : ''}
        ${desde ? `<span>desde ${esc(desde)}</span>` : ''}
      </div>
      <button type="button" class="enlace" data-editar-cuenta="${esc(u.correo)}">Corregirla</button>
    </article>`;
  }

  function pintarCuentas(){
    const q = $('buscarCuenta').value.trim().toLowerCase();
    const vistas = !q ? cuentas : cuentas.filter(u =>
      [u.nombre, u.correo, u.cargo].some(v => String(v || '').toLowerCase().includes(q)));

    $('listaCuentas').innerHTML = vistas.length
      ? `<div class="cuentas">${vistas.map(fichaCuentaHtml).join('')}</div>`
      : `<div class="vacio">${cuentas.length
          ? 'Ninguna cuenta coincide con lo que buscas.'
          : 'No hay ninguna cuenta.'}</div>`;
  }

  /* Con `u` corrige esa cuenta; sin nada, crea una. La diferencia que importa
     es el correo: es la llave, así que en una cuenta que ya existe no se toca. */
  function abrirCuenta(u){
    cuentaEnMano = u || null;
    $('tituloVentanaCuenta').textContent = u ? 'Corregir una cuenta' : 'Crear una cuenta';
    $('bajadaCuenta').textContent = u
      ? 'Lo que no vuelvas a escribir se conserva. La contraseña solo cambia si pones una nueva.'
      : 'Con esto esa persona podrá entrar a la bandeja y atender solicitudes. ' +
        'El nombre y el cargo salen impresos en la Hoja de Servicio.';

    $('cCorreo').value   = u ? u.correo : '';
    $('cCorreo').disabled = !!u;
    $('ayudaCorreo').textContent = u
      ? 'Es la llave de la cuenta; no se cambia.'
      : 'Es la llave de la cuenta; después no se cambia.';
    $('cNombre').value   = (u && u.nombre)   || '';
    $('cCargo').value    = (u && u.cargo)    || '';
    $('cCedula').value   = (u && u.cedula)   || '';
    $('cTelefono').value = (u && u.telefono) || '';
    $('cClave').value    = '';
    $('cClave').type     = 'password';
    $('verClaveCuenta').setAttribute('aria-pressed', 'false');
    $('ayudaClave').textContent = u
      ? 'Déjala vacía para no tocarla. Mínimo 6 caracteres si la cambias.'
      : 'Mínimo 6 caracteres. En blanco, se inventa una fácil de dictar.';
    $('cAdmin').checked  = !!(u && u.es_admin);

    /* darse de baja a uno mismo es casi siempre un dedazo, y el servidor lo
       rechaza igual: mejor no ofrecer el botón */
    const yo = u && sesion() && sesion().correo === u.correo;
    $('borrarCuenta').hidden = !u || !!yo;

    $('avisoCuenta').hidden = true;
    $('claveNueva').hidden = true;
    limpiarErrores($('veloCuenta'));
    $('veloCuenta').hidden = false;
    document.body.style.overflow = 'hidden';
    (u ? $('cNombre') : $('cCorreo')).focus();
  }

  function cerrarCuenta(){
    $('veloCuenta').hidden = true;
    cuentaEnMano = null;
    if($('velo').hidden && $('veloChat').hidden && $('veloPerfil').hidden){
      document.body.style.overflow = '';
    }
  }

  async function guardarLaCuenta(){
    const correo = $('cCorreo').value.trim();
    const nombre = $('cNombre').value.trim();
    limpiarErrores($('veloCuenta'));
    let falta = false;
    if(!correo){ marcarError('cCorreo', 'Hace falta el correo.'); falta = true; }
    if(!nombre){ marcarError('cNombre', 'Hace falta el nombre: sale impreso en la hoja.'); falta = true; }
    if(falta){ $(!correo ? 'cCorreo' : 'cNombre').focus(); return; }

    const boton = $('guardarCuenta');
    boton.disabled = true; boton.textContent = 'Guardando…';
    $('avisoCuenta').hidden = true;
    try{
      const cuerpo = {correo, nombre,
        cargo:    $('cCargo').value.trim(),
        cedula:   $('cCedula').value.trim(),
        telefono: $('cTelefono').value.trim(),
        esAdmin:  $('cAdmin').checked};
      /* la clave vacía significa "no me la toques" en una cuenta que existe, y
         "invéntame una" en una nueva: en los dos casos, no mandarla */
      const clave = $('cClave').value;
      if(clave) cuerpo.clave = clave;

      const r = await pedir(RUTA_CUENTAS, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(cuerpo),
      });
      const guardada = (await r.json())[0];

      const i = cuentas.findIndex(u => u.correo === guardada.correo);
      if(i >= 0) cuentas[i] = guardada; else cuentas.push(guardada);
      pintarCuentas();

      if(guardada.clave_nueva){
        /* Se enseña aquí y no se cierra la ventana: es la única vez que esta
           clave existe escrita. Si se cierra sin apuntarla, hay que poner otra. */
        $('claveNueva').innerHTML = '<span>✓</span><div><b>Cuenta creada.</b> ' +
          'Su contraseña es <code class="clave-dictar">' + esc(guardada.clave_nueva) + '</code><br>' +
          'Apúntala o dictala ahora: no se guarda en ningún sitio y no se puede volver a ver. ' +
          'Si se pierde, se le pone una nueva desde aquí.</div>';
        $('claveNueva').hidden = false;
        $('tituloVentanaCuenta').textContent = 'Cuenta creada';
        $('cCorreo').disabled = true;
        cuentaEnMano = guardada;
      }else{
        cerrarCuenta();
      }
    }catch(err){
      $('avisoCuenta').innerHTML = '<span>⚠</span><div>No se pudo guardar: ' + esc(err.message) + '</div>';
      $('avisoCuenta').hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Guardar';
  }

  async function borrarLaCuenta(){
    if(!cuentaEnMano) return;
    const quien = cuentaEnMano.nombre || cuentaEnMano.correo;
    if(!confirm('Se da de baja a ' + quien + ' y dejará de poder entrar. ¿Seguimos?')) return;
    try{
      await pedir(RUTA_CUENTAS + '?correo=eq.' + encodeURIComponent(cuentaEnMano.correo),
                  {method: 'DELETE'});
      cuentas = cuentas.filter(u => u.correo !== cuentaEnMano.correo);
      cerrarCuenta();
      pintarCuentas();
    }catch(err){
      $('avisoCuenta').innerHTML = '<span>⚠</span><div>No se pudo dar de baja: ' + esc(err.message) + '</div>';
      $('avisoCuenta').hidden = false;
    }
  }

  $('buscarCuenta').addEventListener('input', pintarCuentas);
  $('botonNuevaCuenta').addEventListener('click', () => abrirCuenta(null));
  $('listaCuentas').addEventListener('click', e => {
    const b = e.target.closest('[data-editar-cuenta]');
    if(b) abrirCuenta(cuentas.find(u => u.correo === b.dataset.editarCuenta));
  });
  $('guardarCuenta').addEventListener('click', guardarLaCuenta);
  $('cancelarCuenta').addEventListener('click', cerrarCuenta);
  $('cerrarCuenta').addEventListener('click', cerrarCuenta);
  $('borrarCuenta').addEventListener('click', borrarLaCuenta);
  $('verClaveCuenta').addEventListener('click', () => {
    const c = $('cClave'), b = $('verClaveCuenta');
    const viendo = c.type === 'text';
    c.type = viendo ? 'password' : 'text';
    b.setAttribute('aria-pressed', String(!viendo));
    c.focus();
  });

  /* ---------- correos permitidos: quién puede registrarse ----------
     gtic.correos_permitidos decide quién puede crear una cuenta para pedir
     soporte (ver js/cuenta.js). Nació cerrada al navegador a propósito; la
     migración 06 le abrió la puerta a GGTIC autenticado, nada más — sigue sin
     verse desde `anon` ni desde quien pide soporte. No hace falta que el
     correo termine en @ciip.com.ve: cualquiera sirve. */
  let correosPermitidos = [];

  async function cargarCorreos(){
    if(enPrueba){ correosPermitidos = []; return; }
    try{
      const r = await pedir('/rest/v1/correos_permitidos?select=*&order=agregado_en.desc', {});
      correosPermitidos = await r.json();
    }catch(e){ console.warn('No se pudieron traer los correos permitidos:', e); }
    if(abierto('panelCorreos')) pintarCorreos();
  }

  function fichaCorreoHtml(c){
    const desde = c.agregado_en ? fechaCorta(c.agregado_en) : '';
    return `<article class="cuenta" data-correo="${esc(c.correo)}">
      <div class="cuenta-q">
        <b>${esc(c.nombre || c.correo)}</b>
        ${c.nombre ? `<span>${esc(c.correo)}</span>` : ''}
      </div>
      <div class="cuenta-d">
        ${desde ? `<span>desde ${esc(desde)}</span>` : ''}
      </div>
      <button type="button" class="enlace" data-quitar-correo="${esc(c.correo)}">Quitar</button>
    </article>`;
  }

  function pintarCorreos(){
    const q = $('buscarCorreo').value.trim().toLowerCase();
    const vistos = !q ? correosPermitidos : correosPermitidos.filter(c =>
      [c.correo, c.nombre].some(v => String(v || '').toLowerCase().includes(q)));

    $('listaCorreos').innerHTML = vistos.length
      ? `<div class="cuentas">${vistos.map(fichaCorreoHtml).join('')}</div>`
      : `<div class="vacio">${correosPermitidos.length
          ? 'Ningún correo coincide con lo que buscas.'
          : 'Todavía no hay ningún correo permitido.'}</div>`;
  }

  function abrirCorreos(){
    $('pmCorreos').value = '';
    $('avisoCorreo').hidden = true;
    limpiarErrores($('veloCorreo'));
    $('veloCorreo').hidden = false;
    $('pmCorreos').focus();
  }
  function cerrarCorreos(){ $('veloCorreo').hidden = true; }

  /* La misma caja sirve para uno o para muchos: se separa por línea o por
     coma, se descartan los repetidos y los espacios de sobra, y se valida
     todo antes de mandar nada — mejor decir "esto no es un correo" antes de
     escribir, que a mitad de un lote. */
  async function guardarCorreos(){
    const crudo = $('pmCorreos').value;
    limpiarErrores($('veloCorreo'));
    const correos = [...new Set(
      crudo.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    )];
    const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalido = correos.find(c => !RE_CORREO.test(c));

    if(!correos.length){
      marcarError('pmCorreos', 'Escribe al menos un correo.');
      $('pmCorreos').focus();
      return;
    }
    if(invalido){
      marcarError('pmCorreos', 'Esto no parece un correo: ' + invalido);
      $('pmCorreos').focus();
      return;
    }

    const boton = $('guardarCorreos');
    boton.disabled = true; boton.textContent = 'Agregando…';
    $('avisoCorreo').hidden = true;
    try{
      /* resolution=ignore-duplicates: repetir uno que ya está no rompe el
         lote entero, simplemente no hace nada con ese (ON CONFLICT DO
         NOTHING). No usar merge-duplicates: eso es ON CONFLICT DO UPDATE y
         Postgres exige permiso de UPDATE, que authenticated no tiene sobre
         esta tabla (solo select, insert, delete — ver migraciones 06 y 08).
         Los repetidos no vuelven en la respuesta, pero ya están en la lista. */
      const r = await pedir('/rest/v1/correos_permitidos?on_conflict=correo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates,return=representation',
        },
        body: JSON.stringify(correos.map(correo => ({correo}))),
      });
      const guardados = await r.json();
      guardados.forEach(g => {
        const i = correosPermitidos.findIndex(c => c.correo === g.correo);
        if(i >= 0) correosPermitidos[i] = g; else correosPermitidos.push(g);
      });
      pintarCorreos();
      cerrarCorreos();
    }catch(err){
      $('avisoCorreo').innerHTML = '<span>⚠</span><div>No se pudo agregar: ' + esc(err.message) + '</div>';
      $('avisoCorreo').hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Agregar';
  }

  async function quitarCorreo(correo){
    if(!confirm('Se quita ' + correo + ' de la lista: nadie podrá registrar ' +
                'una cuenta nueva con ese correo. Las cuentas que ya existan ' +
                'con él no se ven afectadas. ¿Seguimos?')) return;
    try{
      await pedir('/rest/v1/correos_permitidos?correo=eq.' + encodeURIComponent(correo),
                  {method: 'DELETE'});
      correosPermitidos = correosPermitidos.filter(c => c.correo !== correo);
      pintarCorreos();
    }catch(err){
      alert('No se pudo quitar: ' + err.message);
    }
  }

  $('buscarCorreo').addEventListener('input', pintarCorreos);
  $('botonNuevoCorreo').addEventListener('click', abrirCorreos);
  $('listaCorreos').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-correo]');
    if(b) quitarCorreo(b.dataset.quitarCorreo);
  });
  $('guardarCorreos').addEventListener('click', guardarCorreos);
  $('cancelarCorreo').addEventListener('click', cerrarCorreos);
  $('cerrarCorreo').addEventListener('click', cerrarCorreos);

  /* ---------- trazabilidad: quién hizo qué y cuándo ----------
     gtic.bitacora se llena sola —un disparador en solicitudes y en
     correos_permitidos, la Edge Function de Cuentas, y esta misma
     pantalla al entrar (ver más abajo, en el 'submit' de formAcceso)—.
     Aquí solo se lee: nadie edita ni borra una fila desde el navegador,
     ni siquiera un administrador (migración 15). */
  let trazaFilas = [];
  let trazaTabla = '';
  let trazaPagina = 1;
  let trazaPorPagina = 25;

  const TRAZA_TABLAS = [
    ['', 'Todas'],
    ['solicitudes', 'Solicitudes'],
    ['cuentas', 'Cuentas'],
    ['correos_permitidos', 'Correos permitidos'],
    ['sesion', 'Accesos'],
  ];
  const TRAZA_TABLA_ETIQUETA = Object.fromEntries(TRAZA_TABLAS);
  const TRAZA_OP_ETIQUETA = {ALTA: 'Alta', CAMBIO: 'Cambio', BAJA: 'Baja', ACCESO: 'Acceso'};

  async function cargarTrazabilidad(){
    trazaPagina = 1;
    if(enPrueba){ trazaFilas = []; return; }
    try{
      const r = await pedir('/rest/v1/bitacora?select=*&order=ocurrido_en.desc&limit=300', {});
      trazaFilas = await r.json();
    }catch(e){ console.warn('No se pudo traer la trazabilidad:', e); }
    if(abierto('panelTrazabilidad')) pintarTrazabilidad();
  }

  /* Compara antes y después y cuenta solo lo que cambió, en una línea
     corta: nadie necesita ver de nuevo las diez columnas que ya estaban
     igual. Los valores largos se recortan; los objetos y las listas
     —renglones de equipo, por ejemplo— se anotan como "cambió", no se
     desarman aquí. */
  function resumirCambio(fila){
    const corto = v => {
      if(v == null || v === '') return '(vacío)';
      if(typeof v === 'object') return 'cambió';
      const s = String(v);
      return s.length > 46 ? s.slice(0, 46) + '…' : s;
    };
    if(fila.operacion === 'ALTA'){
      const n = fila.data_nueva || {};
      const pistas = [n.usuario, n.nombre, n.correo, n.gerencia].filter(Boolean);
      return pistas.length ? 'Se creó: ' + esc(pistas.join(' · ')) : 'Se creó.';
    }
    if(fila.operacion === 'BAJA'){
      return 'Se quitó' + (fila.entidad_id ? ': ' + esc(fila.entidad_id) : '.');
    }
    if(fila.operacion === 'ACCESO'){
      return esc(fila.nota || 'Entró a la bandeja.');
    }
    // CAMBIO
    const antes = fila.data_previa || {}, despues = fila.data_nueva || {};
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
    const cambios = claves.filter(k => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
    if(!cambios.length) return 'Sin diferencias visibles.';
    return cambios.slice(0, 5).map(k =>
      `<b>${esc(k)}</b>: ${esc(corto(antes[k]))} → ${esc(corto(despues[k]))}`
    ).join(' · ') + (cambios.length > 5 ? ` · y ${cambios.length - 5} más` : '');
  }

  function fechaHora(iso){
    if(!iso) return '';
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /* Los mismos tres filtros —pestaña, fecha, buscador— los usan la tabla
     en pantalla y el CSV, así que se calculan en un solo sitio: que
     alguien busque algo y descargue tiene que bajar justo lo que ve, ni
     una fila más. */
  function trazaFiltradas(){
    const q = $('buscarTraza').value.trim().toLowerCase();
    const desde = $('trazaDesde').value ? new Date($('trazaDesde').value) : null;
    const hasta = $('trazaHasta').value ? new Date($('trazaHasta').value + 'T23:59:59') : null;
    return trazaFilas.filter(f => {
      if(trazaTabla && f.tabla !== trazaTabla) return false;
      const cuando = new Date(f.ocurrido_en);
      if(desde && cuando < desde) return false;
      if(hasta && cuando > hasta) return false;
      if(q && ![f.correo, f.entidad_id, f.nota, f.tabla].some(v =>
        String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function filaTrazaHtml(fila){
    const op = String(fila.operacion || '').toLowerCase();
    return `<tr class="traza-${op}">
      <td class="td-cuando">${esc(fechaHora(fila.ocurrido_en))}</td>
      <td>${fila.correo ? esc(fila.correo) : '<i>sin sesión</i>'}</td>
      <td><span class="traza-etiqueta ${op}">${esc(TRAZA_OP_ETIQUETA[fila.operacion] || fila.operacion)}</span></td>
      <td>${esc(TRAZA_TABLA_ETIQUETA[fila.tabla] || fila.tabla)}</td>
      <td class="td-entidad">${fila.entidad_id ? esc(fila.entidad_id) : ''}</td>
      <td class="td-detalle">${resumirCambio(fila)}</td>
    </tr>`;
  }

  function pintarTrazaTabs(){
    $('trazaTabs').innerHTML = TRAZA_TABLAS.map(([k, l]) => {
      const n = k ? trazaFilas.filter(f => f.tabla === k).length : trazaFilas.length;
      return `<button type="button" class="ficha ${trazaTabla===k?'on':''}" data-tabla="${k}">${l}${
        n ? `<span class="n">${n}</span>` : ''}</button>`;
    }).join('');
  }

  /* Las mismas cuatro cosas que ya se pueden mirar por pestaña, resumidas
     arriba en una cifra cada una —como en Atlas—: se entiende el tamaño
     de cada cosa sin tener que contar filas de una tabla. Clic en una
     salta a esa pestaña, igual que allá. */
  function pintarTrazaKpis(){
    const cuenta = tabla => trazaFilas.filter(f => f.tabla === tabla).length;
    const tarjetas = [
      ['solicitudes', 'Solicitudes', cuenta('solicitudes')],
      ['cuentas', 'Cuentas de GGTIC', cuenta('cuentas')],
      ['correos_permitidos', 'Correos permitidos', cuenta('correos_permitidos')],
      ['sesion', 'Accesos', cuenta('sesion')],
    ];
    $('trazaKpis').innerHTML = tarjetas.map(([clave, rotulo, n]) => `
      <button type="button" class="kpi" data-tabla-kpi="${clave}">
        <div class="r">${esc(rotulo)}</div>
        <div class="v">${n}</div>
        <div class="s">de ${trazaFilas.length} en las últimas 300</div>
      </button>`).join('');
  }

  function pintarTrazabilidad(){
    pintarTrazaTabs();
    pintarTrazaKpis();
    const vistas = trazaFiltradas();
    const totalPaginas = Math.max(1, Math.ceil(vistas.length / trazaPorPagina));
    if(trazaPagina > totalPaginas) trazaPagina = totalPaginas;
    const inicio = (trazaPagina - 1) * trazaPorPagina;
    const pagina = vistas.slice(inicio, inicio + trazaPorPagina);

    $('listaTraza').innerHTML = vistas.length
      ? `<table class="tabla-traza">
          <thead><tr>
            <th>Cuándo</th><th>Quién</th><th>Operación</th><th>Tabla</th><th>Afectado</th><th>Detalle</th>
          </tr></thead>
          <tbody>${pagina.map(filaTrazaHtml).join('')}</tbody>
        </table>`
      : `<div class="vacio">${trazaFilas.length
          ? 'Nada coincide con lo que buscas.'
          : 'Todavía no hay nada en la trazabilidad.'}</div>`;

    $('trazaPie').innerHTML = !vistas.length ? '' : `
      <span>${inicio + 1}–${Math.min(inicio + trazaPorPagina, vistas.length)} de ${vistas.length}
        · <select id="trazaPorPaginaSel">
            ${[25, 50, 100].map(n => `<option value="${n}" ${n===trazaPorPagina?'selected':''}>${n} por página</option>`).join('')}
          </select></span>
      <span class="paginas">
        <button type="button" id="trazaPagAnt" ${trazaPagina<=1?'disabled':''}>‹ Anterior</button>
        Página ${trazaPagina} de ${totalPaginas}
        <button type="button" id="trazaPagSig" ${trazaPagina>=totalPaginas?'disabled':''}>Siguiente ›</button>
      </span>`;
    const sel = $('trazaPorPaginaSel');
    if(sel) sel.addEventListener('change', () => {
      trazaPorPagina = Number(sel.value); trazaPagina = 1; pintarTrazabilidad();
    });
    const ant = $('trazaPagAnt');
    if(ant) ant.addEventListener('click', () => { trazaPagina--; pintarTrazabilidad(); });
    const sig = $('trazaPagSig');
    if(sig) sig.addEventListener('click', () => { trazaPagina++; pintarTrazabilidad(); });
  }

  /* CSV con lo que está filtrado en pantalla, no con todo lo cargado:
     lo que se ve es lo que se descarga. */
  function descargarTrazaCsv(){
    const vistas = trazaFiltradas();
    if(!vistas.length){ alert('No hay nada que descargar con este filtro.'); return; }
    const encabezado = ['ocurrido_en', 'correo', 'operacion', 'tabla', 'entidad_id', 'nota'];
    const csvCelda = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lineas = [encabezado.join(',')].concat(
      vistas.map(f => encabezado.map(k => csvCelda(f[k])).join(','))
    );
    lineas.push('');
    const q = $('buscarTraza').value.trim();
    lineas.push('# Exportado ' + fechaHora(new Date().toISOString()) + ' · ' + vistas.length +
      ' de ' + trazaFilas.length + ' filas cargadas (últimas 300) · filtro: ' +
      (trazaTabla || 'todas') + (q ? ' · buscando "' + q + '"' : ''));
    const blob = new Blob(['﻿' + lineas.join('\n')], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trazabilidad-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $('trazaTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tabla]');
    if(!b) return;
    trazaTabla = b.dataset.tabla;
    trazaPagina = 1;
    pintarTrazabilidad();
  });
  /* Las tarjetas de arriba llevan a la pestaña de lo mismo que cuentan,
     igual que en Atlas: mirar un número y querer ver esas filas es un
     solo gesto, no dos. */
  $('trazaKpis').addEventListener('click', e => {
    const b = e.target.closest('[data-tabla-kpi]');
    if(!b) return;
    trazaTabla = b.dataset.tablaKpi;
    trazaPagina = 1;
    pintarTrazabilidad();
  });
  const filtroTrazaCambio = () => { trazaPagina = 1; pintarTrazabilidad(); };
  $('buscarTraza').addEventListener('input', filtroTrazaCambio);
  $('trazaDesde').addEventListener('change', filtroTrazaCambio);
  $('trazaHasta').addEventListener('change', filtroTrazaCambio);
  $('limpiarFiltrosTraza').addEventListener('click', () => {
    $('buscarTraza').value = '';
    $('trazaDesde').value = '';
    $('trazaHasta').value = '';
    trazaTabla = '';
    trazaPagina = 1;
    pintarTrazabilidad();
  });
  $('botonTrazaCsv').addEventListener('click', descargarTrazaCsv);

  /* ---------- apuntar el equipo de alguien ----------
     Se abre desde la ficha, con lo que el técnico acabe de escribir en el
     renglón ya puesto: el trabajo está hecho, guardarlo es un clic. */
  let equipoDe = null;

  function abrirEquipo(nombre){
    equipoDe = nombre;
    $('equipoDeQuien').textContent = nombre;
    const r = document.querySelector('#renglones .renglon');
    const dato = c => {
      const el = r && r.querySelector('[data-campo=' + c + ']');
      return el ? el.value : '';
    };
    const yaTiene = (typeof inventarioDe === 'function' ? inventarioDe(nombre) : [])
      .find(e => e.equipo === (dato('equipo') || 'CPU'));

    $('eqTipo').innerHTML = CAT_EQUIPOS
      .map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    $('eqMarca').innerHTML = '<option value="">—</option>' + CAT_MARCAS
      .map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    $('eqTipo').value   = dato('equipo') || (yaTiene && yaTiene.equipo) || 'CPU';
    $('eqMarca').value  = dato('marca')  || (yaTiene && yaTiene.marca)  || '';
    $('eqModelo').value = dato('modelo') || (yaTiene && yaTiene.modelo) || '';
    $('eqSerial').value = dato('serial') || (yaTiene && yaTiene.serial) || '';
    $('avisoEquipo').hidden = true;
    $('veloEquipo').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('eqSerial').focus(), 30);
  }

  function cerrarEquipo(){
    $('veloEquipo').hidden = true;
    equipoDe = null;
    if($('velo').hidden && $('veloChat').hidden && $('veloPerfil').hidden &&
       $('veloNueva').hidden && $('veloGuia').hidden){
      document.body.style.overflow = '';
    }
  }

  async function guardarEquipo(){
    if(!equipoDe) return;
    const boton = $('guardarEquipo');
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{
      const r = await pedir('/rest/v1/inventario', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Prefer': 'return=representation'},
        body: JSON.stringify({
          nombre: equipoDe, equipo: $('eqTipo').value, marca: $('eqMarca').value,
          modelo: $('eqModelo').value.trim(), serial: $('eqSerial').value.trim(),
        }),
      });
      inventarioMezclar(await r.json());
      cerrarEquipo();
      if(!$('velo').hidden) pintarFicha();
    }catch(err){
      $('avisoEquipo').innerHTML = '<span>⚠</span><div>No se pudo guardar: ' + esc(err.message) + '</div>';
      $('avisoEquipo').hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Guardar en el inventario';
  }

  $('cerrarEquipo').addEventListener('click', cerrarEquipo);
  $('cancelarEquipo').addEventListener('click', cerrarEquipo);
  $('guardarEquipo').addEventListener('click', guardarEquipo);
  $('veloEquipo').addEventListener('click', e => { if(e.target === $('veloEquipo')) cerrarEquipo(); });

  $('botonNuevaGuia').addEventListener('click', () => abrirGuia(null, null));
  $('cerrarGuia').addEventListener('click', cerrarGuia);
  $('cancelarGuia').addEventListener('click', cerrarGuia);
  $('guardarGuia').addEventListener('click', guardarGuia);
  $('borrarGuia').addEventListener('click', borrarLaGuia);
  $('veloGuia').addEventListener('click', e => { if(e.target === $('veloGuia')) cerrarGuia(); });

  /* ================= la ficha de una solicitud ================= */
  function opcionesHtml(lista, elegido){
    return lista.map(v => `<option value="${esc(v)}" ${v===elegido?'selected':''}>${esc(v)}</option>`).join('');
  }

  function renglonHtml(r, i){
    const detalles = catDetallesDe(r.tipo || '');
    return `<div class="renglon" data-i="${i}">
      <div class="enc"><b>Renglón ${i+1}</b>
        <button type="button" class="quitar" data-quitar="${i}">Quitar</button></div>
      <div class="rejilla">
        <div class="campo c6"><label>Tipo de servicio</label>
          <select data-campo="tipo">
            <option value="">—</option>
            ${CAT_SERVICIOS.map(s=>`<option value="${esc(s.valor)}" ${s.valor===r.tipo?'selected':''}>${esc(s.etiqueta)}</option>`).join('')}
          </select></div>
        <div class="campo c6"><label>Detalle</label>
          <select data-campo="detalle" ${detalles.length?'':'disabled'}>
            <option value="">—</option>${opcionesHtml(detalles, r.detalle)}
          </select></div>
        <div class="campo c3"><label>Equipo</label>
          <select data-campo="equipo"><option value="">—</option>${opcionesHtml(CAT_EQUIPOS, r.equipo)}</select></div>
        <div class="campo c3"><label>Marca</label>
          <select data-campo="marca"><option value="">—</option>${opcionesHtml(CAT_MARCAS, r.marca)}</select></div>
        <div class="campo c3"><label>Modelo</label>
          <input type="text" data-campo="modelo" value="${esc(r.modelo||'')}"></div>
        <div class="campo c3"><label>Serial</label>
          <input type="text" data-campo="serial" value="${esc(r.serial||'')}"></div>
      </div>
    </div>`;
  }

  function abrir(id){
    const s = solicitudes.find(x => x.id === id);
    if(!s) return;
    recien.delete(id);   /* ya la vio: la marca de recién llegada sobra */
    /* Copia de trabajo: lo que se edite en la ficha no toca la lista hasta que
       el servidor confirme el guardado. */
    abierta = JSON.parse(JSON.stringify(s));
    tecnicoFicha = resolverTecnico(abierta);
    if(!Array.isArray(abierta.renglones) || !abierta.renglones.length){
      /* El primer renglón viene sembrado con lo que dijo el usuario, que es lo
         que el técnico casi siempre confirma tal cual. */
      abierta.renglones = [{tipo: s.tipo || '', detalle: s.detalle || '', equipo:'', marca:'', modelo:'', serial:''}];
    }
    pintarFicha();
    $('velo').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function cerrar(){
    $('velo').hidden = true;
    abierta = null;
    document.body.style.overflow = '';
    /* Si mientras la ficha estaba abierta entró algo, ahora sí se puede mover
       la pantalla hasta ello: es lo primero que hay que ver al soltar lo que
       uno tenía entre manos. */
    if(recien.size){
      const ultima = solicitudes.find(s => recien.has(s.id));
      if(ultima) irA(ultima.id);
    }
  }

  /* ---------- el estado, como el camino que es ----------
     Las tres etapas a la vista y en orden, como las ve quien pidió. El valor
     sigue viviendo en un input oculto llamado fEstado: así guardar() e
     imprimir() no se enteran del cambio.
     Anular queda aparte, porque no es una etapa del camino sino salirse de él;
     mezclarla entre las tres invitaría a pulsarla por error. */
  const ETAPAS_GGTIC = ['recibida', 'en_proceso', 'atendida'];

  function estadoHtml(s){
    const anulada = s.estado === 'anulada';
    return `<input type="hidden" id="fEstado" value="${esc(s.estado)}">
      <div class="segm" id="segmEstado" role="group" aria-label="Estado de la solicitud">
        ${ETAPAS_GGTIC.map(e => `<button type="button" data-estado="${e}"
          class="${!anulada && e === s.estado ? 'on' : ''}"
          aria-pressed="${!anulada && e === s.estado}">${esc(ESTADO_ETIQUETA[e])}</button>`).join('')}
      </div>
      ${anulada
        ? '<div style="font-size:12px;color:var(--rust);font-weight:700;margin-top:8px">Esta solicitud está anulada.</div>'
        : '<button type="button" class="anular" id="botonAnular">Anular esta solicitud</button>'}`;
  }

  /* ---------- el técnico que atiende ----------
     Quien está atendiendo es quien inició sesión, así que no hay nada que
     escribir: se confirma. Solo se ofrece escribirlo cuando se atiende en
     nombre de otro, o cuando la solicitud ya venía atendida por un compañero.
     El valor de verdad vive en el input oculto #fTecnico, que es lo que lee
     guardar() y la hoja impresa: así el resto del código no cambia. */
  /* Quién queda como técnico de la solicitud abierta. Vive aquí y no en un
     campo de la pantalla porque la ficha se repinta entera y un valor a medio
     escribir se perdería. Lo leen guardar() e imprimir(). */
  let tecnicoFicha = null;

  /* Al abrir una solicitud: si ya la atendía alguien, ese sigue; si no, yo. */
  function resolverTecnico(s){
    const yo = yoTecnico();
    if(s.tecnico && s.tecnico !== yo.nombre){
      return {nombre: s.tecnico, cargo: s.tecnico_cargo || '',
              cedula: s.tecnico_cedula || '', telefono: s.tecnico_telefono || '',
              manual: true};
    }
    return Object.assign({manual: false}, yo);
  }

  function tecnicoHtml(){
    const t = tecnicoFicha;
    const propios = [t.cargo, t.cedula ? 'C.I. ' + t.cedula : ''].filter(Boolean).join(' · ');
    /* Cada dato que falte es una raya en blanco en la hoja impresa, así que se
       avisa por cada uno, no solo cuando faltan todos. El aviso va aquí, donde
       se nota, y con el atajo para arreglarlo de una vez. */
    const faltan = [!t.cargo && 'cargo', !t.cedula && 'cédula'].filter(Boolean);
    const linea = t.manual ? esc('Escrito a mano')
      : (propios ? esc(propios) : '')
        + (faltan.length
            ? (propios ? ' · ' : '')
              + '<button type="button" class="enlace" id="botonCompletarDatos">Falta tu '
              + faltan.join(' y tu ') + '</button>'
            : '');

    /* Sin nombre —cuenta sin nombre y solicitud sin atender— no hay nada que
       confirmar: se escribe y ya. */
    const hayNombre = !!t.nombre;
    return `
      <div class="recordado" id="tecnicoRecuadro" ${hayNombre ? '' : 'hidden'}>
        <div class="ic"><svg viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></svg></div>
        <div class="q"><b>${esc(t.nombre)}</b><span>${linea}</span></div>
        <div class="acciones"><button type="button" id="botonOtroTecnico">Es otro</button></div>
      </div>
      <div id="tecnicoManual" ${hayNombre ? 'hidden' : ''}>
        <input type="text" id="fTecnicoManual" value="${esc(t.manual ? t.nombre : '')}"
               placeholder="Nombre y apellido del técnico">
      </div>`;
  }

  /* ---------- la conversación con quien pidió ----------
     El mismo hilo que ve el usuario, visto desde el otro lado: aquí lo suyo va
     a la izquierda y lo de GGTIC a la derecha. */
  const iniciales = n => String(n || '').trim().split(/\s+/).slice(0, 2)
    .map(p => p[0] || '').join('').toUpperCase() || '?';

  const hora = iso => {
    if(!iso) return '';
    const d = new Date(iso);
    const mismoDia = d.toDateString() === new Date().toDateString();
    return mismoDia
      ? d.toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})
      : d.toLocaleDateString('es-VE', {day: '2-digit', month: 'short'}) + ' ' +
        d.toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'});
  };

  const GLOBO = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.9-.9L3 20.5l1.6-4.8A8.4 8.4 0 013.6 11a8.4 8.4 0 018.4-8.4h.5a8.4 8.4 0 018.5 8.4z"/></svg>';
  const PAPEL = '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><polyline points="14 3 14 8 19 8"/><polyline points="9 14 12 17 15 14"/><line x1="12" y1="11" x2="12" y2="17"/></svg>';

  /* La Hoja de Servicio en PDF, desde la propia cola: para archivar sin abrir
     la ficha ni pasar por la impresora. Solo en las atendidas, que es cuando el
     documento está completo —con sus observaciones y su técnico— y es la misma
     que se lleva quien pidió el soporte.

     Es un enlace y no un botón porque eso es: el navegador se encarga de
     bajarlo, sin que esta página tenga que hacer nada. */
  function hojaBotonHtml(s){
    if(s.estado !== 'atendida') return '';
    /* No hay quien arme el PDF contra Supabase (eso lo hace el Edge de la
       PC). Queda "Imprimir Hoja de Servicio" en la ficha, que no depende de
       esto: arma el mismo papel en el navegador y lo manda a imprimir o a
       guardar como PDF con Ctrl+P. */
    if(B.servidor === 'supabase') return '';
    return `<a class="chat-boton hoja" href="${esc(B.url)}/rest/v1/hoja?id=eq.${esc(s.id)}"
      download title="Descargar la Hoja de Servicio N° ${String(s.numero).padStart(3,'0')}-${esc(String(s.anio))} en PDF"
      >${PAPEL}PDF</a>`;
  }

  /* El botón que abre la conversación. Va en la fila y en la ficha; los dos
     abren la misma ventana, para que no haya dos sitios donde hablar. */
  function chatBotonHtml(s){
    /* Solo mientras se está atendiendo. Antes de tomarla no hay con quién
       hablar —nadie se ha hecho cargo todavía— y después de cerrarla, el
       asunto terminó: lo que quede por decir va en las observaciones, que sí
       salen impresas en la hoja. */
    if(s.estado !== 'en_proceso') return '';
    const n = Array.isArray(s.mensajes) ? s.mensajes.length : 0;
    return `<button type="button" class="chat-boton ${n ? 'hay' : ''}" data-chat="${esc(s.id)}"
      title="${n ? 'Ver la conversación con ' + esc(s.usuario) : 'Escribirle a ' + esc(s.usuario)}"
      >${GLOBO}${n ? `<span class="n">${n}</span>` : 'Escribir'}</button>`;
  }

  function chatHtml(s){
    if(s.estado === 'anulada') return '';
    const msgs = Array.isArray(s.mensajes) ? s.mensajes : [];
    return `<div class="chat">
      <div class="chat-h">
        <div class="ic">${esc(iniciales(s.usuario))}</div>
        <div>
          <b>${esc(s.usuario)}</b>
          <span>N° ${esc(String(s.numero).padStart(3,'0'))}-${esc(String(s.anio))} ·
            ${msgs.length ? msgs.length + (msgs.length === 1 ? ' mensaje' : ' mensajes')
                          : 'Todavía no se han escrito'}</span>
        </div>
      </div>
      <div class="chat-hilo" id="chatHilo">
        ${msgs.length ? msgs.map(m => `<div class="burbuja ${m.de === 'gtic' ? 'usuario' : 'gtic'}">` +
            `<div class="quien">${esc(m.de === 'gtic' ? m.nombre : String(m.nombre).split(' ')[0])}</div>` +
            (m.texto ? `<div class="texto">${esc(m.texto)}</div>` : '') +
            soporteAdjuntos.enBurbuja(m.adjuntos) +
            `<div class="hora">${esc(hora(m.en))}</div>` +
          `</div>`).join('')
          : `<div class="chat-vacio">Puedes escribirle para pedirle un dato,
             avisarle a qué hora subes, o decirle que ya quedó.</div>`}
      </div>
      ${s.estado !== 'en_proceso' ? '<div class="chat-cerrado">Esta conversación se cerró: la solicitud ya no está en proceso.</div>' : ''}
      <div class="adj-lista" id="adjLista" hidden></div>
      <div class="chat-escribir" ${s.estado === 'en_proceso' ? '' : 'hidden'}>
        ${soporteAdjuntos.botonHtml()}
        <textarea id="chatTexto" rows="1" maxlength="1000"
                  placeholder="Escríbele a ${esc(String(s.usuario).split(' ')[0])}…"></textarea>
        <button type="button" class="boton primario" id="chatEnviar">Enviar</button>
      </div>
      <div class="chat-nota">Lo que escribas aquí lo ve quien pidió el soporte, no sale en la Hoja de Servicio.</div>
    </div>`;
  }

  /* La solicitud cuya conversación está abierta. Es aparte de `abierta` (la de
     la ficha) porque el chat se puede abrir desde la fila, sin ficha ninguna. */
  let chatId = null;

  function pintarChat(){
    const s = solicitudes.find(x => x.id === chatId);
    if(!s) return;
    /* Puede llegar un mensaje mientras se escribe otro: se guarda lo tecleado,
       el foco y por dónde iba el hilo, y se devuelve tras repintar. */
    const vieja = $('chatTexto');
    const g = vieja ? {
      texto: vieja.value,
      escribiendo: document.activeElement === vieja,
      alFondo: (() => { const h = $('chatHilo');
        return !h || h.scrollHeight - h.clientHeight - h.scrollTop < 24; })(),
      donde: $('chatHilo') ? $('chatHilo').scrollTop : 0,
    } : null;

    $('chatCuerpo').innerHTML = chatHtml(s);

    const caja = $('chatTexto');
    if(caja && g){
      caja.value = g.texto;
      if(g.escribiendo){ caja.focus(); caja.setSelectionRange(caja.value.length, caja.value.length); }
    }
    const hilo = $('chatHilo');
    /* si estaba mirando el final, se queda en el final —donde acaba de llegar
       lo nuevo—; si había subido a leer, se respeta dónde estaba */
    if(hilo) hilo.scrollTop = (!g || g.alFondo) ? hilo.scrollHeight : g.donde;
    /* el clip y su menú son otros después de repintar: se vuelven a enganchar */
    soporteAdjuntos.conectar(chatId);
  }

  function abrirChat(id){
    chatId = id;
    /* Se muestra ANTES de pintar: oculta no tiene altura, y llevar el hilo al
       final no haría nada — la conversación se abriría por el principio. */
    $('veloChat').hidden = false;
    document.body.style.overflow = 'hidden';
    pintarChat();
    const caja = $('chatTexto');
    if(caja) caja.focus();
  }

  function cerrarChat(){
    $('veloChat').hidden = true;
    chatId = null;
    /* si la ficha sigue detrás, el fondo no vuelve a rodar todavía */
    if($('velo').hidden && $('veloPerfil').hidden) document.body.style.overflow = '';
  }

  async function enviarMensaje(){
    const caja = $('chatTexto'), boton = $('chatEnviar');
    const texto = caja.value.trim();
    /* un mensaje puede ser solo una foto: "mira cómo quedó" no necesita texto */
    const adjuntos = soporteAdjuntos.pendientes();
    if((!texto && !adjuntos.length) || !chatId){ caja.focus(); return; }
    boton.disabled = true; caja.disabled = true;
    try{
      const r = await pedir('/rest/v1/rpc/enviar_mensaje', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: chatId, texto, adjuntos}),
      });
      const nuevo = (await r.json())[0];
      /* Se vacía ANTES de repintar. pintarChat conserva lo que haya escrito
         —para no borrarlo cuando entra un mensaje del otro lado— así que si no
         se vacía aquí, devuelve el texto que acaba de enviarse. */
      caja.value = '';
      soporteAdjuntos.vaciar();
      /* se añade a lo que ya está cargado y se repinta: no hace falta volver a
         pedir la solicitud entera para ver el mensaje que uno acaba de poner */
      const i = solicitudes.findIndex(x => x.id === chatId);
      if(i >= 0){
        if(!Array.isArray(solicitudes[i].mensajes)) solicitudes[i].mensajes = [];
        solicitudes[i].mensajes.push(nuevo);
        if(abierta && abierta.id === chatId) abierta.mensajes = solicitudes[i].mensajes;
      }
      pintarChat();
      pintar();                       /* la cuenta del botón de la fila cambia */
      $('chatTexto').focus();
    }catch(err){
      console.error('No se pudo enviar el mensaje:', err);
      boton.disabled = false; caja.disabled = false;
      alert('No se pudo enviar el mensaje. Revisa la conexión y vuelve a intentar.');
    }
  }

  function dato(rotulo, valor, completo){
    return `<div class="dato ${completo?'completo':''}">
      <div class="r">${esc(rotulo)}</div>
      <div class="v ${completo?'parrafo':''}">${esc(valor || '—')}</div></div>`;
  }

  /* ---------- lo que ya sabemos de esto, dentro de la ficha ----------
     Dos fuentes, y la diferencia importa: arriba las guías, que alguien se
     sentó a escribir y valen para siempre; abajo los casos anteriores del
     mismo tipo, que son lo que se hizo aquel día y puede estar bien o mal.
     Van juntos porque la pregunta es una sola —"¿esto ya nos pasó?"— y hay
     que responderla sin salir de la ficha.

     Los casos anteriores no cuestan trabajo a nadie: son las observaciones que
     el técnico ya escribe para que salgan impresas en la hoja. */
  function casosParecidos(s){
    if(!s.detalle) return [];
    return solicitudes
      .filter(x => x.id !== s.id && x.estado === 'atendida' &&
                   x.detalle === s.detalle && String(x.observaciones || '').trim())
      .sort((a, b) => String(b.atendida_en || b.creada_en).localeCompare(
                      String(a.atendida_en || a.creada_en)))
      .slice(0, 4);
  }

  function saberHtml(s){
    const enGuias = guiasDe(s);
    const antes = casosParecidos(s);
    const hayObs = !!String(s.observaciones || '').trim();
    if(!enGuias.length && !antes.length && !hayObs) return '';

    return `<div class="seccion">Qué sabemos de esto</div>
      <div class="saber">
        ${enGuias.length ? enGuias.map(g => fichaGuiaHtml(g, true)).join('')
          : ''}
        ${antes.length ? `<div class="antes">
            <div class="antes-t">Cómo se resolvió antes${s.detalle ? ' · ' + esc(s.detalle) : ''}</div>
            ${antes.map(x => `<div class="antes-f">
              <div class="antes-c">N° ${String(x.numero).padStart(3,'0')}-${esc(String(x.anio))} ·
                ${esc(fechaCorta(x.atendida_en || x.creada_en))}${x.tecnico ? ' · ' + esc(x.tecnico) : ''}</div>
              <div class="antes-o">${esc(x.observaciones)}</div>
            </div>`).join('')}
          </div>` : ''}
        ${hayObs ? `<button type="button" class="boton plano chico" id="botonAGuia">
            Guardar esto como guía</button>` : ''}
      </div>`;
  }

  /* ---------- el equipo de quien pidió ----------
     Media casa no tiene su computadora en el cuadro de Patrimonio —o la tiene a
     nombre de quien se fue— y eso se paga dos veces: la solicitud llega sin
     serial, y el técnico lo copia a mano hoy y lo vuelve a copiar el mes que
     viene. Aquí se avisa y se ofrece apuntarlo de una vez: el trabajo ya está
     hecho —el serial está delante, en el renglón— y guardarlo es un clic.

     Lo apuntado vale para todas las solicitudes que vengan, de cualquier
     máquina: se guarda en el servidor, no en este navegador. */
  function inventarioHtml(s){
    const suyos = typeof inventarioDe === 'function' ? inventarioDe(s.usuario) : [];
    const cpu = suyos.find(e => e.equipo === 'CPU');

    if(!suyos.length){
      return `<div class="aviso alerta inv-aviso">
        <span>🖥️</span>
        <div><b>${esc(String(s.usuario).split(' ')[0])} no tiene ningún equipo en el inventario.</b>
          Cada solicitud suya va a llegar sin serial mientras siga así. Si lo tienes
          delante, apúntalo y queda para siempre.</div>
        <button type="button" class="boton plano chico" data-inv="${esc(s.usuario)}">Agregar su equipo</button>
      </div>`;
    }
    if(!cpu){
      return `<div class="aviso alerta inv-aviso">
        <span>🖥️</span>
        <div><b>De ${esc(String(s.usuario).split(' ')[0])} hay ${suyos.length === 1 ? 'un equipo' : suyos.length + ' equipos'}
          apuntados, pero ninguna computadora.</b> Es justo la que más se pide.</div>
        <button type="button" class="boton plano chico" data-inv="${esc(s.usuario)}">Agregar su CPU</button>
      </div>`;
    }
    return `<div class="inv-tiene">
      En el inventario: ${suyos.map(e => esc([e.equipo, e.marca, e.serial].filter(Boolean).join(' ')))
        .join(' · ')}
      <button type="button" class="enlace" data-inv="${esc(s.usuario)}">Corregir o agregar</button>
    </div>`;
  }

  function pintarFicha(){
    const s = abierta;
    $('hojaFicha').innerHTML = `
      <button type="button" class="cerrar" id="botonCerrarFicha" aria-label="Cerrar">✕</button>
      <h2>${esc(numeroDe(s))}</h2>
      <div class="bajada">Recibida el ${esc(fechaCorta(s.creada_en))} ·
        <span class="etiqueta ${esc(s.estado)}">${esc(ESTADO_ETIQUETA[s.estado] || s.estado)}</span>
        ${chatBotonHtml(s)}</div>

      <div class="seccion" style="margin-top:20px">Lo que pidió el usuario</div>
      <div class="datos">
        ${dato('Gerencia', s.gerencia)}
        ${dato('Usuario', s.usuario)}
        ${dato('Cédula', s.cedula)}
        ${dato('Teléfono', s.telefono)}
        ${dato('Ubicación', 'Piso ' + s.piso + ', oficina ' + s.oficina)}
        ${dato('Clasificó como', s.tipo ? catTipoEtiqueta(s.tipo) + (s.detalle ? ' · ' + s.detalle : '') : 'No la clasificó')}
        ${dato('Situación planteada', s.descripcion, true)}
      </div>

      <div class="seccion">Atención de GGTIC</div>
      <div class="rejilla">
        <div class="campo c6"><label>Estado</label>${estadoHtml(s)}</div>
        <div class="campo c6"><label>Técnico que atiende</label>${tecnicoHtml()}</div>
        <div class="campo"><label for="fObs">Observaciones <span class="opc">· sale impreso en la hoja</span></label>
          <textarea id="fObs" rows="4" placeholder="Qué se encontró y qué se hizo.">${esc(s.observaciones||'')}</textarea></div>
      </div>

      ${saberHtml(s)}

      <div class="seccion">Renglones de equipo</div>
      ${inventarioHtml(s)}
      <div id="renglones">${s.renglones.map(renglonHtml).join('')}</div>
      <button type="button" class="boton plano chico" id="botonAgregar"
        ${s.renglones.length >= 6 ? 'disabled' : ''}>+ Agregar renglón</button>

      <div class="aviso malo" id="avisoFicha" hidden style="margin:18px 0 0"></div>

      <div class="botones">
        <button type="button" class="boton primario" id="botonGuardar">Guardar</button>
        <button type="button" class="boton plano" id="botonImprimir">Imprimir Hoja de Servicio</button>
        ${s.estado === "atendida" && B.servidor !== 'supabase' ? `<a class="boton plano" download
           href="${esc(B.url)}/rest/v1/hoja?id=eq.${esc(s.id)}">Descargar en PDF</a>` : ""}
      </div>`;
  }

  /* Lee de la pantalla lo que el técnico escribió en los renglones. */
  function leerRenglones(){
    return [...document.querySelectorAll('#renglones .renglon')].map(caja => {
      const r = {};
      caja.querySelectorAll('[data-campo]').forEach(el => {
        r[el.dataset.campo] = el.value.trim();
      });
      return r;
    /* Un renglón en blanco es un renglón que el técnico abrió y no usó: no
       tiene por qué llegar al servidor ni salir impreso. */
    }).filter(r => Object.values(r).some(v => v));
  }

  /* El técnico tal como está la pantalla ahora mismo. Si se escribió a mano,
     manda lo escrito y no hay cargo ni cédula que imprimir. */
  function tecnicoActual(){
    const manual = $('tecnicoManual');
    if(manual && !manual.hidden){
      const nombre = $('fTecnicoManual').value.trim();
      return {nombre, cargo: '', cedula: '', telefono: ''};
    }
    return tecnicoFicha || {nombre: '', cargo: '', cedula: '', telefono: ''};
  }

  /* El único sitio que escribe cambios en una solicitud. Lo usan la ficha y los
     botones de la fila, para que no haya dos caminos que puedan divergir. */
  async function guardarCambios(id, cambios){
    if(enPrueba) return soporteLocal.actualizar(id, cambios);
    const r = await pedir('/rest/v1/solicitudes?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', 'Prefer': 'return=representation'},
      body: JSON.stringify(cambios),
    });
    const filas = await r.json();
    return Array.isArray(filas) ? filas[0] : filas;
  }

  async function guardar(){
    const t = tecnicoActual();
    const cambios = {
      estado:           $('fEstado').value,
      tecnico:          t.nombre || null,
      tecnico_cargo:    t.cargo || null,
      tecnico_cedula:   t.cedula || null,
      tecnico_telefono: t.telefono || null,
      observaciones:    $('fObs').value.trim() || null,
      renglones:        leerRenglones(),
    };
    /* La fecha de atención la pone la primera vez que se marca atendida, y se
       borra si vuelve a abrirse el caso. */
    cambios.atendida_en = cambios.estado === 'atendida'
      ? (abierta.atendida_en || new Date().toISOString())
      : null;

    const boton = $('botonGuardar');
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{
      const guardada = await guardarCambios(abierta.id, cambios);
      const i = solicitudes.findIndex(x => x.id === abierta.id);
      if(i >= 0) solicitudes[i] = guardada;
      abierta = JSON.parse(JSON.stringify(guardada));
      pintar();
      cerrar();
    }catch(err){
      console.error('No se pudo guardar:', err);
      const caja = $('avisoFicha');
      if(caja){
        caja.innerHTML = '<span>⚠</span><div><b>No se pudo guardar.</b> '
          + 'Revisa la conexión y vuelve a intentar; lo que escribiste sigue en pantalla.</div>';
        caja.hidden = false;
      }
      boton.disabled = false; boton.textContent = 'Guardar';
    }
  }

  /* ================= la hoja impresa ================= */
  /* Rehace el formato del Excel con lo que hay en pantalla —no con lo guardado—
     para que el técnico pueda imprimir lo que acaba de escribir. */
  function imprimir(){
    /* La hoja se arma en js/hoja.js, que es la misma que se convierte en PDF
       para quien pidio el soporte: un solo papel, dos salidas. Desde aqui va
       con lo que hay en pantalla ahora mismo —el tecnico y las observaciones
       sin guardar todavia—, porque se imprime para firmar en el momento. */
    $('impresion').innerHTML = hojaServicioHtml(
      Object.assign({}, abierta, {renglones: leerRenglones()}),
      tecnicoActual(),
      $('fObs').value.trim());
    window.print();
  }

  /* ================= mis datos =================
     Lo que sale impreso junto a la firma. Vive en la cuenta, en el servidor,
     no en este navegador: se llena una vez y sirve desde cualquier equipo. */
  function abrirPerfil(){
    const s = sesion() || {};
    $('pNombre').value   = s.nombre || '';
    $('pCargo').value    = s.cargo || '';
    $('pCedula').value   = s.cedula || '';
    $('pTelefono').value = s.telefono || '';
    $('pCorreo').value   = s.correo || '';
    $('avisoPerfil').hidden = true;
    $('pNombre').closest('.campo').classList.remove('mal');
    $('veloPerfil').hidden = false;
    (s.nombre ? $('pCargo') : $('pNombre')).focus();
  }

  function cerrarPerfil(){ $('veloPerfil').hidden = true; }

  async function guardarPerfil(){
    const campo = $('pNombre').closest('.campo');
    const hueco = campo.querySelector('.error');
    if(!$('pNombre').value.trim()){
      campo.classList.add('mal');
      hueco.textContent = 'Hace falta: es lo que sale firmando la hoja.';
      $('pNombre').focus();
      return;
    }
    campo.classList.remove('mal'); hueco.textContent = '';

    const boton = $('guardarPerfil');
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{
      /* PUT y no PATCH: Supabase Auth solo atiende GET y PUT en /user, y a
         PATCH le contesta 405. Con eso, «Mis datos» no llegó a guardar nunca,
         y el aviso mandaba a revisar la conexión, que estaba bien. */
      const r = await pedir('/auth/v1/user', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({data: {
          nombre:   $('pNombre').value.trim(),
          cargo:    $('pCargo').value.trim(),
          cedula:   $('pCedula').value.trim(),
          telefono: $('pTelefono').value.trim(),
        }}),
      });
      const u = await r.json();
      /* Vuelven dentro de user_metadata, que es donde los acaba de dejar el
         PUT de arriba. Leerlos sueltos guardaba la sesión en blanco aunque el
         guardado hubiera ido bien. */
      const d = u.user_metadata || {};
      /* la sesión guardada tiene que reflejarlo ya, o el recuadro del técnico
         seguiría diciendo lo viejo hasta el próximo inicio de sesión */
      const s = sesion();
      guardarSesion(Object.assign({}, s, {
        nombre: d.nombre || '', cargo: d.cargo || '',
        cedula: d.cedula || '', telefono: d.telefono || '',
      }));
      cerrarPerfil();
      /* si hay una ficha abierta y el técnico era yo, se repinta con lo nuevo */
      if(abierta && tecnicoFicha && !tecnicoFicha.manual){
        tecnicoFicha = resolverTecnico(abierta);
        pintarFicha();
      }
    }catch(err){
      console.error('No se pudieron guardar los datos:', err);
      $('avisoPerfil').innerHTML = '<span>⚠</span><div><b>No se pudo guardar.</b> ' +
        'Revisa la conexión y vuelve a intentar.</div>';
      $('avisoPerfil').hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Guardar';
  }

  $('botonMisDatos').addEventListener('click', e => { e.preventDefault(); abrirPerfil(); });
  $('cerrarPerfil').addEventListener('click', cerrarPerfil);
  $('cancelarPerfil').addEventListener('click', cerrarPerfil);
  $('guardarPerfil').addEventListener('click', guardarPerfil);
  $('veloPerfil').addEventListener('click', e => { if(e.target === $('veloPerfil')) cerrarPerfil(); });

  /* ================= recuperar la contraseña ================= */
  function abrirOlvido(){
    $('avisoOlvido').hidden = true;
    $('avisoOlvidoOk').hidden = true;
    /* si ya había escrito el correo abajo, se lo ahorra aquí */
    $('oCorreo').value = $('correo').value.trim();
    $('veloOlvido').hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('oCorreo').focus());
  }
  function cerrarOlvido(){
    $('veloOlvido').hidden = true;
    document.body.style.overflow = '';
  }

  $('botonOlvido').addEventListener('click', e => { e.preventDefault(); abrirOlvido(); });
  $('cerrarOlvido').addEventListener('click', cerrarOlvido);
  $('cancelarOlvido').addEventListener('click', cerrarOlvido);
  $('veloOlvido').addEventListener('click', e => { if(e.target === $('veloOlvido')) cerrarOlvido(); });

  $('botonEnviarOlvido').addEventListener('click', async () => {
    const avisoMal = $('avisoOlvido'), avisoOk = $('avisoOlvidoOk');
    avisoMal.hidden = true; avisoOk.hidden = true;
    const correo = $('oCorreo').value.trim();
    if(!correo || !correo.includes('@')){
      avisoMal.textContent = 'Escribe un correo válido.';
      avisoMal.hidden = false;
      return;
    }
    const boton = $('botonEnviarOlvido');
    boton.disabled = true; boton.textContent = 'Enviando…';
    try{
      /* redirect_to y no el body: es GoTrue quien decide adónde manda de
         vuelta el enlace del correo, y lo lee de la query, no del JSON. Se
         manda a esta misma página —protocolo, dominio y ruta, sin el
         hash— para que el testigo de arriba lo encuentre al volver. */
      const destino = location.origin + location.pathname;
      const r = await fetch(B.url + '/auth/v1/recover?redirect_to=' + encodeURIComponent(destino), {
        method: 'POST',
        headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
        body: JSON.stringify({email: correo}),
      });
      if(!r.ok){
        const cuerpo = await r.json().catch(() => ({}));
        const original = cuerpo.msg || cuerpo.error_description || ('HTTP ' + r.status);
        throw new Error(traducirErrorAuth(original) || 'No se pudo enviar el correo. Intenta de nuevo en un momento.');
      }
      /* Supabase contesta 200 exista o no esa cuenta —para no delatar quién
         tiene cuenta y quién no—, así que el aviso es el mismo en los dos
         casos a propósito: que no llegue nada no es un error de aquí. */
      avisoOk.textContent = 'Si esa cuenta existe, le llega un correo con el enlace en un momento.';
      avisoOk.hidden = false;
    }catch(err){
      avisoMal.textContent = err.message;
      avisoMal.hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Enviar enlace';
  });

  /* ---------- la ventana que se abre sola al volver del correo ---------- */
  function abrirNuevaClave(){
    $('avisoNuevaClave').hidden = true;
    $('ncClave').value = ''; $('ncClave2').value = '';
    $('veloNuevaClave').hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('ncClave').focus());
  }
  function cerrarNuevaClave(){
    $('veloNuevaClave').hidden = true;
    document.body.style.overflow = '';
    /* el testigo es de un solo uso; si esta persona cancela y vuelve a
       necesitarlo, que pida un enlace nuevo en vez de reintentar este */
    testigoRecuperacion = null;
  }
  $('cancelarNuevaClave').addEventListener('click', () => { cerrarNuevaClave(); mostrarAcceso(); });

  $('guardarNuevaClave').addEventListener('click', async () => {
    const aviso = $('avisoNuevaClave');
    aviso.hidden = true;
    const c1 = $('ncClave').value, c2 = $('ncClave2').value;
    if(!c1 || c1.length < 6){
      aviso.textContent = 'La contraseña necesita al menos 6 caracteres.';
      aviso.hidden = false;
      return;
    }
    if(c1 !== c2){
      aviso.textContent = 'Las dos casillas no coinciden.';
      aviso.hidden = false;
      return;
    }
    const boton = $('guardarNuevaClave');
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{
      /* El testigo del enlace hace de Authorization aquí: no hay sesión
         guardada todavía —esta visita empieza en el correo, no en el
         formulario de entrar—, así que pedir() no sirve, y se llama a
         /auth/v1/user directo, igual que hace pedir() por dentro. */
      const r = await fetch(B.url + '/auth/v1/user', {
        method: 'PUT',
        headers: Object.assign({'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + testigoRecuperacion}, soporteCabeceras()),
        body: JSON.stringify({password: c1}),
      });
      if(!r.ok){
        const cuerpo = await r.json().catch(() => ({}));
        const original = cuerpo.msg || cuerpo.error_description || ('HTTP ' + r.status);
        throw new Error(traducirErrorAuth(original) || 'No se pudo guardar la contraseña. Intenta de nuevo en un momento.');
      }
      cerrarNuevaClave();
      /* El enlace no deja una sesión abierta en la bandeja —a propósito:
         iniciar sesión así se saltaría el candado de "¿esto es GGTIC?"—,
         así que se manda a la pantalla de entrar de siempre, con la clave
         recién puesta lista para usar ahí. */
      mostrarAcceso();
      const avisoAcceso = $('avisoAcceso');
      avisoAcceso.className = 'aviso bueno';
      avisoAcceso.innerHTML = '<span>✓</span><div>Contraseña puesta. Entra con la nueva.</div>';
      avisoAcceso.hidden = false;
    }catch(err){
      aviso.textContent = err.message;
      aviso.hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Guardar';
  });

  /* ================= gestos ================= */
  $('formAcceso').addEventListener('submit', async e => {
    e.preventDefault();
    const boton = $('botonEntrar'), aviso = $('avisoAcceso');
    aviso.hidden = true;
    /* por si quedó en verde: el aviso de "contraseña puesta" que deja la
       recuperación usa esta misma caja */
    aviso.className = 'aviso malo';
    boton.disabled = true; boton.textContent = 'Entrando…';
    try{
      await entrar($('correo').value.trim(), $('clave').value);
      mostrarBandeja();
      pintarAdmin();
      await cargar();
      cargarGuias();
      inventarioTraer().then(() => { if(!$('velo').hidden) pintarFicha(); });
      if(soyAdmin){ cargarCuentas(); cargarCorreos(); }
      vigilar();
      /* La trazabilidad no espera por esto: quien entra no tiene por qué
         notarlo, y si falla —sin red, la migración 15 sin correr todavía—
         entrar sigue funcionando igual que antes de que existiera esto. */
      pedir('/rest/v1/rpc/registrar_acceso', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
        .catch(e => console.warn('No se pudo anotar el acceso:', e));
    }catch(err){
      /* A esta persona no le falta la clave, le falta el papel. Decirle 'no se
         pudo entrar' la dejaría probando contraseñas que sí son correctas. */
      if(err.noEsDeSoporte){ avisarQueNoEsDeSoporte(); }
      else{
        aviso.innerHTML = '<span>⚠</span><div>No se pudo entrar: ' + esc(err.message) + '</div>';
        aviso.hidden = false;
      }
    }
    boton.disabled = false; boton.textContent = 'Entrar';
  });

  $('botonSalir').addEventListener('click', e => {
    e.preventDefault();
    /* que el servidor lo anule también: borrarlo solo aquí dejaba el testigo
       vivo hasta cumplir su hora */
    const s = sesion();
    if(s && s.token && !enPrueba){
      fetch(B.url + '/auth/v1/logout', {method: 'POST',
        headers: Object.assign({'Authorization': 'Bearer ' + s.token}, soporteCabeceras())})
        .catch(() => {});
    }
    borrarSesion();
    /* y que se calle el reloj: sin sesión, cada turno suyo sería una pregunta
       que el servidor rebota con un 401 */
    dejarDeVigilar();
    solicitudes = [];
    /* Y lo que se trajo, que no se queda esperando al siguiente: la lista de
       cuentas es de quien acaba de salir, no del que venga. */
    cuentas = [];
    /* quien entre después empieza de cero: si no, la primera carga del
       siguiente turno anunciaría como "recién llegado" todo lo del anterior */
    conocidas = null; recien.clear(); leido();
    mostrarAcceso();
  });

  /* ---------- los gestos de la ventana del aviso ----------
     Se atienden desde el velo porque la ventana se repinta entera cada vez que
     entra otra solicitud, y unos escuchas fijos aquí sobreviven a eso. */
  $('veloNueva').addEventListener('click', async e => {
    const s = nuevasEnCola[0];
    if(e.target === $('veloNueva')) return cerrarNueva();
    if(e.target.id === 'nuevaDespues') return cerrarNueva();
    if(e.target.id === 'nuevaVer'){
      if(s){ cerrarNueva(true); abrir(s.id); }
      return;
    }
    if(e.target.id === 'nuevaTomar'){
      if(!s) return;
      const boton = e.target;
      /* La misma vía que el botón de la fila: queda a nombre de quien la toma
         y en proceso. Si falla, la ventana se queda para volver a intentar. */
      const fila = $('lista').querySelector('.fila[data-id="' + s.id + '"] [data-accion]');
      await accionRapida(s.id, 'en_proceso', fila || boton);
      cerrarNueva();
    }
  });


  $('buscar').addEventListener('input', e => { busqueda = e.target.value; pintar(); });
  $('botonRecargar').addEventListener('click', () => cargar().catch(e => console.error(e)));

  $('fichas').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if(!b) return;
    filtro = b.dataset.filtro;
    pintar();
  });

  /* Tomar o cerrar desde la fila. Al tomarla queda a nombre de quien la toma,
     que es lo que uno espera de "tomar": si no, dos técnicos podrían estar en
     lo mismo sin saberlo. */
  async function accionRapida(id, estado, boton){
    const s = solicitudes.find(x => x.id === id);
    if(!s) return;
    recien.delete(id);
    const yo = yoTecnico();
    const cambios = {estado};
    if(!s.tecnico && yo.nombre){
      cambios.tecnico = yo.nombre;
      cambios.tecnico_cargo = yo.cargo || null;
      cambios.tecnico_cedula = yo.cedula || null;
      cambios.tecnico_telefono = yo.telefono || null;
    }
    if(estado === 'atendida') cambios.atendida_en = s.atendida_en || new Date().toISOString();

    boton.disabled = true;
    boton.textContent = estado === 'atendida' ? 'Cerrando…' : 'Tomando…';
    try{
      const guardada = await guardarCambios(id, cambios);
      const i = solicitudes.findIndex(x => x.id === id);
      if(i >= 0) solicitudes[i] = guardada;
      pintar();
      /* Solo cerrar abre la ficha. Tomar es un gesto de paso —marcar que uno se
         hace cargo mientras recorre la cola— y abrirle una ventana encima corta
         ese recorrido; si hace falta ver el detalle, la fila se abre sola con
         un clic. Al cerrar es distinto: ahí la Hoja de Servicio ya está
         completa —observaciones, técnico, renglones— y es el momento de
         imprimirla para el archivo. */
      if(estado === 'atendida'){
        abrir(id);
        /* Los botones son lo último de la ficha, así que llevar el velo al
           fondo los deja a la vista. Se hace sobre el contenedor que de verdad
           rueda —el velo— en vez de pedirle al botón que se acerque: dentro de
           una ventana emergente, scrollIntoView no siempre encuentra a quién
           mover. */
        /* Sin animar: la ficha acaba de aparecer, así que no hay un "antes"
           del que mover a nadie, y un desplazamiento suave sobre algo recién
           pintado a veces no llega a ejecutarse. */
        requestAnimationFrame(() => {
          const velo = $('velo');
          velo.scrollTop = velo.scrollHeight;
        });
      }
    }catch(err){
      console.error('No se pudo ' + estado + ':', err);
      boton.disabled = false;
      boton.textContent = estado === 'atendida' ? 'Cerrar' : 'Tomar';
      alert('No se pudo guardar el cambio. Revisa la conexión y vuelve a intentar.');
    }
  }

  $('lista').addEventListener('click', e => {
    /* el globo abre la conversación, no la ficha */
    const globo = e.target.closest('[data-chat]');
    if(globo){ e.stopPropagation(); abrirChat(globo.dataset.chat); return; }

    /* bajar el PDF tampoco es abrir la solicitud: el enlace es del navegador */
    if(e.target.closest('a[download]')) return;

    /* los botones de la fila no cuentan como "abrir la solicitud" */
    const accion = e.target.closest('[data-accion]');
    if(accion){
      e.stopPropagation();
      accionRapida(accion.dataset.id, accion.dataset.accion, accion);
      return;
    }
    const fila = e.target.closest('.fila');
    if(fila) abrir(fila.dataset.id);
  });

  /* Todo lo de la ficha se atiende desde el velo: la ficha se repinta entera y
     unos escuchas fijos aquí sobreviven a esos repintados. */
  $('velo').addEventListener('click', e => {
    if(e.target === $('velo')) return cerrar();
    if(e.target.id === 'botonCerrarFicha') return cerrar();
    if(e.target.id === 'botonGuardar') return guardar();
    if(e.target.id === 'botonImprimir') return imprimir();

    /* el atajo del recuadro cuando a la cuenta le faltan cargo o cédula */
    if(e.target.id === 'botonCompletarDatos'){ abrirPerfil(); return; }

    /* Pasar de un caso resuelto a una guía. Se lleva lo que hay escrito ahora
       mismo en observaciones, no lo último guardado: si el técnico acaba de
       escribir cómo lo resolvió, es justo eso lo que vale la pena guardar. */
    const inv = e.target.closest('[data-inv]');
    if(inv){ abrirEquipo(inv.dataset.inv); return; }

    if(e.target.id === 'botonAGuia'){
      const s = abierta;
      abrirGuia(null, {
        titulo: String(s.descripcion || '').trim().slice(0, 120),
        cuerpo: $('fObs').value.trim(),
        categoria: s.detalle || 'General',
        origen: String(s.numero).padStart(3, '0') + '-' + s.anio,
      });
      return;
    }

    /* una guía de las que salen en la ficha, para corregirla ahí mismo */
    const editar = e.target.closest('[data-editar]');
    if(editar){ abrirGuia(guias.find(g => g.id === editar.dataset.editar)); return; }

    /* el globo de la ficha abre la conversación encima de ella */
    const globo = e.target.closest('[data-chat]');
    if(globo){ abrirChat(globo.dataset.chat); return; }

    /* las tres etapas: mueven el campo oculto que lee guardar() */
    const etapa = e.target.closest('#segmEstado [data-estado]');
    if(etapa){
      $('fEstado').value = etapa.dataset.estado;
      $('segmEstado').querySelectorAll('[data-estado]').forEach(b => {
        const on = b === etapa;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      return;
    }
    if(e.target.id === 'botonAnular'){
      if(!confirm('¿Anular esta solicitud? Quien la pidió verá que fue anulada.')) return;
      $('fEstado').value = 'anulada';
      $('segmEstado').querySelectorAll('[data-estado]').forEach(b => {
        b.classList.remove('on'); b.setAttribute('aria-pressed', 'false');
      });
      e.target.textContent = 'Quedará anulada al guardar';
      e.target.disabled = true;
      return;
    }

    /* "Es otro": deja de confirmarse a sí mismo y escribe el nombre de quien
       de verdad atendió. Sin cargo ni cédula, porque no son suyos. */
    if(e.target.id === 'botonOtroTecnico'){
      $('tecnicoRecuadro').hidden = true;
      $('tecnicoManual').hidden = false;
      $('fTecnicoManual').value = '';
      $('fTecnicoManual').focus();
      return;
    }

    if(e.target.id === 'botonAgregar'){
      abierta.renglones = leerRenglones();
      if(abierta.renglones.length < 6){
        abierta.renglones.push({tipo:'', detalle:'', equipo:'', marca:'', modelo:'', serial:''});
        pintarFicha();
      }
      return;
    }
    const quitar = e.target.closest('[data-quitar]');
    if(quitar){
      const i = +quitar.dataset.quitar;
      const actuales = [...document.querySelectorAll('#renglones .renglon')].map(caja => {
        const r = {};
        caja.querySelectorAll('[data-campo]').forEach(el => { r[el.dataset.campo] = el.value.trim(); });
        return r;
      });
      actuales.splice(i, 1);
      abierta.renglones = actuales.length ? actuales
        : [{tipo:'', detalle:'', equipo:'', marca:'', modelo:'', serial:''}];
      pintarFicha();
    }
  });

  /* El detalle de un renglón cuelga de su tipo, igual que en el formulario. */
  $('velo').addEventListener('change', e => {
    if(e.target.dataset && e.target.dataset.campo === 'tipo'){
      const caja = e.target.closest('.renglon');
      const sel = caja.querySelector('[data-campo="detalle"]');
      const detalles = catDetallesDe(e.target.value);
      sel.innerHTML = '<option value="">—</option>' + opcionesHtml(detalles, '');
      sel.disabled = !detalles.length;
    }
  });

  /* ---- la ventana del chat ---- */
  $('cerrarChat').addEventListener('click', cerrarChat);
  $('veloChat').addEventListener('click', e => {
    if(e.target === $('veloChat')) return cerrarChat();
    if(e.target.id === 'chatEnviar') enviarMensaje();
  });
  /* Enter envía, Mayús+Enter hace línea nueva: lo que se espera de un chat. */
  $('veloChat').addEventListener('keydown', e => {
    if(e.target.id !== 'chatTexto') return;
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      if(!$('chatEnviar').disabled) enviarMensaje();
    }
  });

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    /* el de encima primero: el aviso va sobre todo, y el chat sobre la ficha */
    if(!$('veloEquipo').hidden) cerrarEquipo();
    else if(!$('veloGuia').hidden) cerrarGuia();
    else if(!$('veloNueva').hidden) cerrarNueva();
    else if(!$('veloChat').hidden) cerrarChat();
    else if(!$('veloPerfil').hidden) cerrarPerfil();
    else if(!$('velo').hidden) cerrar();
  });

  /* Vaciar el ensayo: solo existe en modo prueba, donde no hay nada real que
     perder. Con servidor de verdad este botón no se pinta. */
  function vaciarPrueba(){
    if(!enPrueba) return;
    if(!confirm('Se borran las solicitudes de ensayo de este navegador. ¿Seguimos?')) return;
    soporteLocal.vaciar();
    solicitudes = [];
    pintar();
  }

  /* ================= arranque ================= */
  (async function(){
    /* Va antes que todo lo demás: si se vuelve del correo con el testigo de
       recuperación puesto, eso manda sin importar si ya había una sesión
       guardada en este navegador o si el modo es de ensayo. */
    if(testigoRecuperacion){
      mostrarAcceso();
      abrirNuevaClave();
      return;
    }
    if(enlaceRecuperacionVencido){
      mostrarAcceso();
      abrirOlvido();
      $('avisoOlvido').textContent =
        'Ese enlace venció o ya se usó una vez —a veces el propio correo de la ' +
        'casa lo abre solo para revisarlo antes de que lo pinches—. Pide uno nuevo.';
      $('avisoOlvido').hidden = false;
      return;
    }
    if(enPrueba){
      /* Sin servidor no hay a quién pedirle una clave: se entra directo, con el
         cartel bien visible de que esto es un ensayo. */
      $('avisoSinServidor').hidden = false;
      $('botonSalir').hidden = true;
      const botonVaciar = document.createElement('button');
      botonVaciar.type = 'button';
      botonVaciar.className = 'boton plano chico';
      botonVaciar.textContent = 'Vaciar el ensayo';
      botonVaciar.addEventListener('click', vaciarPrueba);
      $('botonRecargar').after(botonVaciar);
      mostrarBandeja();
      await cargar();
      return;
    }
    if(!sesion()){ mostrarAcceso(); return; }
    /* La sesión guardada puede ser de quien ya no es de GGTIC —o de quien nunca
       lo fue—, así que se pregunta antes de pintar nada. Si la pregunta no se
       puede hacer, se sigue adelante: las políticas de la base mandan igual, y
       dejar fuera a un técnico por un tropiezo de red es peor que enseñarle una
       bandeja que no va a cargar. */
    try{
      if(!(await esDeSoporte())){
        borrarSesion();
        mostrarAcceso();
        avisarQueNoEsDeSoporte();
        return;
      }
      soyAdmin = await esAdministrador();
    }catch(err){ console.warn('No se pudo comprobar si la cuenta es de GGTIC:', err); }
    mostrarBandeja();
    pintarAdmin();
    try{
      await cargar(); cargarGuias(); inventarioTraer();
      if(soyAdmin){ cargarCuentas(); cargarCorreos(); }
      vigilar();
    }
    catch(err){ console.error('No se pudo cargar la bandeja:', err); }
  })();
})();
