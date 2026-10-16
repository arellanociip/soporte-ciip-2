/* ---------- Aviso de versión nueva ----------
   Cuando se publica un cambio, quien tenga la página abierta sigue con el
   código viejo hasta que recargue, y nadie se entera. Aquí se toma la huella
   (ETag) de la página y de sus propios .js y .css al cargar, y se vuelve a
   mirar cada rato y al volver a la pestaña: si alguna cambió, sale un aviso
   con un botón para recargar.

   No recarga solo: alguien puede estar a mitad de escribir una solicitud o
   unas observaciones, y eso no se le pierde por sorpresa.

   El ETag solo sirve de primera señal: en algunas redes llegaba distinto sin
   que el archivo hubiera cambiado, y el aviso salía cada vez que se volvía a
   la pestaña. Así que cuando un ETag cambia se baja ese archivo y se compara
   su contenido (SHA-256) con el que tenía al cargar. Solo si el contenido es
   otro se avisa. El servidor local no manda ETag, y ahí esto no hace nada. */
(function(){
  const CADA = 2 * 60 * 1000;

  /* La página y lo que carga de este mismo sitio; las fuentes de Google no
     son cosa nuestra. */
  function archivos(){
    const propios = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
      .map(el => new URL(el.src || el.href, location.href))
      .filter(u => u.origin === location.origin)
      .map(u => u.pathname);
    return [location.pathname, ...propios];
  }

  async function etag(p){
    try{
      const r = await fetch(p, {method: 'HEAD', cache: 'no-store'});
      return r.ok ? (r.headers.get('etag') || '').replace(/^W\//, '') : '';
    }catch(e){ return ''; }
  }

  async function contenido(p){
    try{
      const r = await fetch(p, {cache: 'no-store'});
      if(!r.ok) return '';
      const h = await crypto.subtle.digest('SHA-256', await r.arrayBuffer());
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }catch(e){ return ''; }
  }

  /* por archivo: el ETag y el hash del contenido que se vio la última vez */
  const visto = new Map();
  let avisado = false;

  function avisar(){
    if(avisado) return;
    avisado = true;
    const d = document.createElement('div');
    d.className = 'aviso-version';
    d.setAttribute('role', 'status');
    d.innerHTML = '<span>Hay una versión nueva de la página.</span>'
      + '<button type="button" class="boton primario">Recargar</button>';
    d.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(d);
  }

  async function mirarUno(p){
    const e = await etag(p);
    if(!e) return false;   /* sin red o sin ETag: no se sabe, no se avisa */
    const antes = visto.get(p);
    if(!antes){
      visto.set(p, {etag: e, hash: await contenido(p)});
      return false;
    }
    if(e === antes.etag) return false;
    const h = await contenido(p);
    if(!h || !antes.hash) return false;
    if(h === antes.hash){
      /* mismo archivo con otra etiqueta: se aprende la etiqueta y se sigue */
      antes.etag = e;
      return false;
    }
    console.info('[version] cambió', p, antes.etag, '→', e);
    return true;
  }

  let mirando = false;
  async function mirar(){
    if(avisado || mirando || (visto.size && document.hidden)) return;
    mirando = true;
    try{
      const cambios = await Promise.all(archivos().map(mirarUno));
      if(cambios.some(Boolean)) avisar();
    }finally{ mirando = false; }
  }

  mirar();
  setInterval(mirar, CADA);
  document.addEventListener('visibilitychange', mirar);
})();
