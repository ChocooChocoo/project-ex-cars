[← Previous: Phase 10](./phase-10.md)

**Status:** 🔲 Not Started

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

- [ ] Migration `00068_t03_field_case_price_and_location.sql`: `field_cases.price_status TEXT CHECK (IN
  ('negotiated','displayed_price'))`, `field_cases.updated_price NUMERIC`, `field_cases.discount_amount NUMERIC`,
  `field_cases.last_lat DOUBLE PRECISION`, `last_lng DOUBLE PRECISION`, `last_located_at TIMESTAMPTZ`; CI/head security
  update policies limited to their assigned case.
- [ ] CI3: price status `Select` in `sell-meetup-case.tsx`: "Negotiated" keeps the confirmed price; "Displayed Price"
  shows updated price and discounted amount fields.
- [ ] CI2: `recordFieldPrice(caseId, { status, updatedPrice?, discountAmount? })` in `sell-inspection-actions.ts`
  (assigned CI only, zod-validated, updated price > 0, discount ≥ 0); updates `sell_details.agreed_price` when changed.
- [ ] CI1: when the price changes, `notify()` the Marketing Specialist, Sales Manager and CEO, and show a
  "Price changed at inspection" flag on the transaction and the field case list.
- [ ] Unit tests for `recordFieldPrice` (wrong role refused, negotiated keeps price, displayed price updates and notifies).
- [ ] D1: in `delivery-case.tsx`, a "Share my location" toggle for the assigned courier while status is `in_transit` or
  `arriving`, using `navigator.geolocation.watchPosition`, sending at most once per minute to a new
  `updateDeliveryLocation(caseId, lat, lng)` action in `field-cases/delivery-actions.ts`; stops on `delivered` or toggle off.
- [ ] D1: handle permission denied / unavailable with a visible message.
- [ ] D1: `delivery-panel.tsx` and the buyer's transaction detail show "Last seen {time}" and an
  "Open in Google Maps" link (`https://www.google.com/maps?q={lat},{lng}`).
- [ ] Unit test `updateDeliveryLocation` (assigned courier only, lat/lng range check).
- [ ] Apply migration 00068.

## Done when

- [ ] As the CI, choosing "Displayed Price" with a new price and discount saves them, updates the agreed price, and the
  Marketing Specialist, Sales Manager and CEO receive a notification that opens the transaction.
- [ ] Choosing "Negotiated" leaves the agreed price unchanged.
- [ ] With the browser location mocked (Playwright `geolocation` context option), the courier shares location and the
  staff and buyer views show "Last seen" with a Maps link to those coordinates.
- [ ] Denying location permission shows the message and does not break the page.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` exits 0.
- [ ] Walked with the Playwright MCP browser tools as CI, Head Security and buyer.

---

[← Previous: Phase 10](./phase-10.md)
