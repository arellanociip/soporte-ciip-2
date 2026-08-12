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
    return {
      token: datos.access_token,
      refresco: datos.refresh_token,
      /* un minuto de margen: más vale refrescar de sobra que fallar justo al vencer */
      expira: Date.now() + ((datos.expires_in || 3600) - 60) * 1000,
      correo: (datos.user && datos.user.email) || '',
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

  function filaHtml(s){
    return `<div class="fila" data-id="${esc(s.id)}">
      <div class="num">${String(s.numero).padStart(3,'0')}<small>${esc(String(s.anio))}</small></div>
      <div>
        <div class="quien">${esc(s.usuario)}</div>
        <div class="donde">${esc(s.gerencia)} · Piso ${esc(s.piso)}, of. ${esc(s.oficina)}</div>
        <div class="que">${esc(s.descripcion)}</div>
      </div>
      <div class="der">
        <span style="font-size:11.5px; color:var(--gray-soft)">${esc(fechaCorta(s.creada_en))}</span>
        <span class="etiqueta ${esc(s.estado)}">${esc(ESTADO_ETIQUETA[s.estado] || s.estado)}</span>
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
        <div class="campo c6"><label for="fEstado">Estado</label>
          <select id="fEstado">
            ${['recibida','en_proceso','atendida','anulada'].map(e =>
              `<option value="${e}" ${e===s.estado?'selected':''}>${esc(ESTADO_ETIQUETA[e])}</option>`).join('')}
          </select></div>
        <div class="campo c6"><label for="fTecnico">Técnico que atiende</label>
          <input type="text" id="fTecnico" value="${esc(s.tecnico||'')}" placeholder="Nombre y apellido"></div>
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

  async function guardar(){
    const cambios = {
      estado:        $('fEstado').value,
      tecnico:       $('fTecnico').value.trim() || null,
      observaciones: $('fObs').value.trim() || null,
      renglones:     leerRenglones(),
    };
    /* La fecha de atención la pone la primera vez que se marca atendida, y se
       borra si vuelve a abrirse el caso. */
    cambios.atendida_en = cambios.estado === 'atendida'
      ? (abierta.atendida_en || new Date().toISOString())
      : null;

    const boton = $('botonGuardar');
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{
      let guardada;
      if(enPrueba){
        guardada = soporteLocal.actualizar(abierta.id, cambios);
      }else{
        const r = await pedir('/rest/v1/solicitudes?id=eq.' + encodeURIComponent(abierta.id), {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json', 'Prefer': 'return=representation'},
          body: JSON.stringify(cambios),
        });
        const filas = await r.json();
        guardada = Array.isArray(filas) ? filas[0] : filas;
      }
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
              NOMBRE Y APELLIDO: ${esc($('fTecnico').value.trim())}<br>
              C.I. N°.: <span class="lin"></span><br>
              TELEFONO: <span class="lin"></span><br>
              CARGO: <span class="lin"></span><br>
              FIRMA: <span class="lin"></span>
            </div>
            <div class="hs-sello">SELLO</div>
          </div>
        </div>
      </div>
    </div>`;

    window.print();
  }

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

  $('lista').addEventListener('click', e => {
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
    if(e.key === 'Escape' && !$('velo').hidden) cerrar();
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
