# GCE Process & Revision Notes — delta implementation plan (2026-11-20)

## Context

Source: `docs/GCE System – Process & Revision Notes.md` (the "notes"; line numbers below refer to it).
Baseline: `prompts/plans/client-revisions-2026-11-19.md` (the "prior plan"; IDs such as `SH-7` refer to its request
inventory, all eleven phases are ✅ Done).

This plan compares every revision item in the notes with the prior plan. Items the prior plan already covers are
listed in the coverage table as **Done** with the prior ID and get no tasks. Items that change or extend a prior item
are **Partial**, and items with no prior coverage are **New**; both become tasks in the phases below. The prior plan
is not edited.

Decisions taken for this plan (from the prompt's open questions):

- Matched items stay in this plan's coverage table, marked Done. They are not repeated as tasks.
- Done status is recorded here only. `client-revisions-2026-11-19.md` stays as it is.
- A partial match becomes a task here that names the prior ID it extends. The task covers only the difference.
- File name: `prompts/plans/process-revision-notes-2026-11-20.md`.

"Done" means the prior plan claims the work is finished. This review did not re-run its tests. Phase 7 re-tests the
Done items that the notes mention again.

## Coverage table

Status: **Done** = covered by the prior plan, no task. **Partial** = prior item exists, the notes change or extend it.
**New** = no prior coverage. **Confirm** = needs a client answer before the task can be built.

### Part 1 — Supplier process (lines 14–93)

| Lines | Item | Status | Prior | Phase |
|---|---|---|---|---|
| 23, 36–39 | Account Manager "Create Supplier Account" (walk-in form + Supplier Company Name, CEO-provided Gmail, account email) | New | — | 1 |
| 40 | Supplier self-registration, Account Manager approves | New / Confirm | — | 1 |
| 24, 44–50 | Supplier portal dashboard: transactions, vehicles posted, vehicles purchased | New | — | 1 |
| 52–55 | Vehicle Posting tab (photos + details), no showroom, posting removed once GCE buys | New | — | 1 |
| 56 | Supplier posts visible only to CI, Marketing Specialist, CEO | New | — | 1 |
| 25, 60–63 | Marketing Specialist supplier-posts tab, detail, chat with supplier, purchase proposal with market value | New | — | 2 |
| 26, 65–68 | CEO approve (back to MS) / reject (ends, optional reason) | New | — | 2 |
| 27, 70–72 | MS assigns Mechanic and CI after approval | New | — | 3 |
| 28, 74–78 | CI field case, purchase fund request to Head Accountant, arrival confirmation | New | — | 3 |
| 29, 82–88 | Mechanic inspection: no issue → Ready for Posting; hidden issue → estimate + photos to MS, MS approves, CI pays, reconditioning, Ready for Posting | New | — | 3 |
| 30–31, 91–93 | MS posts vehicle to showroom | New | — | 3 |

### Part 2 — Revision notes (lines 97–242)

| Lines | Item | Status | Prior | Phase |
|---|---|---|---|---|
| 101–103 | Remove every "Open in Google Maps" link | Done | SH-8 | — |
| 103 | "Third-party integration not allowed": prior plan kept OSM tiles, Nominatim and the OSM live-location iframe | Confirm | SH-8, BH-8 | 4 |
| 109 | Buying guide: 2 printed copies of each ID, 3 signatures each | Done | SN-15 | — |
| 110 | Buying guide: payslip required in steps 1–4 (prior plan lists it for financing only) | Partial / Confirm | SN-15 | 6 |
| 114 | Sell year 1980 to current/future model year | Done | SN-12 | — |
| 115 | OR/CR/Deed uploads replaced by checklist with Has / Doesn't Have / Expired | Partial | SN-13 | 5 |
| 116 | Required tick box: seller brings 2 printed copies of each ID, 3 signatures each | New | — | 5 |
| 117 | MS receives the checklist | Done | SN-11 | — |
| 118 | Privacy reminder | Done | SN-13 | — |
| 119 | GCE address on the halfway map is wrong: use 8XG3+XC8, Dominador Mangubat Blvd, Dasmariñas, Cavite | Partial | SH-14 | 4 |
| 120 | Halfway pin limited to the area near the suggested meet-up point | New | — | 4 |
| 124 | Seller cannot remove submitted files unless asked to resubmit | Done | SN-14 | — |
| 125 | GCE Visit map with exact GCE location, still visible after requirements are submitted | Partial | BC-10 | 4 |
| 126 | Halfway meet-up at least 2 days ahead | Done | BH-1 | — |
| 127 | Buyer halfway: adjustable map, no Google link, pin inside CALABARZON | Done | BH-8 | — |
| 128 | Pin auto-fills region/province/municipality/barangay | Done | BH-8 | — |
| 128 | Pinned location visible to Sales Manager and CI | Partial (CI field case view not listed for buyer meet-ups) | BH-8 | 4 |
| 129 | Sales Manager rejection reason shown on My Transactions | Done | BC-9 | — |
| 133 | Showroom: Interior Color and Purpose | Done | BC-11 | — |
| 139 | Request Paper Release fetches the CI's recorded papers from `/vehicle-papers` | New | BC-7 (view only) | 5 |
| 140 | Sales Manager e-signature on GCE Visit Deed of Sale (full payment and financing) | Done | BC-3 | — |
| 141 | Full-payment cash GCE Visit: no downpayment, no "Head Accountant must check the payment" message | Done | BC-4 | — |
| 141 | Papers fetched automatically from the CI's records | New | — | 5 |
| 142 | Approval only after IDs are verified | Done | BC-8 | — |
| 143 | Reject modal reason, shown to the client | Done | BC-9 | — |
| 144 | Remove Record Paperwork | Done | BC-1 | — |
| 145 | Show Payment Option for halfway buys | Done | BH-7 | — |
| 146 | Financing downpayment = 10% of the vehicle's total price | Done (verify price basis) | BH-6 | 7 |
| 147 | Buyer's halfway pin shown to Sales Manager | Done | BH-8 | — |
| 155 | MS sees the seller's checklist instead of images | Done | SN-11 | — |
| 156 | MS photographs the physical papers during a GCE Visit and sends them to the CI's Vehicle Papers | Partial (prior: after purchase, any method; signed ID copies not captured) | SN-3 | 5 |
| 157 | Record the seller on each paper record | Done | SN-3, SN-4 | — |
| 158 | Papers On Hold while unsold, Released once sold; view with images | Partial (prior seller items start as `with_ci`, not On Hold) | BC-5, SN-4 | 5 |
| 159 | Papers released to MS or CI by the seller's chosen method; failed sale → CI returns papers → On Hold | New / Confirm | BC-5 | 5 |
| 163 | Zero excess: "No Excess to Return" button; Head Accountant gets a "No excess return" record | Partial (prior: no Head Accountant record at all) | SN-2, BH-3 | 6 |
| 164 | Excess return screen shows the vehicle being processed | New | — | 6 |
| 168 | MS sees the Mechanic's inspection checklist for declared and hidden issues | Done | SH-7 | — |
| 169 | Inspection Issue Report shows the new ceiling only | Done | SH-6 | — |
| 170 | Second negotiation includes the inspection report and the hidden-issue deduction | Partial (deduction not shown) | SH-6 | 6 |
| 174 | Grey out past dates in the meet-up picker | Done | SH-12 | — |
| 175 | MS and Sales Manager see the halfway pin, no typed meet-up place (buying too) | Partial (MS view of buyer pin not listed) | SH-12, BH-8 | 4 |
| 179 | Remove Condition dropdown | Done | SN-1 | — |
| 179 | Reconditioned vehicles labelled "Excellent" (or the correct term) | New / Confirm | — | 6 |
| 180 | Fix ₱ overlap | Done | SN-1 | — |
| 181 | Remove Warranty Details; warranty on the printed paper | Done | SN-1, BC-6 | — |
| 182 | "Finalize Repair" button moves the car to Ready for Pricing | Partial (transition exists on "Complete reconditioning") | SH-1 | 6 |
| 183 | Remove the Sales Manager re-process step | Done | SH-2 | — |
| 189 | Purchase fund modal shows seller, vehicle, declared issues | Done | SN-9 | — |
| 190 | Single "Approve & Release" action | New | — | 6 |
| 191 | Verify whether releases reduce Revenue (fine if not) | Partial (ledger exists, Revenue behaviour not tested) | SN-10 | 6 |
| 192 | Zero excess: "No excess return" recorded automatically | Partial | SN-2 | 6 |
| 193 | After reconditioning, Head Accountant sees the Mechanic's checklist of items actually checked | Partial / Confirm (prior shows the field inspection) | SH-3 | 6 |
| 194 | Disbursement modal: car, downpayment paid, delivery fee paid | Done | BH-4 | — |
| 202–203 | Purchase Fund, Excess Return, Record Seller Paid use the 2nd-negotiation price | Done | SH-5 | — |
| 207 | Meet-up expenses absent from client documents | Done | SH-10 | — |
| 207 | Meet-up expenses absent from buying transactions | New | — | 6 |
| 208 | Field budget "What it covers" checklist: Gas, Toll Fee, Parking, Other possible expenses | Partial (prior labels: Fuel, Tolls, Parking fee, Meals, Transportation fare, Other) | BH-5 | 6 |
| 209–213 | CI chooses "Excess budget to return" (amount) or "Budget was exact for the trip" (no amount), then Record Excess Return | Partial (prior shows the input only when computed excess > 0) | SN-2 | 6 |
| 219 | Mechanic status modal without Assigned / Accepted | Done | SN-5 | — |
| 220 | Expense amount from the case's total expenses | Done | SN-6 | — |
| 221 | Notes reflect the actual process | Done | SN-7 | — |
| 222 | Remove "Open the seller's meet-up point in Google Maps" | Done | SH-8 | — |
| 223 | Meet-up expense removed from the Mechanic | Done | SH-9 | — |
| 224 | Mechanic cannot request funds | Done | SH-9 | — |
| 225 | Contract removed from the Mechanic | Done | BH-2 | — |
| 229–232 | Per-part checklist (Needs Repair / Good Condition), declared issues pre-set, editable, image + cost per Needs Repair part | Done | SH-7 | — |
| 236 | Reconditioning fetches Needs Repair items with images | Done | SH-4 | — |
| 237 | Mechanic enters budget, part name, replacement brand (prior: part name read-only on prefilled rows) | Partial / Confirm | SH-4 | 6 |
| 238 | Overall vehicle status field stays | Done (regression check) | — | 7 |
| 242 | Selling flow with no issues has no problems | Done (regression check) | — | 7 |

## Decisions to confirm with the client

Ask these before starting the phase that depends on them. Each task below names the default to use if the client
does not answer.

1. Supplier accounts (line 40): Account Manager creation only, self-registration only, or both? Default: both, with
   self-registered accounts pending until approved.
2. Supplier no-issue path (lines 29, 87): does the vehicle need payment and transport to GCE before "Ready for
   Posting"? The overview says the CI pays after MS approval; the inspection table skips payment. Default: the CI pays
   and records the purchase on both paths before the car can be posted.
3. Third-party maps (line 103): does "no third-party integration" ban only outbound links, or also OSM tiles,
   Nominatim and the OSM iframe? Default: links only. Tiles and geocoding stay.
4. Pin radius (line 120): how far may the pin move from the suggested midpoint? Default: 5 km.
5. GCE pin (line 119): the plus code decodes (with the `7Q62` area prefix for Dasmariñas) to about
   `14.32741, 120.95358`, about 390 m south-west of the current Gate 3 pin `14.32856, 120.95700`. Default: use the
   plus-code point and the client's address text. Check it on the map before changing it.
6. Deed of Sale "Expired" (line 115): prior plan gives the Deed only Has / Doesn't Have. Default: follow the notes and
   allow Expired for all three.
7. Payslip (line 110): required for every buyer or only for financing? Default: financing only, with step text that
   says so.
8. Paper routing (line 159): "depending on the seller's chosen method" — does the MS receive originals for GCE Visit
   and the CI for Meet-up? Default: yes, as written.
9. Signed ID copies (line 156): photographed with the OR/CR/Deed? Default: yes, as an optional "Signed ID copies"
   photo slot.
10. Reconditioned label (line 179): "Excellent" or another term? Default: "Reconditioned".
11. Part names (line 237): editable on prefilled rows? Default: editable, keeping the link to the inspection row.
12. Post-repair checklist (line 193): a new Mechanic checklist at completion, or the field inspection with repair
    results? Default: show the field inspection parts with each part's repair result and completion photo.

---

## Phase 1 — Supplier accounts and portal

Status: ✅ Done

Goal: suppliers have accounts and a private portal where they post vehicles for GCE.

Tasks
- [x] Add `supplier` to `backend/app/Enums/Role.php`, the active role CHECK in a new migration in
  `backend/database/migrations/`, and `src/lib/auth/roles.ts`. Do not restore the historical Supabase supplier code.
  Add the `/supplier/…` prefix to `src/scripts/generate-htaccess.ts` and a `(supplier)` route group with a client
  layout that checks `/api/v1/me`.
- [x] Migration: `supplier_profiles` (`user_id` unique FK, `company_name` varchar 200, `approval_state`
  `pending|approved|rejected`, `approved_by`, `approved_at`).
- [x] Account Manager "Create Supplier Account": sidebar item in `src/navigation/sidebar/sidebar-items.ts`, page that
  reuses the Create Walk-in Account form with one extra required field "Supplier Company Name". Laravel creates the
  user and profile as `approved` and queues a notice to the given Gmail address ("You now have an account on the GCE
  website", with the set-password link from the existing reset mail). Never email a password.
- [x] Self-registration (decision 1): a supplier sign-up page creates a `pending` profile. Account Manager gets a
  "Supplier approvals" list with Approve / Reject. Pending and rejected suppliers get 403 on every supplier endpoint.
- [x] Migration: `supplier_vehicle_posts` (`supplier_id`, make, model, year, mileage, asking price, description,
  `state` `posted|proposed|approved|rejected|assigned|purchased|withdrawn`, timestamps) and private photos through
  `App\Services\FileService` (2 MiB per file, `compressFormFiles` on the client).
- [x] Supplier portal: Dashboard with three counts (transactions with GCE, vehicles posted, vehicles purchased) and a
  Vehicle Posting tab (create, edit while `posted`, withdraw). Purchased posts leave the active list and stay in
  history. No showroom link in the supplier layout.
- [x] Policy: a supplier reads only their own posts. Staff read access only for Confidential Informant, Marketing
  Specialist and CEO (line 56); an assigned Mechanic reads only the post linked to their field case.

Implementation notes
- Routes: the supplier portal is the `portal/` export folder, served at `/supplier/portal` and
  `/supplier/portal/vehicles` (`src/lib/routing/paths.ts`, `htaccess.ts`, `next.config.mjs`). The customer shell
  moved to `src/components/portal-shell.tsx` so both portals share it.
- "Create Supplier Account" is its own form on the new `/suppliers` page (with the approvals list), not the walk-in
  dialog: the walk-in form asks staff to type a password, and a supplier sets their own from the queued
  `SupplierAccountCreated` mail.
- Self-registration is `/auth/v1/register-supplier` (`RegisterForm supplier`), linked from the customer sign-up.
- A pending or rejected supplier can sign in, but every `/supplier/*` endpoint answers 403 and the portal shows why.
- The Mechanic's access to a linked post comes in Phase 3 through the sell transaction, not the post itself.

Dependencies: none.

Done when
- [x] Account Manager creates a supplier and the notice mail is queued with no password in it.
- [x] A pending supplier cannot log in to the portal; an approved one can.
- [x] Supplier A cannot read supplier B's posts or photos (PHP test).
- [x] Sales Manager and Head Accountant get 403 on supplier posts; CI, MS and CEO get 200.
- [x] Dashboard counts match seeded data.

Next: Phase 2 →

---

## Phase 2 — Supplier review, chat and CEO proposal

Status: 🔲 Not Started

Goal: the Marketing Specialist reviews supplier posts, talks to the supplier and proposes purchases to the CEO.

Tasks
- [ ] Marketing Specialist "Supplier Vehicles" tab: list of all `posted` posts with supplier company name; detail page
  with photos and details.
- [ ] Chat on the detail page between the MS and the supplier, scoped to the post. Reuse the existing polling chat
  (threads and messages) with a thread linked to the post; participants are the supplier and MS, read-only for CEO
  and CI.
- [ ] "Propose to CEO": required market value (₱) and reason. Post goes to `proposed`; CEO is notified.
- [ ] CEO decision: Approve → `approved`, MS notified. Reject → `rejected` with optional reason, MS and supplier
  notified, no further action allowed on the post.

Dependencies: Phase 1.

Done when
- [ ] A proposal without market value is rejected (422).
- [ ] A rejected post cannot be proposed again or assigned (PHP test).
- [ ] The supplier sees chat messages for their post only.

← Previous: Phase 1 | Next: Phase 3 →

---

## Phase 3 — Supplier field acquisition and showroom posting

Status: 🔲 Not Started

Goal: an approved supplier vehicle is inspected, paid for, reconditioned if needed and posted to the showroom once.

Tasks
- [ ] MS assigns a Mechanic and a CI to an `approved` post: creates a `field_cases` row with a new kind
  `supplier_acquisition` linked to the post (`assigned`). Reuse `FieldCaseActionController` state handling.
- [ ] CI field case: supplier name, address and post details; "Request purchase fund" through
  `FinanceController::requestPurchaseFunds` / `Disbursements` with the proposed price; "Confirm arrival" records
  `arrived_at`.
- [ ] Mechanic inspection: reuse the per-part checklist from SH-7 (`reportInspection`, `inspection-result.tsx`).
  No issue → MS sees "Ready for Posting" after the purchase is recorded (decision 2). Hidden issue → MS sees the
  per-part costs and photos with Approve / Decline; Approve notifies the CI, Decline closes the case and returns the
  post to the supplier as `rejected`.
- [ ] CI "Record supplier paid": one `DB::transaction` that creates the `vehicles` row (stock code, details and
  photos copied from the post), marks the post `purchased`, completes the disbursement and increments nothing twice
  (unique `vehicles.supplier_post_id`). Hidden-issue vehicles enter `repairing` and reuse `ReconditioningController`
  with the inspection prefill (SH-4); no-issue vehicles enter `awaiting_price_approval`.
- [ ] MS posts the vehicle with the existing pricing and posting flow; it appears in `/showroom`.

Dependencies: Phase 2. Reuses prior Phases 5–8.

Done when
- [ ] Both paths reach the showroom only after payment, and the hidden-issue path only after reconditioning.
- [ ] Retrying "Record supplier paid" creates one vehicle and one cash outflow (PHP test).
- [ ] The supplier's purchased count goes up by one and the post leaves their active list.

← Previous: Phase 2 | Next: Phase 4 →

---

## Phase 4 — Maps: GCE pin, pin radius and staff visibility

Status: ✅ Done

Goal: correct GCE pin everywhere, halfway pins stay near the midpoint, and every staff role that needs the pin sees it.

Tasks
- [x] Line 119 (decision 5): set `GCE_LOCATION` and `GCE_LOCATION_LABEL` in `src/lib/transactions/sell-flow.ts:27-29`
  to the verified plus-code point and "GCE, 8XG3+XC8, Dominador Mangubat Blvd, Dasmariñas, Cavite". Update
  `sell-flow.test.ts`. Add the same point as a PHP constant if the backend computes the midpoint.
- [x] Line 120 (decision 4): add `MEETUP_MAX_OFFSET_KM` and `isNearMidpoint(pin, midpoint)` (haversine) to
  `src/lib/transactions/meetup-area.ts`. `meetup-map.tsx` snaps back with a toast when a drag goes beyond it. The
  midpoint is saved with the pin (`meetup_origin_lat/lng` on `sell_details` and `purchase_details`, migration) so
  `SellIntakeController` and `CustomerTradingController::saveBuyDetails` (and reschedule) can enforce the same limit
  with 422. Unit test: in-box point beyond the radius rejected, point inside accepted.
- [x] Line 125: show `GceLocationMap` on the buyer's transaction detail after requirements are submitted (not only in
  the edit form) for GCE Visit. Vitest render test for the submitted state.
- [x] Lines 128, 175: show the buyer's saved pin and `meetup_address` read-only on the Marketing Specialist's buy
  transaction view and on the CI's `buyer-meetup-case.tsx` if either is missing. Reuse the read-only `MeetupMap`.
- [x] Line 103 (decision 3): if all third-party requests are banned, replace OSM tiles, Nominatim and the OSM iframe
  in `src/components/live-location-map.tsx`; otherwise record the decision here and change nothing.
  Decision: default taken (links only). Tiles, Nominatim and the live-location map stay.

Implementation notes
- The radius origin is the suggested midpoint the map computes (GCE when the device location is unavailable). It is
  sent as `meetup_origin_lat/lng`; Laravel checks only a newly sent pin, so saved pins and older clients pass.
- Line 125 already worked: the "Where to meet" section shows the GCE map once the request leaves the draft. A Vitest
  case now covers it.
- Lines 128/175: the Sales Manager (transaction overview) and CI (buyer meet-up case) already show the buyer's pin.
  `TransactionPolicy` keeps the Marketing Specialist on sell transactions only; the MS sees the seller's pin there.
  Opening buy transactions to the MS was not done, because it widens access beyond what the notes ask.

Dependencies: none (independent of Phases 1–3).

Done when
- [x] GCE marker and label match the client's address on buy and sell maps.
- [x] A pin beyond the radius is rejected by UI and API.
- [x] Buyer still sees the GCE map after submitting requirements.
- [x] MS, Sales Manager and CI see the buyer's halfway pin.

← Previous: Phase 3 | Next: Phase 5 →

---

## Phase 5 — Seller checklist, paper capture and custody

Status: ✅ Done

Goal: the seller confirms signed ID copies, papers are captured per method, and custody follows the sale.

Tasks
- [x] Line 115 (decision 6): allow `expired` for Deed of Sale in `SELL_PAPER_STATUSES` (`src/lib/vehicles/catalog.ts`),
  the zod rule in `src/lib/validation/transactions.ts` and `SellIntakeController`.
- [x] Line 116: required checkbox "I will bring 2 printed copies of each valid ID, each signed 3 times" in
  `sell-vehicle-form.tsx`; store as `papers_checklist.signed_id_copies = true`; validate in zod and
  `SellIntakeController` (`accepted`); show on the MS `transaction-documents-card.tsx` checklist block.
- [x] Line 156 (decision 9): MS "Capture vehicle papers" is available during the GCE Visit (after the agreed price,
  before purchase), not only after `completePurchase`. Add an optional "Signed ID copies" photo slot.
- [x] Line 158: seller-origin `vehicle_document_items` start as `on_hold` (not `with_ci`) and show "On Hold" until
  the car is sold; `Trading::finalizeBuySale` sets them `released`. Keep `with_ci` readable for old rows.
- [x] Lines 139, 141: "Request Paper Release" (`HandoverController::requestPapersRelease`) attaches the car's
  seller-origin `vehicle_document_items` to the handover, so the Sales Manager sees the CI's recorded papers and
  images on the buy transaction without a CI action. For a full-payment GCE Visit the papers appear immediately.
- [x] Line 159 (decision 8): add `custodian_role` (`marketing_specialist|confidential_informant`) to the release
  record, set from the seller's original method (GCE Visit → MS, Meet-up → CI). Add "Papers returned" for the CI on a
  failed sale: sets items back to `on_hold` and the handover to `returned`, with an audit entry.

Dependencies: none.

Done when
- [x] Sell offer without the signed-copies tick is rejected (UI and 422); MS sees the tick.
- [x] Deed of Sale accepts Expired.
- [x] Seller papers show On Hold before sale and Released after; a returned sale shows On Hold again
  (`PapersCustodyTest.php`).
- [x] Request Paper Release shows the seller-origin images to the Sales Manager; another car's papers return 403.

← Previous: Phase 4 | Next: Phase 6 →

---

## Phase 6 — Finance, field budget, negotiation and reconditioning wording

Status: ✅ Done

Goal: one-click fund release, explicit excess-return choices, hidden-issue deduction at negotiation, and the
reconditioning wording the client asked for.

Tasks
- [x] Line 190: `FinanceController::advance` accepts `approve_release`: approve and release in one `DB::transaction`,
  one `financial_entries` disbursement row, idempotent on retry. `finance-client.tsx` shows one "Approve & Release"
  button; keep "Release" for requests already approved. Extend `DisbursementTest.php`.
- [x] Line 191: test that a release lowers Cash on hand and leaves Revenue unchanged (`FinanceLedgerTest.php`). If the
  Finance summary shows a Revenue figure that the client reads as balance, label it "Revenue (sales)" next to "Cash
  on hand".
- [x] Lines 163, 192, 209–213: `FieldBudgetCard` and `PurchaseFundsCard` show two choices: "Excess budget to return"
  (amount input) and "Budget was exact for the trip" (no input), then "Record Excess Return". Exact → existing zero
  path (`returned_cents = 0`, system-confirmed) plus a read-only "No excess return" row in Head Accountant Finance,
  with no action button. Positive → existing confirm flow.
- [x] Line 164: `PurchaseFundsCard` and the excess-return screen show the vehicle (stock code, year make model) and
  seller.
- [x] Line 208: change `FIELD_EXPENSE_CATEGORIES` (`src/lib/transactions/field-budget.ts:24-31`) labels to Gas, Toll
  Fee, Parking, Other possible expenses, and drop Meals and Transportation fare from new requests. Keep the old values
  in the backend `in:` rule so old rows still display.
- [x] Line 207: remove `field_case_expenses` and `expense_proof` from staff buy-transaction read responses and UI;
  keep them on the field case for CI and Mechanic. Extend `FieldCaseExpensesTest.php`.
- [x] Line 170: in `sell-flow-panel.tsx` second negotiation, show the structured inspection result and "Hidden-issue
  deduction" = sum of hidden-issue repair costs, next to the approved revised ceiling.
- [x] Line 182: rename the reconditioning "Complete reconditioning" button to "Finalize Repair" (`reconditioning-panel.tsx:471`;
  update `src/tests/e2e/t01-phase5-branches.spec.ts:234`). No new transition.
- [x] Line 179 (decision 10): when a car leaves reconditioning, set its showroom condition label to the agreed term;
  show it on the showroom detail.
- [x] Line 237 (decision 11): make the part name editable on prefilled reconditioning rows; keep `result_id`.
- [x] Line 193 (decision 12): Head Accountant reconditioning detail shows each repaired part's result with the
  completion photo, labelled "After reconditioning", separate from the field inspection.

Implementation notes
- Line 207 found a real leak: `expense_proof` documents filed on a buyer meet-up came back on the staff buy
  transaction read. `StaffTradingReadController::show` now drops them for buy transactions.
- Both excess-return cards share `src/components/transactions/excess-return-choice.tsx`.
- Line 193: the Head Accountant's reconditioning card lists the job's repaired parts (name, brand, cost, photo) once
  the job is completed. No new completion-photo field was added; the part photos are the ones in the repair report.
- Line 179: the showroom shows a "Reconditioned" badge; `vehicles.condition` is set on Finalize Repair.

Dependencies: none. Line 237 and 193 touch the same `reconditioning-panel.tsx`; do them together.

Done when
- [x] One click approves and releases; a retry leaves Cash on hand unchanged.
- [x] Both return choices work; exact budget creates a "No excess return" row with nothing to receive.
- [x] Budget checklist shows Gas, Toll Fee, Parking, Other possible expenses.
- [x] A buy transaction response contains no field expense proofs.
- [x] Second negotiation shows the deduction; the button reads "Finalize Repair" and the car moves to Ready for
  Pricing.

← Previous: Phase 5 | Next: Phase 7 →

---

## Phase 7 — Buying guide and regression checks

Status: 🟡 In Progress (browser walk pending)

Goal: finish the buying guide wording and re-test the items the notes mention again.

Tasks
- [x] Line 110 (decision 7): steps 1–4 in `src/lib/transactions/buying-requirements.ts` state the payslip rule.
- [x] Line 146: confirm `PaymentRules::downPayment` uses the vehicle's total price (`final_price`), not the price
  after discounts or fees; add a test for ₱500,000 → ₱50,000.
- [ ] Regression walk with Playwright MCP for the Done items the notes repeat: no Google Maps links (`grep -ri
  "google.com/maps" src backend/app` empty), Mechanic status options, overall vehicle status field in
  reconditioning (line 238), and the full no-issue selling flow (line 242).

Implementation notes
- The payslip rule is in Step 3 of `src/app/(customer)/buying-requirements/page.tsx` (the steps live there, not in
  `buying-requirements.ts`).
- `PaymentRulesTest::financing_amounts_match_the_loan_calculator` already asserts ₱500,000 → ₱50,000, and every
  caller passes `final_price`. No change needed.
- `grep -ri "google.com/maps" src backend/app` is empty.

Dependencies: Phases 4–6.

Done when
- [x] Buying guide states the payslip rule.
- [x] Downpayment test passes.
- [ ] No-issue selling flow completes end to end with no change in behaviour.

← Previous: Phase 6

---

## Verification

Per phase: `npm run check:fix`, `npm run test`, `php artisan test` against `gce_test`, plus the focused tests named in
each phase. Before release: `npm run build:static` and a Playwright MCP walk of both supplier paths, a buy and sell
halfway with a pin beyond the radius, a failed paper handover, and both excess-return choices. Update
`docs/test-sheets/` after implementation.

## Execution note

This file plans the work only. Start implementation on a separate request, after the client answers the decisions
above or accepts the defaults.
