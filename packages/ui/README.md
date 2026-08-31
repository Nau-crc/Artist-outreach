# @artist-outreach/ui

Sistema de diseño compartido siguiendo Atomic Design.

```
src/
├── tokens/      # colors, spacing, radius, typography
├── atoms/       # Button, Text, Input, Badge, Icon, Spinner
├── molecules/   # FormField, SearchBar, Card, StatusPill, EmptyState
├── organisms/   # ContactCard, ReviewQueueItem, EligibilityReport
└── templates/   # AdminScreen, PublicLanding
```

Cada componente exporta:

- `X.tsx` — variante web (Tailwind + HTML).
- `X.native.tsx` — variante React Native (NativeWind + primitives RN).
- `X.types.ts` — API pública compartida.
- `X.test.tsx` — tests para la variante web (Vitest + Testing Library).
- `index.ts`.

Metro (móvil) resuelve `.native.tsx` automáticamente. Next.js resuelve `.tsx`.

Los tokens son la única fuente de verdad de color, escala tipográfica y espaciado — se importan desde `@artist-outreach/config/tokens` y se propagan a Tailwind (web) y NativeWind (RN) vía preset.
