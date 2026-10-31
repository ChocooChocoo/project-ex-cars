[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)

**Status:** ✅ Done (2026-10-31, integration round).
`check:fix` / `tsc` / `test` / `build` suite are outside this phase's verification budget and remain open.

Status note (2026-10-31): implemented and verified as described below.

# Phase 7: Delivery fee ranges and 10% down payment

**Goal:** The buyer and the Sales Manager see the delivery fee range for the buyer's area, and the down payment is
fixed at 10% of the vehicle price.

Source: `docs/tasks/T05.md` (Sales Manager: customer profile and pricing; Constraints).

Ranges: CALABARZON free; Luzon ₱8,000–₱10,000; Visayas ₱10,000–₱15,000; Mindanao ₱15,000–₱20,000.

Decision (2026-10-29): the down payment is fixed at 10%, read-only, and computed on the server.

Assumptions:
- "DSS" = the Sales Manager's delivery-terms panel (`delivery-panel.tsx`). No component called DSS exists.
- The area comes from the buyer's profile region (Phase 6). The Sales Manager types the exact fee within the range.

Today: the delivery fee and the down payment are typed by hand (`transactions/[id]/_components/delivery-panel.tsx:155-203`,
`financing-panel.tsx:193-195`). No percentage exists in the code.

## Dependencies

- Phase 6 complete (`profiles.region_code` is saved)

## Tasks

- [x] `src/lib/transactions/delivery-fee.ts`: `deliveryArea(regionCode)` uses the first 2 digits of the PSGC code:
  CALABARZON 04; Luzon 01, 02, 03, 05, 13, 14, 17; Visayas 06, 07, 08 and NIR; Mindanao 09–12, 16, 19. Add
  `DELIVERY_FEE_RANGES` and `downPaymentFor(price) = Math.round(price * 0.1)`. Write the tests first.
- [x] `delivery-panel.tsx:155-203`: show "Price Range: ₱x – ₱y" beside the Delivery fee. CALABARZON locks the fee
  at 0. The down payment becomes read-only and shows `downPaymentFor(final_price)`.
- [x] `setDeliveryTerms` (`src/app/(staff)/transactions/delivery-actions.ts:101-204`): compute the down payment on
  the server and refuse a fee outside the range for the buyer's region. With no region on file, refuse with "Buyer
  has no region in their profile."
- [x] `financing-panel.tsx:193-195` and `proposeFinancingTerms` (`src/app/(staff)/transactions/financing-actions.ts:66-102`):
  down payment = `downPaymentFor(vehicle price)`, read-only and set on the server. The meet-up rule (:89) stays.
- [x] Buyer side, `src/app/(customer)/my-transactions/_components/transaction-detail.tsx:676-680, 859`: show the
  area's range before the fee is set, then the set fee.

## Implementation and verification (2026-10-31)

- `src/lib/transactions/delivery-fee.ts` holds the area map, the ranges, a fee-range check, the range label and
  `downPaymentFor`. `deliveryArea` reads the first two digits of `profiles.region_code`; a missing or unknown code
  answers `null`. Tests were written first (`delivery-fee.test.ts` failed on the missing module, then passed).
- `setDeliveryTerms` loads the buyer's `region_code`, refuses with "Buyer has no region in their profile." when it
  is empty, clamps a CALABARZON fee to 0, refuses a fee outside the range ("The delivery fee for Visayas is
  ₱10,000 – ₱15,000."), and writes `downpayment_amount = downPaymentFor(final_price)` from the vehicle price. The
  posted down payment is no longer read; the schema field was removed. A request with no vehicle price is refused
  with "Set the vehicle price first."
- `proposeFinancingTerms` drops the typed `down_payment` field and computes 10% of `purchase_details.final_price`
  on the server; a meet-up still takes 0, and the "below the vehicle price" rule stays. `financing-actions.test.ts`
  was updated for the new rule, including a test that a posted `down_payment` of 1 is ignored.
- Staff UI: `delivery-panel.tsx` shows "Price Range: …" under the delivery fee, renders "₱0 · Free in
  CALABARZON" instead of the fee input there, shows the down payment read-only as 10% of the vehicle price, and
  disables confirmation until the buyer has a region and the request has a price. `financing-panel.tsx` swaps the
  down payment input for the same read-only figure and shows the range beside the delivery fee. Both panels read
  the buyer's region from `profiles(region_code)` on the staff transaction page.
- Buyer UI: `my-transactions/[id]/page.tsx` reads the buyer's own `region_code`; the request form shows the range
  under the delivery-terms agreement line ("Delivery fee for your area: …", or a prompt to add a region), and the
  Delivery section shows the set fee with the 10% note and the area's range.
- Commands run:
  - `npx --no-install vitest run src/lib/transactions/delivery-fee.test.ts src/app/(staff)/transactions/delivery-terms.test.ts src/app/(staff)/transactions/financing-actions.test.ts`
    → 3 files, 31 tests passed (11, 6 and 14).
  - `npx --no-install biome check --write <changed files>` then `npx --no-install biome check <changed files>`
    → 12 files, no fixes needed on the second run.
- Not run, by the phase's verification budget: the Playwright walk-through, the repo-wide `npm run check:fix`,
  `npx tsc --noEmit`, the full `npm run test` and `npm run build`.
- Assumptions:
  - NIR (prefix 18) is Visayas. BARMM (15) is mapped to Mindanao as well: it is geographically Mindanao but the
    phase's list omits it, and the PSGC bundle in `public/psgc/` has no region 18 or 19, so 19 is mapped but
    unused today.
  - The vehicle price is `purchase_details.final_price`, the same figure the financing total builds on.
  - The fee range is refused on the cash delivery terms (`setDeliveryTerms`); on a financed delivery the fee is
    still typed in the financing terms, where the range is displayed but the Head Accountant and CEO approve it.

Integration verification (2026-10-31)

- Merged into `batch3/integration` as `e200249`. No migration needed.
- Browser as the buyer in Laguna (CALABARZON), on a pending delivery request: "Delivery fee for your area:
  Free delivery. The Sales Manager confirms the exact fee."
- Same buyer, profile changed through the UI to Central Visayas → Cebu → Alcantara → Cabadiangan and saved:
  the same request then read "Delivery fee for your area: ₱10,000 – ₱15,000". The profile was restored to
  CALABARZON → Laguna → City of Calamba → Bagong Kalsada afterwards.
- Browser as the Sales Manager on the approved cash delivery `e5499f32`: after answering the serviceability
  question, the panel showed "Delivery fee ₱0 · Free in CALABARZON", "Price Range: Free delivery" and a
  read-only "Down payment (10% of the vehicle price) ₱80,800.00" — exactly 10% of the ₱808,000 price.
- Unit coverage: `deliveryArea`, `DELIVERY_FEE_RANGES`, `feeWithinRange`, `downPaymentFor`, including the
  Visayas ₱9,000 refusal, plus delivery-terms and financing-actions suites (31 tests).
- Region mapping assumption: BARMM (15) is treated as Mindanao; NIR (18) as Visayas; prefix 19 does not
  exist in the PSGC bundle.

## Done when

- [x] The `deliveryArea`, range and `downPaymentFor` tests pass, including one that refuses a Visayas fee of ₱9,000.
- [ ] Playwright MCP: a buyer in Laguna sees free delivery, and a buyer in Cebu sees "₱10,000 – ₱15,000". Deferred:
  browser steps are outside this phase's verification budget.
- [ ] Playwright MCP: the Sales Manager sees the Price Range beside the delivery fee and a read-only 10% down
  payment. Deferred for the same reason.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass. Deferred: only the scoped
  vitest and biome runs above were allowed for this phase.

---

[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)
