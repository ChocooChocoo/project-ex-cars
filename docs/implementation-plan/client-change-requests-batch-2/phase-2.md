[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** ✅ Done

> 2026-10-28: Done. Code, unit tests, build and the Playwright MCP live check all pass. Live-QA data left in inquiry
> `4e702e2b-a434-42cc-bb24-c9346a3cdaf3` (E2E Test CLIENT-DELIVERY): five "Phase 2 QA" messages with attachments, and the
> Sales Manager is now assigned to it. One "sales manager PDF" message is a duplicate from the test script.

# Phase 2: Chat attachments

**Goal:** Customers and staff can send files and images in chat (P1).

## Dependencies

- None (independent of Phase 1; ordered here only because it is a small bug fix)
- Access to the linked Supabase project to check applied migrations

## Tasks

- [x] Reproduce sending a JPG and a PDF from customer and staff chat. Record the exact error (systematic-debugging).
  > 2026-10-28: First pass (before the browser was signed in). Browser repro blocked: no signed-in session in the Playwright MCP browser, and reading the seed
  > password was denied. Storage-level repro instead (service role signs, publishable key uploads, file deleted after):
  > `image/jpeg` and `application/pdf` upload OK; an empty type fails with
  > `mime type application/octet-stream is not supported`. Before that, the client check rejects an empty type with
  > "Attach a JPG, PNG, WebP image or a PDF.", and the picker's MIME-only `accept` hid such files. Customer and staff
  > chat both use `sendMessageWithAttachment` + `prepareMessageAttachment`; wiring is consistent.
  > Live browser (after fix): JPG and PDF send from both sides with no error. The only no-type failure was the one above.
- [x] Confirm migration `supabase/migrations/20261026130000_t03_customer_counter_offers_attachments.sql` is applied to the
  linked DB, since it creates the `message-attachments` bucket. Apply it if missing.
  > 2026-10-28: Applied. `npx supabase migration list` shows `20261026130000` local and remote. `storage.getBucket`
  > returns `message-attachments` (private, 10 MB, jpeg/png/webp/pdf). Nothing to apply.
- [x] In `src/lib/inquiries/attachments.ts`, infer the MIME type from the file extension when `file.type` is empty.
  > 2026-10-28: Added `attachmentMimeType()`; `attachmentError` uses it. `prepareMessageAttachment` (actions.ts) uses it for
  > the path extension. `inquiry-conversation.tsx` resolves the type once and sends it as the prepare type, upload
  > `contentType` and `attachment_type`.
- [x] In the same file, return a clear "HEIC is not supported, please send JPG or PNG" error for HEIC files.
  > 2026-10-28: Checked first in `attachmentError`, by `image/heic|heif` type or `.heic|.heif` extension.
- [x] In `src/components/inquiries/inquiry-conversation.tsx:162`, filter the realtime `message_attachments` listener to
  the open inquiry instead of reacting to every row.
  > 2026-10-28: `message_attachments` has no `inquiry_id` and realtime filters cannot prefix-match, so the handler skips
  > rows whose `storage_path` does not start with `${inquiryId}/` (server enforces that prefix). No schema change.
  > Live check 2026-10-28: could not verify. Realtime postgres_changes deliver nothing on the linked project, for any
  > table and any role: customer, filtered or not, and even the service role. All subscribe as `SUBSCRIBED`, the
  > publication has both tables, both replication slots are active, `realtime.subscription` has rows. This is outside
  > this phase (existing infra issue: plain text messages do not arrive live either). Check the Supabase Realtime logs
  > in the dashboard. Three probe messages ("realtime JPG", "realtime probe", "realtime probe 2") were added to the QA
  > thread.
- [x] Fix any other cause found in the first task.
  > 2026-10-28: `MESSAGE_ATTACHMENT_ACCEPT` now also lists `.jpg,.jpeg,.png,.webp,.pdf`, so the picker offers files the OS
  > does not type. Live check found no other cause. Note: on `buy_now` threads a Sales Manager sees messages only after
  > "Assign to Me" (RLS in `00005`); this is existing behaviour, not changed here.
- [x] Unit test for the MIME inference and the HEIC message.
  > 2026-10-28: `src/lib/inquiries/attachments.test.ts` (6 tests). Failed before the change (5/6), passes after.

## Done when

- [x] In the Playwright MCP browser, the customer sends a JPG and a PDF and the Sales Manager sees both. The Sales
  Manager sends a JPG and a PDF and the customer sees both.
  > 2026-10-28: `customer@gce.local` sent `test-photo.jpg` and `test-doc.pdf` in `/my-inquiries/4e702e2b-…`; rows saved
  > as `image` / `file` under `4e702e2b-…/`. `sales_manager@gce.local` assigned themselves, then saw both on
  > `/inquiries/4e702e2b-…` and sent a JPG and a PDF back. The customer saw all of them on reload. No error toasts.
  > HEIC check: picking `IMG_0001.HEIC` shows "HEIC is not supported, please send JPG or PNG."
- [x] Each attachment opens from its signed URL.
  > 2026-10-28: Every signed URL fetched in the page returns 200 with `image/jpeg` or `application/pdf`. Images render
  > (naturalWidth 40). PDF links open in a new tab (`target=_blank`).
  > Not checked live: a realtime attachment arriving while the other side has the thread open (each side checked after
  > reload).
- [x] `npm run test` passes.
  > 2026-10-28: 97 files, 612 tests pass. `npx tsc --noEmit` clean, biome clean on changed files, `npm run build` OK.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
