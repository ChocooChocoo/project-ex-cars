[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** 🔲 Not Started

# Phase 5: Buyer Pay link

**Goal:** the buyer clicks Pay, is sent to a PayMongo payment link, and the Head Accountant verifies the
payment. No PayMongo API keys or webhook.

## Tasks

- [x] Head Accountant verification: `verifyPayment` in `src/app/(staff)/transactions/actions.ts`; payment rows are labelled through `payment_kind`.
- [ ] Extend the `payment_records.method` constraint with `paymongo` if the column is constrained (fold into 00059 or a small 00060 migration).
- [ ] `startOnlinePayment` in `src/app/(customer)/my-transactions/actions.ts`: ownership check; insert unverified rows for what is due (Delivery Fee, Downpayment), skipping kinds that already have a row; refuse before the contract is signed where Phase 3 requires it; return `NEXT_PUBLIC_PAYMONGO_LINK`. Add a `ponytail:` comment naming the upgrade (PayMongo Checkout plus a webhook).
- [ ] Pay button and a "sent, waiting for the Head Accountant" state in the customer `transaction-detail.tsx`.
- [ ] Add `NEXT_PUBLIC_PAYMONGO_LINK` to `.env.local` and the env example.

## Dependencies

- Phase 4.
- A PayMongo payment link URL from the owner.

## Done when

- [ ] Scenarios 3 and 9: Pay opens the link; the Head Accountant sees rows labelled Delivery Fee and Downpayment and approves them.
- [ ] Scenario 5: paying before signing is refused; without a verified payment Mark as Sold is refused.
- [ ] Clicking Pay twice does not create duplicate rows.

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
