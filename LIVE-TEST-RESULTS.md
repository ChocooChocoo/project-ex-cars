# Live Site Test Results: Client Change Requests Phases 1–11

Tested 2026-10-27 on https://global-exchange-car.vercel.app with Playwright MCP (`main` at `e8426b6`).
Details per phase: `docs/implementation-plan/client-change-requests/phase-N.md`, section "Live site walk".

Fixes for the failing items were made and checked locally on 2026-10-27. They are not committed or deployed yet,
so the live site still shows the old behaviour until the next deploy.

## Results

| Phase | Item | Status |
| --- | --- | --- |
| 1 | Dashboard label, brand links, Actions column, ₱ amounts | Works |
| 1 | Customer label at 390px | Works |
| 1 | React error #418 on most pages (server dates in UTC, browser in PHT) | Fixed locally, pending deploy |
| 2 | AM blocked from Roles / Field Cases | Works |
| 2 | CEO has Roles, Field Cases, Create Walk-In | Works |
| 3 | Notification links, unread count, keyboard | Works |
| 4 | Real dashboard numbers, cards per role, chart | Works |
| 5 | Paging, detail view, reject with reason | Works |
| 5 | Approve → Release → Receive → Mark Paid | Works |
| 5 | Slow list refresh after each action (~5 s) | Optional, not changed |
| 6 | Document grid, payment photo, Verify, Reject | Works |
| 6 | Buyer sees "Not accepted" + reason | Works |
| 6 | Ask to resubmit | Works |
| 6 | Reject dialog closed itself when opened right after Verify | Optional, not changed (works on retry) |
| 7 | Walk-in account create | Works |
| 7 | Payroll Create Run + duplicate error | Works |
| 8 | Request a Car autocomplete + budget match | Works |
| 8 | Request a Car submit: no feedback for 30 s, second click made a duplicate | Fixed locally, pending deploy |
| 8 | Sell a Car form + SM view | Works |
| 8 | Purpose edit + showroom filter | Works |
| 9 | Profile save, phone validation, wrong password | Works |
| 9 | Chat 10 MB limit, photo/PDF send + view | Works |
| 9 | Counter-offer remarks, See reason | Works |
| 10 | ORCR + buyer ID "needs manual review" badge | Works |
| 10 | Verify after badge | Works |
| 11 | Displayed Price, notifications, flags | Works |
| 11 | Negotiated keeps price | Works |
| 11 | Location sharing + Maps link + denied message | Works |
| 11 | Delivery on cancelled transaction still showed sharing, Mark Delivered and map link | Fixed locally, pending deploy |
| 2 | Database permission checks | Not tested (same DB as local) |
| 10 | Forced "failed" / "no answer" checks | Not tested (need Vercel env) |
| 11 | Switch gone after Delivered | Not tested (no active delivery) |
| 7, 9 | Walk-in sign-in, staff profile, cancelled reason | Not tested |

## Fixes applied

| Problem | Change | Files | Local check |
| --- | --- | --- | --- |
| React #418 | Server time zone set to `Asia/Manila` at startup | `src/instrumentation.ts` (new) | Dev server forced to `TZ=UTC`: server and browser both show "6:00 PM"; no hydration errors |
| Request a Car duplicate | Submit stays disabled, reads "Opening your request..." until the page changes | `src/app/(customer)/request-a-car/_components/request-car-form.tsx` | "Submitting..." → "Opening your request..." → redirect; no second click possible |
| Delivery on cancelled transaction | Server refuses Mark…, Report delay and location updates unless the transaction is approved; UI hides those controls and the buyer's map link | `src/app/(staff)/field-cases/delivery-actions.ts`, `src/app/(staff)/field-cases/[id]/_components/delivery-case.tsx`, `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`, `src/app/(staff)/field-cases/delivery-location.test.ts` | Delivery `9f769e8b`: no switch or Mark buttons for Head Security; buyer sees no map link |

Checks: `tsc` clean; unit tests 597/597 pass (one new test: location update refused for a cancelled transaction).

Known limit: the time zone fix assumes users are in the Philippines. Users in other time zones would still see the
mismatch; the full fix is to pass `timeZone: "Asia/Manila"` to each date formatter.

## After deploy

- Open a field case on live, compare page-source times with the rendered times; console shows no #418.
- Submit Request a Car once on live: button stays disabled until the transaction page opens.
- Delivery `9f769e8b`: no switch or Mark Delivered for the team; buyer of `17c97d27` sees no map link.

## Test data to clean up

| What | Where |
| --- | --- |
| Payments ₱2,222 (verified), ₱1,111 (rejected) | Transaction `642417bd` |
| Valid ID uploaded by Sales Manager, asked to resubmit | Transaction `642417bd` |
| "LIVE-QA disbursement full flow" (paid), "LIVE-QA disbursement reject" | Finance → Disbursements |
| Walk-in `e2e.walkin.live@gce.local` | Staff Records |
| Payroll run 2026-09-01 to 2026-09-30 | Payroll |
| Request a Car ×2 (live run) | `a91d7805`, `4dd76335` |
| Request a Car "T600 LIVE-QA-FIX" (local fix check) | `7aef465a` |
| Sell offer "Xpander LIVE-QA" (ORCR verified) | `c9096cad` |
| Buy on "GCE Test Artifact S6b", submitted for review | `d03bf62c` |
| Chat photo + PDF (customer and Marketing) | Customer's Camry inquiry; sell chat of `c9096cad` |
| Displayed Price ₱830,000 (was ₱850,000) | Field case `214fc4ca` |
| Price status Negotiated | Field case `7d751431` |
| Location sharing on (14.2117, 121.1653) | Delivery `9f769e8b` |
