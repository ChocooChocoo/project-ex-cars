[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** Done for implementation and scoped verification (2026-10-31). The Playwright walk-through and the full
`check:fix` / `tsc` / `test` / `build` suite are outside this phase's verification budget and remain open.

Status note (2026-10-31): implemented and verified as described below.

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

- [x] One-time script `scripts/build-psgc.mjs`: fetch PSGC (psgc.gitlab.io/api) and write `public/psgc/regions.json`,
  `provinces.json`, `cities.json` and `barangays/{cityCode}.json`, with names and codes only. Commit the output and
  record its size here.
- [x] Migration `supabase/migrations/<timestamp>_t05_profile_address_parts.sql` (+ `.test.ts`): add `region_code`,
  `province_code`, `city_code`, `barangay_code` and `address_line` (max 200) to `profiles`. Keep `profiles.address`
  as the composed string, so autofill (`src/lib/autofill/index.ts:20`) and the delivery location keep working.
- [x] `src/lib/validation/profile.ts`: add the new fields. Region, city and barangay are required. Province is
  optional, because NCR has no provinces.
- [x] `updateOwnProfile` (`src/app/auth/actions.ts:618`): save the parts and compose `address` as "Block/Lot,
  Barangay, City, Province, Region".
- [x] `src/components/profile/profile-forms.tsx:238-307`: cascading shadcn `Select`s that fetch `/psgc/*.json`.
  Changing a level clears the levels below it.
- [x] `src/components/profile/load-own-profile.ts:18`: load the new fields.

## Implementation and verification (2026-10-31)

- PSGC build: `node scripts/build-psgc.mjs` fetched 17 regions, 81 provinces, 1,634 cities/municipalities and
  42,046 barangays from `https://psgc.gitlab.io/api`. Committed output under `public/psgc/`: 1,637 files,
  1,858,322 bytes (1.77 MB) — `regions.json` 728 B, `provinces.json` 5,358 B, `cities.json` 149,667 B and 1,634
  `barangays/{cityCode}.json` files. Names and codes only; nothing was hand-edited after generation.
- Migration `supabase/migrations/20261101120000_t05_profile_address_parts.sql` adds `address_line`, `region_code`,
  `province_code`, `city_code` and `barangay_code`, plus a 200-character cap on `address_line` and a nine-digit
  check on each code. `profiles.address` is untouched, so autofill and delivery keep reading it. Existing rows keep
  NULL codes; the form asks for the parts on the next save. Not applied to a database.
- Validation: region, city and barangay are required and a province is optional. `composeAddress` joins
  "Block/Lot, Barangay, City, Province, Region" and skips the province when its code is empty (NCR).
- UI: `src/components/profile/address-fields.tsx` holds the four cascading selects and the Block and Lot input.
  Region, province and city lists load once from `/psgc/`; barangays load per city. Each level clears the levels
  below it (covered by `selectRegion`/`selectProvince`/`selectCity` tests). Lower levels stay disabled until the
  level above is set; a load failure shows an alert with a Retry and leaves the rest of the form usable.
- Commands run:
  - `npx --no-install vitest run src/lib/psgc/address.test.ts src/lib/validation/profile.test.ts src/app/auth/actions.profile.test.ts supabase/migrations/20261101120000_t05_profile_address_parts.test.ts`
    → 4 files, 36 tests passed.
  - `npx --no-install biome check <changed files>` → clean, no fixes applied.
- Not run, by the phase's verification budget: the Playwright walk-through, the repo-wide `npm run check:fix`,
  `npx tsc --noEmit`, the full `npm run test` and `npm run build`.
- Assumption: the profile page is shared by every role, so staff pick the same fields; an older free-text
  `profiles.address` is shown under the dropdowns until the parts are saved, because it cannot be mapped to codes.

## Done when

- [x] Schema tests: an NCR address saves without a province, and an address with no barangay is refused.
- [ ] Playwright MCP: the buyer picks CALABARZON → Laguna → a city → a barangay, types Block/Lot and saves. After a
  reload the choices are kept, and the delivery location autofill shows the composed address. Deferred: browser
  steps are outside this phase's verification budget.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass. Deferred: only the scoped
  vitest and biome runs above were allowed for this phase.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
