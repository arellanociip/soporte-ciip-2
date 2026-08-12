# Solicitudes de soporte · GTIC · CIIP

La Hoja de Servicio, en la web. La gente de la casa pide su soporte desde el
navegador, la solicitud entra sola a una cola con su número, y GTIC la atiende y
imprime la misma hoja de siempre para firmar y sellar.

Sale del Excel `HOJA DE SERVICIO NUEVA.xlsx`: las gerencias, los dos tipos de
servicio y los detalles que cuelgan de cada uno son exactamente sus listas.

> Esto no tiene nada que ver con Atlas. Es un proyecto aparte, con su propio
> código, su propio servidor y su propio despliegue.

---

## Las dos páginas

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Toda la casa, sin clave | Llenar y enviar la solicitud. Devuelve el número. |
| `bandeja.html` | Solo GTIC, con clave | Ver la cola, atender, dejar constancia e imprimir la hoja. |

---

## Montarlo (una sola vez)

### 1. Crear el proyecto en Supabase

En [supabase.com](https://supabase.com) → **New project**. Anota la contraseña
de la base de datos que te pida; no hace falta para esto, pero se pierde si no.

### 2. Crear la tabla

Panel de Supabase → **SQL Editor** → **New query**. Pega **todo** el contenido de
[`sql/esquema.sql`](sql/esquema.sql) y dale **Run**.

Eso crea el esquema `gtic`, la tabla, el correlativo automático y las reglas de
quién puede hacer qué.

### 3. Publicar el esquema en la API

**Este paso es fácil de olvidar y sin él nada funciona**: el servidor responde
404 aunque la tabla exista.

Panel → **Project Settings** → **API** → **Exposed schemas** → agrega `gtic` →
**Save**.

### 4. Crear las cuentas de GTIC

Panel → **Authentication** → **Users** → **Add user** → *Create new user*.
Correo y contraseña de cada técnico que vaya a usar la bandeja. Marca
**Auto Confirm User** para que no tenga que confirmar por correo.

Quien solo va a *pedir* soporte no necesita cuenta.

### 5. Llenar `js/config.js`

Panel → **Project Settings** → **API**. Copia dos datos:

```js
window.SOPORTE_BACKEND = {
  url: 'https://xxxxxxxx.supabase.co',   // "Project URL"
  anonKey: 'eyJhbGciOi...',              // la clave "anon public"
};
```

Aprovecha y pon la extensión y el correo de GTIC en `SOPORTE_CONTACTO`: salen en
el mensaje de error si un día el servidor no responde, para que quien pide no
quede sin a dónde acudir.

**La clave anon no es un secreto.** Solo identifica al proyecto. Quien la tenga
únicamente puede *insertar* una solicitud, nunca leer las de los demás: eso lo
decide el servidor en `sql/esquema.sql`, no la clave.

---

## Verlo en tu máquina

No hay que instalar ni compilar nada: es HTML, CSS y JavaScript planos. Solo hay
que servir la carpeta.

Desde `C:\Users\F.reyes\Desktop\soporte-gtic`:

```
python -m http.server 8123
```

Y abrir:

- Formulario → <http://localhost:8123/index.html>
- Bandeja → <http://localhost:8123/bandeja.html>

En Edge, desde PowerShell:

```powershell
& "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:8123/index.html"
```

**Por qué un servidor y no abrir el archivo directamente:** con `file://` el
navegador bloquea la carga de los `js/*.js` y la página arranca vacía.

Sin `js/config.js` lleno la página funciona igual, avisa que no hay servidor y
guarda lo enviado en el propio navegador. Sirve para probar; nadie lo recibe.

---

## Publicarlo para la oficina

Cualquier hosting de archivos estáticos sirve. Con [Vercel](https://vercel.com),
desde esta carpeta:

```
npx vercel --prod
```

No hay que configurar nada más: no hay build ni variables de entorno, porque la
única configuración vive en `js/config.js` y viaja con los archivos.

---

## Cómo se usa

**Quien pide.** Abre el formulario, elige su gerencia, dice quién es y dónde está,
cuenta qué le pasa y envía. Recibe un número tipo `GTIC-HS/007-2026`. Clasificar
el servicio es opcional a propósito: quien tiene el problema no siempre sabe si
es "asistencia" o "soporte técnico", y forzarlo solo ensucia la data.

**GTIC.** Entra a la bandeja con su correo y clave. Ve las pendientes de primero.
Abre una, pone quién la atiende, deja las observaciones y llena los renglones de
equipo —hasta seis, como en el Excel—, cambia el estado a *Atendida* y guarda.
El botón **Imprimir Hoja de Servicio** saca la hoja completa, con el mismo
formato de siempre, lista para firmar y sellar.

---

## Lo que cambia respecto al Excel

- **El número ya no se pone a mano.** Lo asigna el servidor y no se repite,
  aunque dos personas envíen en el mismo segundo. Reinicia en 1 cada enero.
- **Se acabaron las variantes mal escritas.** En las 207 hojas del Excel conviven
  `CANON`, `CANNON` y `CANOM` para la misma marca, y `MAUSE`, `MUSE` y `LAPTO`.
  Ahora equipo y marca son listas cerradas.
- **Dos opciones que estaban perdidas.** En el Excel el rango `SOPORTE_TECNICO`
  llegaba hasta la fila 17, así que `MANTENIMIENTO CORRECTIVO` —escrito en la
  fila 18— nunca salía en el desplegable. Igual `UPGRADE DE HARDWARE`, que se
  usaba a mano. Las dos están disponibles ahora.
- **Tres gerencias que faltaban.** `FUNDACION MARCA PAIS`,
  `VICEMINISTERIO DE ECONOMIA PRODUCTIVA` y la propia GTIC aparecían en hojas
  llenadas pero no en la lista `GERENCIAS`.
- **Las oficinas se sugieren, no se imponen.** El Excel mezclaba `4-1` y `4-01`
  para la misma. El campo propone las conocidas ya normalizadas, pero admite
  cualquiera: la lista de oficinas cambia sola con el tiempo.

---

## Los archivos

```
index.html          el formulario que llena la casa
bandeja.html        la cola de GTIC
css/estilo.css      todo el diseño, incluida la hoja impresa
js/config.js        ← el único archivo que hay que tocar para arrancar
js/catalogo.js      gerencias, tipos, detalles, equipos y marcas
js/solicitud.js     la lógica del formulario
js/bandeja.js       acceso, cola, atención e impresión
sql/esquema.sql     la tabla, el correlativo y los permisos
```
