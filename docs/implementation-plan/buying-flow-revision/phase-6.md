[← Previous: Phase 5](./phase-5.md)

**Status:** 🔲 Not Started

# Phase 6: End-to-end verification

**Goal:** every scenario in the client doc, including its "Also try" refusals, passes in Playwright.

## Tasks

- [x] Scenario specs exist to extend: `src/tests/e2e/scenario-8-financing-meetup.spec.ts`, `scenario-9-financing-delivery.spec.ts`, the `t01-phase2` to `t01-phase6` specs, helpers in `src/tests/e2e/support/t01.ts`.
- [ ] Extend `support/t01.ts` with helpers for papers, contract, team assignment and Pay.
- [ ] Update `t01-phase2-onsite-visit`, `t01-phase3-halfway-queue`, `t01-phase4-delivery`, `t01-phase5-financing`, `t01-phase6-bank-transfer` and the branch specs to the new steps.
- [ ] Rewrite `scenario-8` (no downpayment) and `scenario-9` (reordered) to the doc.
- [ ] Add the "Also try" refusals per scenario: schedule, resubmission, papers, contract, role refusals.
- [ ] Run `npm run check:fix`, `npm run test`, then `npm run dev` and `npm run test:e2e`.
- [ ] Walk Scenario 1 and Scenario 9 by hand with the seeded `@gce.local` accounts.

## Dependencies

- Phases 1 to 5.

## Done when

- [ ] `npm run check` reports no errors.
- [ ] `npm run test` passes.
- [ ] `npm run test:e2e` passes for all seven doc scenarios plus bank transfer.

[← Previous: Phase 5](./phase-5.md)
