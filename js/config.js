/* ---------- Conexión al servidor ----------
   Este es el ÚNICO archivo que hay que tocar para poner el sistema en marcha.

   Los dos datos salen del panel de Supabase del proyecto de soporte, en
   Project Settings → API:
     url     → "Project URL"
     anonKey → la clave "anon public"

   La clave anon es pública por diseño: no es un secreto, solo identifica al
   proyecto. Quien mande la solicitud desde la calle solo puede INSERTAR, nunca
   leer lo de los demás: eso lo decide el servidor en sql/esquema.sql, no esta
   clave. Ver el README.

   Mientras estos dos campos sigan vacíos la página funciona igual, pero avisa
   que no hay servidor y guarda la solicitud en el propio navegador para que no
   se pierda lo que la persona escribió. */
window.SOPORTE_BACKEND = {
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

/* ¿Está configurado el servidor? Lo consultan el formulario y la bandeja. */
window.soporteHayBackend = function(){
  const B = window.SOPORTE_BACKEND;
  return !!(B && B.url && B.anonKey);
};
