[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** ✅ Done (2026-10-28). Not committed.

> 2026-10-28: Started. The client's exact steps are not recorded, so all three candidate causes below are reproduced
> in turn (user decision), and whichever fails is fixed.
>
> 2026-10-28 reproduction (Playwright MCP, localhost:3000, `customer@gce.local`, `sales_manager@gce.local`,
> `head_accountant@gce.local`):
> 1. **Bank Transfer + Delivery, customer pays online: works.** Tx `33e8d06a` (car `343aabed`, fee ₱2,500,
>    downpayment ₱50,000). "Pay ₱52,500.00 with PayMongo" opened checkout with Card / E-Wallets / Online Banking.
>    Online Banking (BPI test bank, account 0001, OTP 123456) showed "BPI Online Payment Received!", returned to
>    `?paid=1`, and both lines show Paid. Head Accountant sees both rows as "Paid on PayMongo". So `dob` is enabled
>    and `onlinePaymentsDue` is correct for deliveries. Tx cancelled afterwards to free the car.
> 2. **Bank Transfer + CALABARZON Meet-up, staff records the downpayment: fails.** Tx `cf86cf83` (car `343aabed`),
>    approved with a meet-up team. Head Accountant, Record Payment, ₱50,000, Bank Transfer, Payment for Downpayment:
>    toast "The buyer must sign the contract before a payment is recorded." Source: `recordPayment`
>    (`src/app/(staff)/transactions/actions.ts:576-590`), because `paymentAllowedBeforeSigning`
>    (`src/lib/transactions/buy-flow.ts:287`) allows a pre-signing downpayment only for deliveries.
>    `buy-flow.test.ts:371` asserts this refusal on purpose (contract-first rule from the buying-flow revision).
> 3. **Bank Transfer at a GCE Visit or meet-up, customer side:** no "Pay online" section (`onlinePaymentsDue` returns
>    `[]`). By design these are paid on site; not treated as the bug.
>
> Side finding (not fixed, not in scope): the status history says "Buyer submitted a Cash Delivery request" for a
> Bank Transfer request.

# Phase 4: Bank transfer with downpayment

**Goal:** A customer who pays by Bank Transfer with a downpayment can finish the payment (X2).

## Dependencies

- Phase 3 complete (the Payment Option/Method split and the `cheque` removal change the same code paths)
- PayMongo test keys in `.env.local`

## Tasks

- [x] Reproduce the failure with the client's scenario (systematic-debugging) and record the exact error and step.
  Candidate causes found during planning:
  - The customer has no Bank Transfer path: `onlinePaymentsDue` (`src/lib/transactions/buy-flow.ts:323-344`) returns
    `[]` for a GCE Visit or meet-up, so "Nothing is due online right now."
  - Staff `recordPayment` (`src/app/(staff)/transactions/actions.ts:576-590`) refuses a meet-up downpayment before
    signing, because `paymentAllowedBeforeSigning` (`buy-flow.ts:280-282`) only allows delivery kinds.
  - `dob` (online banking) in `src/lib/payments/paymongo.ts:7` may not be enabled on the PayMongo account, so checkout
    creation fails.
  > 2026-10-28: Reproduced: candidate 2 only (see the reproduction note at the top). Candidates 1 and 3 do not fail.
- [x] Fix the confirmed cause in the shared function, not in one caller.
  > 2026-10-28: User decision: allow the downpayment before signing for a Cash or Bank Transfer meet-up.
  > `paymentAllowedBeforeSigning` in `src/lib/transactions/buy-flow.ts` now returns true for a direct-payment meet-up
  > when the kind is `downpayment` (full payment, balance and fees still wait for the contract; a financed meet-up
  > still signs in the app first). Both callers (`recordPayment`, `requestOnlinePayment`) go through it.
- [x] Regression test in `src/lib/transactions/buy-flow.test.ts` or `src/app/(customer)/my-transactions/actions.test.ts`
  that fails before the fix.
  > 2026-10-28: `buy-flow.test.ts`, "allows only the downpayment of a direct-payment meet-up before signing". The old
  > `cashMeetup` downpayment = false assertion was removed from the delivery test (it is the rule that changed).

## Done when

- [x] The regression test fails on the old code and passes on the fix.
  > 2026-10-28: Before the fix: `npx vitest run src/lib/transactions/buy-flow.test.ts`: 1 failed, 37 passed
  > ("expected false to be true" on the bank-transfer meet-up downpayment). After: 38 passed.
- [x] The reproduced scenario completes end to end in the Playwright MCP browser: Bank Transfer with a downpayment is
  recorded and the Head Accountant can verify it.
  > 2026-10-28: Tx `cf86cf83` (approved Bank Transfer meet-up): Head Accountant Record Payment ₱50,000 Bank Transfer
  > Downpayment: "Payment recorded."; row shows Pending, then Verify: row shows Verified. The delivery path (tx
  > `33e8d06a`) was already verified end to end through PayMongo Online Banking.
- [x] `npm run test` passes.
  > 2026-10-28: 103 files, 661 tests passed. `npx tsc --noEmit`: clean. `npx biome check` on the 2 changed files:
  > clean (repo-wide `check:fix` not run, to keep other phases' uncommitted files untouched).

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
