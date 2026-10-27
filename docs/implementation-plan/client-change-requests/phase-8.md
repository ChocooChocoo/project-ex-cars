[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)

**Status:** ✅ Done

Completed 2026-10-26.

# Phase 8: Customer forms — Showroom, Request a Car, Sell a Car

**Goal:** Customer forms get the requested fields: purpose of vehicle (C1, C5), Brand naming and searchable Brand/Model
dropdowns that still allow typing (C2, C3, C6), budget recommendations (C4), year picker (C7), Brand New / Second Hand
(C8), issue photos (C9), owner number (C10) and one merged issues checklist with "Others" (C12).

## Dependencies

- None inside this plan.
- Decisions (2026-10-26): purposes = Family Car, For Business, Personal Use, Daily Commute, Ride-hailing,
  Off-road/Adventure. Budget recommendations = vehicles priced at or below the budget, ranked by existing `rankVehicles`;
  a list only, no automatic reservation.

## Background

- No `purpose` column on `vehicles` or `vehicle_requests`; no owner number on `sell_details`; no brand/model list.
- `src/components/ui/combobox.tsx` (`@base-ui/react`) exists and is unused.
- Request a Car: `src/app/(customer)/request-a-car/_components/request-car-form.tsx` (Make label `:61`, model `:67`,
  budget `:103-118`), `submitRequestCar` (`my-transactions/actions.ts:771-821`), `requestCarSchema`
  (`src/lib/validation/transactions.ts:91-110`).
- Sell a Car: `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx` (make/model `:211-220`, year `:224`,
  condition `:244-248`, issues radio `:287-320`, checklist `:415-460`), `prepareSellUploads` (`actions.ts:563`),
  `submitSellVehicle` (`:612-769`), `sellVehicleSchema` (`validation/transactions.ts:36-89`).
- Showroom: `src/app/(customer)/showroom/_components/showroom-grid.tsx` (Make select `:86-101`).
- Budget ranking: `runRecommendation` in `src/app/(customer)/recommendations/actions.ts:10` uses `rankVehicles`.

## Tasks

- [x] Migration `supabase/migrations/00065_t03_vehicle_purpose_owner_number.sql`: `vehicles.purpose TEXT`,
  `vehicle_requests.purpose TEXT`, `sell_details.owner_number SMALLINT CHECK (owner_number >= 1)`, and allow
  `transaction_documents.document_kind = 'issue_photo'` if the kind is constrained.
  Named `20261026120000_t03_vehicle_purpose_owner_number.sql` (timestamp, like Phases 2/6/7, so it runs last on a
  reset). The kind is constrained, so the check is recreated with `issue_photo`, plus an insert policy
  "Customers can upload own issue photos" (same rules as sell photos). Test: `.test.ts` beside it.
- [x] Add `src/lib/vehicles/catalog.ts`: `VEHICLE_PURPOSES`, and a `BRAND_MODELS` map of common PH-market brands to models.
  Also `modelsFor` (case-insensitive), `OWNER_NUMBERS`, `SELL_CONDITIONS`, `listedYears()`.
- [x] Add `src/components/brand-model-combobox.tsx` built on `ui/combobox.tsx`: Brand and Model fields, search filter,
  model list follows the chosen brand, typed values not in the list are kept. Found live: base-ui cleared unlisted text
  when the popup closed; only typing (`input-change`, `clear-press`) now changes the text.
- [x] Unit test the combobox: filtering, free-typed brand kept, model list changes with brand.
  `src/components/brand-model-combobox.test.tsx` (5 tests). jsdom does not fire base-ui's close-on-blur, so the
  clear-on-close bug was caught and checked in the browser, not by this test.
- [x] C2/C3/C5: Request a Car — label "Brand", use the combobox, add the purpose `Select`; add `purpose` to
  `requestCarSchema` and `submitRequestCar`. Purpose is optional.
- [x] C4: Request a Car — after a budget is entered, show a "Cars within your budget" list from `runRecommendation`
  linking to showroom vehicles. `runRecommendation` saves a recommendation run on every call, so its data loading
  moved into `loadRankInputs` and a read-only `listCarsWithinBudget` uses it with `rankWithinBudget` (engine: price
  > 0 and <= budget, then `rankVehicles`). Top 6, 600 ms after typing stops.
- [x] C6/C7: Sell a Car — use the combobox; replace the year number input with a year `Select` (current year down to 1980).
- [x] C8: condition options "Brand New" and "Second Hand" in the form and `sellVehicleSchema` (keep the existing
  detailed options only if the client still wants them; record the choice here). Choice (no client answer yet): the
  form offers only the two; the old grades and "Other" are gone from the form. The schema still accepts the old
  values, so earlier records and callers keep working. Seller detail now goes in the issues checklist and description.
- [x] C10: owner number `Select` (1st, 2nd, 3rd, 4th or more) saved to `sell_details.owner_number`. Required.
- [x] C12: merge "Existing vehicle issues" and "Known issues checklist" into one checklist from
  `inspection_checklist_nodes`, plus "Others" that shows a required text box; save into `declared_issues`.
  The yes/no declaration stays. "Yes" opens one "Which parts have issues?" group (checklist + Others + issue photos);
  `declared_issues` = ticked names + "Others: …" (`composeDeclaredIssues`), and the node ids still go to
  `condition_items`.
- [x] C9: issue photo upload (optional, up to 6) shown when any issue is ticked, uploaded with `prepareSellUploads` as
  `issue_photo` documents; staff sell review shows them. Shown once the seller declares issues. The server checks
  count, type and path prefix and records them verified. Staff see them in the Documents card as "Issue photo"
  (every document kind is listed and previewed there).
- [x] C1: Showroom purpose filter in `showroom-grid.tsx`; Marketing vehicle form (`vehicle-form.tsx`) gets a purpose
  `Select` so listings carry one. The showroom "Make" filter is now labelled "Brand".
- [x] Update `src/lib/validation/transactions` tests and existing sell/request e2e specs for the new fields.
  `sell-vehicle-form.test.tsx` (condition, owner number, issues UI, helpers); e2e `t01-phase1-selling`,
  `t01-phase1-issue-path`, `task32-client-feedback` now fill Brand, pick Year / Condition / Owner number, and use
  Others, and press Escape after typing a model (the suggestion list otherwise covers the Year field).
  `task32-client-feedback` "sell-vehicle form requires photos" now also declares "no known issue" and a meet-up method
  (required since an earlier phase; the test was already failing on that) and passes. The two long `t01-phase1-*`
  selling flows were edited but not run.
- [x] Apply migration 00065 to the hosted Supabase project. Applied as `20261026120000_t03_vehicle_purpose_owner_number.sql`
  (owner ran `npx supabase db push`).

## Done when

- [x] Request a Car shows "Brand"; typing "Toy" suggests Toyota; typing an unlisted brand and model submits and is stored.
- [x] Entering a budget lists only cars priced at or below it.
- [x] Sell a Car saves year, Brand New / Second Hand, owner number, ticked issues, "Others" text and issue photos;
  the Sales Manager sees them on the transaction.
- [x] Showroom purpose filter shows only vehicles with that purpose.
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` exits 0.
- [x] Both forms walked at desktop and 390px with the Playwright MCP browser tools.

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| `npm run test` | 85 files, 550 tests passed |
| `npx tsc --noEmit` | exit 0 |
| biome on touched files | clean |
| `npm run build` | compiled, exit 0 |
| MCP, Request a Car | "Toy" suggests Toyota; "Zotye" / "T600 Sport" kept after leaving the fields; Honda's models listed after picking Honda |
| MCP, budget ₱700,000 | 6 cars, all ≤ ₱700,000 (top ₱698,000), each links to its showroom page |
| MCP, Sell a Car | years 2026 → 1980; Brand New / Second Hand; 4 owner options; one checklist (51 parts) + Others + issue photos; old checklist gone |
| 1440px and 390px | no horizontal overflow on either form; screenshots `test-results/mcp-phase8-*.png` |
| Hosted migration | applied |
| Request a Car submit (MCP) | `vehicle_requests`: Zotye / T600 P8 / Ride-hailing / ₱650,000; the page opens the new request |
| Sell a Car submit (MCP) | "Vehicle submitted for evaluation!"; DB: Mitsubishi Xpander 2019, condition "Second Hand", `owner_number` 2, `declared_issues` "Pistons; Radiator; Others: P8 test: dent on rear bumper", 2 `condition_items`, 2 `issue_photo` (verified) |
| Sales Manager (MCP) | Sell offer shows Condition, Mileage, Owner number "2nd owner" and the declared issues; Documents card has 2 "Issue photo" cards; one opens large and closes with Escape |
| Marketing (MCP) | Edit vehicle → Purpose "Family Car" → "Vehicle updated."; reopening Edit shows Family Car |
| Showroom (MCP) | 22 vehicles; Purpose "Family Car" → 1 (Honda Brio); "Ride-hailing" → 0 with the empty state |
| e2e `task32-client-feedback` sell test | passed |
| Console errors (MCP) | 0 |
| Final `npm run test` / `tsc` / biome / build | 85 files, 550 tests / exit 0 / clean / compiled |

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| Request a Car | "Toy" suggests Toyota; Honda models listed; "Zotye" / "T600 LIVE-QA" kept; budget ₱700,000 → 6 cars, top ₱698,000, each links to its showroom page | pass |
| Request a Car submit | Saved (Zotye / T600 LIVE-QA / ₱650,000). The first click gave no feedback and no redirect for 30 s, so a second click made a duplicate (`a91d7805`, `4dd76335`) | finding |
| Sell a Car | Years 2026 → 1980; Brand New / Second Hand; 4 owner options; 51 parts + Others; 2 issue photos; "Vehicle submitted for evaluation!" (`c9096cad`) | pass |
| Sales Manager | Condition Second Hand, 45,000 km, "2nd owner", declared issues incl. the Others text; 2 "Issue photo" cards, one opens large | pass |
| Marketing | Edit vehicle (Honda Brio) shows Purpose "Family Car"; save → "Vehicle updated." | pass |
| Showroom | 22 vehicles; Family Car → 1; Ride-hailing → 0 with the empty state | pass |
| 390px | Request a Car and Sell a Car: no page overflow | pass |

## Files changed

- `supabase/migrations/20261026120000_t03_vehicle_purpose_owner_number.sql` (new), `.test.ts` (new)
- `src/lib/vehicles/catalog.ts` (new), `src/components/brand-model-combobox.tsx` (new), `.test.tsx` (new)
- `src/lib/validation/transactions.ts`, `src/lib/validation/vehicles.ts`
- `src/lib/recommendations/engine.ts`, `__tests__/engine.test.ts`, `src/app/(customer)/recommendations/actions.ts`
- `src/app/(customer)/request-a-car/_components/request-car-form.tsx`
- `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx`, `.test.tsx`
- `src/app/(customer)/my-transactions/actions.ts`
- `src/app/(customer)/showroom/_components/showroom-grid.tsx`
- `src/app/(staff)/vehicles/_components/vehicle-form.tsx`, `vehicle-form-sheet.tsx`, `src/app/(staff)/vehicles/actions.ts`
- `src/app/(staff)/transactions/[id]/page.tsx`, `_components/sell-flow-panel.tsx`
- e2e: `t01-phase1-selling.spec.ts`, `t01-phase1-issue-path.spec.ts`, `task32-client-feedback.spec.ts`

## Notes and assumptions

- Found during the walk and fixed: the combobox cleared unlisted text when its list closed; staff could not see the
  owner number, condition or mileage on a sell offer (the sell panel now lists all three); the showroom said
  "1 vehicles".
- The first Request a Car submit stored the request but did not open it; the next submit did (the dev server was
  still compiling that page). Not seen again.
- One issue-photo card showed "Preview unavailable" once; both previews loaded on two reloads. The files are in
  storage, so it was a one-off signing failure in the existing `withSignedTransactionDocumentUrls`.
- Condition grades: see C8 above (form offers Brand New / Second Hand only; ask the client if the grades should return).
- Mechanics and Confidential Informants have read rules for `sell_photo` only, so they do not see issue photos. Add
  `issue_photo` to those rules if the field team needs them.
- Test data on the hosted database: two requests "Zotye T600 P8" (customer@gce.local), sell offer `87acc5d4…`
  (Mitsubishi Xpander 2019, ₱615,000), and Honda Brio (GCE-012) now has purpose "Family Car".

---

[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)
