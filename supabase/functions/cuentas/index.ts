/* ---------- Las cuentas de GTIC, en la nube ----------
   El equivalente de /auth/v1/admin/users de servidor.js, para cuando el sitio
   corre contra Supabase. Lo llama js/bandeja.js sin enterarse de la
   diferencia: mismos verbos, mismos campos, misma respuesta.

   POR QUÉ HACE FALTA ESTO Y NO SE HACE DESDE LA PÁGINA

   Crear una cuenta en Supabase exige la llave `service_role`. Esa llave
   bypasea TODOS los permisos de TODAS las tablas: quien la tenga puede leer y
   borrar la casa entera. Una página web es código que se descarga, así que
   cualquier cosa metida ahí es pública — poner esa llave en js/config.js
   sería regalar el sistema.

   Aquí sí puede vivir: esto corre en el servidor de Supabase, nunca se
   descarga, y la llave llega por variable de entorno sin quedar escrita en el
   repositorio.

   QUIÉN PUEDE LLAMARLA

   Solo alguien que ya tenga cuenta de GTIC. Se comprueba de verdad: se toma
   el testigo que manda el navegador y se le pregunta a Supabase de quién es.
   Si no hay testigo, o no vale, se responde 401 y no se toca nada. Sin esa
   comprobación esto sería una puerta abierta para crear cuentas de
   administrador desde cualquier sitio.

   CÓMO SE DESPLIEGA          (ver supabase/functions/cuentas/LEEME.md)
     supabase functions deploy cuentas

   No hace falta configurar SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY: son de
   las que Supabase inyecta sola en cada función. */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_PROYECTO = Deno.env.get('SUPABASE_URL')!;
const LLAVE_ADMIN  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LLAVE_ANON   = Deno.env.get('SUPABASE_ANON_KEY')!;

/* Los mismos cuatro datos que guarda servidor.js, y que salen impresos junto a
   la firma en la Hoja de Servicio. En Supabase viven en el user_metadata. */
const DATOS_TECNICO = ['nombre', 'cargo', 'cedula', 'telefono'] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const responder = (codigo: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status: codigo,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/* Una clave que se pueda dictar por teléfono sin deletrear: sílabas y un
   número. Es la misma idea —y las mismas sílabas— que claveLegible() de
   servidor.js, para que una cuenta creada aquí y otra creada allá se dicten
   igual. No es para guardar secretos de Estado: es para que el compañero
   entre hoy y la cambie cuando quiera. */
function claveLegible(): string {
  const s = ['ba','ce','di','fo','gu','la','me','ni','po','ru','sa','te','vi','zo'];
  const azar = (n: number) => {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return b[0] % n;
  };
  const trozo = () => s[azar(s.length)];
  return trozo() + trozo() + '-' + trozo() + trozo() + '-' + String(10 + azar(90));
}

/* Una cuenta como se la puede enseñar a alguien. Nunca sale de aquí nada de la
   clave: Supabase tampoco la entrega, pero el filtro se escribe igual para que
   la respuesta sea idéntica a la del servidor de casa. */
// deno-lint-ignore no-explicit-any
function usuarioPublico(u: any) {
  const m = u?.user_metadata ?? {};
  const o: Record<string, unknown> = {
    correo: u?.email ?? null,
    creado_en: u?.created_at ?? null,
  };
  for (const k of DATOS_TECNICO) o[k] = m[k] ?? null;
  return o;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  /* ---- ¿quién llama? ----
     El testigo del navegador se comprueba contra Supabase, no se cree. */
  const cabecera = req.headers.get('Authorization') ?? '';
  const testigo = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!testigo) return responder(401, { message: 'Hace falta iniciar sesión.' });

  const comoQuienLlama = createClient(URL_PROYECTO, LLAVE_ANON, {
    global: { headers: { Authorization: `Bearer ${testigo}` } },
  });
  const { data: quien, error: malTestigo } = await comoQuienLlama.auth.getUser();
  if (malTestigo || !quien?.user) {
    return responder(401, { message: 'Hace falta iniciar sesión.' });
  }
  /* Que el testigo sea de una cuenta de verdad y no la llave anónima: con la
     anon, getUser() no devuelve usuario, pero se comprueba explícitamente
     porque de esto depende que no entre cualquiera. */
  const yo = quien.user;
  if (!yo.email) return responder(401, { message: 'Esa sesión no es de una cuenta.' });

  const admin = createClient(URL_PROYECTO, LLAVE_ADMIN, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    /* ---- listar quién puede entrar ---- */
    if (req.method === 'GET') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const lista = (data?.users ?? [])
        .map(usuarioPublico)
        .sort((a, b) =>
          String(a.nombre ?? a.correo).localeCompare(String(b.nombre ?? b.correo), 'es'));
      return responder(200, lista);
    }

    /* ---- dar de alta, o corregir ---- */
    if (req.method === 'POST') {
      const d = await req.json().catch(() => ({}));
      const correo = String(d.correo ?? '').toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
        return responder(400, { message: 'Ese correo no tiene forma de correo.' });
      }

      const { data: hay, error: malBusca } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (malBusca) throw malBusca;
      const previo = (hay?.users ?? []).find((u) => u.email?.toLowerCase() === correo);

      let clave = d.clave == null ? '' : String(d.clave);
      const inventada = !clave && !previo;
      if (inventada) clave = claveLegible();
      if (clave && clave.length < 6) {
        return responder(400, { message: 'La clave es muy corta: pon al menos 6 caracteres.' });
      }

      /* lo que no se vuelva a indicar se conserva; indicarlo vacío sí lo borra */
      const meta: Record<string, string | null> = { ...(previo?.user_metadata ?? {}) };
      for (const k of DATOS_TECNICO) {
        if (d[k] === undefined) continue;
        meta[k] = String(d[k] ?? '').trim().slice(0, 120) || null;
      }
      /* sin nombre, el de la Hoja de Servicio sería un correo electrónico */
      if (!meta.nombre) meta.nombre = correo.split('@')[0].replace(/[._]/g, ' ');

      let fila;
      if (previo) {
        // deno-lint-ignore no-explicit-any
        const cambios: any = { user_metadata: meta };
        if (clave) cambios.password = clave;   /* sin clave, no se toca la suya */
        const { data, error } = await admin.auth.admin.updateUserById(previo.id, cambios);
        if (error) throw error;
        fila = data.user;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: correo,
          password: clave,
          /* Se da por buena sin correo de confirmación: la cuenta la está
             creando GTIC a mano, no se está registrando un desconocido. Sin
             esto, la persona no podría entrar hasta pinchar un enlace que
             quizá nunca le llegue. */
          email_confirm: true,
          user_metadata: meta,
        });
        if (error) throw error;
        fila = data.user;
      }

      return responder(previo ? 200 : 201, [
        { ...usuarioPublico(fila), clave_nueva: inventada ? clave : null },
      ]);
    }

    /* ---- dar de baja ---- */
    if (req.method === 'DELETE') {
      const filtro = new URL(req.url).searchParams.get('correo') ?? '';
      const correo = (filtro.startsWith('eq.') ? filtro.slice(3) : filtro).toLowerCase().trim();

      const { data: hay, error: malBusca } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (malBusca) throw malBusca;
      const usuarios = hay?.users ?? [];
      const victima = usuarios.find((u) => u.email?.toLowerCase() === correo);
      if (!victima) return responder(404, { message: 'No existe ninguna cuenta con ese correo.' });

      /* Borrarse a uno mismo deja a alguien fuera de la pantalla en la que está
         trabajando, y es casi siempre un dedazo. */
      if (correo === yo.email?.toLowerCase()) {
        return responder(409, { message: 'Esa es tu propia cuenta. Que te dé de baja otro compañero.' });
      }
      /* Quedarse sin nadie cierra la bandeja para siempre, y la única salida
         sería el panel de Supabase. */
      if (usuarios.length <= 1) {
        return responder(409, { message: 'Es la última cuenta. Crea antes la que la sustituye.' });
      }

      const { error } = await admin.auth.admin.deleteUser(victima.id);
      if (error) throw error;
      return responder(200, [{ correo }]);
    }

    return responder(405, { message: 'Ese verbo no se atiende aquí.' });
  } catch (e) {
    /* El mensaje de Supabase se pasa tal cual: la bandeja lo enseña, y "ese
       correo ya existe" es más útil que "algo falló". */
    const msg = e instanceof Error ? e.message : String(e);
    return responder(400, { message: msg });
  }
});
