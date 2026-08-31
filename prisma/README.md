# Prisma

Fuente única del esquema: `schema.prisma`. Migraciones autogeneradas en `migrations/`.

Comandos:

```bash
pnpm db:generate    # generar client tras cambios de schema
pnpm db:migrate     # crear + aplicar migración en dev
pnpm db:deploy      # aplicar migraciones pendientes en prod (usado por CI)
pnpm db:studio      # UI para inspeccionar la DB local
pnpm db:seed        # datos de ejemplo
```

Los triggers, RLS y `check` constraints no expresables en Prisma se añaden con migraciones SQL manuales `xxxx_triggers.sql` a partir de la fase 2 (ver `docs/database.md`).
