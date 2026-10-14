/* ---------- Aviso de versión nueva ----------
   Cuando se publica un cambio, quien tenga la página abierta sigue con el
   código viejo hasta que recargue, y nadie se entera. Aquí se toma la huella
   (ETag) de la página y de sus propios .js y .css al cargar, y se vuelve a
   mirar cada rato y al volver a la pestaña: si alguna cambió, sale un aviso
   con un botón para recargar.

   No recarga solo: alguien puede estar a mitad de escribir una solicitud o
   unas observaciones, y eso no se le pierde por sorpresa.

   Vercel da un ETag que es el hash del contenido, así que no hay número de
   versión que acordarse de subir. El servidor local no lo manda, y ahí esto
   simplemente no hace nada. */
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

  async function huella(){
    const etags = await Promise.all(archivos().map(async p => {
      try{
        const r = await fetch(p, {method: 'HEAD', cache: 'no-store'});
        return r.ok ? (r.headers.get('etag') || '') : '';
      }catch(e){ return ''; }
    }));
    /* si falta alguno (sin red, servidor local) no se compara: un hueco no
       es una versión nueva */
    return etags.every(Boolean) ? etags.join('|') : null;
  }

  let inicial = null;
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

  async function mirar(){
    if(avisado || (inicial !== null && document.hidden)) return;
    const h = await huella();
    if(!h) return;
    if(inicial === null){ inicial = h; return; }
    if(h !== inicial) avisar();
  }

  mirar();
  setInterval(mirar, CADA);
  document.addEventListener('visibilitychange', mirar);
})();
