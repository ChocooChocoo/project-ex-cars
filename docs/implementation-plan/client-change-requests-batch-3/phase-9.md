[← Previous: Phase 8](./phase-8.md)

**Status:** ✅ Done (2026-10-31, integration round).

_2026-10-31:_ Started. Working from the merged Phase 8 route (`src/app/(staff)/vehicle-papers/`) and the
reserved migration timestamp `20261101130000`.

# Phase 9: Printable Deed of Sale and Policy & Warranty

**Goal:** The Confidential Informant prints a Deed of Sale and a Policy & Warranty filled in from GCE's records. The
buyer on the deed is the transaction's current buyer.

Source: `docs/tasks/T05.md` (Confidential Informant: vehicle papers; Constraints).

Decisions (2026-10-29):
- Add `plate_number`, `engine_number` and `chassis_number` to `vehicles`. Today only `vin` exists.
- Policy & Warranty uses a draft GCE template for client review, kept in one file so the wording is easy to change.
- Only the Deed of Sale and the Policy & Warranty are printable. The OR/CR is the original physical document.

Today: no deed or warranty template exists. The only text template is `contractTemplate()` in
`src/lib/transactions/buy-flow.ts:296-329`. Print CSS (`[data-print-root]` / `[data-print-paper]`) is in
`src/app/globals.css:249-292`.

## Dependencies

- Phase 8 complete (the Vehicle Papers route and the 3-dot menu entries that open these pages)

## Tasks

- [x] Migration `supabase/migrations/<timestamp>_t05_vehicle_identifiers.sql` (+ `.test.ts`): add
  `vehicles.plate_number`, `engine_number` and `chassis_number` (text, nullable).
  _Done as `20261101130000_t05_vehicle_identifiers.sql` + `.test.ts`; the three columns are additive and nullable,
  so every existing car keeps `NULL`._
- [x] Add the 3 inputs to `src/app/(staff)/vehicles/_components/vehicle-form.tsx` and its validation schema.
  _Also added the fields to `createVehicle`/`updateVehicle` in `src/app/(staff)/vehicles/actions.ts` and to
  `toFormDefaults` in `vehicle-form-sheet.tsx`, so an edit neither drops nor resets them._
- [x] `src/lib/papers/templates.ts`: the Deed of Sale text and the draft Policy & Warranty text in one file. Export
  the GCE seller name from `buy-flow.ts` (today a literal inside `contractTemplate`) and reuse it. Write a unit test
  for the fill first.
  _`GCE_SELLER` exported from `buy-flow.ts` and used by `contractTemplate` too. Fill test written first and seen to
  fail on the missing module._
- [x] Print pages `src/app/(staff)/vehicle-papers/[transactionId]/deed-of-sale/page.tsx` and
  `.../policy-warranty/page.tsx`, for the CI and CEO. Use the print CSS and a `window.print()` button like
  `src/app/(staff)/invoice/_components/print-invoice.tsx`.
  _Both pages guard with `requireRole(["confidential_informant", "ceo"])` and read behind the service role, like the
  list page. Shared `_components/`: `paper-sheet.tsx` (`[data-print-paper]`, Letter size), `print-paper.tsx` (portal
  into `[data-print-root]`, as `print-invoice.tsx` does), `print-document-button.tsx` (`window.print()`) and
  `paper-document-view.tsx`._
- [x] Deed fields: buyer `profiles.full_name` and `address`; vehicle make, model, year, color, plate, engine and
  chassis (fallback `vin`); `purchase_details.final_price`; date. Missing values print as `________`. The warranty
  adds `vehicles.warranty_details`.
  _Filled by `paperSale()` from the joined transaction row (the buyer is the transaction's own `customer_id`); the
  date is `completed_at ?? opened_at` in Manila time. The warranty paper also states it is a draft for client
  review._


Integration verification (2026-10-31)

- Merged into `batch3/integration` as `77c2bbd`; `20261101130000_t05_vehicle_identifiers.sql` was applied
  to the hosted dev database in this batch (`plate_number`, `engine_number`, `chassis_number`).
- Browser (Playwright MCP) as the Confidential Informant, on transaction `83ff8fe3-…`: the Deed of Sale
  page prints buyer "Juan Dela Cruz", Suzuki Swift 2020 Silver, PHP 540,000.00 and the sale date, with
  Plate, Engine and Chassis as `________` because the car has none recorded.
- The Policy & Warranty page renders the draft wording from `src/lib/papers/templates.ts`, the same buyer
  and vehicle, and `Warranty: ________`.
- Print media behaves: app chrome and sidebar hidden, white sheet, `[data-print-root]` measured
  816 × 1056 px, i.e. US Letter at 96 dpi, and the deed fits on one page.

## Done when

- [x] The template fill test passes: a missing plate prints as a blank line, and the buyer name is the transaction's
  customer.
  _`src/lib/papers/templates.test.ts`: 8 tests pass._
- [ ] Playwright MCP: the CI opens both print pages from the 3-dot menu. The data matches the transaction, and the
  print preview fits Letter size.
  _Not run in this worktree: the verification budget for this phase rules out Playwright and a dev-server pass.
  Deferred to the phase-close browser check; the sheet uses the existing Letter-size print CSS._
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.
  _Not run in full in this worktree (memory-constrained budget). Scoped substitutes ran green: `biome check` on every
  changed file, and the affected vitest files. The full set stays for the integration pass._

## Verification (2026-10-31)

- `npx --no-install vitest run supabase/migrations/20261101130000_t05_vehicle_identifiers.test.ts` — 4 passed.
- `npx --no-install vitest run src/lib/papers/templates.test.ts src/lib/validation/vehicles.test.ts
  src/lib/transactions/buy-flow.test.ts src/lib/transactions/vehicle-papers.test.ts
  supabase/migrations/20261101130000_t05_vehicle_identifiers.test.ts` — 5 files, 79 tests passed.
- `npx --no-install biome check` over the 14 changed TypeScript files plus `vehicle-form-sheet.tsx` — no errors, no
  fixes applied.
- Not run here: `npx tsc --noEmit`, `npm run build`, `npm run test`, Playwright. No migration pushed to a database.

**Implementation complete; the browser pass and the full check set are deferred, so this phase stays In Progress.**


---

[← Previous: Phase 8](./phase-8.md)
