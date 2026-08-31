# Architecture

Aplicación para descubrir artistas en fuentes públicas permitidas, guardar contactos con trazabilidad, revisarlos manualmente, y — solo cuando exista base jurídica y técnica validada — solicitarles consentimiento individual para suscribirse a la newsletter mediante double opt-in.

## Principio rector

Cuatro conceptos se mantienen SEPARADOS en el modelo de datos, en la UI, en los controllers y en los logs:

```
EMAIL ENCONTRADO  ≠  CONTACTO APTO PARA CONTACTAR  ≠  CONSENTIMIENTO  ≠  SUSCRIPTOR
```

- Descubrir un email público NO habilita envío.
- Aprobar un contacto NO implica consentimiento.
- Solicitar consentimiento NO significa que exista consentimiento.
- Confirmar consentimiento NO da de alta en la newsletter — hay un double opt-in adicional.

Cada transición requiere un evento explícito (humano o de la propia persona destinataria) y queda registrada en `audit_logs`.

## Topología

Monorepo con dos apps y paquetes compartidos. Todo el backend vive dentro de la app Next.js (API routes), desplegado en Vercel como una unidad. La app móvil consume esas mismas rutas.

```
artist-outreach/
├── apps/
│   ├── mobile/         # Expo (React Native) — CRM mobile-first del operador
│   └── web/            # Next.js — landings públicas + backend MVC (API routes)
├── packages/
│   ├── ui/             # Atomic Design: atoms, molecules, organisms, templates
│   ├── shared/         # tipos, DTOs, schemas Zod, enums, transiciones de estado
│   └── config/         # eslint, tsconfig, tailwind preset, design tokens
├── prisma/
│   ├── schema.prisma   # única fuente del esquema
│   └── migrations/     # generadas por prisma migrate
└── docs/
```

Gestor: **pnpm workspaces + Turborepo**. Deploy: `apps/web` a Vercel; `apps/mobile` a EAS. TypeScript estricto en todo el repo.

### Por qué esta topología

- Backend dentro de Next.js API routes: Vercel-native, sin servidor separado, sin coste extra. Cumple tu petición de montarla en Vercel.
- Móvil consume las mismas rutas HTTP. La API es idéntica para móvil y para las landings.
- Un solo lenguaje (TS) en todo permite compartir dominio, tipos y validaciones.

> Sobre "arquitectura SAP": lo interpreto como **SPA / monolito modular**. Microservicios descartados para MVP.

## Stack

Verificado 2026-08-31 con `npm view`:

| Capa | Elección | Versión |
|---|---|---|
| Móvil | Expo + React Native + Expo Router | 57.0.18 / 0.87.1 / 57.0.17 |
| Estilo móvil | NativeWind (Tailwind para RN) | 4.2.6 |
| Web + backend | Next.js (App Router) + React | 16.3.3 / 19.2.8 |
| Estilo web | Tailwind CSS v4 | 4.3.3 |
| Lenguaje | TypeScript estricto | 5.x |
| DB | PostgreSQL (Supabase managed) | — |
| ORM | Prisma | 7.10.0 (estable; 8 en RC) |
| Validación | Zod (compartido en `packages/shared`) | 4.5.4 |
| Auth | Supabase Auth (JWT + magic link) | supabase-js 2.112.4 |
| Email | Abstracción `EmailProvider`, impl. Resend | 6.25.0 |
| Testing (web + backend) | Vitest + Supertest + Playwright | 4.1.11 |
| Testing (móvil) | Jest + React Native Testing Library + Maestro | 30.5.0 |
| Hosting web + API | Vercel | — |
| Hosting móvil | EAS Build + tiendas | — |
| CI | GitHub Actions | — |

## Backend — MVC en Node.js dentro de Next.js

MVC clásico dentro de `apps/web`. Las API routes son la capa "controller" delgada que valida y delega. Los "models" concentran la lógica de negocio y hablan con Prisma. Las "views" son las páginas React de las landings públicas (y el móvil, que es otra vista sobre la misma API).

```
apps/web/
├── app/
│   ├── (public)/               # views: landings públicas
│   │   ├── newsletter/page.tsx
│   │   ├── consent/[token]/page.tsx
│   │   ├── subscribe/confirm/[token]/page.tsx
│   │   ├── unsubscribe/[token]/page.tsx
│   │   ├── privacy/page.tsx
│   │   └── terms/page.tsx
│   └── api/                    # controllers
│       ├── contacts/route.ts
│       ├── contacts/[id]/route.ts
│       ├── contacts/[id]/eligibility/route.ts
│       ├── discovery/route.ts
│       ├── discovery/csv/route.ts
│       ├── consent-requests/route.ts
│       ├── consent-templates/route.ts
│       ├── campaigns/route.ts
│       ├── suppressions/route.ts
│       ├── config/route.ts
│       ├── audit/route.ts
│       ├── public/
│       │   ├── subscribe/route.ts
│       │   ├── confirm/[token]/route.ts
│       │   ├── unsubscribe/[token]/route.ts
│       │   └── consent/[token]/route.ts
│       └── webhooks/
│           └── email/[provider]/route.ts
├── src/
│   ├── controllers/            # invocables desde route.ts
│   │   ├── contacts.controller.ts
│   │   ├── discovery.controller.ts
│   │   ├── consent.controller.ts
│   │   ├── newsletter.controller.ts
│   │   ├── suppressions.controller.ts
│   │   ├── config.controller.ts
│   │   └── webhooks.controller.ts
│   ├── models/                 # lógica de negocio + acceso a datos
│   │   ├── contact.model.ts
│   │   ├── discovery.model.ts
│   │   ├── eligibility.model.ts
│   │   ├── consent.model.ts
│   │   ├── newsletter.model.ts
│   │   ├── suppression.model.ts
│   │   ├── audit.model.ts
│   │   └── config.model.ts
│   ├── services/               # integraciones externas
│   │   ├── email/
│   │   │   ├── email.provider.ts     # interface
│   │   │   ├── resend.provider.ts    # impl
│   │   │   └── fake.provider.ts      # tests
│   │   ├── discovery/
│   │   │   ├── discovery.provider.ts # interface
│   │   │   ├── csv.provider.ts
│   │   │   └── musicbrainz.provider.ts   # solo si VERIFIED
│   │   └── rate-limit.ts
│   ├── middleware/
│   │   ├── auth.ts             # verificación JWT Supabase
│   │   ├── admin-only.ts
│   │   ├── with-controller.ts  # wrap error handling + Zod + logging
│   │   └── audit.ts
│   ├── lib/
│   │   ├── prisma.ts           # cliente singleton
│   │   ├── tokens.ts
│   │   └── logger.ts           # pino
│   └── types/
└── prisma/                     # symlink a /prisma raíz
```

Reglas simples:

- Un `route.ts` no contiene lógica — solo llama a un método del controller y devuelve.
- Un controller valida entrada (Zod), invoca uno o más models, y responde.
- Un model contiene reglas de negocio y usa Prisma. No conoce HTTP.
- Un service es un adapter a algo externo (email, discovery). Definido detrás de una interface.

### Interfaces de servicios

```ts
// services/email/email.provider.ts
export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>
  parseWebhook(headers: Headers, body: unknown): EmailEvent[]
}

// services/discovery/discovery.provider.ts
export interface DiscoveryProvider {
  readonly id: string
  readonly requiresApiKey: boolean
  isCompliant(): Promise<ComplianceCheck>
  search(params: DiscoverySearchParams): Promise<DiscoveryResult[]>
}
```

Cada interface tiene una implementación real y un fake para tests. El fake vive junto a la real y se selecciona por `NODE_ENV` o inyección explícita en tests.

## Sistema de diseño — Atomic Design

Componentes compartidos entre móvil y web en `packages/ui`, organizados según Atomic Design (Brad Frost).

```
packages/ui/
├── tokens/                     # design tokens (color, spacing, radius, type)
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts
│   └── index.ts
├── atoms/                      # piezas indivisibles
│   ├── Text/
│   ├── Button/
│   ├── Input/
│   ├── Badge/                  # uno por estado (contact_status, consent_status, ...)
│   ├── Icon/
│   ├── Divider/
│   └── Spinner/
├── molecules/                  # combinaciones simples
│   ├── FormField/
│   ├── SearchBar/
│   ├── Card/
│   ├── StatusPill/
│   ├── EmptyState/
│   └── Toast/
├── organisms/                  # secciones funcionales
│   ├── ContactCard/
│   ├── ReviewQueueItem/
│   ├── EligibilityReport/
│   ├── AppHeader/
│   ├── AuditEntry/
│   └── SubscribeForm/
├── templates/                  # layouts sin datos
│   ├── AdminScreen/
│   ├── PublicLanding/
│   └── EmptyDashboard/
└── index.ts
```

- **Tokens** son la única fuente de verdad de color, escala y espaciado. Cambiar aquí propaga a móvil y web.
- **Atoms** son primitivas puras, sin negocio, sin estado. Solo props.
- **Molecules** componen átomos y tienen estado mínimo local.
- **Organisms** conocen entidades del dominio (`Contact`, `Consent`) y se conectan a datos.
- **Templates** son layouts que reciben slots.
- **Pages** viven en las apps y son los templates rellenos con datos reales.

### Cross-platform (RN + web)

Cada componente exporta la variante web (Tailwind) y la variante nativa (NativeWind) desde el mismo nombre de archivo:

```
atoms/Button/
  ├── Button.tsx           # web (Tailwind + div/button)
  ├── Button.native.tsx    # RN + NativeWind (View/Pressable)
  ├── Button.stories.tsx   # Storybook para web
  └── index.ts
```

Metro (móvil) y Next.js (web) resuelven `.native.tsx` vs `.tsx` automáticamente. La API pública del componente es idéntica.

Tailwind preset compartido en `packages/config/tailwind-preset.ts`, consumido por `apps/web/tailwind.config.ts` y por `apps/mobile/tailwind.config.js` (NativeWind).

Storybook en `packages/ui` para los componentes web; snapshot tests para los `.native.tsx`.

## Flujo de negocio

```
┌──────────────┐   ┌───────────────┐   ┌──────────────┐
│  DISCOVERY   │──▶│ NORMALIZATION │──▶│ DEDUPLICATION│
└──────────────┘   └───────────────┘   └──────┬───────┘
                                              ▼
                                   ┌───────────────────┐
                                   │ CONTACT DATABASE  │
                                   └────────┬──────────┘
                                            ▼
                                   ┌───────────────────┐
                                   │  HUMAN REVIEW     │  ← nunca automático
                                   └────────┬──────────┘
                                            ▼
                                   ┌───────────────────┐
                                   │   ELIGIBILITY     │
                                   └────────┬──────────┘
                                            ▼
                            (sending_enabled == true?)
                                            ▼
                                   ┌───────────────────┐
                                   │ CONSENT REQUEST   │
                                   └────────┬──────────┘
                                            ▼
                                   ┌───────────────────┐
                                   │     CONSENT       │
                                   └────────┬──────────┘
                                            ▼
                                   ┌───────────────────┐
                                   │  DOUBLE OPT-IN    │
                                   └────────┬──────────┘
                                            ▼
                                   ┌───────────────────┐
                                   │    NEWSLETTER     │
                                   └───────────────────┘
```

### Discovery

Providers extensibles. Cada uno vive en `src/services/discovery/`. Un provider solo se activa si `isCompliant()` confirma:

- La fuente permite el uso automatizado previsto en sus términos.
- Respeta `robots.txt` cuando aplique.
- Permite recopilar email para el propósito descrito.

Providers no verificables quedan `UNVERIFIED` y no se ejecutan. Fuentes candidatas: importación CSV, y 1–2 APIs oficiales tras auditar términos caso por caso (candidato: MusicBrainz para metadatos, sin email harvesting).

**No implementaremos** scraping de RRSS, harvesting de páginas que lo prohíban, ni compra de bases.

### Normalization

- `email.trim().toLowerCase()`, eliminación de invisibles.
- Validación sintáctica con schema Zod en `packages/shared`.
- País ISO 3166-1 alpha-2, disciplina en vocabulario controlado.
- `raw` recortado a lo necesario.

### Deduplication

- Clave: `email_normalized` cuando existe.
- Fallback: `artist_name + website`.
- N `contact_sources` por contacto. Historial completo, sin sobrescribir.

### Human review

Cola en móvil. Nunca hay promoción automática a `permission = ELIGIBLE`.

### Eligibility

Modelo puro en `models/eligibility.model.ts`. Todas las reglas deben pasar:

```
contact exists
email present && syntactically valid
email_status not in (INVALID, BOUNCED)
not in suppressions
consent_status == UNKNOWN
permission == ELIGIBLE
sending_enabled == true
campaign.active == true
no consent_request in last N days
daily_send_count < daily_send_limit
hourly_send_count < hourly_send_limit
```

Si algo falla: `DO NOT SEND` y motivo en `audit_logs`.

### Consent request / consent / double opt-in

En `models/consent.model.ts` y `models/newsletter.model.ts`. `text_version` congelado en cada `consent_requests`, `consents` y `email_messages`.

## Estados

Cuatro columnas independientes:

| Campo | Valores |
|---|---|
| `contact_status` | `DISCOVERED`, `REVIEW_REQUIRED`, `REVIEWED`, `DISCARDED`, `SUPPRESSED` |
| `email_status` | `NOT_FOUND`, `FOUND`, `INVALID`, `BOUNCED` |
| `consent_status` | `UNKNOWN`, `REQUESTED`, `PENDING`, `CONFIRMED`, `WITHDRAWN` |
| `permission` | `NOT_REVIEWED`, `ELIGIBLE`, `NOT_ELIGIBLE`, `BLOCKED` |

Transiciones válidas en `packages/shared/src/state-transitions.ts` — usado por móvil, web y models.

## Interruptor global de envío

Config en tabla `app_config` (singleton):

```
sending_enabled: boolean            # default FALSE
campaign_enabled: boolean           # default FALSE
daily_send_limit: int
hourly_send_limit: int
min_interval_seconds: int
consent_request_cooldown_days: int  # default 90
```

- Cambio auditado.
- Banner permanente en la app móvil cuando `sending_enabled = true`.
- Prevalece el límite más restrictivo entre app y proveedor.
- No existe endpoint ni flag para saltarse el motor de elegibilidad.

## Rutas móvil

`apps/mobile` con Expo Router:

```
(auth)/
  login
(app)/
  dashboard
  contacts/
    index                # lista + filtros
    [id]                 # detalle
    import               # CSV
  review                 # cola de revisión
  consent-requests
  campaigns
  templates
  audit
  settings               # incluye sending_enabled
```

Autenticación con Supabase Auth (magic link). Token en Expo SecureStore. Llamadas al backend con `Authorization: Bearer <jwt>`.

## Rutas web pública

Solo lo que necesita un click desde email:

```
/newsletter
/consent/[token]
/subscribe/confirm/[token]
/unsubscribe/[token]
/privacy
/terms
```

Sin login, sin panel. Backend endpoints en `/api/public/*` con rate limiting.

## Seguridad

- Supabase Auth para admins.
- Middleware `auth` + `admin-only` en todas las rutas excepto `/api/public/*` y `/api/webhooks/*`.
- Cliente móvil y web nunca hablan con Postgres directamente — todo pasa por API.
- Prisma corre en el server con `DATABASE_URL` en variables de Vercel. Nunca expuesto al bundle cliente.
- Rate limiting en `/api/public/*` y `/api/webhooks/*` con `@upstash/ratelimit`.
- Tokens de confirmación: 32 bytes aleatorios, un solo uso, expiración configurable, comparados con `crypto.timingSafeEqual`.
- Logs estructurados (pino). Email hasheado en métricas agregadas.
- CORS del backend restringido a los dominios de la web y del scheme de la app móvil.
- Zod en boundary para cada request.

## Privacidad

- Minimización: solo campos con propósito claro. Ni teléfonos, ni direcciones postales, ni fechas de nacimiento.
- Cada persona puede: retirar consentimiento (link permanente en cada email), pedir supresión, consultar origen de sus datos.
- `withdrawn_at` no borra el histórico. La supresión activa impide contactar.
- Retención: contactos `DISCARDED` sin actividad se purgan a los 180 días.

## Trazabilidad

`audit_logs` registra:

- Descubrimiento y fuente.
- Cambios de estado (antes/después, actor, timestamp).
- Aprobación / descarte.
- Envíos con `provider_message_id`.
- Solicitudes y confirmaciones de consentimiento (con `text_version`).
- Retirada de consentimiento y bajas.
- Cambios en `app_config`.

Cualquier contacto debe poder reconstruirse íntegramente desde `audit_logs`.

## Testing

Pirámide por app.

### `apps/web` (frontend + backend)

- **Unit de models**: Vitest, DB in-memory (SQLite Prisma) o base de test dedicada. Cobertura mínima 90% en `src/models/`.
- **Unit de controllers**: Vitest, mocks de models. Verifican validación Zod + delegación + status codes.
- **Integración**: Vitest + Prisma contra Postgres real (Docker Compose local o contenedor en CI). Los modelos que tocan varias tablas se prueban aquí.
- **HTTP / route.ts**: Supertest contra el server de Next en modo test. Un test por endpoint (happy + auth + validación + error).
- **Componentes de pages y organisms**: Vitest + Testing Library.
- **E2E**: Playwright — flujos de subscribe/confirm/unsubscribe/consent completos.

### `apps/mobile`

- **Unit y componente**: Jest + React Native Testing Library. Un test por pantalla crítica.
- **E2E**: Maestro flows contra el binario Expo + backend en Docker local.

### `packages/ui`

- **Atoms y molecules**: Vitest + Testing Library + snapshot para las variantes web y RN.
- **Organisms**: tests con datos de dominio de `packages/shared` (fixtures).
- **Storybook** para la web, con visual regression opcional (Chromatic más adelante).

### Contratos entre apps

- Los tipos DTO y schemas Zod de `packages/shared` son fuente única.
- Un job de CI verifica que las llamadas de móvil y web usan los mismos tipos que expone la API.

### CI

GitHub Actions:

- Lint + typecheck + unit en cada PR.
- Integración con Postgres en Docker en `main`.
- Playwright + Maestro en un job nocturno.
- Cobertura con umbral bloqueante en `src/models/`.

## Deploy

- `apps/web`: Vercel. Migraciones aplicadas por CI antes del despliegue (`prisma migrate deploy`).
- `apps/mobile`: EAS Build para binarios. EAS Update para OTA en canales dev/staging/prod.
- Supabase gestiona Postgres + Auth. Backups automáticos habilitados.
- Cron con Vercel Cron (fase 6): un endpoint `/api/cron/consent-queue` protegido por secret, invocado según schedule.

## Lo que la aplicación NO hará

- No salta CAPTCHAs, logins, ni áreas privadas.
- No evade sistemas anti-bot ni límites de APIs o de proveedores de email.
- No importa listas compradas.
- Siempre respeta `robots.txt` cuando aplica.
- No usa credenciales de terceros.
- No permite envío a contactos sin evaluar todas las reglas de elegibilidad.
- No expone en ningún punto una vía para desactivar los checks.
