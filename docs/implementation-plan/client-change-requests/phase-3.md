[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** ✅ Done

Completed 2026-10-26, not committed.

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

- [x] Added `notificationHref(row, role, installmentTransactions?, assignedFieldCases?)` in
  `src/lib/notifications/notification-href.ts`:
  - `transactions` → `/{role}/transactions/{id}` for roles with Transactions, `/customer/my-transactions/{id}` for the
    customer;
  - `installments` → the purchase transaction of the installment's account;
  - mechanic and head security (no Transactions) → the field case assigned to them on that transaction
    (`/{role}/field-cases/{id}`); added after the browser walk showed every Mechanic alert was a dead end;
  - `null` reference, unknown table, or a role that cannot open the target → `null`.
- [x] `getNotifications` (`src/lib/notifications/actions.ts`) adds `href` to each row on the server: one lookup of
  installments → purchase transaction, and for mechanic/head security one lookup of their assigned field cases.
- [x] Unit test `src/lib/notifications/notification-href.test.ts` (6 cases: customer, staff, roles without access,
  installments, field roles, no reference).
- [x] `notification-popover.tsx`: rows with an `href` get a stretched Next `Link` on the title (the whole row is
  clickable; the "mark as read" button stays a separate control, since a button inside a link is invalid HTML).
  Clicking marks the row read and closes the popover (now controlled with `open` / `onOpenChange`).
- [x] Keyboard: the link is focusable; the row shows an inset focus ring (`focus-within:ring-2 ... ring-inset`).
  Rows without a link stay plain text.
- [x] Supplier: notifications get `null` (suppliers have no transaction pages); covered by the unit test.
- [x] Component test `src/app/(staff)/_components/sidebar/notification-popover.test.tsx` (link opens, marks read,
  closes; plain row without a link). It fails against the old component.

## Done when

- [x] `npm run test` passes with the new tests (75 files, 499 tests).
- [x] As a buyer, clicking a transaction notification opens `/customer/my-transactions/{id}` and the unread count drops
  (18 → 17).
- [x] As the Sales Manager, a notification opened from the keyboard (Tab, Enter) goes to
  `/sales_manager/transactions/{id}` and the popover closes.
- [x] A notification with no reachable page is not shown as a link and does not navigate (Mechanic row without an
  assigned case; clicking it only marks it read, as before).
- [x] `npx tsc --noEmit` exits 0, biome on touched files is clean, `npm run build` compiles.
- [x] Walked with the Playwright MCP browser tools as customer, Sales Manager, Account Manager and Mechanic.

## Verification (2026-10-26)

| Check | Result |
| --- | --- |
| New tests before the change | `notification-href.test.ts` failed (module missing); field-case case failed before it was added; popover test fails on the old component |
| `npm run test` | 75 files, 499 tests passed |
| `npx tsc --noEmit` / biome / `npm run build` | exit 0 / clean / compiled |
| Customer (MCP) | 20 of 20 rows linked; first opens "Toyota Hilux (2020)" transaction; unread 18 → 17; popover closed |
| Sales Manager (MCP) | 20 of 20 linked; Tab reaches the first row with a visible ring; Enter opens the transaction; popover closed |
| Account Manager (MCP) | 20 of 20 "Installment due" rows linked to the purchase transaction; page opens (financing, 6 installments) |
| Mechanic (MCP) | before the field-case rule: 0 of 20 linked; after: 19 of 20 open the assigned field case ("Seller meet-up" page) |

Screenshots: `test-results/mcp-phase3-*.png`.

## Notes

- One `500` on `/mechanic/inspections` appeared in the dev server log ("Missing PreferencesStoreProvider" in
  `AppSidebar`) right after a hot reload of the edited files. Three reloads of the same pages returned 200 and the
  error is outside the notification code; treated as a dev-only Fast Refresh glitch. Watch for it in later phases.
- Mechanic and head security alerts are sent to the whole role; only the person assigned to the case gets a link,
  because the field case page refuses anyone else.
- The Confidential Informant has Transactions, so their alerts open the transaction page, not the field case.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
