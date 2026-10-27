# Live Site Test Results: Client Change Requests Phases 1–11

Tested 2026-10-27 on https://global-exchange-car.vercel.app with Playwright MCP (`main` at `e8426b6`).
Details per phase: `docs/implementation-plan/client-change-requests/phase-N.md`, section "Live site walk".

Fixes for the three failing items were deployed to `main` (`29d9a9f`, `708625c`) on 2026-10-27 and re-tested on the
live site with Playwright MCP: all three now work. The OR/CR and ID auto-check (OCR.space) also works on live after the
verification env vars were set for Production on Vercel and the site was redeployed. Every tested item now works; only
optional and untested items remain.

## Results

| Phase | Item | Status |
| --- | --- | --- |
| 1 | Dashboard label, brand links, Actions column, ₱ amounts | Works |
| 1 | Customer label at 390px | Works |
| 1 | React error #418 on most pages (server dates in UTC, browser in PHT) | Fixed, works on live |
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
| 8 | Request a Car submit: no feedback for 30 s, second click made a duplicate | Fixed, works on live |
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
| 11 | Delivery on cancelled transaction still showed sharing, Mark Delivered and map link | Fixed, works on live |
| 2 | Database permission checks | Not tested (same DB as local) |
| 10 | OCR.space auto-check on live (sample OR/CR, sample passport, blank image as license) | Works on live after the Vercel env fix + redeploy (07:03 UTC): OR/CR "verified", passport "verified", blank license "failed" with Verify / Ask to resubmit still shown (`9a083af1`, `8bbfca3d`) |
| 11 | Switch gone after Delivered | Skipped on live: the only open delivery (`3dde6083`) is a seeded sale (2021 Honda HR-V GCE-011); a new one needs a real PayMongo downpayment. Checked locally in phase 11 |
| 7 | Walk-in sign-in (`e2e.walkin.live@gce.local`) | Works: lands on `/customer/showroom` as "LIVE-QA Walkin" |
| 9 | Staff profile (CEO) | Works: user menu → `/ceo/profile` in staff layout; no overflow at desktop or 390px |
| 9 | Cancelled reason (`efd8f546`) | Works: "Why this was cancelled · Vehicle sold to another buyer"; Close works |

## Fixes applied

| Problem | Change | Files | Live check (after deploy) |
| --- | --- | --- | --- |
| React #418 | Server time zone set to `Asia/Manila` at startup | `src/instrumentation.ts` (new) | Field case `9f769e8b`: page source and rendered page both "Jul 13, 2033 6:00 PM" (was 10:00 AM vs 6:00 PM); 0 console errors on field case, dashboard, transactions pages |
| Request a Car duplicate | Submit stays disabled ("Opening your request...") after success, then a full page load opens the new request. Cause found on live: the budget lookup server action finished after `router.push` and its refresh cancelled the navigation | `src/app/(customer)/request-a-car/_components/request-car-form.tsx` | Budget typed then submitted at once: one request created (`d6492743`), page opened it, button never re-enabled |
| Delivery on cancelled transaction | Server refuses Mark…, Report delay and location updates unless the transaction is approved; UI hides those controls and the buyer's map link | `src/app/(staff)/field-cases/delivery-actions.ts`, `src/app/(staff)/field-cases/[id]/_components/delivery-case.tsx`, `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`, `src/app/(staff)/field-cases/delivery-location.test.ts` | Delivery `9f769e8b`: no switch, Mark or delay controls for Head Security; buyer of `17c97d27` sees no map link |

Checks: `tsc` clean; unit tests 597/597 pass (one new test: location update refused for a cancelled transaction).

Known limit: the time zone fix assumes users are in the Philippines. Users in other time zones would still see the
mismatch; the full fix is to pass `timeZone: "Asia/Manila"` to each date formatter.

Still slow (not part of these fixes): opening a new request took about 36 s on live. The transaction page alone takes
about 6.5 s to render on the server; the rest is the submit itself on a cold serverless function.

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
| Request a Car "T600 LIVE-QA-LIVEFIX" and "T600 LIVE-QA-LIVEFIX2" (live fix checks) | `1eca7076`, `d6492743` |
| Sell offers "Xpander LIVE-QA-OCR" / "LIVE-QA-OCR2" (OCR checks) | `c968433f`, `d397df18` |
| Buys on "GCE Test Artifact S5b" / "S4e", submitted for review (OCR checks) | `7f314467`, `8f888c49` |
| Sell offer "Xpander LIVE-QA-OCR3" + buy on "S4c" (live OCR re-check) | `67015350`, `5b6a25d7` |
| Sell offer "Xpander LIVE-QA-OCR-LOCAL" + buy on "S4b" (local OCR check) | `095a2ff5`, `5b47bfa9` |
| Sell offer "Xpander LIVE-QA-OCR4" + buy on "S4d" (live OCR check, passed) | `9a083af1`, `8bbfca3d` |
| Sell offer "Xpander LIVE-QA" (ORCR verified) | `c9096cad` |
| Buy on "GCE Test Artifact S6b", submitted for review | `d03bf62c` |
| Chat photo + PDF (customer and Marketing) | Customer's Camry inquiry; sell chat of `c9096cad` |
| Displayed Price ₱830,000 (was ₱850,000) | Field case `214fc4ca` |
| Price status Negotiated | Field case `7d751431` |
| Location sharing on (14.2117, 121.1653) | Delivery `9f769e8b` |
