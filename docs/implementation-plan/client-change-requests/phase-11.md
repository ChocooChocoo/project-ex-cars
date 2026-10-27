[← Previous: Phase 10](./phase-10.md)

**Status:** ✅ Done

Completed 2026-10-27.

# Phase 11: Field Case price status and delivery geolocation

**Goal:** The Confidential Informant can record a price change during the in-person inspection with a price status
(CI1–CI3), and deliveries show the courier's last known location (D1).

## Dependencies

- Phase 2 complete (Field Cases access final).
- Phase 3 complete (notifications link to the transaction, used for the price-change alert).
- Decision (2026-10-26): browser Geolocation API, last position stored, "Open in Google Maps" link; no map library.

## Background

- CI sell meet-up: `src/app/(staff)/field-cases/[id]/_components/sell-meetup-case.tsx` (CI sees `agreed_price`
  read-only at `:141-142`); actions in `src/app/(staff)/field-cases/sell-inspection-actions.ts`.
- `sell_details.agreed_price` holds the agreed price; `recordSellerResponse` (`transactions/sell-actions.ts:391`) updates it.
- Delivery: `field-cases/[id]/_components/delivery-case.tsx`, `field-cases/delivery-actions.ts` (`advanceDeliveryStatus`
  `:64`), staff `transactions/[id]/_components/delivery-panel.tsx`. `field_cases.delivery_status` is
  dispatched/in_transit/arriving/delivered. No lat/lng columns anywhere.

## Tasks

- [x] Migration `00068_t03_field_case_price_and_location.sql`: `field_cases.price_status TEXT CHECK (IN
  ('negotiated','displayed_price'))`, `field_cases.updated_price NUMERIC`, `field_cases.discount_amount NUMERIC`,
  `field_cases.last_lat DOUBLE PRECISION`, `last_lng DOUBLE PRECISION`, `last_located_at TIMESTAMPTZ`; CI/head security
  update policies limited to their assigned case.
  Named `20261027110000_t03_field_case_price_and_location.sql`. Adds range checks (price > 0, discount ≥ 0, lat/lng).
  Instead of new update policies: both new actions write with the service role after checking the caller is assigned
  to the case (the existing field-case pattern), and trigger `guard_field_case_price_location` stops browser sessions
  from writing the six new columns. The existing "Field workers can update field cases" policy lets any CI or Mechanic
  update any case; narrowing it could break `assignMechanic` / `updateFieldCase`, which use the user client, so it is
  left as is (see Assumptions).
- [x] CI3: price status `Select` in `sell-meetup-case.tsx`: "Negotiated" keeps the confirmed price; "Displayed Price"
  shows updated price and discounted amount fields.
  New "Price at inspection" card. After Displayed Price is saved, Negotiated is no longer offered, so the change cannot
  be hidden; a correction with a new Displayed Price is still allowed.
- [x] CI2: `recordFieldPrice(caseId, { status, updatedPrice?, discountAmount? })` in `sell-inspection-actions.ts`
  (assigned CI only, zod-validated, updated price > 0, discount ≥ 0); updates `sell_details.agreed_price` when changed.
  A Displayed Price equal to the confirmed price is refused ("Choose Negotiated instead"). The updated price becomes the
  agreed price; the discount is stored as entered (not subtracted).
- [x] CI1: when the price changes, `notify()` the Marketing Specialist, Sales Manager and CEO, and show a
  "Price changed at inspection" flag on the transaction and the field case list.
  Notification kind `field_price_changed`. The flag shows in `sell-flow-panel.tsx` (Field inspection), the Kind column of
  `field-cases-table.tsx`, and the CI's case page. The Marketing Specialist cannot open Field Cases (existing RBAC), so
  they see the flag on the transaction.
- [x] Unit tests for `recordFieldPrice` (wrong role refused, negotiated keeps price, displayed price updates and notifies).
- [x] D1: in `delivery-case.tsx`, a "Share my location" toggle for the assigned courier while status is `in_transit` or
  `arriving`, using `navigator.geolocation.watchPosition`, sending at most once per minute to a new
  `updateDeliveryLocation(caseId, lat, lng)` action in `field-cases/delivery-actions.ts`; stops on `delivered` or toggle off.
  "Courier" = any assigned delivery team member (CI, Mechanic or Head Security), the same team that moves the status.
  Toggle in `share-location.tsx`; the parent renders it only while In Transit / Arriving, so Delivered unmounts it and
  clears the watch.
- [x] D1: handle permission denied / unavailable with a visible message.
- [x] D1: `delivery-panel.tsx` and the buyer's transaction detail show "Last seen {time}" and an
  "Open in Google Maps" link (`https://www.google.com/maps?q={lat},{lng}`).
  Shared `src/components/delivery-last-seen.tsx`, also on the team's case page. The buyer sees it only while the car is
  In Transit or Arriving; staff always.
- [x] Unit test `updateDeliveryLocation` (assigned courier only, lat/lng range check).
- [x] Apply migration 00068. `npx supabase db push` (dry run listed only this migration).

## Done when

- [x] As the CI, choosing "Displayed Price" with a new price and discount saves them, updates the agreed price, and the
  Marketing Specialist, Sales Manager and CEO receive a notification that opens the transaction.
- [x] Choosing "Negotiated" leaves the agreed price unchanged.
- [x] With the browser location mocked (Playwright `geolocation` context option), the courier shares location and the
  staff and buyer views show "Last seen" with a Maps link to those coordinates.
- [x] Denying location permission shows the message and does not break the page.
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` exits 0.
- [x] Walked with the Playwright MCP browser tools as CI, Head Security and buyer.
  Walked with Playwright scripts against the dev server (keeps the seed password out of the chat), not step by step
  with the MCP tools. Same browser, same pages.

## Verification (2026-10-27)

| Check | Result |
| --- | --- |
| `npm run test` | 94 files, 592 tests passed |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| Biome on touched files | clean |
| Hosted migration | applied with `npx supabase db push` |
| CI, Displayed Price | case set up with `t01-phase1-selling.spec.ts` (agreed ₱480,000). CI chose Displayed Price, ₱455,000, discount ₱25,000: saved, agreed price now ₱455,000, "Price changed at inspection" shown. 390 px: no overflow, no console errors |
| Notifications | one `field_price_changed` each for marketing_specialist, sales_manager and ceo, pointing at the transaction. Each role clicked it in the bell and landed on the transaction |
| Flags | Marketing Specialist transaction page: flag + "Updated price ₱455,000.00 · discount ₱25,000.00", Agreed price ₱455,000. Field Cases list (CEO and CI): flag on that case only |
| CI, Negotiated | second case: the price fields stay hidden; agreed price stays ₱480,000 |
| D1, sharing | delivery set up with `t01-phase4-delivery.spec.ts`. No toggle while Dispatched. Head Security at In Transit with mocked location 14.5995, 120.9842: "Sharing. Last sent 10:20 AM"; DB has those coordinates |
| D1, viewers | Sales Manager (1280 px) and buyer (390 px): "Last seen Oct 27, 10:20 AM · Open in Google Maps" links to `https://www.google.com/maps?q=14.5995,120.9842`; no overflow |
| D1, denied | Mechanic with permission denied: "Location access is blocked. Allow location for this site in your browser settings, then try again." Switch turns off, Mark Arriving still works, no console errors |
| D1, delivered | after Mark Delivered the toggle is gone (checked after reload) and the buyer no longer sees the map link |
| Guard trigger | a signed-in CI updating `price_status`, `updated_price`, `last_lat` directly: row updated, those columns unchanged |

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| CI, Displayed Price | Case `214fc4ca`: ₱830,000, discount ₱20,000 → "Price updated. The office was notified."; agreed price ₱850,000 → ₱830,000; flag shown | pass |
| Notifications | SM and CEO get "Price changed at inspection", linking to the transaction (`00b64b32`) that shows the flag | pass |
| Flags | Field Cases list (CI, CEO): flag only on the two changed cases; Marketing transaction page shows flag + updated price | pass |
| CI, Negotiated | Case `7d751431`: price fields hidden, "Confirmed price kept.", agreed price stays ₱800,000 | pass |
| D1, sharing | Head Security on delivery `9f769e8b` (Arriving), location 14.2117, 121.1653: "Sharing. Last sent 12:48 PM"; not-dispatched case `3dde6083` has no switch | pass |
| D1, viewers | SM and buyer (390px, no overflow): "Last seen Oct 27, 12:48 PM · Open in Google Maps" → `https://www.google.com/maps?q=14.2117,121.1653` | pass |
| D1, denied | Mechanic: "Location access is blocked. …", switch stays off, Mark Delivered still shown | pass |
| D1, delivered | Not reached: Mark Delivered → "This delivery is no longer active.", because the case's transaction (`17c97d27`) is Cancelled. The page still shows the switch and Mark Delivered, and the buyer still sees the map link on a cancelled transaction | finding |

Screenshot: `test-results/live-phase11-buyer-390.png`.

## Files changed

- `supabase/migrations/20261027110000_t03_field_case_price_and_location.sql` (new), `.test.ts` (new)
- `src/app/(staff)/field-cases/sell-inspection-actions.ts` (`recordFieldPrice`), `field-price.test.ts` (new)
- `src/app/(staff)/field-cases/delivery-actions.ts` (`updateDeliveryLocation`), `delivery-location.test.ts` (new)
- `src/app/(staff)/field-cases/[id]/_components/sell-meetup-case.tsx`, `delivery-case.tsx`, `share-location.tsx` (new),
  `share-location.test.tsx` (new)
- `src/app/(staff)/field-cases/_components/field-cases-client.tsx`, `field-cases-table.tsx`
- `src/app/(staff)/transactions/[id]/page.tsx`, `_components/delivery-panel.tsx`, `_components/sell-flow-panel.tsx`
- `src/app/(customer)/my-transactions/[id]/page.tsx`, `_components/transaction-detail.tsx`
- `src/components/delivery-last-seen.tsx` (new)

## Assumptions and notes

- Updated price = the new agreed price; the discount is recorded as entered. No ceiling check on the updated price
  (the CEO is notified instead).
- The existing "Field workers can update field cases" policy still lets any CI or Mechanic update any field case
  through the API. Not narrowed here (regression risk for `assignMechanic` / `updateFieldCase`); worth a separate fix.
- No server-side rate limit on `updateDeliveryLocation`; the browser sends at most once a minute.
- "Last seen" on the courier's own page and the staff panel updates on reload, not live.

---

[← Previous: Phase 10](./phase-10.md)
