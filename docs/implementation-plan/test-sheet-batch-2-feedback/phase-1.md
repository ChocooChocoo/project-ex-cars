[Next: Phase 2 →](./phase-2.md)

**Status:** 🟡 In progress

> 2026-10-31: Implementation done. `buy-flow.ts` gains `slotFromParts`, `slotHours`, `manilaDay` and
> `isSundayInManila` (unit tests first). New shared `SlotPicker` replaces every `datetime-local` on the buy,
> financing and staff delivery forms; Save Details blocks a date without an hour. Notification and "already taken"
> times now force Asia/Manila, and `saveBuyDetails` holds the new slot before releasing the old one. Live QA
> (Playwright/mobile) and repo-wide `check:fix`/`test`/`build` are deferred to the main agent — see the notes under
> Tasks and Done when.

# Phase 1: Buy-form schedule picker (blocker)

**Goal:** A buyer on any phone can pick a valid slot and Save Details succeeds. A valid slot is a whole hour from
9 AM to 9 PM Manila time, Monday to Saturday, in the future, and at least 7 days ahead for delivery.

Source: client answers on the batch 2 test sheet (artifact `c04b0c2d-579f-4317-94eb-efad451fb527`), 2026-10-29/30:
- Test 5 (Financing): "di pa po namin na-test kasi may sira nanaman po sa scheduling"
- Test 7 (Bank Transfer downpayment): "may sira po sa scheduling/calendar"

Both were answered Not sure because the client could not finish a buy.

Hypothesis (not reproduced yet). The schedule field is a plain native input
(`src/app/(customer)/my-transactions/_components/transaction-detail.tsx:611-617`, `type="datetime-local"
step={3600}`) with no `min` and no blocked days. iOS and Android ignore `step` and pre-fill the current time. At
2–5 AM that gives a time like 03:17. `saveBuyDetails` (`my-transactions/actions.ts:197-200`) rejects anything off
the hour, outside 9–21 Manila or on a Sunday, before it saves anything, so the Send panel never appears. The
developer typed 10:00 on a Monday, which is why dev QA passed.

The server rules are correct in UTC and stay as they are: `isBusinessSlot` and `isDeliveryDate` in
`src/lib/transactions/buy-flow.ts:57-81`.

## Dependencies

- None

## Tasks

- [ ] Reproduce first. Use Playwright MCP at a mobile viewport on the buy form:
  - pick only a date
  - pick a Sunday
  - pick a time that is not on the hour

  Record the server message for each. Ask the client which message they saw.

  > 2026-10-31: not reproduced. No browser tooling in this session and the server rules are unchanged; live QA
  > deferred to main agent. Unit coverage below replaces the date-only and Sunday cases.
- [x] `src/lib/transactions/buy-flow.ts`. Write the unit tests first, including the 2–5 AM Manila case (which is
  still the previous day in UTC).
  - Add `slotFromParts(date: string, hour: number): string`. It returns `${date}T${hh}:00:00+08:00`, so the browser's
    timezone no longer matters.
  - Add `slotHours(date, now, taken)`. It returns the valid hours from 9 to 21, without past hours and without taken
    GCE Visit slots.
- [x] New shared component `src/components/transactions/slot-picker.tsx`:
  - A `<input type="date">` with `min` set to today in Manila, or today + 7 days for delivery.
  - An hour `<Select>` built from `slotHours`.
  - On a Sunday, it shows "GCE is closed on Sundays." and no hour list.
  - It emits the ISO string, or `""` when no hour is picked.
- [x] Use `SlotPicker` in three places:
  - the buy form (`transaction-detail.tsx:611`)
  - the financing booking form (`transaction-detail.tsx:800-807`)
  - staff `rescheduleDelivery` (`src/app/(staff)/transactions/[id]/_components/delivery-panel.tsx:303-345`)

  Remove `pickedTime` callers that are no longer used.
- [x] Disable Save Details when a date is picked but no hour is. This stops the silent "Details saved." with no slot
  booked.
- [x] Add `timeZone: "Asia/Manila"` to server-side `toLocaleString` calls:
  - `my-transactions/actions.ts:391, 517, 527-528`
  - `src/app/(staff)/transactions/delivery-actions.ts:189, 263, 379, 387, 404`
  - `financing-actions.ts:235, 269`
  - `meetup-server.ts:69`
  - the "Already taken" slot text in `transaction-detail.tsx`
- [x] `my-transactions/actions.ts:258`: insert the new slot lock before releasing the old one, so a unique-violation
  error (`23505`) keeps the buyer's old slot.

## Done when

- [x] Unit tests for `slotFromParts` and `slotHours` pass, including the 2–5 AM Manila case.
- [ ] Playwright MCP at a mobile viewport: a GCE Visit, a CALABARZON Meet-up and a Delivery each save and send. A
  Sunday shows the closed message and cannot be saved.

  > 2026-10-31: live QA deferred to main agent.
- [x] Notifications and slot lists show Manila times, not UTC.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass.

  > 2026-10-31: repo-wide commands were not run (a sibling agent shares this worktree). Verified instead with
  > `npx vitest run` on the eight test files this phase touches (116 passed) and `npx tsc --noEmit` against a
  > src-only config (clean). The repo-wide `npx tsc --noEmit` currently fails only in the generated
  > `.next/dev/types/validator.ts`, which this phase did not touch.

---

## Live QA (2026-10-31, main agent)

Hosted DB, Playwright MCP at 390x844, buyer `customer@gce.local` on transaction `c4686963-c5ac-45d8-834e-2847f75f9b11`.

- Arrangement Type offers Delivery, CALABARZON Meet-up, GCE Visit. Hour list on 2026-11-02 is 13 whole hours, 9 AM to 9 PM.
- Sunday 2026-11-01 shows "GCE is closed on Sundays." and Save Details stays disabled.
- Monday 2026-11-02 + 10:00 AM enables Save Details. Saving returns "Details saved." and writes
  `viewing_arrangements.schedule = 2026-11-02T02:00:00Z` (10:00 AM Manila) with `confirmation_state = pending`.
- The Send panel appears with "Visit slot locked for Nov 2, 2026 10:00 AM". Submit Request is disabled until 2 valid
  IDs are uploaded, which is the existing document rule, not a scheduling failure.
- Gap found, not fixed here: after a reload the picker is empty and the buyer's own slot is listed under "Already
  taken", so they cannot re-pick their own hour from the UI. Follow-up.
- Still not live-tested: CALABARZON Meet-up and Delivery save+send, and the delivery 7-day boundary.

---

[Next: Phase 2 →](./phase-2.md)
