# Guía OVH paso a paso — desde cero

Guía para alguien que no ha usado OVH nunca. Cubre desde crear la clave SSH en tu Mac hasta tener el VPS respondiendo por HTTPS en `losxavis.com`.

Tiempo estimado total: **~1,5 h** (30 min tú tocando cosas + resto esperando propagación DNS y builds).

---

## Antes de empezar — qué necesitas tener a mano

- La cuenta OVH donde tienes `losxavis.com` (email + contraseña + método de pago con saldo).
- Terminal en tu Mac.
- Los valores de tus env vars actuales de Vercel (los vas a copiar al VPS): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY` (cuando la tengas), `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`.

---

## FASE 1 — Crear tu clave SSH (en tu Mac)

La clave SSH es como una "llave" que te deja entrar al servidor sin escribir contraseña. La creas una vez y la reutilizas.

### 1.1 Abrir la Terminal en tu Mac

`Cmd + Espacio` → escribe "Terminal" → Enter.

### 1.2 Comprobar si ya tienes una clave

```bash
ls ~/.ssh/id_ed25519.pub 2>/dev/null && echo "ya tienes clave" || echo "no tienes"
```

- Si dice **"ya tienes clave"** → salta a 1.4.
- Si dice **"no tienes"** → sigue con 1.3.

### 1.3 Crear la clave

```bash
ssh-keygen -t ed25519 -C "laura-ovh"
```

Te pregunta:
- **Enter file in which to save the key** → pulsa Enter (usa el nombre por defecto).
- **Enter passphrase** → pulsa Enter (sin passphrase, más cómodo).
- **Enter same passphrase again** → Enter.

### 1.4 Copiar tu clave pública al portapapeles

```bash
pbcopy < ~/.ssh/id_ed25519.pub && echo "copiada al portapapeles"
```

Ahora tienes en el portapapeles una línea larga que empieza por `ssh-ed25519 AAAA…`. La vas a pegar en OVH en el paso 2.

---

## FASE 2 — Comprar y configurar el VPS en OVH

### 2.1 Ir al catálogo de VPS

1. Abre https://www.ovhcloud.com/es-es/vps/
2. Verás la lista de VPS. Busca la sección **"VPS Value"** (~7 €/mes).
3. Pulsa **Configurar**.

### 2.2 Configurar el pedido

Rellena en este orden. Si algún campo no existe con este nombre exacto, es porque OVH cambia la UI cada X meses — pero las opciones son equivalentes.

- **Modelo**: `VPS-2` o "Value" (2 vCore / 4 GB RAM / 80 GB SSD).
- **Sistema operativo**: `Ubuntu 24.04 LTS` (Distribuciones → Ubuntu → 24.04).
- **Datacenter**: `Gravelines (GRA)` o `Strasbourg (SBG)`. Los dos son Europa. Gravelines suele tener mejor precio.
- **Duración**: `Facturación mensual` (7 €/mes).
- **Opciones adicionales**:
  - Snapshot automático: opcional (+~1 €/mes), útil pero puedes activarlo después.
  - Backup: opcional. Yo lo saltaría al principio.
- **Añadir claves SSH**:
  - Aquí pega la clave pública que tienes en el portapapeles.
  - Nombre de la clave: `laura-mac`.
  - Pulsa **Añadir**.
  - ⚠️ Si no ves esta opción durante el checkout, no pasa nada — se puede añadir después desde el panel de gestión del VPS (paso 2.5).

Pulsa **Continuar** → resumen del pedido → **Pagar**.

### 2.3 Esperar el email

OVH tarda **entre 5 y 20 min** en aprovisionar el VPS. Recibirás dos emails:
1. **Confirmación del pedido** (inmediato).
2. **VPS listo** con la IP pública (5-20 min).

El segundo email tiene el asunto tipo *"Su VPS está disponible"* y contiene:
- IP: `xxx.xxx.xxx.xxx`
- Usuario: `ubuntu` (o `debian`, según elegiste)
- Contraseña inicial (solo si NO añadiste clave SSH; con clave SSH no hace falta).

**Anota la IP** — la usamos en todos los pasos siguientes.

### 2.4 Entrar al Manager de OVH

1. Ve a https://www.ovh.com/manager
2. Login con tu cuenta.
3. Menú lateral izquierdo → **Bare Metal Cloud** → **VPS**.
4. Selecciona tu VPS (nombre tipo `vpsXXXXXXX.vps.ovh.net`).

Aquí ves su estado, la IP, y puedes acceder a la KVM (consola web) por si el SSH falla.

### 2.5 Añadir clave SSH (si no la pusiste en el checkout)

Solo si te saltaste el paso durante el pedido:

1. En el panel del VPS → pestaña **"Mi cuenta"** (arriba a la derecha, icono de usuario) → **Claves SSH** → **Añadir una clave**.
2. Nombre: `laura-mac`.
3. Valor: pega la clave pública.
4. **Añadir**.
5. Vuelve al VPS → **Rebuild / Reinstalar** → selecciona Ubuntu 24.04 → marca la clave SSH que acabas de añadir → confirma. Tarda ~5 min y el VPS queda listo con tu clave autorizada.

Si añadiste la clave en el checkout (paso 2.2), sáltate esto.

---

## FASE 3 — Cambiar el DNS de `losxavis.com`

Ahora vas a decir a OVH que `losxavis.com` apunte al VPS.

### 3.1 Ir a la zona DNS

En OVH Manager:
1. Menú lateral → **Web Cloud** → **Nombres de dominio**.
2. Click en `losxavis.com`.
3. Pestaña **Zona DNS**.

Verás una lista de registros existentes.

### 3.2 Borrar los registros que apuntan a Vercel

Busca los que dicen:
- `A` `losxavis.com.` → `76.76.21.21` (Vercel)
- `CNAME` `www.losxavis.com.` → `cname.vercel-dns.com.` (Vercel)

Click en cada uno → botón **Eliminar** (icono de papelera).

Deja intactos: los registros de Resend (`resend._domainkey`, `rsend`, `send`, `_dmarc`), el `SOA` y los `NS` de OVH.

### 3.3 Añadir los nuevos registros que apuntan al VPS

Botón **Añadir una entrada** → tipo **A**:

Registro 1:
- **Subdominio**: (déjalo vacío)
- **TTL**: por defecto
- **Objetivo**: la IP del VPS (la del email de OVH).

Guardar. Repite para www:

Registro 2:
- Botón **Añadir una entrada** → **A**
- **Subdominio**: `www`
- **Objetivo**: la misma IP del VPS.

### 3.4 Comprobar propagación

En tu terminal Mac:

```bash
dig +short losxavis.com
```

Al principio dirá lo viejo o nada. Cuando propague verás **la IP de tu VPS**. Tarda **entre 5 y 60 min**. Puedes seguir con la fase 4 mientras.

---

## FASE 4 — Bootstrap del VPS

Vas a entrar al VPS y correr un script que instala todo lo necesario. El script está ya en el repo, así que solo hay que ejecutarlo.

### 4.1 Primera conexión SSH

En tu terminal:

```bash
ssh root@<IP del VPS>
```

La primera vez te dice:
```
The authenticity of host '... (...)' can't be established.
ED25519 key fingerprint is SHA256:...
Are you sure you want to continue connecting (yes/no)?
```

Escribe **yes** y Enter. Estás dentro del VPS.

Si te da error de "Permission denied", significa que la clave SSH no está bien puesta. Vuelve al paso 2.5.

### 4.2 Ejecutar el bootstrap

Copia y pega **exactamente**:

```bash
curl -fsSL https://raw.githubusercontent.com/Nau-crc/Artist-outreach/main/server/bootstrap.sh | bash
```

Verás mensajes tipo:
```
[bootstrap] Actualizando sistema…
[bootstrap] Instalando Docker Engine + Compose plugin…
[bootstrap] Creando usuario deploy…
[bootstrap] Clonando repo en /opt/artist-outreach…
[bootstrap] Configurando firewall UFW…
[bootstrap] Habilitando fail2ban…
[bootstrap] ✓ Bootstrap completado.
```

Tarda **~3-5 min**.

### 4.3 Editar las variables de entorno reales

```bash
nano /opt/artist-outreach/.env.production
```

Se abre el editor nano con la plantilla. Cambia los valores placeholder por los reales (los que tenías en Vercel). Los que **NO** son secreto pueden quedar como en el ejemplo:

- `APP_DOMAIN=losxavis.com` ← ya está bien.
- `LETSENCRYPT_EMAIL=` ← pon tu email real (Let's Encrypt te avisa aquí si un cert está por expirar).
- `NEXT_PUBLIC_APP_URL=https://losxavis.com` ← ya está bien.
- `EXPO_PUBLIC_API_URL=https://losxavis.com` ← ya está bien.

Los que **sí** son secreto (copia de Vercel):
- `DATABASE_URL=` ← la URL pooled de Neon.
- `SUPABASE_URL=`
- `SUPABASE_ANON_KEY=`
- `SUPABASE_JWT_SECRET=`
- `EXPO_PUBLIC_SUPABASE_URL=`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=`
- `EMAIL_PROVIDER=resend` (o `smtp` si sigues con Gmail temporalmente).
- `RESEND_API_KEY=`
- `EMAIL_FROM=Artist Outreach <no-reply@losxavis.com>`
- `RESEND_WEBHOOK_SECRET=`
- `CRON_SECRET=` ← genera uno con `openssl rand -hex 32` (en otra terminal en tu Mac).

Para guardar en nano: **Ctrl+O** → **Enter** → **Ctrl+X**.

### 4.4 Primer levantamiento

Cambia al usuario deploy (el que tiene permisos Docker sin sudo):

```bash
su - deploy
cd /opt/artist-outreach
docker compose up -d --build
```

Tarda **~5-10 min** la primera vez (descarga imágenes base + build).

Cuando termine:
```bash
docker compose ps
```

Deberías ver 3 contenedores en estado `Up`:
- `artist-outreach-app-1`
- `artist-outreach-nginx-proxy-1`
- `artist-outreach-acme-1`

### 4.5 Aplicar migraciones de Prisma

```bash
docker compose exec app node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
```

Verás algo tipo `X migrations applied` o `No pending migrations to apply`.

### 4.6 Ver logs (por si algo falla)

```bash
docker compose logs -f app
```

Ctrl+C para salir de los logs (los contenedores siguen corriendo).

Para ver la emisión del certificado HTTPS:
```bash
docker compose logs -f acme
```

Debería aparecer una línea tipo `losxavis.com: cert generated OK` en 1-2 min tras arrancar (si el DNS ya propagó).

---

## FASE 5 — Verificar que todo funciona

En tu Mac:

```bash
curl -I https://losxavis.com/api/health
```

Debe devolver `HTTP/2 200`.

Abre el navegador:
- `https://losxavis.com/newsletter` — la landing pública.
- `https://losxavis.com/admin` — el panel admin (login con tu usuario Supabase).

---

## FASE 6 — GitHub Actions (deploy automático)

Con esto, cada push a `main` hará deploy solo. Sigue una vez la fase 5 esté OK.

### 6.1 Crear una clave SSH específica para GitHub

En tu Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/artist-outreach-deploy -C "gh-actions" -N ""
```

Genera dos archivos:
- `~/.ssh/artist-outreach-deploy` (privada)
- `~/.ssh/artist-outreach-deploy.pub` (pública)

### 6.2 Autorizar esa clave en el VPS

```bash
ssh-copy-id -i ~/.ssh/artist-outreach-deploy.pub deploy@<IP del VPS>
```

Prueba que entra:
```bash
ssh -i ~/.ssh/artist-outreach-deploy deploy@<IP>
```

Debe entrar sin pedir password. Sal con `exit`.

### 6.3 Copiar la clave privada al portapapeles

```bash
pbcopy < ~/.ssh/artist-outreach-deploy
```

### 6.4 Añadir secrets en GitHub

Ve a https://github.com/Nau-crc/Artist-outreach → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Añade uno por uno:

| Nombre | Valor |
|---|---|
| `DEPLOY_HOST` | la IP del VPS |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | pega el contenido del portapapeles (la clave privada) |
| `APP_DOMAIN` | `losxavis.com` |
| `CRON_SECRET` | el mismo valor que pusiste en `.env.production` del VPS |

### 6.5 Probar

Haz cualquier commit tonto en el repo local y push:

```bash
cd ~/artist-outreach
git commit --allow-empty -m "test: deploy automático"
git push origin main
```

Ve a https://github.com/Nau-crc/Artist-outreach/actions y verás el workflow **"Deploy to OVH"** corriendo. Al final debería salir verde.

---

## Preguntas frecuentes

**No entiendo por qué el bootstrap crea un usuario "deploy" separado**.
Buena práctica de seguridad: nunca corres apps como `root`. El usuario `deploy` tiene permisos Docker pero no puede tocar el sistema. Si un día se compromete la app, el atacante no tiene root.

**¿Qué pasa si el VPS se reinicia?**
Los contenedores tienen `restart: unless-stopped` — arrancan solos con Docker.

**¿Cómo entro por SSH si mi Mac se rompe?**
Con otra máquina con SSH, generas otra clave, entras al Manager OVH → VPS → KVM (consola web que va por navegador) → añades la clave nueva a `~/.ssh/authorized_keys` del usuario `deploy`.

**¿Puedo apagar Vercel ya?**
Aún no. Deja el proyecto en Vercel una semana como red de seguridad. Cuando confirmes que OVH va estable, Vercel → tu proyecto → Settings → Advanced → Delete Project.

**El DNS no propaga y llevo 1 h esperando**.
Comprueba con `dig +short losxavis.com` y con https://dnschecker.org. Si sigue vacío, verifica en OVH que guardaste los cambios (algunos paneles piden confirmación adicional al final). En OVH → pestaña **DNSSEC** — si está activo, a veces tarda más. Puedes desactivarlo temporalmente.

**El certificado HTTPS no sale**.
Requiere que el DNS ya apunte al VPS. Comprueba primero eso. Luego `docker compose logs acme` — el error suele ser explícito (rate limit de Let's Encrypt, o DNS aún no resuelve). Rate limit de Let's Encrypt: máximo 5 certificados fallidos por dominio/hora. Si te lo topas, espera 1 h antes de reintentar.

**Docker Compose me da error de permisos**.
Estás como `root` o como otro usuario. Cambia a `deploy`: `su - deploy` (o `sudo su - deploy` si estás como root).

---

## Comandos de emergencia

Todos ejecutados desde `/opt/artist-outreach` como usuario `deploy`.

```bash
# Ver todo lo que corre
docker compose ps

# Reiniciar solo la app
docker compose restart app

# Reconstruir tras cambio de env vars
docker compose up -d --force-recreate app

# Rollback al commit anterior
git log --oneline -20
git reset --hard <sha>
docker compose up -d --build

# Ver espacio en disco
df -h

# Limpiar imágenes viejas
docker system prune -a

# Ver últimas 100 líneas de logs
docker compose logs --tail=100 app
```

---

## Cuando te quedes atascada

Copia el mensaje de error exacto y me lo pasas. Ninguna de las cosas de aquí es irreversible — siempre podemos rehacer un paso.
