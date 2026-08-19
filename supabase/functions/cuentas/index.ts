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

/* Las inyecta Supabase sola. Los nombres cambiaron con el sistema nuevo de
   llaves (sb_publishable_ / sb_secret_), así que se prueban los dos: el de
   siempre primero y el nuevo después. Sin esto, con el sistema nuevo la
   llave llegaba vacía, la respuesta de Supabase volvía sin cuerpo, y el
   .json() de dentro de supabase-js reventaba con 'Unexpected end of JSON
   input': un 500 pelado, sin una palabra de por qué. */
const URL_PROYECTO = Deno.env.get('SUPABASE_URL') ?? '';
const LLAVE_ADMIN  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
                  ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const LLAVE_ANON   = Deno.env.get('SUPABASE_ANON_KEY')
                  ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';

/* Los mismos cuatro datos que guarda servidor.js, y que salen impresos junto a
   la firma en la Hoja de Servicio. En Supabase viven en el user_metadata. */
const DATOS_TECNICO = ['nombre', 'cargo', 'cedula', 'telefono'] as const;

/* Quién es de GTIC, que ya no es lo mismo que tener cuenta: desde la
   migración 03 el papel vive en gtic.personal, y desde que la bandeja
   pregunta por él —ver js/bandeja.js— una cuenta que no esté en esa tabla
   no puede entrar. Por eso este panel tiene que escribirla: si solo creara
   la cuenta, crearía cuentas que su propia bandeja rechaza.

   Lleva la llave de administrador, así que ve la tabla aunque RLS se la
   niegue a todo el mundo desde el navegador. */
// deno-lint-ignore no-explicit-any
async function uidsDeGtic(admin: any): Promise<Set<string>> {
  const { data, error } = await admin.schema('gtic').from('personal').select('uid');
  if (error) throw error;
  return new Set((data ?? []).map((f: { uid: string }) => f.uid));
}

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

  /* Si falta alguna llave, decirlo. Morir con un 500 pelado obliga a ir a
     buscar el registro de la función, y eso solo lo puede hacer quien tenga
     el panel. No se enseña ningún valor: solo cuál falta. */
  const faltan = [
    !URL_PROYECTO && 'SUPABASE_URL',
    !LLAVE_ANON   && 'SUPABASE_ANON_KEY (o SUPABASE_PUBLISHABLE_KEY)',
    !LLAVE_ADMIN  && 'SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY)',
  ].filter(Boolean);
  if (faltan.length) {
    return responder(500, {
      message: 'A esta función le faltan variables de entorno: ' + faltan.join(', '),
    });
  }

  /* ---- ¿quién llama? ----
     El testigo del navegador se comprueba contra Supabase, no se cree. */
  const cabecera = req.headers.get('Authorization') ?? '';
  const testigo = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!testigo) return responder(401, { message: 'Hace falta iniciar sesión.' });

  const comoQuienLlama = createClient(URL_PROYECTO, LLAVE_ANON, {
    global: { headers: { Authorization: `Bearer ${testigo}` } },
  });
  /* getUser() no siempre devuelve el error: cuando la respuesta de Supabase
     no es JSON —porque la llave iba vacía, por ejemplo— supabase-js lanza
     por dentro. Esta línea estaba fuera del try de abajo, así que ese lanzo
     salía como un 500 sin explicación. Ahora se recoge y se dice qué pasó:
     502, porque el fallo es de la conversación con Supabase, no de quien
     llama. */
  let usuario;
  try {
    const r = await comoQuienLlama.auth.getUser();
    if (r.error || !r.data?.user) {
      return responder(401, { message: 'Hace falta iniciar sesión.' });
    }
    usuario = r.data.user;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return responder(502, {
      message: 'No se pudo comprobar la sesión contra Supabase: ' + msg,
    });
  }
  /* Que el testigo sea de una cuenta de verdad y no la llave anónima: con la
     anon, getUser() no devuelve usuario, pero se comprueba explícitamente
     porque de esto depende que no entre cualquiera. */
  const yo = usuario;
  if (!yo.email) return responder(401, { message: 'Esa sesión no es de una cuenta.' });

  const admin = createClient(URL_PROYECTO, LLAVE_ADMIN, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    /* ---- listar quién puede entrar ---- */
    if (req.method === 'GET') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      /* Solo los de GTIC. Antes daba igual —toda cuenta lo era— pero hoy
         listar auth.users entero sería enseñar a las 177 personas de la casa
         como si todas pudieran entrar aquí. */
      const deGtic = await uidsDeGtic(admin);
      const lista = (data?.users ?? [])
        .filter((u: { id: string }) => deGtic.has(u.id))
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

      /* El papel, que es lo que de verdad abre la bandeja. Va aquí porque
         hace falta el uid, y se hace también cuando la cuenta ya existía:
         dar de alta a alguien por este panel es decir que es de GTIC. */
      const { error: malPapel } = await admin.schema('gtic').from('personal')
        .upsert({ uid: fila.id, correo }, { onConflict: 'uid' });
      if (malPapel) throw malPapel;

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

      /* Dar de baja aquí es dar de baja de GTIC, así que quien no lo sea no
         es asunto de este panel: una cuenta de quien pide soporte no se toca
         desde la bandeja. */
      const deGtic = await uidsDeGtic(admin);
      if (!deGtic.has(victima.id)) {
        return responder(404, { message: 'Esa cuenta no es de GTIC.' });
      }

      /* Borrarse a uno mismo deja a alguien fuera de la pantalla en la que está
         trabajando, y es casi siempre un dedazo. */
      if (correo === yo.email?.toLowerCase()) {
        return responder(409, { message: 'Esa es tu propia cuenta. Que te dé de baja otro compañero.' });
      }
      /* Quedarse sin nadie cierra la bandeja para siempre, y la única salida
         sería el panel de Supabase. */
      if (deGtic.size <= 1) {
        return responder(409, { message: 'Es la última cuenta de GTIC. Crea antes la que la sustituye.' });
      }

      /* Primero el papel y luego la cuenta: si se cae en medio, lo que queda
         es alguien sin entrada a la bandeja, que es el lado seguro. Al revés
         quedaría una fila huérfana en gtic.personal. */
      const { error: malPapel } = await admin.schema('gtic').from('personal')
        .delete().eq('uid', victima.id);
      if (malPapel) throw malPapel;

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
