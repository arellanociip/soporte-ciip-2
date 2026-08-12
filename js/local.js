/* ---------- El modo prueba ----------
   Mientras js/config.js no tenga los datos de Supabase, las dos páginas usan
   este almacén en vez del servidor: el formulario escribe aquí y la bandeja lee
   de aquí. Como las dos se sirven desde la misma dirección, comparten el
   localStorage del navegador y el circuito completo —pedir, recibir, atender,
   imprimir— se puede recorrer sin haber montado nada.

   Imita lo que hace el servidor de verdad (sql/esquema.sql): asigna el mismo
   correlativo por año y guarda las mismas columnas, para que la bandeja no
   tenga que saber de dónde vino cada solicitud.

   Lo que NO imita, a propósito: esto vive en UN navegador. Lo que envíes desde
   tu máquina no lo ve nadie más. Es un ensayo, no un piloto.
   Prefijo: soporteLocal. */
(function(){
  'use strict';

  const LLAVE = 'soporte_solicitudes_locales';

  /* randomUUID existe en contexto seguro (localhost lo es); servido por IP en
     la red de la oficina puede no estarlo, así que hay respaldo. */
  function nuevoId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'loc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function leer(){
    try{ return JSON.parse(localStorage.getItem(LLAVE)) || []; }
    catch(e){ return []; }
  }

  function escribir(lista){
    try{ localStorage.setItem(LLAVE, JSON.stringify(lista)); return true; }
    catch(e){ console.warn('No se pudo guardar en este navegador:', e); return false; }
  }

  window.soporteLocal = {
    /* Las más recientes primero, como las devuelve el servidor. */
    leer(){
      return leer().sort((a, b) => String(b.creada_en).localeCompare(String(a.creada_en)));
    },

    /* Mismo correlativo que el disparador del servidor: 1, 2, 3… dentro del
       año, y de vuelta a 1 en enero. */
    agregar(datos){
      const lista = leer();
      const anio = new Date().getFullYear();
      const delAnio = lista.filter(s => s.anio === anio);
      const fila = Object.assign({
        id: nuevoId(),
        numero: delAnio.reduce((mayor, s) => Math.max(mayor, s.numero || 0), 0) + 1,
        anio: anio,
        estado: 'recibida',
        tecnico: null,
        observaciones: null,
        renglones: [],
        atendida_en: null,
        creada_en: new Date().toISOString(),
        prueba: true,
      }, datos);
      lista.push(fila);
      escribir(lista);
      return fila;
    },

    actualizar(id, cambios){
      const lista = leer();
      const i = lista.findIndex(s => s.id === id);
      if(i < 0) throw new Error('No se encontró la solicitud ' + id);
      lista[i] = Object.assign({}, lista[i], cambios);
      escribir(lista);
      return lista[i];
    },

    vaciar(){ localStorage.removeItem(LLAVE); },
  };

  /* ---------- el resguardo de lo que uno ha pedido ----------
     Aparte del modo prueba y siempre activo: al enviar, aquí queda el id de la
     solicitud. Ese id es la llave para consultar su estado después sin cuenta
     ni contraseña — el servidor solo la entrega a quien lo sepa, y solo lo
     sabe este navegador. Por eso guarda el id y no el número: el número es
     001, 002, 003… y con él cualquiera leería las de los demás.

     Vive en un solo navegador, como es natural: es el resguardo de papel que
     uno se lleva, no un expediente. */
  const LLAVE_MIAS = 'soporte_mis_solicitudes';

  window.soporteMias = {
    leer(){
      try{ return JSON.parse(localStorage.getItem(LLAVE_MIAS)) || []; }
      catch(e){ return []; }
    },
    anotar(fila){
      if(!fila || !fila.id) return;
      const mias = window.soporteMias.leer().filter(m => m.id !== fila.id);
      mias.unshift({id: fila.id, numero: fila.numero, anio: fila.anio,
                    enviada_en: fila.creada_en || new Date().toISOString()});
      /* con las últimas veinte sobra: más abajo ya nadie mira */
      try{ localStorage.setItem(LLAVE_MIAS, JSON.stringify(mias.slice(0, 20))); }
      catch(e){ console.warn('No se pudo anotar la solicitud:', e); }
    },
    /* Deja solo los id que se le pasen. Sirve para que el resguardo no cargue
       para siempre con solicitudes ya cerradas que nadie va a volver a mirar. */
    podar(ids){
      const dejar = new Set(ids);
      const quedan = window.soporteMias.leer().filter(m => dejar.has(m.id));
      try{ localStorage.setItem(LLAVE_MIAS, JSON.stringify(quedan)); }
      catch(e){ console.warn('No se pudo podar el resguardo:', e); }
    },

    vaciar(){ localStorage.removeItem(LLAVE_MIAS); },
  };
})();
