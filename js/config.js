/* ---------- Dónde se guardan las solicitudes ----------
   Hay tres modos posibles:

   'local'     El servidor de esta PC (servidor.js). Todas las máquinas de la
               oficina escriben en el mismo archivo y la bandeja las ve al
               instante. No necesita internet ni cuentas; sí necesita que esta
               PC esté encendida y sirviendo.

   'supabase'  El proyecto en la nube. Los datos viven fuera de esta PC y se
               entra desde donde sea, aunque este equipo esté apagado.

   ''          Sin servidor: cada navegador guarda lo suyo. Sirve para ensayar
               a solas; lo que mande un compañero NO llega a tu bandeja.

   Este archivo es el mismo tanto en el repositorio de la PC como en el que
   despliega Vercel, así que el modo no se escribe fijo: se elige solo según
   por dónde entra quien lo abre. servidor.js solo sabe hablar http://; Vercel
   sirve siempre por https://. Con eso alcanza para distinguir los dos casos
   sin tener que tocar este archivo en cada despliegue.

   Para ensayar a solas con el modo '' (sin servidor), cambia la línea de
   abajo a mano en tu copia; no hace falta que quede así para todos. */
const enLaNube = location.protocol === 'https:';

window.SOPORTE_BACKEND = {
  servidor: enLaNube ? 'supabase' : 'local',

  /* Solo se usan con 'supabase'. Con 'local' se ignoran: la página habla con
     el mismo sitio que la sirvió, así que no hace falta decirle dónde está.
     Panel de Supabase → Project Settings → API → Project URL / anon key. */
  url: enLaNube ? 'https://hvbdquxsalzhjqxwlnpt.supabase.co' : '',
  anonKey: enLaNube
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2YmRxdXhzYWx6aGpxeHdsbnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjM5NDQsImV4cCI6MjEwMjIzOTk0NH0.b7dqeNA6CKvz4c9Dx10AVWoq9QdqXIUxMejFeEZZQUc'
    : '',
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
