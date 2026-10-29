[← Previous: Phase 9](./phase-9.md)

**Status:** ✅ Done (confirmed implementation scope, 2026-10-29); deferred decisions remain open. Development migration applied and confirmed-scope browser checks passed. No site deployment performed.

> 2026-10-29: Started with `/implement-phase` after the user approved the recommendations in chat.
> Reviewed Phase 9 and Phase 7 prerequisites. Phase 9 is marked Done, but review identified a payment-to-posting
> recovery gap. This phase records that cross-phase blocker without changing Phase 9 or its implementation.

# Phase 10: Waiting on client

**Goal:** Finish the items that wait on client input: the extra selling process (S1) and the employee working
schedules (E1 data).

## Dependencies

- Phase 9 complete (selling flow changes in place)
- Phase 7 complete (schedule editing works)
- The client's answer on S1, and the working schedules

## Tasks

- [x] **S1 decision:** Client confirmed through the user: stick to the current selling process. No additional selling
  steps, approvals or documents are requested. Keep `src/app/(staff)/transactions/sell-actions.ts` unchanged.
- [x] **E1 data, answered scope:** Apply T05's schedules for active employees in the six specified roles, with new-account
  defaults and browser verification. Implemented by [Batch 3 Phase 5](../client-change-requests-batch-3/phase-5.md).
  Existing employees were backfilled by its migration rather than entered individually through Staff Records.
  CEO hours remain deferred. Head Security is exempt from attendance per the client's later answer, not waiting for hours.
- [ ] Get answers to the remaining open questions in `docs/tasks/T04.md`:
  - [x] Record the user's approved account decision: retain 3 Mechanics and 3 Confidential Informants, with separate accounts.
  - [x] Record the user's approved policy decision: registration only for the current scope; vehicle-ownership declarations remain separate.
  - [x] Record the user's approved payroll direction: retain the proposed ordinary-day overtime rate of 125%, with approved overtime requests.
  - [ ] Obtain accountant confirmation of applicable overtime rates, statutory contributions and permitted manual deductions before real payroll use.
- [x] **Attendance exception:** Exclude Head Security from personal attendance, schedule editing and missing-schedule
  warnings, with application and database enforcement. Preserve historical records and unrelated staff features.

## Latest client answers and confirmed implementation scope

The user supplied these client answers, then instructed proceeding with answered requirements only:

| Item | Client answer | Implementation decision |
| --- | --- | --- |
| Additional selling steps | Initially did not understand the question; subsequently said to stick to the current process. | S1 decision resolved with no selling-code changes. |
| Ordinary overtime | Tentatively considered 125% safe. | Retain the existing demo multiplier and approved-request flow; no claim of accountant approval. |
| Rest days | Requested regular-day pay with no overtime. | Record the request; defer new formulas pending a precise policy. Do not silently apply this as a statutory rule. |
| Holidays | Requested standard Philippine holiday pay, mentioning double pay when working. | Defer holiday formulas; no decision that every holiday is double pay. |
| Deductions | Asked AI to supply the approach because no interview covered it. | Retain configured contribution amounts and existing itemized deductions for the demo. Do not invent statutory rates or add penalties. |
| Head Security | No attendance tracking. | Implement the explicit attendance exemption, preserving role, history, Requests, Field Cases and Security Duty Checks. |
| CEO | Attendance is more for tracking, with no actions. | Ambiguous between own attendance and read-only employee oversight. Preserve current behavior until clarified. |

Real-payroll use remains gated on accountant confirmation. The existing 3 Mechanics/3 CIs and registration-only policy
decisions remain user-approved defaults, not new client statements. CEO behavior, rest-day/holiday formulas and
accountant confirmation remain open deferred decisions, not completed requirements.

## Approved direction (2026-10-29)

The user approved these recommendations in chat. This is project approval, not evidence that the client supplied
the missing selling requirements, employee schedules or accountant confirmation.

| Item | Approved direction | Remaining evidence |
| --- | --- | --- |
| Selling process | Keep the existing workflow unchanged, per the client's latest answer. | No new functionality requested. |
| Accounts | Retain 3 Mechanics and 3 Confidential Informants, each with an individual account. | No new accounts requested in this phase. |
| Overtime | Retain 125% as the proposed ordinary-day rate and require approved overtime requests. | Accountant confirmation before real payroll use; do not assume this rate covers every day type. |
| Deductions | Retain statutory contributions and itemized manual deductions with reasons. Do not deduct late or undertime amounts twice. | Accountant confirmation of permitted deductions and contribution rules. |
| Policy acceptance | Registration-only checkboxes for the current scope. Keep transaction-specific ownership declarations separate. | Future material policy changes require a separately scoped acceptance review, not a new feature in this phase. |
| Schedules | Six specified role schedules applied and browser-verified through Batch 3 Phase 5. Head Security is exempt. | CEO behavior/schedule and any additional break or overnight policy remain deferred. |

## S1 checkpoints to compare with client requirements

These historical review checkpoints are superseded by the client's decision to keep the existing process. They are
not individually approved additions, and their unchecked state does not mean new functionality remains requested:

- [ ] Confirm the client's additions to ownership-document verification.
- [ ] Confirm the client's additions to purchase-ceiling approval.
- [ ] Confirm the client's additions to recording the agreed price and inspection appointment.
- [ ] Confirm the client's additions to inspection findings and any revised price.
- [ ] Confirm the client's additions to recording the seller's acceptance.
- [ ] Confirm the client's additions to payment and vehicle handover.
- [ ] Convert confirmed gaps into implementation tasks here, implement only those gaps, and verify them in the browser.

## Blockers and next steps

1. **Phase 9 follow-up:** Atomic payment recovery is implemented and its migration is applied. Browser recovery
   proof remains blocked by the previously recorded transaction-page failures and absent Retry control. That is a
   separate verification issue; do not describe the repair as unimplemented or change its code in this phase.
2. **S1 resolved:** The client chose the existing process. No additional selling work is required.
3. **E1 data, updated:** T05 and Batch 3 Phase 5 supplied the six-role hours. Those schedules are now applied and
    verified under the user's instruction to implement answered requirements. CEO has no specified schedule and is
    deferred. Head Security is explicitly exempt from attendance, rather than waiting for a schedule. No unspecified
    breaks or overnight shifts were invented.
4. **Payroll:** Project approval retains the proposed behavior, but does not replace accountant confirmation for
   real payroll use.

## Verification and status notes

### Confirmed-scope closeout (2026-10-29)

- S1 is resolved by the client's instruction to retain the current process. No changes were made to
  `transactions/sell-actions.ts`, `lib/payroll/compute.ts`, or `payroll/actions.ts` in this closeout.
- Added `ATTENDANCE_TRACKED_ROLES` in `src/lib/auth/roles.ts`. Head Security remains a staff role with Requests,
  Field Cases and Security Duty Checks, but no Attendance link or Attendance route access. CEO access is unchanged.
- Staff Records' `columns.tsx` now distinguishes staff membership from attendance eligibility. Head Security shows
  "Attendance not required", has no schedule fields in the edit sheet, and no schedule fields in profile-save
  FormData. Its missing-schedule warning is removed without deleting data or hiding the CEO's warning.
- New route, navigation, column and table regressions failed before implementation, then passed. Migration contract
  tests prove all four copied function definitions match the repository baseline except for Head Security exclusions.
- Added and applied `supabase/migrations/20261029130000_t04_head_security_attendance_exemption.sql`. After a read-only
  preflight found no open Head Security shifts, the user explicitly approved applying it to the linked development
  project `nsdwyxwrsmtarrxgzeuj`, including two reviewed live/repository differences: the already-recorded-attendance
  availability check and the approved-leave message. No unrelated migration was applied.
- Before replacement, saved definitions and ACLs to
  `C:/Users/marka/AppData/Local/Temp/opencode/phase10-attendance-functions-before-1793265067557.json`.
  Verified exact installed bodies, preserved ACLs, SECURITY DEFINER and empty search paths, then rechecked them
  through a fresh connection after commit. The migration was applied through `pg`; this does not claim a Supabase
  CLI migration-history entry.
- Live transactional SQL checks confirmed that Head Security's state, clock-in and clock-out RPCs are refused,
  and that a manager cannot assign it a schedule. All checks used rolled-back savepoints; its profile, schedules
  and attendance snapshots remained identical. No business-data changes persisted.
- Isolated PGlite behavioral proof passed: Head Security with a legacy schedule/open shift is refused, history stays
  intact, ordinary profile edits work, forbidden schedule writes roll back, tracked staff clocking works, duplicate
  and checked-entry protections remain, approved leave blocks clock-in, managers retain historical review, and
  execute privileges remain unchanged. The same proof failed against the old functions as expected.
  Temporary harness: `C:/Users/marka/AppData/Local/Temp/opencode/purchase-rpc-proof/head-security-attendance-proof.mjs`.
- `npm run check:fix -- <9 changed TypeScript files>` passed. `npx tsc --noEmit` passed after correcting a test-only
  Testing Library option. `npm run test -- --maxWorkers=2`: **116 files, 746 tests passed**. The first 120-second
  test attempt timed out; the rerun completed in 147 seconds without changing unrelated tests. `npm run build` passed.
- Playwright MCP, using only visible controls and ordinary navigation:
  1. Signed in as Head Security: no Attendance link. Requests, Field Cases and Security Checks all opened.
  2. Typed `/head_security/attendance`: redirected to `/unauthorized`, showing "Unauthorized Access".
  3. As Account Manager, searched Gregorio in Staff Records: active Head Security, "Attendance not required".
     Only Roberto Gonzales (CEO) remained in the missing-schedule alert. Edit showed Full name, Phone and Address,
     with no workdays/time/grace fields. Cancelled without saving.
  4. As an existing Mechanic, the Mon-Sat 07:00-16:00 schedule and clock controls remained available. Did not clock
     real staff in or out. As CEO, existing read-only oversight text and absence of attendance-review buttons were
     unchanged; its own unscheduled self-attendance panel was not redesigned.
  5. After applying the approved migration, repeated Head Security login, absent link and typed-route denial;
     repeated the Account Manager exemption/edit checks; verified the Mechanic's schedule and enabled Clock In.
  6. No browser API calls, injected DOM/application state, forced clocks, new accounts, profile saves or attendance
     writes were used in this closeout. Session cookies changed through normal login/logout. Current-page console
     errors after migration: 0.
- Browser evidence under `test-results/`: `phase-10-head-security-preserved-access.yml`,
  `phase-10-head-security-attendance-denied.yml`, `phase-10-head-security-exempt-staff-record.yml`,
  `phase-10-ceo-oversight-unchanged.yml`, `phase-10-head-security-denied-after-migration.yml`,
  `phase-10-exempt-staff-record-after-migration.yml`, `phase-10-mechanic-after-migration.yml`, and
  `phase-10-after-migration-console-errors.log`.
- Deferred, not completed: CEO tracking interpretation and schedule, paid rest-day policy, regular/special holiday
  formulas, accountant validation of statutory contributions and permitted deductions. The separate Phase 9
  payment-recovery browser issue remains outside this closeout. None of these is silently declared resolved.
- Outcome: confirmed implementation scope complete. This status does not certify real payroll compliance or claim
  that every original question is answered. The Batch 2 closeout is packaged separately from the Batch 3 schedule
  implementation. No push or site deployment is part of this closeout.

### Earlier investigation notes (historical, superseded where noted above)

- 2026-10-29 later update: the user directed implementation of answered questions only. Batch 3 Phase 5 supplies
  the six role schedules, Monday-Saturday and 10-minute grace. Its migration was applied and all 10 original covered
  employees were verified in Staff Records. Missing-schedule count is now 2, for CEO and Head Security only.
  A new labelled test Mechanic received its schedule automatically, clocked in through Playwright at 13:35 PHT,
  showed Late, clocked out, and was archived through the UI. Evidence and passing checks are in Batch 3 Phase 5.
  Earlier statements below about an absent schedule list and 9 missing schedules describe the pre-implementation
  investigation, not current state. S1 and accountant policy confirmation remain deferred, not completed.

- 2026-10-29 browser verification (Playwright MCP, visible controls only): signed out of the existing Marketing
  Specialist session, signed in through the login form as Head Accountant and Account Manager, and used sidebar
  links, search fields, menus, dialogs and buttons. No database scripts, direct API requests, request replay,
  injected application state, forced failures or product-code changes were used for this browser check.
  - Staff Records: searching `mechanic` showed 3 active employees (Arnel Santiago, Noel Ramirez, Eduardo Aquino).
    Searching `confidential` showed 3 active employees (Liza Manalo, Rodel Pascual, Carlos Mendoza).
  - **E1 acceptance remains blocked:** Staff Records displayed "9 employees have no work schedule" and named them.
    The Account Manager's Attendance page showed "No schedule assigned" with Clock In and Clock Out disabled.
    No real schedules were supplied, so none were saved.
  - Opened Liza Manalo's Edit dialog, checked Monday, typed 08:00 and 17:00, then clicked Cancel. Reopening showed
    Monday unchecked and both times blank. Cancel discarded the edit; the missing-schedule count remained 9.
    This verifies editing controls and cancellation, not schedule persistence or actual client schedule accuracy.
  - Payroll opened and its Create Payroll Run dialog opened and cancelled. No payroll run was created and no
    payroll calculation or accountant policy confirmation is claimed by this navigation-only check.
  - Signed out, followed Login's Register link, and submitted the empty registration form. Both policy checkboxes
    showed their specific required-consent errors. Checking both and submitting again cleared those two errors;
    the required name/email/password errors remained. No account was created. Login had no policy checkboxes.
  - **S1 remains untestable against acceptance criteria:** the client's additional selling requirements are still
    absent. Existing screens and registration checks are not evidence that S1 was implemented.
  - Separate Phase 9 payment check was attempted but blocked: the paid one-peso test purchase has only a Close
    control, no visible Retry action. Of the two draft purchase requests found, the linked transaction
    `b6cfbc56-39ff-4ea6-8ccb-78d692d8ea65` returned 404, and
    `abdd42ef-50f3-4815-a4a9-a569b4021b4b` returned HTTP 500 with
    "Jest worker encountered 2 child process exceptions, exceeding retry limit", still present after refresh.
    No purchase was marked paid blindly, and no hidden action was invoked to bypass these failures.
  - Evidence: automatic snapshots under `.playwright-mcp/`, registration validation snapshot
    `test-results/phase-10-registration-validation.yml`, and browser error log
    `test-results/phase-10-browser-errors.log`. Runtime errors were observed; this is not a clean end-to-end pass.
  - Result: **partial verification only; Phase 10 remains Blocked**. No persisted business-data changes were made
    through this browser check. Login/session cookies changed through ordinary sign-in/sign-out.

- 2026-10-29: Documentation-only update to this file. No application code, other phase files, accounts or database
  records changed. Approved decisions were checked against the conversation. Implementation and acceptance
  checkboxes remain open where evidence is missing.
- Tests, lint, typecheck, build and browser checks were not run for this documentation-only update. Historical
  Phase 7/9 results are not claimed as fresh verification.
- Next: resolve the Phase 9 follow-up separately, then obtain the client selling-step details and employee schedule
  list, plus accountant confirmation. Resume this phase only when its blocking inputs are available.

## Done when

The user narrowed implementation to answered requirements. Original criteria (new S1 functionality, schedules for
every staff role, and answers to every open question) are superseded for this scoped closeout, not retroactively passed.

- [x] S1's no-change decision is recorded; the existing selling process is preserved.
- [x] Active employees in the six specified roles have the supplied schedules, verified in Batch 3 Phase 5.
- [x] Head Security attendance exemption is enforced in navigation, routes, Staff Records and protected RPCs, with
  passing tests and normal-user browser evidence after the approved development migration.
- [x] Existing selling/payroll and other staff access pass regression checks.
- [x] Current results, deferred decisions and the real-payroll validation gate are recorded. Use scoped completion
  wording only when the implemented scope is verified; do not claim all original client questions were answered.

---

[← Previous: Phase 9](./phase-9.md)
