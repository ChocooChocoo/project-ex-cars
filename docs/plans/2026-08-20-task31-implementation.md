# Task 31 Implementation Plan — From Audit Recommendations to Code Changes

> **For agentic workers:** REQUIRED SUB-SKILL: Use `builder.md` for implementation, plus `frontend`, `auth`, `security`, `testing`, `reviewer` as noted. Steps use checkbox tracking.
> **Source:** `docs/tasks/31.md` (audit only) + 10 reports under `docs/report/` (CEO #1 through Supplier #10, reviewer conditional FAIL fixed, security PASS)
> **Plan location:** `docs/plans/2026-08-20-task31-implementation.md`
> **Created:** 2026-08-20 | **Orchestrator:** delivery orchestrator | **Planner basis:** evidence from `src/lib/auth/roles.ts`, `src/navigation/sidebar/sidebar-items.ts`, `src/app/(staff)/*`, `src/app/(customer)/*`

**Goal:** Implement the smallest set of code changes that realize Task 31 audit "Simplify / Consider for Revision" suggestions while preserving all essential controls, audit trails, and RLS — without deleting modules or weakening least privilege.

**Architecture:** Navigation/visibility-only changes first (supplier discoverability + landing), then summary-first UI strips/steppers behind drill-down, then scoped visibility narrowing (payslips/finance ledger). No new tables/RLS policies; summaries are aggregated views of authoritative queries. Technology-agnostic: keep existing Next.js 16 / App Router / Supabase patterns.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, Supabase RLS, RBAC via `ROLE_NAV_ACCESS`, alias `@/*`

---

## 1. Goal & Scope

### In Scope (will implement)
- **WS-A Supplier Navigation Fix** — make `supplier-messages` discoverable, create Supplier-scoped overview (own profile + documents + messages), adjust `ROLE_NAV_ACCESS.supplier` and `ROLE_LANDING_PAGES.supplier`, hide Customer shopping for Supplier behind labeled secondary area
- **WS-B Summary-First UI** — non-blocking summaries: CEO Finance/Transactions/Attendance/Content/Inquiries/Security Checks; Account Manager Attendance; Head Accountant Vehicles/Attendance; Head Security Vehicles/Attendance/Requests/Security Checks; Customer Transactions progress stepper + Find Your Car badge wording
- **WS-C Scoped Visibility Narrowing** — CEO/Account Manager Payslips summary-only (+ own), Confidential Informant finance ledger summary-only (own + totals), Head Accountant read-only pending price proposals (SELECT-only, no approve)

### Out of Scope (explicitly will NOT do)
- No deletion of RLS policies, `ENABLE ROW LEVEL SECURITY`, or `private.user_roles` checks
- No hard removal of CEO breadth (23 modules) or any staff module — only `Supplier` Customer shopping visibility changes (which are misassigned, not security controls)
- No new DB migrations unless Architect confirms supplier portal needs separate table — assume existing `suppliers`/`supplier_documents`/`supplier_messages` sufficient
- No redesign of entire dashboards, no new roles, no bulk permission rewrites
- No `DISABLE RLS`, `USING(true)`, or permissive policies
- No implementation of `supplier-documents` self-upload for Supplier unless approved (preserve staff-only upload + 2-ID verification)

---

## 2. Inspection Summary

- **Files inspected:** 10 reports (`REPORT-CEO.md` 159 lines/23 modules through `REPORT-SUPPLIER.md` 102 lines/7+Appendix), `src/lib/auth/roles.ts` (GCE_ROLES 10, ROLE_NAV_ACCESS 10 sets, ROLE_LANDING_PAGES 10, STAFF_ROLES 8), `src/navigation/sidebar/sidebar-items.ts` (7 nav groups, ids: default, finance, vehicles, showroom, content, inspections, inquiries, recommendations, transactions, roadmap, suppliers, staff-records, attendance, employee-requests, payroll, payslips, field-cases, security-duty-checks, reports, announcements, supplier-messages, roles, users, plus Customer Portal 7), `src/app/(staff)/supplier-messages/page.tsx` (ceo/supplier only, ownSupplierId scoping, realtime) and `src/app/(staff)/suppliers/page.tsx` (ceo/account_manager only), `src/app/(customer)/*` 7 routes, `supabase/migrations/00001*`, `00019_supplier_messages`, `00024_supplier-onboarding` (supplier-documents bucket)
- **Pattern emerged:** 70% `Keep` (Marketing 5/5, Mechanic 5/5 correct), 25% `Simplify` (summary-first), 5% `Consider for Revision` (Payslips, Finance ledger, Supplier portal) — only Supplier `Consider for Removal` of 5 Customer modules is structural
- **Verification already done:** Reviewer conditional FAIL (jargon in HEAD_SECURITY + SUPPLIER bodies) fixed via 8 surgical edits; Security PASS (0 unsafe removals, controls preserved: CEO price approval, finance verify, payroll finalize/mark_paid, 2-ID verification, before/after evidence)
- **Risk baseline:** Supplier today mirrors Customer (`ROLE_NAV_ACCESS.supplier == customer` 7 cust-*) → hides actual supply tools (own profile, documents, messages) → pending suppliers land in showroom with no answer

---

## 3. Affected Areas

**Will change:**
- `src/lib/auth/roles.ts` — `ROLE_NAV_ACCESS.supplier`, `ROLE_LANDING_PAGES.supplier` (and possibly `head_security` guard-team filter if approved)
- `src/navigation/sidebar/sidebar-items.ts` — Supplier portal grouping (new `My Supplier Profile`, `My Documents`, `Messages` vs Customer shopping secondary)
- `src/app/(staff)/supplier-messages/page.tsx` + `_components/supplier-message-thread.tsx` — scoping already exists, needs nav discoverability only
- `src/app/(supplier)/` **or** `src/app/(staff)/supplier-overview/page.tsx` — NEW Supplier-scoped overview (own `suppliers` row + `supplier_documents` list + verification progress `2 of 2` + inbox badge) — choose path per Architect (see §8)
- `src/app/(staff)/finance/page.tsx` + `_components/finance-client.tsx` — Confidential Informant ledger summary, CEO summary
- `src/app/(staff)/transactions/page.tsx` + `_components/*` — CEO/Account Manager summary strip
- `src/app/(staff)/payslips/page.tsx` + `payroll/page.tsx` — summary-only for CEO/Account Manager
- `src/app/(staff)/vehicles/page.tsx` — Head Accountant finance summary, Head Security lot filter, Mechanic/Sales filters
- `src/app/(staff)/attendance/page.tsx` — summary strips
- `src/app/(customer)/my-transactions/_components/transactions-view.tsx` + `my-transactions/page.tsx` — Customer progress stepper
- `src/app/(staff)/attendance/page.tsx`, `security-duty-checks/page.tsx`, `inquiries/page.tsx`, `content/page.tsx` — summary strips

**Will NOT change:**
- `supabase/migrations/*` RLS policies (unless new Supplier portal needs separate view — TBD)
- `src/app/(staff)/suppliers/page.tsx` full management (keep ceo/account_manager only, do NOT expose to Supplier)
- Marketing/Mechanic core flows (already correct)
- `private.user_roles`, `audit_events` immutability

---

## 4. Workstream Sequence

### Workstream A — Supplier Navigation & Access Fix (Highest Impact, Unblocks Supplier)
**Priority:** P0 | **Prerequisite:** Architect decision §8.1 (portal path) | **Parallelizable:** No — blocks B/C landing assumptions

**Owner:** `builder` + `auth` (for ROLE_NAV_ACCESS) + `frontend` (for Supplier overview UI) + `security` reviewer
**Files:**
- Modify: `src/lib/auth/roles.ts:163` (`ROLE_NAV_ACCESS.supplier`), `src/lib/auth/roles.ts:273` (`ROLE_LANDING_PAGES.supplier`), `src/navigation/sidebar/sidebar-items.ts` (new Supplier Portal group), `src/app/(staff)/supplier-messages/page.tsx` nav filtering
- Create: `src/app/(supplier)/overview/page.tsx` OR `src/app/(staff)/supplier-overview/page.tsx` + `_components/supplier-overview-client.tsx` (own profile + documents + messages badge)
- Create/Modify tests: `src/app/(supplier)/overview/page.test.tsx` or `src/app/(staff)/supplier-overview/page.test.tsx`

**Steps:**
- [ ] Step 1: Inspect current `ROLE_NAV_ACCESS.supplier` == customer (7 cust-*) and `ROLE_LANDING_PAGES.supplier=/showroom` plus hidden `supplier-messages` (exists but not in nav)
- [ ] Step 2: Write failing test — supplier sees Supplier overview as landing, sees own profile/documents/messages, does NOT see Find Your Car/Favourites/Request a Car/My Inquiries/Transactions (or sees behind "Personal" secondary)
- [ ] Step 3: Update `ROLE_NAV_ACCESS.supplier` to Supplier-scoped set (e.g., `supplier-overview`, `supplier-documents`, `supplier-messages` plus optional `cust-showroom` as secondary Market View), update `ROLE_LANDING_PAGES.supplier=/supplier-overview`, add Supplier Portal group to `sidebar-items.ts`
- [ ] Step 4: Create Supplier overview page scoped to `suppliers.account_id=auth.uid()` + `supplier_documents` list + verification progress, reuse existing `supplier-messages` thread component
- [ ] Step 5: Run `npm run check:fix` + `npm run test` + manual role-switch (supplier pending vs approved)
- [ ] Step 6: Security review — confirm RLS `Approved suppliers can read own record` preserved, no full `suppliers` exposure, `supplier-documents` bucket private

**Acceptance Criteria:**
- Supplier pending sees approval state + "2 of 2 primary IDs" checklist, not showroom
- Supplier approved sees own profile + documents + Messages in nav (discoverable), Customer shopping hidden or behind "Personal (buy/sell as Customer)" label
- Customer flow unchanged, staff Suppliers management unchanged

### Workstream B — Summary-First UI Enhancements (Low Risk, Parallelizable)
**Priority:** P1 | **Prerequisite:** None | **Parallelizable:** Yes — B1/B2/B3 can run in parallel by different builders

**Owner:** `builder` + `frontend` | **Files by sub-stream:**
- **B1 CEO summaries:** `src/app/(staff)/finance/_components/*`, `src/app/(staff)/transactions/_components/*`, `src/app/(staff)/attendance/page.tsx`, `src/app/(staff)/content/page.tsx`, `src/app/(staff)/inquiries/page.tsx`, `src/app/(staff)/security-duty-checks/page.tsx`
- **B2 Staff summaries:** `src/app/(staff)/attendance/_components/*`, `src/app/(staff)/vehicles/_components/*`, `src/app/(staff)/security-duty-checks/_components/*`, `src/app/(staff)/reports/page.tsx`
- **B3 Customer UX:** `src/app/(customer)/my-transactions/_components/transactions-view.tsx` (progress stepper), `src/app/(customer)/recommendations/_components/recommendation-form.tsx` (badge wording), `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx` (Condition dropdown)

**Steps per sub-stream:**
- [ ] Add `SummaryBar` component (reuses existing card/badge) at top: e.g., CEO Finance totals/exceptions, Transactions totals, Attendance today present/late/absent, Security Checks today pending/missing evidence; Customer Transactions stepper (Requested → Details → Documents → Review → Complete/Cancel)
- [ ] Keep full detail behind drill-down/filter — no access change, aggregation from authoritative query (not separate store)
- [ ] Add small lot/mycase filters: Head Security "on-lot available/reserved", Mechanic "needs inspection / assigned to me", Sales "available / needs reply / my created"
- [ ] Test: `npm run test` (Vitest), visual check that full list still reachable, no RLS change

**Acceptance Criteria:**
- CEO sees Finance/Transactions summary first, full ledger still reachable (1 click), no new permissions
- Customer sees Transactions stepper on detail, plain language status, existing upload/cancel preserved
- No module deleted, no control removed

### Workstream C — Scoped Visibility Narrowing (Sensitive, Requires Security Review)
**Priority:** P1 | **Prerequisite:** Workstream A landing decision (for informant finance context) | **Parallelizable:** No — needs sequential security sign-off

**Owner:** `builder` + `auth` + `security` reviewer
**Files:**
- `src/app/(staff)/payslips/page.tsx` + `_components/*` — CEO/Account Manager summary-only (+ own)
- `src/app/(staff)/finance/page.tsx` + `_components/finance-client.tsx` — Confidential Informant ledger summary vs full ledger
- `src/app/(staff)/vehicles/page.tsx` + `_components/vehicle-operations.tsx` — Head Accountant read-only pending price proposals (SELECT-only replica)

**Steps:**
- [ ] Step 1: Payslips — for `ceo` and `account_manager`, default view shows pay run summary + exception + own payslip; full individual slips behind "View all (Finance)" drill-down with audit log; Head Accountant retains full + mark_paid
- [ ] Step 2: Confidential Informant finance — default shows totals + own disbursement requests + own-request tracking; full 100-row ledger behind drill-down with finance-role check + audit event; preserve cannot record/verify/advance
- [ ] Step 3: Head Accountant price proposals — add read-only view of pending proposals (price, acquisition cost, status) derived from vehicles query, no propose/approve, CEO remains sole approve, SELECT-only, RLS filtered, audit-logged view
- [ ] Step 4: Run `npm run test` + manual role-switch + `security` review for each

**Acceptance Criteria:**
- CEO/Account Manager cannot bulk browse individual payslips by default, but can audit when needed (logged)
- Informant cannot see full revenue/expense detail by default (least exposure), can still request/track field funds
- Head Accountant can tie purchase costs to finance without approval power creep

---

## 5. Acceptance Criteria (Global)

- Every implemented change has a test or manual verification showing: before (old nav/summary) vs after (new), role-specific, preserves controls
- `npm run check:fix` passes (biome), `npm run test` passes, `npm run test:e2e` passes for supplier flow (requires dev server)
- No `DISABLE RLS`, no new permissive policy, no deleted `audit_events` guard
- All `Consider for Removal` of Supplier shopping results in hidden/secondary, not hard delete of code — Customer shopping code reused, staff code untouched

---

## 6. Test Strategy & Validation

**Automated:**
- `npm run check:fix` → `npm run check` (report only)
- `npm run test` (Vitest, jsdom) — add/update tests for: Supplier overview scoping (`account_id=auth.uid()`), Payslips summary vs detail, Finance ledger summary, Transactions stepper rendering
- `npm run test:e2e` (Playwright, requires `npm run dev` on :3000) — supplier pending→approved flow, Messages discoverability, Customer stepper

**Manual (role-switch via assigned role RPC):**
- Login as `supplier` pending → lands on overview, sees checklist, not showroom; approved → sees Messages in nav, can open own thread, cannot open `/suppliers` full list
- Login as `ceo` → Finance/Transactions show summary, full detail reachable; Payslips shows summary
- Login as `confidential_informant` → Finance shows totals+own, full ledger behind drill-down
- Login as `head_accountant` → Vehicles shows pending proposals read-only
- Login as `customer` → Transactions shows stepper, no regression

**Edge Cases:**
- Supplier with no `suppliers` row (invite not yet) → overview shows pending message, no error
- Supplier suspended/archived → sign-in gate blocks, shows correct message (`src/app/auth/actions.ts`)
- Supplier who also buys personally → "Personal" secondary area vs Supplier primary — confirm no data leak (`customer_id` inbox not shown in Supplier)
- Head Security guard-team filter without team assignment → empty state, no full staff log exposure
- Stale summary — summaries must be derived from same RLS-filtered query as detail (no separate store)

**Rollback:**
- Revert `ROLE_NAV_ACCESS.supplier` + `ROLE_LANDING_PAGES.supplier` + sidebar group to previous (7 cust-*) — single commit
- Feature-flag via role check: keep both nav sets behind `if (role==='supplier')` branch for canary

---

## 7. Risks, Dependencies, Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supplier portal path choice (`(supplier)` vs `(staff)/supplier-overview`) affects layout guards | Wrong layout exposes staff header/sidebar or breaks customer layout | Architect must decide before WS-A; both use same Supabase RLS, but `(supplier)` isolates, `(staff)` reuses `getCurrentRole()` |
| Broadening Head Security to guard-team view leaks all staff attendance | Payroll accuracy risk | Keep `ATTENDANCE_CHECKERS` guard (ceo/account_manager/head_accountant only), add filtered `security_id IN guard_team_ids` view only if `team_lead` relationship exists, keep `checked_by` trail |
| Summary stale vs authoritative | Finance misstatement | Derive summary from same query as detail, no separate store, same RLS |
| Customer/Supplier role confusion (same person) | Shopping data leak to Supplier view | Keep `customer_id=auth.uid()` scoping, Supplier primary shows `supplier_id` scoping, "Personal" secondary clearly labeled, no mixed inbox |
| Over-narrowing Payslips breaks audit | CEO cannot audit when needed | Keep drill-down with audit log, not hard block |
| Informant finance narrowing breaks field fund request | Cannot track own request | Preserve own disbursement + request/own-tracking, summary is totals only |

**Dependencies:** Supabase `suppliers`/`supplier_documents`/`supplier_messages` tables + RLS + `supplier-documents` bucket already exist (verified in SUPPLIER report). No new migration assumed; if Architect finds missing view, add migration as separate WS.

---

## 8. Assumptions & Unresolved Questions (Need Architect Before WS-A)

**Assumptions:**
- Chronological order = `GCE_ROLES` order (CEO #1 ... Supplier #10) per earlier decision log
- 10 reports expected, all under `docs/report/` — already produced and fixed
- No new DB migration needed — existing supplier tables + RLS sufficient (see `00001_phase1_schema.sql` `suppliers`, `supplier_documents`, `00019_supplier_messages`, `00024_supplier-onboarding`)
- Smallest complete = navigation/visibility only, no business logic change
- Reviewer fixed jargon, Security PASS stands — controls to preserve listed in §1 Out of Scope

**Unresolved — Architect must decide before Builder starts:**

1. **Supplier portal path:** `src/app/(supplier)/overview` (new route group, separate layout, customer-like) vs `src/app/(staff)/supplier-overview` (reuses `(staff)` layout with `ROLE_NAV_ACCESS` filtering). Trade-off: isolation vs reuse. **Recommendation:** `(supplier)` isolation to avoid staff header leakage, but confirm with `src/app/(staff)/layout.tsx` `getCurrentRole()` pattern.
2. **Supplier self-upload:** Should approved Supplier be allowed to self-upload `supplier_documents` (currently staff-only `uploadSupplierDocument` restricted to ceo/account_manager/head_accountant) or keep staff-only upload? Affects RLS for `supplier-documents` bucket. **Recommendation:** Keep staff-only for now (preserve 2-ID verification), revisit later.
3. **Guard-team relationship:** Does `head_security` have a `guard_team_ids` mapping table? If not, scoped guard-team filters for Head Security cannot be implemented without new table — defer to future.
4. **Payslips drill-down audit:** Should CEO drill-down to full payslips create an `audit_events` entry? Recommend yes for traceability.
5. **Price proposal replica:** For Head Accountant read-only proposals, should it be a derived view or direct `vehicles` query with `status=pending_price_approval` filtered? Recommend direct query with `SELECT`-only, no new view.

---

## 9. Handoff

**Evidence supporting decisions:**
- `docs/report/REPORT-SUPPLIER.md:66-94` — Appendix shows supplierMessages already built but not in nav, `ROLE_NAV_ACCESS.supplier == customer` identical, landing `/showroom` wrong, own profile/documents/messages scoping already coded (`ownSupplierId`, `suppliers.account_id=auth.uid() and state='approved'`, `supplier-documents` bucket)
- `docs/report/REPORT-CEO.md:15-135` — Simplify list (Content review/approve, Inquiries summary, Finance/Transactions summary, Attendance exceptions, Security Checks compliance summary)
- `docs/report/REPORT-CONFIDENTIAL_INFORMANT.md:22-36` — Finance ledger over-exposure (100 rows visible to field role, should be summary)
- Reviewer evidence: 6 BLOCKING jargon locations fixed, now 0 in body; Security evidence: 0 unsafe removals, controls table (CEO price approval, finance verify, payroll finalize, 2-ID, before/after evidence)
- `src/lib/auth/roles.ts:163-271` — `ROLE_NAV_ACCESS` sets (23/19/9/7/5/5/11/6/7/7) and `ROLE_LANDING_PAGES`
- `src/navigation/sidebar/sidebar-items.ts` — 7 groups, `supplier-messages` exists but not assigned to supplier in `ROLE_NAV_ACCESS`

**Prerequisites for Builder:**
- Architect decisions §8.1-8.5 signed off
- `docs/report/` 10 reports available (already)
- Dev server on :3000 for `test:e2e` supplier flow

**Contracts:**
- Keep `private.user_roles active=true` check
- Keep `suppliers.state` machine `invited→registered→pending_approval→approved→rejected→suspended`
- Keep `DOCUMENT_VERIFICATION_STATES pending/verified/rejected` + 2-primary-ID gate
- Keep `audit_events` immutable (`No one can update/delete`)

**File paths for reference:**
- `D:\Personal Files\Projects\CapsApp\project-01-car\src\lib\auth\roles.ts`
- `D:\Personal Files\Projects\CapsApp\project-01-car\src\navigation\sidebar\sidebar-items.ts`
- `D:\Personal Files\Projects\CapsApp\project-01-car\src\app\(staff)\supplier-messages\page.tsx`
- `D:\Personal Files\Projects\CapsApp\project-01-car\src\app\(staff)\suppliers\page.tsx`
- `D:\Personal Files\Projects\CapsApp\project-01-car\src\app\(customer)\*`
- `D:\Personal Files\Projects\CapsApp\project-01-car\docs\report\*.md` (10)

---

**Next step for Orchestrator:** Resolve §8 with Architect (sync or async), then dispatch `builder` + `auth` + `frontend` for WS-A, followed by parallel WS-B sub-streams, then WS-C with security review gate.

