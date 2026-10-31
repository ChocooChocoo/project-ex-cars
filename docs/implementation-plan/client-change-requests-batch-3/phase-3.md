[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🔶 In progress — 2026-10-31: all tasks implemented and unit-verified; Playwright and the repo-wide checks are deferred to the integration round under the batch verification budget.

# Phase 3: Sales Manager buying-request cleanup and delivery without a Mechanic

**Goal:** For CASH buys (GCE Visit, Halfway, Delivery), the Sales Manager has no Cancel, cannot add documents to the
buyer's request, and loses Buyer Declined once papers are requested. Deliveries no longer take a Mechanic.

Source: `docs/tasks/T05.md` (Sales Manager: buying requests; Sales Manager: transactions).

"CASH" in code = `DIRECT_PAYMENT_METHODS` (cash, bank_transfer) in `src/lib/transactions/buy-flow.ts:41`.
`paymongo` is a channel (`payment_records.method`), not a purchase method, and `down_payment` is legacy (see
Assumptions). Financing buys keep their current actions.

## Dependencies

- None

## Tasks

- [x] `src/lib/transactions/state-machine.ts`: add `canSalesManagerCancel(tx)`. It returns false for a buy whose
  payment method is in `DIRECT_PAYMENT_METHODS`. Write the tests first.
- [x] Use it in `transactions/[id]/_components/transaction-status-triage-v1.tsx:70, 132-148` (hide the Cancel tile
  before and after approval) and in `transitionTransaction` (`src/app/(staff)/transactions/actions.ts:49`, refuse on
  the server).
- [x] Hide Buyer declined, Declined — Legit and Declined — Not Legit (`triage-v1.tsx:71-103`) when
  `sale_handovers.papers_status` is set and is not `returned`. Refuse the same case in `recordBuyerDecline`
  (`actions.ts:353`).
- [x] `transactions/[id]/_components/transaction-documents-card.tsx:86-140`: hide the Valid ID / Proof of Billing
  upload for `sales_manager`. In `recordPaperwork` (`actions.ts:681`), refuse `valid_id` and `proof_of_billing` for
  `sales_manager`. Invoice and receipt uploads stay.
- [x] `transactions/[id]/_components/delivery-panel.tsx:219-264`: remove the Mechanic select from the delivery team.
- [x] `createDeliveryFieldCase` (`src/app/(staff)/transactions/delivery-actions.ts:208-269`): drop `mechanic_id` from
  the schema (:214), the active-mechanic check (:238), the insert (:246) and the notify (:256).
  `field_cases.mechanic_id` is already nullable, so no migration is needed.
- [x] Field-case side: remove the delivery Mechanic from `DELIVERY_TEAM` (`src/app/(staff)/field-cases/delivery-actions.ts:21`),
  `field-cases/[id]/page.tsx`, and the delivery branch of `handover-actions.ts:180-218`. Meet Halfway keeps its
  Mechanic (`meetup-team-panel.tsx`, `missingContractCopies` in `buy-flow.ts:269-274`).
- [x] Update the existing tests that expect Cancel for the Sales Manager or a Mechanic on a delivery.

### Verification note — 2026-10-31

- Tests were written first and watched fail (16 failures across the 7 new/changed suites, all for the missing
  guard, prop or Mechanic removal; `canSalesManagerCancel is not a function` included).
- `npx --no-install vitest run` on 15 files — `state-machine`, `sales-manager-cash`,
  `transaction-status-triage-v1`, `transaction-documents-card`, `delivery-panel`, `delivery-team`,
  `recent-transactions-table/columns`, `delivery-location`, `handover-actions`, `papers-gates`, `meetup-team`,
  `actions.task33`, `field-cases/[id]/page.access`, `transaction-detail-sidebar-v1`,
  `transaction-payments-table-v1` — 135/135 passed, 0 failed.
- `npx --no-install biome check --write` on the 27 changed source and test files — no fixes applied on the final run.
- Changed: `src/lib/transactions/state-machine.ts` (+test), `transactions/actions.ts`,
  `transaction-status-triage-v1.tsx` (+test), `transaction-documents-card.tsx` (+test),
  `staff-transaction-detail.tsx`, `delivery-panel.tsx` (+test), `delivery-actions.ts` (+test),
  `transactions/page.tsx`, `recent-transactions-table/{columns,schema}.ts(x)` (+test), `field-cases/delivery-actions.ts`,
  `field-cases/[id]/page.tsx`, `handover-actions.ts`, `delivery-location.test.ts`, and the delivery picks in five e2e
  specs.
- Not run under the batch verification budget: Playwright MCP, `npx tsc --noEmit`, full `npm run test`,
  `npm run build`, `npm run check:fix`. The e2e specs were updated but not executed.

### Assumptions

- CASH is `DIRECT_PAYMENT_METHODS` (`cash`, `bank_transfer`). `paymongo` is a channel and a `payment_records.method`
  value, not a purchase method, so it is not added. The 3 legacy `down_payment` buys keep the current Sales Manager
  actions: that method is deprecated and is not one of the CASH arrangements in the plan.
- "Papers requested" means `papers_status` is set and is not `returned`, per the task wording. That includes the field
  arrangements, where the CI releases the papers; a no-show / "Buyer unavailable" stays available.
- The recent-transactions menu is a second Cancel entry point, so it hides Cancel for the same cash buys; the server
  guard remains the enforcement for any direct action call.
- `field_cases.mechanic_id` is already nullable, so no migration was added and no database was touched.

## Done when

- [x] Tests show that the Sales Manager cannot cancel a CASH buy, in the UI or on the server, and that financing buys
  are unchanged.
- [ ] Playwright MCP as the Sales Manager on a GCE Visit cash buy: no Cancel before or after approval, no document
  upload, and no Buyer declined after "Request papers release".
- [ ] Playwright MCP: the delivery team form shows only the Confidential Informant and Head Security, and the
  delivery field case is created.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
