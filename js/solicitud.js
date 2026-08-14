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
    /* el campo oculto es lo que ve la revisión y lo que cuenta el anillo */
    $('atajo').value = atajoElegido || '';
    if(revisandoAlSalir) revisarCampo('atajo');
    pintarAvance();

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
      yaLaVio = false;
      pintarAntes(true);
      quitados = [];
      pintarEquipo();
    }else{
      /* "Otra cosa", o ningún atajo: los desplegables completos */
      tipo.value = '';
      tipo.dispatchEvent(new Event('change'));
      $('clasificado').hidden = true;
      $('clasificacionManual').hidden = !a;   /* solo "Otra cosa" los abre */
      yaLaVio = false;
      pintarAntes(true);
      quitados = [];
      pintarEquipo();
      if(a) detalle.focus();
    }
  }

  /* ---------- el equipo de quien pide ----------
     El serial es el dato que nadie se sabe de memoria y el que más retrasa una
     Hoja de Servicio: hay que ir hasta el puesto, agacharse y copiarlo del
     costado del CPU. La casa ya lo tiene en el cuadro de Patrimonio, así que
     va con la solicitud y el técnico se lo encuentra escrito.

     Se manda solo cuando las dos cosas están claras: quién eres (elegido del
     directorio) y de qué es el problema (el atajo dice si mira el CPU o la
     impresora). Y se puede quitar: si el equipo no es ese, "No es ese" lo
     suelta y la hoja va sin él, como antes. */
  let equiposAdjuntos = [];
  let quitados = [];      /* los que la persona soltó a mano en esta pasada */

  const comoSeLlama = e => [e.equipo, e.marca, e.modelo,
                            e.serial ? 'serial ' + e.serial : ''].filter(Boolean).join(' · ');

  function pintarEquipo(){
    const caja = $('miEquipo');
    if(!caja) return;
    const a = CAT_ATAJOS.find(x => x.id === atajoElegido);
    const quien = $('usuario').value.trim();
    const tipos = (a && a.equipos) || [];
    equiposAdjuntos = [];

    if(quien && tipos.length && typeof inventarioDe === 'function'){
      const suyos = inventarioDe(quien);
      tipos.forEach(t => {
        const e = suyos.find(x => x.equipo === t);
        if(e && !quitados.includes(e.serial)) equiposAdjuntos.push(e);
      });
      /* Aquí iba la impresora del piso: como una impresora no es de nadie —la
         usa el que se sienta cerca—, a quien no tiene una a su nombre se le
         ofrecían las de su planta. Se retiró a propósito, para más adelante:
         preguntarle a alguien cuál de siete impresoras usa es pedirle un dato
         que probablemente no sepa, y el mapa por piso hace falta afinarlo
         primero. Lo que sostiene aquello sigue en su sitio —IMPRESORAS_PISO e
         inventarioImpresorasDe(), en js/inventario.js—, así que volver a
         encenderlo es un puñado de líneas. */
    }

    if(!equiposAdjuntos.length){ caja.hidden = true; return; }

    const lista = $('miEquipoLista');
    lista.innerHTML = '';
    equiposAdjuntos.forEach(e => {
      const fila = document.createElement('div');
      fila.className = 'eq-fila';
      const t = document.createElement('span');
      t.className = 'va';
      t.textContent = comoSeLlama(e);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'enlace';
      b.textContent = 'No es ese';
      b.addEventListener('click', () => { quitados.push(e.serial); pintarEquipo(); });
      fila.append(t, b);
      lista.append(fila);
    });

    caja.hidden = false;
  }

  /* ---------- lo que GTIC ya sabe de esto ----------
     De cada guía de la gerencia sale a esta página una sola cosa: el párrafo
     que el técnico escribió pensando en quien pide. Ni el cuerpo de la guía,
     ni quién la escribió, ni de qué solicitud salió — eso es de GTIC y se
     queda allá. El servidor tampoco lo manda: la ruta que atiende esta página
     devuelve solo el título y ese párrafo.

     Sale al clasificar el problema y se puede cerrar. No estorba el envío ni
     obliga a nada: quien ya lo intentó todo sigue de largo y manda su
     solicitud, que para eso vino. */
  let guiasPublicas = [];

  async function traerGuiasPublicas(){
    if(!soporteHayBackend()) return;
    try{
      const r = await fetch(SOPORTE_BACKEND.url + '/rest/v1/guias_publicas',
                            {headers: soporteCabeceras()});
      if(r.ok) guiasPublicas = await r.json();
    }catch(e){ /* sin esto la página funciona igual: es una ayuda, no un paso */ }
    pintarAntes(false);
  }

  /* Las que hablan de lo que se acaba de elegir. Con un atajo se mira su
     familia entera —"la computadora no sirve" son cinco problemas distintos—;
     con los desplegables, solo el detalle marcado, que ahí la persona ya dijo
     exactamente cuál es. */
  function ayudaDeAhora(){
    const a = CAT_ATAJOS.find(x => x.id === atajoElegido);
    const cuales = (a && a.familia && a.familia.length)
      ? a.familia.map(d => d.trim().toUpperCase())
      : [(detalle.value || '').trim().toUpperCase()].filter(Boolean);
    if(!cuales.length) return [];
    return guiasPublicas.filter(g =>
      cuales.includes(String(g.categoria || '').trim().toUpperCase()));
  }

  /* La línea de abajo solo dice que existe; lo que hay escrito se lee en la
     ventana. Así el formulario no crece cada vez que GTIC escribe una guía. */
  function pintarAntes(abrirla){
    const linea = $('ayudaLinea');
    if(!linea) return;
    const vienen = ayudaDeAhora();
    linea.hidden = !vienen.length;
    if(!vienen.length){ cerrarAyuda(); return; }
    if(abrirla && !yaLaVio) abrirAyuda();
  }

  /* Se abre sola una vez por problema elegido. Volver a abrirla es un clic en
     la línea; volver a metérsela por los ojos, no. */
  let yaLaVio = false;

  /* Con una sola guía se enseña de una vez: preguntar "¿cuál es tu caso?" para
     una única respuesta es hacerle dar un clic de más a la gente. Con varias,
     primero la lista y después la que eligió. */
  function pintarAyuda(elegida){
    const vienen = ayudaDeAhora();
    const caja = $('ayudaCuerpo');
    caja.innerHTML = '';

    if(vienen.length === 1 || elegida){
      const g = elegida || vienen[0];
      if(vienen.length > 1){
        const volver = document.createElement('button');
        volver.type = 'button';
        volver.className = 'ay-volver';
        volver.textContent = '← Ver los otros casos';
        volver.addEventListener('click', () => pintarAyuda(null));
        caja.append(volver);
      }
      const t = document.createElement('div');
      t.className = 'ay-guia';
      const h = document.createElement('b'); h.textContent = g.titulo;
      const p = document.createElement('p'); p.textContent = g.solucion;
      t.append(h, p);
      caja.append(t);
      return;
    }

    const rot = document.createElement('div');
    rot.className = 'ay-pregunta';
    rot.textContent = '¿Cuál de estos es tu caso?';
    caja.append(rot);
    vienen.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ay-caso';
      const n = document.createElement('b'); n.textContent = g.titulo;
      /* la primera línea de la solución, para saber de qué va sin abrirla */
      const s = document.createElement('span');
      s.textContent = String(g.solucion || '').split('\n').find(l => l.trim()) || '';
      b.append(n, s);
      b.addEventListener('click', () => pintarAyuda(g));
      caja.append(b);
    });
  }

  function abrirAyuda(){
    if(!ayudaDeAhora().length) return;
    pintarAyuda(null);
    yaLaVio = true;
    $('veloAyuda').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('ayudaIntentar').focus(), 30);
  }

  function cerrarAyuda(){
    if($('veloAyuda').hidden) return;
    $('veloAyuda').hidden = true;
    if($('veloChat').hidden) document.body.style.overflow = '';
  }

  $('abrirAyuda').addEventListener('click', abrirAyuda);
  $('cerrarAyuda').addEventListener('click', cerrarAyuda);
  $('ayudaIntentar').addEventListener('click', cerrarAyuda);
  /* "ya lo intenté" cierra y deja el cursor donde toca escribir lo que pasó */
  $('ayudaSeguir').addEventListener('click', () => { cerrarAyuda(); desc.focus(); });
  $('veloAyuda').addEventListener('click', e => { if(e.target === $('veloAyuda')) cerrarAyuda(); });

  /* al cambiar de problema vuelve a ofrecerse: es otra pregunta */
  detalle.addEventListener('change', () => { yaLaVio = false; pintarAntes(true); });

  /* lo atendido hace más de dos meses se suelta solo de este navegador */
  if(window.soporteMias && soporteMias.olvidarViejas) soporteMias.olvidarViejas(60);

  traerGuiasPublicas();
  /* lo que GTIC fue apuntando desde la bandeja se suma a lo que trajo el
     cuadro de Patrimonio: por eso se pide al servidor al abrir la página */
  if(typeof inventarioTraer === 'function') inventarioTraer().then(pintarEquipo);

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
  const CAMPOS_YO = ['gerencia', 'usuario', 'cedula', 'telefono', 'piso', 'oficina', 'cargo'];

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
    /* La cédula no se pinta, aunque vaya en la solicitud y salga impresa en la
       Hoja de Servicio. Este recuadro aparece solo, sin que nadie lo pida, en
       una pantalla que en la mayoría de las oficinas ve más gente que su dueño;
       y para confirmar que la página te reconoció bastan el nombre y dónde
       estás. Quien quiera verla o corregirla, la tiene en "Corregir". */
    $('recordadoDonde').textContent = [
      yo.gerencia,
      (yo.piso ? 'Piso ' + yo.piso : '') + (yo.oficina ? ', of. ' + yo.oficina : ''),
    ].filter(Boolean).join(' · ');
    mostrarIdentidad('recordado');
  }

  function aplicarYo(){
    const yo = leerYo();
    if(!yo || !yo.usuario) return false;

    /* Lo que este navegador recordó de antes puede venir corto: el cargo y la
       cédula se agregaron después, y a quien ya estaba recordado nadie se los
       iba a llenar nunca —la página no vuelve a mirar el directorio una vez
       que te reconoce—. Se completan aquí, solo los huecos: lo que la persona
       escribió alguna vez manda sobre la lista. */
    const p = directorioBuscar(yo.usuario);
    if(p){
      let creció = false;
      CAMPOS_YO.forEach(k => {
        if(!yo[k] && p[k]){ yo[k] = p[k]; creció = true; }
      });
      if(creció && $('recordarme').checked) guardarYo(yo);
    }

    CAMPOS_YO.forEach(k => { if(yo[k]) $(k).value = yo[k]; });
    $('quienEres').value = yo.usuario;
    pintarEquipo();
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
    $('cargo').value    = p.cargo || '';
    /* La cédula del listado solo si la persona no escribió otra: quien la
       corrigió a mano tendrá sus razones —una cédula mal copiada en el listado,
       un homónimo— y la lista no es una autoridad, es un punto de partida. */
    if(p.cedula && !$('cedula').value.trim()) $('cedula').value = p.cedula;
    marcar('quienEres', '');
    pintarEquipo();
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
  const OBLIGATORIOS = ['gerencia', 'usuario', 'piso', 'oficina', 'atajo', 'descripcion'];

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
    /* Sin esto, tres de cada diez solicitudes llegaban sin clasificar y el
       técnico tenía que adivinar qué llevar. "Otra cosa" cuenta como elegir. */
    ['atajo',       v => v ? '' : 'Elige con qué necesitas ayuda. Si no encaja en ninguna, marca «Otra cosa».'],
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
      cargo:       $('cargo').value.trim() || null,
      descripcion: desc.value.trim(),
      tipo:        tipo.value || null,
      detalle:     detalle.value || null,
      /* El equipo va como el primer renglón de la Hoja de Servicio, que es
         donde el técnico lo escribiría a mano. Va con la clasificación puesta
         para que la hoja salga completa de una vez. */
      /* Un renglón por equipo: el CPU y su monitor son dos líneas de la hoja,
         que para eso tiene seis. */
      renglones:   equiposAdjuntos.map(e => ({
        tipo:    tipo.value || '',
        detalle: detalle.value || '',
        equipo:  e.equipo,
        marca:   e.marca,
        modelo:  e.modelo,
        serial:  e.serial,
      })),
    };
  }

  async function mandarAlServidor(datos){
    const B = window.SOPORTE_BACKEND;
    const viaRpc = B.servidor === 'supabase';
    /* Contra Supabase, insertar y devolver la fila en el mismo paso pediría
       que anon pueda LEER la tabla completa —y eso dejaría ver la cola de
       todos a cualquiera, que es justo lo que no se quiere—. Por eso ahí se
       llama a una función (RPC) que inserta con los permisos de quien es
       dueño de la tabla y entrega de vuelta solo lo mínimo (ver
       sql/migracion_01_solicitudes_sin_cuenta.sql). Con el servidor de casa
       se sigue hablando con la tabla tal cual, que es lo que servidor.js
       entiende, y B.url va vacío: la petición sale al mismo sitio que sirvió
       la página. */
    const ruta = viaRpc ? '/rest/v1/rpc/crear_solicitud' : '/rest/v1/solicitudes';
    const payload = viaRpc ? {
      p_gerencia: datos.gerencia, p_usuario: datos.usuario, p_cedula: datos.cedula,
      p_telefono: datos.telefono, p_piso: datos.piso, p_oficina: datos.oficina,
      p_cargo: datos.cargo, p_descripcion: datos.descripcion, p_tipo: datos.tipo,
      p_detalle: datos.detalle, p_renglones: datos.renglones,
    } : datos;
    const r = await fetch(B.url + ruta, {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        /* La fila vuelve en la respuesta: es la única forma de conocer el
           número, porque quien envía no tiene permiso para releerla después. */
        'Prefer': 'return=representation',
      }, soporteCabeceras(),
         viaRpc ? {'Authorization': 'Bearer ' + B.anonKey} : {}),
      body: JSON.stringify(payload),
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

  /* Enviada la solicitud no se cambia de pantalla: se refleja en el panel de
     seguimiento, que es donde vive el estado de todo lo demás. Abrir una
     página aparte para decir "quedó registrada" obligaba a volver, y dejaba el
     número en un sitio distinto del que luego habría que consultar. */
  async function reflejarEnvio(fila){
    soporteMias.anotar(fila);
    /* La planilla se vacía en cuanto la solicitud sale. Se hace aquí y no al
       volver a abrirse, porque abrirse es lo que pasa cuando GTIC cierra: si
       se limpiara entonces, se limpiaría delante de la persona.

       Mientras hubo pantalla de acuse esto lo hacía el botón de "pedir otra";
       al quitarla se quedó sin hacer, y la planilla volvía con lo de la vez
       pasada escrito y el medidor en 100%: parecía que hubiera algo a medio
       enviar. Lo que sí se conserva es quién eres —eso no se reescribe— y la
       casilla de recordarte, que la limpieza respeta. */
    limpiar();
    await pintarMias();
    const numero = 'GTIC-HS/' + String(fila.numero).padStart(3, '0') + '-' + fila.anio;
    const aviso = $('avisoUnaALaVez');
    aviso.className = 'aviso bueno';
    aviso.innerHTML = `<span>✓</span><div>
      <b>Tu solicitud quedó registrada con el N° ${escapar(numero)}.</b>
      Arriba puedes seguir en qué va.
      ${fila.prueba ? ' <b>Ojo:</b> fue un ensayo, no hay servidor y nadie más la ve.' : ''}
      <br>Podrás pedir otra en cuanto GTIC cierre esta.</div>`;
    aviso.hidden = false;
    avisoFijado = true;
    window.scrollTo({top: 0, behavior: menosMovimiento ? 'auto' : 'smooth'});
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
      /* El atajo se guarda en un campo oculto, que no se puede enfocar: si es
         lo que falta, se lleva el foco al primer cuadro, que es lo que la
         persona tiene que pulsar. */
      const primero = $('atajo').closest('.campo').classList.contains('mal')
        ? $('atajos').querySelector('.atajo')
        : form.querySelector('.campo.mal input:not([type=hidden]), .campo.mal select, .campo.mal textarea');
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
      /* El resguardo se anota dentro de reflejarEnvio. Va siempre, marque o no
         la casilla: eso decide si se recuerdan sus DATOS, no si puede seguir
         lo que acaba de pedir. */
      await reflejarEnvio(fila);
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
    /* form.reset() no toca los campos ocultos —ningún navegador los devuelve a
       su sitio, porque no son de escribir—, así que el atajo hay que soltarlo
       a mano. Si no, la planilla volvía con "La computadora no sirve" elegido
       por dentro sin ninguna tarjeta marcada por fuera, y el medidor contaba
       un dato que nadie había puesto. */
    $('atajo').value = '';
    $('atajos').querySelectorAll('.atajo').forEach(b => b.setAttribute('aria-pressed', 'false'));
    /* si quedó abierta la ventana de "quizá lo resuelvas ahora mismo", se
       cierra: era la ayuda de un problema que ya se mandó */
    cerrarAyuda();
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
    const viaRpc = B.servidor === 'supabase';
    /* Igual que al crearla: sin permiso de leer la tabla, la única forma de
       consultar la propia solicitud por su id sin abrir la lectura de todas
       es una función que corre con los permisos de quien es dueño. */
    const r = viaRpc
      ? await fetch(B.url + '/rest/v1/rpc/consultar_solicitud', {
          method: 'POST',
          headers: Object.assign({'Content-Type': 'application/json'},
            soporteCabeceras(), {'Authorization': 'Bearer ' + B.anonKey}),
          body: JSON.stringify({p_id: m.id}),
        })
      : await fetch(B.url + '/rest/v1/solicitudes?id=eq.' + encodeURIComponent(m.id),
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
  /* la hoja con su esquina doblada: el papel que uno se lleva */
  const PAPEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><polyline points="14 3 14 8 19 8"/><polyline points="9 14 12 17 15 14"/><line x1="12" y1="11" x2="12" y2="17"/></svg>';

  const VISTO = '<svg viewBox="0 0 24 24"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';

  /* ---------- el plazo para llevarse la hoja ----------
     La Hoja de Servicio lleva el nombre, la cédula, el teléfono y el cargo de
     quien pidió el soporte, y esta pantalla se abre lo mismo en el puesto de
     uno que en la computadora de recepción o en la de la sala de reuniones.
     Por eso el enlace no se queda encendido: dura cinco minutos desde que
     aparece a la vista —lo que toma bajarlo— y después se apaga.

     Lo que se apaga es el enlace, no el documento: la hoja sigue guardada en
     el servidor de GTIC, y para volver a tenerla se le pide a la gerencia. Es
     la misma idea del botón de borrar el rastro, pero sin tener que acordarse
     de pulsarlo. */
  const PLAZO_HOJA = 5 * 60 * 1000;
  const AVISA_HOJA = 60 * 1000;   /* cuando queda esto, el reloj se pone rojo */
  /* la circunferencia del aro de r=9 (2·π·9). Si cambia el radio, cambia aquí */
  const VUELTA = 56.55;

  const RELOJITO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';

  /* 4:07, no "247 segundos": un plazo se lee como se lee un reloj */
  function enReloj(ms){
    const t = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  /* El aro que se vacía. Va lleno al empezar y no queda nada al vencerse, que
     es como se lee un plazo sin tener que leer los números. */
  const aroHtml = queda =>
    `<span class="reloj" aria-hidden="true"><svg viewBox="0 0 24 24">
       <circle class="pista" cx="12" cy="12" r="9"/>
       <circle class="arco" cx="12" cy="12" r="9"
               style="stroke-dashoffset:${(VUELTA * (1 - queda / PLAZO_HOJA)).toFixed(2)}"/>
     </svg></span>`;

  /* Vencido no se deja el botón apagado y sin explicar: se dice qué pasó y
     dónde está la hoja, que es lo único que la persona necesita saber. */
  const vencidaHtml = () =>
    `<div class="mis-vencido">${RELOJITO}<span>Se venció el plazo para bajarla.
     La hoja queda guardada en GTIC: pídesela a la gerencia.</span></div>`;

  function hojaHtml(s){
    /* El plazo arranca la primera vez que esta pantalla enseña el botón, y
       solo si está a la vista: un repintado en una pestaña de atrás no le
       gasta a nadie sus cinco minutos. */
    const desde = (window.soporteMias && soporteMias.plazoHoja)
      ? soporteMias.plazoHoja(s.id, !document.hidden) : null;
    /* Sin plazo anotado —todavía no arrancó, o el navegador no deja
       guardarlo— el botón sale entero y sin cuenta atrás. */
    const queda = desde === null ? PLAZO_HOJA : desde + PLAZO_HOJA - Date.now();
    if(queda <= 0) return vencidaHtml();
    return `<a class="mis-pdf${queda <= AVISA_HOJA ? ' apurando' : ''}"
          href="${escapar(SOPORTE_BACKEND.url)}/rest/v1/hoja?id=eq.${escapar(s.id)}"
          download ${desde === null ? '' : `data-vence="${desde + PLAZO_HOJA}"`}
          title="Descargar la Hoja de Servicio en PDF. El enlace dura cinco minutos; después hay que pedírsela a GTIC."
          >${PAPEL}<span>Hoja de Servicio</span>${aroHtml(queda)}<b class="queda">${enReloj(queda)}</b></a>`;
  }

  /* La cuenta atrás corre en su propio latido, aparte del repintado de la
     lista: la lista se rehace cada quince segundos o cuando llega un aviso, y
     un plazo que solo bajara ahí se vería a saltos. Esto toca únicamente los
     números y el aro, sin rehacer nada, para no borrarle a nadie lo que esté
     escribiendo en la conversación. */
  let latido = null;

  function latirPlazos(){
    clearInterval(latido);
    latido = null;
    if(!document.querySelector('.mis-pdf[data-vence]')) return;
    latido = setInterval(() => {
      const chips = document.querySelectorAll('.mis-pdf[data-vence]');
      if(!chips.length){ clearInterval(latido); latido = null; return; }
      chips.forEach(a => {
        const queda = Number(a.dataset.vence) - Date.now();
        if(queda <= 0){ a.outerHTML = vencidaHtml(); return; }
        a.classList.toggle('apurando', queda <= AVISA_HOJA);
        const n = a.querySelector('.queda');
        if(n) n.textContent = enReloj(queda);
        const arco = a.querySelector('.arco');
        if(arco) arco.style.strokeDashoffset = (VUELTA * (1 - queda / PLAZO_HOJA)).toFixed(2);
      });
    }, 1000);
  }

  function pasosHtml(s){
    /* anulada no recorrió el camino, así que dibujarlo mentiría */
    if(s.estado === 'anulada'){
      return `<div class="mis-anulada">${s.anulada_por === 'usuario'
        ? 'Retiraste esta solicitud.'
        : 'Esta solicitud fue anulada por GTIC.'}
        Si sigues necesitando ayuda, puedes pedir una nueva.</div>`;
    }
    const donde = ETAPAS.findIndex(e => e.clave === s.estado);
    /* Al lado del camino, cuando ya está recorrido: la Hoja de Servicio firmada
       es el comprobante de que esto pasó, y quien lo pidió tiene derecho a
       guardárselo sin ir a pedírselo a GTIC. Va aquí y no en otro sitio porque
       es justo donde uno mira al ver que ya está atendida. Con su plazo: el
       comprobante es de uno, pero la pantalla puede no serlo. */
    const hoja = s.estado === 'atendida' ? hojaHtml(s) : '';
    return '<div class="pasos-fila"><div class="pasos">' + ETAPAS.map((e, i) => {
      const clase = i < donde ? 'hecho' : (i === donde ? 'ahora' : '');
      /* la última, alcanzada, es un fin: se marca cumplida y no "en curso" */
      const cumplida = i < donde || (i === donde && e.clave === 'atendida');
      return `<div class="paso ${cumplida ? 'hecho' : clase}">
        <div class="bola">${cumplida ? VISTO : ''}</div>
        <div class="rot">${escapar(e.rot)}</div>
        <div class="cuando">${i <= donde ? escapar(e.pie(s)) : ''}</div>
      </div>`;
    }).join('') + '</div>' + hoja + '</div>';
  }

  /* ---------- la conversación con el técnico ----------
     Sale en cuanto alguien la toma: hasta entonces no hay con quién hablar, y
     un cuadro de escribir sin destinatario solo genera mensajes al vacío. */
  const iniciales = n => String(n || '').trim().split(/\s+/).slice(0, 2)
    .map(p => p[0] || '').join('').toUpperCase() || '?';

  const hora = iso => {
    if(!iso) return '';
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    return mismoDia
      ? d.toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'})
      : d.toLocaleDateString('es-VE', {day: '2-digit', month: 'short'}) + ' ' +
        d.toLocaleTimeString('es-VE', {hour: '2-digit', minute: '2-digit'});
  };

  const GLOBO = '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.9-.9L3 20.5l1.6-4.8A8.4 8.4 0 013.6 11a8.4 8.4 0 018.4-8.4h.5a8.4 8.4 0 018.5 8.4z"/></svg>';

  /* El botón que abre la conversación, en la fila. Sin técnico asignado no
     aparece: hasta que alguien la toma no hay con quién hablar. */
  function chatBotonHtml(s){
    /* Solo mientras un técnico la tiene en la mano: antes no hay a quién
       escribirle, y una vez atendida la respuesta está en la hoja. */
    if(!s.tecnico || s.estado !== 'en_proceso') return '';
    const n = Array.isArray(s.mensajes) ? s.mensajes.length : 0;
    return `<button type="button" class="chat-boton ${n ? 'hay' : ''}" data-chat="${escapar(s.id)}"
      title="${n ? 'Ver la conversación con ' + escapar(s.tecnico) : 'Escribirle a ' + escapar(s.tecnico)}"
      >${GLOBO}${n ? `<span class="n">${n}</span>` : 'Escribirle a ' + escapar(s.tecnico.split(' ')[0])}</button>`;
  }

  function chatHtml(s){
    /* sin técnico asignado no hay interlocutor todavía */
    if(!s.tecnico || s.estado === 'anulada') return '';
    const msgs = Array.isArray(s.mensajes) ? s.mensajes : [];
    return `<div class="chat">
      <div class="chat-h">
        <div class="ic">${escapar(iniciales(s.tecnico))}</div>
        <div>
          <b>${escapar(s.tecnico)}</b>
          <span>${escapar(s.tecnico_cargo || 'GTIC')} · está atendiendo lo tuyo</span>
        </div>
      </div>
      <div class="chat-hilo" id="chatHilo">
        ${msgs.length ? msgs.map(m => `<div class="burbuja ${m.de === 'usuario' ? 'usuario' : 'gtic'}">` +
            `<div class="quien">${escapar(m.de === 'usuario' ? 'Tú' : m.nombre)}</div>` +
            (m.texto ? `<div class="texto">${escapar(m.texto)}</div>` : '') +
            soporteAdjuntos.enBurbuja(m.adjuntos) +
            `<div class="hora">${escapar(hora(m.en))}</div>` +
          `</div>`).join('')
          : `<div class="chat-vacio">Puedes escribirle si necesitas contarle algo más:<br>
             a qué hora estás, dónde te consigue, o cualquier detalle que ayude.</div>`}
      </div>
      ${s.estado !== 'en_proceso' ? '<div class="chat-cerrado">Esta conversación se cerró: tu solicitud ya no está en proceso.</div>' : ''}
      <div class="adj-lista" id="adjLista" hidden></div>
      <div class="chat-escribir" ${s.estado === 'en_proceso' ? '' : 'hidden'}>
        ${soporteAdjuntos.botonHtml()}
        <textarea id="chatTexto" rows="1" maxlength="1000"
                  placeholder="Escríbele a ${escapar(s.tecnico.split(' ')[0])}…"></textarea>
        <button type="button" class="boton primario" id="chatEnviar"
                data-id="${escapar(s.id)}">Enviar</button>
      </div>
    </div>`;
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
      ${(s.estado === 'recibida' || (!verHistorial && s.tecnico)) ? `<div class="mis-acciones">
        ${verHistorial ? '' : chatBotonHtml(s)}
        ${s.estado === 'recibida' ? `<button type="button" class="enlace retirar" data-retirar="${escapar(s.id)}"
          >Me equivoqué, retirar esta solicitud</button>` : ''}
      </div>` : ''}
    </div>`;
  }

  /* Lo que se dice cuando el estado cambia solo. Sustituye al aviso que
     hubiera —el verde de "quedó registrada", por ejemplo— porque la novedad
     manda sobre lo anterior. */
  function avisarCambio(estado, s){
    const num = s ? ' N° ' + String(s.numero).padStart(3,'0') + '-' + s.anio : '';
    const dicho = {
      en_proceso: ['bueno', '👋', '<b>Un técnico tomó tu solicitud' + num + '.</b> Va en camino.'],
      atendida:   ['bueno', '✓',  '<b>Tu solicitud' + num + ' quedó atendida.</b> Abajo está lo que hicieron.'],
      anulada:    ['alerta', '⚠', '<b>Tu solicitud' + num + ' fue anulada.</b> Si sigues necesitando ayuda, puedes pedir otra.'],
      recibida:   ['alerta', '↩', '<b>Tu solicitud' + num + ' volvió a la cola.</b>'],
    }[estado];
    if(!dicho) return;
    const aviso = $('avisoUnaALaVez');
    aviso.className = 'aviso ' + dicho[0];
    aviso.innerHTML = '<span>' + dicho[1] + '</span><div>' + dicho[2] + '</div>';
    aviso.hidden = false;
    avisoFijado = true;
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

  /* ---------- la conversación, en su ventana ----------
     Fuera del panel de seguimiento: hablar es otra cosa que mirar en qué va, y
     el hilo dentro empujaba la planilla hacia abajo. */
  let chatId = null;
  /* lo último traído del servidor, para repintar el chat sin volver a pedirlo */
  let ultimasFilas = [];

  function pintarChat(){
    const s = ultimasFilas.find(x => x.id === chatId);
    if(!s) return;
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
    if(hilo) hilo.scrollTop = (!g || g.alFondo) ? hilo.scrollHeight : g.donde;
    /* el clip y su menu son otros despues de repintar: se vuelven a enganchar */
    soporteAdjuntos.conectar(chatId);
  }

  function abrirChat(id){
    chatId = id;
    /* Se muestra ANTES de pintar: mientras está oculta, la ventana no tiene
       altura, así que llevar el hilo al final no haría nada y la conversación
       se abriría por el principio en vez de por lo último dicho. */
    $('veloChat').hidden = false;
    document.body.style.overflow = 'hidden';
    pintarChat();
    const caja = $('chatTexto');
    if(caja) caja.focus();
  }

  function cerrarChat(){
    $('veloChat').hidden = true;
    chatId = null;
    document.body.style.overflow = '';
  }

  async function enviarMensaje(){
    const caja = $('chatTexto'), boton = $('chatEnviar');
    const texto = caja.value.trim();
    /* un mensaje puede ser solo una foto: la pantalla en negro se ve mejor que
       se cuenta */
    const adjuntos = soporteAdjuntos.pendientes();
    if((!texto && !adjuntos.length) || !chatId){ caja.focus(); return; }

    boton.disabled = true; caja.disabled = true;
    try{
      if(soporteHayBackend()){
        const B = window.SOPORTE_BACKEND;
        const r = await fetch(B.url + '/rest/v1/rpc/enviar_mensaje', {
          method: 'POST',
          headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
          body: JSON.stringify({id: chatId, texto, adjuntos}),
        });
        if(!r.ok){
          const c = await r.json().catch(() => ({}));
          throw new Error(c.message || ('HTTP ' + r.status));
        }
      }
      caja.value = '';
      soporteAdjuntos.vaciar();
      await pintarMias();      /* trae el hilo al día y repinta la ventana */
      const nueva = $('chatTexto');
      if(nueva){ nueva.disabled = false; nueva.focus(); }
      if($('chatEnviar')) $('chatEnviar').disabled = false;
    }catch(err){
      console.error('No se pudo enviar el mensaje:', err);
      boton.disabled = false; caja.disabled = false;
      alert('No se pudo enviar el mensaje. Revisa la conexión y vuelve a intentar.');
    }
  }

  $('misLista').addEventListener('click', e => {
    const globo = e.target.closest('[data-chat]');
    if(globo) abrirChat(globo.dataset.chat);
  });

  $('cerrarChat').addEventListener('click', cerrarChat);
  $('veloChat').addEventListener('click', e => {
    if(e.target === $('veloChat')) return cerrarChat();
    if(e.target.id === 'chatEnviar') enviarMensaje();
  });
  /* Enter envía; Mayús+Enter hace una línea nueva. Es lo que la gente espera de
     un chat, y evita que un mensaje corto obligue a soltar el teclado. */
  $('veloChat').addEventListener('keydown', e => {
    if(e.target.id !== 'chatTexto') return;
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      if(!$('chatEnviar').disabled) enviarMensaje();
    }
  });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!$('veloAyuda').hidden) cerrarAyuda();
    else if(!$('veloChat').hidden) cerrarChat();
  });

  /* ---------- retirar una solicitud ----------
     Solo mientras nadie la haya tomado. El servidor lo vuelve a comprobar: si
     un técnico la agarró en el segundo que pasó entre pintar el botón y
     pulsarlo, ahí se entera y no la retira. */
  $('misLista').addEventListener('click', async e => {
    const b = e.target.closest('[data-retirar]');
    if(!b) return;
    if(!confirm('¿Retirar esta solicitud? GTIC dejará de verla y podrás pedir otra.')) return;

    b.disabled = true;
    b.textContent = 'Retirando…';
    try{
      if(soporteHayBackend()){
        const B = window.SOPORTE_BACKEND;
        const r = await fetch(B.url + '/rest/v1/rpc/retirar_solicitud', {
          method: 'POST',
          headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
          body: JSON.stringify({id: b.dataset.retirar}),
        });
        if(!r.ok){
          const cuerpo = await r.json().catch(() => ({}));
          throw new Error(cuerpo.message || ('HTTP ' + r.status));
        }
      }else{
        soporteLocal.actualizar(b.dataset.retirar, {estado: 'anulada', anulada_por: 'usuario'});
      }
      await pintarMias();
      const aviso = $('avisoUnaALaVez');
      aviso.className = 'aviso bueno';
      aviso.innerHTML = '<span>✓</span><div><b>Solicitud retirada.</b> ' +
        'Ya puedes pedir lo que necesites.</div>';
      aviso.hidden = false;
    }catch(err){
      console.error('No se pudo retirar:', err);
      b.disabled = false;
      b.textContent = 'Me equivoqué, retirar esta solicitud';
      const aviso = $('avisoUnaALaVez');
      aviso.className = 'aviso malo';
      aviso.innerHTML = '<span>⚠</span><div><b>No se pudo retirar.</b> ' +
        escapar(err.message) + '</div>';
      aviso.hidden = false;
    }
  });

  /* ---------- que se entere solo ----------
     Nadie debería tener que pulsar "Actualizar" para enterarse de que un
     técnico ya tomó lo suyo. Se pregunta cada tanto, y de inmediato al volver
     a la pestaña —que es cuando de verdad se viene a mirar—.

     Se pregunta, no se escucha: el servidor podría empujar el cambio, pero eso
     obliga a mantener una conexión abierta por persona y ata el código a este
     servidor. Preguntar cada quince segundos son cuatro lecturas de un archivo
     por minuto; para una oficina, ni se nota.

     Con la pestaña de fondo no se pregunta nada: quien no está mirando no
     necesita enterarse, y al volver se pregunta enseguida. */
  /* Primero se intenta escuchar: el servidor avisa en el instante en que un
     técnico toma la solicitud, sin espera. Si esa línea no existe —contra
     Supabase, por ejemplo— o se cae, queda la consulta periódica.

     Con la línea abierta se pregunta cada minuto en vez de cada quince
     segundos: es solo una red por si un aviso se perdiera. */
  const CADA_ESCUCHANDO = 60000;
  const CADA_SIN_LINEA  = 15000;
  let reloj = null;
  let linea = null;

  function escuchar(){
    if(linea || typeof EventSource === 'undefined') return;
    const B = window.SOPORTE_BACKEND;
    /* la ruta de avisos es del servidor de casa; Supabase tiene lo suyo */
    if(!soporteHayBackend() || B.servidor !== 'local') return;
    try{
      linea = new EventSource(B.url + '/rest/v1/eventos');
      linea.onmessage = () => { if(soporteMias.leer().length) pintarMias(); };
      /* EventSource reintenta solo; si no lo logra, la consulta periódica
         sigue ahí y no hay nada que rescatar a mano */
      linea.onerror = () => {};
    }catch(e){ linea = null; }
  }

  function vigilar(){
    clearInterval(reloj);
    /* sin nada que seguir, no hay a qué estar pendiente */
    if(!soporteMias.leer().length) return;
    escuchar();
    reloj = setInterval(() => {
      if(!document.hidden) pintarMias();
    }, linea ? CADA_ESCUCHANDO : CADA_SIN_LINEA);
  }

  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && soporteMias.leer().length) pintarMias();
  });

  /* Pulsar el anillo despliega el historial completo, y volver a pulsarlo
     regresa a lo que sigue en curso. */
  let verHistorial = false;
  $('misAnilloBoton').addEventListener('click', () => {
    verHistorial = !verHistorial;
    pintarMias();
  });

  /* Dos consultas pueden estar en vuelo a la vez —la del arranque y la que
     dispara un envío— y no tienen por qué volver en orden. Sin esto, la vieja
     termina la última y repinta encima de la nueva: el aviso verde de "quedó
     registrada" desaparecía bajo el de "ya tienes una abierta". Cada corrida
     toma un número y solo pinta si sigue siendo la última. */
  let corridaMias = 0;
  /* El estado que se estaba mostrando, para saber si cambió sin que la persona
     tocara nada y poder avisárselo. */
  let estadoMostrado = null;

  async function pintarMias(){
    const corrida = ++corridaMias;
    const mias = soporteMias.leer();
    $('misSolicitudes').hidden = false;

    if(!mias.length){
      $('misResumen').textContent = 'Aquí seguirás tu solicitud en cuanto la envíes';
      $('misLista').innerHTML = caminoVacioHtml();
      $('botonRefrescarMias').hidden = true;
      /* sin nada pedido no hay historial que abrir */
      $('misAnilloBoton').disabled = true;
      $('misAnilloBoton').title = 'Todavía no has pedido nada';
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

    /* llegó tarde: ya hay una consulta más nueva pintando */
    if(corrida !== corridaMias) return;

    /* lo recién traído, para que la ventana del chat se repinte con lo mismo */
    ultimasFilas = filas;
    if(chatId && !$('veloChat').hidden) pintarChat();

    if(!filas.length){
      $('misResumen').textContent = 'No se pudo consultar el estado. Revisa la conexión.';
      $('misLista').innerHTML = '';
      return;
    }
    const abiertas = filas.filter(s => s.estado === 'recibida' || s.estado === 'en_proceso');

    /* Aquí solo vive lo que sigue en curso. En cuanto GTIC cierra una, se va:
       lo terminado no es un pendiente. No se pierde nada —la respuesta del
       técnico incluida— porque el anillo abre el historial completo. */
    const enCurso = abiertas;
    const visibles = verHistorial ? filas : enCurso;

    /* Se poda contra lo que el servidor todavía tiene, no contra lo que se ve:
       lo cerrado se esconde, no se pierde — es lo que sostiene el historial. */
    soporteMias.podar(filas.map(s => s.id));

    /* El anillo mide lo que está en curso, aunque se esté viendo el historial:
       en qué va lo tuyo, no cuántas llevas. Sin nada en curso, se queda en
       cero, que es lo honesto: no hay trámite andando. */
    const manda = enCurso[0] || null;
    pintarAnilloMias(manda);

    const ETAPA_LBL = {recibida: 'GTIC la recibió y está en cola',
                       en_proceso: 'Un técnico la está atendiendo'};
    /* Cuántas quedan escondidas: sin decirlo, el anillo no invita a pulsarlo. */
    const ocultas = filas.length - enCurso.length;
    const cola = ocultas
      ? ' · ' + ocultas + (ocultas === 1 ? ' anterior' : ' anteriores')
      : '';

    $('misResumen').textContent = verHistorial
      ? 'Todo lo que has pedido · ' + filas.length +
        (filas.length === 1 ? ' solicitud' : ' solicitudes')
      : (manda
          ? ETAPA_LBL[manda.estado] + ' · N° ' + String(manda.numero).padStart(3,'0') + '-' + manda.anio + cola
          : 'No tienes nada pendiente' + cola);

    /* El anillo solo se ofrece si hay algo más detrás. */
    const boton = $('misAnilloBoton');
    boton.disabled = !ocultas && !verHistorial;
    boton.title = verHistorial
      ? 'Volver a lo que sigue en curso'
      : (ocultas ? 'Ver todas tus solicitudes' : 'No tienes solicitudes anteriores');
    boton.setAttribute('aria-pressed', String(verHistorial));
    /* Un aviso puede llegar mientras la persona escribe, y el repintado le
       borraría el mensaje a medias. Se guarda lo escrito, si estaba tecleando
       ahí, y por dónde iba el hilo; se devuelve todo después de pintar. */
    const cajaVieja = $('chatTexto');
    const guardado = cajaVieja ? {
      texto: cajaVieja.value,
      escribiendo: document.activeElement === cajaVieja,
      hilo: $('chatHilo') ? $('chatHilo').scrollTop : 0,
      alFondo: $('chatHilo')
        ? $('chatHilo').scrollHeight - $('chatHilo').clientHeight - $('chatHilo').scrollTop < 24
        : true,
    } : null;

    /* Sin nada en curso se enseña el camino apagado, igual que a quien nunca
       ha pedido: dice qué va a pasar cuando pida, en vez de un hueco. Lo ya
       resuelto está a un toque del anillo. */
    $('misLista').innerHTML = visibles.length
      ? visibles.map(filaMiaHtml).join('')
      : caminoVacioHtml();

    if(guardado){
      const caja = $('chatTexto');
      if(caja){
        caja.value = guardado.texto;
        if(guardado.escribiendo){
          caja.focus();
          caja.setSelectionRange(caja.value.length, caja.value.length);
        }
      }
      const hilo = $('chatHilo');
      /* si estaba mirando el final, se queda en el final —que es donde acaba de
         llegar lo nuevo—; si había subido a leer, se respeta dónde estaba */
      if(hilo) hilo.scrollTop = guardado.alFondo ? hilo.scrollHeight : guardado.hilo;
    }else{
      const hilo = $('chatHilo');
      if(hilo) hilo.scrollTop = hilo.scrollHeight;
    }
    $('misLista').classList.toggle('una-sola', visibles.length <= 1);
    $('misLista').scrollTop = 0;
    latirPlazos();
    revisarVelo();
    bloquearSiHayAbierta(abiertas[0] || null);

    /* ¿Cambió solo, mientras la persona miraba? Entonces se le dice: un
       cambio silencioso en pantalla es un cambio que nadie ve. */
    const ahora = manda ? manda.estado : (filas[0] ? filas[0].estado : null);
    if(estadoMostrado && ahora && ahora !== estadoMostrado){
      avisarCambio(ahora, manda || filas[0]);
    }
    estadoMostrado = ahora;
    vigilar();
  }

  /* ---------- una a la vez ----------
     Con una solicitud abierta no se puede pedir otra: el formulario se guarda
     y en su lugar queda el porqué. La regla la impone el servidor —esto es
     solo no dejar escribir en balde— porque desde otro navegador la pantalla
     no sabría nada. */
  /* Hay un mensaje que la persona acaba de recibir y que no se debe pisar. */
  let avisoFijado = false;

  function bloquearSiHayAbierta(abierta){
    const aviso = $('avisoUnaALaVez');
    if(!abierta){
      avisoFijado = false;
      $('pantallaFormulario').hidden = false;
      /* el título y el medidor acompañan a la planilla */
      $('tarjetaAvance').hidden = false;
      $('intro').hidden = false;
      aviso.hidden = true;
      return;
    }
    $('pantallaFormulario').hidden = true;
    $('tarjetaAvance').hidden = true;
    $('intro').hidden = true;
    /* Si ya hay un mensaje puesto por un envío recién hecho o por un cambio de
       estado, se respeta: la consulta que corre cada quince segundos no puede
       borrar la noticia que la persona acaba de recibir. Al recargar la página
       vuelve a salir el de siempre. */
    if(avisoFijado) return;
    aviso.className = 'aviso alerta';
    aviso.innerHTML = `<span>🕓</span><div>
      <b>Ya tienes una solicitud abierta</b> —la N° ${escapar(String(abierta.numero).padStart(3,'0'))}-${escapar(String(abierta.anio))}—
      así que no puedes pedir otra todavía. Arriba ves por dónde va.
      <br>En cuanto GTIC la cierre, esta planilla vuelve a abrirse.
      Si es algo urgente y distinto, llama a la gerencia.</div>`;
    aviso.hidden = false;
  }

  $('botonRefrescarMias').addEventListener('click', () => pintarMias());

  /* Borrar el rastro de esta máquina. Se pregunta antes porque no tiene vuelta
     atrás: sin los id guardados no hay forma de volver a ver esas solicitudes
     —el servidor no las entrega por nombre, justamente para que nadie pueda
     leer las de otro—. Lo que ya se envió sigue en GTIC, intacto. */
  $('botonOlvidar').addEventListener('click', () => {
    const cuantas = soporteMias.leer().length;
    if(!confirm('Se borra de esta computadora el seguimiento de ' +
                (cuantas === 1 ? 'tu solicitud' : 'tus ' + cuantas + ' solicitudes') +
                ' y tus datos guardados.\n\nLo que ya enviaste sigue en GTIC: esto solo quita ' +
                'el rastro de este navegador, y no se puede deshacer.')) return;
    soporteOlvidarTodo();
    location.reload();
  });

  /* ---------- arranque ---------- */
  $('avisoSinServidor').hidden = soporteHayBackend();
  aplicarYo();
  pintarAvance();
  pintarMias();
})();
