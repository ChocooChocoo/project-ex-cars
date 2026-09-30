# T01: Phased Implementation Plan for the GCE Process Flows

> **Created:** 2026-09-29 | **Task:** `docs/tasks/T01.md` | **Source:** `docs/DOCUMENTS/GCE_Process_Flows.md`
> Planning artifact only. T01 makes no code changes.

## Context

Task `docs/tasks/T01.md` asks for a phase-by-phase implementation plan for `docs/DOCUMENTS/GCE_Process_Flows.md`, the source of truth for the Selling flow and the buyer purchase flows.

Tasks 01–33 already built the base:
- a coarse transaction state machine
- sell and buy intake
- inquiry chat
- field cases
- finance and disbursements
- installments and repossession stubs

The process document adds rules the code does not have yet: 7-day review windows, CEO price ceilings, slot locking, an Active/On-Hold buyer queue, no-shows and strikes, decline classification, delivery tracking, expense proofs and reimbursement, and the full financing lifecycle.

This plan orders that work so each phase ships a complete, testable flow. Later phases reuse the building blocks from earlier ones.

**Scope decisions:**
- In-House Financing (§6, "For Client Validation") and §7–11 (no source content yet) become gated late phases.
- §5 Cheque is excluded, because the source says DISREGARD.
- The per-phase responsibility map (file ownership per agent, as in `docs/plans/2026-09-09-task32-implementation-goal.md`) is written when each phase starts, not here. It depends on the Q0 answers below.

---

## Baseline: what exists and what is missing

| Area | Exists (reuse) | Gap |
|---|---|---|
| Lifecycle | `src/lib/transactions/state-machine.ts` (`current_state`: pending, under_review, approved, rejected, completed, cancelled; `TRANSITION_RULES`) | Sub-statuses (Pending CEO Approval, Overdue, Declined by Buyer…), 7-day due date, flags |
| Sell intake | `sell-vehicle-form.tsx`, `submitSellVehicle` (`my-transactions/actions.ts:189`), `sell_details.condition_items` | "No known issue" choice, ORCR / deed of sale / 2 IDs uploads, meetup method |
| Sell review | `sell-submissions` page (Mechanic and CI only), `reviewSellTransaction` (`transactions/actions.ts:520`, gated by `canTransition`, so effectively CEO-only) | Marketing Specialist access, document verification, flag/reject |
| Price ceilings | `vehicle_price_proposals`, `proposePrice` / `approvePrice` (`vehicles/actions.ts:148,191`), `PendingApprovalsTable` | Proposal kind (ceiling, revised, reprice), link to transaction, history. **`approvePrice` also publishes the car** (see D3) |
| Chat | `inquiries` + `inquiry_messages`, realtime, `my-inquiries` / `inquiries/[id]` | Thread linked to a transaction (sell side has none) |
| Field cases | `field_cases` (acquisition, delivery, recovery, sourcing), `createFieldCase`, `assignMechanic`, `updateFieldCase` | Head Security assignee, ID/plate checklist, photos, expense lines with proofs, reimbursement |
| Buy intake | `createBuyTransaction`, `saveBuyDetails`, `uploadPurchaseDocument`, `purchase_details` (arrangement `meetup` = CALABARZON), 360° viewer | Bank transfer, slot availability and lock, condition acknowledgment, 2-ID enforcement |
| Visit slots | `viewing_arrangements` (`inquiry_id`, `purchase_transaction_id`, `schedule`, `confirmation_state`; **no `vehicle_id`**) | Per-vehicle slot uniqueness |
| Sales Manager | Transactions list and detail, `transitionTransaction` | Per-car buyer queue, Mark Sold to This Buyer, decline classification, no-shows |
| Customer standing | none. Note: `profiles` has "Users can update own profile" (full-row UPDATE, `00001_phase1_schema.sql:172`) | no_show_count, strike, GCE-Visit-only restriction |
| Delivery | `logistics/*` is mock data only | Fee, downpayment deadline, tracking statuses, location |
| Notifications | `notifications` table (role-addressed), `lib/notifications/actions.ts` | Per-user recipients + read policy, event producers |
| Financing | `payment_terms`, `installment_accounts`, `installments`, `collection_actions`, `instructRepossession`, `lib/transactions/installments.ts`, `vehicles.listing_state='reserved'` (unused by flows) | Duration selection, HA→CEO approval chain, purchase claim / potential buyer, reconditioning, repricing |
| Scheduling | no cron | Overdue detection |

---

## Conflicts between the process doc and built behavior (decide before Phase 1 / 2)

| # | Conflict | Evidence | Plan default until the client answers Q0 |
|---|---|---|---|
| D1 | **Buyer-request approver.** The process doc (§2–4) says the Sales Manager approves or rejects buyer requests; the CEO is not involved. Task 32 built Sales processes → HA verifies → CEO approves, and `under_review → approved/rejected` is CEO-only. | `state-machine.ts` `TRANSITION_RULES.under_review`; `docs/flows/task32-33-implemented-flow.md:436` | Blocks Phase 2. Do not change `TRANSITION_RULES` until Q0a is answered. |
| D2 | **Sell-offer reviewer.** The process doc says the Marketing Specialist verifies, proposes the ceiling and negotiates. The code has the Sales Manager set the valuation, `reviewSellTransaction` runs through the CEO-only transition, and the Marketing Specialist has no transactions access. | `task32-33-implemented-flow.md:237`; `transactions/actions.ts:520–545`; `ROLE_NAV_ACCESS.marketing_specialist` | Blocks Phase 1 steps 2–5. Do not change guards until Q0b is answered. |
| D3 | **Approving a price proposal publishes the car.** `approvePrice` sets `vehicles.listing_state` to `available` (or `draft` on reject). Reusing it for purchase ceilings would list a seller's car before GCE buys it. | `vehicles/actions.ts:233–236` | Fixed in Phase 1: only `selling_price` / `reprice` kinds change `listing_state`. |
| D4 | **Customers can edit their own profile row.** Standing columns on `profiles` could be reset by the customer. | `00001_phase1_schema.sql:172` | Fixed in Phase 0: separate `customer_standing` table, staff-write RLS only. |
| D5 | **`down_payment` is a payment method.** In the process doc a downpayment is part of a payment, not a method. | `state-machine.ts` `PAYMENT_METHODS` | Phase 0: add `bank_transfer`. Keep `down_payment` readable for old rows; stop offering it in new forms. Downpayment becomes an amount on `payment_records`. |

---

## Cross-cutting design rules (all phases)

1. **Keep `current_state` coarse.** Add `transactions.flow_status` (TEXT + CHECK) for the process-doc labels from Appendix B. Add `transactions.flag` (TEXT + CHECK, nullable) with these values: declined_by_buyer, buyer_no_show, buyer_unavailable, flagged, cancelled_unprofitable, seller_refused. The mapping lives in `state-machine.ts` beside `TRANSITION_RULES`, so UI labels come from `lib/transactions/labels.ts`.
2. **7-day window without cron.** Add `transactions.review_due_at`. Derive "Overdue — Awaiting Action" on read (`isOverdue(tx, now)` pure helper). Emit the notification lazily, following the existing `checkAndNotifyDueInstallments` pattern. Never auto-cancel.
3. **Enums stay `TEXT CHECK`,** matching the current schema. Each change is a new ordered migration (`00048_…` onward). Regenerate `database.types.ts` after each one. No `DISABLE RLS` and no `FOR ALL` broadening. Keep the inline `private.user_roles` RLS pattern.
4. **Per-user notifications.** Add `notifications.recipient_id` (nullable) plus a SELECT policy `recipient_id = auth.uid()`. Change `getNotifications` to read role OR user. Phase 0 does this because Phases 2–4 must notify specific buyers.
5. **Every phase ships:** migration + SQL test (pattern: `00045_task33_workflow_permissions.test.ts`), pure-rule Vitest tests, server-action guards, UI, and one Playwright spec in `src/tests/e2e/`. Nav changes go through `ROLE_NAV_ACCESS` (`src/lib/auth/roles.ts`) and `sidebar-items.ts` only.

---

## Phases

### Phase 0: Foundations (blocks everything)
**Status:** ✅ Implemented (2026-09-30), migration `00048_t01_process_flow_foundations.sql`.
- [x] Migration + SQL test
- [x] Pure helpers + unit tests
- [x] Status badge (customer transaction detail)
- [ ] Migration applied on a clean reset (not verified: no local Docker; apply with `supabase db push` before deploying the notifications change)
- Migration: `flow_status`, `flag`, `review_due_at` on `transactions`; `notifications.recipient_id` + own-row SELECT policy; `transaction_documents.document_kind` += `orcr`, `deed_of_sale`, `inspection_photo`, `expense_proof`; `purchase_details.payment_method` += `bank_transfer` (D5).
- **Customer standing (D4):** new `customer_standing` table (`account_id` PK, `no_show_count`, `strike_count`, `gce_visit_only`). The customer can SELECT their own row. Only Sales Manager and CEO can write.
- Pure helpers with unit tests: `isOverdue`, `canCancelScheduled(scheduledAt, now)` (5-hour rule), `nextQueueState`.
- Status badge component that reads `flow_status`, `flag` and the overdue state.
- **Exit:** migrations apply on a clean reset; helpers are tested; existing e2e suite still green.

### Phase 1: Selling Scenario (§1, steps 1–13)
**Gate:** Q0b answered (D2). Step numbers below map to source steps.

**Status:** ✅ Implemented (2026-09-30), migration `00049_t01_phase1_selling.sql`. Q0b answered: the Marketing Specialist owns the sell offer. The Task 32 CEO "Review sell offer" (`reviewSellTransaction`) is removed, and generic triage no longer moves sell transactions.
- [x] Items 1–13 (intake, verification, ceiling, CEO decision with D3 fix, chat, field case, checks and inspection, issue report, revised ceiling, seller response, payment, expenses, reimbursement)
- [x] Migration + SQL test, pure-rule tests (`sell-flow.test.ts`), D3 action test, unit suite green
- [x] Defaults used: Q9 seller sees "within 5–7 days"; Q10 seller is notified in writing and the field team is told; Q3 reimbursement records who marked it (no payee chosen)
- [ ] e2e `src/tests/e2e/t01-phase1-selling.spec.ts` written (no-issue path) but not run: needs `00049` applied and the dev server. The issue path is covered by action code only.
- [ ] Legacy sell offers already `under_review` from Task 32 have no ceiling proposal; they need a manual decision (cancel or re-submit).

1. **Intake (step 1).** Add a required "has issues / no known issue" choice, uploads for 2 IDs + ORCR + deed of sale, and meetup method (halfway or GCE visit) to `sell-vehicle-form.tsx` and `submitSellVehicle`. Extend the sell schema in `lib/validation/transactions.ts`.
2. **Verification (step 2).** Give the sell reviewer role from Q0b access to sell submissions and document verification (reuse `verifyTransactionDocument`). A failed check sets `flag=flagged` or rejects.
3. **Ceiling proposal (step 3).** Add `vehicle_price_proposals.proposal_kind` (`purchase_ceiling`, `revised_ceiling`, `selling_price`, `reprice`) and `transaction_id`. Allow multiple proposals per vehicle, one pending per kind. Proposing sets `flow_status=pending_ceo_approval`, sets `review_due_at=+7d`, and notifies the seller (Q9 decides "5–7 days" vs "7 days" wording).
4. **CEO decision (step 4).** Reuse `PendingApprovalsTable` and filter by kind. **Change `approvePrice` so only `selling_price` and `reprice` touch `listing_state` (D3).** Rejecting ends the transaction. Overdue follows the Phase 0 rule.
5. **Negotiation (step 5).** Add `inquiries.transaction_id`. On sell submission, create a linked thread. Reuse the `my-inquiries` and `inquiries/[id]` chat. Server rule: the agreed price must be ≤ the approved ceiling.
6. **Field case on agreement (step 5).** `acquisition` field case pre-filled from the transaction.
7. **Field execution (step 6).** Add CI identity check and Mechanic plate/chassis check (booleans), `inspection_photo` uploads, and the field issue note (issue, repair estimate, photos).
   - **No issues found:** go straight to item 11 (payment).
   - **Issue found:** go to item 8.
8. **Inspection Issue Report (step 7).** New `inspection_issue_reports` table. The Marketing Specialist fills it from the transaction detail.
   - **Profitable:** it creates a `revised_ceiling` proposal for the CEO.
   - **Not profitable:** it sets `flag=cancelled_unprofitable` and ends the transaction. Who tells the seller depends on Q10.
9. **CEO reviews revised price (step 8).** Approve continues to item 10. Reject ends the transaction.
10. **Seller response (step 9).** The Marketing Specialist records the Mechanic's outcome. Agree continues to item 11. Refuse sets `flag=seller_refused` and ends the transaction.
11. **Payment (step 10).** Reuse `requestPurchaseFunds` / `advanceDisbursement`. On paid, notify the CEO.
12. **Expenses (steps 11–12).** New `field_case_expenses` table (amount, description, proof path, submitted_by, reimbursed_at). Filing an expense is required before a field case can be completed, whether or not the vehicle was purchased.
13. **Reimbursement (step 13).** When the vehicle's `listing_state` becomes `sold`, the HA sees un-reimbursed expenses in Finance and marks them reimbursed. The payee depends on Q3.
- **Exit:** e2e covers seller submit → verify → CEO approve (car stays unlisted) → chat → field case → both the no-issue and issue paths → payment → expense → reimbursement.

### Phase 2: Buying, Cash Onsite Visit (§2)
**Gate:** Q0a answered (D1).

**Status:** ✅ Implemented (2026-09-30), migration `00050_t01_phase2_onsite_visit.sql`. Q0a chosen by the team (client to confirm): the Sales Manager approves buyer requests; the CEO keeps an override. The Sales Manager also verifies a buyer's IDs and proof of billing (Head Accountant still can).
- [x] Slot lock (vehicle-derived `vehicle_id`, unique live booking per car and hour, taken-slot RPC), rebooking frees the old slot, release on reject/cancel, kept while overdue
- [x] Buyer submits Cash + GCE visit with exactly 2 IDs → `pending_sm_approval` + 7-day window; overdue notifies the Sales Manager
- [x] Approve/reject notify the buyer; Buyer declined (`declined_by_buyer`); Mark Sold to This Buyer (needs a recorded payment; closes and notifies other open requests — Q13 default)
- [x] Head Accountant sale records in Finance; migration SQL test, rule tests, unit suite green
- [ ] e2e `src/tests/e2e/t01-phase2-onsite-visit.spec.ts` written but not run: needs `00050` applied and the dev server
- Kept from Task 32: proof of billing is still required before approval and sale (the process doc names only 2 IDs).
- Guided buy flow in `transaction-detail.tsx`: credentials, exactly 2 IDs enforced server-side, Cash, then GCE visit slot.
- **Slot lock.** Add `viewing_arrangements.vehicle_id` (backfill from `inquiries.vehicle_id`, NOT NULL after backfill). Add a partial UNIQUE index on (`vehicle_id`, `schedule`) WHERE `confirmation_state IN ('pending','confirmed')`. Availability check comes before submit. The lock is held from booking, released on rejection (set `confirmation_state='cancelled'`), and kept while overdue.
- Review by the Q0a approver: `pending_sm_approval` with a 7-day window. Approve or reject; reject notifies the buyer and releases the slot.
- Visit outcome: decline sets `flag=declined_by_buyer` and the car returns to available. Proceed leads to **Mark Sold to This Buyer**: a new SM action wrapping the existing complete→sold path, which cancels competing open requests.
- **HA sale records** view in Finance lists completed buy transactions with their figures. Every later phase reuses it.
- **Exit:** e2e for booking, slot conflict, approve, mark sold, and the HA record.

### Phase 3: Buyer queue + Cash Meet Halfway (§3)

**Status:** ✅ Implemented (2026-09-30), migration `00051_t01_phase3_halfway_queue.sql`.
- [x] Queue: `transactions.queue_state` (not `purchase_details`: the one-Active-per-car index needs `vehicle_id`); ending a request leaves the queue (trigger); "Buyers for this car" panel with manual Make Active
- [x] Condition acknowledgment required before Meet Halfway; halfway submit (Active or On Hold, buyer notified immediately)
- [x] 5-hour cancellation cut-off in the action and in the database trigger (customer self-cancel only)
- [x] `buyer_meetup` field case kind, created by the Sales Manager from Field Cases
- [x] No-show after 2h30m (`buyer_no_show`, no-show count, GCE Visit only at 2); decline Legit / Not Legit (strike → GCE Visit only); arrangement options and submit respect `gce_visit_only`
- [x] Mark sold notifies every other open (incl. On Hold) buyer (Phase 2 `finalizeBuySale`)
- [x] Migration SQL test, rule tests, unit suite green
- [ ] e2e `src/tests/e2e/t01-phase3-halfway-queue.spec.ts` written (queue, reject → promote, approve → sold) but not run; no-show needs a past meet-up, so it is covered by unit tests only
- Defaults used: Q11 an Active request (even Overdue) blocks promotion until decided; Q1 credit score skipped (acknowledgment links to the 360° view); Q12 no expense filing for halfway meet-ups. The 00050 slot lock now applies to GCE visits only.
- **Queue.** Add `purchase_details.queue_state` (`active`, `on_hold`) with a partial UNIQUE index (vehicle_id) WHERE `active`. Create a new request as `active` or `on_hold` using `nextQueueState`. The SM "Buyers for this car" panel manually promotes the next request. There is no auto-promote. Queue behavior while overdue depends on Q11.
- Condition acknowledgment checkbox (store `acknowledged_at`), required before choosing halfway. Reuse the 360° viewer. The "credit score" item waits on Q1.
- Cancellation button gated by `canCancelScheduled` (≥ 5 h), enforced in both the action and RLS/RPC.
- Halfway meetup creates a field case. Add `buyer_meetup` to the `field_cases.case_kind` CHECK. Whether field teams file expenses here depends on Q12.
- **No-show** (after 2h30m, SM confirms): `flag=buyer_no_show` and `customer_standing.no_show_count++`. At 2 no-shows, set `gce_visit_only=true`.
- **Decline classification:** Legit or Not Legit. Not Legit adds a strike and sets `gce_visit_only`. Arrangement options respect `gce_visit_only`.
- On mark sold, notify every on-hold buyer through `recipient_id`.
- **Exit:** e2e for two buyers queuing, reject then promote, no-show restriction, and mark sold notifying the on-hold buyer.

### Phase 4: Cash Delivery (§4)

**Status:** ✅ Implemented (2026-09-30), migration `00052_t01_phase4_delivery.sql`.
- [x] Delivery requests join the Phase 3 queue (acknowledgment, Active / On Hold, 5-hour cut-off)
- [x] Sales Manager confirms serviceability (not serviceable ends the request) and sets fee + downpayment; deadline = 3 working days (weekends skipped)
- [x] `payment_records.payment_kind`; Head Accountant records and verifies the fee and downpayment; delivery team created only after the fee is verified; dispatch only after the downpayment is verified
- [x] `field_cases.head_security_id`, Head Security reads assigned cases and gets Field Cases in nav; delivery page for the team; status Dispatched → In Transit → Arriving → Delivered; buyer stepper
- [x] CI delay report → Sales Manager relays to buyer (no penalty); reschedule/redirect ≥ 5 h ahead with fee
- [x] Buyer unavailable (after arrival) → `buyer_unavailable`, no-show, downpayment forfeited; decline Legit → refund disbursement to the Head Accountant, Not Legit → strike + forfeit; missed deadline → Sales Manager notified, cancels from the page
- [x] Mark sold requires Delivered; sale records show the fee / downpayment breakdown
- [x] Fixed a Phase 2 gap: the Sales Manager can now record (not verify) a buyer's payment under RLS
- [x] Migration SQL test, rule tests, unit suite green
- [ ] e2e `src/tests/e2e/t01-phase4-delivery.spec.ts` written (happy path to Delivered, legit decline → refund) but not run; the missed-deadline path needs a past deadline, so it is covered by unit tests only
- Defaults used: Q2 the fee and downpayment are two bank-transfer payments, fee first; Q8 status steps only, no live map; no public-holiday calendar for the deadline.
- Delivery fields: address, preferred date and time. SM sets the serviceable flag and the delivery fee.
- **Payments.** The HA records the delivery fee and the downpayment through the existing `recordPayment`/`verifyPayment` with `bank_transfer`. The downpayment deadline (2–3 working days) uses a pure helper plus the lazy-overdue pattern. Missing it forfeits and prompts the SM to promote the next request. Order and single-vs-two payments depend on Q2.
- **Delivery field case.** Add `field_cases.head_security_id`. The case is dispatched only after the downpayment is verified.
- **Tracking.** Add `field_cases.delivery_status` (dispatched, in_transit, arriving, delivered), updated by the team. The customer sees a stepper. The CI posts the delay note and the SM relays it.
- Reschedule/redirect with a fee (SM records it). The 5-hour cut-off comes from Phase 0. Buyer unavailable sets `flag=buyer_unavailable`, adds a no-show, and forfeits the downpayment.
- Decline: Legit issues a refund (a disbursement to the buyer) with no strike. Not Legit adds a strike and forfeits.
- The live geolocation map is deferred. The source says "if available", so status tracking satisfies the flow (Q8).
- **Exit:** e2e for the delivery happy path, forfeit on missed deadline, and legit-decline refund.

### Phase 5 (gated: client validation of §6): In-House Financing, GCE Visit
- **Gate:** the client signs off on §6 and answers Q4–Q6.
- **Phase A–B.** The SM captures the payment duration and proposes terms. Wire the existing `createPaymentTerms` to a new form, then HA review (new `payment_terms.ha_reviewed_*`), then CEO confirm (existing `approvePaymentTerms`), then buyer decision.
- **Phase C.** Visit; Purchase Claim vs Potential Buyer (`purchase_details.claim_state`). A Purchase Claim sets `vehicles.listing_state='reserved'`; Potential Buyer leaves it `available`. Then Initial Downpayment → HA verify → `activatePaymentTerms` → mark sold.
- **Phase D.** Reuse `installments` and `checkAndNotifyDueInstallments`. Flag missed payments. The grace threshold depends on Q5.
- **Phase E.** Reuse `instructRepossession` and the recovery field case (add head security). Reconditioning uses existing `repairs` / `part_replacements` plus a fund request through `disbursement_requests`. The Marketing Specialist submits a `reprice` proposal, the CEO approves, and the vehicle returns to `available`.

### Phase 6 (gated: source content for §7–11)
Each flow composes existing blocks:

| Section | Flow | Built from |
|---|---|---|
| §7 | Bank transfer, GCE Visit | Phase 2 + `bank_transfer` |
| §8 | Bank transfer, Halfway | Phase 3 + `bank_transfer` |
| §9 | Bank transfer, Delivery | Phase 4 + `bank_transfer` |
| §10 | Financing, Halfway | Phase 5 + Phase 3 |
| §11 | Financing, Delivery | Phase 5 + Phase 4 |

Plan each one only once the client supplies its text.

---

## Open questions for the client

**Q0: approval chain (blocks Phases 1–2)**

| # | Question |
|---|---|
| Q0a | Buyer requests: does the Sales Manager approve alone, as the process doc says? Or does the Task 32 chain (Sales → HA verify → CEO approve) stay? (D1) **Chosen 2026-09-30 by the team: Sales Manager, CEO as override — client to confirm.** |
| Q0b | Sell offers: does the Marketing Specialist verify, propose the ceiling and negotiate, as the process doc says? Or does the Sales Manager keep the valuation, as Task 32 built? (D2) **Answered 2026-09-30: Marketing Specialist.** |

**From source Appendix E and the plan review**

| # | Question |
|---|---|
| Q1 | What is a car's "credit score" (§3 step 3)? Where does it come from? |
| Q2 | Are the Delivery fee and the downpayment separate payments? In what order? (Appendix E 1–2) |
| Q3 | Who is reimbursed in Selling Step 13: the HA or the field team? (Appendix E 4) |
| Q4 | What is the financing approval window: fixed 7 days or another period? (Appendix E 6) |
| Q5 | Missed installments: is the trigger 4 or 5 months, and how does it link to repossession? (Appendix E 7) |
| Q6 | Financing Step 7: does the HA co-calculate or only review? (Appendix E 3) |
| Q7 | Onsite visit: does it have a cancellation cut-off or no-show rule? (Appendix E 8) |
| Q8 | Is live geolocation for delivery required, or are status steps enough? |
| Q9 | Selling Step 3 opens a 7-day window but tells the seller "within 5–7 days". Which does the seller see? |
| Q10 | Selling Step 7, not profitable: the Mechanic tells the seller, but the Marketing Specialist decides after the meetup. Does the Mechanic wait on-site for the decision, or does the Marketing Specialist tell the seller by chat? (Also Appendix E 5: who judges profitability.) |
| Q11 | Halfway / Delivery: when the Active request goes Overdue, do on-hold requests stay blocked, or can the SM promote the next one? |
| Q12 | Appendix C lists field-expense reporting for Selling only. Do Halfway and Delivery field teams also file expenses with proofs? |
| Q13 | Appendix C says "Mark Sold notifies on-hold buyers" for all buying flows, but Onsite has no on-hold queue. Should Onsite notify other buyers with locked slots for that car? |

**Dependencies:** Q0 gates Phases 1–2. Phase 0 depends on no questions. Q2 and Q8 affect Phase 4. Q4–Q6 gate Phase 5. The other questions change a single step and have a default in the plan.

---

## Acceptance checklist (T01 plan artifact)

- [ ] Every step in source §1–4 maps to a phase item.
- [ ] §5 is excluded; §6 and §7–11 are gated phases.
- [ ] Every Appendix E note appears as a question.
- [ ] D1–D5 (process doc vs built behavior) are recorded, each with a gate or fix.
- [ ] Each phase has an exit criterion with an e2e scope.

## Critical files

- `src/lib/transactions/state-machine.ts`, `labels.ts` — status and flag model, `TRANSITION_RULES` (D1/D2)
- `supabase/migrations/00048+` — one migration per phase
- `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx`, `my-transactions/actions.ts`, `my-transactions/_components/transaction-detail.tsx`
- `src/app/(staff)/sell-submissions/**`, `transactions/actions.ts`, `transactions/[id]/_components/*`, `vehicles/actions.ts` (`approvePrice`, D3), `vehicles/_components/price-approvals.tsx`
- `src/app/(staff)/field-cases/**`, `finance/**`, `inquiries/**`
- `src/lib/notifications/actions.ts`, `src/lib/auth/roles.ts`, `src/navigation/sidebar/sidebar-items.ts`, `src/lib/validation/transactions.ts`

## Verification per phase

Run `npm run check:fix`, then `npm run test` (helpers + SQL migration tests), then `npm run test:e2e` with the dev server on :3000 and the phase's new spec. Walk through the flow once per role.
