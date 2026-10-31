[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)

**Status:** 🟡 In progress

# Phase 4: Leave reason dropdown, proof files and requester name

**Goal:**
- A leave request takes its reason from a dropdown. Free text only for Others.
- A request can have up to 3 optional proof files.
- The Account Manager sees who filed each request and can open the proofs.

Source: client answer on batch 2 test 13 (Clock in and leave requests):
- "sa request tapos leave sir is dapat may reason tapos naka dropdown po yung reason for leave hindi siya typeable,
  pag nag others lang po mag kakaroon ng typeable". In English: the leave reason should be a dropdown, typeable only
  for Others.
- "supporting images for proof of validity ng request".

The requester name issue comes from dev QA on the same test: the Requests table and the review window do not show
who filed the request.

Decision (2026-10-31):
- Leave reasons: Sick, Vacation, Emergency, Bereavement, Maternity/Paternity, Others.
- Proof files are optional, up to 3 per request (JPG, PNG, WebP, PDF, 10 MB each).

Today:
- `employee_requests` (`supabase/migrations/00015_phase6_staff_records.sql:51-64`) has a free-text `reason TEXT NOT
  NULL` and no attachment table.
- The RLS insert policy only checks `employee_id = auth.uid()`. The own-row update policy has no `WITH CHECK`. So a
  staff member can likely insert or update their own request as `approved` through PostgREST.

## Dependencies

- None. Phase 5 builds on this phase's migration.

## Tasks

- [x] Migration `supabase/migrations/<timestamp>_t06_employee_request_fields.sql` (+ `.test.ts`). Write the tests
  first.
  - Add `employee_requests.leave_reason text`, with a CHECK limiting it to `sick`, `vacation`, `emergency`,
    `bereavement`, `maternity_paternity` and `others`.
  - Make `reason` nullable.
  - Add a CHECK: a new `leave` row needs `leave_reason`, and `others` needs a non-empty `reason`. Use `NOT VALID`, so
    legacy rows still pass.
  - Security fix:
    - Insert policy: `WITH CHECK (employee_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL)`.
    - Own-row update policy: `WITH CHECK (status IN ('pending', 'cancelled'))`.
  - New table `employee_request_attachments`: `id`, `request_id` (FK, on delete cascade), `storage_path`,
    `original_name`, `file_kind`, `file_size`, `uploader_id`, `created_at`.
    - RLS: SELECT for the request owner, `ceo` and `account_manager`.
    - Inserts go through the admin client only.
  - New private bucket `request-attachments`: 10 MB, JPEG/PNG/WebP/PDF, `ON CONFLICT DO UPDATE`. Use the same shape
    as `message-attachments` in `20261026130000_t03_customer_counter_offers_attachments.sql:11-22`.
- [x] `src/lib/validation/phase6.ts:12-28`: add `LEAVE_REASONS` and make `employeeRequestSchema` a discriminated union
  on `request_kind`. Write the tests first.
- [x] `src/app/(staff)/employee-requests/actions.ts`:
  - Add `prepareRequestUploads(files)`. It signs upload URLs under `${uid}/${uuid}.${ext}`. Reuse `attachmentError`,
    `attachmentMimeType` and the accept string from `src/lib/inquiries/attachments.ts`.
  - `submitEmployeeRequest` (:13-35):
    - accept the uploaded paths, and check that each starts with `${uid}/`
    - insert the request and the attachment rows
    - remove the uploads if the insert fails (pattern: `src/app/(customer)/my-inquiries/actions.ts:126-159`)
- [x] `src/lib/inquiries/attachments-server.ts`: change `signAttachments(rows)` to `signAttachments(rows, bucket =
  MESSAGE_ATTACHMENTS_BUCKET)` so requests can reuse it.
- [x] `src/app/(staff)/employee-requests/_components/employee-requests-client.tsx:464-517`:
  - For Leave, show a Leave reason `<Select>`. Show the Reason textarea only when Others is picked.
  - Add a file input (max 3). Upload with the loop pattern from `sell-vehicle/_components/sell-vehicle-form.tsx:213-240`.
- [x] `src/app/(staff)/employee-requests/page.tsx:24`:
  - Select `*, profiles!employee_requests_employee_id_fkey(full_name), employee_request_attachments(*)`. Check the FK
    name first.
  - Add an Employee column in `employee-requests-columns.tsx`, and include the name in the search text (:107-112).
  - Show the name, the leave reason and the signed proof links in the review dialog (`employee-requests-client.tsx:519-558`).

## Done when

- [x] Zod and migration tests pass.
- [ ] The RLS test refuses an insert with `status = 'approved'`.
  - Written as a SQL text assertion in `20261031130000_t06_employee_request_fields.test.ts`. Pending verification: no
    local Supabase stack exists here, so the policy cannot run against a live database.
- [ ] Playwright MCP:
  - mechanic3 sends a Sick leave with 2 photos
  - the Account Manager sees "Arnel Santiago", the reason and both photos, then approves the request
  - Live QA deferred to the main agent.
- [x] Choosing Others without text is refused.
  - Covered by `src/lib/validation/phase6.test.ts` and the client-side check in the request dialog.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.
  - Not run in this phase: `check:fix`, `build` and the full suite are reserved for the main agent. Targeted
    `npx biome check` on the touched files is clean. `npx tsc --noEmit` reports only the stale generated file
    `.next/dev/types/validator.ts(1093,1)`, which this phase does not touch.

## Status notes (2026-10-31)

- Migration `supabase/migrations/20261031130000_t06_employee_request_fields.sql`: adds `leave_reason` with the six
  options, makes `reason` nullable, adds the `NOT VALID` leave/Others check, replaces the insert policy with
  `status = 'pending' AND reviewed_by IS NULL`, adds `WITH CHECK (status IN ('pending', 'cancelled'))` to the own-row
  update policy, creates `employee_request_attachments` with select-only RLS for the owner, CEO and Account Manager,
  and creates the private `request-attachments` bucket (10 MB, JPEG/PNG/WebP/PDF).
  - Added a backfill the plan did not spell out: a `NOT VALID` check is still enforced on later updates, so approving
    or cancelling a legacy leave row without `leave_reason` would have failed. Existing leave rows are filed under
    `others` and keep their text in `reason` (blank text becomes "Reason not recorded"). Drop the `UPDATE` if the
    owner prefers another label for legacy rows.
- `src/lib/validation/phase6.ts`: `LEAVE_REASONS` and a `request_kind` discriminated union. The overtime branch keeps
  the old required-reason behaviour. Others without text is refused in `superRefine`.
- `src/app/(staff)/employee-requests/actions.ts`: `prepareRequestUploads` signs `${uid}/${uuid}.${ext}` paths with the
  chat attachment rules; `submitEmployeeRequest` rejects paths outside the caller's folder, inserts the request plus
  the attachment rows through the admin client, and removes the uploads when the request insert fails.
- `src/lib/inquiries/attachments-server.ts`: `signAttachments(rows, bucket = MESSAGE_ATTACHMENTS_BUCKET)`.
- Request dialog: Leave reason select (Others reveals the textarea), max-3 proof picker with per-file remove, dialogs
  scroll inside the viewport and the date fields stack at 390 px. Review dialog shows the employee name, leave reason,
  reason text and signed proof links.
- Requests table: Employee column, employee name and leave reason in the search text, leave reason label in the
  Reason column.
- Commands: `npx vitest run "src/app/(staff)/employee-requests" "src/lib/validation/phase6.test.ts"
  "supabase/migrations/20261031130000_t06_employee_request_fields.test.ts"` — 5 files, 44 tests passed. The chat
  attachment suite also still passes (6 tests), since `signAttachments` only gained a default argument.
- Assumption: a failed upload halfway through a multi-file request leaves the earlier objects in storage, same as the
  sell-vehicle form; the request itself is never written.

---

## Live QA (2026-10-31, main agent)

- `mechanic3@gce.local` (Arnel Santiago) filed a Sick leave for 2026-11-02 to 2026-11-03 with 2 proof photos through
  the New Request dialog. Leave reason is a dropdown with Sick, Vacation, Emergency, Bereavement, Maternity/Paternity
  and Others. Others reveals the textarea.
- Others with empty text is refused inline with "Describe the reason for the leave." and the dialog stays open.
- Submission returned "Request submitted."; the row is `leave_reason = sick`, `reason = null`, `status = pending`.
- `employee_request_attachments` holds both rows (`landing.jpeg`, `showroom.jpeg`) with size and uploader.
- `account_manager@gce.local` sees the Employee column ("Arnel Santiago"), the Sick reason, and the review dialog shows
  the employee, the dates, the leave reason and 2 signed proof links. Approve returned "Request approved.", and the row
  is `status = approved` with `reviewed_by` set to the Account Manager.
- Not live-tested: the RLS negative insert (status = 'approved' through PostgREST as the staff member). It needs a
  signed-in user JWT; the SQL-shape test passes but the policy was not exercised against the hosted DB.

---

[← Previous: Phase 3](./phase-3.md) | [Next: Phase 5 →](./phase-5.md)
