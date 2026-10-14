[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** ✅ Done (2026-10-14, not committed)

# Phase 3: Contract

**Goal:** a contract is written, approved, signed and recorded as kept before money is recorded, papers are
handed over, or the car is marked sold.

## Tasks

- [x] `src/lib/transactions/buy-flow.ts`: `needsContract(details)` (meet-up, delivery, all financing) and `contractReadyForSale(details, handover)` (signed, CI copy, plus the Mechanic's copy for a cash Meet Halfway), with tests.
- [x] `src/app/(staff)/transactions/handover-actions.ts`: `saveContract` (Sales Manager; typed body or a template prefilled from `payment_terms`) and submit; `reviewContract` (Head Accountant: approve, or return with a reason).
- [x] `src/app/(customer)/my-transactions/actions.ts`: `signContract` (buyer; only when `approved`; typed name and timestamp).
- [x] `handover-actions.ts` field actions for the assigned team: `recordBuyerMet`, `recordContractCopy` (CI or Mechanic), `reportCashReceived`, `reportSigning` (CI; needs `buyer_met_at`; notifies the Sales Manager and the Head Accountant).
- [x] `handPapersToBuyer`: require a signed contract, and `cash_reported_at` on cash and bank-transfer flows.
- [x] `recordPayment` in `src/app/(staff)/transactions/actions.ts`: refuse while `needsContract` and the contract is unsigned.
- [x] `transitionTransaction`: refuse `completed` unless `contractReadyForSale`.
- [x] UI: contract editor and review in `handover-panel.tsx`; read and sign block in the customer `transaction-detail.tsx`; copy, Buyer Met and report buttons on the field case pages.

## Dependencies

- Phase 2 (`sale_handovers` table and `handover-actions.ts`).

## Done when

- [x] Scenario 4: the buyer cannot sign an unapproved contract; a payment cannot be recorded before signing.
- [x] Scenario 2: with only one of the Mechanic or the CI recording a copy, the case is not "fully kept", the Sales Manager is told who is missing, and Mark as Sold is refused.
- [x] Scenario 3: the CI cannot hand over papers before the contract is signed or the cash is reported.
- [x] `npm run test` passes.

## Decisions (owner, 2026-10-14)

- **Two signing paths.** Financing at a GCE visit or a meet-up (Scenarios 4, 5, 8): the Sales Manager writes, the Head Accountant approves, the buyer signs in the app. Cash meet-up, cash delivery and financing delivery (Scenarios 2, 3, 9): the buyer signs the printed contract on site and the assigned CI's "Report contract signed" marks it signed.
- **Payments allowed before signing.** On a delivery only: the delivery fee, the reschedule fee and the downpayment. Every other payment is refused until the contract is signed.

## What was built beyond the task list

- `buy-flow.ts`: also `signsInApp`, `missingContractCopies`, `paymentAllowedBeforeSigning`, `contractTemplate`, `CONTRACT_STATE_LABELS`; `paysDirect` is now exported as `isDirectPayment`.
- `src/components/contract-progress.tsx`: one list of what has been recorded (buyer met, signed, signing reported, copies, payment reported), used on the staff request page and on the field case. It carries the "not fully kept, still to record a copy" line.
- The buyer's sign block is its own component, `contract-sign.tsx`, rendered from `transaction-detail.tsx`.
- The field buttons are one card, `field-cases/[id]/_components/contract-card.tsx`, on the delivery and the buyer meet-up case.
- `signContract` has its own test file, `sign-contract.test.ts` (the mocks in `actions.test.ts` do not cover the service role).

## Verification (2026-10-14)

| Check | Result |
| --- | --- |
| `npm run test` | 60 files, 409 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the 20 touched files | no findings |
| `npm run build` | exit 0 |
| `playwright test buying-revision-phase3` (dev server on :3000, hosted Supabase) | 3 of 3 passed (8.6 min) |
| Impeccable detector on the four changed UI files | no findings |

Unit tests for the rules, the staff and field actions and the two gates were written first and seen to fail (6, 18 and 5 failures), then pass. The `signContract` tests were written together with the action and were not seen red.

Playwright does not load `.env.local` by itself. The run used:
`node --env-file=.env.local node_modules/@playwright/test/cli.js test buying-revision-phase3`.

What `src/tests/e2e/buying-revision-phase3.spec.ts` walks in the browser:

1. **Scenario 4, financing at a GCE visit.** After the buyer books the visit there is no Sign button, and a downpayment is refused with "The buyer must sign the contract before a payment is recorded." The Sales Manager starts from the pre-made contract (it carries PHP 500,000) and sends it; the buyer still has nothing to sign. The Head Accountant returns it with a reason (the button is disabled without one); the Sales Manager sees the reason and resends; the Head Accountant approves. The buyer reads it, signs with a typed name, and the downpayment is then recorded.
2. **Scenario 2, cash Meet Halfway.** The CI releases the papers, records Buyer Met, reports the signing and records his copy. The case and the request both show "The signed contract is not fully kept. Still to record a copy: Mechanic.", the Sales Manager has a notification saying so, and Mark as Sold is refused with "The Mechanic has not recorded keeping the signed contract." After the Mechanic records his copy the car is marked sold.
3. **Scenario 3, cash delivery.** The delivery fee and the downpayment are recorded before delivery; the balance is refused. After delivery, "Hand papers to buyer" is refused before the signing, refused again until the payment is reported, then accepted. Mark as Sold is refused until the CI records his copy.

Screenshots (desktop and 390px): `test-results/phase3-*.png`.

## Files changed

- New: `src/components/contract-progress.tsx`
- New: `src/app/(customer)/my-transactions/_components/contract-sign.tsx`, `sign-contract.test.ts`
- New: `src/app/(staff)/field-cases/[id]/_components/contract-card.tsx`
- New: `src/tests/e2e/buying-revision-phase3.spec.ts`
- Changed: `src/lib/transactions/buy-flow.ts`, `buy-flow.test.ts`
- Changed: `src/app/(staff)/transactions/handover-actions.ts`, `handover-actions.test.ts`, `actions.ts`, `papers-gates.test.ts`
- Changed: `src/app/(staff)/transactions/[id]/page.tsx`, `_components/handover-panel.tsx`, `_components/staff-transaction-detail.tsx`
- Changed: `src/app/(staff)/field-cases/[id]/page.tsx`, `_components/delivery-case.tsx`, `_components/buyer-meetup-case.tsx`
- Changed: `src/app/(customer)/my-transactions/actions.ts`, `[id]/page.tsx`, `_components/transaction-detail.tsx`

No migration: the columns came with 00058 in Phase 2.

## Assumptions

- The buyer's typed name is kept in the request's history ("Contract signed by <name>"); there is no column for it.
- A payment tied to a monthly installment is never blocked by the contract check, so financing accounts opened before this phase keep working.
- Buyer Met can be recorded by the assigned CI or the assigned Mechanic. The payment is reported by either of them. Only the assigned CI reports the signing.
- A financing contract at a GCE visit needs no CI copy. Copies apply to a meet-up and a delivery; the Mechanic's copy applies to a cash or bank-transfer Meet Halfway.
- The CEO can write a contract in place of the Sales Manager. Only the Head Accountant reviews it.
- The buyer's page receives the contract text only once it is approved or signed.

## Notes and open items

- **Existing data:** approved meet-up, delivery and financing requests already in the hosted database now need a signed contract before a payment (other than a delivery's fee and downpayment), before the papers reach the buyer, and before Mark as Sold.
- **Scenario 2 set-up in the spec:** the `buyer_meetup` field case is inserted with the service role, because the Sales Manager does not yet assign the meet-up team at approval. Phase 4 adds that.
- **Not walked in the browser:** financing at a meet-up (Scenario 8) and financing delivery (Scenario 9). Their rules are covered by unit tests. Phase 4 reorders both.
- **Left for Phase 4:** `completeFinancingAgreement` requiring `signing_reported_at`; team assignment only after contract approval.
- **Row-level security:** a buyer can read their own `sale_handovers` row, so a draft contract is hidden by the page, not by the database. Tighten the policy if drafts must be private.
- **Older Playwright specs** (`t01-phase2` to `t01-phase6`, `scenario-8`, `scenario-9`) were not rerun. Any that record a payment, hand over papers or mark a car sold on a meet-up, delivery or financing request will fail on the new gates until Phase 6. `t01-phase5-financing` also still looks for the old "GCE visit (on the hour)" label.
- Buttons keep the product's existing 32 to 36px height, below the 44px touch target. That is the app-wide size and was not changed here.
- Contrast was not recomputed: the new text uses only the tokens measured in Phase 1.
- The test runs left sold test requests in the hosted database, as in Phases 1 and 2; the test cars are archived.

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
