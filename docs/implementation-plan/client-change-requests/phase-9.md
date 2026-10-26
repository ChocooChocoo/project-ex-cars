[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)

**Status:** 🔲 Not Started

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

- [ ] C13: load counter-offers for sell transactions in `my-transactions/[id]/page.tsx` (latest
  `vehicle_price_proposals` / `inspection_issue_reports` the seller may see; add a customer read policy in migration
  `00066_t03_customer_counter_offers_attachments.sql` if RLS blocks it).
- [ ] C13: show "GCE counter-offer: ₱X — Remarks: …" in the sell details card; require remarks when staff create a
  counter-offer (`createInspectionIssueReport` in `src/app/(staff)/transactions/sell-actions.ts:269` and the price
  proposal action).
- [ ] C14: "Reject" / rejected status on the customer side opens `RejectReasonDialog` in read mode showing the stored
  reason (history reason or `review_notes`).
- [ ] C15: add `src/app/(customer)/profile/page.tsx` (and the staff equivalent under `(staff)/profile`) with editable
  full name, phone and address (server action with zod validation, RLS on own row) and a change-password form
  (`supabase.auth.updateUser`).
- [ ] C15: point `user-menu.tsx:65` and `account-switcher.tsx:66` at `rolePath(role, "/profile")`.
- [ ] C16: migration 00066 creates bucket `message-attachments` (private) with storage policies for inquiry participants.
- [ ] C16: fix the `message_attachments` insert (drop `mime_type` or add the column, set `uploader_id`), return errors to
  the UI instead of swallowing them.
- [ ] C16: upload via signed URL (same pattern as `prepareSellUploads`) so files above 4 MB work; set `accept` and a size
  limit on the file input.
- [ ] C16: `inquiry-conversation.tsx` shows image thumbnails (signed URL, opens `TransactionImagePreview`) and a download
  link for other files.
- [ ] Unit tests for the profile action validation and the attachment action (uploader set, error surfaced).
- [ ] Apply migration 00066; rerun `src/tests/e2e/inquiries.spec.ts`.

## Done when

- [ ] After staff counter a seller's price with remarks, the seller sees the new price and the remarks.
- [ ] A rejected transaction's Reject/See reason opens a modal with the reason.
- [ ] A customer edits name, phone and address on `/customer/profile`, reloads, and sees the saved values; the user
  menu link no longer 404s.
- [ ] Customer sends a 5 MB JPG and a PDF in My Inquiries; staff see the image preview and can download the PDF; a failed
  upload shows an error.
- [ ] `npm run test` passes, `npx tsc --noEmit` exits 0, biome on touched files is clean, `inquiries.spec.ts` passes.
- [ ] Walked with the Playwright MCP browser tools.

---

[← Previous: Phase 8](./phase-8.md) | [Next: Phase 10 →](./phase-10.md)
