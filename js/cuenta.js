/* ---------- La cuenta de quien pide soporte ----------
   OBLIGATORIA: para pedir soporte hay que entrar con el correo de la casa.
   La ventana sale sola al abrir, no se cierra, y la planilla de atrás está
   escondida hasta que se entra.

   Lo de aquí es la cortesía, no la regla. La regla vive en el servidor:
   crear_solicitud rechaza a quien no se identifique y `anon` ya no tiene
   permiso para llamarla (ver sql/migracion_04). Esconder un formulario en el
   navegador no impide nada —una petición se arma a mano—, así que esto solo
   evita que alguien lo llene en balde.

   Lo que gana quien entra: el seguimiento deja de ser del navegador y pasa a
   ser de la persona. Quien cambia de equipo —o le limpian el suyo— sigue
   viendo lo que pidió.

   Y lo que hay que asumir: quien olvide su clave, o tenga el correo mal
   escrito en gtic.correos_permitidos, no puede pedir soporte por aquí y
   acabará llamando por teléfono. Es el precio de exigir identidad. Si un día
   estorba más de lo que ayuda, la migración 04 explica cómo volver atrás.

   Solo existe contra Supabase. El servidor de la oficina no tiene sesiones
   para las 177 personas de la casa, y montárselas sería un sistema entero
   para el modo que es el respaldo: ahí se sigue pidiendo soporte sin cuenta,
   como siempre, y este archivo se queda quieto.

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

  /* ---------- la barra de arriba, y la vuelta a la ventana ---------- */
  function pintarCabecera(){
    pintarPuerta();
    const caja = $('cabSesion');
    if(!caja) return;
    const s = leerSesion();
    caja.hidden = !HAY || !s;          /* sin sesión no hay nada que decir ahí */
    const entrar = $('botonEntrarCuenta');
    if(entrar) entrar.hidden = !HAY || !!s;
    if(!HAY) return;
    $('quienSoy').textContent = s ? (s.nombre || s.correo) : '';
    $('quienSoy').hidden = !s;
    $('botonSalirCuenta').hidden = !s;
    /* Entrar es justo lo que deja de ser verdad esa frase. */
    const donde = $('dondeSeGuarda');
    if(donde) donde.textContent = s
      ? 'Esto va con tu cuenta: lo ves desde cualquier equipo.'
      : 'Esto se guarda en este navegador.';
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
    /* Vaciar el valor no basta: el navegador rellena las credenciales
       guardadas después, aunque el campo esté vacío en ese instante (ver la
       nota en pintarModo). readonly sí lo frena —Chrome y Firefox no
       autorrellenan un campo de solo lectura—, y se quita en cuanto alguien
       lo toca, para no perder la comodidad de que el navegador la ofrezca al
       hacer clic. Se rearma aquí porque quitarSoloLectura() la retira para
       siempre una vez usada. */
    $('cuCorreo').setAttribute('readonly', '');
    $('cuClave').setAttribute('readonly', '');
    $('veloCuentaUsuario').hidden = false;
    document.body.style.overflow = 'hidden';
    /* El primer campo no es el mismo en los dos modos: creando cuenta, el
       de arriba es el nombre. */
    (modo === 'registrarse' ? $('cuNombre') : $('cuCorreo')).focus();
  }

  /* Solo se cierra cuando hay sesión. Sin ella no hay nada detrás que usar:
     la planilla está escondida y el servidor rechazaría el envío igual (ver
     sql/migracion_04). Una ventana que se puede cerrar para quedarse mirando
     una página vacía es peor que una que no se cierra. */
  function cerrar(){
    if(!leerSesion()) return;
    $('veloCuentaUsuario').hidden = true;
    document.body.style.overflow = '';
  }

  function pintarModo(){
    const nuevo = modo === 'registrarse';
    $('tituloCuentaUsuario').textContent = nuevo ? 'Crear una cuenta' : 'Entrar';
    $('bajadaCuentaUsuario').textContent = nuevo
      ? 'Con tu correo de la casa, el mismo del trabajo. La contraseña la eliges tú y no la sabe nadie más.'
      : 'Para pedir soporte hay que entrar con tu correo de la casa. Si es la primera vez, crea tu cuenta abajo.';
    $('campoNombreCuenta').hidden = !nuevo;
    /* Los dos campos cambian de papel según el modo, y al navegador hay que
       decírselo. La pareja username + current-password es la firma que
       reconoce como "esto es entrar", y en cuanto la ve rellena las
       credenciales que tenga guardadas —da igual que acabemos de vaciar los
       campos: el relleno viene después—. En la PC compartida de una oficina
       eso es salir a crear la cuenta con el correo del que se sentó antes.
       Con new-password deja de rellenar y encima ofrece inventar la clave,
       que es lo que hace falta aquí. */
    $('cuCorreo').autocomplete = nuevo ? 'email' : 'username';
    $('cuClave').autocomplete  = nuevo ? 'new-password' : 'current-password';
    $('botonAceptarCuenta').textContent = nuevo ? 'Crear la cuenta' : 'Entrar';
    /* Sin sesión no hay salida que ofrecer: la cuenta es obligatoria y un
       botón que no lleva a ninguna parte solo hace perder el tiempo. Con
       sesión —cambiando de cuenta, por ejemplo— sí se puede volver. */
    const cancelar = $('cancelarCuentaUsuario');
    const cerrarX  = $('cerrarCuentaUsuario');
    const dentro = !!leerSesion();
    if(cancelar){ cancelar.hidden = !dentro; cancelar.textContent = 'Volver'; }
    if(cerrarX)   cerrarX.hidden = !dentro;
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
      /* Y de vuelta a la puerta. pintarCabecera() esconde la planilla —eso lo
         hace pintarPuerta()—, pero la ventana solo se abría sola al cargar la
         página. Así que salir dejaba la pantalla en blanco: la barra azul
         arriba y nada debajo, sin nada que pulsar y sin decir por qué.
         Desde que la cuenta es obligatoria no hay un "fuera" que se pueda
         usar: quien sale solo puede volver a entrar, así que se le pide. */
      abrir('entrar');
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
    const quitarSoloLectura = e => e.target.removeAttribute('readonly');
    $('cuCorreo').addEventListener('focus', quitarSoloLectura);
    $('cuClave').addEventListener('focus', quitarSoloLectura);
    engancha('cambiarModoCuenta', e => {
      e.preventDefault();
      modo = modo === 'entrar' ? 'registrarse' : 'entrar';
      pintarModo();
      /* Vaciar también aquí, y no solo al abrir la ventana: cambiarle el
         papel a un campo no borra lo que ya tiene dentro. Quien llega a
         "Entrar", ve el correo de otro puesto por el navegador y pasa a
         crear cuenta, se llevaría ese correo consigo. Cuesta reescribir dos
         palabras y evita registrarse con el correo de un compañero. */
      $('cuCorreo').value = '';
      $('cuClave').value = '';
      $('cuNombre').value = '';
      $('avisoCuentaUsuario').hidden = true;
      (modo === 'registrarse' ? $('cuNombre') : $('cuCorreo')).focus();
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

    /* Sin sesión, esto es lo primero y lo único que hay. No se cierra, y la
       planilla de atrás está escondida hasta que se entre: dejarla a la vista
       detrás de un velo invita a rellenarla para descubrir al final que no se
       podía enviar. */
    pintarPuerta();
    if(!leerSesion()) abrir('entrar');
  });

  /* La planilla solo existe para quien entró. La regla de verdad está en el
     servidor —crear_solicitud rechaza a quien no se identifique, ver
     sql/migracion_04— y esto es lo que evita que alguien la llene en balde. */
  function pintarPuerta(){
    if(!HAY) return;
    const dentro = !!leerSesion();
    ['tarjetaAvance', 'pantallaFormulario', 'misSolicitudes', 'intro'].forEach(id => {
      const c = $(id);
      if(c) c.classList.toggle('tras-la-puerta', !dentro);
    });

    /* El aviso de 'tu solicitud quedó registrada' no está dentro de ninguna
       de esas cuatro: en index.html es hermano suyo, no hijo. Así que
       esconderlas no lo tocaba, y al cerrar sesión se quedaba en pantalla
       —con el número de la solicitud de quien acababa de salir— detrás de
       la ventana de Entrar.

       Se vacía además de esconderse. Con la clase sola se taparía nada más,
       y al entrar el siguiente se destaparía intacto: el número de otro,
       dándole la bienvenida. Lo que haya que decirle a quien entra lo
       vuelve a escribir pintarMias(). */
    const aviso = $('avisoUnaALaVez');
    if(aviso && !dentro){ aviso.hidden = true; aviso.innerHTML = ''; }
  }
})();
