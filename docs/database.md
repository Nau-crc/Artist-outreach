# Database

PostgreSQL managed por Supabase. El esquema y las migraciones se gestionan con **Prisma** (`prisma/schema.prisma` como fuente única, `prisma migrate` genera SQL versionado en `prisma/migrations/`).

Todas las tablas usan `id String @id @default(uuid())`, `createdAt DateTime @default(now())` y `updatedAt DateTime @updatedAt`. Los enums son `enum` de Prisma que se mapean a `create type ... as enum (...)` en Postgres.

Acceso desde el backend Node.js (Next.js API routes) con `PrismaClient` singleton (`src/lib/prisma.ts`). Ningún cliente (móvil ni web) habla directamente con Postgres — todo pasa por la API.

RLS activada en todas las tablas como defensa en profundidad. Los checks reales de autorización viven en los middleware (`auth`, `admin-only`) y en los controllers. Los endpoints públicos usan tokens de un solo uso como autenticación de la operación.

Los `check` constraints, triggers de audit y la validación sintáctica de email se aplican con `Unsafe.raw` en una migración manual añadida encima de las de Prisma (Prisma no genera triggers ni checks arbitrarios). Cada tabla que necesite triggers lleva su migración `xxxx_triggers.sql` correspondiente.

## Diagrama lógico

```
discovery_sources ──┐
                    ├─▶ discovery_runs ──▶ contact_sources ──┐
                    ┘                                        │
                                                             ▼
                                                         contacts ──┬──▶ contact_tags ──▶ tags
                                                             │       │
                                                             │       ├──▶ consent_requests ──▶ email_messages ──▶ email_events
                                                             │       │
                                                             │       ├──▶ consents
                                                             │       │
                                                             │       ├──▶ newsletter_subscriptions
                                                             │       │
                                                             │       └──▶ suppressions (por email)
                                                             │
                                                             └──▶ audit_logs (polimórfico por entity_type/entity_id)
```

## Tablas

### `contacts`

La entidad artista.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `artist_name` | text not null | |
| `email` | citext | nullable — puede existir contacto sin email |
| `email_normalized` | citext generated always as (lower(trim(email))) stored | usado para deduplicación |
| `website` | text | |
| `discipline` | text | vocabulario controlado interno |
| `country` | char(2) | ISO 3166-1 |
| `city` | text | |
| `language` | text | ISO 639-1 |
| `contact_status` | enum | `DISCOVERED`, `REVIEW_REQUIRED`, `REVIEWED`, `DISCARDED`, `SUPPRESSED`. Default `DISCOVERED` |
| `email_status` | enum | `NOT_FOUND`, `FOUND`, `INVALID`, `BOUNCED`. Default `NOT_FOUND` |
| `consent_status` | enum | `UNKNOWN`, `REQUESTED`, `PENDING`, `CONFIRMED`, `WITHDRAWN`. Default `UNKNOWN` |
| `permission` | enum | `NOT_REVIEWED`, `ELIGIBLE`, `NOT_ELIGIBLE`, `BLOCKED`. Default `NOT_REVIEWED` |
| `last_action_at` | timestamptz | |
| `reviewed_at` | timestamptz | |
| `reviewed_by` | uuid | FK `auth.users` |
| `notes` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Índices:

- `unique (email_normalized) where email_normalized is not null` — deduplicación case-insensitive.
- `index (contact_status)`, `index (permission)`, `index (consent_status)`.
- `index (country, discipline)`.

Reglas:

- Un cambio de estado debe pasar por `/lib/state/transitions.ts`. Un trigger `contacts_status_audit` inserta en `audit_logs`.
- El email nunca se sobrescribe automáticamente. Si un discovery encuentra otro email para la misma persona, se guarda en `contact_sources.raw` y se marca para revisión.

### `discovery_sources`

Catálogo de fuentes disponibles.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | ej. `musicbrainz`, `csv_import` |
| `name` | text | |
| `type` | enum | `API`, `DIRECTORY`, `CSV`, `MANUAL` |
| `compliance_status` | enum | `VERIFIED`, `UNVERIFIED`, `PROHIBITED` |
| `compliance_notes` | text | motivo del status y fecha de verificación |
| `terms_url` | text | |
| `enabled` | boolean not null default false | |
| `config` | jsonb | credenciales por ref al secret store, no valores |

Regla operacional: solo se puede ejecutar un discovery contra una source con `compliance_status = 'VERIFIED'` y `enabled = true`.

### `discovery_runs`

Cada ejecución.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `source_id` | uuid FK discovery_sources | |
| `params` | jsonb | parámetros de búsqueda |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | |
| `status` | enum | `RUNNING`, `SUCCEEDED`, `FAILED`, `RATE_LIMITED` |
| `results_count` | int | |
| `new_contacts_count` | int | |
| `error` | text | |
| `triggered_by` | uuid | FK `auth.users`, nullable para cron |

### `contact_sources`

Aparición de un contacto en una fuente. N por contacto.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contact_id` | uuid FK contacts on delete cascade | |
| `run_id` | uuid FK discovery_runs | |
| `source_id` | uuid FK discovery_sources | |
| `source_url` | text not null | |
| `raw` | jsonb | payload original recortado |
| `discovered_at` | timestamptz | |

Índices: `index (contact_id)`, `index (source_id, discovered_at)`.

### `tags` y `contact_tags`

Etiquetado libre.

`tags(id, name unique, color)`.
`contact_tags(contact_id, tag_id, primary key (contact_id, tag_id))`.

### `consent_requests`

Cada intención de solicitar consentimiento.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contact_id` | uuid FK contacts | |
| `campaign_id` | uuid FK campaigns | |
| `template_id` | uuid FK consent_templates | |
| `text_version` | text not null | snapshot literal del texto enviado |
| `status` | enum | `PENDING`, `SENT`, `FAILED`, `CANCELLED` |
| `token` | text unique not null | 32 bytes base64url |
| `token_expires_at` | timestamptz | |
| `sent_at` | timestamptz | |
| `eligibility_snapshot` | jsonb | valores evaluados al momento del envío |
| `created_by` | uuid | |

Índices: `index (contact_id, sent_at desc)`.

### `campaigns` y `consent_templates`

- `campaigns(id, name, active bool, starts_at, ends_at, max_sends int)`.
- `consent_templates(id, name, subject, body_html, body_text, version int, active bool)`.

Cada envío captura `text_version` desde el template — nunca referencia mutable.

### `consents`

Registro del consentimiento otorgado o retirado.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contact_id` | uuid FK contacts | |
| `purpose` | enum | `NEWSLETTER`, otros futuros |
| `status` | enum | `CONFIRMED`, `WITHDRAWN` |
| `source` | enum | `EMAIL_LINK`, `PUBLIC_FORM`, `MANUAL` |
| `text_version` | text not null | qué se aceptó exactamente |
| `granted_at` | timestamptz | |
| `withdrawn_at` | timestamptz | |
| `evidence` | jsonb | ip, user-agent, token id, referrer |

Índice: `index (contact_id, purpose, granted_at desc)`.

Un consentimiento retirado NO se borra; se mantiene con `status = WITHDRAWN` y `withdrawn_at` seteado.

### `newsletter_subscriptions`

Suscripción efectiva tras double opt-in.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contact_id` | uuid FK contacts | |
| `status` | enum | `PENDING_CONFIRMATION`, `CONFIRMED`, `UNSUBSCRIBED` |
| `confirmation_token` | text unique | |
| `confirmation_expires_at` | timestamptz | |
| `confirmed_at` | timestamptz | |
| `unsubscribed_at` | timestamptz | |
| `unsubscribe_token` | text unique not null | permanente |
| `consent_id` | uuid FK consents | consent que originó la suscripción |

Índice `unique (contact_id) where status in ('PENDING_CONFIRMATION','CONFIRMED')` — evita duplicados activos.

### `suppressions`

Lista de supresión por email. Prevalece siempre.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `email_normalized` | citext unique not null | |
| `reason` | enum | `UNSUBSCRIBE`, `COMPLAINT`, `HARD_BOUNCE`, `MANUAL`, `WITHDRAWN` |
| `notes` | text | |
| `suppressed_at` | timestamptz | |
| `suppressed_by` | uuid | nullable |

Trigger: al insertar aquí, todos los `contacts` con `email_normalized` coincidente pasan a `contact_status = SUPPRESSED` y `permission = BLOCKED`. Nuevos discoveries con ese email quedan bloqueados en el paso de deduplicación.

### `email_messages`

Todo email enviado por la plataforma, sin excepción (consent request, confirmación, newsletter futura).

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contact_id` | uuid FK contacts | |
| `purpose` | enum | `CONSENT_REQUEST`, `DOUBLE_OPTIN`, `NEWSLETTER`, `SYSTEM` |
| `related_id` | uuid | id del `consent_requests` u otro origen |
| `provider` | text | `resend`, etc. |
| `provider_message_id` | text unique | |
| `recipient` | citext not null | copia del email al momento del envío |
| `subject` | text | |
| `template_id` | uuid | |
| `text_version` | text | copia literal del cuerpo enviado |
| `status` | enum | `QUEUED`, `SENT`, `FAILED` |
| `sent_at` | timestamptz | |
| `error` | text | |

Índices: `index (contact_id, sent_at desc)`, `index (provider_message_id)`.

### `email_events`

Eventos del proveedor, idempotentes.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid FK email_messages | |
| `event_type` | enum | `SENT`, `DELIVERED`, `BOUNCED`, `COMPLAINED`, `OPENED`, `CLICKED` |
| `provider_event_id` | text | |
| `occurred_at` | timestamptz | |
| `payload` | jsonb | |

Índice `unique (message_id, event_type, provider_event_id)` para idempotencia.

Reglas:

- `BOUNCED` con tipo permanente → auto-insert en `suppressions(reason = HARD_BOUNCE)`.
- `COMPLAINED` → auto-insert en `suppressions(reason = COMPLAINT)`.

### `app_config`

Singleton (una fila). Almacena interruptores globales.

| Col | Tipo | Notas |
|---|---|---|
| `id` | int PK check (id = 1) | |
| `sending_enabled` | boolean not null default false | |
| `campaign_enabled` | boolean not null default false | |
| `daily_send_limit` | int not null default 0 | |
| `hourly_send_limit` | int not null default 0 | |
| `min_interval_seconds` | int not null default 60 | |
| `consent_request_cooldown_days` | int not null default 90 | |
| `updated_at` | timestamptz | |
| `updated_by` | uuid | |

Trigger `app_config_audit` registra en `audit_logs` cada UPDATE con diff.

### `audit_logs`

Registro append-only.

| Col | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `at` | timestamptz not null default now() | |
| `actor_id` | uuid | nullable (procesos automáticos) |
| `actor_kind` | enum | `USER`, `SYSTEM`, `WEBHOOK`, `PUBLIC` |
| `entity_type` | text | `contact`, `consent`, `app_config`, ... |
| `entity_id` | uuid | |
| `action` | text | `discovered`, `state_changed`, `consent_requested`, `consent_confirmed`, ... |
| `before` | jsonb | |
| `after` | jsonb | |
| `metadata` | jsonb | ip, user-agent, source_url, message_id, etc. |

Índices: `index (entity_type, entity_id, at desc)`, `index (at desc)`.

RLS: solo lectura para admins; escritura vía triggers/servicio.

## Constraints y triggers clave

- `unique (contacts.email_normalized) where not null`.
- `check (contacts.email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')` — validación mínima; validación real en Zod.
- Trigger `contacts_status_audit` — cualquier cambio de `contact_status`, `email_status`, `consent_status`, `permission` genera `audit_logs`.
- Trigger `suppressions_cascade` — al insertar en `suppressions`, marca los contactos correspondientes.
- Trigger `email_events_side_effects` — `HARD_BOUNCE` y `COMPLAINED` insertan en `suppressions` (idempotente).
- Trigger `app_config_audit` — diff de UPDATE al `audit_logs`.
- Trigger `updated_at` estándar en todas las tablas mutables.

## RLS — defensa en profundidad

La autorización real vive en el backend NestJS (guards + casos de uso). RLS existe por si algún día se abre otro camino a la DB.

```sql
-- Deniega todo por defecto:
alter table <t> enable row level security;
-- El rol del backend puentea RLS con SECURITY DEFINER en funciones puntuales
-- o simplemente usando un rol con BYPASSRLS controlado (aún así probamos
-- que los guards del backend rechazan cualquier acceso no admin).
-- Cliente móvil y web nunca se conectan a Postgres.
```

Nada expone `service_role` al bundle cliente. Los endpoints públicos (`/public/subscribe`, `/public/confirm`, `/public/unsubscribe`, `/public/consent`) son route handlers de NestJS, van a la DB por el mismo pool, y solo aceptan la operación mínima autenticada por su token.

## Datos que NO se almacenan

- Teléfonos.
- Dirección postal.
- Fecha de nacimiento.
- Cualquier dato biométrico o sensible.
- Redes sociales completas (opcional guardar solo `website`).

Si en el futuro es necesario, se añade con justificación explícita y actualización del texto de consentimiento.

## Retención

- `contacts` con `contact_status = DISCARDED` y sin actividad por 180 días → purgados.
- `email_events` con más de 24 meses → purgados salvo los ligados a `consents` activos.
- `audit_logs` sin expiración (registro legal); revisar política a 3-5 años.
