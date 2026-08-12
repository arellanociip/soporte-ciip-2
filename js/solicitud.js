/* ---------- El formulario que llena la casa ----------
   Arma los desplegables desde js/catalogo.js, encadena el detalle al tipo (lo
   que en el Excel hacía INDIRECT), revisa lo escrito y manda la solicitud al
   servidor. Devuelve el número correlativo que asignó el servidor.

   Sin servidor configurado guarda en el propio navegador: sirve para probar y,
   sobre todo, para que nadie pierda lo que acabó de escribir.
   Prefijo: sol. */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);

  const form      = $('formulario');
  const gerencia  = $('gerencia');
  const piso      = $('piso');
  const oficinas  = $('listaOficinas');
  const tipo      = $('tipo');
  const detalle   = $('detalle');
  const desc      = $('descripcion');
  const enviar    = $('botonEnviar');

  /* ---------- llenar los desplegables ---------- */
  const opcion = (valor, texto) => {
    const o = document.createElement('option');
    o.value = valor; o.textContent = texto === undefined ? valor : texto;
    return o;
  };

  CAT_GERENCIAS.forEach(g => gerencia.append(opcion(g)));
  CAT_PISOS.forEach(p => piso.append(opcion(p, p === 'PB' ? 'PB · Planta baja' : 'Piso ' + p)));
  CAT_OFICINAS.forEach(o => oficinas.append(opcion(o)));
  CAT_SERVICIOS.forEach(s => tipo.append(opcion(s.valor, s.etiqueta)));

  /* ¿La persona pidió menos animación en su sistema? Entonces los cambios de
     pantalla no esperan a ninguna transición. */
  const menosMovimiento = window.matchMedia
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* El detalle cuelga del tipo: al cambiar uno se rehace el otro. */
  tipo.addEventListener('change', () => {
    const elegido = CAT_SERVICIOS.find(s => s.valor === tipo.value);
    detalle.innerHTML = '';
    if(!elegido){
      detalle.append(opcion('', 'Elige primero el tipo de servicio'));
      detalle.disabled = true;
      $('pistaTipo').textContent = 'Si no estás seguro, déjalo así: el técnico lo clasifica.';
      return;
    }
    detalle.disabled = false;
    detalle.append(opcion('', 'Sin especificar'));
    elegido.detalles.forEach(d => detalle.append(opcion(d)));
    $('pistaTipo').textContent = elegido.pista;
    /* El campo acaba de habilitarse; sin un destello, el cambio pasa
       desapercibido y la gente no se entera de que ya puede usarlo.
       Se reinicia la clase para que la animación vuelva a correr si cambia
       de tipo varias veces seguidas. */
    detalle.classList.remove('despierta');
    void detalle.offsetWidth;
    detalle.classList.add('despierta');
  });

  /* ---------- los atajos ----------
     No guardan nada por su cuenta: rellenan los dos desplegables de siempre,
     que siguen siendo la única fuente de la clasificación. Así la Hoja de
     Servicio sale igual venga de un atajo o de los desplegables. */
  let atajoElegido = null;

  const AYUDA_POR_DEFECTO = 'Ej. El CPU se apaga solo a cada rato desde el lunes, aunque el cable esté bien conectado.';

  CAT_ATAJOS.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';                       /* si no, envía el formulario */
    b.className = 'atajo' + (a.id === 'otra' ? ' otra' : '');
    b.dataset.id = a.id;
    b.setAttribute('aria-pressed', 'false');
    /* a.icono es SVG escrito en js/catalogo.js, nunca dato de entrada */
    b.innerHTML = `<div class="ic">${a.icono}</div>
      <div class="t"></div><div class="s"></div>`;
    b.querySelector('.t').textContent = a.titulo;
    b.querySelector('.s').textContent = a.sub;
    b.addEventListener('click', () => elegirAtajo(a.id));
    $('atajos').append(b);
  });

  function elegirAtajo(id){
    /* volver a pulsar el mismo lo suelta: nadie queda atrapado en una opción */
    const a = (atajoElegido === id) ? null : CAT_ATAJOS.find(x => x.id === id);
    atajoElegido = a ? a.id : null;

    $('atajos').querySelectorAll('.atajo').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.id === atajoElegido)));

    /* el texto guía de la descripción se adapta: es donde la gente se traba */
    desc.placeholder = a ? a.ejemplo : AYUDA_POR_DEFECTO;

    if(a && a.tipo){
      tipo.value = a.tipo;
      tipo.dispatchEvent(new Event('change'));   /* rehace la lista de detalles */
      detalle.value = a.detalle || '';
      $('clasificadoTexto').textContent =
        catTipoEtiqueta(a.tipo) + (a.detalle ? ' · ' + a.detalle : '');
      $('clasificado').hidden = false;
      $('clasificacionManual').hidden = true;
    }else{
      /* "Otra cosa", o ningún atajo: los desplegables completos */
      tipo.value = '';
      tipo.dispatchEvent(new Event('change'));
      $('clasificado').hidden = true;
      $('clasificacionManual').hidden = !a;   /* solo "Otra cosa" los abre */
      if(a) detalle.focus();
    }
  }

  /* "Cambiar" abre los desplegables con lo que el atajo dejó puesto. */
  $('botonAfinar').addEventListener('click', () => {
    $('clasificado').hidden = true;
    $('clasificacionManual').hidden = false;
    tipo.focus();
  });

  /* ---------- contador de la descripción ---------- */
  const contador = $('contadorDesc');
  desc.addEventListener('input', () => {
    contador.textContent = desc.value.length;
    /* avisa al acercarse al tope, no cuando ya no cabe nada */
    contador.classList.toggle('cerca', desc.value.length > 540);
  });

  /* ---------- los datos de quien pide, recordados ----------
     38 de las 125 personas del Excel pidieron soporte más de una vez, y cada
     vez volvieron a escribir su gerencia, su cédula, su piso y su oficina.
     Aquí eso se escribe una sola vez: queda en ESTE navegador —nunca en el
     servidor— y en las siguientes solo hay que confirmarlo.
     Ojo con los equipos compartidos: por eso el recuadro dice a nombre de
     quién está y "No soy yo" lo borra de verdad. */
  const LLAVE_YO = 'soporte_yo';
  const CAMPOS_YO = ['gerencia', 'usuario', 'cedula', 'telefono', 'piso', 'oficina'];

  function leerYo(){
    try{ return JSON.parse(localStorage.getItem(LLAVE_YO)); }catch(e){ return null; }
  }

  function guardarYo(datos){
    const yo = {};
    CAMPOS_YO.forEach(k => { yo[k] = datos[k] || ''; });
    try{ localStorage.setItem(LLAVE_YO, JSON.stringify(yo)); }
    catch(e){ console.warn('No se pudieron recordar los datos:', e); }
  }

  /* Se recuerda en cuanto la persona queda identificada, no al enviar.
     Guardarlo solo tras un envío con éxito hacía que el nombre se perdiera si
     no llegaba a enviar —o si el servidor rechazaba por tener ya una abierta—,
     y volver a escribirlo es justo lo que esto venía a evitar. */
  function guardarYoSiProcede(){
    if(!$('recordarme').checked) return;
    const completo = ['gerencia', 'usuario', 'piso', 'oficina']
      .every(k => $(k).value.trim());
    if(completo) guardarYo(recogerDatos());
  }

  /* ---------- los tres estados de "quién solicita" ----------
     1. buscador  → un solo campo: escribe tu nombre y elígete de la lista
     2. recordado → el recuadro verde: ya sabemos quién eres, solo confirma
     3. campos    → los seis, para quien no está en la lista o quiere corregir
     Solo uno está a la vista a la vez. */
  function mostrarIdentidad(cual){
    $('buscadorPersona').hidden  = cual !== 'buscador';
    $('recordado').hidden        = cual !== 'recordado';
    $('camposIdentidad').hidden  = cual !== 'campos';
  }

  function olvidarYo(){
    localStorage.removeItem(LLAVE_YO);
    CAMPOS_YO.forEach(k => { $(k).value = ''; });
    $('quienEres').value = '';
    marcar('quienEres', '');
    mostrarIdentidad('buscador');
    pintarAvance();
    $('quienEres').focus();
  }

  /* Pinta el recuadro verde con quien esté identificado. */
  function mostrarRecuadro(yo){
    $('recordadoNombre').textContent = yo.usuario;
    $('recordadoDonde').textContent = [
      yo.gerencia,
      (yo.piso ? 'Piso ' + yo.piso : '') + (yo.oficina ? ', of. ' + yo.oficina : ''),
      yo.cedula ? 'C.I. ' + yo.cedula : '',
    ].filter(Boolean).join(' · ');
    mostrarIdentidad('recordado');
  }

  function aplicarYo(){
    const yo = leerYo();
    if(!yo || !yo.usuario) return false;
    CAMPOS_YO.forEach(k => { if(yo[k]) $(k).value = yo[k]; });
    $('quienEres').value = yo.usuario;
    mostrarRecuadro(yo);
    return true;
  }

  /* ---------- elegirse del directorio ----------
     El nombre escrito solo cuenta cuando coincide con alguien de la lista.
     Si no aparece, no se adivina: se abren los seis campos con el nombre ya
     puesto, porque el directorio es un punto de partida, no una autoridad. */
  DIRECTORIO.forEach(p => {
    const o = document.createElement('option');
    o.value = p.nombre;
    o.label = p.gerencia + ' · Piso ' + p.piso + ', of. ' + p.oficina;
    $('listaPersonas').append(o);
  });

  function intentarIdentificar(){
    const p = directorioBuscar($('quienEres').value);
    if(!p) return false;
    $('usuario').value  = p.nombre;
    $('gerencia').value = p.gerencia;
    $('piso').value     = p.piso;
    $('oficina').value  = p.oficina;
    marcar('quienEres', '');
    mostrarRecuadro({usuario: p.nombre, gerencia: p.gerencia, piso: p.piso,
                     oficina: p.oficina, cedula: $('cedula').value});
    pintarAvance();
    return true;
  }

  /* El datalist dispara 'change' al elegir de la lista y 'input' al teclear;
     se prueba en ambos para que valga tanto elegir con el ratón como escribir
     el nombre completo a mano. */
  $('quienEres').addEventListener('change', intentarIdentificar);
  $('quienEres').addEventListener('input', intentarIdentificar);

  /* "No aparezco en la lista": los seis campos, con el nombre ya escrito. */
  $('botonNoEstoy').addEventListener('click', () => {
    $('usuario').value = $('quienEres').value.trim();
    mostrarIdentidad('campos');
    ($('usuario').value ? $('gerencia') : $('usuario')).focus();
    pintarAvance();
  });

  /* Desmarcar la casilla surte efecto ya: borra lo guardado en vez de esperar
     al próximo envío. Volver a marcarla guarda lo que haya en pantalla. */
  $('recordarme').addEventListener('change', () => {
    if($('recordarme').checked) guardarYoSiProcede();
    else localStorage.removeItem(LLAVE_YO);
  });

  $('botonNoSoyYo').addEventListener('click', olvidarYo);
  $('botonCorregir').addEventListener('click', () => {
    /* deja los datos puestos y descubre los campos para retocar uno */
    mostrarIdentidad('campos');
    /* si estaba recordado, la casilla debe reflejarlo al descubrirse */
    $('recordarme').checked = true;
    $('usuario').focus();
  });

  /* ---------- cuánto falta ----------
     Solo lo obligatorio: si contara lo opcional, la barra nunca llegaría al
     final y diría que falta algo cuando ya no falta nada. */
  const OBLIGATORIOS = ['gerencia', 'usuario', 'piso', 'oficina', 'descripcion'];

  /* La vuelta completa del anillo: 2·π·r con el r=21 del <circle> en el HTML.
     Debe coincidir con el stroke-dasharray de .avance .arco en el CSS. */
  const CIRCUNFERENCIA = 2 * Math.PI * 21;

  function pintarAvance(){
    /* Aquí porque se llama con cada cambio de los campos obligatorios: cubre
       tanto elegirse de la lista como escribir los seis a mano. */
    guardarYoSiProcede();
    const listos = OBLIGATORIOS.filter(id => $(id).value.trim()).length;
    const total = OBLIGATORIOS.length;
    const faltan = total - listos;
    const pct = Math.round(listos / total * 100);

    /* El arco se dibuja recortando el trazo: cuanto menos desplazamiento,
       más vuelta pintada. */
    $('avanceArco').style.strokeDashoffset = CIRCUNFERENCIA * (1 - listos / total);
    $('avancePct').textContent = pct + '%';
    $('avance').classList.toggle('completo', !faltan);
    $('avance').setAttribute('aria-valuenow', pct);

    if(!listos){
      $('avanceTitulo').textContent = 'Vamos a empezar';
      $('avanceSub').textContent = total + ' datos obligatorios';
    }else if(faltan){
      $('avanceTitulo').textContent = 'Vas por buen camino';
      $('avanceSub').textContent = faltan === 1
        ? 'Falta 1 dato obligatorio'
        : 'Faltan ' + faltan + ' datos obligatorios';
    }else{
      $('avanceTitulo').textContent = 'Listo para enviar';
      $('avanceSub').textContent = 'No falta nada';
    }
  }

  OBLIGATORIOS.forEach(id => {
    $(id).addEventListener('input', pintarAvance);
    $(id).addEventListener('change', pintarAvance);
  });

  /* ---------- revisión ---------- */
  /* Cada regla dice qué campo mira y qué se le reclama. Se revisa al enviar, y
     a partir de ahí también al salir del campo: así el primer intento no va
     regañando mientras la persona todavía escribe. */
  const REGLAS = [
    ['gerencia',    v => v ? '' : 'Elige tu gerencia.'],
    ['usuario',     v => v.trim().length >= 3 ? '' : 'Escribe tu nombre y apellido.'],
    ['piso',        v => v ? '' : 'Indica el piso.'],
    ['oficina',     v => v.trim() ? '' : 'Indica la oficina.'],
    ['descripcion', v => v.trim().length >= 10 ? '' : 'Cuenta un poco más: con diez caracteres el técnico no sabe qué llevar.'],
    /* La cédula es opcional, pero si la escriben debe parecer una cédula. */
    ['cedula',      v => (!v.trim() || /^[VEve]?[-\s.]?[\d.\s]{6,12}$/.test(v.trim())) ? '' : 'Revisa la cédula: solo números, por ejemplo 12.345.678.'],
  ];

  let revisandoAlSalir = false;

  function marcar(id, mensaje){
    const campo = $(id).closest('.campo');
    campo.classList.toggle('mal', !!mensaje);
    const hueco = campo.querySelector('.error');
    if(hueco) hueco.textContent = mensaje;
    return !mensaje;
  }

  function revisarCampo(id){
    const regla = REGLAS.find(r => r[0] === id);
    return regla ? marcar(id, regla[1]($(id).value)) : true;
  }

  function revisarTodo(){
    /* Sin cortocircuito: se evalúan todas para que salgan todos los errores de
       una vez, no de uno en uno. */
    return REGLAS.map(([id]) => revisarCampo(id)).every(Boolean);
  }

  REGLAS.forEach(([id]) => {
    $(id).addEventListener('blur', () => { if(revisandoAlSalir) revisarCampo(id); });
    $(id).addEventListener('input', () => { if(revisandoAlSalir) revisarCampo(id); });
  });

  /* ---------- envío ---------- */
  function avisoError(html){
    const caja = $('avisoError');
    caja.innerHTML = html;
    caja.hidden = !html;
  }

  function comoContactar(){
    const c = window.SOPORTE_CONTACTO || {};
    const vias = [];
    if(c.extension) vias.push('la extensión ' + c.extension);
    if(c.correo) vias.push('el correo ' + c.correo);
    return vias.length
      ? ' Mientras tanto, escribe o llama a ' + (c.gerencia || 'GTIC') + ' por ' + vias.join(' o ') + '.'
      : '';
  }

  function recogerDatos(){
    return {
      gerencia:    gerencia.value,
      usuario:     $('usuario').value.trim(),
      cedula:      $('cedula').value.trim() || null,
      telefono:    $('telefono').value.trim() || null,
      piso:        piso.value,
      oficina:     $('oficina').value.trim().toUpperCase(),
      descripcion: desc.value.trim(),
      tipo:        tipo.value || null,
      detalle:     detalle.value || null,
    };
  }

  async function mandarAlServidor(datos){
    const B = window.SOPORTE_BACKEND;
    /* Con el servidor de casa, B.url va vacío: la petición sale al mismo sitio
       que sirvió la página, que es exactamente lo que se quiere. */
    const r = await fetch(B.url + '/rest/v1/solicitudes', {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        /* La fila vuelve en la respuesta: es la única forma de conocer el
           número, porque quien envía no tiene permiso para releerla después. */
        'Prefer': 'return=representation',
      }, soporteCabeceras(),
         B.servidor === 'supabase' ? {'Authorization': 'Bearer ' + B.anonKey} : {}),
      body: JSON.stringify(datos),
    });
    if(!r.ok){
      const cuerpo = await r.json().catch(() => ({}));
      /* 409: el servidor dice que esa persona ya tiene una abierta. No es un
         fallo que haya que reintentar, es una regla — se cuenta como tal y se
         anota la que ya existe para poder seguirla desde aquí. */
      if(r.status === 409){
        const e = new Error(cuerpo.message || 'Ya tienes una solicitud abierta.');
        e.yaAbierta = cuerpo.abierta || null;
        throw e;
      }
      throw new Error('HTTP ' + r.status + (cuerpo.message ? ' · ' + cuerpo.message : ''));
    }
    const filas = await r.json();
    return Array.isArray(filas) ? filas[0] : filas;
  }

  /* Una pantalla se desvanece y la otra entra, en vez de saltar de golpe: el
     cambio deja de sentirse como si la página se hubiera recargado sola. */
  function cambiarPantalla(sale, entra){
    const irArriba = () => window.scrollTo(
      {top: 0, behavior: menosMovimiento ? 'auto' : 'smooth'});

    /* el medidor de la planilla solo tiene sentido con la planilla delante */
    const alAcuse = entra === $('pantallaAcuse');
    if(menosMovimiento){
      sale.hidden = true; entra.hidden = false;
      $('tarjetaAvance').hidden = alAcuse;
      $('intro').hidden = alAcuse;
      irArriba();
      return;
    }
    sale.classList.add('pantalla-sale');
    setTimeout(() => {
      sale.hidden = true;
      sale.classList.remove('pantalla-sale');
      entra.hidden = false;
      $('tarjetaAvance').hidden = alAcuse;
      $('intro').hidden = alAcuse;
      entra.classList.add('pantalla-entra');
      irArriba();
      setTimeout(() => entra.classList.remove('pantalla-entra'), 420);
    }, 200);
  }

  function mostrarAcuse(fila){
    const numero = 'GTIC-HS/' + String(fila.numero).padStart(3, '0') + '-' + fila.anio;
    $('numeroAcuse').textContent = numero;
    if(fila.prueba){
      $('textoAcuse').innerHTML = '<b>Esto fue un ensayo.</b> Como todavía no hay servidor, la '
        + 'solicitud quedó guardada solo en este navegador — nadie más la ve. '
        + 'Ábrela en <a href="bandeja.html">la bandeja de soporte</a> para ver cómo le llega a GTIC.';
    }
    cambiarPantalla($('pantallaFormulario'), $('pantallaAcuse'));
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    revisandoAlSalir = true;
    avisoError('');

    if(!revisarTodo()){
      /* Los campos de identidad casi siempre están guardados de la vista, así
         que un error señalado ahí no lo vería nadie y la planilla parecería no
         responder. Según el estado en que esté, el reclamo va a otro sitio. */
      const fallaIdentidad = CAMPOS_YO.some(k => $(k).closest('.campo').classList.contains('mal'));
      if(fallaIdentidad){
        if(!$('buscadorPersona').hidden){
          /* En el buscador no hay seis campos que señalar: hay uno. Se recogen
             los cuatro reclamos invisibles en un solo mensaje, ahí. */
          CAMPOS_YO.forEach(k => marcar(k, ''));
          marcar('quienEres', 'Elígete de la lista, o pulsa «No aparezco en la lista».');
        }else if($('camposIdentidad').hidden){
          mostrarIdentidad('campos');
        }
      }
      const primero = form.querySelector('.campo.mal input, .campo.mal select, .campo.mal textarea');
      if(primero) primero.focus();
      return;
    }

    const datos = recogerDatos();
    enviar.disabled = true;
    enviar.innerHTML = '<span class="girador"></span>Enviando…';

    try{
      const fila = soporteHayBackend()
        ? await mandarAlServidor(datos)
        : soporteLocal.agregar(datos);
      /* Solo se recuerda lo que llegó a enviarse —si el envío falló, no hay por
         qué dar por buenos unos datos que nadie confirmó— y solo si la persona
         lo pidió. Desmarcar la casilla no es pasivo: borra lo que hubiera
         guardado antes, que es lo que uno espera al decir "no me recuerdes". */
      if($('recordarme').checked) guardarYo(datos);
      else localStorage.removeItem(LLAVE_YO);
      /* El resguardo para consultar su estado después. Va siempre, marque o no
         la casilla: eso decide si se recuerdan sus DATOS, no si puede seguir
         lo que acaba de pedir. */
      soporteMias.anotar(fila);
      mostrarAcuse(fila);
    }catch(err){
      enviar.disabled = false;
      enviar.textContent = 'Enviar solicitud';

      /* La regla de una a la vez no es una avería: se explica y se pasa a
         seguir la que ya existe, en vez de invitar a reintentar en balde. */
      if(err.yaAbierta){
        soporteMias.anotar(err.yaAbierta);
        await pintarMias();
        window.scrollTo({top: 0, behavior: menosMovimiento ? 'auto' : 'smooth'});
        return;
      }
      console.error('No se pudo enviar la solicitud:', err);
      avisoError('<span>⚠</span><div><b>No se pudo enviar la solicitud.</b> '
        + 'Puede ser la conexión o el servidor. Vuelve a intentar en un momento; '
        + 'lo que escribiste sigue aquí.' + comoContactar() + '</div>');
      return;
    }

    enviar.disabled = false;
    enviar.textContent = 'Enviar solicitud';
  });

  /* ---------- que la rueda no gire eternamente ----------
     Si la persona vuelve con el botón "atrás" del navegador, Firefox y Safari
     restauran la página tal como estaba —botón deshabilitado y girando— desde
     su caché. Esto lo devuelve a su sitio. */
  window.addEventListener('pageshow', e => {
    if(!e.persisted) return;
    enviar.disabled = false;
    enviar.textContent = 'Enviar solicitud';
  });

  /* ---------- limpiar y volver a empezar ---------- */
  function limpiar(){
    /* form.reset() devolvería la casilla a "marcada", su valor de fábrica, y
       quien dijo que NO lo quería se encontraría con que sí, sin tocarla. */
    const queriaRecordar = $('recordarme').checked;
    form.reset();
    $('recordarme').checked = queriaRecordar;
    revisandoAlSalir = false;
    contador.textContent = '0';
    contador.classList.remove('cerca');
    /* reset() deja el tipo vacío, pero el detalle conserva las opciones del
       tipo anterior: hay que rehacerlo a mano. */
    tipo.dispatchEvent(new Event('change'));
    detalle.classList.remove('despierta');
    /* suelta el atajo y devuelve la clasificación a su estado inicial */
    atajoElegido = null;
    $('atajos').querySelectorAll('.atajo').forEach(b => b.setAttribute('aria-pressed', 'false'));
    desc.placeholder = AYUDA_POR_DEFECTO;
    $('clasificado').hidden = true;
    $('clasificacionManual').hidden = true;
    form.querySelectorAll('.campo.mal').forEach(c => {
      c.classList.remove('mal');
      const hueco = c.querySelector('.error'); if(hueco) hueco.textContent = '';
    });
    avisoError('');
    marcar('quienEres', '');
    /* Limpiar vacía la planilla, no la memoria: quien ya se identificó no
       tiene por qué volver a hacerlo por haber querido reescribir su problema. */
    if(!aplicarYo()) mostrarIdentidad('buscador');
    pintarAvance();
  }

  $('botonLimpiar').addEventListener('click', limpiar);
  $('botonOtra').addEventListener('click', () => {
    limpiar();
    cambiarPantalla($('pantallaAcuse'), $('pantallaFormulario'));
  });

  /* ---------- el seguimiento de lo que uno pidió ----------
     Se consulta cada solicitud por su id, que es lo único que prueba que es
     tuya: el servidor no entrega listas a quien no tiene cuenta. Sin servidor
     (modo prueba) se lee del almacén del navegador, para que el circuito se
     pueda enseñar igual. */
  const ESTADO_LBL = {recibida:'Recibida', en_proceso:'En proceso',
                      atendida:'Atendida', anulada:'Anulada'};

  const escapar = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function fechaCorta(iso){
    if(!iso) return '';
    return new Date(iso).toLocaleDateString('es-VE', {day:'2-digit', month:'short'});
  }

  async function consultarUna(m){
    if(!soporteHayBackend()){
      return soporteLocal.leer().find(s => s.id === m.id) || null;
    }
    const B = window.SOPORTE_BACKEND;
    const r = await fetch(B.url + '/rest/v1/solicitudes?id=eq.' + encodeURIComponent(m.id),
      {headers: soporteCabeceras()});
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const filas = await r.json();
    return Array.isArray(filas) ? filas[0] : filas;
  }

  /* ---------- por dónde va ----------
     Las tres etapas del trámite dibujadas: entra, la toma un técnico, se
     cierra. Ver el camino tranquiliza más que leer una palabra suelta, porque
     dice cuánto falta y no solo dónde está. */
  /* Las mismas tres que GTIC usa en su bandeja: lo que ellos ven como fichas
     para filtrar, aquí se ve como el camino de una sola solicitud. Nombrarlas
     igual a los dos lados evita que la casa y la gerencia hablen distinto de
     lo mismo. */
  const ETAPAS = [
    {clave: 'recibida',   rot: 'Recibida',   guia: 'Entra a la cola de GTIC',
     pie: s => fechaCorta(s.creada_en)},
    {clave: 'en_proceso', rot: 'En proceso', guia: 'Un técnico la toma',
     pie: () => 'Un técnico la toma'},
    {clave: 'atendida',   rot: 'Atendida',   guia: 'Resuelta y firmada',
     pie: s => s.atendida_en ? fechaCorta(s.atendida_en) : 'Resuelta'},
  ];
  const VISTO = '<svg viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';

  function pasosHtml(s){
    /* anulada no recorrió el camino, así que dibujarlo mentiría */
    if(s.estado === 'anulada'){
      return `<div class="mis-anulada">Esta solicitud fue anulada por GTIC.
        Si sigues necesitando ayuda, puedes pedir una nueva.</div>`;
    }
    const donde = ETAPAS.findIndex(e => e.clave === s.estado);
    return '<div class="pasos">' + ETAPAS.map((e, i) => {
      const clase = i < donde ? 'hecho' : (i === donde ? 'ahora' : '');
      /* la última, alcanzada, es un fin: se marca cumplida y no "en curso" */
      const cumplida = i < donde || (i === donde && e.clave === 'atendida');
      return `<div class="paso ${cumplida ? 'hecho' : clase}">
        <div class="bola">${cumplida ? VISTO : ''}</div>
        <div class="rot">${escapar(e.rot)}</div>
        <div class="cuando">${i <= donde ? escapar(e.pie(s)) : ''}</div>
      </div>`;
    }).join('') + '</div>';
  }

  function filaMiaHtml(s){
    /* La observación del técnico solo cuando ya cerró: antes no hay nada que
       leer y sería una caja vacía dando falsas esperanzas. */
    const respuesta = (s.estado === 'atendida' && s.observaciones)
      ? `<div class="mis-obs"><b>Respuesta de GTIC${s.tecnico ? ' · ' + escapar(s.tecnico) : ''}</b>${escapar(s.observaciones)}</div>`
      : '';
    return `<div class="mis-fila">
      <div class="mis-num">${String(s.numero).padStart(3,'0')}<small>${escapar(String(s.anio))}</small></div>
      <div class="mis-q">
        <div class="d">${escapar(s.descripcion)}</div>
        <div class="f">Enviada el ${escapar(fechaCorta(s.creada_en))}${
          s.atendida_en ? ' · atendida el ' + escapar(fechaCorta(s.atendida_en)) : ''}</div>
      </div>
      <span class="etiqueta ${escapar(s.estado)}">${escapar(ESTADO_LBL[s.estado] || s.estado)}</span>
      ${pasosHtml(s)}
      ${respuesta}
    </div>`;
  }

  /* Sin nada que seguir todavía, el panel no se esconde: enseña el camino que
     va a recorrer la solicitud. Escondiéndolo, la función no existía para
     quien no hubiera pedido nunca — y era justo quien más necesitaba saber
     que existe. */
  function caminoVacioHtml(){
    return '<div class="pasos vacio-pasos">' + ETAPAS.map(e =>
      `<div class="paso">
         <div class="bola"></div>
         <div class="rot">${escapar(e.rot)}</div>
         <div class="cuando">${escapar(e.guia)}</div>
       </div>`).join('') + '</div>';
  }

  /* El anillo del panel cuenta etapas, no campos: una de tres es 33 %, dos 66,
     las tres 100. Es el mismo aro que arriba mide la planilla, para que ver
     "cuánto falta" signifique lo mismo antes y después de enviar. */
  function pintarAnilloMias(s){
    const donde = s ? ETAPAS.findIndex(e => e.clave === s.estado) : -1;
    /* anulada no está en el camino: el aro se queda vacío y lo explica la fila */
    const hechas = donde < 0 ? 0 : donde + 1;
    const pct = Math.round(hechas / ETAPAS.length * 100);

    $('misArco').style.strokeDashoffset = CIRCUNFERENCIA * (1 - hechas / ETAPAS.length);
    $('misPct').textContent = pct + '%';
    $('misAvance').classList.toggle('completo', pct === 100);
    $('misAvance').setAttribute('aria-valuenow', pct);
  }

  /* El velo del final se enciende solo si queda algo por ver, y se apaga al
     llegar al fondo. Un degradado permanente mentiría diciendo que hay más. */
  function revisarVelo(){
    const caja = $('misLista');
    const falta = caja.scrollHeight - caja.clientHeight - caja.scrollTop;
    $('misListaCaja').classList.toggle('hay-mas', falta > 8);
  }
  $('misLista').addEventListener('scroll', revisarVelo);
  window.addEventListener('resize', revisarVelo);

  async function pintarMias(){
    const mias = soporteMias.leer();
    $('misSolicitudes').hidden = false;

    if(!mias.length){
      $('misResumen').textContent = 'Aquí seguirás tu solicitud en cuanto la envíes';
      $('misLista').innerHTML = caminoVacioHtml();
      $('botonRefrescarMias').hidden = true;
      pintarAnilloMias(null);
      revisarVelo();
      bloquearSiHayAbierta(null);
      return;
    }
    $('botonRefrescarMias').hidden = false;
    $('misResumen').textContent = 'Consultando…';

    /* Todas a la vez: son pocas y así no se espera una detrás de otra. */
    const filas = (await Promise.all(mias.map(m =>
      consultarUna(m).catch(e => { console.warn('No se pudo consultar', m.id, e); return null; })
    ))).filter(Boolean);

    if(!filas.length){
      $('misResumen').textContent = 'No se pudo consultar el estado. Revisa la conexión.';
      $('misLista').innerHTML = '';
      return;
    }
    const abiertas = filas.filter(s => s.estado === 'recibida' || s.estado === 'en_proceso');

    /* Aquí solo vive lo que sigue en curso. Las cerradas se van, que es lo que
       uno espera de una bandeja de pendientes… con una excepción: si no queda
       ninguna abierta, se deja la última cerrada. En ella está la respuesta
       del técnico —qué se hizo con el equipo—, y borrarla en el mismo momento
       en que aparece dejaría al usuario sin enterarse nunca. Se va sola en
       cuanto pida algo nuevo. */
    const visibles = abiertas.length ? abiertas : filas.slice(0, 1);

    /* El resguardo se poda igual: sin esto, el navegador cargaría para siempre
       con solicitudes de hace meses que ya nadie va a mirar. */
    soporteMias.podar(visibles.map(s => s.id));

    const manda = visibles[0];
    pintarAnilloMias(manda);

    const ETAPA_LBL = {recibida: 'GTIC la recibió y está en cola',
                       en_proceso: 'Un técnico la está atendiendo',
                       atendida: 'Resuelta',
                       anulada: 'Anulada por GTIC'};
    $('misResumen').textContent = abiertas.length
      ? ETAPA_LBL[manda.estado] + ' · N° ' + String(manda.numero).padStart(3,'0') + '-' + manda.anio
      : (manda.estado === 'anulada'
          ? 'Tu última solicitud fue anulada'
          : 'Ya está resuelta · así quedó');
    $('misLista').innerHTML = visibles.map(filaMiaHtml).join('');
    $('misLista').classList.toggle('una-sola', visibles.length === 1);
    $('misLista').scrollTop = 0;
    revisarVelo();
    bloquearSiHayAbierta(abiertas[0] || null);
  }

  /* ---------- una a la vez ----------
     Con una solicitud abierta no se puede pedir otra: el formulario se guarda
     y en su lugar queda el porqué. La regla la impone el servidor —esto es
     solo no dejar escribir en balde— porque desde otro navegador la pantalla
     no sabría nada. */
  function bloquearSiHayAbierta(abierta){
    const aviso = $('avisoUnaALaVez');
    if(!abierta){
      const enAcuse = !$('pantallaAcuse').hidden;
      $('pantallaFormulario').hidden = enAcuse;
      /* el título y el medidor acompañan a la planilla: sin ella, uno invita a
         algo que no se puede hacer y el otro no mide nada */
      $('tarjetaAvance').hidden = enAcuse;
      $('intro').hidden = enAcuse;
      aviso.hidden = true;
      return;
    }
    $('pantallaFormulario').hidden = true;
    $('tarjetaAvance').hidden = true;
    $('intro').hidden = true;
    $('pantallaAcuse').hidden = true;
    aviso.innerHTML = `<span>🕓</span><div>
      <b>Ya tienes una solicitud abierta</b> —la N° ${escapar(String(abierta.numero).padStart(3,'0'))}-${escapar(String(abierta.anio))}—
      así que no puedes pedir otra todavía. Arriba ves por dónde va.
      <br>En cuanto GTIC la cierre, esta planilla vuelve a abrirse.
      Si es algo urgente y distinto, llama a la gerencia.</div>`;
    aviso.hidden = false;
  }

  $('botonRefrescarMias').addEventListener('click', () => pintarMias());

  /* ---------- arranque ---------- */
  $('avisoSinServidor').hidden = soporteHayBackend();
  aplicarYo();
  pintarAvance();
  pintarMias();
})();
