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
que servir la carpeta. **Doble clic a `servir.cmd`** y él imprime las direcciones.

O a mano, desde `C:\Users\F.reyes\Desktop\soporte-gtic`:

```
python -m http.server 8123
```

Y abrir:

- Formulario → <http://localhost:8123/index.html>
- Bandeja → <http://localhost:8123/bandeja.html>

## Que entre alguien desde otra máquina de la oficina

Ya funciona: `python -m http.server` atiende a toda la red, no solo a esta
máquina. El compañero abre, en su navegador:

```
http://172.21.20.49:8123/index.html
```

Esa es la IP de esta PC en la red del CIIP. **Puede cambiar** cuando se reinicie
el equipo, porque la asigna el servidor DHCP; `servir.cmd` la vuelve a averiguar
y la imprime cada vez. Para verla a mano: `ipconfig`, línea "Dirección IPv4" del
adaptador Ethernet. Ojo con no usar la de `CloudflareWARP` (172.16.x), que es del
VPN y no sirve para que otro entre.

En esta máquina el firewall de Windows está **desactivado** en los tres perfiles,
así que no hace falta abrir el puerto. Si un día lo activan, hará falta esto una
vez, en PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "Soporte GTIC (prueba en red local)" `
  -Direction Inbound -Protocol TCP -LocalPort 8123 -Action Allow -Profile Domain,Private
```

Y para quitarlo:

```powershell
Remove-NetFirewallRule -DisplayName "Soporte GTIC (prueba en red local)"
```

> ### Lo que NO hace compartir la carpeta
>
> Mientras `js/config.js` esté vacío, **cada máquina guarda sus solicitudes en su
> propio navegador**. El compañero verá el formulario perfecto, lo llenará y
> recibirá su número… pero eso **no llega a tu bandeja**. Ni a la suya: lo suyo
> queda en su equipo, lo tuyo en el tuyo.
>
> Compartir la carpeta reparte *la página*, no *los datos*. Para que todos vean
> la misma cola hace falta el paso de Supabase, y entonces ya no importa desde
> qué máquina entre nadie.
>
> Sirve, eso sí, para enseñarle a alguien cómo va a funcionar sin instalarle nada.

En Edge, desde PowerShell:

```powershell
& "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:8123/index.html"
```

**Por qué un servidor y no abrir el archivo directamente:** con `file://` el
navegador bloquea la carga de los `js/*.js` y la página arranca vacía.

---

## Probarlo entero sin haber montado nada

Mientras `js/config.js` esté vacío, las dos páginas entran en **modo prueba**:
guardan en el propio navegador en vez de en el servidor. Como las dos se sirven
desde la misma dirección, comparten ese almacén — así que el circuito completo
se puede recorrer hoy mismo:

1. Levanta el servidor (`python -m http.server 8123`).
2. Abre <http://localhost:8123/index.html>, llena la planilla y envía.
   Te da un número, `GTIC-HS/001-2026`.
3. Abre <http://localhost:8123/bandeja.html>. **Ahí está tu solicitud**, con su
   número, su gerencia y su oficina. No pide clave: sin servidor no hay nada de
   nadie más que proteger.
4. Ábrela, pon quién la atiende, escribe las observaciones, llena el renglón de
   equipo, cambia el estado a *Atendida* y guarda. Verás moverse los contadores.
5. Dale **Imprimir Hoja de Servicio**: sale la hoja completa, con el formato de
   siempre, lista para firmar y sellar.

El botón **Vaciar el ensayo**, en la bandeja, borra lo de prueba y te deja la
pizarra limpia para volver a empezar.

**Los dos límites de este modo, para no llevarse sorpresas:**

- **Vive en un solo navegador.** Lo que envíes desde tu máquina no lo ve nadie
  más, ni desde otra computadora ni desde otro navegador en la misma. Es un
  ensayo para ver el circuito y enseñárselo a alguien, no un piloto con la
  oficina.
- **No hay claves.** La bandeja entra directo. Con Supabase montado vuelve a
  pedir correo y contraseña, y este modo desaparece solo — no hay que apagar
  nada, basta con llenar `js/config.js`.

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

**Quien pide.** Abre el formulario, elige uno de los cinco atajos —"La computadora
no sirve", "Problema con la impresora"…—, cuenta qué le pasa y envía. Recibe un
número tipo `GTIC-HS/007-2026`.

Los atajos son los cinco detalles más pedidos del Excel y cubren el 78 % de los
casos; "Otra cosa" abre los desplegables completos para el resto. No guardan nada
por su cuenta: solo rellenan esos mismos desplegables, así que la Hoja de
Servicio sale idéntica venga de donde venga. Clasificar sigue siendo opcional a
propósito: quien tiene el problema no siempre sabe si es "asistencia" o "soporte
técnico", y forzarlo solo ensucia la data.

**Nadie escribe su gerencia ni su oficina.** El formulario abre con un solo campo:
*¿Quién eres?*. Se escribe el nombre, se elige de la lista de la casa
([`js/directorio.js`](js/directorio.js), 89 personas sacadas de las hojas ya
llenadas) y la gerencia, el piso y la oficina se llenan solas. Quien no aparezca
pulsa **No aparezco en la lista** y le salen los seis campos de siempre.

**Y la segunda vez, ni eso.** Con la casilla *Recordar mis datos en este equipo*
marcada, todo queda guardado **en ese navegador, nunca en el servidor**, y solo
hay que confirmar el recuadro. En el Excel, 38 de las 125 personas pidieron
soporte más de una vez y volvieron a escribirlo todo cada vez.

En un equipo compartido eso importa, así que: la casilla se ve antes de enviar y
se puede desmarcar; el recuadro dice a nombre de quién está; **Corregir** descubre
los campos con los datos puestos, y **No soy yo** los borra de verdad.

> **El directorio no lleva cédula ni teléfono, a propósito.** Ese archivo viaja al
> navegador de cualquiera que abra la página, que no pide clave: publicar ahí la
> cédula de 112 compañeros sería regalarlas. Los dos campos siguen siendo
> opcionales y los escribe cada quien. Si algún día la página queda detrás de una
> clave, se puede reconsiderar — pero es una decisión aparte, no un descuido.

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
js/catalogo.js      gerencias, tipos, detalles, atajos, equipos y marcas
js/directorio.js    quién trabaja dónde, para no escribirlo cada vez
js/local.js         el modo prueba: el almacén del navegador mientras no haya servidor
js/solicitud.js     la lógica del formulario
js/bandeja.js       acceso, cola, atención e impresión
sql/esquema.sql     la tabla, el correlativo y los permisos
```
