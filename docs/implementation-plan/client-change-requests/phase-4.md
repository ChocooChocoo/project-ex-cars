[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** 🔲 Not Started

# Phase 4: Real dashboard data

**Goal:** Every staff dashboard shows real system data in PHP instead of template values ($1,250.00, 1,234, 45,678,
4.5%) (G3), and the Marketing Specialist dashboard tables work (MS1).

## Dependencies

- Phase 1 complete (notification list already removed from `dashboard/page.tsx`).
- Phase 2 complete (final role list for which cards each role sees).

## Background

- All staff roles share `src/app/(staff)/dashboard/page.tsx`.
- Template data: `dashboard/_components/metric-cards.tsx` (`:20,41,62,83`), `performance-overview.tsx` (`chartValues`
  at `:26-60`), `subscriber-overview.tsx` + `data.json` + `recent-customers-table/` (mock Subscribed/Plan customers).
- Already real: `reconditioning-overview.tsx`, `phase6-overview.tsx` (CEO only, `page.tsx:27`).
- Decision (2026-10-26): the mock Subscribed/Plan customer table is removed, not rebuilt.

## Tasks

- [ ] Add `src/app/(staff)/dashboard/dashboard-data.ts` with server queries (Supabase server client, RLS applies):
  revenue this month and last month (sale records / verified payments), new customers in the last 30 days (profiles
  with role `customer`), active accounts (`account_state` active), and growth rate (this month vs last month revenue).
- [ ] Unit test the growth-rate and period helpers in `dashboard-data.test.ts` (zero last month, negative growth).
- [ ] `metric-cards.tsx`: take the values as props, format money with `formatCurrency`, remove the fake trend captions,
  replace the `DollarSign` icon.
- [ ] `performance-overview.tsx`: feed monthly sales totals for the last 12 months from `dashboard-data.ts`; remove `chartValues`.
- [ ] Delete `subscriber-overview.tsx`, `data.json` and `recent-customers-table/`; remove their use in `page.tsx`.
- [ ] Pick cards per role in `page.tsx` (e.g. revenue for CEO / Head Accountant, listings and inquiries for Marketing
  Specialist and Sales Manager) so no role sees numbers it cannot read under RLS.
- [ ] MS1: open the Marketing Specialist dashboard, list what is broken in its tables (record here), and fix each.
- [ ] Empty states: every card and chart shows a clear "No data yet" when the query returns nothing.

## Done when

- [ ] `grep -rnE "1,250\.00|45,678|1,234|18,426" src/app/(staff)/dashboard` returns nothing.
- [ ] Each staff dashboard shows numbers that match a direct SQL count/sum on the hosted Supabase project (check two
  cards per role).
- [ ] Money on the dashboard is shown with the ₱ sign.
- [ ] Marketing Specialist dashboard tables render rows from the database with no console errors.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` exits 0.
- [ ] Each role's dashboard walked with the Playwright MCP browser tools.

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
