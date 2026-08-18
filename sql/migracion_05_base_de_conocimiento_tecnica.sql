-- =====================================================================
-- Solicitudes de soporte · GTIC · CIIP
-- Migración 05: la base del conocimiento, limpia y con contenido real
-- Se pega en el SQL Editor de Supabase y se corre una sola vez, DESPUÉS
-- de esquema.sql y de las migraciones 01 a 04.
--
-- De dónde sale esto:
--
-- Mientras se armaba la cuenta obligatoria (migración 04) quedaron en
-- gtic.guias entradas de prueba —"asdasdasd", cosas escritas para ver que
-- el circuito funcionara— y ya le estaban saliendo a la gente que pide
-- soporte de verdad, en el aviso "Quizá lo resuelvas ahora mismo".
--
-- Esta migración: 1) vacía la tabla por completo, y 2) la vuelve a llenar
-- con una guía por cada uno de los 17 detalles reales del catálogo
-- (js/catalogo.js: CAT_SERVICIOS), para que ese aviso tenga algo que
-- ofrecer sin importar qué atajo se haya elegido, y para que la ficha de
-- cada solicitud en la bandeja arranque con una base técnica de verdad en
-- vez de vacía.
--
-- `categoria` tiene que calzar EXACTO —salvo mayúsculas, eso sí es parejo—
-- con el `detalle` de CAT_SERVICIOS en js/catalogo.js: así es como
-- js/solicitud.js (ayudaDeAhora) y js/bandeja.js encuentran la guía de cada
-- ficha. Si el día de mañana se agrega o se renombra un detalle allá, hace
-- falta una guía nueva o corregida aquí para que siga calzando.
--
-- `solucion` es lo único que ve quien pide soporte (columna pública de
-- gtic.guias_publicas), y por eso solo se puso en los casos donde de
-- verdad hay algo seguro que alguien sin conocimientos técnicos pueda
-- probar por su cuenta. Donde no —formatear un equipo, cambiarle una
-- pieza, dejarle el sistema operativo listo— se deja en blanco a
-- propósito: no es un hueco por llenar, es la gerencia decidiendo que eso
-- no sale de GTIC. `cuerpo` sí lleva, en los 17 casos, los pasos que un
-- técnico de GTIC puede seguir para atender el caso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Vaciar lo que hay
-- ---------------------------------------------------------------------
truncate table gtic.guias;


-- ---------------------------------------------------------------------
-- 2. La base técnica, una guía por cada detalle del catálogo
-- ---------------------------------------------------------------------

-- ===== ASISTENCIA =====

insert into gtic.guias (titulo, categoria, cuerpo, solucion) values
('Enseñar a usar un programa', 'MANEJO DE SOFTWARE',
'1. Pedir que comparta pantalla o ir al puesto: es más rápido mostrar que describir por chat.
2. Identificar la tarea concreta (no "no sé usar Excel", sino "necesito una fórmula que sume por gerencia").
3. Resolver el caso de esa persona primero, y después mostrar el camino general (dónde está el menú, el atajo de teclado) para que la próxima vez lo intente sola.
4. Si es un programa que se repite mucho (Excel, Word, el sistema de Patrimonio), dejar anotado en Observaciones el paso exacto que se enseñó: sirve de guía para el próximo caso parecido.
5. Si el programa está desactualizado o mal instalado, dejarlo resuelto de raíz en vez de solo enseñar el rodeo.',
'Antes de pedir soporte, prueba con el clic derecho o el menú "Ayuda" del propio programa (tecla F1 en la mayoría). Muchas veces tiene un asistente o buscador que resuelve lo puntual sin esperar.'),

('Enseñar a usar un equipo', 'MANEJO DE DISPOSITIVOS',
'1. Ir al puesto: enseñar a usar un teléfono IP, un videobeam o un escáner por chat casi nunca funciona.
2. Mostrar la operación completa una vez (ej. transferir una llamada) y después hacer que la persona la repita mientras el técnico observa.
3. Si el equipo tiene una guía rápida impresa o pegada cerca, señalarla; si no la tiene, considerar imprimir una y dejarla ahí para que no se repita la misma llamada.
4. Anotar en Observaciones qué se enseñó, para que si otro técnico atiende a la misma persona después no repita desde cero.',
'Revisa si el equipo tiene una guía rápida pegada cerca (la mayoría de teléfonos IP y videobeams del piso la traen). Si no la encuentras, igual manda la solicitud.'),

('Recuperar o respaldar archivos', 'RESPALDO Y/O RECUPERACIÓN DE ARCHIVOS',
'1. Preguntar primero si ya revisó la Papelera de Reciclaje del equipo: resuelve la mayoría de los "se borró".
2. Si no está ahí, revisar versiones anteriores del archivo/carpeta (clic derecho → Propiedades → Versiones anteriores, o el historial de OneDrive si la cuenta lo usa).
3. Si de verdad se perdió y no hay respaldo, NO seguir usando el disco para escribir archivos nuevos hasta intentar la recuperación: cada archivo nuevo puede sobrescribir lo que se intenta recuperar.
4. Usar una herramienta de recuperación de archivos borrados (ej. Recuva) apuntando al disco, nunca instalándola en el mismo disco donde se perdió el archivo.
5. Si la recuperación no es posible, dejarlo anotado y aprovechar para configurar un respaldo automático a futuro (carpeta de red, OneDrive, o un disco externo con copia periódica) y así no depender de que no se vuelva a borrar.',
'Antes de nada, revisa la Papelera de Reciclaje de tu computadora — ahí sigue la mayoría de lo que se "borra" sin querer. Si lo encuentras, clic derecho → Restaurar. Si no está, deja de guardar cosas nuevas en esa carpeta y manda la solicitud: así no se pierde la posibilidad de recuperarlo.'),

-- ===== SOPORTE_TECNICO =====

('Cuenta de usuario, correo o permisos', 'CONFIGURACIÓN DE CUENTA USUARIO',
'1. Confirmar si el problema es la clave (olvidada, vencida) o el acceso (no ve una carpeta, no le llega el correo).
2. Clave: reiniciarla desde el panel de administración del correo institucional (Google Workspace/Exchange, según cuál use la casa) y entregarla en persona o por un canal distinto al correo que quedó bloqueado.
3. Correo que no sincroniza: revisar el perfil de Outlook/cliente de correo, y si está corrupto, recrear el perfil en vez de repararlo pieza por pieza — suele ser más rápido.
4. Permisos de carpeta o unidad de red: verificar en el servidor de archivos a qué grupo pertenece la cuenta y si ese grupo tiene el permiso que falta; agregarla al grupo correcto en vez de dar el permiso a la cuenta individual, para que quede documentado por qué lo tiene.
5. Si la cuenta es nueva (alta de personal), seguir la lista estándar: correo, carpeta de red, impresora del piso, accesos a los sistemas internos que le correspondan por gerencia.',
'Si el problema es que olvidaste la clave, no sigas intentando adivinarla: después de cinco intentos el sistema empieza a bloquear por más tiempo cada vez. Manda la solicitud directamente y GTIC te la restablece.'),

('Instalar o configurar una impresora', 'INSTALACIÓN Y/O CONFIGURACIÓN DE IMPRESORA',
'1. Confirmar el piso y qué impresora de red le corresponde (son compartidas por piso, no asignadas a una persona).
2. En el equipo: Configuración → Impresoras y escáneres → Agregar, y buscarla por nombre de red o por IP si no aparece en la lista automática.
3. Si no la detecta, verificar que el equipo esté en la misma VLAN/segmento de red que la impresora — un problema común al mudar un equipo de piso sin actualizar su red.
4. Instalar el driver correcto de la marca/modelo (no un genérico) para evitar fallas de calidad o de bandeja de papel.
5. Imprimir una página de prueba antes de cerrar el caso.',
'Antes de pedir instalación, revisa si la impresora ya aparece en tu lista de impresoras con otro nombre (a veces queda como "no conectada" tras un cambio de red). Si no aparece ninguna, manda la solicitud con el piso donde estás.'),

('Instalar o configurar un videobeam', 'INSTALACIÓN Y/O CONFIGURACIÓN DE DISPOSITIVO DE PROYECCIÓN DE IMAGEN',
'1. Verificar el cable correcto para el equipo que se va a conectar (HDMI es el estándar; VGA solo en equipos viejos, y sin audio).
2. En Windows, tecla Windows+P para elegir "Duplicar" (se ve lo mismo en pantalla y proyector) o "Extender" (dos pantallas distintas) según lo que pida la reunión.
3. En el proyector, seleccionar la entrada correcta con el control remoto (HDMI 1, HDMI 2, VGA) — la causa más común de "no se ve nada" es que está en la entrada equivocada.
4. Si la imagen se ve pero no el sonido, recordar que HDMI sí lleva audio pero VGA no: en VGA hace falta un cable de audio aparte o parlantes propios.
5. Probar la conexión completa (imagen + lo que se necesite proyectar) antes de la hora de la reunión, no durante.',
'Si no se ve nada, presiona la tecla Windows + P en tu computadora y elige "Duplicar". Revisa también que el proyector esté en la entrada correcta (HDMI o VGA) con el botón "Source" o "Input" del control remoto.'),

('Dejar listo un equipo nuevo', 'INSTALACIÓN DE SISTEMA OPERATIVO (EQUIPOS NUEVOS)',
'1. Instalar el sistema operativo con la imagen/licencia estándar de la casa, no una copia suelta.
2. Unirlo al dominio o crear la cuenta local según corresponda, y aplicar las actualizaciones pendientes antes de entregarlo.
3. Instalar el paquete estándar de software (ofimática, PDF, antivirus, cliente de correo) — la misma lista para todos evita que cada equipo termine distinto.
4. Configurar la cuenta de correo, la impresora del piso y los accesos de red que le correspondan a quien lo va a usar.
5. Registrar el equipo en el inventario de Patrimonio con su serial, antes de entregarlo, para que quede a nombre de quien lo va a usar desde el primer día.
6. Entregar con una explicación breve de lo esencial (dónde está el ícono de soporte, cómo imprimir) para no recibir la misma pregunta al día siguiente.',
NULL),

('Mudar un equipo de puesto u oficina', 'MOVILIZACIÓN Y/O REUBICACIÓN DE ACTIVOS TECNOLÓGICOS',
'1. Antes de desconectar nada, anotar cómo estaba conectado (qué cable a qué puerto), sobre todo si hay periféricos poco comunes.
2. Verificar que el puesto de destino tenga punto de red activo y corriente suficiente antes de mover el equipo, no después.
3. Mover el equipo con cuidado (apagado, no en suspensión) y reconectar todo antes de dar por cerrada la mudanza.
4. Probar que enciende, que agarra red y que imprime en la impresora del piso nuevo (puede ser una distinta a la de antes).
5. Actualizar la ubicación en el inventario de Patrimonio: piso y oficina nuevos, para que la próxima solicitud de esa persona ya traiga el dato correcto.',
NULL),

('Sin conexión de red o internet', 'CONECTIVIDAD DE RED O INTERNET',
'1. Preguntar si es solo ese equipo o todo el piso: si es varios puestos a la vez, es un problema de switch/piso y no de PC, y cambia la prioridad.
2. Revisar el cable de red en ambos extremos (equipo y toma de pared) y probar con otro cable si hay duda.
3. Revisar las luces del switch/punto de red del piso: si no hay luz de enlace, el problema está antes del equipo.
4. Si el cable está bien, hacer ipconfig /release y /renew, y si sigue sin salir, revisar la asignación de IP/VLAN de ese punto de red.
5. Con Wi-Fi: confirmar que está conectado a la red de la casa y no a una vecina, y no a la de CloudflareWARP (172.16.x), que es la del VPN y no da acceso a la red interna.
6. Si el problema persiste solo en un servicio (no en todo internet), revisar si es un bloqueo de firewall o de DNS en vez de un problema de cable.',
'Revisa que el cable de red esté bien puesto en los dos extremos (la computadora y la toma de la pared) — se sale con facilidad al mover el equipo o el escritorio. Si tienes Wi-Fi, confirma que estás conectado a la red de la oficina y no a la del VPN.'),

('La computadora no enciende o se apaga sola', 'OPERATIVIDAD DE CPU',
'1. Confirmar que el problema es de corriente: probar el mismo tomacorriente con otro equipo, y probar el CPU en otro tomacorriente.
2. Revisar que el cable de poder esté bien asentado en ambos extremos (fuente de poder y regleta/pared) — se afloja con el uso.
3. Si enciende pero se apaga sola: sospechar sobrecalentamiento (ventiladores con polvo) o fuente de poder fallando; abrir y revisar disipación antes de cambiar piezas.
4. Si no enciende ni la lucecita: probar reasentar la memoria RAM (sacarla y volver a ponerla) antes de asumir que la fuente o la tarjeta madre están dañadas.
5. Anotar cualquier pitido o patrón de luces al encender: son códigos de diagnóstico de la tarjeta madre que acortan la revisión.',
'Antes de mandar la solicitud, verifica que el cable de poder esté bien conectado en los dos extremos y que el tomacorriente funcione probándolo con otro aparato (un cargador, por ejemplo). No abras el gabinete tú mismo.'),

('La pantalla no muestra nada', 'OPERATIVIDAD DEL MONITOR',
'1. Confirmar si el CPU está encendido (luz, ruido de ventiladores) mientras el monitor está en negro: si el CPU sí prende, el problema es del monitor o del cable, no de la computadora.
2. Revisar el cable de video en ambos extremos y probar con otro cable si hay uno disponible.
3. Verificar la fuente de entrada del monitor con su botón físico (HDMI/VGA/DisplayPort) — muchos "no prende" son en realidad la entrada equivocada.
4. Probar el monitor en otro equipo, o un monitor distinto en este equipo, para aislar si la falla es del monitor o de la salida de video del CPU.
5. Revisar el brillo/contraste del monitor con sus botones físicos antes de descartar que sea solo eso.',
'Revisa que el monitor tenga su luz de encendido prendida y que el cable esté bien conectado en los dos extremos. Prueba también el botón de "Source" o "Input" del monitor por si quedó en la entrada equivocada.'),

('Teclado, mouse u otro periférico no responde', 'OPERATIVIDAD DE OTROS PERIFÉRICOS DE LA COMPUTADORA',
'1. Probar el periférico en otro puerto USB del mismo equipo: descarta un puerto dañado.
2. Si es inalámbrico, revisar o cambiar las baterías y el receptor USB (a veces basta con reconectar el receptor).
3. Probar el periférico en otro equipo para confirmar si la falla es de él o del puerto/driver del equipo original.
4. Si el equipo no reconoce ningún dispositivo USB, revisar drivers de controladores USB en el Administrador de dispositivos antes de sospechar del hardware.
5. Limpiar mecánicamente si hay teclas pegajosas o suciedad visible — es la causa más común en teclados con años de uso.',
'Prueba el dispositivo en otro puerto USB del mismo equipo. Si es inalámbrico, revisa o cambia las pilas primero — es la causa más común.'),

('No imprime o imprime mal', 'SOLUCIÓN DE PROBLEMAS DE IMPRESIÓN',
'1. Revisar la cola de impresión: si hay un trabajo atascado, los siguientes no salen hasta limpiarla (Panel de control → Dispositivos e impresoras → Ver cola → Cancelar todos).
2. Reiniciar el servicio de cola de impresión (services.msc → Cola de impresión → Reiniciar) si cancelar no libera el atasco.
3. Papel atascado: revisar con la impresora apagada, retirar el papel con cuidado sin forzar hacia el lado equivocado (seguir la dirección del rodillo).
4. Calidad mala (rayas, manchas, texto tenue): revisar nivel de tóner/tinta y limpiar cabezales si el modelo lo permite desde su panel.
5. Si imprime desde un equipo y no desde otro, el problema es del driver/cola de ese equipo puntual, no de la impresora — reinstalar la impresora en ese equipo primero.',
'Revisa si hay papel atascado (con la impresora apagada, retíralo con cuidado) y si la luz de tóner o papel está encendida en el panel de la impresora. Si nada de eso aplica, intenta imprimir de nuevo una sola vez antes de mandar la solicitud.'),

('Computadora muy lenta / limpieza o instalación de programas', 'FORMATEO Y LIMPIEZA DEL ORDENADOR Y/O INSTALACIÓN DE APLICACIONES',
'1. Antes de formatear, medir qué tan lento está: Administrador de tareas → Rendimiento, para ver si es disco, memoria o procesador lo que está al tope.
2. Revisar programas que arrancan con Windows (Administrador de tareas → Inicio) y deshabilitar los que no hacen falta — resuelve una parte importante sin formatear.
3. Liberar espacio en disco (Liberador de espacio en disco, vaciar Descargas y Papelera) si el disco está casi lleno: un disco muy lleno vuelve lento a cualquier equipo.
4. Si after eso sigue lento, o si el equipo tiene software corrupto/malware, planificar el formateo: respaldar lo importante primero (ver la guía de Respaldo y/o recuperación de archivos), reinstalar sistema y paquete estándar.
5. Instalar solo el software que la persona necesita para su trabajo, no un paquete genérico — cada programa de más es un programa más lento para arrancar.',
'Antes de pedir soporte, cierra los programas y pestañas del navegador que no estés usando y reinicia la computadora — resuelve buena parte de los casos de "está lenta" sin necesidad de nada más. Si sigue igual después de eso, manda la solicitud.'),

('Mantenimiento preventivo', 'MANTENIMIENTO PREVENTIVO',
'1. Limpieza física interna: polvo de ventiladores y disipadores, con el equipo apagado y desconectado.
2. Revisar estado de la pasta térmica del procesador si el equipo tiene más de dos años sin mantenimiento — el polvo y el secado de la pasta son la causa más común de sobrecalentamiento progresivo.
3. Revisar cables internos y externos por daño o mal contacto.
4. Verificar que el sistema operativo y los programas estén con las actualizaciones pendientes al día.
5. Dejar registrada la fecha del mantenimiento en el inventario, para calcular cuándo toca el siguiente.',
NULL),

('Mantenimiento correctivo (equipo dañado)', 'MANTENIMIENTO CORRECTIVO',
'1. Diagnosticar antes de desmontar: síntomas exactos (ruido, olor, no arranca, se congela) ayudan a aislar la pieza sin probar una por una.
2. Aislar el componente sospechoso probándolo en otro equipo si es posible (memoria, disco, fuente de poder).
3. Si la reparación requiere una pieza que no hay en existencia, dejar constancia en la solicitud de qué se necesita y el tiempo estimado, para que la persona sepa qué esperar.
4. Si el equipo está fuera de garantía y el costo de repararlo se acerca al de uno nuevo, dejarlo anotado como recomendación en vez de invertir en la reparación.
5. Probar el equipo con uso normal (no solo que encienda) antes de darlo por resuelto y devolverlo.',
NULL),

('Ampliar memoria, disco u otro componente', 'UPGRADE DE HARDWARE DE PCS Y PORTÁTILES (AUMENTO DE MEMORIA RAM, CAMBIO DE PROCESADOR, DISCO DURO, TARJETAS GRÁFICAS, ETC.)',
'1. Confirmar la compatibilidad exacta antes de comprar o instalar: tipo y velocidad de RAM soportada por la tarjeta madre, tipo de conexión del disco (SATA/NVMe), y si el gabinete/fuente soportan la pieza nueva.
2. Respaldar los datos importantes antes de cualquier cambio que involucre el disco (ver la guía de Respaldo y/o recuperación de archivos) — un cambio de disco sin respaldo es el error más caro de este tipo de trabajo.
3. Si es upgrade de disco, clonar el sistema al disco nuevo en vez de reinstalar desde cero cuando sea posible: ahorra horas de configuración.
4. Después de instalar, verificar en el sistema que la pieza nueva fue reconocida a su capacidad/velocidad real (una RAM que se reconoce a menos de lo instalado suele indicar un slot o una pieza con problema).
5. Actualizar el inventario de Patrimonio con la especificación nueva del equipo.',
NULL)
;
