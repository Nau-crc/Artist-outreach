# Manual de uso — Artist Outreach

Guía en lenguaje llano para el equipo que va a usar la aplicación.

## Qué hace la app

Ayuda a descubrir artistas cuyos emails están públicos en fuentes autorizadas, guarda esos contactos con historial, permite revisarlos a mano, y — cuando esté todo listo y validado jurídicamente — pedirles consentimiento por email para que decidan si quieren unirse a la newsletter. Ninguna persona recibe correos nuestros sin haberlo autorizado explícitamente.

## Cuatro conceptos que NUNCA hay que confundir

La aplicación mantiene estos cuatro conceptos completamente separados. Es la base del cumplimiento legal.

1. **Email encontrado** — hemos visto una dirección en una fuente pública.
2. **Contacto aprobado para contactar** — una persona (humana) revisó ese email y decidió que cumple los criterios para poder pedirle consentimiento.
3. **Consentimiento** — la propia persona ha confirmado activamente que quiere recibir nuestros mensajes.
4. **Suscriptor** — el consentimiento se ha convertido en una suscripción real (double opt-in confirmado por segundo click).

**Nunca** saltamos ningún paso. Encontrar un email público no da derecho a escribir. Aprobarlo internamente no equivale a que la persona haya dicho sí. Recibir un sí a la solicitud no equivale a estar suscrito a la newsletter.

## Cómo entrar al panel

1. Abre `https://artistoutreach.vercel.app/admin` en el navegador.
2. Login con tu email y contraseña.
3. Aterrizas en el **Dashboard** con métricas resumidas y botones para navegar.

Si te falla el login, avísale al administrador — probablemente hay que darte alta como usuario en la base de autenticación.

## Panorama del panel

- **Dashboard** — resumen y accesos.
- **Contactos** — listado con búsqueda y filtros.
- **Cola de revisión** — contactos pendientes de decisión humana.
- **Fuentes web** — donde registras y verificas las URLs que la entidad autorizada te ha dado permiso a rastrear.
- **Importar CSV** — subir listas propias.
- **Plantillas** — los emails que se enviarán a los artistas.
- **Campañas** — agrupan las plantillas para una temporada / propósito.
- **Solicitudes de consentimiento** — la cola de mensajes preparados para enviar.
- **Simular** — comprobar quién sería elegible antes de encolar.
- **Auditoría** — historial completo de todo lo que ha pasado.
- **Ajustes** — interruptores globales.

## Flujo completo paso a paso

Voy a describir el flujo desde cero. Antes de la primera vez que uses la app, ten a mano la documentación jurídica que autoriza el tratamiento de los datos de las fuentes que vas a usar.

### 1. Registrar una fuente autorizada

Menú → **Fuentes web** → **Registrar**.

Rellena:
- **Nombre interno**: cómo la llamarás tú. Ej. "Entidad X — artistas verano 2026".
- **URL raíz**: la URL desde la que empezar a rastrear. Ej. `https://entidad.example/directorio-artistas`.
- **URL de términos** (opcional): dónde vive la política de la entidad, para tenerla a mano.
- **Notas iniciales** (opcional): contexto libre.

La fuente queda registrada como **Sin verificar**. **No** se puede extraer nada hasta que la verifiques.

### 2. Verificar la autorización jurídica

En el detalle de la fuente:
- **Referencia de autorización**: el identificador del documento que te da permiso. Ej. `contrato-042`, `expediente-2026-Q3`, o similar.
- **Notas de cumplimiento**: descripción breve de la base legal, alcance, restricciones.

Al pulsar "Marcar como verificada", la fuente pasa a **Verificada**. Todo esto queda auditado.

### 3. Comprobar `robots.txt`

Pulsa **"Chequear robots.txt"**. La app consulta el archivo `robots.txt` del sitio y te dice si nuestro bot puede acceder o no. Si el sitio nos prohíbe explícitamente, no ejecutes la extracción — cambia de fuente o negocia con la entidad.

### 4. Ejecutar la extracción

Con la fuente verificada y `robots.txt` permitiendo el acceso:

- **Máx. páginas**: cuántas URLs distintas visitar. Empieza pequeño (10-50).
- **Máx. profundidad**: cuántos clicks desde la raíz.

Pulsa **"Ejecutar extracción"**. El bot:
- Va a la URL raíz, respeta `robots.txt` en cada página.
- Sigue enlaces solo del mismo dominio.
- Extrae emails que estén en `mailto:` o en el texto.
- Filtra emails de sistema (`noreply@`, `postmaster@`, etc.).
- Guarda cada nuevo contacto en la cola de revisión.
- Detecta duplicados (si el email ya existe, solo añade una referencia más).
- Si el email ya está en la lista de supresión, marca al contacto directamente como suprimido.

Al final ves un resumen con las páginas visitadas, emails encontrados y contactos nuevos.

### 5. Importar CSV (alternativa)

Si ya tienes una lista propia:

Menú → **Contactos → Importar CSV**.

- Pega el CSV.
- La app detecta las columnas y sugiere el mapeo (`artista`, `email`, etc.).
- Muestra las primeras 10 filas para que revises antes de importar.
- Confirma → los contactos entran en la cola de revisión.

Nunca se importa nada sin pasar por la pantalla de preview.

### 6. Revisar la cola humana

Menú → **Cola de revisión**.

Por cada contacto ves:
- Nombre del artista, email, web, procedencia.
- Estado del email (encontrado / inválido / rebotado).
- Los 4 estados actuales del contacto.

Tres botones:
- **APROBAR** — pasa el contacto a "revisado + elegible". Ahora puede recibir una solicitud de consentimiento (cuando el interruptor global esté activo).
- **DESCARTAR** — no nos interesa. Se guarda por trazabilidad pero no volverá a la cola.
- **SUPRIMIR** — su email va a la lista de supresión permanente. Nunca podrá ser contactado desde esta app aunque lo re-descubramos.

**Ninguna acción es automática.** El bot nunca "aprueba" un contacto por sí solo.

### 7. Crear una plantilla

Menú → **Plantillas → Nueva**.

- **Nombre interno**: cómo la llamarás tú, no lo ve el destinatario.
- **Asunto**: la línea que verá el destinatario en su bandeja. Puedes insertar el nombre del artista pulsando el chip "+ Nombre del artista" (no lo tecles a mano).
- **Cuerpo del mensaje**: editor visual con formato (negrita, listas, títulos, enlaces).
  - Botones "+ Botón Confirmar" y "+ Link Darse de baja" que insertan los elementos con el estilo apropiado. No hace falta que sepas nada de HTML.
- **Vista previa** — debajo del editor ves cómo quedará el email con datos de ejemplo.

Al guardar, la plantilla es versión 1. Si más tarde editas el texto, sube a versión 2, 3… pero las solicitudes que ya se hayan encolado con una versión anterior mantienen ese texto exacto — nunca se altera lo que ya está en cola.

### 8. Crear una campaña

Menú → **Campañas → Nueva**.

- **Nombre**: ej. "Newsletter otoño 2026".
- **Activa** — enciéndela cuando quieras que la cola pueda procesarse.

Puedes crear varias campañas con propósitos distintos. Una plantilla se elige en el momento de encolar cada solicitud.

### 9. Encolar una solicitud de consentimiento

Ve al detalle del contacto (Menú → Contactos → click en uno).

Si el contacto está **Aprobado + Elegible + sin consentimiento previo + con email**, verás el botón **"Encolar solicitud"**. Al pulsarlo:

- Eliges la campaña activa.
- Eliges la plantilla activa.
- Confirmas.

La solicitud queda en la cola en estado `PENDING`. El texto exacto que se enviará se congela en ese momento — auditable después.

**Encolar no envía nada.** El envío outbound solo ocurre cuando el interruptor global está encendido y el trabajador procesa la cola.

### 10. Simular antes de activar el envío

Menú → **Solicitudes de consentimiento → Simular**.

- Elige cuántos contactos evaluar (hasta 200).
- Ejecuta.

Verás cuántos son elegibles ahora mismo, cuántos no, y por qué motivo se rechazarían. Útil para hacerte una idea del volumen antes de activar nada.

### 11. Activar el envío outbound (gate manual)

**Solo con validación jurídica del texto de la plantilla previa.**

Menú → **Ajustes**.

- Sube **Límite diario** a un número > 0 (empieza pequeño, ej. 20 al día).
- Sube **Límite por hora** (ej. 5).
- Ajusta **Intervalo mínimo entre envíos** (ej. 60 segundos).
- Interruptor **"Envío outbound"** → activarlo te pide escribir "ACTIVAR ENVIO" para confirmar.

Al confirmar:
- Un banner rojo aparece en todo el panel avisando que el envío está activo.
- El trabajador procesa la cola respetando los límites.
- Si el porcentaje de rebotes o quejas supera el umbral configurado, la app se **pausa sola** y te lo notifica.

Para desactivarlo, mueve el interruptor a apagado.

### 12. Qué recibe el destinatario

Un email con:
- Asunto personalizado con su nombre de artista.
- Texto que le explica quién eres, para qué le escribes, qué tipo de contenidos publicas.
- Un botón **"Confirmar suscripción"** grande y visible.
- Un enlace pequeño **"Darse de baja"** en el pie.

Al pulsar Confirmar aterriza en una página que muestra:
- **"Sí, quiero suscribirme"** → registra el consentimiento, pasa a suscriptor.
- **"No, gracias"** → registra el rechazo, añade su email a la supresión permanente.

En ambos casos queda auditado con la fecha, la IP y el texto exacto que la persona vio y aceptó / rechazó.

### 13. Newsletter pública

Cualquier persona que llegue a `https://artistoutreach.vercel.app/newsletter` puede suscribirse voluntariamente:
- Formulario simple (sin casillas premarcadas).
- Se envía un email de confirmación (double opt-in).
- Solo cuando pulsan el link de confirmación queda como suscriptor.

No hace falta ninguna acción tuya para esto — funciona solo.

### 14. Auditoría

Menú → **Auditoría**.

Lista cronológica con:
- Cuándo pasó cada evento.
- Quién lo hizo (tú, otro admin, el sistema, o el público).
- Qué se hizo (aprobado, descartado, solicitud enviada, consentimiento confirmado, envío auto-pausado…).

Cualquier decisión de la app puede reconstruirse desde aquí.

## Situaciones prácticas

### "Encontramos un email de un artista, ¿podemos escribirle?"

Solo si:
1. Fue descubierto desde una fuente **verificada** (con autorización jurídica registrada).
2. Un humano lo ha revisado y aprobado en la cola de revisión.
3. El interruptor global de envío está activado por decisión explícita.
4. Se ha encolado una solicitud de consentimiento a través del flujo.

Si falla cualquiera de estos pasos, la app **no** envía nada.

### "Alguien nos dice que no quiere recibir más correos"

- Si tiene el link de baja del email, que lo use → cae en supresión automáticamente.
- Si nos escribe directamente, ve a Contactos → busca → botón **Suprimir**. Su email queda en la lista negra permanente.

### "Queremos cambiar el texto de la plantilla"

Ábrela y edita. Al guardar sube de versión. Las solicitudes que ya estaban en cola siguen con el texto antiguo — es una garantía de trazabilidad legal, no un bug.

### "Los rebotes son muchos"

La app auto-pausa el envío cuando el porcentaje supera el umbral (Ajustes → "Bounce rate threshold"). Revisa la calidad de las fuentes desde las que estás extrayendo. Cuando arregles el problema, reactiva el interruptor.

### "Quiero ver quién dijo sí y quién dijo no"

- Contactos → filtra por estado de consentimiento = `CONFIRMED` para los "sí".
- Filtra por `WITHDRAWN` para los "no" (o los que se dieron de baja después).
- Auditoría → filtra por acción `granted` o `withdrawn` para ver el histórico completo.

## Buenas prácticas

- **Empieza pequeño**: cuando actives el envío por primera vez, pon `dailySendLimit=10` y `hourlySendLimit=3`. Observa los rebotes durante unos días antes de subir los límites.
- **Revisa la cola de revisión con calma**: cada aprobación es una decisión humana que queda auditada con tu nombre. No la conviertas en un click reflejo.
- **Guarda las referencias jurídicas**: cada vez que verifiques una fuente, apunta bien el ID del documento (contrato, expediente, permiso). Si en el futuro te preguntan por qué contactaste a alguien, tienes que poder decir "porque teníamos permiso X de la entidad Y desde tal fecha".
- **Suprimir siempre gana**: si dudas, suprime. Es reversible administrativamente pero por defecto es un "no" definitivo — mejor pecar de cauto.

## Preguntas frecuentes

**¿Puedo enviar sin pedir consentimiento?**
No. La app está diseñada para no dejarte. El interruptor `sending_enabled` no activa envíos masivos sin consentimiento — activa la cola de solicitudes de consentimiento, que es un mensaje pidiendo permiso.

**¿Y si yo mismo tengo el consentimiento firmado en papel?**
Ese consentimiento no lo puede verificar la aplicación por sí sola. Si tienes esa base legal, márcalo manualmente en el detalle del contacto y encola con la sensación de tranquilidad. La app deja el rastro.

**¿La newsletter pública también pide consentimiento?**
Sí, con double opt-in: el formulario NO da de alta, solo dispara un email de confirmación. Hasta que la persona pulse el link, no es suscriptor.

**¿Qué pasa si borro un contacto?**
No lo borres — descártalo o suprímelo. Borrar rompe la trazabilidad y no da más beneficio. La supresión es equivalente funcional al "borrado" a efectos de contacto futuro.
