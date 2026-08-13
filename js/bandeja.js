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
    return {
      token: datos.access_token,
      refresco: datos.refresh_token,
      /* un minuto de margen: más vale refrescar de sobra que fallar justo al vencer */
      expira: Date.now() + ((datos.expires_in || 3600) - 60) * 1000,
      correo: u.email || '',
      /* quién es, para no volver a escribirlo en cada solicitud que atienda */
      nombre: u.nombre || '',
      cargo: u.cargo || '',
      cedula: u.cedula || '',
      telefono: u.telefono || '',
    };
  }

  /* El técnico que atiende, tomado de la sesión. Contra Supabase no vienen
     estos datos —allí las cuentas solo tienen correo—, así que se cae al
     correo y el resto queda para escribir a mano. */
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
    return s;
  }

  async function refrescar(){
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
    if(s && s.expira && Date.now() > s.expira) s = (await refrescar()) || s;
    if(!s){ mostrarAcceso(); throw new Error('Sin sesión'); }

    opts = opts || {};
    const r = await fetch(B.url + ruta, Object.assign({}, opts, {
      headers: Object.assign({'Authorization': 'Bearer ' + s.token},
                             soporteCabeceras(), opts.headers || {}),
    }));

    if((r.status === 401 || r.status === 403) && !reintento){
      if(await refrescar()) return pedir(ruta, opts, true);
      borrarSesion(); mostrarAcceso();
      throw new Error('La sesión venció');
    }
    if(!r.ok){
      const cuerpo = await r.text().catch(() => '');
      throw new Error('HTTP ' + r.status + (cuerpo ? ' · ' + cuerpo.slice(0, 300) : ''));
    }
    return r;
  }

  /* ================= pantallas ================= */
  function mostrarAcceso(){
    $('pantallaAcceso').hidden = false;
    $('pantallaBandeja').hidden = true;
    $('cabDerecha').hidden = true;
  }
  function mostrarBandeja(){
    $('pantallaAcceso').hidden = true;
    $('pantallaBandeja').hidden = false;
    $('cabDerecha').hidden = false;
    /* volver a la cola cierra las estadísticas: nunca las dos a la vez */
    const st = $('panelStats');
    if(st){ st.hidden = true; $('botonStats').textContent = 'Estadísticas'; }
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
  const LLAVE_AVISOS = 'soporte_avisos';
  const TITULO = document.title;

  let conocidas = null;    /* null = todavía no se ha cargado nada */
  let sinLeer = 0;         /* llegadas mientras la pestaña no se mira */
  const recien = new Set();/* las que están marcadas en la cola */

  const avisosEncendidos = () => localStorage.getItem(LLAVE_AVISOS) !== 'no';

  /* La notificación del sistema solo existe en "contexto seguro": localhost o
     https. Por la red de la oficina se entra por http://192.168…, donde el
     navegador no la ofrece; ahí quedan el sonido, el cartel y el título, que no
     dependen de permiso de nadie. */
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
    if(!avisosEncendidos() || !hayNotificaciones() || Notification.permission !== 'granted') return;
    try{
      const n = new Notification('Llegó una solicitud · N° ' + String(s.numero).padStart(3,'0'), {
        body: s.usuario + '\n' + (s.descripcion || ''),
        icon: 'assets/logo_ciip.png',
        tag: 'solicitud-' + s.id,   /* si llega dos veces el mismo aviso, no se duplica */
      });
      n.onclick = () => { window.focus(); leido(); irA(s.id); n.close(); };
    }catch(e){}
  }

  /* El cartel de la esquina. Es un botón: llevar a la solicitud es lo que uno
     quiere hacer al verlo. */
  function cartel(s){
    const caja = $('avisos');
    if(!caja) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'push';
    el.innerHTML =
      '<div class="push-tit"><span class="punto"></span>Llegó una solicitud</div>' +
      '<div class="push-num">N° ' + String(s.numero).padStart(3,'0') + '-' + esc(String(s.anio)) +
      ' · ' + esc(s.usuario) + '</div>' +
      '<div class="push-que">' + esc(s.descripcion) + '</div>';
    el.addEventListener('click', () => { irA(s.id); quitar(); });
    caja.prepend(el);
    while(caja.children.length > 3) caja.lastElementChild.remove();

    let ido = false;
    function quitar(){
      if(ido) return; ido = true;
      el.classList.add('yendose');
      setTimeout(() => el.remove(), 320);
    }
    setTimeout(quitar, 14000);
  }

  /* Colocar la pantalla en una solicitud: lo que haga falta para que se vea. */
  function irA(id){
    if($('panelStats') && !$('panelStats').hidden) verStats(false);
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
    if(avisosEncendidos()) sonar();
    /* del más viejo al más nuevo, para que el último en entrar quede arriba */
    nuevas.slice().reverse().forEach(s => { cartel(s); notificar(s); });

    /* La cola se coloca sola, salvo que haya una ventana abierta encima:
       moverle el suelo a quien está escribiendo observaciones o conversando
       sería quitarle lo que hace. El cartel igual se ve, y la marca en la fila
       lo espera. */
    const hayVentana = !$('velo').hidden || !$('veloPerfil').hidden || !$('veloChat').hidden;
    if(!hayVentana) irA(nuevas[0].id);

    /* la marca dura lo que dura la sorpresa */
    setTimeout(() => {
      nuevas.forEach(s => recien.delete(s.id));
      if(!$('pantallaBandeja').hidden) pintar();
    }, 30000);
  }

  function pintarBotonAvisos(){
    const b = $('botonAvisos');
    if(!b) return;
    const on = avisosEncendidos();
    b.textContent = on ? 'Avisos' : 'Avisos: en silencio';
    b.classList.toggle('apagado', !on);
    b.title = on
      ? 'Suena y avisa cuando entra una solicitud. Clic para silenciarlo.'
      : 'Silenciado: las solicitudes siguen llegando, pero sin sonido. Clic para encenderlo.';
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

  function pintarStats(){
    const hoy = new Date();
    const esteMes = s => {
      const d = new Date(s.creada_en);
      return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
    };
    const delMes = solicitudes.filter(esteMes);
    const abiertas = solicitudes.filter(s => ['recibida','en_proceso'].includes(s.estado));
    const atendidasMes = delMes.filter(s => s.estado === 'atendida');
    const t = tiempoMedio(solicitudes);

    const mes = hoy.toLocaleDateString('es-VE', {month: 'long', year: 'numeric'});
    $('statsPeriodo').textContent = 'Todo lo que ha entrado, con el detalle de ' + mes + '.';

    const tiempo = !t ? '—'
      : t.horas < 1 ? Math.round(t.horas * 60) + '<small>min</small>'
      : t.horas < 48 ? t.horas.toFixed(1).replace('.', ',') + '<small>h</small>'
      : (t.horas / 24).toFixed(1).replace('.', ',') + '<small>días</small>';

    $('statsKpis').innerHTML = `
      <div class="kpi ${abiertas.length ? 'urge' : ''}">
        <div class="r">Sin resolver</div>
        <div class="v">${abiertas.length}</div>
        <div class="s">${abiertas.filter(s => s.estado === 'en_proceso').length} ya en proceso</div>
      </div>
      <div class="kpi">
        <div class="r">Entraron en ${esc(mes.split(' ')[0])}</div>
        <div class="v">${delMes.length}</div>
        <div class="s">${atendidasMes.length} ya resueltas</div>
      </div>
      <div class="kpi">
        <div class="r">Tiempo medio</div>
        <div class="v">${tiempo}</div>
        <div class="s">${t ? 'sobre ' + t.sobre + ' resueltas' : 'aún sin resolver ninguna'}</div>
      </div>
      <div class="kpi">
        <div class="r">Desde el principio</div>
        <div class="v">${solicitudes.length}</div>
        <div class="s">${solicitudes.filter(s => s.estado === 'atendida').length} resueltas en total</div>
      </div>`;

    $('statsBarras').innerHTML =
      barrasHtml('Lo que más se pide', 'Por detalle de servicio',
        contar(solicitudes, s => s.detalle || (s.tipo ? catTipoEtiqueta(s.tipo) : 'Sin clasificar'), 6)) +
      barrasHtml('De qué gerencia vienen', 'Quién pide más soporte',
        contar(solicitudes, s => s.gerencia, 6)) +
      barrasHtml('En qué piso', 'Dónde está el trabajo',
        contar(solicitudes, s => s.piso ? 'Piso ' + s.piso : null, 6)) +
      barrasHtml('Quién atiende', 'Solicitudes cerradas por técnico',
        contar(solicitudes.filter(s => s.estado === 'atendida'), s => s.tecnico, 6));
  }

  function verStats(si){
    $('panelStats').hidden = !si;
    $('pantallaBandeja').hidden = si;
    /* el enlace dice a dónde lleva, no dónde estás */
    $('botonStats').textContent = si ? 'Ver la cola' : 'Estadísticas';
    if(si) pintarStats();
  }

  $('botonStats').addEventListener('click', e => {
    e.preventDefault();
    verStats($('panelStats').hidden);
  });

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

  /* El botón que abre la conversación. Va en la fila y en la ficha; los dos
     abren la misma ventana, para que no haya dos sitios donde hablar. */
  function chatBotonHtml(s){
    if(s.estado === 'anulada') return '';
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
            `<div class="texto">${esc(m.texto)}</div>` +
            `<div class="hora">${esc(hora(m.en))}</div>` +
          `</div>`).join('')
          : `<div class="chat-vacio">Puedes escribirle para pedirle un dato,
             avisarle a qué hora subes, o decirle que ya quedó.</div>`}
      </div>
      <div class="chat-escribir">
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
    if(!texto || !chatId){ caja.focus(); return; }
    boton.disabled = true; caja.disabled = true;
    try{
      const r = await pedir('/rest/v1/rpc/enviar_mensaje', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: chatId, texto}),
      });
      const nuevo = (await r.json())[0];
      /* Se vacía ANTES de repintar. pintarChat conserva lo que haya escrito
         —para no borrarlo cuando entra un mensaje del otro lado— así que si no
         se vacía aquí, devuelve el texto que acaba de enviarse. */
      caja.value = '';
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

      <div class="seccion">Renglones de equipo</div>
      <div id="renglones">${s.renglones.map(renglonHtml).join('')}</div>
      <button type="button" class="boton plano chico" id="botonAgregar"
        ${s.renglones.length >= 6 ? 'disabled' : ''}>+ Agregar renglón</button>

      <div class="aviso malo" id="avisoFicha" hidden style="margin:18px 0 0"></div>

      <div class="botones">
        <button type="button" class="boton primario" id="botonGuardar">Guardar</button>
        <button type="button" class="boton plano" id="botonImprimir">Imprimir Hoja de Servicio</button>
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
    const s = abierta;
    const tec = tecnicoActual();
    const renglones = leerRenglones();
    const f = new Date();
    const RENGLONES_HOJA = 6;   /* la tabla del Excel siempre tuvo seis filas */

    const filas = Array.from({length: RENGLONES_HOJA}, (_, i) => {
      const r = renglones[i] || {};
      return `<tr>
        <td style="text-align:center">${i+1}</td>
        <td>${esc(r.tipo||'')}</td><td>${esc(r.detalle||'')}</td>
        <td>${esc(r.equipo||'')}</td><td>${esc(r.marca||'')}</td>
        <td>${esc(r.modelo||'')}</td><td>${esc(r.serial||'')}</td>
      </tr>`;
    }).join('');

    $('impresion').innerHTML = `<div class="hs">
      <div class="hs-cab">
        <img src="assets/logo_ciip_navy.png" alt="CIIP">
        <div class="hs-n">N° GTIC-HS/<b>${String(s.numero).padStart(3,'0')}-${esc(String(s.anio))}</b>
          <div>${String(f.getDate()).padStart(2,'0')}/${String(f.getMonth()+1).padStart(2,'0')}/${f.getFullYear()}</div>
        </div>
      </div>

      <h1>HOJA DE SERVICIO</h1>

      <table>
        <tr><th colspan="6">GERENCIA SOLICITANTE:</th></tr>
        <tr><td colspan="6" style="text-align:center; font-weight:bold">${esc(s.gerencia)}</td></tr>
        <tr>
          <th>USUARIO:</th><th>C.I.</th><th>TELEF.</th><th>PISO:</th><th colspan="2">OFICINA:</th>
        </tr>
        <tr>
          <td>${esc(s.usuario)}</td><td>${esc(s.cedula||'S/N')}</td><td>${esc(s.telefono||'S/N')}</td>
          <td style="text-align:center">${esc(s.piso)}</td><td colspan="2" style="text-align:center">${esc(s.oficina)}</td>
        </tr>
      </table>

      <div class="hs-titulo">RESUMEN DE LA SOLICITUD</div>
      <div class="hs-titulo" style="border-top:none">DESCRIPCION DE LA SITUACION PLANTEADA POR EL USUARIO</div>
      <div class="hs-caja">${esc(s.descripcion)}</div>

      <table>
        <tr>
          <th style="width:4%">ITEM</th><th style="width:14%">TIPO DE SERVICIO</th>
          <th style="width:32%">DETALLE DE SERVICIO</th><th style="width:12%">EQUIPO</th>
          <th style="width:10%">MARCA</th><th style="width:12%">MODELO</th><th style="width:16%">SERIAL</th>
        </tr>
        ${filas}
      </table>

      <div class="hs-titulo">OBSERVACIONES:</div>
      <div class="hs-caja">${esc($('fObs').value.trim())}</div>

      <div class="hs-nota">LA PRESENTE DEJA CONSTANCIA Y CONFORMIDAD DE LA ATENCION PRESTADA POR LA
      GERENCIA DE TECNOLOGIA DE LA INFORMACION Y COMUNICACIÓN.</div>

      <div class="hs-firmas">
        <div class="hs-bloque">
          <div class="hs-fh">DATOS DEL USUARIO</div>
          <div class="hs-fila">
            <div class="hs-fb">
              NOMBRE Y APELLIDO: ${esc(s.usuario)}<br>
              C.I. N°.: ${esc(s.cedula||'S/N')}<br>
              TELEFONO: ${esc(s.telefono||'S/N')}<br>
              CARGO: ${s.cargo ? esc(s.cargo) : '<span class="lin"></span>'}<br>
              FIRMA: <span class="lin"></span>
            </div>
            <div class="hs-sello">SELLO</div>
          </div>
        </div>
        <div class="hs-bloque">
          <div class="hs-fh">TECNICO DE SOPORTE</div>
          <div class="hs-fila">
            <div class="hs-fb">
              NOMBRE Y APELLIDO: ${esc(tec.nombre || '')}<br>
              C.I. N°.: ${tec.cedula ? esc(tec.cedula) : '<span class="lin"></span>'}<br>
              TELEFONO: ${tec.telefono ? esc(tec.telefono) : '<span class="lin"></span>'}<br>
              CARGO: ${tec.cargo ? esc(tec.cargo) : '<span class="lin"></span>'}<br>
              FIRMA: <span class="lin"></span>
            </div>
            <div class="hs-sello">SELLO</div>
          </div>
        </div>
      </div>
    </div>`;

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
      const r = await pedir('/auth/v1/user', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({data: {
          nombre:   $('pNombre').value.trim(),
          cargo:    $('pCargo').value.trim(),
          cedula:   $('pCedula').value.trim(),
          telefono: $('pTelefono').value.trim(),
        }}),
      });
      const u = await r.json();
      /* la sesión guardada tiene que reflejarlo ya, o el recuadro del técnico
         seguiría diciendo lo viejo hasta el próximo inicio de sesión */
      const s = sesion();
      guardarSesion(Object.assign({}, s, {
        nombre: u.nombre || '', cargo: u.cargo || '',
        cedula: u.cedula || '', telefono: u.telefono || '',
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
      pintarBotonAvisos();
      pedirPermiso();
      await cargar();
      escuchar();
    }catch(err){
      aviso.innerHTML = '<span>⚠</span><div>No se pudo entrar: ' + esc(err.message) + '</div>';
      aviso.hidden = false;
    }
    boton.disabled = false; boton.textContent = 'Entrar';
  });

  $('botonSalir').addEventListener('click', e => {
    e.preventDefault();
    borrarSesion();
    solicitudes = [];
    /* quien entre después empieza de cero: si no, la primera carga del
       siguiente turno anunciaría como "recién llegado" todo lo del anterior */
    conocidas = null; recien.clear(); leido();
    mostrarAcceso();
  });

  /* El interruptor del aviso. Silenciarlo apaga el sonido y la notificación de
     Windows; el cartel y la marca en la cola quedan, que son lo que no molesta
     a nadie en una oficina con gente al lado. */
  $('botonAvisos').addEventListener('click', e => {
    e.preventDefault();
    const encender = !avisosEncendidos();
    localStorage.setItem(LLAVE_AVISOS, encender ? 'si' : 'no');
    pintarBotonAvisos();
    if(encender) pedirPermiso();
  });

  /* Se pide al entrar, que es cuando la persona acaba de decir que viene a
     atender solicitudes. Si dice que no, no se vuelve a insistir: el navegador
     recuerda la respuesta y aquí no se pregunta de nuevo. */
  function pedirPermiso(){
    if(!avisosEncendidos() || !hayNotificaciones()) return;
    if(Notification.permission !== 'default') return;
    try{ Notification.requestPermission(); }catch(e){}
  }

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
    /* el de encima primero: el chat puede estar sobre la ficha */
    if(!$('veloChat').hidden) cerrarChat();
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
      pintarBotonAvisos();
      await cargar();
      return;
    }
    if(!sesion()){ mostrarAcceso(); return; }
    mostrarBandeja();
    pintarBotonAvisos();
    pedirPermiso();
    try{ await cargar(); escuchar(); }
    catch(err){ console.error('No se pudo cargar la bandeja:', err); }
  })();
})();
