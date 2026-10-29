[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** ✅ Done (user accepted the e2e result on 2026-10-28; open e2e failures are listed under the last Done-when
item as separate follow-up work). Committed as `a63b3d5` on local branch `fix/auth-batch2-phase-1` (not pushed).

> 2026-10-28: Started. User decisions: Financing keeps `payment_method = 'financing'` (many flow checks use it); the new
> `payment_option` column stores `full`/`financing`, and the Payment Method select is hidden for Financing. Full Payment
> by PayMongo behaves like Cash, so the migration also allows `paymongo` on `purchase_details` (missing from the task
> list below).
>
> 2026-10-28 (later): All tasks done and verified except the e2e run. **Blocked:** `customer@gce.local` no longer
> signs in (`Invalid login credentials` with both `GCEtest123!@#` and `SEED_USER_PASSWORD`; it worked at 16:26 UTC and
> its auth row changed at 16:58 UTC, likely another session). Every buying e2e spec signs in as that account. Browser
> checks used `e2e.walkin.p7@gce.local` instead.

# Phase 3: Payment option, method and financing

**Goal:** The buy form has a Payment Option (Full Payment or Financing) and a Payment Method (Cash, Bank Transfer or
PayMongo). Financing adds 10% to the car's price and offers 6, 12, 24, 36 or 60 months. Cheque and the customer "Final
Price" input are removed, and a GCE Visit no longer asks for a location (P2–P7).

Decisions: financing adds a flat 10% for every period. HA2 payment proof photos stay; they also cover deposit slips.

## Dependencies

- None inside this plan

## Tasks

- [x] Migration `supabase/migrations/<ts>_t04_payment_option.sql`:
  - Add `purchase_details.payment_option TEXT CHECK (payment_option IN ('full','financing'))`, backfilled from
    `payment_method` (`financing` → `financing`, everything else → `full`).
  - Update `cheque` rows to `bank_transfer` in `purchase_details` and `payment_records`.
  - Rebuild both `payment_method`/`method` CHECKs without `cheque` (current ones are in `00048` and `00061`).
  - Widen the `requested_term_months` CHECK (`00059`) to `(6,12,24,36,60)`.
  > 2026-10-28: `supabase/migrations/20261028100000_t04_payment_option.sql`. Also allows `paymongo` on
  > `purchase_details` (user decision). `npx supabase db push --dry-run` showed only this file; pushed. Verified on the
  > linked DB: the 4 new constraints are live; purchase_details is financing/financing 76, full/cash 169,
  > full/bank_transfer 15 (11 + 4 former cheque), full/down_payment 4; payment_records bank_transfer 98 (93 + 5 cheque).
- [x] Migration test `<ts>_t04_payment_option.test.ts`. Update `00061_...test.ts:13`, which asserts `'cheque'`.
  > 2026-10-28: `20261028100000_t04_payment_option.test.ts` (6 tests, incl. the app's `PAYMENT_METHODS` matching the new
  > CHECK). The `00061` test is left as is: it checks the 00061 file, which still (correctly) lists cheque. The `00048`
  > test compared the app list to the 00048 CHECK; it now asserts the historic 00048 list, and the app-list check moved
  > to the T04 test.
- [x] **P4:** Remove `cheque` from `src/lib/transactions/state-machine.ts:18`, `src/lib/validation/transactions.ts:120`,
  `src/lib/transactions/labels.ts:29`, `src/lib/transactions/buy-flow.test.ts:95` and `scripts/seed-data.cjs`
  (956, 1053, 1068).
  > 2026-10-28: Done; `PAYMENT_METHODS` gains `paymongo`. The seed now picks bank_transfer/paymongo and sets
  > `payment_option`.
- [x] **P4:** Remove the Cheque option and copy from `transaction-detail.tsx:544`, `transaction-detail-sidebar-v1.tsx:324`,
  the "Photo of cheque / deposit slip" label (`:361`, becomes "Photo of deposit slip / receipt"),
  `transaction-payments-table-v1.tsx:155` and `src/app/(customer)/buying-requirements/page.tsx:26,39`.
  > 2026-10-28: Done, plus two code comments and the cheque wording in two staff test files, so the grep is empty.
  > Buying requirements now describe Full Payment / Financing (+10%, 6-60 months) and Cash / Bank Transfer / PayMongo.
- [x] **P3:** Remove the customer "Final Price (₱)" input and its state from
  `src/app/(customer)/my-transactions/_components/transaction-detail.tsx` (269, 370, 555-563). Keep the `final_price`
  column; `saveBuyDetails` already falls back to `vehicle.current_price` (`actions.ts:236-237`).
  > 2026-10-28: Input, state and the `final_price` schema field removed; `saveBuyDetails` always saves the Showroom
  > price. Browser: no Final Price label; saved `final_price = 1000000` for a ₱1,000,000 car.
- [x] **P5:** Split the customer select into "Payment Option" (Full Payment / Financing) and "Payment Method" (Cash /
  Bank Transfer / PayMongo). Add `payment_option` to the zod schema and save it in `saveBuyDetails`.
  > 2026-10-28: `#payment_option` (default Full Payment) and `#payment_method` (hidden for Financing). Server: Financing
  > saves method `financing`; Full Payment with `financing` is refused; a form without the option derives it from the
  > method. `paymongo` added to `DIRECT_PAYMENT_METHODS` (treated like Cash); the delivery note says "through PayMongo".
- [x] **P6:** Add `financedTotal(price) = round(price * 1.10)` in `src/lib/transactions/buy-flow.ts`. Use it in the
  customer estimate and as the default `total_amount` in `proposeFinancingTerms`
  (`src/app/(staff)/transactions/financing-actions.ts`).
  > 2026-10-28: `financedTotal` + `FINANCING_TERM_MONTHS` in `buy-flow.ts`. The customer form shows "Total with
  > financing" and the monthly estimate from it. `proposeFinancingTerms` defaults a blank total to
  > `financedTotal(final_price)` (`loadFinancing` now selects `final_price`); the staff panel prefills it and the field
  > is labelled "Total with financing (₱)" (e2e selectors updated).
- [x] **P7:** Offer 6, 12, 24, 36 and 60 months for every financing arrangement, not only meet-ups: zod
  (`validation/transactions.ts:28-32`), UI (`transaction-detail.tsx:618-640`) and the server check (`actions.ts:229-230`).
  > 2026-10-28: The term select shows for every financing arrangement; the server requires and saves it for any
  > financing.
- [x] **P2:** Hide the Location input (`transaction-detail.tsx:672-680`) when the arrangement is `gce_visit`. Save
  `location: null` for `gce_visit` in `saveBuyDetails` (`actions.ts:259`); today the customer's address is saved.
  > 2026-10-28: Done. Browser: Location hidden for GCE Visit, shown for Meet-up.
- [x] Unit tests: `financedTotal`, term options, GCE Visit saving a null location, and `payment_option` saved.
  > 2026-10-28: `buy-flow.test.ts` (financedTotal, terms, PayMongo like Cash), `buy-request-phase4.test.ts` (4 cases),
  > `financing-actions.test.ts` (default total). Written first; 7 failed before the change.

## Done when

- [x] `grep -rni cheque src scripts` returns no matches outside migrations.
  > 2026-10-28: No output (exit 1).
- [x] `npm run test` passes, including the new cases.
  > 2026-10-28: 98 files, 626 tests pass. `npx tsc --noEmit` clean; biome clean on changed files (seed-data.cjs has
  > older lint errors on lines not touched here); `npm run build` OK.
- [x] In the browser, a ₱1,000,000 car with Financing shows a ₱1,100,000 total and offers all 5 periods.
  > 2026-10-28: Playwright MCP, test car `d409a314-…` (₱1,000,000), transaction `109ae34d-…`: "Total with financing:
  > ₱1,100,000.00"; terms 6 months / 1 / 2 / 3 / 5 years; 6 months shows about ₱183,333.33 a month; the method select
  > is hidden. Saving Financing + 6 months stored `financing` / `financing` / 6.
- [x] A GCE Visit request submits with no Location field shown, and the saved arrangement has `location = null`.
  > 2026-10-28: Full Payment + Cash + GCE Visit saved; DB: `payment_option=full`, `payment_method=cash`, arrangement
  > `gce_visit` with `location = null`. Methods offered: Cash, Bank Transfer, PayMongo.
  > Staff and copy, live (view only, nothing saved): as `sales_manager@gce.local` on approved financing request
  > `8d06f64c-…` (₱1,580,000), "Total with financing (₱)" is prefilled with 1738000; Record Payment offers Cash and
  > Bank Transfer; the photo field reads "Photo of deposit slip / receipt (optional)"; no "cheque" anywhere on the page.
  > `/buying-requirements` lists Full Payment / Financing (+10%, 6-60 months) and Cash / Bank Transfer / PayMongo.
- [x] Buying e2e specs in `src/tests/e2e/` pass (`npm run test:e2e`). *Accepted by the user with known failures, see
  below.*
  > 2026-10-28: **Blocked**, not run. The specs sign in as `customer@gce.local`, which now gets
  > `Invalid login credentials` (see the status note). Helper `support/t01.ts` and specs updated for the new selects.
  > 2026-10-28 (later): `customer@gce.local` reset to the test password (user approved). `npm run test:e2e` alone skips
  > every spec (Playwright does not load `.env.local`); ran
  > `node --env-file=.env.local node_modules/@playwright/test/cli.js test buying-revision t01-phase2 t01-phase3
  > t01-phase4 t01-phase5 t01-phase6 t02-client-feedback`: **35 passed, 7 failed, 7 did not run** (serial follow-ups),
  > 60 min. `t01-phase5-financing` passed all 7 steps (Financing option + term, "Total with financing (₱)", approvals,
  > downpayment, sold). Every failure is after the buy-form step, in areas this phase did not change:
  > 1. `buying-revision-phase1` time rules: the spec never ticks the delivery "I agree" box, so the last save is refused.
  > 2–3. `buying-revision-phase4` Scenario 8, `buying-revision-phase5` Scenario 5: the Verify button count does not drop
  >    after clicking Verify on a buyer document.
  > 4. `t01-phase2-onsite-visit` approve: the "Two verified valid IDs…" message never shows.
  > 5. `t01-phase4-branches` unserviceable address: the Upload button is gone after the proof-of-billing upload.
  > 6. `t01-phase5-branches` repossession: no Approve button in the "Reconditioning fund" row (disbursement buttons now
  >    open in a window, T03 HA4).
  > 7. `t01-phase6-bank-transfer` §7: "Papers requested from the Confidential Informant." never shows (the bank
  >    transfer payment step before it passed).
  > Not yet proven to fail without this phase's changes (no run on the previous commit). Left open.
  > Baseline (git worktree at `5904e15`, no Phase 3, its own specs): same 7 files gave 12 passed, 4 failed, 5 not run.
  > Failing there too, so not caused by this phase: #1 phase1 time rules, #3 phase5 Scenario 5, #7 bank transfer §7.
  > Passed on the baseline but failed here: #2 phase4 Scenario 8, #4 onsite approve, #5 unserviceable address (all in
  > the document upload/Verify step, which this phase does not touch). #6 repossession did not run on the baseline; the
  > baseline also failed `t01-phase5-branches` "terms returned…" at Submit Request, which passed here, so these specs
  > are flaky. Re-run of those 4 files with Phase 3: inconclusive. A first attempt was stopped for low memory; the
  > second failed the first test of every file at "Buy Now" with no page snapshot (page never loaded; 2 GB free memory).
  > 2026-10-28: User accepted (option 1). The Phase 3 flow itself passed end to end (`t01-phase5-financing`, 7/7).
  > Follow-up, outside this phase: fix the old failures (#1 phase1 spec never ticks the delivery "I agree" box; #3
  > phase5 Scenario 5; #7 bank transfer §7 "Papers requested" message; #6 disbursement Approve moved into a window) and
  > re-check the flaky document-step specs (#2, #4, #5) on a machine with more free memory. Run e2e with
  > `node --env-file=.env.local node_modules/@playwright/test/cli.js test`; `npm run test:e2e` alone skips every spec.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
