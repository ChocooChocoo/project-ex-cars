[← Previous: Phase 6](./phase-6.md)

**Status:** ✅ Done in test mode (2026-10-14, not committed). Live webhook from PayMongo waits for the deploy.

# Phase 7: PayMongo Checkout in test mode

**Goal:** the buyer clicks Pay, pays the exact amount due on a PayMongo Checkout page in test mode, and the
app marks the payment paid from PayMongo's webhook. Replaces the fixed payment link from Phase 5.

## Decisions (owner, 2026-10-14)

- Keys go in `.env.local` by the owner (never in chat): `PAYMONGO_SECRET_KEY` (sk_test), `PAYMONGO_WEBHOOK_SECRET`.
- Methods: card, GCash, Maya, online banking (`card`, `gcash`, `paymaya`, `dob`).
- PayMongo's confirmation counts as verified; the Head Accountant does not click Verify.
- Webhook target: `https://global-exchange-car.vercel.app/api/paymongo/webhook` once this is deployed.
- Migration 00062 applied to the hosted project. Reschedule fee stays manual. The fixed-link fallback is removed.

## Tasks

- [x] Server env: `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` in `.env.local` (owner, 2026-10-14). Vercel still to do. **Owner:** `NEXT_PUBLIC_SITE_URL` in `.env.local` holds a `pk_test_` key; it should be a URL (`http://localhost:3000`, and the Vercel URL on Vercel). `.env.example` lists both (and `NEXT_PUBLIC_SITE_URL`, used for the return links when a request has no Origin header).
- [x] Migration `00062_t01_paymongo_checkout.sql` (+ test): `payment_records.paymongo_checkout_id`, `paymongo_payment_id`, `paid_at`, index on the checkout id. Applied (the push reported a connection error after applying; a dry run then showed the database up to date, and a service-role query confirmed the three columns).
- [x] `src/lib/payments/paymongo.ts` (+ 9 tests): `createCheckoutSession` (POST `/v1/checkout_sessions`, Basic auth, centavos, the four methods), `retrieveCheckoutSession`, `verifyWebhookSignature` (`t=,te=,li=`, HMAC-SHA256 of `t.rawBody`, timing-safe, 5-minute window), `readPaidCheckout` (both event shapes PayMongo documents). No new dependency.
- [x] `startOnlinePayment`: same ownership, signing and nothing-due checks; one Checkout for the unpaid kinds; rows recorded with the session id; Pay again reopens an active session or replaces an expired one (its unpaid rows are deleted). Without the secret key: "Online payment is not set up yet." (9 tests.)
- [x] Webhook `src/app/api/paymongo/webhook/route.ts` (+ 4 tests): 401 without a valid signature; on `checkout_session.payment.paid` sets `paid_at`, `paymongo_payment_id` and `verified_by` on the session's unpaid rows, runs `confirmInitialDownpaymentIfPaid`, notifies the Head Accountant and the Sales Manager. A repeat finds no unpaid rows and changes nothing; other events answer 200. `/api` was already outside the auth redirect (`src/proxy.ts`).
- [x] Head Accountant: PayMongo rows show "Waiting for PayMongo" or "Paid on PayMongo" (payment id on hover); no Verify button on them. Mark as Sold and dispatch count a paid PayMongo row through `verified_by`.
- [x] Already-paid session: a paid Checkout stays `active` at PayMongo, so Pay first checks its payments and, if one is paid, records it (`markCheckoutPaid`, shared with the webhook) instead of reopening it. This also covers a webhook that never arrives.
- [x] Expired or cancelled checkout: handled on Pay (above). No expiry webhook is subscribed; the on-Pay check is enough to let the buyer pay again.
- [x] Buyer page: Not paid / Waiting for PayMongo / Paid; "Pay ₱… with PayMongo" stays while anything is unpaid (it reopens the Checkout); notes after returning with `?paid=1` or `?cancelled=1`.
- [x] Removed `NEXT_PUBLIC_PAYMONGO_LINK` from the code and `.env.example`. `.env.local` still has the empty line; it is unused and can be deleted.

## Dependencies

- Phase 6. Done (`e6d66af`).
- Owner: PayMongo test-mode account, its secret key and the webhook secret in `.env.local`. Done (2026-10-14); webhook created for `checkout_session.payment.paid`.
- After deploy: a dashboard webhook for `https://global-exchange-car.vercel.app/api/paymongo/webhook`, event `checkout_session.payment.paid`, and both keys on Vercel.

## Done when

- [x] Scenario 3: Pay opens Checkout with the delivery fee and downpayment as separate lines at the exact amounts; a test payment marks both rows paid without staff action.
- [x] Scenario 5: Pay is still refused before signing; after PayMongo confirms, the account opens.
- [x] A webhook with a bad signature is refused (401) and changes nothing; the same event twice changes nothing the second time (route tests).
- [x] Clicking Pay twice does not create a second session or duplicate rows (startOnlinePayment tests).
- [x] No secret key reaches the browser bundle: `.next/static` holds neither `PAYMONGO_SECRET_KEY` nor `api.paymongo.com`.

## Verification (2026-10-14)

| Check | Result |
| --- | --- |
| `npm run test` | 70 files, 473 tests passed (new: paymongo 9, webhook 4, Pay 9 rewritten, migration 2) |
| `npx tsc --noEmit` | exit 0 |
| `npx biome check` on the touched files | no findings |
| `npm run build` | exit 0; `ƒ /api/paymongo/webhook` built |
| Client bundle scan | no PayMongo key or API URL |
| Shell: create + read a Checkout with the test key | 200; `livemode: false`; methods card, gcash, paymaya, dob; lines 250000 + 5000000 centavos; read back `active` |
| Shell: POST to local `/api/paymongo/webhook` | signed 200; wrong secret 401; no signature 401 |
| Playwright MCP browser, Scenario 3 with a real test payment | Pay → PayMongo Checkout (Delivery Fee ₱2,500, Downpayment ₱50,000, total ₱52,500; Card, GCash, Maya, BPI) → GCash test page → Authorize → back with the "Payment received" note, rows "Waiting for PayMongo" (the webhook cannot reach localhost) → Pay again recorded the paid session → both "Paid"; Head Accountant sees "Paid on PayMongo" (`pay_RfikyAFrz4tKGd6F4M9f64Ch`), no Verify button. Screenshots `test-results/phase7-mcp-*.png` |
| `buying-revision-phase5` (Checkout + signed webhook) | 2 of 2 passed (Scenario 3 1.8 min, Scenario 5 2.9 min) |
| `npm run test` after the already-paid fix | 70 files, 475 tests passed |

Tests were written first and seen to fail (missing module) before each piece was written.

## Assumptions

- **`verified_by` = the buyer.** The webhook has no staff user; 16 files read `verified_by` as "counts as paid". Setting it to the buyer's id makes every existing check count the payment without touching them, and `paymongo_payment_id` marks it as PayMongo-confirmed (`ponytail:` comment in the route). Upgrade: a `verified_via` column or a system profile.
- `paymongo_payment_id` is not unique: one Checkout for a fee and a downpayment is one PayMongo payment shared by two rows.
- The API is `v1/checkout_sessions`; PayMongo also documents a `v2` endpoint with the same body. Switch if v1 is retired.
- The Initial Downpayment still moves the request to "waiting for verification" when Pay starts; the webhook confirms it.

## Notes

- PayMongo's Checkout header shows the account holder's name ("GENIDO, KIM ANDREI LANCETA"); set the business name in the PayMongo dashboard so buyers see GCE.
- PayMongo asks the buyer for name and email on its page; they could be prefilled by sending `billing` with the session (small follow-up).
- The only console error in the walk was on PayMongo's own Checkout page (their React hydration), not the app.

## Next

1. Owner: fix `NEXT_PUBLIC_SITE_URL`, push, set `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` and `NEXT_PUBLIC_SITE_URL` on Vercel.
2. One real test payment on the deployed site: the webhook should mark it paid without clicking Pay again.

[← Previous: Phase 6](./phase-6.md)
