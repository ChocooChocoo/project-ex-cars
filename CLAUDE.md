# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                # dev server on :3000
npm run build              # next build
npm run check:fix          # biome: lint + format + organize imports, autofix (use this before committing)
npm run check              # same, report only
npm run generate:presets   # regenerate theme preset metadata into src/lib/preferences/theme.ts
```

No test framework is configured — there is no test runner, no test files. Don't invent one unless asked.

Husky `pre-commit` runs `generate:presets`, stages `src/lib/preferences/theme.ts`, then `lint-staged` (biome autofix on staged JS/TS). A biome error blocks the commit.

## Architecture

Next.js 16 App Router, React 19 + React Compiler (`reactCompiler: true`), Tailwind v4 (CSS-first, no tailwind config file), shadcn/ui, TypeScript strict. Alias `@/*` → `src/*`.

### Colocation routing

Routes live under `src/app/(main)/…`; each route folder owns its own `_components/`, and only genuinely shared UI goes to `src/components/`. `src/components/ui/` is shadcn-generated and **excluded from biome** — don't hand-format it, regenerate via shadcn instead. `/dashboard` redirects to `/dashboard/default` (next.config.mjs). `(legacy)` route group holds v1 dashboard variants kept for reference.

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
- Data in `src/data/` is mock/demo data — there is no backend or database in this template.
