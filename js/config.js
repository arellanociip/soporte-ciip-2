/* ---------- Dónde se guardan las solicitudes ----------
   Este es el ÚNICO archivo que hay que tocar para cambiar de sitio. Hay tres:

   'local'     El servidor de esta PC (servidor.js). Todas las máquinas de la
               oficina escriben en el mismo archivo y la bandeja las ve al
               instante. No necesita internet ni cuentas; sí necesita que esta
               PC esté encendida y sirviendo.

   'supabase'  El proyecto en la nube. Los datos viven fuera de esta PC y se
               entra desde donde sea, aunque este equipo esté apagado. Hay que
               llenar `url` y `anonKey` (panel de Supabase → Project Settings →
               API) y seguir los pasos del README.

   ''          Sin servidor: cada navegador guarda lo suyo. Sirve para ensayar
               a solas; lo que mande un compañero NO llega a tu bandeja. */
window.SOPORTE_BACKEND = {
  servidor: 'local',

  /* Solo para 'supabase'. Con 'local' se ignoran: la página habla con el mismo
     sitio que la sirvió, así que no hace falta decirle dónde está. */
  url: '',
  anonKey: '',
};

/* A dónde escribirle si el servidor no responde y la solicitud no pudo salir.
   Sale en el mensaje de error, para que la persona no quede sin salida. */
window.SOPORTE_CONTACTO = {
  gerencia: 'Gerencia de Tecnología de la Información y Comunicación',
  extension: '',
  correo: '',
};

/* ¿Hay dónde guardar? Lo consultan el formulario y la bandeja. */
window.soporteHayBackend = function(){
  const B = window.SOPORTE_BACKEND;
  if(!B) return false;
  if(B.servidor === 'local') return true;
  if(B.servidor === 'supabase') return !!(B.url && B.anonKey);
  return false;
};

/* Las cabeceras que exige Supabase para dar con el esquema `gtic`. Contra el
   servidor de casa sobran, y mandarlas vacías solo ensucia la petición. */
window.soporteCabeceras = function(){
  const B = window.SOPORTE_BACKEND;
  if(B.servidor !== 'supabase') return {};
  return {
    'apikey': B.anonKey,
    'Accept-Profile': 'gtic',
    'Content-Profile': 'gtic',
  };
};
