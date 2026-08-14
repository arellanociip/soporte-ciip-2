/* ---------- La cuenta de quien pide soporte ----------
   OPCIONAL, y eso es lo que la define. Sin cuenta se manda una solicitud
   igual que siempre y se sigue por el id que queda en este navegador. Una
   clave olvidada no puede dejar a nadie sin poder pedir ayuda: entonces
   llamaría por teléfono, que es justo lo que este sistema vino a sustituir.

   Lo que da entrar: el seguimiento deja de ser del navegador y pasa a ser de
   la persona. Quien cambia de equipo —o le limpian el suyo— sigue viendo lo
   que pidió. Eso es todo; no habilita nada más.

   Solo existe contra Supabase. El servidor de la oficina no tiene sesiones
   para las 224 personas de la casa, y montárselas sería un sistema entero
   para el modo que es el respaldo: ahí el seguimiento por navegador funciona
   igual que siempre y este archivo se queda quieto.

   Prefijo: soporteCuenta. */
(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const B = window.SOPORTE_BACKEND || {};
  const HAY = B.servidor === 'supabase';

  /* La sesión vive aquí y no en una variable: recargar la página no puede
     ser lo mismo que salirse. */
  const LLAVE = 'soporte_cuenta';

  function leerSesion(){
    try{ return JSON.parse(localStorage.getItem(LLAVE)); }catch(e){ return null; }
  }
  function guardarSesion(s){
    try{ localStorage.setItem(LLAVE, JSON.stringify(s)); }
    catch(e){ console.warn('No se pudo guardar la sesión:', e); }
  }
  function borrarSesion(){ localStorage.removeItem(LLAVE); }

  const cabeceras = () => Object.assign(
    {'Content-Type': 'application/json'}, window.soporteCabeceras());

  /* Lo que Supabase devuelve al entrar, guardado como lo necesita la página. */
  function anotar(r){
    const s = {
      token: r.access_token,
      refresco: r.refresh_token,
      expira: Date.now() + (Number(r.expires_in || 3600) * 1000),
      correo: (r.user && r.user.email) || '',
      nombre: (r.user && r.user.user_metadata && r.user.user_metadata.nombre) || '',
    };
    guardarSesion(s);
    return s;
  }

  /* El testigo dura una hora. Antes de usarlo se renueva si le queda poco:
     que se venza a mitad de un envío sería perder lo escrito por un detalle
     que la página podía haber resuelto sola. */
  async function testigo(){
    let s = leerSesion();
    if(!s) return null;
    if(Date.now() < s.expira - 60000) return s.token;
    try{
      const r = await fetch(B.url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: cabeceras(),
        body: JSON.stringify({refresh_token: s.refresco}),
      });
      if(!r.ok) throw new Error('vencida');
      return anotar(await r.json()).token;
    }catch(e){
      /* Si no se pudo renovar, la sesión se acabó. No es un fallo que haya que
         anunciar: se vuelve al modo sin cuenta, que funciona. */
      borrarSesion();
      pintarCabecera();
      return null;
    }
  }

  /* Pedir algo firmado. Devuelve null sin ruido si no hay sesión: quien llama
     ya tiene su camino sin cuenta. */
  async function pedir(ruta, opts){
    const t = await testigo();
    if(!t) return null;
    return fetch(B.url + ruta, Object.assign({}, opts || {}, {
      headers: Object.assign({'Authorization': 'Bearer ' + t}, cabeceras(),
                             (opts && opts.headers) || {}),
    }));
  }

  /* ---------- entrar y registrarse ----------
     Son dos rutas distintas de Supabase pero una sola pantalla: quien llega
     aquí no tiene por qué saber si ya tiene cuenta o no. */
  async function entrar(correo, clave){
    const r = await fetch(B.url + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: cabeceras(),
      body: JSON.stringify({email: correo, password: clave}),
    });
    const c = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(c.msg || c.error_description || c.message || 'No se pudo entrar.');
    return anotar(c);
  }

  async function registrarse(correo, clave, nombre){
    const r = await fetch(B.url + '/auth/v1/signup', {
      method: 'POST', headers: cabeceras(),
      body: JSON.stringify({email: correo, password: clave, data: {nombre: nombre || ''}}),
    });
    const c = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(c.msg || c.error_description || c.message || 'No se pudo crear la cuenta.');
    /* Con la confirmación por correo encendida, Supabase no devuelve testigo:
       la cuenta existe pero hay que pinchar un enlace antes de entrar. */
    if(!c.access_token) return null;
    return anotar(c);
  }

  async function salir(){
    const t = await testigo();
    if(t){
      fetch(B.url + '/auth/v1/logout', {method: 'POST',
        headers: Object.assign({'Authorization': 'Bearer ' + t}, cabeceras())}).catch(() => {});
    }
    borrarSesion();
  }

  /* ---------- lo que ya se había pedido sin cuenta ----------
     Estrenar cuenta no puede ser empezar de cero: quien lleva meses pidiendo
     soporte tiene esos id en su navegador, delante, y perderlos por entrar
     sería un castigo por identificarse. Se los ofrece al servidor, que solo
     adopta las que no tengan dueño (ver la migración 03). */
  async function adoptarLoDeAntes(){
    const mias = (window.soporteMias ? window.soporteMias.leer() : [])
      .map(m => m.id).filter(Boolean);
    if(!mias.length) return 0;
    try{
      const r = await pedir('/rest/v1/rpc/adoptar_solicitudes', {
        method: 'POST', body: JSON.stringify({p_ids: mias}),
      });
      if(!r || !r.ok) return 0;
      return Number(await r.json()) || 0;
    }catch(e){ return 0; }
  }

  /* ---------- la barra de arriba ---------- */
  function pintarCabecera(){
    const caja = $('cabSesion');
    if(!caja) return;
    caja.hidden = !HAY;
    if(!HAY) return;
    const s = leerSesion();
    $('quienSoy').textContent = s ? (s.nombre || s.correo) : '';
    $('quienSoy').hidden = !s;
    $('botonEntrarCuenta').hidden = !!s;
    $('botonSalirCuenta').hidden = !s;
  }

  /* ---------- la ventana ---------- */
  let modo = 'entrar';      /* o 'registrarse' */

  function abrir(cual){
    modo = cual || 'entrar';
    pintarModo();
    $('avisoCuentaUsuario').hidden = true;
    $('cuCorreo').value = '';
    $('cuClave').value = '';
    $('cuNombre').value = '';
    $('veloCuentaUsuario').hidden = false;
    document.body.style.overflow = 'hidden';
    $('cuCorreo').focus();
  }

  function cerrar(){
    $('veloCuentaUsuario').hidden = true;
    document.body.style.overflow = '';
  }

  function pintarModo(){
    const nuevo = modo === 'registrarse';
    $('tituloCuentaUsuario').textContent = nuevo ? 'Crear una cuenta' : 'Entrar';
    $('bajadaCuentaUsuario').textContent = nuevo
      ? 'Con tu correo de la casa. Sirve para seguir lo que pidas desde cualquier equipo.'
      : 'Para ver lo que has pedido desde cualquier equipo. Si no tienes cuenta, no hace falta: puedes mandar tu solicitud igual.';
    $('campoNombreCuenta').hidden = !nuevo;
    $('botonAceptarCuenta').textContent = nuevo ? 'Crear la cuenta' : 'Entrar';
    $('cambiarModoCuenta').textContent = nuevo
      ? 'Ya tengo cuenta · entrar'
      : 'No tengo cuenta · crear una';
  }

  function fallar(texto){
    $('avisoCuentaUsuario').innerHTML = '<span>⚠</span><div>' + texto + '</div>';
    $('avisoCuentaUsuario').hidden = false;
  }

  async function aceptar(){
    const correo = $('cuCorreo').value.trim();
    const clave = $('cuClave').value;
    if(!correo || !clave){ fallar('Hacen falta el correo y la contraseña.'); return; }

    const boton = $('botonAceptarCuenta');
    const antes = boton.textContent;
    boton.disabled = true; boton.textContent = 'Un momento…';
    $('avisoCuentaUsuario').hidden = true;
    try{
      let s;
      if(modo === 'registrarse'){
        s = await registrarse(correo, clave, $('cuNombre').value.trim());
        if(!s){
          fallar('Cuenta creada. Revisa tu correo y pincha el enlace para poder entrar.');
          boton.disabled = false; boton.textContent = antes;
          modo = 'entrar'; pintarModo();
          return;
        }
      }else{
        s = await entrar(correo, clave);
      }
      const adoptadas = await adoptarLoDeAntes();
      cerrar();
      pintarCabecera();
      window.dispatchEvent(new CustomEvent('soporte:sesion', {detail: {entro: true, adoptadas}}));
    }catch(err){
      fallar(escapar(err.message || 'No se pudo.'));
    }
    boton.disabled = false; boton.textContent = antes;
  }

  const escapar = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* ---------- lo que la página usa ---------- */
  window.soporteCuenta = {
    hay: () => HAY,
    dentro: () => !!leerSesion(),
    quien: () => leerSesion(),
    pedir,
    abrir,
    async salir(){
      await salir();
      pintarCabecera();
      window.dispatchEvent(new CustomEvent('soporte:sesion', {detail: {entro: false}}));
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    pintarCabecera();
    if(!HAY) return;
    const engancha = (id, fn) => { const b = $(id); if(b) b.addEventListener('click', fn); };
    engancha('botonEntrarCuenta', e => { e.preventDefault(); abrir('entrar'); });
    engancha('botonSalirCuenta',  e => { e.preventDefault(); window.soporteCuenta.salir(); });
    engancha('cerrarCuentaUsuario', cerrar);
    engancha('cancelarCuentaUsuario', cerrar);
    engancha('botonAceptarCuenta', aceptar);
    engancha('cambiarModoCuenta', e => {
      e.preventDefault();
      modo = modo === 'entrar' ? 'registrarse' : 'entrar';
      pintarModo();
      $('avisoCuentaUsuario').hidden = true;
    });
    const ver = $('verClaveUsuario');
    if(ver) ver.addEventListener('click', () => {
      const c = $('cuClave');
      const viendo = c.type === 'text';
      c.type = viendo ? 'password' : 'text';
      ver.setAttribute('aria-pressed', String(!viendo));
      c.focus();
    });
    /* Enter en la clave hace lo que dice el botón: nadie espera tener que
       buscar el ratón para entrar. */
    const caja = $('cuClave');
    if(caja) caja.addEventListener('keydown', e => { if(e.key === 'Enter') aceptar(); });
  });
})();
