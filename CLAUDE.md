# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                # dev server on :3000
npm run build              # next build
npm run start              # serve the production build
npm run lint               # biome lint (report only)
npm run format             # biome format --write
npm run check              # biome check (report only)
npm run check:fix          # biome check --write: lint + format + organize imports (run before committing)
npm run generate:presets   # regenerate theme preset metadata into src/lib/preferences/theme.ts
npm run seed:data          # seed demo data (.env.local required)
npm run test               # vitest unit tests, single run (jsdom)
npm run test:watch         # vitest in watch mode
npm run test:e2e           # playwright e2e (requires dev server on :3000)
```

Tests are configured: Vitest unit tests (`npm run test`, jsdom environment, setup at `src/tests/setup.ts`) and Playwright e2e (`npm run test:e2e`, specs in `src/tests/e2e/`, requires the dev server on :3000). Run `check:fix` before tests; tests are not part of pre-commit.

Husky `pre-commit` runs `generate:presets`, stages `src/lib/preferences/theme.ts`, then `lint-staged` (biome autofix on staged JS/TS). A biome error blocks the commit.

## Architecture

Next.js 16 App Router, React 19 + React Compiler (`reactCompiler: true`), Tailwind v4 (CSS-first, no tailwind config file), shadcn/ui, TypeScript strict. Alias `@/*` → `src/*`.

### Colocation routing

Routes live directly under `src/app` in four groups — `(staff)` (dashboard for the eight staff roles), `(customer)`, `(supplier)`, `(external)` — plus top-level `src/app/auth/`, `src/app/template/`, and `src/app/unauthorized/`. Each route folder owns its own `_components/`, and only genuinely shared UI goes to `src/components/`. `src/components/ui/` is shadcn-generated and **excluded from biome** — don't hand-format it, regenerate via shadcn instead. v1 dashboard variants live in a nested group at `src/app/(staff)/(legacy)/`. `/dashboard*` is redirected by `src/proxy.ts` (`next.config.mjs`'s `redirects()` is empty) to role-prefixed paths (`/{role}/…`) resolved by `src/lib/routing/paths.ts` from the `gce-role` cookie set at sign-in. `src/app/template/**` holds upstream-template preview routes that `src/proxy.ts` skips entirely — publicly reachable design references, not part of the GCE product surface.

### Preferences system (theme, fonts, layout) — the core non-obvious piece

Every preference is expressed as a `data-*` attribute on `<html>`; CSS reacts to those attributes. Four layers must stay in sync:

1. `src/lib/preferences/preferences-config.ts` — single source of truth: `PreferenceValueMap` (key → type), `PREFERENCE_DEFAULTS`, `PREFERENCE_PERSISTENCE` (per key: `client-cookie` | `server-cookie` | `localStorage` | `none`). Keys in `LAYOUT_CRITICAL_KEYS` (`sidebar_variant`, `sidebar_collapsible`) are type-forbidden from `localStorage` because SSR reads them.
2. `src/scripts/theme-boot.tsx` — inline `<script>` in `<head>` that reads cookies/localStorage and stamps the `data-*` attributes + `.dark` class before hydration. This is why `src/app/layout.tsx` can render `PREFERENCE_DEFAULTS` statically and stay fully static — no flicker, no per-request rerender.
3. `src/stores/preferences/` — zustand vanilla store + provider. The provider reads the already-stamped DOM back into the store on mount (`readDomState`) and owns the `system` theme media-query subscription.
4. `src/lib/preferences/preferences-storage.ts` — `persistPreference(key, value)` dispatches on the configured persistence mode.

A preference change from a UI control does three things: `setX()` on the store, `applyX()` from `theme-utils.ts` / `layout-utils.ts` to write the DOM attribute, and `persistPreference()`. See `theme-switcher.tsx` for the canonical pattern.

Server side, layout-critical prefs are read with `getPreference(key, allowedValues, fallback)` from `src/server/server-actions.ts` (validates against the allowed list) — used in the dashboard layout to pass sidebar `variant`/`collapsible` into `AppSidebar`.

Adding a preference means touching all four layers plus the option list in `layout.ts`/`theme.ts` and the CSS that reads the attribute in `globals.css`.

### Theme presets

Each preset is one CSS file in `src/styles/presets/` overriding CSS variables under `:root[data-theme-preset="x"]` and `.dark:root[data-theme-preset="x"]`, with a header comment carrying `label:` and `value:`. The `default` preset has no file — it's the base `:root` / `.dark` blocks in `src/app/globals.css`.

Adding a preset: create the CSS file (header comment required), `@import` it in `globals.css`, then run `npm run generate:presets`. That script scrapes labels/values/`--primary` and rewrites the block between `// --- generated:themePresets:start ---` and `:end ---` in `src/lib/preferences/theme.ts`. **Never edit that block by hand.**

### Fonts

`src/lib/fonts/registry.ts` registers every `next/font` instance and derives `fontVars` (all CSS variables, applied to `<body>`) and `fontOptions`. Selection works by `html[data-font="key"] body { font-family: … }` rules in `globals.css` — adding a font means registry entry + matching CSS rule.

### Navigation

`src/navigation/sidebar/sidebar-items.ts` is a typed config array (`NavGroup` → `NavMainItem`, discriminated on `url` vs `subItems`). Sidebar UI renders from it; add routes here, not in the sidebar components.

## Conventions

- Biome enforces `useFilenamingConvention` (kebab-case), sorted Tailwind classes, no floating/misused promises, no import cycles, and a fixed import group order (react → next → packages → `@/` aliases → relative). Run `npm run check:fix` rather than fighting it manually.
- Line width 120, double quotes, semicolons, trailing commas, 2-space indent.
- Prefer real types over `any`; conventional commit prefixes (`feat:`, `fix:`, `chore:`).
- Data in `src/data/` is mock/demo data — do not treat as production seed. The real backend is Supabase: 43 migrations in `supabase/migrations/` with RLS throughout; server access goes through server actions (`src/app/**/actions.ts`) and `src/server/server-actions.ts`.
