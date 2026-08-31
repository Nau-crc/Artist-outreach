# Roadmap

Implementación por fases. **El envío outbound de solicitudes NO se implementa hasta la fase 6, tras tu validación jurídica y contractual explícita.** Fases 1–5 son útiles con `sending_enabled = false`: la app funciona como CRM de descubrimiento y revisión sin salir de las restricciones.

Cada fase termina con criterios de aceptación medibles y una **suite de tests verde** (unit + integración + E2E donde aplique).

## Fase 0 — Diseño (aquí estamos)

- [x] `docs/architecture.md`
- [x] `docs/database.md`
- [x] `docs/roadmap.md`
- [ ] Tu aprobación del stack (MVC en Next.js API routes + Prisma + Atomic Design) y de la topología del monorepo.

## Fase 1 — Bootstrap del monorepo

Objetivo: los dos proyectos arrancan vacíos, con toolchain y CI verde.

- `pnpm init` + `pnpm-workspace.yaml` + Turborepo.
- `apps/web` con Next.js 16 + Tailwind 4 + estructura MVC (`src/controllers`, `src/models`, `src/services`, `src/middleware`, `src/lib`).
- `apps/mobile` con Expo (managed) + Expo Router + NativeWind + TypeScript. Corre en iOS/Android/web.
- `packages/ui` con estructura Atomic Design (tokens/atoms/molecules/organisms/templates) — vacío pero armado.
- `packages/shared` con `Email`, `CountryCode`, `Discipline`, enums de estado, schemas Zod, mapa de transiciones.
- `packages/config` con presets ESLint, tsconfig, Tailwind, Prettier, design tokens.
- Prisma inicializado (`schema.prisma` vacío + `.env.example`).
- Supabase local (`supabase init && supabase start`) para desarrollo.
- Docker Compose local: postgres, Mailpit (mail sink para tests).
- CI GitHub Actions: matrix por app, lint + typecheck + unit.
- Deploy staging: web → Vercel, mobile → EAS canal `staging`.

Criterio de aceptación:

- Los dos proyectos compilan y arrancan.
- CI verde en un PR ejemplo.
- `GET /api/health` responde 200 desde staging.
- La app móvil abre pantalla vacía y muestra el estado del backend.
- La web renderiza `/newsletter` con placeholder.
- Storybook de `packages/ui` corre local con un átomo `Button` de ejemplo.

Tests: smoke tests de arranque de cada app + snapshot del `Button` en modo web y RN.

## Fase 2 — Modelo de datos + auth + CRM base

Objetivo: DB completa y CRM navegable en móvil, sin discovery ni envío.

- Prisma:
  - `schema.prisma` con todas las tablas de [database.md](./database.md): enums, relaciones, unique constraints.
  - Migración SQL mínima para `email_normalized` como columna generada (única cosa que Prisma no expresa).
  - Seed idempotente (`prisma/seed.ts`) con 20 contactos ficticios.
  - Invariantes (audit, suppression cascade, transiciones) implementadas en los models Node dentro de `$transaction`. Sin triggers ni RLS — móvil y web pública nunca tocan Postgres.
- Backend (`apps/web`):
  - `models/`: `contact`, `audit`, `config`, `suppression`.
  - `controllers/`: `contacts`, `audit`, `config`, `suppressions`.
  - `middleware/`: `auth` (Supabase JWT via JWKS), `admin-only`, `with-controller` (error handling + Zod + audit).
  - Endpoints: `GET/POST/PATCH /api/contacts`, `GET /api/contacts/:id`, `GET /api/audit`, `GET/PATCH /api/config`, `POST /api/suppressions`, `GET /api/health`.
- `packages/ui` — átomos y moléculas base:
  - Atoms: `Text`, `Button`, `Input`, `Badge` (variantes por estado), `Icon`, `Spinner`.
  - Molecules: `FormField`, `SearchBar`, `Card`, `StatusPill`, `EmptyState`.
  - Organisms: `ContactCard`, `AuditEntry`, `AppHeader`.
- Móvil:
  - Login por magic link.
  - Rutas `(app)/dashboard`, `contacts`, `contacts/[id]`, `settings`, `audit`.
  - Pantallas usan solo componentes de `packages/ui`.
- Testing:
  - Unit de models con Prisma test DB.
  - Unit de controllers con mock de models.
  - HTTP tests con Supertest de todos los endpoints (happy + auth + validación).
  - Componentes de `packages/ui` con Vitest + snapshot RN.
  - Componentes de pantallas móviles con RNTL.
  - Maestro E2E: login → ver lista → abrir detalle → cambiar estado → verlo en `/audit`.

Criterio de aceptación: puedes crear un contacto en móvil, verlo, moverlo entre estados, y todo queda auditado. `sending_enabled` sigue `false`. Cobertura ≥ 90% en `src/models/`.

## Fase 3 — Discovery + normalización + deduplicación

Objetivo: poblar la base desde fuentes permitidas con revisión humana.

- Backend:
  - `services/discovery/`: interface `DiscoveryProvider`, registry, adapter `csv` (streaming, límites de tamaño), adapter 1–2 API tras revisión de términos (candidato principal: MusicBrainz para metadatos).
  - `models/discovery.model.ts`: pipeline run → results → normalize → dedupe → persist → estado `REVIEW_REQUIRED`.
  - `models/eligibility.model.ts`: motor de reglas puro. Endpoint `POST /api/contacts/:id/eligibility/dry-run`.
  - Suppression list operativa.
- `packages/ui`:
  - Organisms: `ReviewQueueItem`, `EligibilityReport`, `CsvImportPreview`.
- Móvil:
  - `contacts/import`: upload → preview → column mapping → validation → duplicate check → confirm. Nunca importa sin preview.
  - `review`: cola con gestos táctiles APROBAR / DESCARTAR / SUPRIMIR.
  - Detalle con dry-run de elegibilidad y motivos.
- Testing:
  - Unit de cada `DiscoveryProvider` con fixtures.
  - Test que verifica que providers `UNVERIFIED` no se ejecutan.
  - Integración: run completo con CSV de 1000 filas + dedupes conocidos.
  - Property-based tests de normalización de email (fast-check).
  - Maestro E2E: importar CSV → cola → aprobar → dry-run elegible.

Criterio de aceptación: puedes correr un discovery, la cola se llena, apruebas contactos y ves por qué son o no elegibles. Sigue sin enviarse ningún email outbound.

## Fase 4 — Web pública + suscripción directa con double opt-in

Objetivo: las personas que llegan orgánicamente pueden suscribirse a la newsletter **sin que nosotros hayamos enviado nada antes**.

- Web:
  - `/newsletter` con formulario (acción afirmativa, sin premarcadas).
  - `/subscribe/confirm/[token]` para el segundo click.
  - `/unsubscribe/[token]`.
  - `/privacy`, `/terms`.
  - Todo mobile-first en Tailwind, usando componentes de `packages/ui`.
- Backend:
  - `models/newsletter.model.ts` con `subscribe`, `confirm`, `unsubscribe`.
  - `services/email/email.provider.ts` interface + `resend.provider.ts` implementación.
  - Uso **solo transaccional**: enviamos email de confirmación al que rellenó el formulario. Es respuesta a acción del usuario, no outreach.
  - Webhook `/api/webhooks/email/resend` → `email_events` + suppression automática (bounce permanente, complaint). Idempotente.
  - Rate limit en `/api/public/*`.
- `packages/ui`:
  - Organisms: `SubscribeForm`, `ConfirmationCard`.
  - Template: `PublicLanding`.
- Testing:
  - Unit de `newsletter.model` con `EmailProvider` fake.
  - Integración: subscribe → email en Mailpit → confirm → `CONFIRMED`.
  - Webhook idempotency: replay del mismo evento no duplica.
  - Playwright: subscribe→confirm→unsubscribe end-to-end en la web.

Criterio de aceptación: alguien llega a `/newsletter`, se suscribe, recibe email, confirma y queda `CONFIRMED`. Un bounce lo mueve a `suppressions`. La cola de solicitud outbound existe pero permanece parada.

## Fase 5 — Editor de templates + cola parada

Objetivo: preparar toda la maquinaria de solicitud de consentimiento, sin activarla.

- Backend:
  - `models/consent.model.ts`: `consent_templates` con versionado, preview, `campaigns` CRUD, cola `consent_requests`.
  - `queue-consent-request` completa snapshot `text_version` + `eligibility_snapshot`.
  - Worker esqueleto (endpoint `/api/cron/consent-queue` protegido) que **no dispara nada** porque `sending_enabled=false`.
- `packages/ui`:
  - Organisms: `TemplateEditor`, `CampaignForm`, `ConsentRequestRow`.
- Móvil:
  - Editor de templates con preview.
  - CRUD de campaigns.
  - Vista de cola (read-only en esta fase).
  - Simulación: "¿qué pasaría si activo el envío?" — dry-run del motor sobre N contactos.
- Testing:
  - Unit del snapshot: cambios posteriores al template no alteran solicitudes ya creadas.
  - Integración: `queue-consent-request` con `sending_enabled=false` deja la fila `PENDING` sin llamar al provider.
  - Test explícito: no existe ninguna ruta que llame a `EmailProvider.send` con `purpose='CONSENT_REQUEST'` mientras `sending_enabled=false`.

Criterio de aceptación: el editor y la cola funcionan, pero ninguna solicitud sale.

## Fase 6 — Activación del envío outbound (**gate manual explícito**)

**Requiere tu confirmación explícita y validación jurídica del texto exacto y del caso concreto.**

- Backend:
  - Worker de cola invocado por Vercel Cron cada N minutos.
  - `sending_enabled = true` habilita disparo. Cada envío evalúa el motor completo antes de llamar al `EmailProvider`.
  - Landing `/consent/[token]` en la web: aceptar → `consents(CONFIRMED)` → opcionalmente entra al flujo de newsletter.
  - Registro completo en `email_messages` + eventos en `email_events`.
- Móvil:
  - Interruptor `sending_enabled` en `/settings` con confirmación tipeada ("ACTIVAR ENVIO").
  - Banner permanente rojo en toda la app cuando está activado.
  - Métricas en tiempo real: enviados hoy / hora, quejas, rebotes.
  - Pausa automática si rebotes o quejas superan umbral configurable.
- Testing:
  - Unit del motor con matriz completa de combinaciones.
  - Integración: activar → encolar solicitud a contacto elegible → email en Mailpit → aceptar en landing → `CONFIRMED`.
  - Integración negativa: por cada regla, un test que la haga fallar y verifique que no se envía.
  - Chaos: superar `daily_send_limit` no envía la N+1.
  - Playwright: aceptar solicitud en `/consent/[token]`.
  - Maestro: cambiar interruptor con confirmación textual.

Criterio de aceptación: con `sending_enabled=true` el sistema envía solicitudes individuales respetando límites, todas las respuestas quedan registradas, y ninguna regla puede saltarse por configuración.

## Fase 7 — Dashboard, operación y refinamiento

- Dashboard con métricas y funnel completo (móvil).
- Purge jobs (retención descartados 180d, eventos 24m) via Vercel Cron.
- Export CSV de contactos con filtros.
- Alertas: umbrales de rebote/queja pausan envío automáticamente y notifican.
- `docs/operations.md` con runbook.

## Fase 8 — Futuro (solo bajo pedido explícito)

- Más providers de discovery.
- IA para clasificar/etiquetar artistas.
- Segmentación y personalización.
- Campañas de newsletter reales (fuera de la solicitud de consentimiento).
- Scoring.
- Analytics avanzados.
- Multi-tenant.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Se activa `sending_enabled` por error | Confirmación tipeada, banner permanente, auditoría, alerta al otro admin. |
| Un contacto pasa a `ELIGIBLE` sin revisión humana | Solo la pantalla de review lo escribe. Test que lo verifica. |
| Duplicados por variaciones | `email_normalized` generado + `unique`. Property tests. |
| Provider de discovery cambia sus términos | `compliance_status` revisable + job periódico de recheck. |
| Datos personales excesivos | Esquema Prisma no acepta teléfono/dirección; review de PRs. |
| Envío sin `text_version` congelado | Campo `not null` en Prisma + test. |
| Rebotes disparados por listas viejas | Suppression automática + pausa por umbral. |
| Divergencia de tipos entre apps | `packages/shared` fuente única + CI compara. |
| Landings públicas indexadas | `robots.txt` permite solo `/newsletter`; el resto `noindex`. |
| Cold start de API routes en Vercel | Prisma singleton + `runtime = 'nodejs'`; considerar Fluid/Edge según endpoint. |

## Fuera de alcance (explícito)

- Bypass de CAPTCHAs, anti-bot, rate limits.
- Compra de bases de datos.
- Envío masivo indiscriminado.
- Scraping de fuentes que lo prohíban.
- Recopilación de PII más allá del mínimo.

## Definición de "hecho" por feature

Una funcionalidad se marca como terminada solo si cumple:

1. Model con lógica de negocio y tests unit.
2. Controller con validación Zod y tests unit.
3. `route.ts` finísimo con test HTTP (Supertest).
4. Componentes en `packages/ui` (siguiendo Atomic Design) con snapshot web + RN.
5. Pantalla móvil / página web integradas usando esos componentes.
6. Test E2E del happy path (Maestro para móvil, Playwright para web).
7. Cobertura ≥ 90% en `src/models/` de la feature.
8. Cambios reflejados en `docs/` si tocan arquitectura, esquema o proceso.
9. CI verde en el PR.
10. Sin nuevos warnings de TS o linter.
