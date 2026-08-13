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

**No hay que arrancar nada:** el servidor y el vigía se levantan solos al
encender la PC —hay un acceso directo a `arrancar.vbs` en la carpeta de Inicio—
y corren **sin ventana**. No hay ninguna ventana negra que se pueda cerrar por
error, que es como se quedaba la oficina sin sistema sin que nadie supiera por
qué.

| Doble clic en | Para |
|---|---|
| `estado.cmd` | Ver si están vivos, si la página responde y las últimas líneas del registro |
| `arrancar.vbs` | Levantarlos, si `estado.cmd` dice que están apagados |
| `detener.cmd` | Apagarlos (mientras estén apagados nadie puede pedir soporte) |

Todo lo que diga el servidor —incluido cualquier tropiezo, con su hora— queda en
`datos\servidor.log`. Si se cae, se vuelve a levantar solo a los cinco segundos.

`servir.cmd` sigue existiendo para arrancarlo **con** ventana, que es cómodo
cuando se está trabajando en el código y se quiere ver lo que pasa en vivo.

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

> **Lo que hay que saber del servidor en tu PC:** con el equipo apagado —o el
> servidor detenido— nadie puede pedir soporte ni ver la bandeja. Es
> el precio de no depender de la nube. Cuando eso empiece a estorbar, el paso
> siguiente es Supabase — y solo hay que cambiar `js/config.js`.

---

## Qué tan seguro es esto

Se auditó atacándolo desde fuera, como lo haría alguien de la red de la oficina
sin clave. Lo que aguantó:

- **Leer las solicitudes de los demás**: la lista completa pide sesión (401); por
  número no se puede; solo se ve una dando su `id`, que son 122 bits al azar.
- **Cambiar lo ajeno**: cerrar una solicitud o tocarle los datos a un técnico da
  401 sin sesión.
- **Entrar con clave ajena**: mismo mensaje para correo inexistente y clave mala;
  mandar un objeto en vez de una clave no cuela.
- **Salirse de la carpeta**: `datos/`, `..`, `%2e%2e` — todo 403 o 404.
- **Subir cosas raras**: un ejecutable renombrado a `.jpg` se rechaza mirando sus
  primeros bytes; los adjuntos no se pueden listar ni adivinar.
- **Texto con trampa**: se guardó una solicitud con etiquetas `script` e `img
  onerror` dentro y se abrió en la bandeja — cero ejecuciones, se ve como texto.

Lo que había que arreglar, y se arregló:

- **No había freno a los intentos de clave**: veinte por segundo. Ahora los cinco
  primeros son gratis y a partir de ahí la espera se dobla —1s, 2s, 4s, 8s…— por
  máquina y cuenta, y se olvida a los quince minutos de calma.
- **Se podía llenar la cola** con un guión. Ahora, veinte solicitudes por hora
  desde la misma máquina.
- **El servidor entregaba su propio código** a quien escribiera su nombre. Ahora
  solo sirve las páginas, `js/`, `css/` y `assets/`.
- **Salir no anulaba la sesión en el servidor**: un testigo copiado servía una
  hora más. Ahora se anula al salir.

Lo que sigue abierto, a sabiendas:

- **Va por `http://`, no `https`.** Quien pueda ver el tráfico de la red lee las
  claves de GTIC al entrar. Es lo más serio que queda y solo se arregla con un
  certificado.
- **`js/directorio.js` lleva 224 cédulas** y `js/inventario.js` 233 seriales: los
  sirve el servidor a cualquiera que abra el formulario. Fue una decisión, y está
  explicada en la cabecera de cada archivo.
- **La Hoja en PDF se baja con el `id` de la solicitud**, sin clave: es lo que
  permite que quien pidió el soporte se la lleve. Ese id no se adivina.
- **El rastro queda en la máquina.** El id que prueba que una solicitud es tuya
  vive en el navegador desde el que la enviaste, y con él se ve su estado, se
  habla con el técnico y se baja la Hoja con tu cédula y tu teléfono. En la
  computadora de uno da igual; en una prestada, no. Por eso el formulario tiene
  abajo *"No es mi computadora · borrar mi rastro"*, y por eso lo atendido hace
  más de dos meses se suelta solo.

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

## El equipo de cada quien

`js/inventario.js` sale del CUADRO_INVENTARIO_OFICINA de Patrimonio: de cada
renglón se toma solo lo que va impreso en la Hoja de Servicio —equipo, marca,
modelo y serial— pegado a la persona que lo usa.

La computadora va con su monitor: son dos renglones de la hoja, que para eso
tiene seis.

**Las impresoras están agrupadas por piso** —una impresora no es de nadie: la usa
el que se sienta cerca— y el mapa está hecho: 16 colocadas en los pisos 1, 2, 3,
4 y 8. Pero ofrecérselas a quien pide **está apagado a propósito**: preguntarle a
alguien cuál de las siete impresoras del piso 2 usa es pedirle un dato que
probablemente no sepa. Cuando el mapa esté afinado se vuelve a encender; lo que
lo sostiene sigue en .

Para qué: el serial es el dato que nadie se sabe de memoria y el que más retrasa
una hoja. Cuando alguien pide soporte por su computadora, la solicitud llega con
el primer renglón lleno y el técnico se lo encuentra escrito. En el formulario
sale una línea —*Tu equipo · CPU · LENOVO · TINKCENTRE M92P · serial MJ30DK8*—
con un *"No es ese"* que lo suelta.

**245 equipos de 94 personas.** Se pegaron primero por cédula, que es exacta, y
si el cuadro no la traía, por nombre y solo cuando señala a una única persona del
directorio: ante la duda se deja fuera, que más vale una hoja sin serial que una
con el serial de otro. Los 124 renglones restantes son de equipos sin dueño
asignado en el cuadro ("VACANTE", "SIN USUARIO") o de gente que ya no está en el
listado del personal.

Es un punto de partida, no una autoridad: si el técnico ve que el equipo no es
ese, lo corrige en la ficha y manda lo que corrigió.

---

## La base del conocimiento

Vive dentro de la bandeja, detrás de la clave, y funciona por dos vías que se
usan en momentos distintos:

**Sin escribir nada.** Al abrir una solicitud, la ficha muestra cómo se
resolvieron las anteriores del mismo tipo de servicio: número, fecha, quién la
atendió y lo que dejó escrito en Observaciones. No cuesta trabajo extra a nadie
—son las mismas observaciones que ya salen impresas en la hoja— y empieza a
servir con la segunda solicitud parecida que entre.

**Escribiendo.** De un caso bien resuelto, el botón *"Guardar esto como guía"*
abre una ventana con el título y los pasos ya puestos; se corrige y se guarda. A
partir de ahí esa guía sale sola en las fichas del mismo tipo de servicio, o en
aquellas cuyo texto la nombre. Y en el enlace **"Base del conocimiento"** del
encabezado están todas, buscables por título, contenido o tipo.

**Lo que ve la casa.** Cada guía tiene además un campo aparte —*"Lo que puede
intentar quien pide"*— que es lo único que sale de la gerencia. Al elegir el
atajo en el formulario, quien va a pedir soporte de ese tipo lo ve justo encima
del botón de enviar: *"Quizá lo resuelvas ahora mismo"*. Puede cerrarlo y enviar
igual; no obliga a nada.

Ese campo en blanco significa que la guía **no sale de GTIC**. El servidor lo
sostiene con una ruta aparte, `/rest/v1/guias_publicas`, que devuelve solo el
título y ese párrafo —nunca el cuerpo de la guía— y solo de las que lo tengan.
Así lo que se publica se decide en un sitio y se lee de un vistazo.

Se guardan en `datos/guias.json`, en el servidor y no en el navegador: lo que
aprendió uno tiene que estar en la máquina del otro. El cuerpo solo se lee con
sesión iniciada, así que ahí se pueden anotar mañas de la casa —claves de
equipos, a quién llamar— que no tienen por qué salir de la gerencia.

---

## La Hoja de Servicio en PDF

Cuando una solicitud queda atendida, a quien la pidió le sale junto al camino
de su solicitud un enlace: **Hoja de Servicio**. Baja el mismo documento que
GTIC imprime y firma, en PDF, sin pasar por el diálogo de imprimir.

En la bandeja está en los dos sitios: un botón **PDF** en cada fila atendida —para
archivar sin abrir nada— y otro dentro de la ficha, al lado de Imprimir.

No es una segunda versión hecha a mano: la hoja se arma una sola vez
() y de ahí salen las dos cosas —lo que va a la impresora desde la
bandeja y lo que se convierte en PDF—. Para convertirla, el servidor abre
 con Edge sin ventana y le dice que imprima a PDF; así el archivo es
exactamente el documento que ya existía, con su logo y su formato. Tarda unos
dos segundos.

Si Edge no estuviera, el servidor arma un PDF más sencillo él mismo
(, escrito a mano, sin librerías): se ve más pobre, pero dice lo mismo
y nadie se queda sin su comprobante.

---

## Fotos y PDF en la conversación

Dentro del chat, el clip abre un menú con dos opciones: **foto o imagen** y
**documento PDF**. Sirve en las dos direcciones —quien pide manda la foto de la
pantalla, GTIC manda el instructivo— y hasta cuatro archivos por mensaje. Un
mensaje puede ser solo una foto, sin texto.

Las fotos se achican en el navegador antes de subirlas: 1600 píxeles del lado
largo y JPEG. Lo que sale del teléfono con cuatro megas llega en unos cientos de
kilobytes. El tope es 8 MB por archivo.

Se guardan en `datos/adjuntos/`, con un nombre de 32 caracteres al azar —no el
que traía— y se sirven por `/adjuntos/<nombre>`. Esa dirección imposible de
adivinar es lo que hace de permiso, igual que el id de la solicitud para quien la
pidió: la carpeta no se puede listar y un nombre que no case con ese patrón ni se
busca. El servidor comprueba lo que el archivo **es** —los primeros bytes— y no
lo que dice ser, así que un ejecutable renombrado a .jpg no entra.

---

## El vigía: que la bandeja salte sola

En **esta** máquina ya viene puesto: lo levanta `arrancar.vbs` junto con el
servidor, sin ventana. Se queda escuchando y, en cuanto entra una solicitud, trae
la bandeja al frente de la pantalla; si no estaba abierta, la abre en su propia
ventana.

**En la máquina de otro compañero**, doble clic en **`vigia.cmd`** —ese sí abre
una ventanita, que hay que dejar abierta— o en **`vigia-al-encender.cmd`** para
que arranque solo con Windows. Se quita borrando el acceso directo: `Windows+R`,
escribe `shell:startup`, y borra el que diga "Vigia de la bandeja".

**Si no salta, lo primero es mirar si está andando**: su ventanita tiene que
estar abierta (busca "Vigia de la bandeja" en la barra de tareas). Y todo lo que
hace queda apuntado en **`vigia.log`**, al lado del programa: ahí se ve la hora
de cada solicitud que le llegó y si consiguió traer la ventana. Si el archivo no
crece cuando entra una solicitud, es que el vigía no está corriendo o no llega al
servidor. Dos a la vez no se pueden: el segundo avisa y se cierra solo.

**En la máquina de otro compañero funciona igual**: copia la carpeta —bastan
`vigia.cmd` y `vigia.ps1`— y doble clic allí. Va en PowerShell a propósito, que
ya viene con Windows: no hay que instalarle nada. Node solo hace falta en esta
máquina, la del servidor. Si el servidor cambia de IP, la dirección se corrige en
la primera línea de `vigia.cmd`.

Solo salta con las solicitudes **nuevas**, no cada vez que un técnico toma o
cierra una: el servidor distingue las dos cosas en el aviso que manda. Ese aviso
no lleva ningún dato dentro —solo dice "entró una"—, así que quien lo escuche
desde la red no se entera de quién pidió ni de qué.

Traer una ventana al frente es lo único delicado de todo esto: Windows no deja
que un programa de segundo plano robe el foco, y el truco que lo consigue —
engancharse al hilo de la ventana que lo tiene y tocar la tecla Alt— falla de vez
en cuando. Si un día no salta, la ventana igual queda levantada y su botón
parpadeando en la barra de tareas.

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

**Y puede hablar con quien la atiende.** En cuanto un tecnico la toma, aparece
su nombre y un hilo para escribirle: a que hora esta, donde lo consigue, lo que
haga falta. GTIC ve y responde el mismo hilo desde la ficha. Los mensajes no
salen en la Hoja de Servicio; son para ponerse de acuerdo, no para el acta.

> Quien habla no lo dice el mensaje, lo dice como llego: con sesion de GTIC
> habla el tecnico; sin ella, habla quien pidio, y su prueba es el mismo id
> imposible de adivinar de su solicitud. Nadie puede escribir haciendose pasar
> por otro, y quien pide sigue sin necesitar cuenta.

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
arrancar.vbs        levanta el servidor y el vigia sin ventana (arranca con Windows)
estado.cmd          si estan vivos y que dice el registro
detener.cmd         apagarlos
servir.cmd          levantarlo CON ventana, para trabajar en el codigo
js/config.js        dónde se guarda: local, supabase o nada
js/catalogo.js      gerencias, tipos, detalles, atajos, equipos y marcas
js/directorio.js    quién trabaja dónde, para no escribirlo cada vez
js/inventario.js    qué equipo usa cada quien, para no escribir el serial
js/local.js         el modo prueba: el almacén del navegador cuando no hay servidor
js/adjuntos.js      el clip del chat: fotos y PDF, iguales en las dos páginas
js/hoja.js          la Hoja de Servicio: la misma para imprimir y para el PDF
hoja.html           esa hoja sola en una página; es lo que el servidor convierte en PDF
pdf.js              el PDF de reserva, hecho a mano, por si no hay navegador
js/solicitud.js     la lógica del formulario
js/bandeja.js       acceso, cola, atención, guías e impresión
sql/esquema.sql     la tabla en Supabase, para el día que se mude
vigia.ps1           el vigía: trae la bandeja al frente cuando entra una solicitud
vigia.cmd           doble clic para arrancarlo
datos/              solicitudes, usuarios y guías de GTIC (no va al repositorio)
```
