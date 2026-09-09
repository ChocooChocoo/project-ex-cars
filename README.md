# Global Car Exchange (GCE)

A role-based vehicle marketplace platform: a public-facing customer shopping experience, an isolated supplier portal, and a staff dashboard covering sales, inspections, inquiries, transactions, payroll, finance records, field operations, and management reporting. Built on Next.js 16 and Supabase.

## Portals

| Portal | Route group | Who | Notes |
|---|---|---|---|
| Staff dashboard | `src/app/(staff)/` | CEO, Account Manager, Head Accountant, Confidential Informant, Marketing Specialist, Mechanic, Sales Manager, Head Security | Role-prefixed URLs (`/ceo/…`, `/mechanic/…`) are rewritten by middleware onto shared pages; access is filtered by `ROLE_NAV_ACCESS` in `src/lib/auth/roles.ts`, page-level role checks, action allowlists, and Supabase RLS |
| Customer portal | `src/app/(customer)/` | Customer | Showroom, Find Your Car (recommendations), inquiries chat, transactions, favourites, sell-vehicle, request-a-car |
| Supplier portal | `src/app/(supplier)/` | Supplier | Isolated overview (profile, documents, ID-verification progress) plus messages to the CEO; suppliers are staff-created and approved before first sign-in |
| Public/auth | `src/app/(external)/`, `src/app/auth/`, `src/app/unauthorized/` | — | The app is login-first; four auth screens under `/auth/v1` and `/auth/v2`; `src/app/template/**` holds publicly reachable upstream-template design previews that are not part of the product surface |

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19 + React Compiler, TypeScript strict
- **UI:** Tailwind CSS v4 (CSS-first), shadcn/ui
- **Backend:** Supabase (Postgres with row-level security, Auth, Storage, Realtime) — 43 SQL migrations in `supabase/migrations/`
- **State/forms:** Zustand, React Hook Form, Zod validation
- **Tooling:** Biome, Husky, Vitest, Playwright

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project (local or hosted) and the [Supabase CLI](https://supabase.com/docs/guides/cli) linked for migration pushes

### Setup

```bash
npm install
```

Configure `.env.local` (git-ignored) with:

```
NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your anon/publishable key>
# Optional, server-only: needed for admin seeding and some e2e specs
SUPABASE_SERVICE_ROLE_KEY=<service role key>
# Shared password for the seeded test accounts — quote it so trailing '#' is not treated as a comment
SEED_USER_PASSWORD="..."
```

Apply migrations and seed:

```bash
npx supabase db push            # or: npx supabase migration up
npm run seed:data               # demo data via scripts/seed-data.cjs
node --env-file=.env.local scripts/seed-users.cjs   # creates the ten test accounts (Admin API)
npx supabase db query --linked --file scripts/seed-roles.sql   # assigns their roles
```

Run the app:

```bash
npm run dev    # http://localhost:3000
```

The ten seeded accounts (one per role, e.g. `ceo@gce.local`, `supplier@gce.local`) and their landing pages are catalogued in [`docs/ANALYZER/AUDIT - GLOBAL CAR EXCHANGE/13 - USER ACCOUNTS.md`](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/13%20-%20USER%20ACCOUNTS.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` / `npm run format` | Biome lint / format |
| `npm run check` / `npm run check:fix` | Biome check, report only / autofix (run before committing) |
| `npm run generate:presets` | Regenerate theme preset metadata in `src/lib/preferences/theme.ts` |
| `npm run seed:data` | Seed demo data |
| `npm run test` / `npm run test:watch` | Vitest unit tests (jsdom), single run / watch mode |
| `npm run test:e2e` | Playwright e2e (requires dev server on :3000) |

Husky pre-commit runs `generate:presets`, stages `src/lib/preferences/theme.ts`, then `lint-staged` (Biome autofix). A Biome error blocks the commit — run `npm run check:fix` first.

## Architecture in one paragraph

Routes live directly under `src/app` in four groups (`(staff)`, `(customer)`, `(supplier)`, `(external)`) plus top-level `auth/`, `template/`, and `unauthorized/`; each route folder owns its `_components/`. Middleware resolves the signed-in role from the `gce-role` cookie and rewrites role-prefixed URLs onto shared internal pages (`src/lib/routing/paths.ts`). Authorization is layered: navigation filtering (`ROLE_NAV_ACCESS`), per-page role checks, per-action allowlists in `src/app/**/actions.ts`, and Postgres RLS across all public tables. Data access runs through server actions and `src/server/server-actions.ts`; `src/data/` contains mock/demo content only.

## Documentation

Start with [`docs/ANALYZER/00 - START HERE.md`](docs/ANALYZER/00%20-%20START%20HERE.md). The audit set compares the built system against the specification — in particular [13 - USER ACCOUNTS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/13%20-%20USER%20ACCOUNTS.md) (accounts, portals, access matrix), [15 - SYSTEM STATUS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/15%20-%20SYSTEM%20STATUS.md) (responsibility-by-responsibility implementation map), and [18 - MODULE PURPOSE OWNERSHIP AND ACTIONS](docs/ANALYZER/AUDIT%20-%20GLOBAL%20CAR%20EXCHANGE/18%20-%20MODULE%20PURPOSE%20OWNERSHIP%20AND%20ACTIONS.md) (plain-language module/action guide).
