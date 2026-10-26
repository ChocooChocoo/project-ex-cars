[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🔲 Not Started

# Phase 3: Clickable notifications

**Goal:** Every notification on every account opens its related page or record (G1).

## Dependencies

- Phase 2 complete (final role access, so links only point to pages the recipient can open).

## Background

- One bell component serves staff, customer and supplier: `src/app/(staff)/_components/sidebar/notification-popover.tsx`.
  Clicking an item only marks it read (`:41-43`).
- `notifications` has `reference_table` and `reference_id` (`00025_audit_head_accountant_chain.sql:5-15`). Values written
  today: `"transactions"` (`src/lib/notifications/notify.ts:12-21`, `vehicles/reconditioning-actions.ts:42-52`) and
  `"installments"` (`src/lib/notifications/actions.ts:226-231`). Some rows have `null`.

## Tasks

- [ ] Add `notificationHref(row: NotificationRow, role: GceRole): string | null` in
  `src/lib/notifications/notification-href.ts`:
  - `transactions` → `rolePath(role, "/transactions/{id}")` for staff, `rolePath(role, "/my-transactions/{id}")` for the customer;
  - `installments` → the installment's transaction page (look up how the installments page is routed today);
  - `null` reference or unknown table → `null` (item stays a plain row).
- [ ] Unit test `src/lib/notifications/notification-href.test.ts` for each branch and each role type.
- [ ] In `notification-popover.tsx`, render items with a `href` as Next `Link`; on click mark read (existing action) and
  close the popover (make it controlled with `open` / `onOpenChange`).
- [ ] Keyboard: items are focusable links with a visible focus ring; items without a link stay non-interactive text.
- [ ] Check the supplier layout (`src/app/(supplier)/layout.tsx`) gets sensible links or `null`.

## Done when

- [ ] `npm run test` passes with the new `notification-href` tests.
- [ ] As a buyer, clicking a transaction notification opens `/customer/my-transactions/{id}` and the item shows as read.
- [ ] As the Sales Manager, clicking a transaction notification opens `/sales_manager/transactions/{id}`.
- [ ] A notification with no reference does nothing on click and is not shown as a link.
- [ ] `npx tsc --noEmit` exits 0, biome on touched files is clean.
- [ ] Walked with the Playwright MCP browser tools for customer and one staff role.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
