[← Previous: Phase 6](./phase-6.md)

**Status:** 🔲 Not Started

# Phase 7: PayMongo Checkout in test mode

**Goal:** the buyer clicks Pay, pays the exact amount due on a PayMongo Checkout page in test mode, and the
app marks the payment paid from PayMongo's webhook. Replaces the fixed payment link from Phase 5.

## Tasks

- [ ] Server env: `PAYMONGO_SECRET_KEY` (`sk_test_…`) and `PAYMONGO_WEBHOOK_SECRET` in `.env.local`, `.env.example` and the host. Server only, never `NEXT_PUBLIC_`.
- [ ] Migration `00062_t01_paymongo_checkout.sql` (+ test): on `payment_records`, add `paymongo_checkout_id` (unique) and `paymongo_payment_id`, plus `paid_at`. Adds only.
- [ ] `src/lib/payments/paymongo.ts`: `createCheckoutSession({ lineItems, referenceNumber, successUrl, cancelUrl })` via `fetch` to `https://api.paymongo.com/v1/checkout_sessions` (Basic auth with the secret key), and `verifyWebhookSignature(rawBody, header)` (HMAC-SHA256 with `node:crypto`, test or live signature by key prefix, reject old timestamps). No new dependency.
- [ ] `startOnlinePayment` in `src/app/(customer)/my-transactions/actions.ts`: keep the ownership, signing and "nothing due" checks; create one Checkout Session for the unsent items (exact amounts, one line item each); store the checkout id on the new unverified rows; return the `checkout_url`. Clicking Pay again while a session is open reuses its URL.
- [ ] Webhook route `src/app/api/paymongo/webhook/route.ts` (POST): read the raw body, verify the signature, handle `checkout_session.payment.paid`: find rows by `paymongo_checkout_id`, set `paymongo_payment_id`, `paid_at`, and move a financing downpayment forward as `verifyPayment` does. Idempotent (a repeated event changes nothing). Answer 200 fast; unknown events answer 200 and are ignored. Exclude the route from the auth redirect in `src/proxy.ts`.
- [ ] Head Accountant: rows show "Paid on PayMongo" with the payment id; Verify stays for the receipt check. Mark as Sold counts a PayMongo row once `paid_at` is set or it is verified.
- [ ] Expired or cancelled checkout: handle `checkout_session.expired` if PayMongo sends it, else let Pay start a new session when the old one is older than its expiry; remove the unpaid rows of a dead session so the buyer can pay again.
- [ ] Buyer page: success and cancel return URLs land back on `/my-transactions/<id>` with "Payment received, updating..." or "Payment cancelled." The list shows Not paid, Waiting for PayMongo, Paid, Verified.
- [ ] Remove `NEXT_PUBLIC_PAYMONGO_LINK` and its code paths, or keep it only as a fallback when no secret key is set (decide at implementation, document it).

## Dependencies

- Phase 6 (specs rewritten once, on the final flow).
- From the owner: a PayMongo account in test mode, its `sk_test_…` key, a webhook created in the dashboard for `checkout_session.payment.paid` pointing at the app, and that webhook's secret.
- For local testing: a public tunnel (ngrok or similar) to `localhost:3000` so PayMongo can reach the webhook.

## Done when

- [ ] Scenario 3: Pay opens Checkout with the delivery fee and downpayment as separate lines at the exact amounts; a test card payment marks both rows paid without staff action.
- [ ] Scenario 5: Pay is still refused before signing; after paying in test mode, Mark as Sold is allowed.
- [ ] A webhook with a bad signature is refused (401) and changes nothing; the same event sent twice changes nothing the second time.
- [ ] Clicking Pay twice does not create a second session or duplicate rows.
- [ ] No secret key reaches the browser bundle (`npm run build`, search the client chunks for `sk_test`).

## Verification plan

- Unit: `paymongo.ts` signature check (valid, wrong secret, old timestamp), `startOnlinePayment` with a mocked `fetch`, the webhook handler (paid, repeated, unknown event, bad signature).
- Browser: Playwright through the tunnel with PayMongo's test cards; a fallback spec that posts a signed fake webhook to the route, so CI runs without PayMongo.
- `npm run test`, `npx tsc --noEmit`, `npx biome check` on the touched files, `npm run build`.

## Open questions for the owner

- Which methods to offer in Checkout (card, GCash, Maya, others)?
- Is the Head Accountant's Verify still required after PayMongo confirms, or only for exceptions?
- Reschedule fee: add it to Pay (needs a stored amount), or keep it recorded by hand?

[← Previous: Phase 6](./phase-6.md)
