# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────
# Stage 1 — builder: instala deps + build.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl bash
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Copiar manifests primero para cachear pnpm install.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile --prefer-offline

# Ahora el resto del código fuente.
COPY . .

# Los EXPO_PUBLIC_* se leen en build time por el bundle Expo.
# Vienen de --build-arg (docker-compose los mapea desde .env.production).
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 1. Prisma client.
# 2. Bundle Expo Web (SPA admin).
# 3. Copiar bundle a public/admin.
# 4. Next build (output: standalone).
RUN pnpm --filter @artist-outreach/web exec prisma generate --schema=../../prisma/schema.prisma && \
    pnpm --filter @artist-outreach/mobile build:web && \
    mkdir -p apps/web/public && \
    rm -rf apps/web/public/admin && \
    cp -r apps/mobile/dist apps/web/public/admin && \
    pnpm --filter @artist-outreach/web build:web-only

# ─────────────────────────────────────────────────────────────
# Stage 2 — runner: imagen mínima.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next standalone: server.js + node_modules mínimos, respetando el
# layout del monorepo (raíz = /repo → aquí /app).
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public            ./apps/web/public

# Prisma CLI + schema para poder ejecutar `prisma migrate deploy` en runtime.
COPY --from=builder --chown=nextjs:nodejs /repo/prisma                      ./prisma
COPY --from=builder --chown=nextjs:nodejs /repo/node_modules/prisma         ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /repo/node_modules/@prisma        ./node_modules/@prisma

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
