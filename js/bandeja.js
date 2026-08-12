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
  }

  /* ================= traer y pintar ================= */
  async function cargar(){
    if(enPrueba){
      solicitudes = soporteLocal.leer();
    }else{
      const r = await pedir('/rest/v1/solicitudes?select=*&order=creada_en.desc', {});
      solicitudes = await r.json();
    }
    pintar();
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
    return `<div class="fila" data-id="${esc(s.id)}">
      <div class="num">${String(s.numero).padStart(3,'0')}<small>${esc(String(s.anio))}</small></div>
      <div>
        <div class="quien">${esc(s.usuario)}</div>
        <div class="donde">${esc(s.gerencia)} · Piso ${esc(s.piso)}, of. ${esc(s.oficina)}</div>
        <div class="que">${esc(s.descripcion)}</div>
      </div>
      <div class="der">
        ${edadHtml(s)}
        <span class="etiqueta ${esc(s.estado)}">${esc(ESTADO_ETIQUETA[s.estado] || s.estado)}</span>
        ${accionesHtml(s)}
      </div>
    </div>`;
  }

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
        <span class="etiqueta ${esc(s.estado)}">${esc(ESTADO_ETIQUETA[s.estado] || s.estado)}</span></div>

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
              CARGO: <span class="lin"></span><br>
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
      await cargar();
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
    mostrarAcceso();
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
      /* Tomar una solicitud es el momento de ir a atenderla, y para eso hace
         falta la Hoja de Servicio impresa: se firma y se sella en el puesto.
         Así que la ficha se abre sola, con el botón de imprimir a mano.
         Cerrar no la abre: ahí ya se tiene la hoja y lo que se busca es
         despachar varias seguidas. */
      if(estado === 'en_proceso') abrir(id);
    }catch(err){
      console.error('No se pudo ' + estado + ':', err);
      boton.disabled = false;
      boton.textContent = estado === 'atendida' ? 'Cerrar' : 'Tomar';
      alert('No se pudo guardar el cambio. Revisa la conexión y vuelve a intentar.');
    }
  }

  $('lista').addEventListener('click', e => {
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

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    /* el de arriba primero: si están los dos abiertos, Escape cierra el de encima */
    if(!$('veloPerfil').hidden) cerrarPerfil();
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
    mostrarBandeja();
    try{ await cargar(); }
    catch(err){ console.error('No se pudo cargar la bandeja:', err); }
  })();
})();
