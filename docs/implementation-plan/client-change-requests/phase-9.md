[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)

**Status:** ✅ Done

Completed 2026-10-27.

# Phase 9: Customer transactions, profile and inquiries

**Goal:** The seller sees GCE's remarks on a counter-offer (C13) and a rejection reason in a modal (C14); customers
have a working Profile page (C15); images and files send in My Inquiries (C16).

## Dependencies

- Phase 6 complete (`src/components/reject-reason-dialog.tsx` and the rejection-reason pattern).

## Background

- Customer detail: `src/app/(customer)/my-transactions/_components/transaction-detail.tsx` (sell details `:866-893`,
  history reasons `:843-853`, rejected banner `:88`). Counter prices live in `vehicle_price_proposals`
  (`notes`, `proposal_kind`) and `inspection_issue_reports` (`recalculated_price`); `my-transactions/[id]/page.tsx`
  queries neither.
- No profile page: `user-menu.tsx:65` and `account-switcher.tsx:66` push to `/dashboard/profile` (404).
  `profiles` has `full_name, address, phone, account_state`.
- My Inquiries: `sendMessageWithAttachment` (`src/app/(customer)/my-inquiries/actions.ts:79-126`, also used by staff
  `staff-chat-view.tsx:15`):
  1. bucket `message-attachments` is not created by any migration;
  2. insert writes `mime_type`, which does not exist (`00005_phase3_schema.sql:58-67`);
  3. insert omits NOT NULL `uploader_id`, required by the insert policy (`00005:225-228`);
  4. errors are swallowed;
  5. `src/components/inquiries/inquiry-conversation.tsx:247-249` shows only the file name;
  6. files pass through the server action, capped at 4 MB (`next.config.mjs:7`).

## Tasks

- [x] C13: load counter-offers for sell transactions in `my-transactions/[id]/page.tsx` (latest
  `vehicle_price_proposals` / `inspection_issue_reports` the seller may see; add a customer read policy in migration
  `00066_t03_customer_counter_offers_attachments.sql` if RLS blocks it).
  No customer policy: a row policy would also expose the internal `new_ceiling` and the staff-only reasoning. The page
  reads only `recalculated_price`, `seller_remarks`, `issue_found`, `seller_response` with the service role, for a
  transaction already limited to the signed-in customer, and only once the CEO approved the revised price. The
  purchase ceiling (`vehicle_price_proposals`) is GCE's internal maximum and is never shown to the seller.
- [x] C13: show "GCE counter-offer: ₱X — Remarks: …" in the sell details card; require remarks when staff create a
  counter-offer (`createInspectionIssueReport` in `src/app/(staff)/transactions/sell-actions.ts:269` and the price
  proposal action). New column `inspection_issue_reports.seller_remarks`, required for a profitable report
  ("Remarks for the seller"); the old "Explanation" is now labelled "Internal explanation (staff only)". Remarks are
  not required on the purchase-ceiling proposal, because the seller never sees the ceiling.
- [x] C14: "Reject" / rejected status on the customer side opens `RejectReasonDialog` in read mode showing the stored
  reason (history reason or `review_notes`). `RejectReasonDialog` takes `reason` for a read-only mode (Close only).
  "See reason" sits by the status badge: always for a rejection (fallback text when no reason was recorded), and for
  a cancellation that has a reason.
- [x] C15: add `src/app/(customer)/profile/page.tsx` (and the staff equivalent under `(staff)/profile`) with editable
  full name, phone and address (server action with zod validation, RLS on own row) and a change-password form
  (`supabase.auth.updateUser`). Two route groups cannot both own `/profile`, so the customer page is
  `(customer)/my-profile`, served at `/customer/profile` (`resolveInternalPath` maps `profile`); staff use
  `(staff)/profile`. Both render `src/components/profile/profile-forms.tsx`. `updateOwnProfile` / `changeOwnPassword`
  in `src/app/auth/actions.ts`; the password change checks the current password on a separate client first.
- [x] C15: point `user-menu.tsx:65` and `account-switcher.tsx:66` at `rolePath(role, "/profile")`. The menus do not
  know the role, so they go to `/profile` and `src/proxy.ts` redirects that to `/{role}/profile`.
- [x] C16: migration 00066 creates bucket `message-attachments` (private) with storage policies for inquiry participants.
  Named `20261026130000_t03_customer_counter_offers_attachments.sql`. Bucket: private, 10 MB, JPG/PNG/WebP/PDF. No
  storage policies: the server signs upload and download URLs after checking the thread. The attachment table rules
  are replaced: read when you can read the message (this adds the Marketing Specialist and Sales Manager, who were
  left out), insert only by the message's sender.
- [x] C16: fix the `message_attachments` insert (drop `mime_type` or add the column, set `uploader_id`), return errors to
  the UI instead of swallowing them. `mime_type` dropped (`file_kind` image/file is stored); `uploader_id`,
  `file_size` set; a failed attachment removes the upload and returns "Your message was sent, but the file was not: …".
- [x] C16: upload via signed URL (same pattern as `prepareSellUploads`) so files above 4 MB work; set `accept` and a size
  limit on the file input. `prepareMessageAttachment` (checks the caller can read the thread) → browser
  `uploadToSignedUrl` → `sendMessageWithAttachment` with the path (must sit in the thread's folder).
- [x] C16: `inquiry-conversation.tsx` shows image thumbnails (signed URL, opens `TransactionImagePreview`) and a download
  link for other files. All four thread loaders sign attachments (`src/lib/inquiries/attachments-server.ts`); a file
  sent while the thread is open arrives through a realtime subscription on `message_attachments` plus
  `getMessageAttachment` (read under RLS, then signed).
- [x] Unit tests for the profile action validation and the attachment action (uploader set, error surfaced).
  `src/app/auth/actions.profile.test.ts` (7), `src/app/(customer)/my-inquiries/actions.attachments.test.ts` (6),
  migration test (4).
- [x] Apply migration 00066; rerun `src/tests/e2e/inquiries.spec.ts`. Applied as
  `20261026130000_t03_customer_counter_offers_attachments.sql`. `inquiries.spec.ts`: 6/7 on the full run; "CEO mobile …"
  timed out waiting for the thread to open (5 s) and passed twice when rerun alone (dev-server timing, not overflow).

## Done when

- [x] After staff counter a seller's price with remarks, the seller sees the new price and the remarks.
- [x] A rejected transaction's Reject/See reason opens a modal with the reason.
- [x] A customer edits name, phone and address on `/customer/profile`, reloads, and sees the saved values; the user
  menu link no longer 404s.
- [x] Customer sends a 5 MB JPG and a PDF in My Inquiries; staff see the image preview and can download the PDF; a failed
  upload shows an error.
- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `inquiries.spec.ts` passes.
- [x] Walked with the Playwright MCP browser tools.

## Verification (2026-10-26 / 27)

| Check | Result |
| --- | --- |
| `npm run test` | 88 files, 567 tests passed |
| `npx tsc --noEmit` | exit 0 |
| MCP, customer Profile | user menu → `/customer/profile`; saved phone 09171234567 and an address; reload shows them; phone "12345" shows "Phone must be at least 10 characters." |
| MCP, password | wrong current password → "Your current password is not correct."; on `e2e.walkin.p7@gce.local` changed to a temporary password and back (the second change only works if the first took effect) |
| Hosted migration | applied |
| MCP, attachments (customer, sell thread `814cab30…`) | 23 MB file → "Files must be 10 MB or smaller.", nothing sent; 5.2 MB JPG with text and a PDF sent; both still there after reload; the photo opens large |
| MCP, attachments (Marketing Specialist) | sees the photo (loaded) and opens it; PDF link returns 200 `application/pdf` (20,184 bytes); sends a PDF back. Before this migration the Marketing Specialist could not read attachments at all |
| e2e `t01-phase1-issue-path` (first 3 steps) | passed (4.2 min): report with "Remarks for the seller" → CEO approves → customer page shows ₱450,133 and the remarks → seller agrees. The spec now checks the seller view |
| MCP, seller view `db84a236…` | "GCE counter-offer ₱450,133 · Inspection found: … · Remarks: The aircon compressor needs replacing before resale. · You accepted this price." |
| MCP, staff profile (CEO) | user menu → `/ceo/profile` in the staff layout; no horizontal overflow at 1440 or 390 px |
| e2e `inquiries.spec.ts` | 6/7, then the failed one passed twice alone (see task above) |
| `npm run build` | compiled, exit 0 |
| Console | 0 errors; one dev-only LCP hint for the chat photo |
| MCP, See reason | rejected `31b0bd96…` → "Delivery address is not serviceable"; rejected without a reason → fallback text; cancelled `efd8f546…` → "Vehicle sold to another buyer"; Close works |

### Live site walk (2026-10-27)

Playwright MCP on https://global-exchange-car.vercel.app (`main` at `e8426b6`, same hosted Supabase project).
Test records are tagged `LIVE-QA`.

| Role | Checked | Result |
| --- | --- | --- |
| Customer profile | "Phone must be at least 10 characters." for 12345; saved 09179990000, kept after reload, then restored to 09171234567 | pass |
| Password | Wrong current password → "Your current password is not correct." | pass |
| Attachments (customer, Camry inquiry) | 11 MB file → "Files must be 10 MB or smaller."; photo + PDF sent, still there after reload; photo opens large | pass |
| Attachments (Marketing, sell chat of `c9096cad`) | Sent PDF + photo; after reload the photo loads and the PDF returns 200 `application/pdf` | pass |
| Counter-offer (seller, `db84a236`) | "GCE counter-offer ₱450,133 · Inspection found: … · Remarks: … · You accepted this price." | pass |
| See reason | Rejected `31b0bd96` → "Delivery address is not serviceable"; Close works | pass |

Not re-checked: staff profile page, cancelled-transaction reason.

## Files changed

- `supabase/migrations/20261026130000_t03_customer_counter_offers_attachments.sql` (new), `.test.ts` (new)
- `src/app/(staff)/transactions/sell-actions.ts`, `[id]/_components/sell-flow-panel.tsx`
- `src/app/(customer)/my-transactions/[id]/page.tsx`, `_components/transaction-detail.tsx`
- `src/components/reject-reason-dialog.tsx`
- `src/lib/validation/profile.ts` (new), `src/app/auth/actions.ts`, `actions.profile.test.ts` (new)
- `src/components/profile/profile-forms.tsx`, `load-own-profile.ts` (new), `src/app/(staff)/profile/page.tsx`,
  `src/app/(customer)/my-profile/page.tsx` (new)
- `src/lib/routing/paths.ts`, `src/proxy.ts`, `src/app/(staff)/_components/sidebar/user-menu.tsx`, `account-switcher.tsx`
- `src/lib/inquiries/attachments.ts`, `attachments-server.ts` (new), `src/app/(customer)/my-inquiries/actions.ts`,
  `actions.attachments.test.ts` (new), `[id]/page.tsx`, `src/app/(staff)/inquiries/actions.ts`, `[id]/page.tsx`
- `src/components/inquiries/inquiry-conversation.tsx`
- e2e: `t01-phase1-issue-path.spec.ts`

## Notes and findings

- Found, not fixed (outside this phase): the seller's status history on `/customer/my-transactions/{id}` prints GCE's
  internal ceilings, e.g. "Purchase ceiling of ₱500,000 approved by the CEO" and "Revised ceiling of ₱460,000 …".
  The history reasons are written for staff by `sell-actions.ts`. Suggest hiding ceiling entries from the customer
  history or writing a separate customer-facing reason.
- `profiles` "Users can update own profile" lets a user update any column of their own row through the API (for
  example `account_state`). The new action writes only name, phone and address, but the rule itself is older and
  broader than needed; worth tightening with a column-limited RPC or trigger.
- Suppliers: `/supplier/profile` maps to the customer page, whose layout sends suppliers away. Out of scope.
- A file sent while the other person has the thread open arrives through realtime; if realtime is off, it shows after
  a reload.
- Test data on the hosted database: in thread `814cab30…` two test messages with a JPG and PDFs; sell offer
  `db84a236…` from the e2e run; `customer@gce.local` now has phone 09171234567 and an address; the password of
  `e2e.walkin.p7@gce.local` was changed and set back.

---

[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)
