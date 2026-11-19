# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                # dev server on :3000
npm run build:static       # export out/ and generate out/.htaccess (also npm run build)
npm run lint               # biome lint (report only)
npm run format             # biome format --write
npm run check              # biome check (report only)
npm run check:fix          # biome check --write: lint + format + organize imports (run before committing)
npm run generate:presets   # regenerate theme preset metadata into src/lib/preferences/theme.ts
npm run test               # vitest unit tests, single run (jsdom)
npm run test:watch         # vitest in watch mode
npm run test:e2e           # playwright e2e (requires dev server on :3000)
```

Tests are configured: Vitest unit tests (`npm run test`, jsdom environment, setup at `src/tests/setup.ts`) and Playwright e2e (`npm run test:e2e`, specs in `src/tests/e2e/`, requires the dev server on :3000). Run `check:fix` before tests; tests are not part of pre-commit.

Husky `pre-commit` runs `generate:presets`, stages `src/lib/preferences/theme.ts`, then `lint-staged` (biome autofix on staged JS/TS). A biome error blocks the commit.

## Architecture

Next.js 16 App Router, React 19 + React Compiler, Tailwind v4, shadcn/ui, and TypeScript strict. Alias `@/*` → `src/*`. The production frontend is a static export served by Apache on Hostinger Premium. Do not add Next.js Server Actions, route handlers, or pages that render per request.

The browser calls Laravel 13 (`backend/`) using `NEXT_PUBLIC_API_URL`. Laravel controls sessions via Sanctum, permissions via middleware and policies, and all writes to MySQL 8.4 or MariaDB 11.8. Chat and notifications poll Laravel. PayMongo webhooks go to `/api/v1/paymongo/webhook` on the Laravel origin; Laravel also owns verification and reset mail. Versioned schema changes live in `backend/database/migrations/`. `supabase/migrations/` is historical only.

### Colocation routing

Routes live under `src/app`: `(staff)` (eight staff roles plus Super Admin), `(customer)`, `(external)`, and top-level `auth`, `template`, and `unauthorized`. Each route owns its `_components/`; shared UI goes in `src/components/`. Regenerate `src/components/ui/` via shadcn rather than hand-formatting. The `(staff)/(legacy)` and `template` pages are design references.

`src/scripts/generate-htaccess.ts` generates Apache rules for role-prefixed paths (`/{role}/…`) and dynamic detail URLs. Dynamic pages export one `_` shell and read the real ID in the browser. `gce-role` is a routing hint, not authorization; client layouts check `/api/v1/me` and Laravel checks access on every protected request.

### Preferences system (theme, fonts, layout) — the core non-obvious piece

Every preference is expressed as a `data-*` attribute on `<html>`; CSS reacts to those attributes. Four layers must stay in sync:

1. `src/lib/preferences/preferences-config.ts` defines `PreferenceValueMap`, `PREFERENCE_DEFAULTS`, and `PREFERENCE_PERSISTENCE`.
2. `src/scripts/theme-boot.tsx` — inline `<script>` in `<head>` that reads cookies/localStorage and stamps the `data-*` attributes + `.dark` class before hydration. This is why `src/app/layout.tsx` can render `PREFERENCE_DEFAULTS` statically and stay fully static — no flicker, no per-request rerender.
3. `src/stores/preferences/` — zustand vanilla store + provider. The provider reads the already-stamped DOM back into the store on mount (`readDomState`) and owns the `system` theme media-query subscription.
4. `src/lib/preferences/preferences-storage.ts` — `persistPreference(key, value)` dispatches on the configured persistence mode.

A preference change from a UI control does three things: `setX()` on the store, `applyX()` from `theme-utils.ts` / `layout-utils.ts` to write the DOM attribute, and `persistPreference()`. See `theme-switcher.tsx` for the canonical pattern.

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
- `src/data/` is mock data. The Laravel seeders load demo rows and files from `backend/database/seeders/`.
- Uploads are limited to 2 MiB per file. Use `compressImage` or `compressFormFiles` from `src/lib/uploads/compress-image.ts` for photos; reject oversized PDFs. Laravel's `App\Services\FileService` checks size and content. Only showroom media and avatars use public storage. Private documents and attachments stay outside the web root and use short-lived signed download URLs.

## Local setup

Use native Node.js 24, PHP 8.4 with `pdo_mysql`, `intl` and `gd`, Composer 2, and MySQL 8.4. Create `gce` for local development and a separate `gce_test` for PHP tests.

1. Run `npm ci` at the repository root. Copy `.env.example` to `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.
2. In `backend/`, run `composer install`. Copy `.env.example` to `.env`, configure MySQL, and run `php artisan key:generate` for this new local environment only.
3. Set `SEED_USER_PASSWORD` in `backend/.env` to seed demo accounts. Set the same value in `.env.local` only if running the Playwright specs. Never commit either env file.
4. From `backend/`, run `php artisan migrate --database=mysql_migrations`, `php artisan db:seed`, and `php artisan storage:link`. Use `DB_MIGRATION_*` for a separate schema user; leave both blank if the app user also runs migrations.
5. Start `php artisan serve --host=localhost` from `backend/` and `npm run dev` from the root. Keep both browser origins on `localhost` for Sanctum. Use `php artisan test` with the isolated test database, and `php artisan schedule:work` and `php artisan queue:work` when testing background work.

## Hostinger

Build locally with `NEXT_PUBLIC_API_URL` pointing at the deployed Laravel API. Upload `out/`, including `.htaccess`. The API document root must point only to `backend/public`; keep `storage/` and `bootstrap/cache/` writable and `.env` outside the public root. Set `APP_DEBUG=false` and configure `FRONTEND_URL` and `SANCTUM_STATEFUL_DOMAINS` for the frontend origin. Keep the existing app key on redeploy. Leave Remote MySQL disabled.

On Hostinger, run `composer install --no-dev --optimize-autoloader --no-scripts`, then `php artisan package:discover`, `php artisan migrate --force`, `php artisan config:cache`, and `php artisan route:cache`. Run one-time demo seeding before caching config. One hPanel cron entry runs a shell script every minute: `php artisan schedule:run`, then `php artisan queue:work --stop-when-empty --max-time=50`. Use `Schedule::call`; Hostinger disables `proc_open` and `exec`.
