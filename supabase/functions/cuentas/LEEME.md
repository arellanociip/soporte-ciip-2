# Las cuentas de GTIC, en la nube

Esto le da a la bandeja el botón **Cuentas → + Crear una cuenta** cuando el
sitio corre contra Supabase. Contra el servidor de la oficina ya funciona sin
tocar nada: lo atiende `servidor.js` en `/auth/v1/admin/users`.

---

## Antes de nada: cierra el registro público

**Esto es lo más importante de este archivo, y no depende de desplegar nada.**

Comprobamos que tu proyecto acepta registros desde fuera. Como `esquema.sql` le
da a `authenticated` permiso de leer **todas** las solicitudes:

```sql
grant select, insert, update on gtic.solicitudes to authenticated;
```

…cualquiera que se registre entra a la bandeja y ve la cola completa de la casa.
La llave `anon` está publicada en el repositorio, así que registrarse no exige
nada más que saber la dirección.

**Panel → Authentication → Sign In / Providers → desactivar
"Allow new users to sign up".**

Mientras eso siga abierto, poner el botón de crear cuentas no sirve de mucho:
la puerta de al lado no tiene cerradura.

> Cómo lo comprobamos: al pedir un alta con la llave `anon`, Supabase respondió
> `email_address_invalid` (el correo de prueba era inventado) en vez de
> `signup_disabled`. No completamos la prueba con un correo válido a propósito,
> porque eso habría creado una cuenta de verdad. Así que es **muy probable**,
> no seguro. Compruébalo tú al entrar al panel.

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
- **borrar la última cuenta** — dejaría la bandeja cerrada para siempre

---

## Qué habla

La bandeja llama a `/functions/v1/cuentas` y espera exactamente lo mismo que le
responde el servidor de la oficina:

| Verbo | Qué hace | Devuelve |
|---|---|---|
| `GET` | Lista las cuentas | `[{correo, nombre, cargo, cedula, telefono, creado_en}]` |
| `POST` | Crea o corrige | `[{…, clave_nueva}]` |
| `DELETE ?correo=eq.X` | Da de baja | `[{correo}]` |

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

Lo que sí está probado es el lado de la oficina: 16 comprobaciones manejando
Edge contra `servidor.js`, incluida la que importa —que una cuenta creada desde
la bandeja sirva de verdad para entrar—.

Al desplegarla, vale la pena comprobar en este orden:

1. Entrar a la bandeja y abrir **Cuentas** → debería listar las que ya existen
2. Crear una con la clave en blanco → debería enseñar una tipo `ruvi-medi-20`
3. **Salir y entrar con esa cuenta nueva** → es la prueba de que sirve
4. Corregirle el cargo sin tocar la clave → y volver a entrar con la de antes
5. Intentar darse de baja a uno mismo → el botón ni debería salir
