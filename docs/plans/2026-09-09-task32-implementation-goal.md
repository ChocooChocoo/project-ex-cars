# Task 32 Implementation Goal — GCE Client Feedback (Source of Truth)

> **Created:** 2026-09-09 | **Task:** `docs/tasks/32.md` | **Baseline:** `13a9f01` (task-31 work committed first)
> All implementation agents coordinate against this file. Orchestrator owns shared interfaces + final integration.

## 1. Intended end state

- **Customer portal:** a Buying Requirements guide (step-by-step documents/papers) reachable from the Customer Portal nav + showroom; sell-vehicle submissions require vehicle photos; an optional structured condition parts/issues checklist helps mechanics prioritize inspection.
- **Transaction flow:** Sales Manager processes → Head Accountant verifies correctness → CEO approves/rejects → car marked sold. CEO surface is primarily Approve/Reject. Price is proposed by Sales/AM (valuation / price proposal), approved by CEO; CEO does not set price after payment.
- **Suppliers:** supplier records distinguish offering (`vehicle` | `parts` | `both`) alongside legal-entity kind (`company` | `individual`); actual vehicle suppliers are representable and filterable.
- **Responsibilities:** Create Walk-In Account + Attendance checking owned by Account Manager (CEO keeps read/summary oversight; Head Accountant keeps attendance read for payroll cross-check). Mechanic assignment in Field Cases owned by Confidential Informant (CEO keeps override).
- **Field Cases:** the Create modal is finalized and testable (transaction-or-vehicle picker, worker picker, actionable errors); CI create/update passes RLS.
- **Head Accountant:** verification duties are explicit in code/UI (document + payment verification), closing the JD information gap for this implementation.
- **Planner:** no new Planner module; Roadmap remains the CEO-owned business-milestone planner (rescued from IT-team template residue); Productivity is personal productivity, not an IT planner.
- **Branding:** GCE logo/images/company details explicitly DEFERRED (out of scope).

## 2. Shared interfaces (orchestrator-owned — agents: read, do not redesign)

- `src/lib/transactions/state-machine.ts` — `TRANSITION_RULES` / `canTransition` / `getAllowedTransitions`. Target: `pending→under_review` by sales_manager/account_manager; `under_review→approved/rejected` CEO-primary; `approved→completed/cancelled` by sales_manager/ceo/head_accountant (+ existing doc gate + auto-sold). All status UI consumes this.
- `src/lib/auth/roles.ts` — `ROLE_NAV_ACCESS` (+ new `cust-buying-guide` for customer), `ROLE_LANDING_PAGES` unchanged. Guard changes: `createWalkInAccount` → account_manager (+documented CEO override decision); `ATTENDANCE_CHECKERS` → account_manager primary; `assignMechanic` → confidential_informant (+CEO override).
- `src/navigation/sidebar/sidebar-items.ts` — add `cust-buying-guide` under Customer Portal; no other group changes.
- `src/lib/routing/paths.ts` + `src/middleware.ts` — buying-guide resolves via existing `sell-vehicle`-style passthrough (add `buying-requirements` branch mirroring `sell-vehicle`).
- Validation (`src/lib/validation/transactions.ts`, `phase6.ts`) — extend compatibly (optional fields only); client + server parse the same schema.
- Migrations (new, ordered): `00040_task32_sell_condition_photos` (sell_details.condition_items JSONB + sell_photo kind), `00041_task32_supplier_offering` (supplier_offering + index), `00042_task32_field_case_workers` (CI/mechanic worker INSERT/UPDATE), `00043_task32_attendance_reviewer` (review_attendance narrowed to account_manager). Then regenerate `database.types.ts`. No `DISABLE RLS`, no `FOR ALL` broadening.

## 3. Integration requirements

- Data flow preserved: customer sell → `transactions(sell,pending)` + `sell_details(+condition_items)` + `transaction_documents(sell_photo)` + draft `vehicles(draft)`; HA verify → CEO approve → complete → `vehicles.listing_state='sold'`.
- Summaries derive from the same RLS-filtered queries as detail (no separate stores). `audit_events` logging preserved on all worker actions.
- No file overlaps between agents (see §5). Shared files edited only by orchestrator.

## 4. Acceptance criteria

- [ ] Buying guide reachable from Customer Portal nav + showroom link; content lists 2 valid IDs + proof of billing + arrangement options.
- [ ] Sell submit without photos fails (client + server); staff can view photo thumbnails.
- [ ] Condition checklist (if recommended — YES, non-blocking) stored on `sell_details`, visible read-only to mechanics/inspections.
- [ ] Staff detail shows `Processed (Sales) → Verified (HA) → Approved (CEO) → Sold` provenance; CEO sees Approve/Reject only; HA can verify purchase docs; completion marks car sold.
- [ ] Suppliers filter vehicle/parts/both; KYC/approval (2 primary IDs) unchanged.
- [ ] Walk-In + Attendance check actions succeed as Account Manager; CEO read-only; HA attendance read retained.
- [ ] CI can assign mechanics; Sales Manager cannot (server guard + UI gating).
- [ ] Field Cases Create succeeds with tx-or-vehicle + worker; CI create/update passes RLS; e2e covers the modal.
- [ ] Roadmap teams are GCE business teams with justification note; Productivity guarded (no IT-planner marketing).
- [ ] Branding images/logo NOT added.

## 5. Responsibility map (disjoint files)

| Stream | Owner | Files |
|---|---|---|
| Shared (state machine, nav, paths, roles guard lists) | Orchestrator | `state-machine.ts`, `roles.ts`, `sidebar-items.ts`, `paths.ts` |
| WS-B Customer | Agent-B | `sell-vehicle-form.tsx`, `my-transactions/actions.ts` (submitSellVehicle only), `validation/transactions.ts` (sell schema only), new `buying-requirements/page.tsx`, migration 00040 |
| WS-C Approval flow UI+actions | Agent-C | `transactions/actions.ts` (transition/verify/recordPaperwork/reviewSell only), `transactions/[id]/_components/*-v1.tsx` (triage, sidebar, overview) |
| WS-D Suppliers + reassignment | Agent-D | `suppliers/**`, `auth/actions.ts` (createSupplier + createWalkInAccount guards only), `staff-records/**`, `attendance/page.tsx` + client check gating, migration 00041 |
| WS-E Field Cases | Agent-E | `field-cases/**`, `transactions/actions.ts` (createFieldCase + assignMechanic only), `validation/phase6.ts` (field-case schemas only), migration 00042 |
| WS-F Planner/roadmap | Agent-F | `roadmap/**`, `validation/roadmap.ts`, `productivity/page.tsx` guard |
| Review + testing | Reviewer / Tester agents | read-only review, then `check:fix`, `test`, `test:e2e` (dev server :3000) |

> **Integration adjustments (orchestrator, post-stream):** WS-C sidebar needed
> `normalizeConditionItems` + photo/condition render block + `isCeo` gating
> completed by orchestrator; `transactions/[id]/page.tsx` +
> `staff-transaction-detail.tsx` (checklist name map + history/documents
> pass-through) are orchestrator integration files. WS-B showroom link +
> stepper hint copy added by orchestrator. `00043` attendance RPC narrowing
> delivered inside WS-D. All `check`-clean.

## 6. Required checks (before completion)

`npm run check:fix` → `npm run check` clean → `npm run test` pass → `npm run test:e2e` pass (requires `npm run dev` on :3000). Biome: kebab-case, import order react→next→packages→`@/`→relative, no import cycles, no floating promises. Rerun directly-affected tests after every fix, then the broader suite.
