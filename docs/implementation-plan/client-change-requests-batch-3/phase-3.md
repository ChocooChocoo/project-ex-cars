[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🔲 Not Started

# Phase 3: Sales Manager buying-request cleanup and delivery without a Mechanic

**Goal:** For CASH buys (GCE Visit, Halfway, Delivery), the Sales Manager has no Cancel, cannot add documents to the
buyer's request, and loses Buyer Declined once papers are requested. Deliveries no longer take a Mechanic.

Source: `docs/tasks/T05.md` (Sales Manager: buying requests; Sales Manager: transactions).

"CASH" in code = `DIRECT_PAYMENT_METHODS` (cash, bank_transfer, paymongo) in `src/lib/transactions/buy-flow.ts:14`.
Financing buys keep their current actions.

## Dependencies

- None

## Tasks

- [ ] `src/lib/transactions/state-machine.ts`: add `canSalesManagerCancel(tx)`. It returns false for a buy whose
  payment method is in `DIRECT_PAYMENT_METHODS`. Write the tests first.
- [ ] Use it in `transactions/[id]/_components/transaction-status-triage-v1.tsx:70, 132-148` (hide the Cancel tile
  before and after approval) and in `transitionTransaction` (`src/app/(staff)/transactions/actions.ts:49`, refuse on
  the server).
- [ ] Hide Buyer declined, Declined — Legit and Declined — Not Legit (`triage-v1.tsx:71-103`) when
  `sale_handovers.papers_status` is set and is not `returned`. Refuse the same case in `recordBuyerDecline`
  (`actions.ts:353`).
- [ ] `transactions/[id]/_components/transaction-documents-card.tsx:86-140`: hide the Valid ID / Proof of Billing
  upload for `sales_manager`. In `recordPaperwork` (`actions.ts:681`), refuse `valid_id` and `proof_of_billing` for
  `sales_manager`. Invoice and receipt uploads stay.
- [ ] `transactions/[id]/_components/delivery-panel.tsx:219-264`: remove the Mechanic select from the delivery team.
- [ ] `createDeliveryFieldCase` (`src/app/(staff)/transactions/delivery-actions.ts:208-269`): drop `mechanic_id` from
  the schema (:214), the active-mechanic check (:238), the insert (:246) and the notify (:256).
  `field_cases.mechanic_id` is already nullable, so no migration is needed.
- [ ] Field-case side: remove the delivery Mechanic from `DELIVERY_TEAM` (`src/app/(staff)/field-cases/delivery-actions.ts:21`),
  `field-cases/[id]/page.tsx`, and the delivery branch of `handover-actions.ts:180-218`. Meet Halfway keeps its
  Mechanic (`meetup-team-panel.tsx`, `missingContractCopies` in `buy-flow.ts:269-274`).
- [ ] Update the existing tests that expect Cancel for the Sales Manager or a Mechanic on a delivery.

## Done when

- [ ] Tests show that the Sales Manager cannot cancel a CASH buy, in the UI or on the server, and that financing buys
  are unchanged.
- [ ] Playwright MCP as the Sales Manager on a GCE Visit cash buy: no Cancel before or after approval, no document
  upload, and no Buyer declined after "Request papers release".
- [ ] Playwright MCP: the delivery team form shows only the Confidential Informant and Head Security, and the
  delivery field case is created.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
