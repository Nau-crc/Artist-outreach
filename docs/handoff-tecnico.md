# Handoff técnico — Artist Outreach

Documento para que otra persona técnica retome el proyecto. Refleja el estado a **2026-09-09**.

## TL;DR

Monorepo pnpm + Turbo con:
- **`apps/web`** — Next.js 16 (App Router, Turbopack). Aloja API `/api/*`, landings públicas (`/newsletter`, `/consent/[token]`, `/unsubscribe/[token]`, `/legal/*`) y sirve el bundle Expo Web bajo `/admin`.
- **`apps/mobile`** — Expo Router (React Native + Web). En producción se exporta como SPA (`expo export --platform web`) y se sirve dentro de `apps/web/public/admin`.
- **`packages/{config, shared, ui}`** — código transversal (schemas Zod, tokens, atoms).

Deploy monolítico en **Vercel** (`https://artistoutreach.vercel.app`). BD **Neon Postgres**. Auth **Supabase** (ES256 JWTs verificados vía JWKS).

Login en producción funciona. Endpoints protegidos responden 200. Cola de consentimiento se puede encolar. **Envío outbound NO está activo** — falta validación jurídica y configurar Resend con dominio verificado.

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node ≥ 20 |
| Package manager | pnpm 9.x (workspace) |
| Orquestador | Turborepo 2.x |
| Framework web | Next.js 16.3.3 (App Router + Turbopack) |
| Mobile / SPA admin | Expo SDK 52 + Expo Router (React Native Web) |
| BD | PostgreSQL 17 (Neon en prod, Docker en local) |
| ORM | Prisma 6.19.3 |
| Auth | Supabase Auth (ES256 asimétrico) + JOSE JWKS verify |
| Email transactional | Resend (contrato listo, integración pendiente) |
| Rate limiting | in-memory token bucket (a migrar a Redis si escala) |
| Logging | logger casero JSON (`apps/web/src/lib/logger.ts`) |
| Tests | Vitest (unit/integration) + Playwright (e2e, sin CI aún) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) con service Postgres |

## Estructura del repo

```
apps/
  web/                  # Next 16, backend + landings + host del admin SPA
    src/
      app/              # rutas App Router
      controllers/      # lógica de negocio (llamada desde rutas)
      services/         # dominios: contacts, sources, consent, ingest, email, rate-limit…
      middleware/       # auth, with-controller, error mapping
      lib/              # logger, prisma, supabase-server
      email/            # renderers HTML + text
      cron/             # workers de la cola outbound
    public/
      admin/            # copiado en build:  ../mobile/dist  →  ./public/admin
    prisma-migrations   # migraciones (ver `prisma/` en raíz)

  mobile/               # Expo Router (React Native Web)
    app/                # rutas (root layout, (auth)/login, (tabs)/…)
    src/
      lib/              # supabase client, api client, auth-context
      screens/          # pantallas
      components/       # composición
    app.json            # web.output=single, experiments.baseUrl="/admin"

packages/
  config/               # tsconfig base, eslint config (pendiente flat), tailwind preset
  shared/               # schemas Zod, tipos comunes, constantes de dominio
  ui/                   # design system: atoms/molecules/organisms (RN + Web)

prisma/
  schema.prisma
  migrations/
  seed.ts

.github/workflows/
  ci.yml                # lint (no-op) + typecheck + unit tests + db:deploy
```

## Modelo de datos (esencial)

`prisma/schema.prisma` define, entre otros:

- **`Source`** — fuente autorizada. Flags: `verified`, `authorizationRef`, `complianceNotes`.
- **`Contact`** — artista descubierto. Estados independientes: `discoveryStatus`, `reviewStatus`, `outreachStatus`, `subscriptionStatus`. Relación con `Source` y `EmailAddress`.
- **`EmailAddress`** — email normalizado (lowercase, trim). Único global. Estados: `unknown | valid | invalid | bounced`. Referencia contadora hacia `Contact` para deduplicación.
- **`SuppressionEntry`** — lista de supresión permanente por email. Se consulta ANTES de encolar y se aplica de golpe cuando llega un bounce hard o el destinatario dice "no".
- **`ConsentRequest`** — snapshot inmutable del texto que se envió (asunto + cuerpo). Estados: `pending | sent | delivered | opened | confirmed | rejected | bounced | expired`.
- **`Consent`** — consentimiento otorgado / retirado. Con IP, user-agent, timestamp, snapshot del texto aceptado.
- **`Template`** — versionado. Al editar sube versión. `ConsentRequest` guarda `templateVersion` para trazabilidad.
- **`Campaign`** — agrupador. Flag `active`.
- **`SendingConfig`** — singleton con `sendingEnabled`, `dailyLimit`, `hourlyLimit`, `minGapSeconds`, `bounceThresholdPct`, `complaintThresholdPct`.
- **`AuditLog`** — append-only. `actor`, `action`, `entity`, `entityId`, `metadata`, `at`.

**Importante**: `directUrl` fue eliminado del `datasource`. Prisma solo lee `DATABASE_URL`. Las migraciones en Neon necesitan la URL **unpooled** (pasarla inline al `db:deploy`).

## Auth

Supabase moderno firma con **ES256** (JWT asimétrico), no HS256. Ver [apps/web/src/middleware/auth.ts](apps/web/src/middleware/auth.ts):

1. Se decodifica el header sin verificar → se lee `alg`.
2. Si `alg === 'HS256'` → `jwt.verify(token, SUPABASE_JWT_SECRET)` (legacy + tests).
3. Si `alg ∈ {ES256, RS256, EdDSA}` → `jose.jwtVerify(token, remoteJWKSet, { algorithms })` contra `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Cache del JWKS en memoria.
4. Se extrae `sub` como `userId` y `app_metadata.role` como `role`.
5. `requireAdmin` verifica que `role === 'admin'` → los usuarios se crean en Supabase con `app_metadata: { role: 'admin' }`.

**Dev bypass**: `tryDevBypass()` inyecta `{userId: DEV_ADMIN_ID, role: 'admin'}` **solo** si `NODE_ENV === 'development'` AND `DEV_BYPASS_AUTH === 'true'`. En `production` y `test` se ignora. Los tests en [apps/web/src/middleware/auth.test.ts](apps/web/src/middleware/auth.test.ts) lo garantizan.

**Cliente**: `apps/mobile/src/lib/supabase.ts` usa storage Platform-aware — Web = `localStorage` (try/catch → in-memory fallback), Native = `expo-secure-store`. Exporta `supabaseMode: 'real' | 'stub-bypass' | 'stub-test' | 'stub-missing-config'` para que la pantalla de login pueda pintar un banner si faltan env vars.

**Login**: `signInWithPassword(email, password)` en [apps/mobile/src/lib/auth-context.tsx](apps/mobile/src/lib/auth-context.tsx). Se descartó magic link porque el email service built-in de Supabase solo envía a team members (500 en `/auth/v1/magiclink`).

## Creación de usuarios admin

Manual, desde el Supabase dashboard:

1. Auth → Users → Add user → email + password.
2. Editar el usuario recién creado → `app_metadata`:
   ```json
   { "role": "admin" }
   ```
3. Guardar. Ya puede logarse.

(No hay UI de gestión de usuarios en la app — es voluntario, para minimizar superficie.)

## Deploy

### Vercel — configuración clave

- **Project**: root `apps/web`. Framework preset: Next.js.
- **Install Command** (override manual — importante): `pnpm install`
  - Sin este override, Vercel detecta Turbo monorepo y usa `npm install --prefix=../..`. Eso corrompe el layout pnpm y provoca `Error: No Next.js version detected` o 500 con `content-length: 0`.
- **Build Command**: (el del `package.json`) — genera Prisma, exporta Expo Web, copia a `public/admin`, `next build`.
- **Output Directory**: default de Next.
- Env vars listadas abajo (matriz).

### `next.config.ts` — rewrites SPA

```ts
async rewrites() {
  return [
    { source: '/admin', destination: '/admin/index.html' },
    { source: '/admin/:path((?!_expo|assets|favicon).*)', destination: '/admin/index.html' },
  ]
}
```

Sirve `/admin/*` como SPA con fallback a `index.html`, excluyendo assets estáticos.

### `apps/mobile/app.json`

```json
{
  "expo": {
    "web": { "output": "single" },
    "experiments": { "baseUrl": "/admin" }
  }
}
```

Metro prefija todos los assets con `/admin/…` y expo-router asume `/admin` como raíz — clave para que la SPA funcione bajo subpath.

### `turbo.json`

`globalEnv` declara TODAS las env vars que atraviesan el sandbox de build (incluyendo `EXPO_PUBLIC_*`). Sin esto, Turbo cachea builds ignorando cambios de env y Vercel avisa "env vars set on project, but missing from turbo.json".

## Env vars — matriz

### Local (`.env` en la raíz)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/artist_outreach
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJ…
SUPABASE_JWT_SECRET=…                   # legacy HS256 fallback, opcional en dev
DEV_BYPASS_AUTH=true                    # solo en dev, ignora auth
NODE_ENV=development
```

### Local — mobile (`apps/mobile/.env.local`)

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ…
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Vercel — Production

**Web / backend**:
```
DATABASE_URL=<Neon pooled URL>                     # con -pooler y ?pgbouncer=true&connection_limit=1
SUPABASE_URL=https://<ref>.supabase.co             # SIN /rest/v1/
SUPABASE_JWT_SECRET=<opcional, HS256 legacy>
RESEND_API_KEY=<pendiente>
RESEND_WEBHOOK_SECRET=<pendiente>
NODE_ENV=production                                # Vercel lo pone solo
```

**Mobile / bundle público** (leído en build time por Expo):
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ…
EXPO_PUBLIC_API_URL=https://artistoutreach.vercel.app
```

- `EXPO_PUBLIC_API_URL` debe ser URL válida — la validación de Vercel no acepta vacío. Es la misma URL del backend, resulta en fetch relativos en el mismo origen.
- **Nunca** poner `DEV_BYPASS_AUTH` en Vercel.

### Neon

Dashboard → Connection Details. Dos URLs:
- **Pooled** (`-pooler` en el host): para runtime. Usa esta como `DATABASE_URL` en Vercel.
- **Unpooled** (`-pooler` fuera): para migraciones. Usar inline: `DATABASE_URL="postgres://…-unpooled…" pnpm db:deploy`.

### Supabase

- `SUPABASE_URL` es la URL base pura: `https://<ref>.supabase.co`. **Sin** `/rest/v1/`. El path se añade solo por cada SDK.
- Rotaciones: si se filtra el `SUPABASE_JWT_SECRET`, ir a Project settings → API → JWT Settings → Rotate secret.

## Cómo levantar en local

```bash
git clone git@github.com:<user>/Artist-outreach.git
cd Artist-outreach
pnpm install

# Postgres local
docker compose up -d db

# Migraciones + seed
pnpm db:deploy
pnpm db:seed

# Backend
pnpm --filter @artist-outreach/web dev
# → http://localhost:3000

# SPA admin (dev con Metro)
pnpm --filter @artist-outreach/mobile web
# → http://localhost:19006  (no bajo /admin en dev)
```

Con `DEV_BYPASS_AUTH=true`, todas las requests admin autentican como el mock admin — útil para desarrollo sin depender de Supabase.

## Cómo deployar

Automático: push a `main` → Vercel construye.

Con cambios de schema:
```bash
DATABASE_URL="<Neon UNPOOLED URL>" pnpm db:deploy
```

Y confirmar el push antes de mergear si el schema y el código deben coexistir.

## CI

`.github/workflows/ci.yml` corre en cada PR:
- `services.postgres: postgres:17-alpine`
- Instala deps, `pnpm db:deploy`, `pnpm typecheck`, `pnpm test`.
- `pnpm lint` es no-op (echo) en todos los packages — pendiente migrar a ESLint 9 flat config.

## Pendientes prioritarios

### 1. Resend + dominio verificado (~30 min)
- Dar de alta dominio en Resend, añadir DNS (SPF, DKIM, DMARC).
- Configurar `RESEND_API_KEY` en Vercel.
- Verificar que `apps/web/src/services/email/*` usa `resend.emails.send` con `from` del dominio verificado.
- Sin esto, los correos de consentimiento y newsletter no salen (o van a spam desde el sandbox).

### 2. Webhook Resend (~5 min)
- Crear ruta `apps/web/src/app/api/webhooks/email/resend/route.ts`.
- Verificar firma con `RESEND_WEBHOOK_SECRET`.
- Mapear `email.bounced` / `email.complained` a `SuppressionEntry.upsert` + marcar `EmailAddress.status = 'bounced'`.
- Configurar la URL del webhook en el dashboard de Resend.

### 3. Cron Vercel para el worker (~10 min)
Añadir a `apps/web/vercel.json` o al `next.config`:
```json
{
  "crons": [
    { "path": "/api/cron/consent-queue", "schedule": "*/5 * * * *" }
  ]
}
```
El handler ya existe en `apps/web/src/app/api/cron/consent-queue/route.ts` (o similar — verificar). Debe respetar `SendingConfig.sendingEnabled` y los límites.

### 4. Migrar lint a ESLint 9 flat config (~30 min)
- Crear `eslint.config.js` en la raíz + uno por package.
- Reactivar `"lint": "eslint ."` en cada `package.json`.
- Añadir `pnpm lint` al workflow.
- Reglas a preservar: las que había en el `.eslintrc.cjs` antiguo (buscar en `packages/config`).

### 5. Fase 6 outbound activo — requiere OK jurídico
- Antes de subir `SendingConfig.sendingEnabled = true`, validar con equipo legal:
  - Texto exacto de la plantilla de solicitud de consentimiento.
  - Wording del banner de la landing pública.
  - Retención de datos y política de supresión.
- No es tarea técnica pura — coordinar con la responsable del proyecto.

### 6. `docs/deployment.md`
Documentar (además de este handoff):
- El **override obligatorio** del Install Command en Vercel (`pnpm install`).
- Cómo migrar la BD contra Neon (unpooled).
- Cómo rotar `SUPABASE_JWT_SECRET`.

## Gotchas conocidas

- **`npm install --prefix=../..` en Vercel** rompe el layout pnpm. Override manual del Install Command a `pnpm install`.
- **pino + Turbopack** — `default level: must be included in custom levels` al arrancar. Solución adoptada: reemplazar pino con `apps/web/src/lib/logger.ts` (JSON con console). No volver a pino sin verificar que Turbopack lo soporta.
- **Prisma `directUrl`** — si se declara en el schema, Prisma exige la env var en runtime aunque solo se use en migraciones. Eliminado del schema; las migraciones pasan la URL unpooled inline.
- **Expo Web bajo subpath** — sin `experiments.baseUrl` + `web.output: "single"` + los rewrites en Next, la SPA carga assets con paths relativos rotos.
- **Turbo `globalEnv`** — cualquier env var que se lea en build (incluyendo `EXPO_PUBLIC_*`) tiene que aparecer aquí, o Turbo cachea builds obsoletos.
- **`EXPO_PUBLIC_SUPABASE_URL` con `/rest/v1/`** — provoca `PGRST125 "Invalid path specified"` en el login. Debe ser la URL base pura.
- **`expo-secure-store` en Web** — no existe. `apps/mobile/src/lib/supabase.ts` implementa storage Platform-aware.
- **Supabase email built-in** — solo envía a team members del proyecto. Cualquier flujo público con email necesita SMTP custom (Resend/Brevo/…).
- **JWTs Supabase** — modernos ES256 asimétricos. Verificar con JWKS remoto, no con `SUPABASE_JWT_SECRET` (que es solo legacy HS256).
- **`next lint`** — removido en Next 16. Migrar a ESLint standalone.
- **ESLint 9** — obliga a flat config. Ni `.eslintrc.cjs` ni `.eslintrc.json` funcionan.

## Comandos útiles

```bash
# Regenerar Prisma client tras cambiar schema
pnpm --filter @artist-outreach/web exec prisma generate --schema=../../prisma/schema.prisma

# Nueva migración local
pnpm --filter @artist-outreach/web exec prisma migrate dev --schema=../../prisma/schema.prisma --name <nombre>

# Aplicar migraciones en Neon
DATABASE_URL="<Neon UNPOOLED URL>" pnpm db:deploy

# Reset local (destructivo)
pnpm --filter @artist-outreach/web exec prisma migrate reset --schema=../../prisma/schema.prisma

# Ver logs Prisma en dev
DEBUG=prisma:* pnpm --filter @artist-outreach/web dev

# Solo backend build (sin Expo)
pnpm --filter @artist-outreach/web build:web-only

# Curl a la API en prod con un token real
curl -s https://artistoutreach.vercel.app/api/contacts \
  -H "Authorization: Bearer $(cat token.txt)"
```

## Rotación de secretos — checklist

1. Cambiar el secreto en el sistema origen (Supabase / Neon / Resend).
2. Actualizar la env var en Vercel (Production + Preview).
3. Trigger redeploy manual (o push).
4. Actualizar `.env` local propio.
5. Verificar el endpoint sensible con curl + token nuevo.

Si el secreto se filtró en commits: `git filter-repo` para purgarlo del histórico + rotarlo. **Nunca** confiar en que borrar el commit "reciente" sea suficiente.

## Testing

- **Unit**: `pnpm --filter @artist-outreach/web test`. Tests puros de controllers/services usando Vitest.
- **Integration**: los mismos vitest tests que tocan BD → CI levanta Postgres 17 en service container.
- **E2E Playwright**: existe scaffolding en `apps/web/e2e/` pero **no está en CI**. `pnpm --filter @artist-outreach/web test:e2e` los corre localmente contra `pnpm dev`.

## Observabilidad

Mínima ahora: logs JSON en stdout → Vercel Logs. Sin APM/tracing/alertas. Cuando se active el envío outbound, priorizar:
- Alertas por `SendingConfig` auto-pausado.
- Alertas por `AuditLog` con `severity=error`.
- Dashboard con volumen enviado / rebotes / quejas.

## Contactos

- Product owner: la usuaria del proyecto (`laura.rodcarrion@gmail.com`).
- Repo: GitHub, `Artist-outreach`.
- Vercel project: `artistoutreach`.
- Supabase project: `pcvwfuyrsmcyijiaawre.supabase.co` (referencia — no un secreto).
- Neon project: verificar en dashboard Neon.

## Roadmap resumido

| # | Qué | Bloquea | Esfuerzo |
|---|---|---|---|
| 1 | Resend con dominio verificado | Emails llegan | ~30 min |
| 2 | Webhook Resend | Auto-suppression | ~5 min |
| 3 | Cron Vercel para el worker | Envío automático | ~10 min |
| 4 | Migrar lint a flat config ESLint 9 | Lint en CI | ~30 min |
| 5 | Validación jurídica del texto | Activar `sending_enabled` | externo |
| 6 | Alertas + observabilidad | Producción responsable | ~2 h |
| 7 | Panel de gestión de usuarios admin | Autonomía operacional | ~1 día |
