# Deploy en OVH VPS

Guía paso a paso para migrar Artist Outreach de Vercel a un VPS OVH con `losxavis.com`.

Arquitectura final:
- **VPS OVH Value** (Ubuntu 24.04, 4 GB RAM) hospedando la app en Docker.
- **nginx-proxy + acme-companion** delante, HTTPS Let's Encrypt automático.
- **Neon Postgres** sigue siendo la BD (no cambia).
- **Supabase** sigue siendo Auth (no cambia).
- **Resend** para email (dominio `losxavis.com`).
- **GitHub Actions** para deploy (push a main → server) y cron cada 10 min para consent-queue.

---

## Parte A — Crear el VPS en OVH

1. Panel OVH → **Bare Metal Cloud** (o **Public Cloud**) → **VPS**.
2. Elegir **VPS Value** (4 GB / 2 vCore / 80 GB SSD, ~7 €/mes).
3. Datacenter: **Gravelines** o **Strasbourg** (Europa).
4. Sistema: **Ubuntu 24.04 LTS**.
5. Añadir tu **clave pública SSH** (si no la tienes, genérala con `ssh-keygen -t ed25519 -C "laura@losxavis"` y pega el contenido de `~/.ssh/id_ed25519.pub`).
6. Confirmar y esperar el email con la IP.

Cuando llegue la IP, prueba: `ssh ubuntu@<IP>`. Debería entrar sin pedir password.

---

## Parte B — DNS en OVH

En OVH Manager → **Web Cloud** → **Nombres de dominio** → **losxavis.com** → **Zona DNS**:

**Elimina** los registros que apuntaban a Vercel (`A @ 76.76.21.21` y `CNAME www cname.vercel-dns.com`).

**Añade**:

| Tipo | Subdominio | Objetivo |
|---|---|---|
| `A` | (vacío) | `<IP del VPS>` |
| `A` | `www` | `<IP del VPS>` |

Deja los registros de Resend (`resend._domainkey`, `rsend`, `send`, `_dmarc`) — no cambian.

Espera 5-30 min a que propague. Comprueba: `dig +short losxavis.com` debe devolver la IP del VPS.

---

## Parte C — Preparar el VPS

Conéctate como root:

```bash
ssh root@<IP>
```

Descarga y ejecuta el bootstrap:

```bash
curl -fsSL https://raw.githubusercontent.com/Nau-crc/Artist-outreach/main/server/bootstrap.sh | bash
```

El script:
- Actualiza el sistema.
- Instala Docker + Compose plugin.
- Crea usuario `deploy` con permisos Docker (sin sudo password para Docker).
- Configura firewall UFW (SSH + 80 + 443).
- Habilita fail2ban.
- Clona el repo en `/opt/artist-outreach`.
- Copia `.env.production.example` → `.env.production` (para que la edites).

**Después edita las variables reales**:

```bash
sudo nano /opt/artist-outreach/.env.production
```

Rellena con:
- `APP_DOMAIN=losxavis.com`
- `LETSENCRYPT_EMAIL=<tu email>` — Let's Encrypt te avisa aquí si un cert va a expirar.
- `DATABASE_URL` — la Neon pooled.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL=https://losxavis.com`.
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`.
- `CRON_SECRET` — genera uno nuevo: `openssl rand -hex 32`.
- `NEXT_PUBLIC_APP_URL=https://losxavis.com`.

Guarda (Ctrl+O, Enter, Ctrl+X).

---

## Parte D — Primer deploy manual

Como usuario `deploy`:

```bash
sudo su - deploy
cd /opt/artist-outreach
docker compose up -d --build
```

El primer build tarda 5-10 min (descarga imágenes, instala deps, build Expo Web + Next).

**Aplicar migraciones**:

```bash
docker compose exec app node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma
```

**Ver logs**:

```bash
docker compose logs -f app
```

Espera a ver `Ready in X ms` y `nginx-proxy` diciendo que emitió el certificado. La primera emisión Let's Encrypt puede tardar 1-2 min.

**Prueba**:

```bash
curl -I https://losxavis.com/api/health
```

Debería devolver `200 OK`. Ahora ya puedes abrir `https://losxavis.com` en el navegador.

---

## Parte E — GitHub Actions (deploy automático)

### E.1 Crear clave SSH para deploy

En tu máquina local:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/artist-outreach-deploy -C "gh-actions-deploy"
```

Sin passphrase. Genera dos archivos: `artist-outreach-deploy` (privada) y `.pub` (pública).

Copia la pública al servidor, al usuario `deploy`:

```bash
ssh-copy-id -i ~/.ssh/artist-outreach-deploy.pub deploy@<IP>
```

Prueba que entra: `ssh -i ~/.ssh/artist-outreach-deploy deploy@<IP>` — debería entrar sin password.

### E.2 Añadir secrets a GitHub

GitHub → tu repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nombre | Valor |
|---|---|
| `DEPLOY_HOST` | La IP del VPS (o `losxavis.com`) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | El contenido completo de `~/.ssh/artist-outreach-deploy` (privada) |
| `APP_DOMAIN` | `losxavis.com` |
| `CRON_SECRET` | El mismo valor que pusiste en `.env.production` del servidor |

### E.3 Probar

Haz un commit dummy y push a main. En GitHub → **Actions** debería aparecer el workflow "Deploy to OVH" corriendo. Al final del job, verifica `https://losxavis.com/api/health` responde 200.

El cron `cron-consent-queue` empieza a correr automáticamente cada 10 min (cuando actives `sending_enabled` procesará la cola; hasta entonces sale sin hacer nada).

---

## Parte F — Resend webhook

Resend → Webhooks → tu endpoint. Cambia la URL de:
```
https://artistoutreach.vercel.app/api/webhooks/email/resend
```
a:
```
https://losxavis.com/api/webhooks/email/resend
```

Los eventos empiezan a llegar al nuevo server.

---

## Parte G — Supabase redirect URLs

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://losxavis.com`
- **Redirect URLs**: añade `https://losxavis.com/**` y `https://losxavis.com/admin/**`. Puedes quitar las de Vercel si no las vas a usar más.

---

## Parte H — Apagar Vercel (opcional)

Cuando confirmes que `losxavis.com` funciona en el VPS:
- Vercel → tu proyecto → Settings → Advanced → **Delete Project**.
- O simplemente **Pause deployments** si prefieres mantener el histórico.

---

## Operativa diaria

**Deploy**: push a `main`. GH Actions hace el resto.

**Logs**:
```bash
ssh deploy@<IP>
cd /opt/artist-outreach
docker compose logs -f app          # solo la app
docker compose logs -f nginx-proxy  # el reverse proxy
docker compose logs -f acme         # renovación de certs
```

**Ver estado**:
```bash
docker compose ps
```

**Restart manual**:
```bash
docker compose restart app
```

**Rollback rápido** a un commit anterior:
```bash
cd /opt/artist-outreach
git log --oneline -20               # busca el SHA al que volver
git reset --hard <sha>
docker compose up -d --build
```

**Editar env vars**:
```bash
sudo nano /opt/artist-outreach/.env.production
docker compose up -d --force-recreate app
```

---

## Cosas que se rompen y cómo arreglarlas

- **Let's Encrypt no emite cert**: comprueba que el DNS ya propaga (`dig +short losxavis.com`), que los puertos 80/443 están abiertos (`sudo ufw status`), y `docker compose logs acme`. La emisión tiene rate limits: 5 intentos por hora, así que revisa antes.
- **App no arranca por env vars**: `docker compose logs app` — normalmente falta una env var en `.env.production`.
- **Prisma no encuentra la BD**: revisa `DATABASE_URL` — debe ser la pooled URL con `?sslmode=require&pgbouncer=true&connection_limit=1`.
- **Fuera de espacio en disco**: `docker system prune -a --volumes` limpia imágenes antiguas. Precaución: no borra volúmenes usados, pero sí volúmenes huérfanos.
- **Cert que no renueva**: por defecto acme-companion los renueva ~30 días antes de expirar. Verifica `docker compose logs acme` cerca de la fecha límite.

---

## Costes recurrentes

| Item | Coste |
|---|---|
| VPS OVH Value | ~7 €/mes |
| Dominio losxavis.com | ~10 €/año (ya lo tienes) |
| Neon Postgres | 0 € (free tier suficiente al principio) |
| Supabase Auth | 0 € (free tier) |
| Resend | 0 € hasta 3.000 emails/mes |
| GitHub Actions | 0 € (2000 min/mes free en repos privados, ilimitado en públicos) |
| **Total** | **~7 €/mes** |

Sin sorpresas: es un VPS con precio fijo.
