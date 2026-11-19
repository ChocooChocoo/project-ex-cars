# Contributing to Global Car Exchange

Thanks for your interest in improving **Global Car Exchange (GCE)** — this guide covers environment setup and the conventions this repository expects.

---

## Overview

GCE is a role-based vehicle marketplace built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, and Laravel 13 with MySQL/MariaDB. See `README.md` for the portal overview.

---

## Project Layout

Colocation-based: each feature keeps its own pages, components, and logic; only genuinely shared UI goes to `src/components/`.

```
src
├── app
│   ├── (staff)      # Staff dashboard routes (~40 folders; nested (staff)/(legacy) holds v1 variants, reference only)
│   ├── (customer)   # Customer shopping portal
│   ├── (external)   # Public landing pages
│   ├── auth         # Auth screens and browser API adapters
│   ├── template     # Upstream-template design previews — public, reference only, not product surface
│   └── unauthorized # Access-denied page
├── components       # Shared UI (src/components/ui is shadcn-generated — regenerate, don't hand-edit)
├── data             # Mock/demo content only — never production seed
├── lib              # Config & utilities (auth/roles.ts is the RBAC source of truth)
└── navigation       # Sidebar config (sidebar-items.ts)
backend              # Laravel API, migrations, seeders and backend tests
supabase/migrations  # Historical schema, not used at runtime
scripts              # Static build and developer utilities
docs                 # Specification, analysis, audit, and task documentation (start at docs/ANALYZER/00 - START HERE.md)
```

---

## Getting Started

Follow [Local setup](CLAUDE.md#local-setup) to run the frontend and API with a local MySQL demo database.

---

## Contribution Flow

- Create a branch before working: `git checkout -b feat/my-change`
- Use conventional commit prefixes (`feat:`, `fix:`, `chore:`).
- Run `npm run check:fix` before committing — Husky pre-commit runs theme-preset generation and Biome autofix on staged files, and a Biome error blocks the commit.
- Include tests for behavior changes: Vitest unit tests (`src/**/*.test.ts(x)`) and/or Playwright specs in `src/tests/e2e/`.
- Add schema changes in `backend/database/migrations/` and enforce access in Laravel policies and middleware.

---

## Where to Contribute

- **Staff modules**: keep components with their route under `src/app/(staff)/`. Update sidebar navigation and page role checks, and enforce access in Laravel.
- **Customer portal**: `src/app/(customer)/`. Keep the customer-only layout guard and Laravel policy checks for customer endpoints.
- **Auth screens**: `src/app/auth/`; browser adapters call Laravel.
- **Shared UI**: `src/components/` (never hand-edit `src/components/ui/` — shadcn-generated).
- **Theme presets/fonts**: `src/styles/presets/` and `src/lib/fonts/registry.ts` (see CLAUDE.md for the four-layer preferences system).

---

## Guidelines

- Prefer real TypeScript types over `any`; the compiler runs strict.
- Follow Tailwind v4 CSS-first and shadcn/ui conventions; keep accessibility in mind (ARIA, keyboard nav).
- Keep navigation and page checks aligned with Laravel authorization. Browser checks do not grant access.
- Keep documentation honest: update the relevant `docs/` pages when behavior changes rather than leaving stale claims.

---

## Questions

Open an issue or raise questions with the project maintainers.
