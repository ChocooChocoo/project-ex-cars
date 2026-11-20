# Client revisions from the 2026-11-19 video transcripts — implementation plan

## Context

The client recorded 37 walkthrough videos (4 Google Drive folders) testing the `react-laravel-migration` branch:
`Buying Cash GCE Visit` (8), `Buying Halfway Banktransfer` (8), `Selling No Issue at All` (9) and
`Selling with Issue and Hidden Issue` (12). The transcripts live in the main checkout at
`project-01-car/docs/transcripts/` (`docs/` is gitignored, so they are not in this worktree). The videos report
defects and ask for changes across buying, selling, field cases, finance, papers and maps. This plan turns every
request into concrete work against the current `project-01-car-laravel` code (Next.js static export in `src/`,
Laravel 13 API in `backend/`).

Decisions already made with the user:

- Plan file: `prompts/plans/client-revisions-2026-11-19.md`, saved verbatim (this file).
- GCE office pin: DLSU-D Gate 3, Gov. Dominador Mangubat Blvd, Bagong Bayan, Dasmariñas, Cavite —
  `{ lat: 14.32856, lng: 120.95700 }` (OpenStreetMap node "DLSU-D Gate 3"; DC Park sits beside it, which is the
  "Kaliwa Park" in the transcript). The current `GCE_LOCATION` `{ lat: 14.3294, lng: 120.9367 }` is wrong.
- Halfway meet-up lead time: at least 2 calendar days ahead in Asia/Manila. GCE visit may be booked the same day
  (future slot only).
- Sell vehicle year: 1980 to current year + 1, computed at runtime.

Transcription typos interpreted: "GC / GCA / JCE / DCE" = GCE, "GC EV shift / GCVC" = GCE visit, "EC / eSig" =
e-signature, "confidential informal" = Confidential Informant, "head hunter" = Head Accountant, "Beagle Papers" =
vehicle papers, "self photo" = sell photos, "cabin process" = the buying checklist process, "Move It" = a
ride-hailing app, "LearnMe" and foreign-script fragments = noise.

## Request inventory (traceability)

IDs: BC = Buying Cash GCE Visit, BH = Buying Halfway Banktransfer, SN = Selling No Issue, SH = Selling with Issue.
`V` = video number in that source.

| ID | Source | Request | Phase |
|---|---|---|---|
| BC-1 | BC V1 | Remove "Record invoice" / "Record receipt" buttons | 1 |
| BC-2 | BC V2 | Buyer e-signature stamped on Deed of Sale (cash) or Deed of Sale + Policy & Warranty (financing), signature over printed name | 10 |
| BC-3 | BC V3 | Sales Manager e-signature on GCE-visit papers | 10 |
| BC-4 | BC V4 | Paper release request must not require a Head Accountant payment check for full-payment GCE visits; flow continues to visit → decision → cash → papers → e-sign → sold → HA | 9 |
| BC-5 | BC V5 | Papers status "Released" when handed over; "On Hold" when returned after an unsuccessful sale | 10 |
| BC-6 | BC V5 | Missed-payment policy inside Policy & Warranty; e-sign or print-and-sign option | 10 |
| BC-7 | BC V5 | Sales Manager can open recorded papers, previous owner's Deed of Sale and seller ID copies | 10 |
| BC-8 | BC V6 | Approval only after verification | 9 |
| BC-9 | BC V6 | Mandatory rejection reason, shown to the customer | 9 |
| BC-10 | BC V7 | Small in-app map with GCE pin on every GCE-visit arrangement (buy and sell), pannable, no Google redirect | 2 |
| BC-11 | BC V8 | Showroom detail shows Marketing Specialist details: interior and intended use (e.g. family car) | 11 |
| BH-1 | BH V1 | Halfway meet-up at least 2 days ahead; GCE visit same day | 3 |
| BH-2 | BH V2 | Contract handled by the Confidential Informant, removed from the Mechanic | 7 |
| BH-3 | BH V3 | Zero cash return must not create a Head Accountant record | 7 |
| BH-4 | BH V4 | Finance review shows car, transaction type, down payment / delivery fee status, and rejection reason | 8 |
| BH-5 | BH V5 | Field budget "What it covers" becomes a checklist (fuel, tolls, parking fee, …) | 7 |
| BH-6 | BH V6 | "Downpayment required" auto-computed like financing | 9 |
| BH-7 | BH V7 | Sales Manager sees payment option (Full / Financing) separately from payment method | 9 |
| BH-8 | BH V8 | Buyer halfway: geolocation midpoint map, pin bounded to CALABARZON, address auto-fill (region → barangay, block/lot typed), no Google link, Sales Manager / Marketing Specialist see the pin | 2 |
| SN-1 | SN V1 | Posting form: remove Condition, remove Warranty Details, fix ₱ overlapping the price | 1 |
| SN-2 | SN V2, V3 | Zero excess: no "Confirm excess received"; "No excess / Completed" action; HA gets a fully-paid record | 7 |
| SN-3 | SN V2 | After purchase, Marketing Specialist photographs physical OR, CR, Deed of Sale and sends them to the Confidential Informant | 10 |
| SN-4 | SN V2 | Vehicle papers: seller-origin and buyer-recipient views (tabs), view/print photos, Released / On Hold | 10 |
| SN-5 | SN V4 | Mechanic field-case statuses: drop Assigned / Accepted from the selector; keep In Progress, Completed, Cancelled | 7 |
| SN-6 | SN V4 | Field-case expenses total fetched from itemised expenses | 7 |
| SN-7 | SN V4 | Case notes reflect the real arrangement (GCE visit vs seller meet-up) | 7 |
| SN-8 | SN V4 | GCE visit / zero-expense case completes without "File the meet-up expenses with proofs" | 7 |
| SN-9 | SN V5 | Fund request detail shows seller, agreed price, car, condition, declared issues | 8 |
| SN-10 | SN V5 | Approve / release actually deducts from balances; deductions view with reasons; live updates | 8 |
| SN-11 | SN V6 | Marketing Specialist documents: seller checklist answers replace OR/CR/Deed image verification; IDs and sell photos stay | 4 |
| SN-12 | SN V7 | Year 1980 → future, not hard-coded | Already done (verify only) |
| SN-13 | SN V7, SH V11 | OR/CR/Deed as has / doesn't have / expired checklist with privacy notice and "bring originals" | 4 |
| SN-14 | SN V8 | Customer cannot remove submitted documents unless asked to resubmit | 4 |
| SN-15 | SN V9 | Buying Guide: 2 printed back-to-back copies of IDs with 3 signatures, proof of billing, keep "latest payslip" | 11 |
| SH-1 | SH V1 | Car stuck on "Repairing" after reconditioning finishes | 5 |
| SH-2 | SH V2 | Remove the Sales Manager "papers re-processed" step | 5 |
| SH-3 | SH V3 | Head Accountant sees the mechanic's inspection detail | 8 |
| SH-4 | SH V4 | Parts request pre-filled from the inspection checklist and photos; mechanic adds brand + cost; sent to Head Accountant | 5 |
| SH-5 | SH V5 | Final negotiated price flows to Confidential Informant payment and "Record seller paid" | 6 |
| SH-6 | SH V6 | Second negotiation after CEO approves the revised ceiling; drop recalculated price; agreed price ≤ ceiling | 6 |
| SH-7 | SH V6, V7 | Part-by-part inspection checklist (Good Condition / Needs Repair), declared issues pre-filled, hidden issues, photos, costs; Marketing Specialist sees it | 5 |
| SH-8 | SH V7, V8 | Remove every "Open in Google Maps"; keep in-app geolocation | 2 |
| SH-9 | SH V7 | Meet-up expense only by the Confidential Informant (removed from Mechanic); fund requests CI only | 7 |
| SH-10 | SH V8 | Meet-up expense proofs leak to the customer view | 4 |
| SH-11 | SH V8 | Zero excess shown as zero, no return logging | 7 |
| SH-12 | SH V9 | Marketing Specialist schedule cannot be in the past; halfway location fetched from the seller's pin | 2, 3 |
| SH-13 | SH V10 | Remove the redundant Documents section on the seller's My Transactions | 4 |
| SH-14 | SH V12 | GCE pin on the halfway map is wrong; meet-up pin must stay inside CALABARZON | 2 |

---

## Phase 1 — Removals and quick UI fixes

Status: ✅ Done

Goal: drop controls the client called useless and fix the posting form layout.

Tasks
- [x] BC-1: delete the `["invoice","receipt"].map(...)` "Record invoice / Record receipt" buttons in
  `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx` (~672-690), the
  `onRecordPaperwork` handler in `staff-transaction-detail.tsx` (~284) and `recordPaperwork` in
  `transactions/actions.ts`. Remove `StaffTransactionController::recordPaperwork` and its route. Keep the
  `invoice`/`receipt` document kinds in the DB CHECK (old rows).
- [x] SN-1 Condition: remove the Condition select from `src/app/(staff)/vehicles/_components/vehicle-form.tsx`
  (283-304) and from `vehicleSchema` (`src/lib/validation/vehicles.ts`). In `VehicleWriteController::vehicleColumns`
  stop accepting `condition`; new rows keep the column default (`used`). Remove the Condition row from the showroom
  detail (`showroom/_components/vehicle-detail-page.tsx`).
- [x] SN-1 Warranty: remove the Warranty Details input (vehicle-form.tsx 511-521), its schema and controller rule,
  and its display on the showroom detail. Warranty wording lives in the Policy & Warranty paper (Phase 10).
- [x] SN-1 Price ₱ overlap: replace the absolute-positioned `InputGroup` override on Price (vehicle-form.tsx 469-482)
  with the plain `InputGroup` + `InputGroupAddon align="inline-start"` pattern used by Mileage, so the addon takes
  its own width.

Dependencies: none.

Done when
- [x] No "Record invoice/receipt" buttons on a completed sale; the API route returns 404.
- [x] Vehicle form has no Condition or Warranty Details; showroom detail shows neither.
- [x] Typing `1234567` in Price never overlaps the ₱ sign at 320 px and desktop widths.
- [x] `npm run check:fix`, `npm run test`, `php artisan test` pass (update tests that referenced removed fields).

Next: Phase 2 →

---

## Phase 2 — Maps and location

Status: ✅ Done

Goal: one shared in-app map component, correct GCE pin, CALABARZON-bounded meet-up pins with address auto-fill,
pins visible to staff, and no Google Maps redirects.

Tasks
- [x] SH-14: set `GCE_LOCATION = { lat: 14.32856, lng: 120.957 }` in `src/lib/transactions/sell-flow.ts:25`; update
  the tooltip to "GCE, DLSU-D Gate 3, Dasmariñas, Cavite" and `sell-flow.test.ts`.
- [x] Move `src/app/(customer)/sell-vehicle/_components/meetup-map.tsx` to `src/components/maps/meetup-map.tsx`
  (still loaded only via `next/dynamic` with `ssr: false`). Props: `value`, `onChange`, `editable`, `showGce`.
  Add a read-only variant `src/components/maps/gce-location-map.tsx` (fixed GCE marker, pan/zoom allowed, no drag).
- [x] SH-14 / BH-8 bounds: add `CALABARZON_BOUNDS` (bbox ≈ SW `13.18, 120.56`, NE `15.10, 122.75`) in
  `src/lib/transactions/meetup-area.ts` with `isInCalabarzon(latLng, geocodedRegion?)`. Map uses Leaflet
  `maxBounds` + `maxBoundsViscosity: 1`; `dragend` outside the bbox snaps back with a toast. After reverse
  geocoding, reject the pin when the returned region is not "Calabarzon" (catches Metro Manila and sea, which the
  bbox includes). Add a `ponytail:` note: bbox + geocoded region, upgrade to a CALABARZON polygon if false
  accepts appear. Backend checks the same bbox in `SellIntakeController` and the buy rules (below).
- [x] BH-8 address auto-fill: add `src/lib/maps/reverse-geocode.ts` calling OpenStreetMap Nominatim
  `reverse?format=jsonv2&lat=&lon=&zoom=18&addressdetails=1` on `dragend` only (debounced, at most 1 request per
  second per the Nominatim usage policy). Map `address.state/region`, `province/county`, `city/town/municipality`,
  `suburb/village/quarter` to Region / Province / City-Municipality / Barangay. Show them read-only under the map
  plus a typed "Block, lot, street / landmark" input (geocoding cannot give block/lot reliably). If the lookup
  fails, keep the coordinates and let the user type the address.
- [x] Persist the address: migration adds `meetup_address` (`varchar(500)`, nullable) to `sell_details`, and
  `meetup_lat`, `meetup_lng` (`decimal(9,6)`), `meetup_address` to `purchase_details`. Update models' casts,
  `sellVehicleSchema` / `buyDetailsSchema` and controller rules together.
- [x] BH-8 buyer halfway: in `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`, when
  `arrangement_kind === "meetup"` replace the PSGC `AddressFields` with the shared `MeetupMap` (midpoint of GCE and
  the buyer's device location via `halfwayPoint`, same as selling). `CustomerTradingController::saveBuyDetails`
  validates lat/lng inside the bbox, stores `meetup_*`, and sets `purchase_details.location` to the composed
  address so the existing CHECK and downstream readers keep working. Delivery keeps `AddressFields`.
- [x] BC-10: render `GceLocationMap` whenever the arrangement is GCE visit: buyer form (`transaction-detail.tsx`),
  sell form (`sell-vehicle-form.tsx` when method is `gce_visit`), and the customer transaction detail for both
  kinds. Place it beside / between the arrangement and schedule fields, small (≈ 220 px tall).
- [x] BH-8 / SH-12 staff visibility:
  - `src/app/(staff)/transactions/[id]/_components/sell-flow-panel.tsx`: for `meet_halfway`, drop the free-text
    "Meet-up location" input and show the seller's pin (read-only `MeetupMap`) and `meetup_address`;
    `SellFlowController::recordAgreedPrice` writes `field_cases.location` from `sell_details.meetup_address`
    (fallback "lat, lng") instead of requiring `location`. GCE visit keeps "GCE".
  - Sales Manager buy detail (`transaction-overview-v1.tsx` / `meetup-team-panel.tsx`): show the buyer's pin and
    address for meet-ups.
  - Field cases: `sell-meetup-case.tsx` and `buyer-meetup-case.tsx` show the read-only map.
- [x] SH-8: remove every Google Maps link — `field-cases/[id]/_components/sell-meetup-case.tsx:127-134`,
  `src/components/delivery-last-seen.tsx:18-23`, `src/components/live-location-map.tsx:64-69` — and update
  `share-location.test.tsx` and `live-location-map.test.tsx`. The in-app OSM iframe / Leaflet maps stay.

Dependencies: none (independent of Phase 1).

Done when
- [x] GCE marker sits on DLSU-D Gate 3 on every map.
- [x] A pin dragged into the sea, Metro Manila or abroad is rejected in the UI, and the API returns 422 for
  out-of-bbox coordinates.
- [x] Dropping a valid pin fills Region / Province / City / Barangay; block/lot is typed; values persist.
- [x] The Marketing Specialist sees the seller's pin and is no longer asked to type the halfway location; the Sales
  Manager sees the buyer's pin.
- [x] GCE-visit screens (buy and sell) show the small GCE map.
- [x] `grep -ri "google.com/maps\|Google Maps" src backend/app` returns nothing.

← Previous: Phase 1 | Next: Phase 3 →

---

## Phase 3 — Scheduling rules

Status: ✅ Done

Goal: no impractical or past schedules.

Tasks
- [x] BH-1 frontend: add `MEETUP_LEAD_DAYS = 2` next to `DELIVERY_LEAD_DAYS` in `src/lib/transactions/buy-flow.ts`;
  `SlotPicker` gets `minDays={2}` for `meetup` (GCE visit stays 0, delivery 7) in `transaction-detail.tsx`
  (~840, ~1062).
- [x] BH-1 backend: add `BuyRules::isMeetupDate($at, $requestedAt)` — Manila calendar date of the slot ≥ Manila
  today + 2 — and `MEETUP_LEAD_MESSAGE` ("A halfway meet-up must be booked at least 2 days ahead."). Enforce in
  `CustomerTradingController::saveBuyDetails` and `submitBuyRequest`, and in the meet-up reschedule path.
- [x] SH-12 past dates: Marketing Specialist schedule (`sell-flow-panel.tsx:333-340`) gets `min` = now (Manila);
  better, reuse `SlotPicker` (minDays 0 for GCE visit, 2 for halfway). `SellFlowController::recordAgreedPrice`
  rejects `$schedule <= now()` with "Set a future meet-up date and time." and applies the same 2-day rule for
  `meet_halfway`.
- [x] Same `min` + backend future check on the other staff `datetime-local` scheduling inputs that create field
  work: `field-cases/_components/field-cases-client.tsx:598` and `field-cases/[id]/_components/delivery-case.tsx:204`.

Dependencies: none.

Done when
- [x] At 19:50 today a buyer cannot pick a halfway meet-up before the day after tomorrow (UI and API).
- [x] A GCE visit later today is still accepted.
- [x] A past Marketing Specialist schedule is rejected by UI and API.
- [x] PHP feature tests cover the meet-up lead rule and the past-schedule rejection.

← Previous: Phase 2 | Next: Phase 4 →

---

## Phase 4 — Seller papers privacy and document visibility

Status: ✅ Done

Goal: sellers declare OR/CR/Deed of Sale by checklist instead of uploading them; customers only see their own
customer-facing documents and cannot delete submitted ones.

Tasks
- [x] SN-13: replace the three required uploads in `sell-vehicle-form.tsx` (`OTHER_PAPER_FIELDS`, 88-103) with
  three selects — Official Receipt, Certificate of Registration, Deed of Sale — each `has` / `does_not_have` /
  `expired` (Deed: `has` / `does_not_have`). Add a short notice: "GCE respects the privacy of your vehicle papers.
  Answer this checklist now and bring the originals to the meet-up." Keep the 4 ID images and car photos.
- [x] Store answers: migration adds `papers_checklist` JSON (nullable) to `sell_details`. Add
  `SELL_PAPER_STATUSES` to `src/lib/vehicles/catalog.ts`, the zod rule in `src/lib/validation/transactions.ts`, and
  the matching rule in `SellIntakeController` (drop OR/CR/Deed from `PAPERS` and `filesError`; keep `valid_id`).
- [x] SN-11: `SellFlow::papersVerified` / `sellPapersVerified` (`src/lib/transactions/sell-flow.ts:46-52`) require
  only the two verified IDs (front and back) for new offers; the OR/CR/Deed are inspected on site. Stop
  dispatching `CheckTransactionDocument` for OR/CR on sell intake.
- [x] SN-11: `transaction-documents-card.tsx` for sell offers shows a read-only "Seller's papers checklist" block
  (from `sell_details.papers_checklist`) above the ID cards; ID and sell-photo cards keep Verify / Ask to resubmit.
  Older offers that have uploaded papers still render them (no data migration).
- [x] SH-10: filter documents by audience. Add `TransactionDocument::CUSTOMER_KINDS` = `valid_id`,
  `proof_of_billing`, `sell_photo`, `issue_photo`, `payment_receipt`, `sale_document`, `sale_certificate`,
  `deed_of_sale`, `official_receipt`, `certificate_of_registration`, `orcr`; `CustomerTradingReadController::show`
  (line 110) uses `whereIn('document_kind', CUSTOMER_KINDS)` and, for the buyer side, only CI handover papers that
  belong to the buyer's own sale. `expense_proof` and `inspection_photo` are never returned to customers.
  Add a PHP test that a seller's response contains no `expense_proof`.
- [x] SN-14: remove the customer "Remove" button (`transaction-detail.tsx:1348-1359`), `handleRemoveDocument`,
  `removePurchaseDocument` (action + `CustomerTradingController::removePurchaseDocument` + route). A document can
  only be replaced when staff rejected it (existing `document_resubmission_requested` flow); the checklist shows
  "GCE asked you to resubmit: {reason}" with the upload input.
- [x] Fix the sell re-upload gap: allow `uploadPurchaseDocument` for sell offers when the replaced document is a
  rejected `valid_id` (`CustomerTradingController:128` currently rejects non-buy) and render the ID slots of
  `PurchaseDocumentChecklist` for sell offers in that case.
- [x] SH-13: on the seller's My Transactions, remove the flat "Documents / Uploaded files" section for sell offers;
  show "Your papers checklist" (read-only answers) plus the ID slots only when one needs resubmission. Car photos
  stay in Sell Details.

Dependencies: none.

Done when
- [x] A new sell offer can be submitted with checklist answers and no OR/CR/Deed files; API rejects missing answers.
- [x] Marketing Specialist sees the checklist answers and can propose the ceiling after verifying IDs only.
- [x] A seller or buyer never sees expense proofs or inspection photos.
- [x] No Remove button for customers; a rejected ID can be replaced by a buyer and by a seller.

← Previous: Phase 3 | Next: Phase 5 →

---

## Phase 5 — Inspection checklist and reconditioning

Status: ✅ Done

Goal: the mechanic's seller meet-up inspection becomes the part-by-part checklist; repairs reuse it; repaired cars
leave "Repairing" without a Sales Manager papers step.

Tasks
- [x] SH-7: in `field-cases/[id]/_components/sell-meetup-case.tsx` (Inspection card, 303-366) replace the outcome
  radio + free-text with the existing checklist tree (`inspection_checklist_nodes`, reuse
  `src/app/(staff)/inspections/_components/checklist-form.tsx` pieces). Each part: `good` ("Good condition") or
  `for_repair` ("Needs repair"); `for_repair` requires a repair cost and ≥ 1 photo; optional note. Parts the seller
  ticked in the sell form (`condition_items`) and `declared_issues` are pre-marked and labelled "Declared by
  seller"; anything else marked Needs repair is labelled "Hidden issue". Show the computed total.
- [x] SH-7 backend: `FieldCaseActionController::reportInspection` accepts `results[] {node_id, status, cost, note,
  photos[]}`; requires a status for every leaf part; creates a `vehicle_inspections` row (`field_case_id`,
  `mechanic_id`) and `inspection_checklist_results` rows; photos go to `transaction_documents` as
  `inspection_photo` with the node id in `note`. Derive `inspection_outcome` (any `for_repair` → `issue_found`),
  `repair_estimate` (sum) and `issue_description` (generated list) so existing readers keep working. Migration adds
  `repair_cost` (decimal 12,2, nullable) and `is_hidden_issue` (bool) to `inspection_checklist_results` if absent.
- [x] SH-7 Marketing Specialist view: `sell-flow-panel.tsx` renders the structured result (part, status,
  declared/hidden, cost, photo thumbnails) instead of the text description. Extract this as
  `src/components/transactions/inspection-result.tsx` so Phase 8 reuses it for the Head Accountant.
- [x] SH-4: `src/app/(staff)/vehicles/[id]/_components/reconditioning-panel.tsx` pre-fills one part row per
  `for_repair` result of the car's acquisition inspection (part name and photo fetched, read-only); the mechanic
  enters replacement brand and budget, may add extra rows. `ReconditioningController::submitReport` accepts a
  `result_id` per row and reuses the inspection photo path when no new photo is uploaded. The request still goes to
  the Head Accountant (existing `disbursement_requests` + notification).
- [x] SH-2: remove the "papers re-processed" step — the Sales Manager button and "Waiting for the Sales Manager…"
  text in `reconditioning-panel.tsx` (258-263, 437-453), `ReconditioningController::markPapersProcessed` + route,
  the `papers_processed_at` guard in `VehicleWriteController::proposePrice` (line 111) and the
  `papers_processed_at` condition in `vehicle-operations.tsx:89-93`. Leave the columns.
- [x] SH-1: `ReconditioningController::complete` also moves `vehicles.listing_state` from `repairing` to
  `awaiting_price_approval` (the state the no-issue path already uses for "ready to post"), and a rejected reprice
  in `VehicleWriteController::approvePrice` returns the car to `awaiting_price_approval` instead of `repairing`.
  The "Ready for pricing" filter then reads `listing_state`.

Dependencies: Phase 4 (sell `condition_items` / declared issues read path is unchanged, but the papers change lands
first to avoid conflicts in `sell-meetup-case.tsx`).

Done when
- [x] Inspection cannot be reported while any part lacks a status; Needs repair without cost/photo is rejected.
- [x] Declared and hidden issues are distinguished in the Marketing Specialist view with photos and costs.
- [x] The parts request opens pre-filled from the inspection; mechanic only adds brand and budget.
- [x] Completing reconditioning changes the car from "Repairing" to ready for pricing for every role; no Sales
  Manager step exists.

← Previous: Phase 4 | Next: Phase 6 →

---

## Phase 6 — Second negotiation and final agreed price

Status: ✅ Done

Goal: an approved revised ceiling is a maximum, not the price. The Marketing Specialist renegotiates and records the
real agreed price, which every downstream screen uses.

Tasks
- [x] SH-6: `SellFlowController::createInspectionIssueReport` and its form in `sell-flow-panel.tsx` drop the
  recalculated-price input; the profitable branch needs only `new_ceiling` and seller remarks (the explanation of
  the hidden-issue reduction). Keep `recalculated_price` column nullable for old rows.
- [x] SH-6: after the CEO approves the revised ceiling (`SellFlow::applyCeilingDecision`), notify the seller with
  the remarks ("GCE found issues during inspection; the Marketing Specialist will discuss a revised offer in the
  chat") — never the ceiling amount. The customer counter-offer card (`CustomerTradingReadController.php:96-104`,
  `transaction-detail.tsx:1280-1305`) shows remarks only.
- [x] SH-6: replace "Seller agrees / Seller refuses" (`sell-flow-panel.tsx:536-554`) with "Record second
  negotiation": an "Agreed price (₱)" input (required, ≤ approved revised ceiling, shown as the limit) plus Agree,
  and a Refuse button. `recordSellerResponse` takes `agreed_price`, aborts 422 when above the ceiling ("The agreed
  price cannot exceed the approved ceiling of ₱X."), writes `sell_details.agreed_price` and
  `cleared_for_payment_at`. Refuse is unchanged (`cancelled`, `seller_refused`).
- [x] SH-5: every payment screen reads `sell_details.agreed_price` only: `PurchaseFundsCard` ("Record seller paid
  (₱agreed)"), `FinanceController::requestPurchaseFunds` amount, `Disbursements::completePurchase`, and the CI
  field-case price display. If the purchase fund was requested before the renegotiation, `recordSellerPaid` uses the
  new agreed price and the difference is part of the excess (Phase 7).
- [x] Facts grid in `sell-flow-panel.tsx` shows Asking price, Approved ceiling, Revised ceiling, Final agreed price
  as separate labelled values.

Dependencies: Phase 5 (issue report reads the structured inspection).

Done when
- [x] CEO approval of a ₱415,000 revised ceiling leaves agreed price unchanged and opens the negotiation step.
- [x] Recording ₱400,000 shows ₱400,000 on the CI page, purchase funds and "Record seller paid"; ₱416,000 is
  rejected.
- [x] The seller never sees the ceiling.

← Previous: Phase 5 | Next: Phase 7 →

---

## Phase 7 — Field cases, expenses and zero excess

Status: ✅ Done

Goal: field cases reflect what really happened; no fake zero-value money records.

Tasks
- [x] BH-3 / SN-2 / SH-11 zero excess: in `PurchaseFundsCard` and `FieldBudgetCard` (`field-budget-card.tsx:271-294`)
  show "No excess — mark completed" when the computed excess is 0, and the "Cash returned (₱)" input only when it
  is > 0. `FieldBudgetController::recordReturn` with 0 sets `returned_cents = 0`, `returned_at`, and
  `return_confirmed_at = returned_at` (system-confirmed, `return_confirmed_by = null`) and does not notify the Head
  Accountant. Finance hides "Confirm excess received" when `returned_cents = 0` and shows "No excess". For a
  purchase fund the Head Accountant receives one "Car fully paid" notification with car, seller, agreed price and
  status instead (from `Disbursements::completePurchase`).
- [x] SN-5: `field-cases-client.tsx` update dialog offers only states valid from the current one for field workers:
  `in_progress`, `completed`, `cancelled`. `assigned` is set on creation and `accepted` is set automatically when a
  worker first opens or updates the case (`FieldCaseActionController::updateFieldCase` already writes
  `accepted_at`); `FIELD_CASE_STATES` stays for the DB.
- [x] SN-6: remove the manual "Expenses (₱)" input; display the sum of `field_case_expenses.amount` for the case
  (reuse `expensesCents()` in `src/lib/transactions/field-budget.ts`). `updateFieldCase` stops accepting
  `expenses_cents` and writes the computed sum.
- [x] SN-7: `SellFlowController::recordAgreedPrice` notes become arrangement-specific: GCE visit → "GCE visit.
  Agreed price ₱X."; Meet Halfway → "Seller meet-up (Meet Halfway). Agreed price ₱X." Use the same labels in the
  field-case header.
- [x] SN-8: the completion guard (`FieldCaseActionController.php:72-78`) applies only to `meet_halfway` acquisition
  cases; GCE-visit cases complete without expenses. Halfway cases get an explicit "No expenses for this trip"
  confirmation (stores a zero-amount marker on the case, e.g. `field_cases.no_expenses_at`) that satisfies the
  guard.
- [x] SH-9: meet-up expense filing is Confidential Informant only — `FieldExpensesCard` `canFile` requires the CI,
  `fileFieldExpense` rejects mechanics. Mechanic sees the CI's expenses read-only. Fund requests stay CI only
  (already enforced; add a test).
- [x] BH-2: remove contract controls from the mechanic on `buyer_meetup` cases: `field-case-page.tsx:80-85` no
  longer passes `member = "mechanic"`; drop "Record my signed copy" for the mechanic and the Mechanic entry in
  `BuyRules::missingContractCopies` (lines 134-136). The CI handles the contract and records "Buyer Met"; the
  mechanic's view of a buyer meet-up is the vehicle check only.
- [x] BH-5: `FieldBudgetCard` "What it covers" becomes a checkbox group: Fuel, Tolls, Parking fee, Meals,
  Transportation fare, Other (with a short text when Other is ticked). Add `FIELD_EXPENSE_CATEGORIES` to
  `src/lib/transactions/field-budget.ts`. `FieldBudgetController::request` accepts `categories[]` (validated
  `in:`) + optional `other`, and stores `purpose` as the joined label list so finance screens keep working.
  Apply the same categories to `FieldExpensesCard`'s "Purpose" field.

Dependencies: Phase 6 (excess uses the final agreed price).

Done when
- [x] Zero excess completes with one click; no Head Accountant task is created; positive excess still needs
  "Confirm excess received".
- [x] Mechanic cannot set Assigned/Accepted, cannot file meet-up expenses, sees no contract controls.
- [x] A GCE-visit acquisition case completes with no expense rows; notes say "GCE visit".
- [x] Field case expense total equals the sum of filed expenses.
- [x] Budget request uses the category checklist.

← Previous: Phase 6 | Next: Phase 8 →

---

## Phase 8 — Head Accountant finance context and ledger

Status: ✅ Done

Goal: the Head Accountant decides with full context, and money movements change the numbers.

Tasks
- [x] SN-9 / BH-4: `FinanceReadController::finance` joins each disbursement to its transaction/vehicle and returns
  `context`: vehicle (stock code, year make model), transaction kind and arrangement, seller or buyer name, agreed
  price / final price, condition and declared issues (sell), payment option and method, downpayment and delivery
  fee status (paid / pending / not required, from `payment_records`). `DisbursementDetail` in
  `finance-client.tsx` (~235) renders it with a link to the transaction.
- [x] SH-3: for purchase and reconditioning funds, `DisbursementDetail` embeds the Phase 5
  `inspection-result.tsx` (parts, status, photos, costs) via a Head Accountant-readable endpoint (add
  `head_accountant` to the read gate for the inspection result only, not the `/inspections` page).
- [x] BH-4 rejection reason: store the reason on `disbursement_requests.rejection_reason` (new nullable column) in
  `FinanceController::advance`, and show it to the requester in `FieldBudgetCard`, `PurchaseFundsCard` and
  `ReconditioningPanel` ("Rejected: {reason}").
- [x] SN-10 ledger: write `financial_entries` automatically — `disbursement` entry (negative effect) when a request
  is released, `adjustment` entry when an excess return is confirmed (positive), `expense` entry on reimbursement,
  `revenue` entry when a buy payment is verified. Each entry carries `transaction_id` / `field_case_id` and a
  description (reason). Add a "Cash on hand" summary (opening balance from `app_settings.finance_opening_cents` +
  entries) and a "Movements" tab listing date, type, amount, reason, link. Keep `recordEntry` for manual items.
- [x] SN-10 live updates: add an optional `refreshMs` to `usePageData` (`src/lib/api/use-page-data.ts`) and use 30 s
  on the Finance page (polling is already the app's real-time pattern).

Dependencies: Phases 5 and 7.

Done when
- [x] Every fund request shows car, transaction, parties, prices, payment status and (when relevant) inspection.
- [x] Releasing ₱100,000 lowers Cash on hand by ₱100,000 and lists the movement with its reason; a confirmed
  return raises it.
- [x] Finance figures refresh without reload within 30 s.
- [x] Requesters see the rejection reason.

← Previous: Phase 7 | Next: Phase 9 →

---

## Phase 9 — Buying approval, payment info and paper release

Status: ✅ Done

Goal: Sales Manager decisions are gated and explained; full-payment GCE visits are no longer blocked.

Tasks
- [x] BC-8: server already blocks approval without verified IDs and billing
  (`StaffTransactionController.php:90`). In `transaction-status-triage-v1.tsx` disable Approve until the documents
  card reports two verified IDs (front and back) and a verified proof of billing; show "Verify the IDs and proof of
  billing first." Return a `verified_prerequisites` boolean from `StaffTradingReadController::show` so the UI and
  server use one rule.
- [x] BC-9: rejecting a buy request opens `RejectReasonDialog` (`src/components/reject-reason-dialog.tsx`) instead of
  `ConfirmDialog`; `doTransition` (`staff-transaction-detail.tsx` ~135) sends `reason`. `transition` requires
  `reason` when `to_state = rejected` (`required_if`). Customer side already shows the history reason
  (`transaction-detail.tsx` ~258); add a visible "Reason: …" line on the rejected banner, not only behind "See
  reason".
- [x] BH-7: `transaction-overview-v1.tsx` (~240) shows "Payment option" (Full Payment / Financing) and "Payment
  method" (Cash / Bank Transfer / financing pay method + term) as separate tiles, for every buy transaction.
- [x] BH-6: `meetup-team-panel.tsx:125` "Downpayment required" becomes read-only, prefilled with
  `downPaymentFor(final_price)` (10%, `src/lib/transactions/delivery-fee.ts`) and labelled "Commitment downpayment
  (10% of the price)". `StaffTransactionController::transition` ignores client input and uses
  `PaymentRules::downPayment($price)`.
- [x] BC-4: `HandoverController::requestPapersRelease` (line 108) requires `paymentChecked` only when the sale has an
  upfront payment to verify — financing (initial downpayment) or any arrangement with a downpayment/delivery fee.
  A full-payment GCE visit (cash or bank transfer) may request papers right after approval. Add
  `BuyRules::needsPaymentCheckBeforePapers($d)`. Update `buying-revision-phase2.spec.ts` expectations.
- [x] BC-4 flow: after papers are received, the GCE-visit decision buttons (Buyer declined / Mark sold) stay as
  today; the cash payment is recorded (`PaymentController::record`), then contract e-sign (Phase 10), then "Mark
  Sold" (`Trading::finalizeBuySale` removes the car from the showroom). Add a `sale_completed` notification to the
  Head Accountant from `finalizeBuySale` with car, buyer, price, method so the payment record reaches them.
- [x] BC-4: when a GCE-visit buyer declines after papers were requested, `closeBuyRequest` already sets papers to
  `returned`; Phase 10 relabels that "On Hold".

Dependencies: Phase 2 (buyer meet-up pin data shown on the same page).

Done when
- [x] Approve is disabled until verification; API still rejects early approval.
- [x] Rejecting without a reason is impossible; the customer sees the reason on the request.
- [x] Sales Manager sees "Full Payment · Bank Transfer" / "Financing · PayMongo, 24 months".
- [x] Downpayment required equals 10% and cannot be edited.
- [x] A full-cash GCE visit can request papers with no verified payment and completes to "Sold"; the car leaves
  the showroom and the Head Accountant is notified.

← Previous: Phase 8 | Next: Phase 10 →

---

## Phase 10 — Papers custody, e-signatures and paper templates

Status: ✅ Done

Goal: track where the original papers came from and went, and put the right signatures on the right papers.

Tasks
- [x] BC-5: relabel `sale_handovers.papers_status` in `src/lib/transactions/buy-flow.ts:313-319`: `handed_over` →
  "Released", `returned` → "On Hold". No enum change.
- [x] SN-3: after `Disbursements::completePurchase`, the Marketing Specialist sees "Capture vehicle papers" on the
  sell transaction: one photo each for OR, CR, Deed of Sale (previous owner) plus optional extra pages; saved as
  `transaction_documents` (`official_receipt`, `certificate_of_registration`, `deed_of_sale`) with
  `verification_state = verified`, private storage, compressed via `compressFormFiles`. "Send to Confidential
  Informant" fills `vehicle_document_items` (table exists, unused) per kind with `received_from` = seller and
  `custody` = `with_ci`, and notifies CIs. Migration adds the needed columns to `vehicle_document_items`
  (`source_transaction_id`, `custody_state` `with_ci|released|on_hold`, `storage_path`).
- [x] SN-4: `src/app/(staff)/vehicle-papers/page.tsx` gets two tabs: "From sellers" (car, seller, date received,
  OR/CR/Deed photos with View and Print) from `vehicle_document_items`, and "To buyers" (current `sale_handovers`
  list with buyer). Status badges Released / On Hold on both. `PapersReadController::index` returns both lists.
  Releasing papers for a sale sets the items `released`; a returned handover sets them `on_hold`.
- [x] BC-7: Sales Manager (and CEO, CI) can open the car's papers from the buy transaction: seller-origin photos,
  previous owner's Deed of Sale and the seller's ID copies (read via `FieldReadController::papers` logic, add
  `sales_manager` to `PapersReadController::PAPER_ROLES` for these reads, short-lived signed URLs only).
- [x] BC-2: GCE-visit sales are signed in the app: `BuyRules::needsContract` → true for every arrangement;
  `signsInApp` → `arrangement_kind === 'gce_visit' || (financing && not delivery)`. The buyer's captured
  e-signature (`sale_handovers.signature_path`, `contract-sign.tsx`) is drawn above the printed name on the Deed of
  Sale for every sale and also on the Policy & Warranty for financing. Buyer may instead choose "Print and sign on
  paper" (`signing_method = face_to_face`, existing).
- [x] BC-3: add `sm_signature_path` (nullable) to `sale_handovers`; the Sales Manager signs with `SignaturePad` in
  `handover-panel.tsx` before the buyer signs a GCE-visit sale (`HandoverController::recordSmSignature`, SM/CEO
  only). The GCE representative block uses `sm_signature_path` for GCE visits and `ci_signature_path` for field
  arrangements.
- [x] BC-2 / BC-6 templates (`src/lib/papers/templates.ts` + `paper-document-view.tsx`):
  - Deed of Sale: "Signature over printed name" blocks for BUYER (name printed, signature image above) and SELLER
    (GCE Auto Sales, by representative's printed name + signature).
  - Policy & Warranty: replace the "DRAFT" placeholder with the warranty wording formerly typed per car (Phase 1)
    as the standard policy, append the six missed-payment clauses from `missedPaymentPolicy` (keep
    `missed-payment-policy.ts` as the single source of the rule), and add buyer + GCE signature-over-printed-name
    blocks. Financing only.
  - Signature images render on the sheet itself (not under it); empty lines stay when signing on paper.
  - Policy & Warranty is not produced for full-payment sales.
- [x] Remove the `missed-payment-policy` page as a separate paper only if nothing else links to it; otherwise keep
  it as a print view of the same clauses.

Dependencies: Phase 9 (paper release flow) and Phase 1 (warranty field removed).

Done when
- [x] Vehicle papers shows "From sellers" and "To buyers" with Released / On Hold; returned papers show On Hold.
- [x] Marketing Specialist can capture OR/CR/Deed after purchase; CI can view and print them.
- [x] Cash GCE-visit Deed of Sale prints with buyer and Sales Manager signatures over printed names; financing
  also prints Policy & Warranty with missed-payment clauses and both signatures.
- [x] Sales Manager can open the previous owner's papers and seller IDs from the buy transaction.

← Previous: Phase 9 | Next: Phase 11 →

---

## Phase 11 — Buying guide and showroom details

Status: ✅ Done

Goal: customers know exactly what to bring; buyers see the Marketing Specialist's vehicle details.

Tasks
- [x] SN-15: `src/lib/transactions/buying-requirements.ts` and `buying-requirements/page.tsx` step 1 text:
  "Prepare two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each
  copy signed three times." Step 2: "Prepare one recent proof of billing in your name (electric, water or internet
  bill)." Financing: keep "Payslip (latest)" and add "Bring your latest payslip; GCE checks it during the financing
  review." Mirror in the picker items.
- [x] BC-11: `showroom/_components/vehicle-detail-page.tsx` renders `interior_color` ("Interior") and `purpose`
  ("Best for", e.g. Family Car) — both already in the API response. Add an `interior_features` field
  (`text`, max 1000, nullable; migration + `vehicleSchema` + `VehicleWriteController::vehicleColumns` + vehicle form
  textarea "Interior features, e.g. leather seats, 7 seats, rear AC") and show it under "Interior". Keep
  `description` as the general write-up.

Dependencies: Phase 1 (same vehicle form).

Done when
- [x] Buying guide states the 2 copies × 3 signatures rule, proof of billing and latest payslip.
- [x] Showroom detail shows Interior, Interior features and Best for.

← Previous: Phase 10

---

## Already in place (verify only)

- SN-12: Sell form year already accepts integers 1980 to current year + 1 at runtime
  (`sell-vehicle-form.tsx:64, 318-338`, `transactions.ts:63-67`, `SellIntakeController.php:102`). Re-test that
  decimals, negatives and out-of-range years are rejected; no change unless a test fails.
- BC-8 (server side): approval already requires verified IDs and billing; Phase 9 adds the UI gate only.

## Critical files

- Frontend: `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx`, `.../meetup-map.tsx` (moves),
  `src/app/(customer)/my-transactions/_components/transaction-detail.tsx`,
  `src/app/(staff)/transactions/[id]/_components/{sell-flow-panel,transaction-documents-card,transaction-status-triage-v1,transaction-overview-v1,transaction-detail-sidebar-v1,meetup-team-panel,handover-panel,staff-transaction-detail}.tsx`,
  `src/app/(staff)/field-cases/**`, `src/app/(staff)/finance/_components/finance-client.tsx`,
  `src/app/(staff)/vehicles/_components/vehicle-form.tsx`, `src/app/(staff)/vehicles/[id]/_components/reconditioning-panel.tsx`,
  `src/app/(staff)/vehicle-papers/**`, `src/components/transactions/purchase-funds-card.tsx`,
  `src/lib/transactions/{sell-flow,buy-flow,field-budget,buying-requirements}.ts`, `src/lib/papers/templates.ts`,
  `src/lib/validation/{transactions,vehicles}.ts`, `src/lib/vehicles/catalog.ts`.
- Backend: `backend/app/Http/Controllers/Trading/{SellIntakeController,SellFlowController,CustomerTradingController,CustomerTradingReadController,StaffTransactionController,HandoverController,ReconditioningController,VehicleWriteController,PapersReadController}.php`,
  `backend/app/Http/Controllers/Field/FieldCaseActionController.php`,
  `backend/app/Http/Controllers/Finance/{FinanceController,FinanceReadController,FieldBudgetController}.php`,
  `backend/app/Services/Trading/{BuyRules,SellFlow,Trading}.php`, `backend/app/Services/Finance/Disbursements.php`,
  new migrations in `backend/database/migrations/`.

## Verification

Per phase:
1. `npm run check:fix`, `npm run test` (Vitest), `php artisan test` against `gce_test`. Add or update tests next to
   the changed logic (lead-time rule, bbox check, document audience filter, zero-excess return, agreed-price ceiling,
   paper-release rule, ledger entries).
2. Run the app (`php artisan serve --host=localhost`, `npm run dev`), seeded `<role>@gce.local` accounts, and walk
   the four client scenarios end to end with the Playwright MCP browser tools (wait for `networkidle` before forms):
   - Buying cash GCE visit: request → verify docs → approve (blocked before verify) → request papers without
     payment → cash recorded → SM + buyer e-sign → Deed of Sale shows both signatures → Mark Sold → car gone from
     showroom, HA notified. Repeat with a decline: papers show On Hold.
   - Buying halfway bank transfer: meet-up < 2 days rejected; pin outside CALABARZON rejected; address auto-fills;
     SM sees pin, payment option + method, 10% downpayment; mechanic has no contract controls; zero return creates
     no HA task; finance detail shows context.
   - Selling no issue: checklist papers (no uploads); MS sees checklist; GCE visit field case completes with no
     expenses; zero excess "No excess"; MS captures papers → CI "From sellers" tab; posting form without
     Condition/Warranty and with a clean ₱ field.
   - Selling with hidden issue: full checklist inspection; MS and HA see parts/photos/costs; revised ceiling →
     second negotiation ₱400,000 (₱416,000 rejected over ₱415,000) → payment uses ₱400,000; reconditioning
     pre-filled → complete → car leaves Repairing; customer never sees expense proofs.
3. Update the client test sheets in `docs/test-sheets/` for the changed flows after implementation.

## Execution note

First step after approval: save this plan, unedited, to `prompts/plans/client-revisions-2026-11-19.md` in the
`project-01-car-laravel` worktree. Implementation of the phases starts only on a separate explicit go.
