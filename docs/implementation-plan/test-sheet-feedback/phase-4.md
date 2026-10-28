[← Previous: Phase 3](./phase-3.md)

**Status:** 🔲 Not Started

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

- [ ] #14: As the Marketing Specialist, open a sell offer and check that condition, owner number, ticked issues,
  Others text and issue photos all show. If any is missing, fix it in
  `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx`. Change step 7 of the sheet to
  the Marketing Specialist.
- [ ] #12: Prepare one buy request for the Buyer account with a recorded, unverified payment. Rewrite the steps with
  the exact path: Transactions → open the buy request → scroll to **Payment Records** → Reject.
- [ ] #13: Prepare one rejected request with a reason, so the test does not depend on #12.
- [ ] #2: Remove the "Subscribed or Plan" wording and describe what the tester should see instead.
- [ ] #5: Add a note: yes, the Marketing Specialist picks Purpose when adding or editing a vehicle (Vehicles → Add
  vehicle → Purpose).
- [ ] #17: Keep the test. Confirm the E2E delivery case still exists, and recreate it if needed.
- [ ] Add tests for Phases 1-3: password rule, profile photo and layout, customer email change.
- [ ] Republish the "GCE Change Requests Test Sheet" artifact (`d2cb09aa-1c2e-4661-aee2-6a29210a5464`) with the
  changed tests. Clear saved answers only for changed tests, so passed ones stay. Leave #11 untouched.
- [ ] Update `GCE-CHANGE-REQUESTS-FEEDBACK.md` with what changed per item.

## Done when

- [ ] Each changed test is walked once in the Playwright MCP browser on the deployed site and works as written.
- [ ] The artifact is republished and the link is shared with the owner.
- [ ] The client re-tests, and every item is "Works" or its new feedback is logged.

---

[← Previous: Phase 3](./phase-3.md)
