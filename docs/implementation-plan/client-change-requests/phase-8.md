[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)

**Status:** 🔲 Not Started

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

- [ ] Migration `supabase/migrations/00065_t03_vehicle_purpose_owner_number.sql`: `vehicles.purpose TEXT`,
  `vehicle_requests.purpose TEXT`, `sell_details.owner_number SMALLINT CHECK (owner_number >= 1)`, and allow
  `transaction_documents.document_kind = 'issue_photo'` if the kind is constrained.
- [ ] Add `src/lib/vehicles/catalog.ts`: `VEHICLE_PURPOSES`, and a `BRAND_MODELS` map of common PH-market brands to models.
- [ ] Add `src/components/brand-model-combobox.tsx` built on `ui/combobox.tsx`: Brand and Model fields, search filter,
  model list follows the chosen brand, typed values not in the list are kept.
- [ ] Unit test the combobox: filtering, free-typed brand kept, model list changes with brand.
- [ ] C2/C3/C5: Request a Car — label "Brand", use the combobox, add the purpose `Select`; add `purpose` to
  `requestCarSchema` and `submitRequestCar`.
- [ ] C4: Request a Car — after a budget is entered, show a "Cars within your budget" list from `runRecommendation`
  linking to showroom vehicles.
- [ ] C6/C7: Sell a Car — use the combobox; replace the year number input with a year `Select` (current year down to 1980).
- [ ] C8: condition options "Brand New" and "Second Hand" in the form and `sellVehicleSchema` (keep the existing
  detailed options only if the client still wants them; record the choice here).
- [ ] C10: owner number `Select` (1st, 2nd, 3rd, 4th or more) saved to `sell_details.owner_number`.
- [ ] C12: merge "Existing vehicle issues" and "Known issues checklist" into one checklist from
  `inspection_checklist_nodes`, plus "Others" that shows a required text box; save into `declared_issues`.
- [ ] C9: issue photo upload (optional, up to 6) shown when any issue is ticked, uploaded with `prepareSellUploads` as
  `issue_photo` documents; staff sell review shows them.
- [ ] C1: Showroom purpose filter in `showroom-grid.tsx`; Marketing vehicle form (`vehicle-form.tsx`) gets a purpose
  `Select` so listings carry one.
- [ ] Update `src/lib/validation/transactions` tests and existing sell/request e2e specs for the new fields.
- [ ] Apply migration 00065 to the hosted Supabase project.

## Done when

- [ ] Request a Car shows "Brand"; typing "Toy" suggests Toyota; typing an unlisted brand and model submits and is stored.
- [ ] Entering a budget lists only cars priced at or below it.
- [ ] Sell a Car saves year, Brand New / Second Hand, owner number, ticked issues, "Others" text and issue photos;
  the Sales Manager sees them on the transaction.
- [ ] Showroom purpose filter shows only vehicles with that purpose.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` exits 0.
- [ ] Both forms walked at desktop and 390px with the Playwright MCP browser tools.

---

[← Previous: Phase 7](./phase-7.md) | [Next: Phase 9 →](./phase-9.md)
