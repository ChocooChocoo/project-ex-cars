# Contributing to Global Car Exchange

Thanks for your interest in improving **Global Car Exchange (GCE)** — this guide covers environment setup and the conventions this repository expects.

---

## Overview

GCE is a role-based vehicle marketplace built with **Next.js 16** (App Router), **React 19**, **TypeScript strict**, **Tailwind CSS v4**, **shadcn/ui**, and a real **Supabase** backend (Postgres + RLS, Auth, Storage, Realtime). See `README.md` for the portal overview.

---

## Project Layout

Colocation-based: each feature keeps its own pages, components, and logic; only genuinely shared UI goes to `src/components/`.

```
src
├── app
│   ├── (staff)      # Staff dashboard routes (~40 folders; nested (staff)/(legacy) holds v1 variants, reference only)
│   ├── (customer)   # Customer shopping portal
│   ├── (supplier)   # Isolated supplier portal (overview + messages)
│   ├── (external)   # Public landing pages
│   ├── auth         # Four auth screens + sign-in/sign-up server actions
│   ├── template     # Upstream-template design previews — public, reference only, not product surface
│   └── unauthorized # Access-denied page
├── components       # Shared UI (src/components/ui is shadcn-generated — regenerate, don't hand-edit)
├── data             # Mock/demo content only — never production seed
├── lib              # Config & utilities (auth/roles.ts is the RBAC source of truth)
├── navigation       # Sidebar config (sidebar-items.ts)
└── server           # Shared server helpers / server-actions.ts
supabase/migrations  # 43 forward-only SQL migrations with RLS
scripts              # seed-data.cjs, seed-users.cjs, seed-roles.sql
docs                 # Specification, analysis, audit, and task documentation (start at docs/ANALYZER/00 - START HERE.md)
```

---

## Getting Started

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env.local` (git-ignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, optionally `SUPABASE_SERVICE_ROLE_KEY` for seeding/e2e, and `SEED_USER_PASSWORD` (quote it if it ends in `#`).
4. Apply migrations with the Supabase CLI (`npx supabase db push`) and seed demo data plus test accounts (`npm run seed:data`, then the two seed steps documented in `README.md`).
5. Run the dev server on [http://localhost:3000](http://localhost:3000):
   ```bash
   npm run dev
   ```

---

## Contribution Flow

- Create a branch before working: `git checkout -b feat/my-change`
- Use conventional commit prefixes (`feat:`, `fix:`, `chore:`).
- Run `npm run check:fix` before committing — Husky pre-commit runs theme-preset generation and Biome autofix on staged files, and a Biome error blocks the commit.
- Include tests for behavior changes: Vitest unit tests (`src/**/*.test.ts(x)`) and/or Playwright specs in `src/tests/e2e/`.
- Database changes are **forward-only migrations** in `supabase/migrations/`; every new table needs RLS enabled with explicit policies, and storage changes need bucket policies.

---

## Where to Contribute

- **Staff modules**: add routes under `src/app/(staff)/<module>/` with colocated `_components/`; register navigation in `src/navigation/sidebar/sidebar-items.ts` and grant it per role in `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS`). Enforce access with a page-level role check and an action-level allowlist.
- **Customer/supplier portals**: `src/app/(customer)/` and `src/app/(supplier)/`; keep supplier/customer isolation intact (layout guards redirect cross-role traffic).
- **Auth screens**: `src/app/auth/` (server actions in `src/app/auth/actions.ts`).
- **Shared UI**: `src/components/` (never hand-edit `src/components/ui/` — shadcn-generated).
- **Theme presets/fonts**: `src/styles/presets/` and `src/lib/fonts/registry.ts` (see CLAUDE.md for the four-layer preferences system).
- **Migrations**: `supabase/migrations/` following the existing naming scheme.

---

## Guidelines

- Prefer real TypeScript types over `any`; the compiler runs strict.
- Follow Tailwind v4 CSS-first and shadcn/ui conventions; keep accessibility in mind (ARIA, keyboard nav).
- Respect the RBAC layering — navigation filtering, page checks, action allowlists, and RLS must all agree with the access matrix in `docs/ANALYZER/AUDIT - GLOBAL CAR EXCHANGE/13 - USER ACCOUNTS.md`.
- Keep documentation honest: update the relevant `docs/` pages when behavior changes rather than leaving stale claims.

---

## Questions

Open an issue or raise questions with the project maintainers.
