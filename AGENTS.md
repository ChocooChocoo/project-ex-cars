# AGENTS.md

## Commands

```bash
npm run dev                # dev server on :3000
npm run build              # next build
npm run check:fix          # biome lint + format + organize imports (run before committing)
npm run check              # same, report only
npm run generate:presets   # regenerate src/lib/preferences/theme.ts from CSS presets
npm run test               # vitest unit tests (jsdom)
npm run test:e2e           # playwright e2e (requires dev server on :3000)
```

Pre-commit hook: `generate:presets` → `git add src/lib/preferences/theme.ts` → `lint-staged` (biome autofix). A biome error blocks the commit — run `check:fix` first.

## Stack

Next.js 16 App Router, React 19 + React Compiler, Tailwind v4 (CSS-first, no config file), shadcn/ui, TypeScript strict, Supabase. Alias `@/*` → `src/*`.

## Route groups

- `src/app/(staff)/` — 40+ staff dashboard routes
- `src/app/(customer)/` — customer-facing routes (showroom, sell-vehicle, etc.)
- `src/app/(external)/` — public landing pages
- `src/app/(legacy)/` — deprecated v1 dashboard, kept for reference only

Routes are colocated: each route folder owns its `_components/`. Shared UI goes in `src/components/`. `src/components/ui/` is shadcn-generated — excluded from biome, don't hand-format.

## Preferences system (theme, fonts, layout)

Every preference is a `data-*` attribute on `<html>`; CSS reacts to those. Four layers:

- `src/lib/preferences/preferences-config.ts` — source of truth (keys, types, defaults, persistence modes)
- `src/scripts/theme-boot.tsx` — inline `<script>` in `<head>`, stamps attributes before hydration
- `src/stores/preferences/` — zustand store + provider, reads DOM back on mount
- `src/lib/preferences/preferences-storage.ts` — persists changes per configured mode

A preference update: `setX()` on store, `applyX()` on DOM, `persistPreference()`. See `theme-switcher.tsx` for pattern.
Adding a preference touches all four layers + CSS that reads the attribute.

## Biome conventions

- Kebab-case filenames enforced
- Import group order: react → next → packages → `@/` → relative
- Line width 120, double quotes, semicolons, trailing commas
- `noImportCycles` is an error; `noFloatingPromises`/`noMisusedPromises` are errors

## Supabase

Real backend with 39+ migrations in `supabase/migrations/`. Tables use RLS extensively. Server-side data access through `src/server/server-actions.ts`. The `supabase` CLI must be configured locally to push migrations.

## Tests

- Vitest: `npm run test`, jsdom environment, setup at `src/tests/setup.ts`
- Playwright: `npm run test:e2e`, test files in `src/tests/e2e/`, requires dev server
- Run `check:fix` before tests; tests are not run in pre-commit

## Key non-obvious facts

- `src/data/` contains mock/demo data — do not treat as production seed
- `src/components/ui/` is shadcn regeneration zone — never manually edit
- `src/lib/preferences/theme.ts` contains a `// --- generated:themePresets:start ---` block — never hand-edit, use `npm run generate:presets`
- `CONTRIBUTING.md` is stale (references old template paths), trust the source code over it
