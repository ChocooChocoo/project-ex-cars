[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** ✅ Done (2026-10-14, not committed). Waiting on the owner's PayMongo link for live use.

# Phase 5: Buyer Pay link

**Goal:** the buyer clicks Pay, is sent to a PayMongo payment link, and the Head Accountant verifies the
payment. No PayMongo API keys or webhook.

## Tasks

- [x] Head Accountant verification: `verifyPayment` in `src/app/(staff)/transactions/actions.ts`; payment rows are labelled through `payment_kind`.
- [x] Extend the `payment_records.method` constraint with `paymongo` if the column is constrained (fold into 00059 or a small 00060 migration). It is constrained; 00059 and 00060 were already applied, so this is `supabase/migrations/00061_t01_paymongo_payment_method.sql` (+ test), applied to the hosted project (owner's go-ahead, 2026-10-14).
- [x] `startOnlinePayment` in `src/app/(customer)/my-transactions/actions.ts`: ownership check; insert unverified rows for what is due (Delivery Fee, Downpayment), skipping kinds that already have a row; refuse before the contract is signed where Phase 3 requires it; return `NEXT_PUBLIC_PAYMONGO_LINK`. Add a `ponytail:` comment naming the upgrade (PayMongo Checkout plus a webhook).
- [x] Pay button and a "sent, waiting for the Head Accountant" state in the customer `transaction-detail.tsx`.
- [x] Add `NEXT_PUBLIC_PAYMONGO_LINK` to `.env.local` and the env example. Added empty to `.env.local` (no link yet); there was no env example, so `.env.example` is new and lists every key with no values.

## Dependencies

- Phase 4. Done (not committed).
- A PayMongo payment link URL from the owner. **Not yet given (2026-10-14).** Until it is set, Pay answers "Online payment is not set up yet." and records nothing.

## Done when

- [x] Scenarios 3 and 9: Pay opens the link; the Head Accountant sees rows labelled Delivery Fee and Downpayment and approves them. (Walked for Scenario 3; Scenario 9 uses the same delivery fee and downpayment rows.)
- [x] Scenario 5: paying before signing is refused; without a verified payment Mark as Sold is refused.
- [x] Clicking Pay twice does not create duplicate rows.

## What was built

- `onlinePaymentsDue(details, terms, flowStatus)` in `src/lib/transactions/buy-flow.ts`: a delivery's fee and downpayment once its terms are set (cash or financed), or the Initial Downpayment of a financing claimed at a GCE visit (Scenario 5). Nothing else is paid online.
- `startOnlinePayment`: records only the kinds that have no row yet, so Pay again sends the buyer to the link and records nothing. A financing downpayment moves the request to "waiting for verification", as `recordPayment` does. The Head Accountant is notified with the amounts.
- Mark as Sold: a PayMongo row counts only once the Head Accountant verifies it (`transitionTransaction`).
- New `src/app/(customer)/my-transactions/_components/online-payment.tsx`: "Pay online" lists each payment as Not paid, "Sent, waiting for the Head Accountant" or Verified, with "Pay ₱… with PayMongo" for what is left and the exact amount to enter.
- Staff payments table: new "For" column (Delivery Fee, Downpayment, Balance, ...) via `paymentKindLabel` in `src/lib/transactions/labels.ts`; "PayMongo" added to the method labels.
- Wording: the buyer's delivery notice and the Head Accountant's notice now say "through PayMongo" instead of "by bank transfer".

## Verification (2026-10-14)

| Check | Result |
| --- | --- |
| `npm run test` | 67 files, 456 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the touched files | no findings |
| `npm run build` | exit 0 |
| `playwright test buying-revision-phase5` (dev server started with a test link, `NEXT_PUBLIC_PAYMONGO_LINK=https://example.com/paymongo-test`, set in the shell only) | Scenario 3 passed; Scenario 5 passed on a second run after one assertion fix |
| Impeccable detector on the changed UI files | no findings |
| Rerun of `playwright test buying-revision-phase5` (2026-10-14, test link) | Scenario 3 passed (2.9 min), Scenario 5 passed (3.7 min), first try |

`startOnlinePayment` was written test first (7 tests, seen to fail first). The Mark as Sold filter has no unit test (the test stub cannot evaluate the `or` filter); the browser run covers it.

What `src/tests/e2e/buying-revision-phase5.spec.ts` walks in the browser:

1. **Scenario 3.** After the Sales Manager sets the delivery terms, the buyer sees two "Not paid" rows, clicks Pay and lands on the link. Back on the request both rows read "Sent, waiting for the Head Accountant", Pay is gone, and the database holds exactly two unverified `paymongo` rows. The Head Accountant sees them labelled Delivery Fee and Downpayment and verifies both; the buyer sees Verified twice.
2. **Scenario 5.** Financing at a GCE visit through the Purchase Claim and a contract sent for approval. Pay is refused with "Sign the contract before paying." and records nothing. After approval and signing, Pay lands on the link and records one unverified ₱100,000 downpayment. Mark as Sold is refused ("Record the buyer's payment before marking the car sold.") and the request stays approved. The Head Accountant verifies it and opens the financing account.

The spec skips itself unless `NEXT_PUBLIC_PAYMONGO_LINK` is set. Run it with:
`NEXT_PUBLIC_PAYMONGO_LINK=https://example.com/paymongo-test npm run dev`, then
`NEXT_PUBLIC_PAYMONGO_LINK=https://example.com/paymongo-test node --env-file=.env.local node_modules/@playwright/test/cli.js test buying-revision-phase5`.

## Files changed

- New: `supabase/migrations/00061_t01_paymongo_payment_method.sql`, `.test.ts`
- New: `src/app/(customer)/my-transactions/online-payment.test.ts`, `_components/online-payment.tsx`
- New: `src/tests/e2e/buying-revision-phase5.spec.ts`, `.env.example`
- Changed: `src/app/(customer)/my-transactions/actions.ts`, `_components/transaction-detail.tsx`
- Changed: `src/lib/transactions/buy-flow.ts`, `labels.ts`
- Changed: `src/app/(staff)/transactions/actions.ts`, `delivery-actions.ts`, `[id]/_components/transaction-payments-table-v1.tsx`
- Changed: `src/app/(staff)/transactions/papers-gates.test.ts`, `meetup-team.test.ts` (the test stub learned `or`)
- Changed (not in git): `.env.local` gained an empty `NEXT_PUBLIC_PAYMONGO_LINK`

## Assumptions

- A row is recorded when the buyer clicks Pay, before PayMongo confirms anything. It means "the buyer was sent to pay this"; the Head Accountant verifies it against the PayMongo receipt, as phase-1's assumption ("a payment link plus manual Head Accountant verification") says.
- The buyer pays the total on one link and is told the exact amount to enter. The fixed link carries no amount.
- After Pay the buyer is sent to the link in the same tab, so a popup blocker cannot stop it.
- Pay is refused, and records nothing, while no link is set.

## Notes and open items

- **Owner action:** set `NEXT_PUBLIC_PAYMONGO_LINK` in `.env.local` (and in the hosting environment), then restart the server. A `NEXT_PUBLIC_` value is read when the app starts or builds.
- **Reschedule fee:** the doc says it is paid through PayMongo too. There is no stored amount for it, so it is not on the Pay list; the Head Accountant still records it by hand. A small follow-up if wanted.
- **If a buyer clicks Pay but never pays,** an unverified row stays. The Head Accountant should not verify it; there is no "reject" action for a payment row yet.
- **Formatter:** a folder-wide `biome check --write` reformatted three unrelated files (`transaction-paper.tsx`, `transaction-paper.test.tsx`, `transactions-data.test.ts`); they were restored from git. Lint only the files you touched (Phase 1 note still stands).
- **Test-run limits** from Phase 4 still apply: one Scenario 5 run failed on an assertion that expected the later of two refusal messages.

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
