# Artist Outreach

CRM de descubrimiento de artistas y solicitud de consentimiento con double opt-in.

Ver [docs/architecture.md](docs/architecture.md), [docs/database.md](docs/database.md), [docs/roadmap.md](docs/roadmap.md).

## Quickstart

```bash
# Requisitos: Node >= 20.11, pnpm >= 9, Docker
corepack enable
pnpm install

# Levantar Postgres + Mailpit
docker compose up -d

# Prisma
cp .env.example .env
pnpm db:generate
pnpm db:migrate

# Dev
pnpm dev
```

Apps:

- **`apps/web`** — Next.js 16, sirve landings públicas y toda la API (MVC). Vercel.
- **`apps/mobile`** — Expo (React Native), CRM mobile-first. EAS.

Packages:

- **`packages/ui`** — Atomic Design (tokens/atoms/molecules/organisms/templates), variantes web y RN.
- **`packages/shared`** — enums, value objects, schemas Zod, transiciones de estado.
- **`packages/config`** — presets ESLint, Tailwind, tsconfig, tokens.

## Restricciones

**El envío outbound de emails está deshabilitado por defecto** y solo se activa manualmente tras validación jurídica. Ver [docs/architecture.md](docs/architecture.md) §"Lo que la aplicación NO hará".
