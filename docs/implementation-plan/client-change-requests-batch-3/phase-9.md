[← Previous: Phase 8](./phase-8.md)

**Status:** 🔲 Not Started

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

- [ ] Migration `supabase/migrations/<timestamp>_t05_vehicle_identifiers.sql` (+ `.test.ts`): add
  `vehicles.plate_number`, `engine_number` and `chassis_number` (text, nullable).
- [ ] Add the 3 inputs to `src/app/(staff)/vehicles/_components/vehicle-form.tsx` and its validation schema.
- [ ] `src/lib/papers/templates.ts`: the Deed of Sale text and the draft Policy & Warranty text in one file. Export
  the GCE seller name from `buy-flow.ts` (today a literal inside `contractTemplate`) and reuse it. Write a unit test
  for the fill first.
- [ ] Print pages `src/app/(staff)/vehicle-papers/[transactionId]/deed-of-sale/page.tsx` and
  `.../policy-warranty/page.tsx`, for the CI and CEO. Use the print CSS and a `window.print()` button like
  `src/app/(staff)/invoice/_components/print-invoice.tsx`.
- [ ] Deed fields: buyer `profiles.full_name` and `address`; vehicle make, model, year, color, plate, engine and
  chassis (fallback `vin`); `purchase_details.final_price`; date. Missing values print as `________`. The warranty
  adds `vehicles.warranty_details`.

## Done when

- [ ] The template fill test passes: a missing plate prints as a blank line, and the buyer name is the transaction's
  customer.
- [ ] Playwright MCP: the CI opens both print pages from the 3-dot menu. The data matches the transaction, and the
  print preview fits Letter size.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 8](./phase-8.md)
