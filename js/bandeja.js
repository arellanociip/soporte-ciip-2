/* ---------- La bandeja de GTIC ----------
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

  async function entrar(correo, clave){
    const r = await fetch(B.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
      body: JSON.stringify({email: correo, password: clave}),
    });
    if(!r.ok){
      const cuerpo = await r.json().catch(() => ({}));
      throw new Error(cuerpo.error_description || cuerpo.msg || ('HTTP ' + r.status));
    }
    const s = desdeRespuesta(await r.json());
    guardarSesion(s);
    /* Se comprueba aquí, pegado al guardado: si esta cuenta no es de GTIC,
       la sesión que acabamos de guardar no debe durar ni un instante. */
    if(!(await esDeSoporte())){
      borrarSesion();
      const e = new Error('Esta cuenta no es de GTIC.');
      e.noEsDeSoporte = true;
      throw e;
    }
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
    const r = await fetch(B.url + ruta, Object.assign({}, opts, {
      headers: Object.assign({'Authorization': 'Bearer ' + s.token},
                             soporteCabeceras(), opts.headers || {}),
    }));

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
     de GTIC no es una marca en el perfil —esa la cambia la propia persona con
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
     quien llega a la bandeja es de GTIC por definición. */
  async function esDeSoporte(){
    if(enPrueba || B.servidor !== 'supabase') return true;
    const r = await pedir('/rest/v1/rpc/es_gtic', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{}',
    });
    return (await r.json()) === true;
  }

  /* El mismo aviso en los dos sitios donde se puede rebotar a alguien: al
     entrar, y al llegar con una sesión ya guardada. */
  function avisarQueNoEsDeSoporte(){
    const aviso = $('avisoAcceso');
    aviso.innerHTML = '<span>⚠</span><div>Esta bandeja es de GTIC, y esta cuenta '
      + 'no lo es. Para pedir soporte, entra por <a href="index.html">la '
      + 'puerta</a>.</div>';
    aviso.hidden = false;
  }

  /* ================= pantallas ================= */
  function mostrarAcceso(){
    $('pantallaAcceso').hidden = false;
    $('pantallaBandeja').hidden = true;
    $('cabDerecha').hidden = true;
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
    if(abierto('panelStats') || abierto('panelSaber') || abierto('panelCuentas')) verPanel(null);
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

  const numeroDe = s => 'GTIC-HS/' + String(s.numero).padStart(3, '0') + '-' + s.anio;

  function fechaCorta(iso){
    if(!iso) return '';
    return new Date(iso).toLocaleDateString('es-VE', {day:'2-digit', month:'short', year:'numeric'});
  }

  function pintar(){
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
  const SIGLAS = new Set(['CPU','PC','PCS','RAM','IP','GTIC','CIIP','TIC','UPS','USB',
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
  ];

  function verPanel(cual){
    PANELES.forEach(p => {
      const caja = $(p.panel);
      if(!caja) return;
      const abierto = p.panel === cual;
      caja.hidden = !abierto;
      /* el enlace dice a dónde lleva, no dónde estás */
      $(p.boton).textContent = abierto ? 'Ver la cola' : p.texto;
      if(abierto) p.pinta();
    });
    $('pantallaBandeja').hidden = !!cual;
  }

  const abierto = cual => { const c = $(cual); return c && !c.hidden; };

  const verStats   = si => verPanel(si ? 'panelStats'   : null);
  const verSaber   = si => verPanel(si ? 'panelSaber'   : null);
  const verCuentas = si => verPanel(si ? 'panelCuentas' : null);

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
    return `<article class="guia${compacta ? ' chica' : ''}" data-guia="${esc(g.id)}">
      <div class="guia-h">
        <h3>${esc(g.titulo)}</h3>
        ${g.categoria ? `<span class="guia-cat">${esc(g.categoria)}</span>` : ''}
      </div>
      <div class="guia-cuerpo">${esc(g.cuerpo)}</div>
      <div class="guia-pie">${esc(g.autor || '')}${cuando ? ' · ' + esc(cuando) : ''}
        ${g.origen ? ' · de la N° ' + esc(g.origen) : ''}
        <button type="button" class="enlace" data-editar="${esc(g.id)}">Corregirla</button></div>
    </article>`;
  }

  function pintarGuias(){
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
     comprueba antes que quien llama sea de GTIC. Las dos hablan igual: mismos
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
        <span>${esc(u.correo)}</span>
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
        telefono: $('cTelefono').value.trim()};
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
  const ETAPAS_GTIC = ['recibida', 'en_proceso', 'atendida'];

  function estadoHtml(s){
    const anulada = s.estado === 'anulada';
    return `<input type="hidden" id="fEstado" value="${esc(s.estado)}">
      <div class="segm" id="segmEstado" role="group" aria-label="Estado de la solicitud">
        ${ETAPAS_GTIC.map(e => `<button type="button" data-estado="${e}"
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
     a la izquierda y lo de GTIC a la derecha. */
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

      <div class="seccion">Atención de GTIC</div>
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

  /* ================= gestos ================= */
  $('formAcceso').addEventListener('submit', async e => {
    e.preventDefault();
    const boton = $('botonEntrar'), aviso = $('avisoAcceso');
    aviso.hidden = true;
    boton.disabled = true; boton.textContent = 'Entrando…';
    try{
      await entrar($('correo').value.trim(), $('clave').value);
      mostrarBandeja();
      await cargar();
      cargarGuias();
      inventarioTraer().then(() => { if(!$('velo').hidden) pintarFicha(); });
      cargarCuentas();
      vigilar();
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
    /* La sesión guardada puede ser de quien ya no es de GTIC —o de quien nunca
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
    }catch(err){ console.warn('No se pudo comprobar si la cuenta es de GTIC:', err); }
    mostrarBandeja();
    try{ await cargar(); cargarGuias(); inventarioTraer(); cargarCuentas(); vigilar(); }
    catch(err){ console.error('No se pudo cargar la bandeja:', err); }
  })();
})();
