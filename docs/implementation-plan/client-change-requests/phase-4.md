[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** ✅ Done

Completed 2026-10-26.

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

- [x] `src/app/(staff)/dashboard/dashboard-summary.ts`: pure `summarizeDashboard()` and `percentChange()` (months in
  Asia/Manila). `dashboard-data.ts`: `getDashboardData(role)` reads the rows (service role, paged past the 1000-row
  limit) and calls it.
  - Completed sales this month vs last month (`transactions.completed_at`, state `completed`).
  - New customers: customers whose first transaction opened in the last 30 days, vs the 30 days before. Customer
    roles live in the private schema, so customers are counted from transactions.
  - Active customers: distinct customers with a pending, under-review or approved transaction.
  - Payments received this month vs last month: `payment_records` verified by staff (amount in pesos; date =
    `paid_at`, else `settlement_date`, else `created_at`). See notes for why not `financial_entries`.
  - 12-month series of completed sales and new customers.
- [x] Unit tests `dashboard-summary.test.ts` (9 cases: change %, Manila month boundary, new/previous customers, active
  customers, payments, series, empty data).
- [x] `metric-cards.tsx` takes the summary; money via `formatCurrency` (₱); fake trend captions removed; change badge
  only when there is a previous value to compare with.
- [x] `performance-overview.tsx` renamed in the UI to "Sales and Customers", fed the 12-month series; template data,
  fake period/segment selects and "View report" button removed; empty state "No sales or new customers in the last
  12 months."; sales drawn in `--primary`, new customers as a dashed `--chart-2` line (readable in light and dark).
- [x] Deleted `subscriber-overview.tsx`, `data.json` and `recent-customers-table/` (the mock Subscribed/Plan table).
- [x] Cards per role: CEO, Head Accountant, Account Manager and Sales Manager (the roles allowed to read finance
  entries) see "Payments Received This Month"; every other staff role sees "Available Vehicles" in that slot.
- [x] MS1: the Marketing Specialist dashboard's broken table was the mock customers table; it is gone and the page
  now shows the four real cards and the chart. The Reconditioning table stays hidden for this role because it has no
  Inspections access (its links would be refused).
- [x] Empty states: the chart shows a message; cards show 0 / ₱0 rather than an error.

## Done when

- [x] `grep -rnE "1,250\.00|45,678|1,234|18,426" src/app/(staff)/dashboard` returns nothing.
- [x] Dashboard numbers match direct queries on the hosted Supabase project: completed sales Oct 55 / Sep 8, active
  customers 3, available vehicles 17, payments Oct ₱11,606,700 / Sep ₱1,182,500 (all identical on the page).
- [x] Money on the dashboard is shown with the ₱ sign.
- [x] Marketing Specialist dashboard renders real data with no mock table.
- [x] `npm run test` passes (76 files, 508 tests), `npx tsc --noEmit` exits 0, biome on touched files is clean,
  `npm run build` compiles.
- [x] Each role's dashboard walked with the Playwright MCP browser tools (CEO, Head Accountant, Account Manager,
  Sales Manager, Marketing Specialist, Mechanic, Confidential Informant, Head Security).

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | `dashboard-summary.test.ts` failed (module missing); payments case failed before the source switch |
| `npm run test` | 76 files, 508 tests passed |
| `npx tsc --noEmit` / biome / `npm run build` | exit 0 / clean / compiled |
| Placeholder grep | no matches |
| Direct queries vs page | identical (see Done when) |
| Finance roles (MCP) | Payments ₱11,606,700 (+882%), Sales 55 (+588%), New customers 1 (−50%), Active 3 |
| Other staff roles (MCP) | Available vehicles 17 in place of payments; other three cards the same |
| Chart (MCP) | light and dark screenshots readable; Y axis labels no longer clipped |
| Mock content (MCP) | "18,426", "Subscribed", "$1,250" absent on every role |

Screenshots: `test-results/mcp-phase4-*.png`.

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| CEO, SM, HA, AM | Payments Received This Month (₱11,660,199, then ₱11,662,421 after a ₱2,222 test payment was verified), Completed Sales 55, New Customers 1, Active 3 | pass |
| Marketing Specialist | Available Vehicles 17 in place of payments; other three cards the same | pass |
| Mock content | "18,426", "Subscribed", "$1,250" absent on every role checked | pass |
| Chart | Light and dark screenshots readable, axis labels not clipped | pass |

Screenshots: `test-results/live-phase4-chart-*.png`.

## Notes

- First walk showed "Revenue This Month ₱0" while the CEO overview showed ₱18.4M. Cause: `financial_entries`
  (revenue) is the manual finance ledger, seeded for July and August only; sale payments are stored in
  `payment_records`. The card now reads verified payments and is labelled "Payments Received This Month". The CEO's
  existing "Revenue (Verified)" card in the Operations Overview still reads `financial_entries` and was not changed.
- Numbers are company-wide and read with the service role, so every role sees the same totals (row-level rules would
  give each role a different partial count). The page itself stays limited to staff roles.
- The dev data includes many e2e test transactions, which is why October shows 55 completed sales.
- `ponytail:` aggregation runs in JS over all transaction rows; move to a SQL view if transactions grow large.

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
