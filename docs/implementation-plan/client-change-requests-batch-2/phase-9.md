[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)

**Status:** ✅ Done (2026-10-29). Original phase committed as `21d5d42`; recovery follow-up is tracked separately below.

> 2026-10-29: Started with `/implement-phase`. This phase has no dependencies inside the plan.

# Phase 9: Selling — post after selling and interior photos

## Recovery follow-up (2026-10-29)

**Follow-up status:** Implemented and migration applied to the approved development database; browser verification attempted but blocked.
The original phase acceptance record below is unchanged.

The user authorized this separate follow-up after the Phase 10 prerequisite review. Previously, a failed vehicle
update could leave the disbursement paid and the sell completed while the car remained in `draft`; repeating the
action then failed with "Cannot move from paid to paid."

- [x] Add `20261029110000_atomic_purchase_disbursement.sql`: authenticated Head Accountant-only database function,
  fixed empty search path, request and transaction row locks, and one transaction covering payment/event recording,
  sale completion/history, posting-queue entry and notifications. Any database error rolls back all those writes.
- [x] Allow already-paid purchase retries to repair the old partial-completion state without duplicate paid events,
  completion history or role notifications. Preserve cars already beyond draft and non-selling purchase behavior.
- [x] Route purchase-paid actions through the function in `src/app/(staff)/finance/actions.ts`. Ordinary disbursements
  retain their existing path. Revalidate finance, transaction and vehicle views after success.
- [x] Verify action regressions and migration contracts: action tests failed before implementation, then passed.
  `npm run test -- --maxWorkers=2`: 111 files, 712 tests passed. The unrestricted run overlapped the production build
  and had timeout-related failures; the limited-worker rerun passed without changing unrelated tests.
- [x] `npx tsc --noEmit` and `npm run build` passed. Targeted Biome checks passed for the three changed TypeScript files.
- [x] Execute the SQL in an isolated PGlite database with a minimal schema: successful completion and repeated retry,
  injected failures at events/transaction/history/vehicle/notification writes followed by successful retries, legacy
  paid/approved and paid/completed recovery, preservation of an already-listed car, non-selling purchase behavior,
  invalid states, unauthorized callers, and anonymous execute restrictions all passed. This checks the SQL's behavior,
  not full hosted-schema integration or production concurrency. No repository dependency was added.
  Proof harness: `C:/Users/marka/AppData/Local/Temp/opencode/purchase-rpc-proof/proof.mjs` (temporary, not committed).
- [x] Apply the migration to the approved development database before deploying the application change.
  > 2026-10-29: With the user's explicit permission, applied only
  > `20261029110000_atomic_purchase_disbursement.sql` to the linked development project
  > `nsdwyxwrsmtarrxgzeuj` through its pooler on port 6543. Confirmed the database URL and application URL match
  > the linked project before execution. Migration and permission checks ran in one transaction and committed.
  > Verified the exact installed function body, SECURITY DEFINER, empty search_path, denied anonymous execution,
  > granted authenticated execution, and rejection of an unauthenticated invocation. Requested a PostgREST schema
  > reload. No business records changed. Applied directly through `pg`, consistent with the earlier Phase 9
  > migration; this does not claim a Supabase CLI migration-history entry.
- [ ] Verify the paid action and retry through the hosted application. No hosted records were changed for this fix.
  > 2026-10-29: Attempted through Playwright MCP on localhost:3000 against the configured hosted development backend,
  > with visible UI actions only. Signed in as Head Accountant and inspected all 4 disbursement pages. The already-paid
  > one-peso test purchase (`a58398c5-01f9-4a43-adc8-75ecdb1eb7a8`) has a details dialog with only Close; no visible Retry
  > control. Draft purchase transaction `b6cfbc56-39ff-4ea6-8ccb-78d692d8ea65` returned 404. Draft purchase transaction
  > `abdd42ef-50f3-4815-a4a9-a569b4021b4b` returned 500 and the runtime error "Jest worker encountered 2 child process
  > exceptions, exceeding retry limit", also after browser refresh. Did not mark an unverified purchase paid or invoke
  > hidden APIs. Payment completion, duplicate suppression and failure recovery are therefore NOT browser-verified.
  > No product code or business records were changed during the attempt. Evidence is recorded in Phase 10's browser
  > verification note and `test-results/phase-10-browser-errors.log`.

Deploy the migration before the server action that calls it. Do not deploy the action alone. Phase 10's confirmed
scope and deferred client decisions are tracked separately in `phase-10.md`; this follow-up does not reopen the
original Phase 9 acceptance record.

**Goal:** A car bought from a seller goes straight to the posting queue (S2). The showroom shows interior photos in
their own tab (S3), and staff have a free guide for taking them (S4).

## Dependencies

- None inside this plan

## Tasks

- [x] **S2:** When a sell transaction is marked paid and becomes `completed` (`src/app/(staff)/finance/actions.ts:249-272`),
  move its vehicle `draft` → `awaiting_price_approval` and notify the Marketing Specialist.

  > 2026-10-29: Done and tested in the browser (see the Done-when note below). In `advanceDisbursement`, when the seller is paid and
  > the sell becomes `completed`, the vehicle moves to `awaiting_price_approval`. The update only matches a car still in
  > `draft`. If a car moved, the Marketing Specialist gets a `sell_vehicle_ready_to_post` notification.
  >
  > Gap found and fixed: the "Propose Price" menu item showed only for `draft` and `repairing` cars. A car arriving as
  > `awaiting_price_approval` with no proposal would have been stuck. `vehicles-columns.tsx` now shows it for
  > `awaiting_price_approval` too. `proposePrice` already refuses a second pending proposal.
  >
  > Test: `src/app/(staff)/finance/actions.test.ts`, 3 cases. It failed before the change and passes after.
- [x] Price approval and publishing (`available` + `posted_at`) — already in `src/app/(staff)/vehicles/actions.ts:130-143,208`.
- [x] **S3:** Migration `<ts>_t04_vehicle_media_interior.sql` adding `'interior'` to the `vehicle_media.media_kind`
  CHECK (`00003_phase2_schema.sql:46`), with a test file.

  > 2026-10-29: Added `supabase/migrations/20261029100000_t04_vehicle_media_interior.sql`, which replaces
  > `vehicle_media_media_kind_check`. Its test file checks the new constraint, that it matches `VEHICLE_MEDIA_KINDS`,
  > and that the migration only replaces the constraint. 3 passed. Applied to the dev database on 2026-10-29 with
  > `scripts/run-migration.mjs`, with the user's permission ("Migration completed successfully."). Port 5432 is blocked
  > on this network, so it ran through the Supabase pooler on port 6543.
- [x] **S3:** Accept `interior` in the upload action (`src/app/(staff)/vehicles/actions.ts:300-335`) and the upload UI.

  > 2026-10-29: Done and tested in the browser (see the Done-when note below). `uploadVehicleMedia` checks the kind with
  > `isVehicleMediaKind` from the new `src/lib/vehicles/media-kinds.ts`. The constant lives there because a server
  > action cannot import values from a `"use client"` file. The Kind select in `vehicle-media-manager.tsx` now has an
  > "Interior" option, and the media badges and counts include interior photos.
- [x] **S3:** Add an "Interior" tab next to 360 / Gallery in `src/components/vehicle-media-viewer.tsx:139-158`. Show it
  only when interior photos exist.

  > 2026-10-29: Done and tested in the browser. The viewer builds its tabs from the media the car has:
  > 360° needs 3 or more frames, Gallery needs photos, and Interior needs interior photos. The tab bar appears when
  > there is more than one tab. Changing tabs goes back to the first photo. The tabs now have `aria-pressed`, a visible
  > focus ring and a 44 px tap height on mobile. The carousel arrows now have the labels "Previous photo" and
  > "Next photo".
- [x] **S4:** Add help text on the upload form with a fixed interior shot list: dashboard, front seats, rear seats,
  odometer, trunk and roof lining. Shoot with a phone camera in landscape; phone panorama mode is a free option.

  > 2026-10-29: Done and tested in the browser. When "Interior" is the chosen kind, the upload form shows a numbered
  > shot list and a note on phone landscape and panorama shots. The existing 360° help line had an em dash; it is now
  > a colon.
- [x] Unit tests: the completed-sell transition, and the viewer showing the Interior tab only when interior media exist.

  > 2026-10-29: `src/app/(staff)/finance/actions.test.ts` (3 cases) and `src/components/vehicle-media-viewer.test.tsx`
  > (5 cases). Both failed before the change. `npm run test`: 110 files, 706 tests passed. `npx tsc --noEmit` is
  > clean.

## Done when

- [x] Completing a sell purchase in the browser moves the vehicle to the Marketing Specialist's awaiting-approval list.

  > 2026-10-29 browser test (Playwright MCP, by clicking and typing as each user):
  > 1. Signed in as the Head Accountant. Finance → Disbursements → "Car purchase fund" ₱1, linked to sell
  >    transaction `a58398c5` (state Approved, Honda City 2022).
  > 2. Clicked Release, then Receive, then Mark Paid. The toasts confirmed each step: "Disbursement released."
  >    and "Disbursement marked paid."
  > 3. Signed in as the Marketing Specialist. The bell shows "Bought car ready to post" ("just now"), which links
  >    to the transaction.
  > 4. Vehicles → Status filter "Awaiting Approval" went from 3 cars to 4. The new one is `SELL-HON-MUQLWM1L`
  >    (Honda City 2022, 78,900 km, no price yet).
  > 5. Its actions menu shows "Propose Price". Submitting ₱520,000 showed "Price proposal submitted."
  > 6. The transaction page now shows "Completed · Completed Oct 29, 2026".
  >
  > Test data left in the database: that disbursement is now paid, transaction `a58398c5` is completed, and a ₱520,000
  > selling-price proposal is pending for `SELL-HON-MUQLWM1L`.
  >
  > Note, outside this phase: the Marketing Specialist's Vehicles list has no link to a car's detail page, which is
  > where media are uploaded. Today that page is reached only from the CEO's pending-approval "View" link.
- [x] Interior photos upload and show in their own tab on `/customer/showroom/[id]`.

  > 2026-10-29 browser test (Playwright MCP, by clicking and typing as each user), on Honda Brio `GCE-012`:
  > 1. Baseline as the Customer: the car has 3 gallery photos and no tab bar, because it has no interior photos.
  > 2. As the Marketing Specialist on the car's page: chose Kind "Interior". The shot list appears with the 6 shots
  >    and the phone tip. Uploaded `public/assets/img/image.png` 3 times. Each upload showed "Interior photo uploaded.",
  >    and the count reads "3 photo(s) · 3 interior photo(s)".
  > 3. As the Customer: the tabs read "Gallery | Interior", with Gallery selected. Interior shows only the
  >    `interior-*.png` files, and "Next photo" moves to the next interior photo. Real clicks through the Gallery
  >    showed only `photo-1/2/3.png`, so no interior photos are in it.
  > 4. Keyboard: Tab reaches the Gallery tab with a visible 2 px focus ring, and Enter switches to it
  >    (`aria-pressed` goes true).
  > 5. At 390 px wide: no horizontal overflow, and both tabs are 44 px tall. Dark mode and light mode both render
  >    correctly. The customer's dark theme was set back afterwards.
  > 6. Cleanup: as the Marketing Specialist, deleted the 3 test interior photos ("Media deleted."). The count is back
  >    to "0 interior photo(s)" and the 3 gallery photos are untouched.
  >
  > Bugs found during the test and fixed, all in `vehicle-media-manager.tsx`:
  > - After one upload, choosing the same file again did nothing, because the input kept its old value and no change
  >   event fired, so Upload stayed disabled. The input is now cleared after each upload. Re-tested: picking the same
  >   file twice in a row uploaded both.
  > - The media thumbnails had zero height (Next.js warned "has 'fill' and a height value of 0"). The tile now holds
  >   the `aspect-[4/3]` ratio, and the thumbnails show. This bug existed before this phase.
  > - The Kind select had no accessible name, and neither did the file input or the delete buttons. Added
  >   `htmlFor`/`id`, `aria-label="Media file"`, and `aria-label="Delete <kind> #n"`.
  >
  > Console: 0 errors. The only warning is the existing Next.js LCP `priority` hint on the main photo.
- [x] `npm run test` passes, including the migration test.

  > 2026-10-29: `npm run test`: 110 files, 706 tests passed, including the migration test.

---

[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)
