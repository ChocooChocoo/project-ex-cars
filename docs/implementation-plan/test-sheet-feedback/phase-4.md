[← Previous: Phase 3](./phase-3.md)

**Status:** 🟡 In progress (2026-10-28). Everything is done locally; the deployed-site walk waits for the owner to push and deploy.

# Phase 4: Test sheet fixes and re-test

**Goal:** The client can re-test every item that failed or confused them, with clear steps, and gets answers to their
questions.

Source: test sheet feedback #2, #5, #12, #13, #14 and #17, plus re-tests for Phases 1-3. #11 (cheque or deposit
photo) is out of scope by the owner's decision.

## Background

- #2: No "Subscribed" or "Plan" is left in the dashboard code. The sheet's wording confused the tester.
- #5: Purpose is already a field in the Marketing Specialist's vehicle form
  (`src/app/(staff)/vehicles/_components/vehicle-form.tsx:290`, `VEHICLE_PURPOSES`). No code is needed.
- #12: Reject is in the **Payment Records** card on a buy request
  (`src/app/(staff)/transactions/[id]/_components/transaction-payments-table-v1.tsx:153`). The tester could not find
  it.
- #13: Marked "Not sure" only because #12 was skipped.
- #14: The Marketing Specialist already has `transactions` access (`src/lib/auth/roles.ts:266`) and runs the sell
  flow (test #15 passed as Marketing Specialist). Step 7 named the wrong role.
- #17: Not answered yet.

## Dependencies

- Phases 1-3 done and deployed to Vercel.

## Tasks

- [x] #14: As the Marketing Specialist, open a sell offer and check that condition, owner number, ticked issues,
  Others text and issue photos all show. If any is missing, fix it in
  `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx`. Change step 7 of the sheet to
  the Marketing Specialist.
- [x] #12: Prepare one buy request for the Buyer account with a recorded, unverified payment. Rewrite the steps with
  the exact path: Transactions → open the buy request → scroll to **Payment Records** → Reject.
- [x] #13: Prepare one rejected request with a reason, so the test does not depend on #12.
- [x] #2: Remove the "Subscribed or Plan" wording and describe what the tester should see instead.
- [x] #5: Add a note: yes, the Marketing Specialist picks Purpose when adding or editing a vehicle (Vehicles → Add
  vehicle → Purpose).
- [x] #17: Keep the test. Confirm the E2E delivery case still exists, and recreate it if needed.
- [x] Add tests for Phases 1-3: password rule, profile photo and layout, customer email change.
- [x] Republish the "GCE Change Requests Test Sheet" artifact (`d2cb09aa-1c2e-4661-aee2-6a29210a5464`) with the
  changed tests. Clear saved answers only for changed tests, so passed ones stay. Leave #11 untouched.
- [x] Update `GCE-CHANGE-REQUESTS-FEEDBACK.md` with what changed per item.

## Done when

- [ ] Each changed test is walked once in the Playwright MCP browser on the deployed site and works as written.
- [x] The artifact is republished and the link is shared with the owner.
- [ ] The client re-tests, and every item is "Works" or its new feedback is logged.

## Status notes (2026-10-28)

- All checks ran on localhost:3000 against hosted Supabase, because the owner asked not to push yet. The code from
  Phases 1-3 is not deployed. The "Done when" walk on the deployed site is still open.
- #14: as Buyer, submitted sell offer `#e679def3` (Honda City 2018) with 2 ticked parts, Others text and 2 issue photos.
  The Marketing Specialist sees condition, owner number, "Declared issues: Engine Block; Cylinder Head; Others: ..."
  and two "Issue photo" documents. No code change.
- #12: as Head Accountant, recorded a ₱25,000 Bank Transfer downpayment, left unverified, on `#e0dd00f7`
  (E2E Test P5-FINANCE; its contract is signed). Rejected two extra payments (₱10,000 and ₱5,000) to walk the steps:
  the dialog blocks an empty reason, the row turns Rejected without a reload (about 6 s on the dev server), and the
  Buyer sees both amounts crossed out as "Not accepted".
- #13: the Marketing Specialist rejected `#e679def3` with a reason. The Buyer's "See reason" shows it.
- #17: case `307390ab` (field case `42a75761…`) is In Progress. As Head Security with a mocked location, the page
  showed "Sharing. Last sent 8:52 AM". The Sales Manager and the Buyer (transaction `754f6cc7`) see "Last seen" and
  the map link. Sharing was turned off afterwards.
- Sheet: artifact `d2cb09aa-…` republished (version `1793148961-6918`). Tests #2, #4, #5, #12, #13, #14, #17 and #23
  were edited. Saved answers were deleted only for #4, #12, #13, #14 and #23; #2 was "Works" again and was kept. #11
  was not touched.
- `GCE-CHANGE-REQUESTS-FEEDBACK.md` has a "Changes after feedback" table.
- #17 developer test (2026-10-28, 09:18): on case `307390ab`, the blocked-location message showed, sharing worked
  with a mocked location, and Mark Arriving kept the switch. The Buyer saw "Last seen" and the map link.
  `share-location.test.tsx` and `delivery-location.test.ts` pass (9 tests). Step 5 (Mark Delivered) was left for the
  client because it closes the only test delivery; the other two "In Progress" deliveries are not dispatched yet. The
  sheet's #17 note says so.

---

[← Previous: Phase 3](./phase-3.md)
