[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)

**Status:** 🔲 Not Started

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

- [ ] `src/lib/transactions/delivery-fee.ts`: `deliveryArea(regionCode)` uses the first 2 digits of the PSGC code:
  CALABARZON 04; Luzon 01, 02, 03, 05, 13, 14, 17; Visayas 06, 07, 08 and NIR; Mindanao 09–12, 16, 19. Add
  `DELIVERY_FEE_RANGES` and `downPaymentFor(price) = Math.round(price * 0.1)`. Write the tests first.
- [ ] `delivery-panel.tsx:155-203`: show "Price Range: ₱x – ₱y" beside the Delivery fee. CALABARZON locks the fee
  at 0. The down payment becomes read-only and shows `downPaymentFor(final_price)`.
- [ ] `setDeliveryTerms` (`src/app/(staff)/transactions/delivery-actions.ts:101-204`): compute the down payment on
  the server and refuse a fee outside the range for the buyer's region. With no region on file, refuse with "Buyer
  has no region in their profile."
- [ ] `financing-panel.tsx:193-195` and `proposeFinancingTerms` (`src/app/(staff)/transactions/financing-actions.ts:66-102`):
  down payment = `downPaymentFor(vehicle price)`, read-only and set on the server. The meet-up rule (:89) stays.
- [ ] Buyer side, `src/app/(customer)/my-transactions/_components/transaction-detail.tsx:676-680, 859`: show the
  area's range before the fee is set, then the set fee.

## Done when

- [ ] The `deliveryArea`, range and `downPaymentFor` tests pass, including one that refuses a Visayas fee of ₱9,000.
- [ ] Playwright MCP: a buyer in Laguna sees free delivery, and a buyer in Cebu sees "₱10,000 – ₱15,000".
- [ ] Playwright MCP: the Sales Manager sees the Price Range beside the delivery fee and a read-only 10% down payment.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 6](./phase-6.md) | [Next: Phase 8 →](./phase-8.md)
