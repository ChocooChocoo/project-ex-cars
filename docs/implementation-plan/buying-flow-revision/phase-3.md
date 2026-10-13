[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🔲 Not Started

# Phase 3: Contract

**Goal:** a contract is written, approved, signed and recorded as kept before money is recorded, papers are
handed over, or the car is marked sold.

## Tasks

- [ ] `src/lib/transactions/buy-flow.ts`: `needsContract(details)` (meet-up, delivery, all financing) and `contractReadyForSale(details, handover)` (signed, CI copy, plus the Mechanic's copy for a cash Meet Halfway), with tests.
- [ ] `src/app/(staff)/transactions/handover-actions.ts`: `saveContract` (Sales Manager; typed body or a template prefilled from `payment_terms`) and submit; `reviewContract` (Head Accountant: approve, or return with a reason).
- [ ] `src/app/(customer)/my-transactions/actions.ts`: `signContract` (buyer; only when `approved`; typed name and timestamp).
- [ ] `handover-actions.ts` field actions for the assigned team: `recordBuyerMet`, `recordContractCopy` (CI or Mechanic), `reportCashReceived`, `reportSigning` (CI; needs `buyer_met_at`; notifies the Sales Manager and the Head Accountant).
- [ ] `handPapersToBuyer`: require a signed contract, and `cash_reported_at` on cash and bank-transfer flows.
- [ ] `recordPayment` in `src/app/(staff)/transactions/actions.ts`: refuse while `needsContract` and the contract is unsigned.
- [ ] `transitionTransaction`: refuse `completed` unless `contractReadyForSale`.
- [ ] UI: contract editor and review in `handover-panel.tsx`; read and sign block in the customer `transaction-detail.tsx`; copy, Buyer Met and report buttons on the field case pages.

## Dependencies

- Phase 2 (`sale_handovers` table and `handover-actions.ts`).

## Done when

- [ ] Scenario 4: the buyer cannot sign an unapproved contract; a payment cannot be recorded before signing.
- [ ] Scenario 2: with only one of the Mechanic or the CI recording a copy, the case is not "fully kept", the Sales Manager is told who is missing, and Mark as Sold is refused.
- [ ] Scenario 3: the CI cannot hand over papers before the contract is signed or the cash is reported.
- [ ] `npm run test` passes.

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
