# Las cuentas de GTIC, en la nube

Esto le da a la bandeja el botón **Cuentas → + Crear una cuenta** cuando el
sitio corre contra Supabase. Contra el servidor de la oficina ya funciona sin
tocar nada: lo atiende `servidor.js` en `/auth/v1/admin/users`.

---

## Antes de nada: NO cierres el registro público

**Una versión anterior de este archivo pedía justo lo contrario, y hacerle
caso rompería el sitio.** Se deja escrito porque el consejo llegó a estar aquí.

El motivo de aquel aviso era que `esquema.sql` le daba a `authenticated`
permiso de leer **todas** las solicitudes, así que cualquiera que se
registrara vería la cola entera de la casa. Eso dejó de ser cierto: la
migración 03 sustituyó esa política por `ver: gtic todo, cada quien lo suyo`.
Hoy una cuenta recién hecha solo ve lo suyo, no lee las guías, no toca el
inventario y —desde el cambio de la bandeja— ni siquiera entra a ella.

Y quién puede registrarse ya lo limita el portero de la migración 03: solo
los correos de `gtic.correos_permitidos`, que llena GTIC.

Así que **Authentication → Sign In → "Allow new users to sign up" va
ENCENDIDO**. Si se apaga, ninguna de las ~177 personas de la casa puede
hacerse su cuenta y GTIC tendría que crearlas todas a mano.

Lo que sí hay que comprobar es que el portero esté puesto de verdad, porque
se instaló envuelto en un manejador que solo avisa si falla:

```sql
select tgname from pg_trigger
 where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

Si `solo_correos_de_la_casa` no sale ahí, entonces sí hay que limitar el
registro: Authentication → Providers → Email → "Restrict sign ups to…".

---

## Desplegar

Desde la raíz del repositorio, con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref hvbdquxsalzhjqxwlnpt
supabase functions deploy cuentas
```

No hay que configurar ningún secreto: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` las inyecta Supabase sola en
cada función.

Para verla trabajar mientras se prueba:

```bash
supabase functions logs cuentas --tail
```

---

## Por qué una Edge Function y no la página

Crear cuentas exige la llave `service_role`, que **bypasea todos los permisos
de todas las tablas**. Quien la tenga puede leer y borrar la casa entera.

Una página web es código que se descarga, así que todo lo que esté ahí es
público. Meter esa llave en `js/config.js` sería regalar el sistema.

Dentro de una Edge Function sí puede vivir: corre en el servidor de Supabase,
nunca se descarga, y llega por variable de entorno sin quedar escrita en el
repositorio.

## Quién puede llamarla

Solo alguien que ya tenga cuenta de GTIC. La función toma el testigo que manda
el navegador y **le pregunta a Supabase de quién es** — no se lo cree. Sin
testigo válido responde `401` y no toca nada.

No hay jefes: cualquiera que ya esté dentro puede dar de alta a otro. Es lo
coherente con el resto del sistema, donde todas las cuentas ven y atienden
todas las solicitudes.

Dos cosas que sí se impiden, las mismas que en `servidor.js`:

- **darse de baja a uno mismo** — casi siempre es un dedazo
- **borrar la última cuenta de GTIC** — dejaría la bandeja cerrada para siempre

---

## Qué habla

La bandeja llama a `/functions/v1/cuentas` y espera exactamente lo mismo que le
responde el servidor de la oficina:

| Verbo | Qué hace | Devuelve |
|---|---|---|
| `GET` | Lista las cuentas **de GTIC** | `[{correo, nombre, cargo, cedula, telefono, creado_en}]` |
| `POST` | Crea o corrige, y da el papel de GTIC | `[{…, clave_nueva}]` |
| `DELETE ?correo=eq.X` | Da de baja | `[{correo}]` |

Desde que la bandeja pregunta quién eres —`js/bandeja.js` llama a
`gtic.es_gtic()` antes de dejar pasar—, este panel no solo crea cuentas:
**asigna el papel**. `POST` mete a la persona en `gtic.personal` y `DELETE`
la saca antes de borrar la cuenta. Sin eso, el panel crearía cuentas que su
propia bandeja rechaza.

Por lo mismo, `GET` lista solo a quien está en `gtic.personal`, y `DELETE`
se niega a tocar una cuenta que no lo esté: la de quien pide soporte no es
asunto de este panel.

La clave se puede dejar vacía: en una cuenta nueva **se inventa una que se
puede dictar por teléfono** (`ruvi-medi-20`) y viaja **una sola vez** en
`clave_nueva`; en una que ya existe significa "no me la toques", que es lo que
hace falta al corregirle el cargo a alguien.

Las claves nunca se guardan ni se devuelven: de eso se encarga Supabase Auth,
igual que `servidor.js` guarda solo una huella con scrypt.

Los cuatro datos del técnico —nombre, cargo, cédula, teléfono— viven en el
`user_metadata`, que es de donde los lee también `enviar_mensaje` para saber
quién habla en el chat.

---

## Lo que NO está probado

Esta función **no se ha ejecutado nunca**. Se escribió leyendo el
comportamiento de `servidor.js` para que responda igual, pero no hubo forma de
desplegarla ni de probarla desde aquí: hace falta acceso al panel de Supabase.

Y lo que se le añadió después —que asigne el papel en `gtic.personal`—
tampoco se ha ejecutado. Es lo primero que hay que mirar al desplegarla.

Lo que sí está probado es el lado de la oficina: 16 comprobaciones manejando
Edge contra `servidor.js`, incluida la que importa —que una cuenta creada desde
la bandeja sirva de verdad para entrar—.

Al desplegarla, vale la pena comprobar en este orden:

1. Entrar a la bandeja y abrir **Cuentas** → debería listar las que ya existen
2. Crear una con la clave en blanco → debería enseñar una tipo `ruvi-medi-20`
3. **Salir y entrar con esa cuenta nueva** → es la prueba de que sirve
4. Corregirle el cargo sin tocar la clave → y volver a entrar con la de antes
5. Intentar darse de baja a uno mismo → el botón ni debería salir
6. **Que la cuenta nueva entre a la bandeja** → si la rechaza con "esta
   cuenta no es de GTIC", el papel no se asignó: míralo con
   `select correo from gtic.personal;`
7. Dar de baja a alguien → debe desaparecer de `gtic.personal` y de
   Authentication → Users
