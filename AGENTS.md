# AGENTS.md

## Commands

```bash
npm run dev                # dev server on :3000
npm run build              # next build
npm run start              # serve the production build
npm run lint               # biome lint (report only)
npm run format             # biome format --write
npm run check:fix          # biome lint + format + organize imports (run before committing)
npm run check              # same, report only
npm run generate:presets   # regenerate src/lib/preferences/theme.ts from CSS presets
npm run seed:data          # seed demo data (.env.local required)
npm run test               # vitest unit tests (jsdom)
npm run test:watch         # vitest watch mode
npm run test:e2e           # playwright e2e (requires dev server on :3000)
```

Pre-commit hook: `generate:presets` → `git add src/lib/preferences/theme.ts` → `lint-staged` (biome autofix). A biome error blocks the commit — run `check:fix` first.

## Stack

Next.js 16 App Router, React 19 + React Compiler, Tailwind v4 (CSS-first, no config file), shadcn/ui, TypeScript strict, Supabase. Alias `@/*` → `src/*`.

## Route groups

- `src/app/(staff)/` — staff dashboard routes (~40 route folders; includes the nested `src/app/(staff)/(legacy)/` group of deprecated v1 dashboard variants, kept for reference only)
- `src/app/(customer)/` — customer shopping portal (showroom, recommendations, inquiries, transactions, favourites, sell-vehicle, request-a-car)
- `src/app/(supplier)/` — isolated supplier portal (overview + messages; suppliers are staff-created and approval-gated)
- `src/app/(external)/` — public landing pages
- Top-level non-grouped routes: `src/app/auth/` (four auth screens), `src/app/unauthorized/`, and `src/app/template/` (upstream-template design previews — `src/proxy.ts` skips them, so they are publicly reachable; reference only, not GCE product surface)

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

Real backend with 43 migrations in `supabase/migrations/` (numbered `00001`–`00039` with no `00008`, plus five timestamped task migrations such as `20260818052430_task30_rbac_management.sql`). Tables use RLS extensively. Server-side data access through `src/server/server-actions.ts` and server actions colocated as `src/app/**/actions.ts`. The `supabase` CLI must be configured locally to push migrations.

## Tests

- Vitest: `npm run test`, jsdom environment, setup at `src/tests/setup.ts`
- Playwright: `npm run test:e2e`, test files in `src/tests/e2e/`, requires dev server
- Run `check:fix` before tests; tests are not run in pre-commit

## Key non-obvious facts

- `src/data/` contains mock/demo data — do not treat as production seed
- `src/components/ui/` is shadcn regeneration zone — never manually edit
- `src/lib/preferences/theme.ts` contains a `// --- generated:themePresets:start ---` block — never hand-edit, use `npm run generate:presets`
- `CONTRIBUTING.md` was retargeted from the upstream template to this project on 10 August 2026 — verify any newly added guidance there against the source code
