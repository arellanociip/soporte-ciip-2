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

## Arrancarlo (lo de todos los días)

**Doble clic a `servir.cmd`.** Levanta el servidor e imprime las direcciones.
Mientras esa ventana esté abierta, la oficina puede pedir soporte.

Antes de la primera vez, hay que crear un usuario para entrar a la bandeja:

```
node servidor.js --usuarios                        quien puede entrar
node servidor.js --crear-usuario correo [clave]    alta, o cambio de clave
node servidor.js --borrar-usuario correo           baja
```

Si no le pones clave al crear a alguien, el servidor inventa una legible
(`suvi-mete-47`) y la muestra para que se la pases. Con un correo que ya existe,
**--crear-usuario le cambia la clave**: es tambien la forma de resolver un olvido,
porque las claves no se guardan, solo su huella, y no hay de donde recuperarlas.

No se puede borrar al ultimo usuario: dejaria la bandeja cerrada para siempre.

**Cada quien completa sus propios datos desde la bandeja.** En el enlace
*Mis datos* de la barra azul se ponen nombre, cargo, cédula y teléfono — los
cuatro que salen impresos junto a la firma del técnico. Se llenan una vez y
quedan en la cuenta, no en el navegador, así que sirven desde cualquier equipo.
Si falta alguno, el recuadro del técnico lo dice y ofrece el atajo, porque cada
dato que falte es una raya en blanco en la hoja impresa.

> **No hay roles.** Todo el que entra puede lo mismo: ver todas las solicitudes,
> atenderlas, cambiar estados e imprimir hojas. Quien manda de verdad es quien
> tiene acceso a esta carpeta, porque las cuentas solo se crean desde aqui — no
> hay registro por la web.


Todo se guarda en `datos\solicitudes.json`, un archivo de texto de esta PC. Se
puede abrir, leer y respaldar copiándolo. `datos\` no va al repositorio: son
datos de la casa y las huellas de las claves, no código.

> **Lo que hay que saber del servidor en tu PC:** mientras esa ventana esté
> cerrada, o el equipo apagado, nadie puede pedir soporte ni ver la bandeja. Es
> el precio de no depender de la nube. Cuando eso empiece a estorbar, el paso
> siguiente es Supabase — y solo hay que cambiar `js/config.js`.

---

## Montarlo en Supabase (el día que haga falta)

Con el servidor de esta PC ya no es urgente, pero sigue siendo el destino: los
datos dejan de vivir en tu equipo y se entra desde donde sea aunque esté
apagado. Cuando toque, en `js/config.js`:

```js
window.SOPORTE_BACKEND = {
  servidor: 'supabase',
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

Y estos pasos:

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

**La clave anon no es un secreto.** Solo identifica al proyecto. Quien la tenga
únicamente puede *insertar* una solicitud, nunca leer las de los demás: eso lo
decide el servidor en `sql/esquema.sql`, no la clave.

---

## Que entre alguien desde otra máquina de la oficina

Ya funciona: el servidor atiende a toda la red, no solo a esta máquina. El
compañero abre en su navegador la dirección que imprime `servir.cmd`:

```
http://172.21.20.49:8123/index.html
```

Esa es la IP de esta PC en la red del CIIP. **Puede cambiar** al reiniciar el
equipo, porque la asigna el DHCP; el servidor la vuelve a averiguar y la imprime
cada vez que arranca. Para verla a mano: `ipconfig`, línea "Dirección IPv4" del
adaptador Ethernet. Ojo con no usar la de `CloudflareWARP` (172.16.x), que es la
del VPN y con la que nadie puede entrar.

En esta máquina el firewall de Windows está **desactivado** en los tres perfiles,
así que no hace falta abrir el puerto. Si un día lo activan, hará falta esto una
vez, en PowerShell **como administrador**:

```powershell
New-NetFirewallRule -DisplayName "Soporte GTIC" -Direction Inbound -Protocol TCP -LocalPort 8123 -Action Allow -Profile Domain,Private
```

Y para quitarlo: `Remove-NetFirewallRule -DisplayName "Soporte GTIC"`.

**Por qué un servidor y no abrir el archivo directamente:** con `file://` el
navegador bloquea la carga de los `js/*.js` y la página arranca vacía.

---

## El modo prueba (sin servidor)

Si `js/config.js` tuviera `servidor: ''`, las dos páginas guardarían en el propio
navegador y la bandeja entraría sin clave. Sirve para enseñar el circuito en una
máquina suelta, pero **lo que mande un compañero no llega a tu bandeja**: cada
navegador guarda lo suyo. Hoy no hace falta, porque el servidor de esta PC ya
reúne todo en un solo sitio.

---

## Cómo se usa

**Quien pide.** Abre el formulario, elige uno de los cinco atajos —"La computadora
no sirve", "Problema con la impresora"…—, cuenta qué le pasa y envía. Recibe un
número tipo `GTIC-HS/007-2026`.

Elegir uno es obligatorio: los cinco son los detalles más pedidos del Excel y
cubren el 78 % de los casos, y "Otra cosa" abre los desplegables completos para
el resto. Antes era opcional y tres de cada diez solicitudes llegaban sin
clasificar, con el técnico adivinando qué llevar. No guardan nada
por su cuenta: solo rellenan esos mismos desplegables, así que la Hoja de
Servicio sale idéntica venga de donde venga. **Nadie escribe su gerencia ni su oficina.** El formulario abre con un solo campo:
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

**Y puede ver en qué va.** Al volver al formulario, arriba sale *Lo que has
pedido*: cada solicitud con su número, las tres etapas del trámite dibujadas
—Recibida → En proceso → Atendida— y, cuando GTIC la cierra, la respuesta del
técnico. No hace falta clave ni recordar el número.

**Y puede retirar la suya.** Mientras nadie la haya tomado, en su fila hay un
"Me equivoqué, retirar esta solicitud": la anula y deja libre para pedir otra.
En cuanto un técnico la pasa a *En proceso* deja de poder — ya hay alguien
trabajando, y borrarla por detrás lo dejaría atendiendo un caso que en el
sistema no existe. El servidor lo comprueba otra vez al recibir la orden.

**Una solicitud a la vez.** Con una abierta, la planilla se guarda y en su lugar
queda el porqué y el estado de la que ya tiene. La regla la impone el servidor,
no la pantalla: desde otro navegador el rechazo llega igual, con un 409 que el
formulario traduce mostrando la solicitud que ya existía. Se compara por el
nombre normalizado, porque la cédula es opcional. Si a alguien se le queda una
abierta y necesita otra cosa, GTIC la cierra o la anula y queda libre.

> **Cómo se sostiene eso sin cuentas.** Al enviar, el navegador guarda el uid=1050397(f.reyes) gid=1049089 groups=1049089
> de la solicitud, que es un UUID: 122 bits al azar. El servidor entrega una
> solicitud a quien sepa su uid=1050397(f.reyes) gid=1049089 groups=1049089, y solo lo sabe el navegador de quien la mandó.
> Pedirla por número (, …) está negado, porque entonces cualquiera
> recorrería las de toda la casa. Tampoco se entregan listas, ni se devuelven
> cédula, teléfono ni gerencia — solo el resumen que a esa persona le sirve.
>
> El precio: vive en un navegador. Quien borre sus datos o cambie de equipo
> pierde el rastro y tendrá que preguntarle a GTIC. Es el resguardo de papel
> que uno se lleva, no un expediente.

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
servidor.js         ← el servidor de esta PC: sirve las páginas y guarda las solicitudes
servir.cmd          doble clic para levantarlo
js/config.js        dónde se guarda: local, supabase o nada
js/catalogo.js      gerencias, tipos, detalles, atajos, equipos y marcas
js/directorio.js    quién trabaja dónde, para no escribirlo cada vez
js/local.js         el modo prueba: el almacén del navegador cuando no hay servidor
js/solicitud.js     la lógica del formulario
js/bandeja.js       acceso, cola, atención e impresión
sql/esquema.sql     la tabla en Supabase, para el día que se mude
datos/              las solicitudes y los usuarios de GTIC (no va al repositorio)
```
