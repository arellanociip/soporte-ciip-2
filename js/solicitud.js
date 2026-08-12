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

  /* ---------- contador de la descripción ---------- */
  const contador = $('contadorDesc');
  desc.addEventListener('input', () => {
    contador.textContent = desc.value.length;
    /* avisa al acercarse al tope, no cuando ya no cabe nada */
    contador.classList.toggle('cerca', desc.value.length > 540);
  });

  /* ---------- cuánto falta ----------
     Solo lo obligatorio: si contara lo opcional, la barra nunca llegaría al
     final y diría que falta algo cuando ya no falta nada. */
  const OBLIGATORIOS = ['gerencia', 'usuario', 'piso', 'oficina', 'descripcion'];

  /* La vuelta completa del anillo: 2·π·r con el r=21 del <circle> en el HTML.
     Debe coincidir con el stroke-dasharray de .avance .arco en el CSS. */
  const CIRCUNFERENCIA = 2 * Math.PI * 21;

  function pintarAvance(){
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
    const r = await fetch(B.url + '/rest/v1/solicitudes', {
      method: 'POST',
      headers: {
        'apikey': B.anonKey,
        'Authorization': 'Bearer ' + B.anonKey,
        'Content-Type': 'application/json',
        'Content-Profile': 'gtic',
        'Accept-Profile': 'gtic',
        /* La fila vuelve en la respuesta: es la única forma de conocer el
           número, porque quien envía no tiene permiso para releerla después. */
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(datos),
    });
    if(!r.ok){
      const cuerpo = await r.text().catch(() => '');
      throw new Error('HTTP ' + r.status + (cuerpo ? ' · ' + cuerpo.slice(0, 300) : ''));
    }
    const filas = await r.json();
    return Array.isArray(filas) ? filas[0] : filas;
  }

  /* Una pantalla se desvanece y la otra entra, en vez de saltar de golpe: el
     cambio deja de sentirse como si la página se hubiera recargado sola. */
  function cambiarPantalla(sale, entra){
    const irArriba = () => window.scrollTo(
      {top: 0, behavior: menosMovimiento ? 'auto' : 'smooth'});

    if(menosMovimiento){
      sale.hidden = true; entra.hidden = false; irArriba();
      return;
    }
    sale.classList.add('pantalla-sale');
    setTimeout(() => {
      sale.hidden = true;
      sale.classList.remove('pantalla-sale');
      entra.hidden = false;
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
      mostrarAcuse(fila);
    }catch(err){
      console.error('No se pudo enviar la solicitud:', err);
      avisoError('<span>⚠</span><div><b>No se pudo enviar la solicitud.</b> '
        + 'Puede ser la conexión o el servidor. Vuelve a intentar en un momento; '
        + 'lo que escribiste sigue aquí.' + comoContactar() + '</div>');
      enviar.disabled = false;
      enviar.textContent = 'Enviar solicitud';
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
    form.reset();
    revisandoAlSalir = false;
    contador.textContent = '0';
    contador.classList.remove('cerca');
    /* reset() deja el tipo vacío, pero el detalle conserva las opciones del
       tipo anterior: hay que rehacerlo a mano. */
    tipo.dispatchEvent(new Event('change'));
    detalle.classList.remove('despierta');
    form.querySelectorAll('.campo.mal').forEach(c => {
      c.classList.remove('mal');
      const hueco = c.querySelector('.error'); if(hueco) hueco.textContent = '';
    });
    avisoError('');
    pintarAvance();
  }

  $('botonLimpiar').addEventListener('click', limpiar);
  $('botonOtra').addEventListener('click', () => {
    limpiar();
    cambiarPantalla($('pantallaAcuse'), $('pantallaFormulario'));
  });

  /* ---------- arranque ---------- */
  $('avisoSinServidor').hidden = soporteHayBackend();
  pintarAvance();
})();
