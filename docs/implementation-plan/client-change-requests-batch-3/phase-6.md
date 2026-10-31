[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** 🔲 Not Started

# Phase 6: Structured customer address

**Goal:** The customer profile has dropdowns for Region, Province, City and Barangay, plus a free-text Block and Lot
field.

Source: `docs/tasks/T05.md` (Sales Manager: customer profile and pricing).

Decision (2026-10-29): bundle the official PSGC data as JSON in `public/psgc/`, loaded on demand. No new npm package
and no outside service at runtime.

Today: one free-text `profiles.address` (`supabase/migrations/00001_phase1_schema.sql:14`), validated by
`addressSchema` (`src/lib/validation/forms.ts:40-43`).

## Dependencies

- None

## Tasks

- [ ] One-time script `scripts/build-psgc.mjs`: fetch PSGC (psgc.gitlab.io/api) and write `public/psgc/regions.json`,
  `provinces.json`, `cities.json` and `barangays/{cityCode}.json`, with names and codes only. Commit the output and
  record its size here.
- [ ] Migration `supabase/migrations/<timestamp>_t05_profile_address_parts.sql` (+ `.test.ts`): add `region_code`,
  `province_code`, `city_code`, `barangay_code` and `address_line` (max 200) to `profiles`. Keep `profiles.address`
  as the composed string, so autofill (`src/lib/autofill/index.ts:20`) and the delivery location keep working.
- [ ] `src/lib/validation/profile.ts`: add the new fields. Region, city and barangay are required. Province is
  optional, because NCR has no provinces.
- [ ] `updateOwnProfile` (`src/app/auth/actions.ts:618`): save the parts and compose `address` as "Block/Lot,
  Barangay, City, Province, Region".
- [ ] `src/components/profile/profile-forms.tsx:238-307`: cascading shadcn `Select`s that fetch `/psgc/*.json`.
  Changing a level clears the levels below it.
- [ ] `src/components/profile/load-own-profile.ts:18`: load the new fields.

## Done when

- [ ] Schema tests: an NCR address saves without a province, and an address with no barangay is refused.
- [ ] Playwright MCP: the buyer picks CALABARZON → Laguna → a city → a barangay, types Block/Lot and saves. After a
  reload the choices are kept, and the delivery location autofill shows the composed address.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
