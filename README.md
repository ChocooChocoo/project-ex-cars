# Global Car Exchange (GCE)

A role-based vehicle marketplace with a customer portal and a staff dashboard, built on Next.js 16, Laravel 13, and MySQL/MariaDB.

## Portals

| Portal | Route group | Who | Notes |
|---|---|---|---|
| Staff dashboard | `src/app/(staff)/` | Eight staff roles and Super Admin | Apache maps role-prefixed URLs (`/ceo/…`, `/mechanic/…`) to shared static pages. Laravel enforces access. |
| Customer portal | `src/app/(customer)/` | Customer | Showroom, Find Your Car (recommendations), inquiries chat, buy/sell transactions, favourites, sell-vehicle |
| Public/auth | `src/app/(external)/`, `src/app/auth/`, `src/app/unauthorized/` | — | The app is login-first; four auth screens under `/auth/v1` and `/auth/v2`; `src/app/template/**` holds publicly reachable upstream-template design previews that are not part of the product surface |

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19 + React Compiler, TypeScript strict
- **UI:** Tailwind CSS v4 (CSS-first), shadcn/ui
- **Backend:** Laravel 13 with Sanctum sessions, MySQL/MariaDB, and private file storage. See `backend/database/migrations/`.
- **State/forms:** Zustand, React Hook Form, Zod validation
- **Tooling:** Biome, Husky, Vitest, Playwright

## Getting Started

Follow [Local setup](CLAUDE.md#local-setup) for Node.js, PHP, Composer and MySQL. Run Next.js on `localhost:3000` and Laravel on `localhost:8000`. The Laravel demo seed accounts are defined in `backend/database/seeders/UserSeeder.php`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm run build:static` | Build the Apache static export in `out/` |
| `npm run lint` / `npm run format` | Biome lint / format |
| `npm run check` / `npm run check:fix` | Biome check, report only / autofix (run before committing) |
| `npm run generate:presets` | Regenerate theme preset metadata in `src/lib/preferences/theme.ts` |
| `php artisan db:seed` (in `backend/`) | Load demo rows and files |
| `npm run test` / `npm run test:watch` | Vitest unit tests (jsdom), single run / watch mode |
| `npm run test:e2e` | Playwright e2e (requires dev server on :3000) |

Husky pre-commit runs `generate:presets`, stages `src/lib/preferences/theme.ts`, then `lint-staged` (Biome autofix). A Biome error blocks the commit — run `npm run check:fix` first.

## Architecture in one paragraph

Next.js exports React pages and Apache serves them without Node.js. The browser reads and writes data through Laravel, which owns authorization, payments, files, and scheduled jobs. Chat and notifications use polling. `src/data/` contains mock content only.

## Documentation

Start with [`docs/ANALYZER/00 - START HERE.md`](docs/ANALYZER/00%20-%20START%20HERE.md). The audit set compares the built system against the specification — in particular [13 - USER ACCOUNTS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/13%20-%20USER%20ACCOUNTS.md) (accounts, portals, access matrix), [15 - SYSTEM STATUS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/15%20-%20SYSTEM%20STATUS.md) (responsibility-by-responsibility implementation map), and [18 - MODULE PURPOSE OWNERSHIP AND ACTIONS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/18%20-%20MODULE%20PURPOSE%20OWNERSHIP%20AND%20ACTIONS.md) (plain-language module/action guide).
