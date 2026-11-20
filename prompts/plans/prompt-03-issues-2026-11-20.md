# Prompt 03 — system issues and enhancements — implementation plan

## Context

`prompts/prompt-03.md` lists 7 client items (8 rows in its summary table) against the `react-laravel-migration`
branch: one critical sell-submit bug, a contract data bug, a pending Buying Guide revision, media viewer tweaks for
the Marketing Specialist, an APK download button, a theme-adaptive sidebar logo and a realistic data set.

Decisions already made with the user:

- Plan saved verbatim at `prompts/plans/prompt-03-issues-2026-11-20.md`.
- Buying Guide: the payslip is **required for every buyer** (not only In-House Financing).
- 360° zoom: switch the spin frames to `object-contain` (no code zoom ever existed; every version used
  `object-cover` in an `aspect-[4/3]` box, which crops the car).
- Test data: no survey file exists. Create a realistic data set ourselves. Seeded records must read as real
  business records — no "demo", "test", "sample", "lorem" or similar wording in any seeded value.

Phase order follows priority: Critical → High → Medium → Low.

---

## Phase 1 — Sell request "Too Many Attempts" (Critical)

Status: ✅ Done

Root cause (confirmed in code): every numeric `throttle:N,1` middleware shares one rate-limit bucket per user.
`ThrottleRequests::handle()` keys on `$prefix . sha1(user id)`, and the prefix is empty unless given. A sell
submit sends 1 × `POST trading/sell/prepare-uploads` + 1 `POST trading/uploads` per file (up to 6 photos + 4 ID
images + issue photos, sequential loop in `sell-vehicle-form.tsx:279-308`) + 1 × `POST trading/sell`
(`throttle:10,1`). With 10 files the bucket holds 11 hits before the final call, so `trading/sell` always returns 429.

Tasks
- [x] Give each numeric throttle its own bucket with Laravel's third (prefix) argument in `backend/routes/api.php`,
  e.g. `throttle:60,1,uploads`, `throttle:20,1,sell-prepare`, `throttle:10,1,sell-submit`. Apply to every
  `throttle:N,1` route in the file (catalogue, thumbnail, webhook, avatar, recommendations, supplier posts,
  messages, reports, payments, clock-in/out, employee requests, security evidence, email links), one distinct
  prefix per route group, so no other screen can trip the same bug.
- [x] Sell uploads: raise `trading/uploads` to fit one full form plus a retry (`throttle:120,1,uploads`); keep
  `trading/sell` at 10/min on its own bucket.
- [x] Frontend: on a 429 from `submitSellVehicle`, show "Too many requests. Wait a minute and submit again." instead
  of the raw `Too Many Attempts.` (check the shared API error mapper in `src/lib/api/` first; fix there if it maps
  all 429s). The mapper keeps a rate limiter's own message (e.g. "Too many emails sent").
- [x] PHP feature test: a customer uploads 10 files, then submits the sell request in the same minute → 201, not 429.

Done when
- [x] A sell offer with 6 photos, 4 IDs and declared issue photos submits on the first try.
- [x] `grep -n "throttle:[0-9]*,[0-9]*['\"]" backend/routes/api.php` returns nothing (every numeric throttle has a
  prefix).
- [x] `php artisan test` passes (265 tests).

Next: Phase 2 →

---

## Phase 2 — Signed contract missing signatures and buyer name (High)

Status: 🟡 Code complete, production record not diagnosed

Data path: `src/app/(staff)/vehicle-papers/[transactionId]/contract/page.tsx` → `paper-pages.tsx` `usePaper`
→ `GET /api/v1/papers/{id}/contract` → `PapersReadController::show` (`:143-184`) + `signatures()` (`:193-209`) →
`src/lib/papers/templates.ts:196-258` → `paper-sheet.tsx:34-36`.

Tasks
- [ ] Diagnose first on the reported transaction `b25d6eae-7558-4867-992e-37b1503cca55` (local DB copy or a
  read-only query on the host): `sale_handovers` (`signature_path`, `sm_signature_path`, `sm_signed_by`,
  `ci_signature_path`, `papers_ci_id`, `signing_method`, `contract_state`), `purchase_details.arrangement_kind`,
  the buyer's `profiles.full_name`, and whether the signed URL returns 200. Record which case applies before editing.
  Not in the local database; the client asked to verify with test sales instead.
- [x] Buyer name: store the typed name. Migration adds `signed_name` (`varchar(150)`, nullable) to
  `sale_handovers`; `CustomerTradingController` (`:559-565`) writes it with `signature_path`. `PapersReadController`
  prints `profiles.full_name`, falling back to `signed_name`.
- [x] Sales representative signature: `signatures()` picks the GCE signer by arrangement only
  (`sm_*` for GCE visit, `ci_*` otherwise). Change to: use whichever GCE signature exists, preferring the one for the
  arrangement (`sm_signature_path ?? ci_signature_path`, signer `sm_signed_by ?? papers_ci_id ?? assigned CI`).
  `HandoverController` CI signing (`:331`) also writes `papers_ci_id` so the name resolves.
- [x] Gap for in-app buyer signing on meet-up/delivery: nobody from GCE signs. Let the Sales Manager sign from
  `handover-panel.tsx` for every arrangement (drop the `gce_visit`-only guard at `HandoverController:362` and in
  `BuyRules::needsSmSignature` for signing; keep CI field signing as is). The contract shows "Sales Representative"
  over the signer's printed name. `BuyRules::needsSmSignature` still marks the visit-only sequence, because the
  buyer's own signing gate depends on it.
- [ ] Signed URLs: `FileService::signedUrl` builds on `config('app.url')`. Confirm production `APP_URL` is the
  `api.` origin (host `.env`, no commit). If the diagnosis shows the file missing on disk, report it; do not invent
  a signature.
- [x] Face-to-face (`signing_method = face_to_face`) keeps empty signature lines by design; the printed buyer name
  must still show.
- [x] PHP test: buyer e-signs a meet-up sale, Sales Manager signs → contract response has `buyerUrl`, `gceUrl`,
  `gceName` and the buyer's full name.

Dependencies: none.

Done when
- [ ] The reported contract shows sales representative signature, buyer signature and buyer full name.
- [x] Same for a new GCE-visit sale and a new meet-up sale signed in the app (PHP tests open both signed URLs).

← Previous: Phase 1 | Next: Phase 3 →

---

## Phase 3 — Buying Guide wording (Medium)

Status: ✅ Done

Client note (`docs/GCE System – Process & Revision Notes.md:109-110`): steps 1–4 must state 2 printed copies of
each valid ID with 3 signatures, and that a payslip is required for every buyer.

Tasks
- [x] `src/app/(customer)/buying-requirements/page.tsx` (steps array `:11-36`): step 3 now says "Prepare your
  latest payslip, whatever your payment method. For In-House Financing, GCE also checks it during the financing
  review."
- [x] `src/lib/transactions/buying-requirements.ts`: the payslip is a base document for every payment method;
  the financing note says GCE also checks it.
- [x] The payslip is a required buyer document for every buy request: `TransactionDocument::BUYER_REQUIRED_KINDS`,
  the submit gate in `CustomerTradingController`, `StaffTransactionController::verifiedPrerequisites` and its
  document state, the upload validation and the `transaction_documents` check constraint (migration 15).
  Customer and staff checklists, the guide and the approval hint all show it.
- [x] `prompts/plans/process-revision-notes-2026-11-20.md` decision 7 is "required for every buyer".

Done when
- [x] Guide steps 1–4 state the 2 copies × 3 signatures rule, proof of billing and the payslip for every buyer.
- [x] A cash buyer is asked for a payslip; submission and approval wait for it (PHP + unit tests).

← Previous: Phase 2 | Next: Phase 4 →

---

## Phase 4 — Direct APK download on the landing page (Medium)

Status: ✅ Done

Tasks
- [x] `src/app/(external)/page.tsx` hero CTAs: "Download Mobile App" with a `Download` icon, a plain `<a download>`.
- [x] `src/lib/routing/htaccess.ts` `buildHtaccess`: `AddType application/vnd.android.package-archive .apk` and a
  `<FilesMatch "\.apk$">` `Content-Disposition: attachment` rule, before the signed-out redirect. Unit test added.
- [x] `public/assets/apk/gce-app-release.apk` is staged for the commit so it ships in `out/`.

Done when
- [x] Signed out, clicking the button on `/` starts the APK download with no navigation (`landing.spec.ts`).
- [x] `out/.htaccess` contains the `.apk` rules after `npm run build:static`.

← Previous: Phase 3 | Next: Phase 5 →

---

## Phase 5 — Realistic seeded data (Medium)

Status: ✅ Done

Seeded values are synthetic by design: 31 customer profiles, 45 vehicles, 23 purchases, 10 sell offers, matching
payments, installments, field cases and reviews. `DatabaseSeeder` refuses to run outside `local`/`testing`.

Tasks
- [x] Customer base: 30 customer accounts plus `customer@gce.local`, Filipino names,
  `firstname.lastname@gce.local` emails, `09XX XXX XXXX` phones and CALABARZON addresses with barangays
  (`backend/database/seeders/CustomerSeedData.php`).
- [x] Buyer profiles: budget band, preferred body type, intended use, payment preference, monthly income band and
  occupation. Favourites, inquiries, buy requests and recommendation runs are chosen from them.
- [x] Sellers: 10 customers sell cars; asking prices sit 5–15% above GCE's ceiling, mileage matches the year, and
  declared issues are in owner language.
- [x] Vehicles: 45 PH-market units with year/variant/transmission/fuel/price pairs.
- [x] Transactions: spread across customers, with a realistic state mix, matching payments, installments, field
  cases, messages and reviews.
- [x] Wording sweep: seeded values have no demo/test/sample wording; the PDF copy says "GCE document copy".
- [x] Fixed seed kept; `SchemaParityTest` proves two fresh seeds match.

Done when
- [x] `php artisan migrate:fresh --seed` on the test database succeeds twice with identical data.
- [x] Customer list, showroom, transactions, finance and reports have varied records (seeded counts asserted).
- [x] The wording grep returns nothing in seeded values.

← Previous: Phase 4 | Next: Phase 6 →

---

## Phase 6 — 360° zoom out and remove interior images (Marketing Specialist vehicles)

Status: ✅ Done

`/marketing_specialist/vehicles/<id>` renders the shared `src/components/vehicle-media-viewer.tsx` (also used on
the customer showroom).

Tasks
- [x] 360° spin frames use `object-contain` on the existing `bg-muted` stage, so the whole car fits at any width.
- [x] Interior removed everywhere: the viewer mode/tab and its five tests, the upload option and `INTERIOR_SHOTS`
  in `vehicle-media-manager.tsx`, `"interior"` in `vehicle-media` kinds, `staff/vehicles/{id}/media` validation and
  both catalogue reads (`VehicleMedia::VISIBLE_KINDS`).
- [x] Existing `interior` rows are kept in the database and simply not returned; `interior_color` /
  `interior_features` text stays.

Done when
- [x] The 360° view shows the whole car with no cropping at mobile and desktop widths (Playwright checks both).
- [x] No Interior tab or upload option anywhere; the API rejects `kind=interior` with 422.

← Previous: Phase 5 | Next: Phase 7 →

---

## Phase 7 — Theme-adaptive sidebar logo (Low)

Status: ✅ Done

One sidebar serves staff, customer and supplier portals: `src/app/(staff)/_components/sidebar/app-sidebar.tsx`.

Tasks
- [x] The wordmark is the supplied light/dark image pair, switched by the `.dark` class (CSS only, no reload). The
  collapsed sidebar keeps the compact `GceLogo`, so the narrow state still fits. The auth pages are unchanged.
- [x] `public/assets/logo/` is staged for the commit.

Done when
- [x] Light mode shows the light logo, dark mode the dark logo, and toggling the theme switcher swaps it instantly
  in every portal (Playwright covers staff, customer and supplier portals).

← Previous: Phase 6

---

## Critical files

- Backend: `backend/routes/api.php`, `backend/app/Http/Controllers/Trading/{PapersReadController,
  CustomerTradingController,HandoverController,StaffTransactionController}.php`,
  `backend/app/Http/Controllers/Catalogue/StaffVehicleController.php`, `backend/app/Services/Trading/BuyRules.php`,
  `backend/database/seeders/{UserSeeder,DemoDataSeeder}.php`, one new migration (`sale_handovers.signed_name`).
- Frontend: `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx`,
  `src/app/(customer)/buying-requirements/page.tsx`, `src/lib/transactions/buying-requirements.ts`,
  `src/lib/papers/templates.ts`, `src/app/(staff)/transactions/[id]/_components/handover-panel.tsx`,
  `src/app/(external)/page.tsx`, `src/lib/routing/htaccess.ts`, `src/components/vehicle-media-viewer.tsx`,
  `src/app/(staff)/vehicles/[id]/_components/vehicle-media-manager.tsx`, `src/lib/vehicles/media-kinds.ts`,
  `src/app/(staff)/_components/sidebar/app-sidebar.tsx`.
- Assets to commit: `public/assets/apk/gce-app-release.apk`, `public/assets/logo/*`.

## Verification

1. Per phase: `npm run check:fix`, `npm run test`, `php artisan test` (isolated `gce_test`).
2. Run the app (`php artisan serve --host=localhost`, `npm run dev`) and check with the Playwright MCP browser tools
   (wait for `networkidle` before forms):
   - `customer@gce.local`: sell offer with 6 photos + 4 IDs + issue photos submits first try (PHP feature test,
     `SellPapersTest`).
   - Contract page of a fresh meet-up and GCE-visit sale: both signatures + buyer name render (PHP feature test,
     `RulesTest`); the reported transaction is still to be checked in production.
   - `/customer/buying-requirements`: payslip stated for every buyer; a cash buy request asks for it (unit + PHP
     tests).
   - `/` signed out: Download Mobile App starts the APK download (`landing.spec.ts`); `npm run build:static` then
     inspect `out/.htaccess` (unit test).
   - `/marketing_specialist/vehicles/<id>`: whole car in 360°, no Interior tab or upload option
     (`prompt-03-ui.spec.ts`).
   - Toggle light/dark/system in staff, customer and supplier portals: logo swaps instantly
     (`prompt-03-ui.spec.ts`).
   - After `php artisan migrate:fresh --seed`: browse customers, showroom, transactions, finance; no
     "demo/test/sample" wording (`SchemaParityTest`).
3. Update the affected client test sheets in `docs/test-sheets/` after implementation
   (`docs/test-sheets/prompt-03.md`).

## Execution note

First step after approval: save this plan, unedited, to `prompts/plans/prompt-03-issues-2026-11-20.md`.
Implementation starts only on a separate explicit go.
