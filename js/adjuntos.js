/* ---------- Fotos y PDF en la conversación ----------
   Una foto de la pantalla dice en un segundo lo que cuesta tres mensajes
   escribir, y a veces lo único que hay es un PDF. Esto es lo mismo para las dos
   páginas —la de quien pide y la bandeja de GTIC—, así que vive aparte en vez
   de escrito dos veces.

   Un solo botón, el clip, con las dos opciones dentro: elegir entre "foto" y
   "documento" antes de tocar nada es una pregunta que el sistema puede hacerse
   solo, pero el navegador necesita saber qué filtro poner en el cuadro de
   archivos, y ofrecer los dos filtros de golpe llena la lista de basura.

   Las fotos se achican aquí antes de subirlas: las de un teléfono vienen de
   cuatro o cinco megas y para ver una pantalla rota sobra con 1600 píxeles.
   Sube en un minuto lo que si no tardaría diez, y el disco de la casa no se
   llena de retratos de monitores.
   Prefijo: adj. */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);

  const LADO_MAXIMO = 1600;      /* píxeles del lado más largo de una foto */
  const CUANTOS = 4;             /* por mensaje; más es un correo, no un chat */

  /* Lo subido y todavía sin mandar. Solo hay una conversación abierta a la vez
     en cada página, así que con una lista basta. */
  let pendientes = [];
  let solicitudId = null;
  let alCambiar = function(){};

  const CLIP = '<svg viewBox="0 0 24 24"><path d="M21.4 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>';

  /* El botón y su menú, para meterlo en el compositor de cada página. */
  function botonHtml(){
    return `<div class="adj">
      <button type="button" class="adj-boton" id="adjBoton" aria-haspopup="true"
              aria-expanded="false" title="Adjuntar una foto o un PDF">${CLIP}</button>
      <div class="adj-menu" id="adjMenu" hidden role="menu">
        <button type="button" role="menuitem" data-adj="foto">🖼️ Foto o imagen</button>
        <button type="button" role="menuitem" data-adj="pdf">📄 Documento PDF</button>
      </div>
      <input type="file" id="adjFoto" accept="image/jpeg,image/png" multiple hidden>
      <input type="file" id="adjPdf" accept="application/pdf" multiple hidden>
    </div>`;
  }

  const pesa = n => n < 1024 * 1024
    ? Math.max(1, Math.round(n / 1024)) + ' KB'
    : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* Lo que ya está subido y espera al botón de enviar. */
  function pintarLista(){
    const caja = $('adjLista');
    if(!caja) return;
    caja.innerHTML = pendientes.map((a, i) => a.tipo === 'application/pdf'
      ? `<div class="adj-ficha"><span class="ic">📄</span>
           <span class="n">${esc(a.nombre)}</span><span class="p">${esc(pesa(a.tamano))}</span>
           <button type="button" data-quitar="${i}" aria-label="Quitar">✕</button></div>`
      : `<div class="adj-ficha foto"><img src="${esc(a.url)}" alt="">
           <span class="n">${esc(a.nombre)}</span><span class="p">${esc(pesa(a.tamano))}</span>
           <button type="button" data-quitar="${i}" aria-label="Quitar">✕</button></div>`
    ).join('');
    caja.hidden = !pendientes.length;
  }

  /* Achicar una foto sin pedirle nada a nadie: se dibuja en un lienzo del
     tamaño que hace falta y se saca de ahí. Los PDF pasan tal cual. */
  function aDatos(archivo){
    return new Promise((listo, falla) => {
      if(archivo.type === 'application/pdf'){
        const l = new FileReader();
        l.onload = () => listo(l.result);
        l.onerror = () => falla(new Error('No se pudo leer el archivo.'));
        l.readAsDataURL(archivo);
        return;
      }
      const lector = new FileReader();
      lector.onload = () => {
        const img = new Image();
        img.onload = () => {
          const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
          if(escala === 1 && archivo.size < 900 * 1024){ listo(lector.result); return; }
          const lienzo = document.createElement('canvas');
          lienzo.width  = Math.round(img.width  * escala);
          lienzo.height = Math.round(img.height * escala);
          lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
          /* JPEG aunque venga PNG: una foto de pantalla en PNG pesa el triple */
          listo(lienzo.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => falla(new Error('Esa imagen no se pudo abrir.'));
        img.src = lector.result;
      };
      lector.onerror = () => falla(new Error('No se pudo leer el archivo.'));
      lector.readAsDataURL(archivo);
    });
  }

  function avisar(texto){
    const caja = $('adjLista');
    if(!caja) return;
    caja.hidden = false;
    caja.insertAdjacentHTML('beforeend', `<div class="adj-mal">⚠ ${esc(texto)}</div>`);
    setTimeout(() => { const m = caja.querySelector('.adj-mal'); if(m) m.remove(); }, 6000);
  }

  async function subir(archivos){
    const boton = $('adjBoton');
    for(const archivo of Array.from(archivos)){
      /* el tope se mira aqui antes de leer nada: subir ocho megas para que el
         servidor los rechace es hacer esperar a alguien para nada */
      if(archivo.size > 8 * 1024 * 1024){
        avisar('"' + archivo.name + '" pesa mas de 8 MB. Mandalo por correo o comprimelo.');
        continue;
      }
      if(pendientes.length >= CUANTOS){
        avisar('Van ' + CUANTOS + ' archivos, que es el tope de un mensaje.');
        break;
      }
      if(boton) boton.classList.add('subiendo');
      try{
        const datos = await aDatos(archivo);
        const r = await fetch(SOPORTE_BACKEND.url + '/rest/v1/rpc/subir_adjunto', {
          method: 'POST',
          headers: Object.assign({'Content-Type': 'application/json'}, soporteCabeceras()),
          body: JSON.stringify({id: solicitudId, nombre: archivo.name, datos}),
        });
        if(!r.ok){
          const c = await r.json().catch(() => ({}));
          throw new Error(c.message || ('HTTP ' + r.status));
        }
        pendientes.push((await r.json())[0]);
        pintarLista();
        alCambiar();
      }catch(e){
        avisar(e.message || 'No se pudo subir el archivo.');
      }
      if(boton) boton.classList.remove('subiendo');
    }
  }

  /* Engancha los gestos. Se llama cada vez que la página repinta el chat,
     porque al repintar los botones son otros. */
  function conectar(id, cambio){
    solicitudId = id;
    if(cambio) alCambiar = cambio;
    const boton = $('adjBoton'), menu = $('adjMenu');
    if(!boton || !menu) return;

    const cerrar = () => { menu.hidden = true; boton.setAttribute('aria-expanded', 'false'); };
    boton.onclick = e => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      boton.setAttribute('aria-expanded', String(!menu.hidden));
    };
    menu.onclick = e => {
      const b = e.target.closest('[data-adj]');
      if(!b) return;
      cerrar();
      $(b.dataset.adj === 'pdf' ? 'adjPdf' : 'adjFoto').click();
    };
    /* un clic en cualquier otro sitio lo cierra, como todo menú */
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') cerrar(); });

    ['adjFoto', 'adjPdf'].forEach(cual => {
      const campo = $(cual);
      if(!campo) return;
      campo.onchange = () => {
        if(campo.files && campo.files.length) subir(campo.files);
        campo.value = '';    /* si mandan dos veces el mismo, que vuelva a sonar */
      };
    });

    const lista = $('adjLista');
    if(lista){
      lista.onclick = e => {
        const q = e.target.closest('[data-quitar]');
        if(!q) return;
        pendientes.splice(Number(q.dataset.quitar), 1);
        pintarLista();
        alCambiar();
      };
    }
    pintarLista();
  }

  /* Lo que se manda con el mensaje, y el borrón después de mandarlo. */
  function pendientesAhora(){ return pendientes.slice(); }
  function vaciar(){ pendientes = []; pintarLista(); alCambiar(); }

  /* Cómo se ven dentro de una burbuja del hilo. Las fotos se ven; los PDF se
     abren, que dentro de una burbuja no cabe un documento. */
  function enBurbuja(adjuntos){
    if(!Array.isArray(adjuntos) || !adjuntos.length) return '';
    return '<div class="burbuja-adj">' + adjuntos.map(a => a.tipo === 'application/pdf'
      ? `<a class="adj-pdf" href="${esc(a.url)}" target="_blank" rel="noopener">
           <span class="ic">📄</span><span class="n">${esc(a.nombre)}</span>
           <span class="p">${esc(pesa(a.tamano))}</span></a>`
      : `<a class="adj-foto" href="${esc(a.url)}" target="_blank" rel="noopener"
           title="${esc(a.nombre)}"><img src="${esc(a.url)}" alt="${esc(a.nombre)}"></a>`
    ).join('') + '</div>';
  }

  window.soporteAdjuntos = {
    botonHtml, conectar, enBurbuja, vaciar,
    pendientes: pendientesAhora,
    cuantos: () => pendientes.length,
  };
})();
