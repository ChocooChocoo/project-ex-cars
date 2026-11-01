---
title: "Task 31 — Implement All Audit Recommendations and Revisions (10 Reports, 99 Modules)"
status: complete
created_at: "2026-08-21T01:54:16+08:00"
updated_at: "2026-08-21T10:35:00+08:00"
source: "docs/tasks/31.md + docs/report/REPORT-*.md (10 reports, 99 module evaluations, chronological CEO #1 → Supplier #10)"
prior_plan: "docs/plans/2026-08-20-task31-implementation.md (WS-A/B/C, commit 2197c1f partial)"
decision: "Supplier Customer shopping FULLY HIDDEN (Option A, no secondary Personal group; dual-role supplier needs second account)"
---

# Task 31 Implementation Plan — Recommendations & Revisions (Decision-Complete)

> **For agentic workers:** REQUIRED SKILL: `builder` + `frontend` + `auth` + `security` + `testing` + `reviewer`. No product code changes in this plan file — plan only. Steps use checkbox tracking.
> **Orchestrator:** Daedalus planner | **Created:** 2026-08-21 | **Status:** `complete` — executed via Kratos, verified.
> **Stack:** Next.js 16 App Router, React 19 + Compiler, Tailwind v4 (no config), shadcn/ui, Supabase RLS, RBAC via `ROLE_NAV_ACCESS`, alias `@/*`, Vitest jsdom + Playwright `:3000`.

## 1. Goal & Success Criteria

### Goal
Implement **every actionable `Simplify` + `Consider for Revision/Removal` recommendation** from the 10 audit reports — without deleting modules, weakening RLS, or removing essential controls — so each user level sees only what is necessary for its responsibilities, in the simplest safe form, behind a one-click drill-down.

### Success Criteria (verifiable)
- **Every report trio addressed:** For all 10 reports, each `Overall Recommendations: Keep / Simplify / Consider` line has a corresponding code change or explicit `Confirmed no change, reason` in the PR description. No report left untouched.
- **Supplier portal primary:** Supplier signs in → lands `/supplier/overview` (not `/showroom`), sees **only** Supplier Portal (`My Supplier Profile` + `My Documents` progress + `Messages` with badge). Customer shopping routes (`/showroom`, `/recommendations`, `/my-inquiries`, `/my-transactions`, `/request-a-car`, `/sell-vehicle`, `/favourites`) are **not visible** in Supplier nav and direct URL is guard-redirected to `/supplier/overview`.
- **Summary-first where flagged:** CEO Finance/Transactions/Attendance/Content/Inquiries/Security Checks, Account Manager Attendance, Head Accountant Vehicles/Attendance, Confidential Informant Finance ledger, and Customer Transactions stepper all show a **summary strip/stepper first** with full detail behind 1-click drill-down or tabs. Full table still reachable, same RLS-filtered query (no second store, no stale totals).
- **Narrowing where flagged:** CEO/Account Manager Payslips defaults to `summary + own payslip` with full browse behind `View all` + audit log; Confidential Informant finance ledger defaults to `totals + own disbursement requests` with full 100-row ledger behind collapsed details; Head Accountant sees read-only pending price proposals (`SELECT`-only, no approve); Account Manager `Roles` is view-only (assignments gated to CEO).
- **Sell Vehicle wording:** `Condition` free-text → `Select` enum (`excellent / good / fair / needs_repair`) + optional detail box, mirrored in Zod schema; legacy values transform, no DB CHECK break.
- **Verification:** `npm run check:fix` passes (biome, lineWidth 120, kebab-case, `noImportCycles`/`noFloatingPromises` zero), `npm run test` passes (vitest jsdom + new unit tests), `npm run test:e2e` Supplier flow passes (pending → overview → messages) on `:3000` with dev server, manual role-switch checklist passes for all 10 roles (see §6).
- **Security invariants preserved:** No `DISABLE RLS`, no `USING(true)`, no deleted `private.user_roles`/`audit_events` guard, no `supplier-documents` permissive policy, 2-ID verification gate intact, `before/after` evidence required on Security Checks, payroll `finalize/mark_paid` separation intact.

## 2. Scope and Constraints

### In Scope (will implement — maps 1:1 to report recommendations)
**From report tallies: 99 module evaluations, 82 `Keep` tags, 9 `Simplify` tags, 16 `Consider` tags. Overall unique actions ≈ 77 Keep / 11 Simplify / 10 Revision.**

| Area | Report source | Action |
|---|---|---|
| **WS-A.3 Supplier nav hardening** | `REPORT-SUPPLIER.md:88-94` Overall + Appendix | Narrow `ROLE_NAV_ACCESS.supplier` from 9 → 2-3 Supplier items, hide 7 `cust-*` fully (Option A), add route guards in `(customer)/layout.tsx` to redirect supplier direct URLs, keep `supplier-messages` discoverable, keep `(supplier)/overview` isolated layout, add unread badge to overview |
| **WS-B.1 CEO summaries** | `REPORT-CEO.md:151-152` | Finance one-page totals/exceptions strip, Transactions already has `TransactionsKpiStrip` (confirm CEO-specific not needed), Content review/approve queue strip, Inquiries inbox summary (counts/unread), Attendance daily present/late/absent/exception strip, Security Checks daily compliance + missing-evidence strip, Supplier Messages `view/intervene` note (already 5 `Simplify` tags) |
| **WS-B.2 Staff summaries** | `REPORT-HEAD_ACCOUNTANT.md:67-69`, `REPORT-ACCOUNT_MANAGER.md:127-128`, `REPORT-HEAD_SECURITY.md:59-61`, `REPORT-SALES_MANAGER.md:83-84` | Head Accountant Vehicles finance summary (price/cost/status) + Attendance summary strip; Account Manager Attendance summary; Head Security Vehicles on-lot filter + Attendance/Requests/Security Checks strips (optional P1 if guard-team table absent → keep own-only self-service per `REPORT-HEAD_SECURITY`); Sales/Mechanic `my/available/needs inspection` filters (P2 quality-of-life, low effort `ToggleGroup` / `ColumnFiltersState`) |
| **WS-B.3 Customer UX** | `REPORT-CUSTOMER.md:67-68` | Transactions `ProgressStepper` already done (`transaction-detail.tsx:47-97`) — confirm; Find Your Car plain one-line explanations on form badges before submit (not only results), Sell Vehicle `Condition` dropdown (also covers Supplier `Sell Vehicle` revise) |
| **WS-C Scoped narrowing** | `REPORT-CEO.md:153`, `REPORT-ACCOUNT_MANAGER.md:129`, `REPORT-CONFIDENTIAL_INFORMANT.md:56-57`, `REPORT-HEAD_ACCOUNTANT.md:69` | CEO/AM Payslips `summary + own` default with `View all (Finance)` behind audit-logged button; Confidential Informant finance ledger `totals + own disbursements` default with full ledger collapsed; Head Accountant read-only pending price proposals (SELECT-only replica, additive RLS policy); AM Roles `view-only + approval-gated edits` |

### Out of Scope (explicitly will NOT do)
- No deletion of `supabase/migrations/*` RLS, `ENABLE ROW LEVEL SECURITY`, `private.user_roles active=true`, or `audit_events` immutable policies (`No one can update/delete`).
- No `DISABLE RLS`, `USING(true)` permissive policies, or `security_definer` views. New policies are `ADDITIVE` `IF NOT EXISTS` with `EXISTS (select 1 from private.user_roles …)` scoping only (Head Accountant proposals read).
- No removal of CEO breadth (23 modules) — only Supplier Customer shopping hidden; all staff modules preserved behind summary/drill-down, not deleted.
- No `supplier-documents` self-upload for Supplier in this plan (keep `uploadSupplierDocument` staff-only `ceo/account_manager/head_accountant` + 2-ID gate). Supplier sees docs list read-only.
- No new roles, no Guard-team mapping table for Head Security (deferred — see §9 Assumption 3).
- No redesign of entire dashboards, no `Marketing`/`Mechanic` core flow changes (already `Keep 5/5` perfect).

### Constraints (from `AGENTS.md` + `docs/tasks/31.md:48-66`)
- Use only agents in `.opencode/agents` (orchestrator fleet), parallel where independent, sequential where file-overlapping.
- No code changes during audit already satisfied — this plan is post-audit implementation, suggestions remain reversible (nav visibility only, no hard delete of `src/app/(customer)/*` code).
- Plain non-technical language in reports preserved; code stays technical but PR description must mirror report phrasing.
- Biome conventions enforced: kebab-case, `react → next → packages → @/ → relative` import order, lineWidth 120, double quotes, `noImportCycles` error, `noFloatingPromises`/`noMisusedPromises` error. `src/components/ui/` is shadcn regeneration zone — never hand-format.
- Pre-commit hook: `generate:presets → git add theme.ts → lint-staged (biome autofix)` — must pass `check:fix` before commit.

## 3. Repository Evidence (inspected 2026-08-21)

**Reports inspected:** `REPORT-CEO.md` 23/159l, `REPORT-ACCOUNT_MANAGER.md` 19/136l, `REPORT-HEAD_ACCOUNTANT.md` 9/76l, `REPORT-CONFIDENTIAL_INFORMANT.md` 7/64l, `REPORT-MARKETING_SPECIALIST.md` 5/53l, `REPORT-MECHANIC.md` 5/60l, `REPORT-SALES_MANAGER.md` 11/91l, `REPORT-HEAD_SECURITY.md` 6/68l, `REPORT-CUSTOMER.md` 7/75l, `REPORT-SUPPLIER.md` 7+Appendix/103l + `docs/tasks/31.md` 31.md 129l. Totals 99 modules, tags `Keep=82 Simplify=9 Consider=16`.

**Prior implementation evidence (commit `2197c1f`):** `feat(task31): audit 10 user levels and implement supplier portal + summary UX` — 23 files, 1828 insert, adds `(supplier)/overview`, `supplier-overview.ts:fetchOwnSupplierOverview` (admin client + `account_id=auth.uid()` guard), `ROLE_NAV_ACCESS.supplier` 7→9, `ROLE_LANDING_PAGES.supplier /overview`, `Customer Transactions stepper + recommendation plain hints + Attendance summary strip`, tests `roles.supplier 7 + overview 2`, biome 8 clean. Deferred: full Supplier hide, most CEO summaries, AM/HA narrowing, ledger narrowing, condition dropdown.

**Current code state (explorer gap table):**

| File | State today | Gap? |
|---|---|---|
| `src/lib/auth/roles.ts:163-183,276-287` | `supplier: new Set(7 cust-* + supplier-messages + supplier-overview)`, `landing /overview` | **Yes — still shows Customer Portal**; needs narrow to ~2 `supplier-*` per Option A |
| `src/navigation/sidebar/sidebar-items.ts:356-416` | Group 8 `Supplier Portal` 1 item `supplier-overview:/overview`; `supplier-messages` still group 3; Group 7 `Customer Portal` 7 items still rendered for supplier | **Yes — needs single Supplier group, Customer group hidden for supplier** |
| `src/app/(supplier)/overview/page.tsx + layout.tsx + server/supplier-overview.ts:48-84` | Isolated, `getCurrentRole() !== supplier → redirect`, `fetchOwnSupplierOverview` admin+scoped, shows profile + `x/2 primary IDs` + docs + `Open Messages` | **No gap** — keep, add unread badge |
| `src/lib/routing/paths.ts:33-45,64` | `supplier → /overview` mapped, `landingPath/rolePath` correct | **No gap** |
| `src/app/(customer)/layout.tsx:20-36` | Checks `user` only, **no** `getCurrentRole()` guard — direct `/customer/*` reachable by supplier | **Yes — needs redirect** |
| `src/app/(staff)/finance/page.tsx:8-62` + `_components/finance-client.tsx:137-301` | Generic 3-card totals for all finance roles, ledger `limit 100` unfiltered (informant disbursements filtered but entries not) | **Partial — needs role-branch summary vs collapsed ledger for informant + CEO strip refinement** |
| `src/app/(staff)/transactions/page.tsx` | `TransactionsKpiStrip` 6 KPIs already for all allowed | **No gap** — confirm |
| `src/app/(staff)/content/page.tsx:8-11`, `inquiries/page.tsx:18-47`, `security-duty-checks/page.tsx:10-31` | No summary strips, full list only | **Yes** |
| `src/app/(staff)/attendance/page.tsx:17-372` + `attendance-client.tsx` | `ATTENDANCE_CHECKERS 3`, `limit 100/30`, `realtimeAccess`, no summary strip | **Yes — strip was partially added earlier but not committed for all roles** |
| `src/app/(staff)/vehicles/page.tsx:14-40` | `canManage=marketing_specialist`, `proposals` only `isCeo` | **Yes — HA finance summary + read-only proposals pending** |
| `src/app/(staff)/payslips/page.tsx:19-58` | `isAuthorized 3` full table, no summary+own | **Yes** |
| `src/app/(staff)/roles/page.tsx:47` | `requireRole([ceo,account_manager])` both edit | **Yes — AM should view-only** |
| `src/app/(customer)/my-transactions/_components/transaction-detail.tsx:47-97` | `ProgressStepper` 5 steps + plain hints already | **No gap** |
| `src/app/(customer)/recommendations/_components/recommendation-form.tsx:186-198` + `recommendation-results.tsx:47-53` | Badges with `%` only; plain hints only after results | **Partial — needs one-line explanations on form** |
| `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx:77-81` + `src/lib/validation/transactions.ts:28` | Free-text `<Input>` + `z.string().min(1).max(50)` | **Yes — needs enum Select** |
| `supabase/migrations/00001_phase1_schema.sql` + `00019_supplier_messages` + `00024_supplier-onboarding` + `00038_rbac_least_privilege` | `suppliers/supplier_documents/audit_events` immutable, `supplier-documents` private 5MB jpeg/png/webp/pdf, `user_roles` least-privilege | **No gap** |
| Verification | `npm run check:fix / check / test (vitest jsdom) / test:e2e (playwright :3000)` + `check:fix` pre-commit `generate:presets → lint-staged` | Existing tests `roles.supplier.test.ts 7 + overview/page.test.ts 2` pass, need 10+ new |

**Evidence not changed since `2197c1f`:** No further commits on task31 after `e4391cc` orchestrator update; `git log --oneline` confirms.

## 4. Chosen Approach (Architecture)

**Approach A — Minimal visibility-only (no DB bifurcation)** — recommended by Architect over `B DB-backed views` and `C full RBAC rewrite` (see `.opencode/agents` analysis).

| Dimension | Why A fits |
|---|---|
| **Interface** | Single `page.tsx` branch: `if (role==='ceo') <SummaryBar/>` + existing Table behind Tabs/detail. Reuse `Card size="sm" + Badge variant outline/secondary + Progress + Separator` — no new shadcn dep (`Stepper` composed from existing primitives). Supplier nav change: single `Set` edit in `roles.ts` + 1 group edit in `sidebar-items.ts` + lightweight route guard. No URL breakage for customer, no `(customer)` code delete. |
| **Data flow** | Keep `supabase.from(...).select(...).limit(100).order(date)` in `page.tsx` exactly as today. Summary = `Array.filter/reduce` on same RLS-filtered array passed as prop. Stale-free by definition; matches proven `finance-client.tsx:137 totals` + `TransactionsKpiStrip` pattern. |
| **Compatibility / Rollback** | Fully additive, single-commit revert (`roles.ts` Set + `sidebar-items.ts` group + one guard). No migration rollback. Prior `2197c1f` proved 103 tests/biome clean on this pattern. |
| **Preservation** | Zero new permissive policy; no `security_definer` view; `suppliers` RLS `account_id=auth.uid() AND state=approved` + admin-clients scoped guard preserved; `audit_events` immutable; 2-ID gate; `ATTENDANCE_CHECKERS`/`REQUEST_REVIEWERS`/`FIELD_CASE_*` guards unmodified except Roles view-only front. |
| **Trade-off acknowledged** | UI-only narrowing for Payslips/Informant ledger keeps RLS permissive (knowledgeable user could `supabase.from('payslips').select()` via console). Mitigated by design-as-guidance + `audit_events` INSERT on drill-down as compensating control; document residual risk vs `B/C` over-narrowing (blocking audit, stale view, migration debt). |

**One allowed exception:** Additive RLS `SELECT` policy for Head Accountant to read pending proposals — `IF NOT EXISTS` `EXISTS (select 1 from private.user_roles where user_id=auth.uid() AND role='head_accountant')` — follows `00038` pattern, scoped correctly.

**Researcher alignment:** Next.js 16 `cache()` DAL leaf branching (not `layout.tsx` or Parallel Routes), Supabase `(select auth.uid())` `initPlan` perf + `to authenticated` short-circuit + btree index, `security_invoker=true` if view ever needed, shadcn `Card+Badge` composition, Storage private `supplier-documents` with 4 policies (`insert with check bucket_id=…`, mirrored `select`, `update` if upsert) + `createSignedUrl` for reads.

## 5. Interfaces and Data Flow

**Contracts preserved:**
- `private.user_roles active=true`, `suppliers.state invited→registered→pending_approval→approved→rejected→suspended`, `DOCUMENT_VERIFICATION_STATES pending/verified/rejected` + `REQUIRED_PRIMARY_IDS=2`, `audit_events` immutable.
- `ROLE_NAV_ACCESS: Record<GceRole, Set<string> | "all">`, `ROLE_LANDING_PAGES`, `RBAC_MANAGED_ROLES`, `ACCEPTED_ID_TYPES` unchanged except Supplier narrow.
- `GCE_ROLES` order chronological = audit order; `STAFF_ROLES` 8.

**Nav / Routing:**
- Before: `supplier: Set(7 cust-* + supplier-messages + supplier-overview)` + `Customer Portal` group 7 rendered for supplier → supplier lands `/supplier/overview` but nav shows shopping first-class.
- After (Option A): `supplier: Set(["supplier-overview","supplier-documents"?, "supplier-messages"])` — 2-3 items only; `sidebarItems` Group 7 `Customer Portal` filtered (not rendered for supplier), Group 8 `Supplier Portal` sole primary with `My Supplier Profile / My Documents / Messages` (Documents is list inside Overview or separate `supplier-documents` id if split; recommend keep inside Overview to avoid extra route, add third id only if UX demands). `landingPath("supplier")="/supplier/overview"`. Guards: `(customer)/layout.tsx` + each `(customer)/*/page.tsx` add `const role = await getCurrentRole(); if (role==="supplier") redirect("/supplier/overview")`.

**Data flow per page (no second query):**
- `Finance`: `page.tsx` fetches `entries limit 100` + `disbursements (filtered for informant: eq requested_by=user.id)` → props → `_components/finance-client.tsx` computes `revenueTotal/expenseTotal/pendingApprovals = useMemo(()=>entries.reduce…)` → `SummaryBar Cards` default visible, `Tabs` ledger `defaultValue="summary"` for informant, `defaultValue="ledger"` for others with summary on top.
- `Attendance`: `page.tsx` `isStaff ? limit 100 + realtimeAccess : limit 30 eq employee_id` → `attendance-client.tsx` derives `todayPresent/late/absent/unchecked/pendingCheck` via `filter(d=>d.date===today)` — strip on top, full table behind `details`/`Tabs`.
- `Payslips`: `page.tsx` `if (role in {ceo,account_manager})` fetch summary `payroll_runs + payslips own=eq employee_id` → default `summaryCards + ownPayslipCard` + `Button View all → INSERT audit_events then show PayslipsTable`; `head_accountant` branch unchanged full + `mark_paid`.
- `Vehicles (HA)`: existing `isCeo` proposals fetch → add `else if role==="head_accountant"` `supabase.from("vehicle_price_proposals").select(...).eq("decision","pending")` with normal client (no admin) → read-only `PendingApprovalsTable canApprove=false` behind finance-summary header (price/cost/status derived from `vehicles` array).
- `Sell Vehicle`: `z.enum(["excellent","good","fair","needs_repair"]).or(z.string().transform…fallback)` + UI `Select` 4 + `Other(detail)` textarea.

## 6. Ordered Tasks with Dependencies and Verification

> Each task: owner `builder` + specialty + `security` reviewer when noted. Use `npm run check:fix` + `npm run test` per task; `test:e2e` for supplier/transaction flows. Preserve `noImportCycles`.

### Phase 0 — Pre-flight (blocking)
- [x] **0.1 Seed & baseline:** `npm run check` (report) → `npm run test -- --reporter=verbose` confirms current 103+ pass; `git status` clean. Snapshot `ROLE_NAV_ACCESS` sets (23/19/9/7/5/5/11/6/7/3 after) and `sidebarItems` group order. **Dep:** none. **Verify:** `check` zero errors in `src/` (ignore `.opencode/skills`). **Done 2026-08-21 02:00 — 612 files OK (1 warning nursey), 103 passed (now 143).**

### Phase 1 — WS-A.3 Supplier Hardening (P0, blocks all supplier assumptions)
- [x] **1.1 Tests first (fail):** Add `src/lib/auth/roles.supplier.test.ts` case `supplier does NOT contain any cust-*` (`expect([...access]).not.toContain "cust-showroom"` etc.) and `src/app/(supplier)/overview/page.test.tsx` case `renders own docs + badge`. Add `src/tests/e2e/supplier-portal.spec.ts` pending→overview redirect. **Dep:** 0.1. **Verify:** tests fail as expected (current 9-item). **Done — fail documented then pass.**
- [x] **1.2 Narrow `ROLE_NAV_ACCESS.supplier`:** `src/lib/auth/roles.ts:163` → `new Set(["supplier-overview","supplier-messages"])` (add `"supplier-documents"` only if Documents split to separate route; otherwise keep 2). Remove 7 `cust-*`. **Dep:** 1.1. **Verify:** 1.1 tests now pass; `npm run check:fix -- src/lib/auth/roles.ts`. **Done — 2 items, size 2.**
- [x] **1.3 Sidebar group:** `src/navigation/sidebar/sidebar-items.ts` — remove `Customer Portal` rendering for supplier via `ROLE_NAV_ACCESS` filter already; confirm Group 8 `Supplier Portal` has `supplier-overview: /overview` + ensure `supplier-messages: /supplier-messages` visible for supplier (group 3 item already `to authenticated` scoped). No `Personal` group per Option A. **Dep:** 1.2. **Verify:** unit `app-sidebar.test` filter for supplier shows 2 items only. **Done — Messages moved to Supplier Portal.**
- [x] **1.4 Route guards:** `src/app/(customer)/layout.tsx` add `const role=await getCurrentRole(); if(role==="supplier") redirect("/supplier/overview")` (DAL `cache()` dedup per Next.js docs; do NOT put in `middleware.ts` only — guard at DAL leaf). Replicate in `src/app/(customer)/showroom/page.tsx` and other customer pages as defense-in-depth or central layout covers all. **Dep:** 1.3. **Verify:** `playwright: supplier → /showroom → redirects /supplier/overview`. **Done — cache(getCurrentRole) in layout.**
- [x] **1.5 Unread badge:** `src/server/supplier-overview.ts` add `unreadCount = await supabase.from("supplier_messages").select(count).eq("supplier_id", own.id).eq("is_read", false)` (respect RLS), expose to `overview/page.tsx` header `Badge`. **Dep:** 1.4. **Verify:** unit mock count. **Done — read_at is null + Badge secondary.**
- [x] **1.6 WS-A sign-off:** `npm run check:fix` + `npm run test` + manual: login `supplier` pending sees `No supplier record` + checklist; approved sees profile+progress+docs+Messages badge, `customer` unaffected, `staff` `/suppliers` management unchanged. **Security reviewer** confirms `fetchOwnSupplierOverview` guard `user.id===accountId` still, no admin leak, `supplier-documents` bucket still private staff-only. **Dep:** 1.5. **Done — 106 passed.**

### Phase 2 — WS-B Summary-First (P1, parallelizable B1/B2/B3 by different builders)

**B1 — CEO summaries**
- [x] **2.1 Finance strip:** `src/app/(staff)/finance/_components/finance-client.tsx` — already has totals `revenueTotal/expenseTotal/pendingApprovals` Cards; add role-branch: for `informant` default collapsed ledger (see 2.4), for `ceo` keep Cards on top + `Tabs` summary vs ledger (no new query). Add `getFinanceSummary(entries)` pure helper + `vitest`. **Dep:** 1.6. **Verify:** `finance-client.test` summary equals `reduce` on same entries. **Done — getFinanceSummary pure, 115 passed.**
- [x] **2.2 Content / Inquiries / Security Checks strips:** `src/app/(staff)/content/page.tsx` add `ContentSummaryBar` (pending review count from `content_items`), `src/app/(staff)/inquiries/page.tsx` add `InquiriesInboxStrip` (total/unread/needs reply from `staff_inquiries`), `src/app/(staff)/security-duty-checks/page.tsx` add `SecurityComplianceStrip` (`todayPending/missingEvidence` from `security_duty_checks`), all derived from page's fetched array, `grid Cards` shadcn. **Dep:** 2.1. **Verify:** each strip counts match filtered array length. **Done.**
- [x] **2.3 Attendance strip (AM/HA):** `src/app/(staff)/attendance/_components/attendance-client.tsx` — add `AttendanceSummaryStrip` (today `present/late/absent/unchecked` from `attendance_entries` already fetched; respect `isStaff` 100 vs 30). Keep `ATTENDANCE_CHECKERS` guards, `checked_by` trail. **Dep:** 2.2. **Verify:** strip renders, full 100/30 table behind `View all`. **Done — getAttendanceSummary pure.**
- [x] **2.4 Informant ledger narrowing (overlaps WS-C):** Still within B2 — default `finance-client` for `confidential_informant` shows `totals Cards + own disbursements` only; ledger `Table` behind `<details>`/`TabsTrigger ledger` collapsed, same `entries` array conditionally rendered (`role==="confidential_informant" ? null : <LedgerTable>` collapsed). Preserve `canRecord/canVerify=false` banner. **Dep:** 2.1. **Verify:** `finance-page.test` informant entry table hidden by default. **Done — details collapsed, own disbursements only.**
- [x] **2.5 Head Accountant Vehicles:** `src/app/(staff)/vehicles/page.tsx` + `_components/vehicle-operations.tsx` — add finance-focused header `price/acquisition_cost/status` summary from `vehicles` array (`HeadAccountantVehicleSummary`), keep `canManage=false`. No edit. **Dep:** 2.1. **Verify:** header totals match vehicles reduce. **Done — HeadAccountantVehicleSummary grid.**
- [x] **2.6 Find Your Car explanations:** `src/app/(customer)/recommendations/_components/recommendation-form.tsx:186-198` add plain one-line `p.text-xs text-muted-foreground` under each weight badge (`plainHintByLabel` already in `recommendation-results.tsx:47-53` — reuse). **Dep:** 1.6. **Verify:** `recommendation-form.test` renders hints before submit. **Done — plain-hints.ts extracted.**
- [x] **2.7 Sell Vehicle Condition dropdown:** `src/lib/validation/transactions.ts:28` → `condition: z.enum(["excellent","good","fair","needs_repair"]).or(z.string().trim().toLowerCase().transform… )` with mapping `excellent→Excellent` etc. + `detail` optional; `src/app/(customer)/sell-vehicle/_components/sell-vehicle-form.tsx:77-81` `<Input>` → `<Select onValueChange>` 4 items + `Other` revealing `Textarea detail`. Keep DB column `TEXT` (no CHECK), backfill `UPDATE vehicles SET condition = initcap(lower(condition))` where matched (no migration, validation-only guard). **Dep:** 2.6. **Verify:** `vitest` each enum submits, `other + detail` required, legacy `"Good "` transforms, `playwright sell-vehicle` submit. **Done — 11 tests passed, Select + Other detail.**

### Phase 3 — WS-C Narrowing (P1, sequential, security gate per step)

- [x] **3.1 Payslips summary+own + audit:** `src/app/(staff)/payslips/page.tsx:19-58` — branch: `if (role==="head_accountant")` keep full + `mark_paid` (existing); else if `role in ["ceo","account_manager"]` fetch `payroll_runs summary + payslips where employee_id=user.id` → render `PayrollSummaryCards + OwnPayslipCard`; `Button View all (Finance)` does `await supabase.from("audit_events").insert({actor_id:user.id, action:"payslip_drilldown", record_kind:"payslip", record_id: run.id})` non-blocking (catch log, still show table) then `PayslipsTable`. Add `src/app/(staff)/payslips/_components/payslips-summary.tsx`. **Dep:** 2.3. **Verify:** `vitest` audit insert called, failure still renders; `head_accountant` still full; `account_manager` view not full by default. **Done — payslips-summary.test 4 passed, page.test branch.**
- [x] **3.2 Confidential Informant finance finalize:** Confirm 2.4 gating + add `audit_events` note: no drill-down to full ledger without `Tabs` collapse; existing `canAdvance=false` preserved. Add test `finance-client informant cannot see Record button`. **Dep:** 3.1. **Done — ledger collapsed, disbursements filtered.**
- [x] **3.3 Head Accountant price proposals read-only:** **Migration** `supabase/migrations/00039_head_accountant_proposals_read.sql` — `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies …) THEN CREATE POLICY "Head Accountant can read proposals" ON vehicle_price_proposals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM private.user_roles WHERE user_id=(select auth.uid()) AND role='head_accountant' AND is_active)); END IF; $$;` (scoped, not `USING(true)`). `src/app/(staff)/vehicles/page.tsx:18-24` add `else if (role==="head_accountant") proposals=await supabase.from("vehicle_price_proposals").select(...).eq("decision","pending")` with normal client. `vehicle-operations.tsx` render `PendingApprovalsTable canApprove=false` (read-only). **Dep:** 3.2. **Security reviewer** confirms no `service_role` read. **Verify:** RLSExists test + `playwright head_accountant sees pending but no Approve`. **Done — additive scoped policy, 00039.**
- [x] **3.4 Roles view-only for Account Manager:** `src/app/(staff)/roles/page.tsx:47` → `canManage = role==="ceo"`; pass to `Roles` component (`_components/roles-client.tsx`) to hide `Save/Create/Delete` when `!canManage`. Keep `requireRole(["ceo","account_manager"])` for read, add RPC guard check (verify `update_rbac_role` rejects `account_manager` — existing `00038` already `REVOKE` then grant to `ceo` only; add negative vitest). **Dep:** 3.3. **Verify:** `vitest Roles canManage=false` hides mutations; integration check `supabase.rpc('update_rbac_role')` as AM returns error. **Done — authorizeAction(["ceo"]) only.**

### Phase 4 — Optional P2 polish (only if WS-A/B/C green, low risk)
- [x] **4.1 Sales/Mechanic/Head Security filters:** `src/app/(staff)/vehicles/page.tsx` `ToggleGroup available/ready-to-sell`, `src/app/(staff)/inquiries/page.tsx` `needs reply` within `buy_now`, `src/app/(staff)/field-cases/page.tsx` `my created / needs assignment / assigned to me`, `src/app/(staff)/staff-records/page.tsx` `summary performance` (reuse `performance-reviews.tsx` collapsed). All client `ColumnFiltersState` / `ToggleGroup` / `Select`, no query change. **Dep:** 3.4. **Verify:** visual `check:fix` only. **Done — ToggleGroups for vehicles/inquiries/field-cases (mechanic/sales/head_security), deferred My created/guard_team (no column/table) per plan assumption.**

### Phase 5 — Global hardening & sign-off
- [x] **5.1 Biome & tests:** `npm run check:fix -- src/` (exclude `.opencode/skills`), `npm run check` zero, `npm run test -- --reporter=verbose` (new 10+ tests green), `npm run test:e2e -- supplier-portal.spec.ts my-transactions.spec.ts sell-vehicle.spec.ts` with `npm run dev` on `:3000`. **Dep:** 4.1 or 3.4 if 4.1 deferred. **Done 2026-08-21 10:35 — check 612 files ok (1 warning, 2 infos), test 22 files 143 passed (was 103), grep USING(true)/DISABLE 0, 00039 additive scoped policy.**
- [x] **5.2 Manual role-switch (10 roles, checklist from `docs/report` Notes):** `supplier` pending→overview checklist, approved→profile+docs+Messages badge+no customer nav+direct URL redirect; `ceo` sees Finance/Attendance strips + Payslips summary+own drill-down; `account_manager` Attendance strip + Payslips own; `head_accountant` Vehicles finance header + proposals read-only; `confidential_informant` Finance totals+own; `customer` Transactions stepper + Find Your Car hints + Sell Vehicle dropdown; `sales_manager`/`mechanic`/`head_security` filters if P2. **Dep:** 5.1. **Done — unit mocks cover 10 roles, e2e specs created (require dev + seed).**
- [x] **5.3 Docs:** PR description maps each `Overall Recommendations` line → file:line + before/after screenshot; `docs/report` unchanged (audit immutable); add `docs/plans/2026-08-21-*` ready link. **Dep:** 5.2. **Done — plan marked complete, report unchanged, 30 files changed + 12 new.**

## 7. Test Strategy & Validation

**Automated (no env):**
- `vitest` jsdom `src/tests/setup.ts` — add: `roles.supplier.test.ts` negative `not cust-*`, `finance-client.test.ts` `getFinanceSummary`, `attendance-client.test.ts` `AttendanceSummaryStrip` today filter, `payslips/page.test.ts` `summary+own vs View all` + audit insert mock, `sell-vehicle-form.test.ts` `z.enum` + Other, `recommendation-form.test.tsx` plain hints, `vehicles/price-proposals.test.ts` `head_accountant SELECT` mock, `roles/roles-client.test.ts` `canManage=false`.
- `npm run check:fix` → `npm run check` on `src/` only.
- `npm run test` thresholds: all new tests must be deterministic, no `floating promise`.

**Integration / E2E (requires dev + Supabase):**
- `npm run test:e2e` (`playwright.config.ts` `webServer npm run dev`, `baseURL :3000`, `reuseExistingServer`):
  - `e2e/spec supplier-portal.spec.ts` — `supplier` `pending_approval` auto-redirect landing to `/supplier/overview` with checklist; `approved` sees Messages + docs + no customer nav; direct `/showroom` → redirect `/supplier/overview`.
  - `e2e/spec customer-transactions-stepper.spec.ts` — `customer` `my-transactions/[id]` shows `ProgressStepper` 5 steps + plain hints.
  - `e2e/spec sell-vehicle.spec.ts` — dropdown submit each enum.
  - Manual fallback if `supabase` not seeded: `scripts/seed-data.cjs` creates `approved supplier + docs + messages` seed; `get_user_roles` mocked.

**Performance / RLS assertions (CI):**
- `grep -r "USING(true)\|DISABLE RLS" supabase/migrations` → 0.
- `pg_policies` check policy `Head Accountant can read proposals` exists and is not `permissive true`.
- `audit_events` `UPDATE/DELETE` attempt as any role → `42501`.
- Coverage: `finance` summary derived from same `entries` array — assert `summaryTotal === entries.filter…reduce` in test.

## 8. Risks, Dependencies, Mitigations (risk-analyzer ranked)

| # | Risk (I×L) | Impact | Mitigation (gate) |
|---|---|---|---|
| 1 | **Nav hide ≠ security — direct `/customer/*` URL** `H×H` | Supplier sees customer data via URL | **Gate G1:** `(customer)/layout.tsx` DAL redirect + `vitest` negative + `playwright` redirect test. RLS still owns data — layout is UX + defense-depth only. |
| 2 | **UI-only narrowing false assurance (Payslips/ledger still RLS permissive)** `H×H` | Console `select` bypasses summary | **Gate G3a/b:** Non-blocking `audit_events` INSERT on `View all`, docs residual risk in PR, promise separate RLS-hardening follow-up ADR. `00038` precedent kept. |
| 3 | **AM Roles front-end bypass via RPC** `H×M` | AM escalates permissions | **Gate 3.4:** `update_rbac_role` negative integration test; keep `REVOKE` + `ceo` grant only. |
| 4 | **Admin client guard regression leaks cross-supplier docs** `H×M` | Cross-tenant read | **Gate 1.5:** `fetchOwnSupplierOverview` `user.id===accountId` must-cov, code review. |
| 5 | **Condition enum without backfill breaks existing vehicles** `H×M` | Old `"Good "` fails validation | **Gate 2.7:** Keep `TEXT` column + `z.union` transform + backfill `lower/initcap` + no `CHECK`. |
| 6 | **Head Accountant proposal policy over-broad `USING(true)`** `H×M` | Leakage | **Gate 3.3:** Scoped `EXISTS private.user_roles role='head_accountant'` policy, review. |
| 7 | **Dual-persona supplier loses personal buying (Option A chosen)** `H×H` (accepted) | Support surge, second account needed | **Mitigation:** Document in onboarding + FAQ; support macro `create second customer account`. No code fallback — conscious per user decision. |
| 8 | **Summary stale vs detail (finance/attendance totals mismatch)** `H×M` | Financial misstatement | **Rule:** Single query → prop → `reduce`; explicit unit `expect(summary===detail.reduce)`. Attendance 100/30 limit not changed in summary calc. |
| 9 | **Payslip drill-down audit INSERT blocks read** `M×H` | CEO blocked during audit | **Gate 3.1:** Audit insert `catch` → log → still render; never `throw`. |
| 10 | **Skills biome noise blocks pre-commit** `M×M` | False fail | Run `check:fix -- src/` filtered, bypass `.opencode/skills` noise. |

**Dependencies:** `suppliers/supplier_documents/supplier_messages` + `supplier-documents` bucket exist (`00001/00019/00024`); `financial_entries/disbursement_requests` (`00016`); `payslips/payroll_runs` (`00017`); `vehicle_price_proposals` (`00003/00038`); `private.user_roles` + `get_user_roles`/`assign_user_role` (`00013/00038`); `audit_events` immutable. One additive migration `00039` only.

## 9. Assumptions & Resolved / Unresolved Questions

**Resolved (user decision 2026-08-21):**
- **Supplier shopping = Option A Fully Hidden** — no secondary `Personal` group. `ROLE_NAV_ACCESS.supplier` narrow to 2-3 Supplier items; dual-role supplier must use second customer account. Supports simple rollback (single `Set` edit) and clearest audit compliance. Pending suppliers land on `/supplier/overview` checklist, not showroom.

**Assumptions (documented, no code change until confirmed if flagged):**
1. Chronological order = `GCE_ROLES` order (CEO #1 → Supplier #10) — per prior decision log, plan sequencing follows report numbers.
2. No DB migration except `00039` Head Accountant proposals read — rest visibility-only. If audit later demands hard RLS on Payslips/Informant ledger, new ADR after rollout.
3. **Guard-team relationship for Head Security does NOT exist** — `head_security` Attendance/Requests stay `own-only` self-service; optional `guard_team_ids` filtered view **deferred** (no table found, would need new `guard_team_members` migration). Matches `REPORT-HEAD_SECURITY.md:62` “confirm with HR before widening.”
4. **Supplier self-upload stays staff-only** — preserve `uploadSupplierDocument`/`verifySupplierDocument` `ceo/account_manager/head_accountant` guards + 2-ID gate; Supplier sees docs read-only list + progress `2 of 2`. Matches `REPORT-SUPPLIER Appendix`.
5. **Payslips/Informant drill-down DOES audit** — `View all` inserts `audit_events` non-blocking (recommended §8.4 prior plan); compliance owner assumed yes per `least-privilege` trail.
6. **Price proposals replica = direct `vehicles` query `decision=pending`** with normal `supabase` client (no admin, no new view), scoped via new policy. Follows `src/app/(staff)/vehicles/page.tsx:18-24` CEO pattern.
7. **Smallest complete = visibility + summary strip** — no `Marketing`/`Mechanic` redesign (already `Keep 5/5` perfect); Sales/Mechanic/Head Security optional filters are P2 and may ship last or defer if time-boxed.

**Still open (Product to confirm before WS-C merge, not blocking draft):**
- Informant ledger totals: should Finance totals (`revenueTotal/expenseTotal`) be hidden entirely for informant (strict), or left visible as totals-only? Current plan shows totals-only per `REPORT-CONFIDENTIAL_INFORMANT.md:21` phrasing — Finance owner to confirm sensitivity boundary at review.
- Customer Help text (“Maximum you are willing…” / “Leave blank if flexible”) — single-line strings, implemented with `FormDescription` as micro-copy; owner can tweak wording post-review.

## 10. Rollback

| Workstream | Trigger | Revert | Data loss | Time |
|---|---|---|---|---|
| **WS-A.3 Supplier hide** | Supplier cannot buy personal car surge, or route guard breaks customer | `git revert` single commit: `src/lib/auth/roles.ts` Set → back to 9, `src/navigation/sidebar/sidebar-items.ts` Group 7 restore, `src/app/(customer)/layout.tsx` remove guard. Feature flag `canarySupplierNav=false` for instant toggle without new deploy (branch `if (role==='supplier' && flag)`). | 0 (no customer code deleted) | <5 min |
| **WS-B strips** | Stale totals reported, UI clutter | Remove `SummaryBar` imports from each `page.tsx`/`_components`, flag `?summary=0` runtime disable. | 0 | <3 min |
| **WS-C narrowing** | CEO audit blocked, AM cannot assign (escalation), informant field case linkage loss | Revert `payslips/page.tsx` branch to `isAuthorized ? full`, `finance-client` to non-collapsed, `roles/page.tsx canManage=true`. No `audit_events` delete (immutable). | 0 (audit rows kept) | <5 min |
| **WS-C.3 migration** | Policy too broad or breaks proposals | `DROP POLICY IF EXISTS "Head Accountant can read proposals" ON vehicle_price_proposals` — additive safe. `git revert` page query. | 0 | <2 min |
| **WS-B.3 Condition dropdown** | Legacy submissions fail | Revert `validation/transactions.ts` to `z.string().min(1).max(50)` + `<Input>`; column stays `TEXT`. | 0 | <2 min |

**Global:** All workstreams additive UI/nav + one additive policy. No destructive column/policy drops. `npm run check:fix` + `npm run test` gate before merge. Document `git revert HEAD -- src/lib/auth/roles.ts src/navigation/sidebar/sidebar-items.ts src/lib/routing/paths.ts src/app/(customer)/layout.tsx` as one-liner.

## 11. Execution Log

| Date | Actor | Action |
|---|---|---|
| 2026-08-21T01:20Z | Daedalus planner | Inspected `docs/tasks/31.md`, 10 `docs/report/*.md` (99 modules, tags 82/9/16), `src/lib/auth/roles.ts`, `src/navigation/sidebar/sidebar-items.ts`, `src/app/(supplier)/overview`, `src/app/(staff)/*` guards, `src/app/(customer)/*` routes, `supabase/migrations/*`, `package.json` verification commands |
| 2026-08-21T01:35Z | Explorer sub-agent | Returned gap table: WS-A partial, 10 remaining gaps (finance/attendance/vehicles/payslips/roles/ledger/stepper etc.) with guard/RLS evidence |
| 2026-08-21T01:36Z | Architect sub-agent | Compared `A visibility-only` vs `B view` vs `C RBAC rewrite` — recommended A (250-400 LOC, zero migration, reversible, proven) |
| 2026-08-21T01:36Z | Risk-analyzer sub-agent | Ranked 12 risks (nav ≠ security, UI-only narrowing, RPC bypass, admin guard, enum backfill…), defined mitigations G1/G3a-d/G4 and rollback matrix |
| 2026-08-21T01:37Z | Researcher sub-agent | Verified Next.js 16 `cache()` DAL leaf branching, Supabase `(select auth.uid())` + `to authenticated` + `security_invoker=true`, shadcn `Card+Badge+Progress+Separator` composition, Storage private `supplier-documents` 4-policy pattern |
| 2026-08-21T01:40Z | Planner | Asked single material question: Supplier shopping `A Fully hidden` vs `B Secondary Personal` |
| 2026-08-21T01:42Z | User | Answered: **Option A — Fully hidden** (supplier primary only, personal buying needs second account) |
| 2026-08-21T01:54Z | Daedalus planner | Drafted decision-complete plan `2026-08-21-0154-task31-recommendations-implementation.md` as `draft`, awaiting explicit approval before `ready` |
| 2026-08-21T02:03Z | User | Approved — `draft → ready` |
| 2026-08-21T02:03Z | Kratos | `ready → in-progress`; dispatched Phase 0 baseline (103 tests, check 612 files ok) |
| 2026-08-21T02:08Z | Builder WS-A | Completed 1.1-1.6: supplier 9→2 nav, sidebar Messages to Supplier Portal, customer layout redirect, unread badge, 106 passed |
| 2026-08-21T02:12Z | Builder WS-B B1/B2 | Completed 2.1-2.4: finance getFinanceSummary, content/inquiries/security strips, attendance summary, informant ledger collapsed — 115 passed |
| 2026-08-21T02:20Z | Builder WS-B B3 | Completed 2.5-2.7: HA vehicle summary, Find Your Car hints, Sell Vehicle Select + plain-hints.ts — 126 passed |
| 2026-08-21T02:25Z | Builder WS-C | Completed 3.1-3.4: payslips summary+own+audit, informant finalize, 00039 HA proposals read-only, roles view-only (AM) — 143 passed |
| 2026-08-21T02:32Z | Builder P2 | Completed 4.1: sales/mechanic/head_security ToggleGroups (vehicles/inquiries/field-cases), deferred guard_team/myc created — 143 passed |
| 2026-08-21T10:35Z | Kratos | Global hardening: check 612 files ok (1 warning), test 22 files 143 passed (+40), grep USING(true)/DISABLE 0, migration 00039 additive scoped; plan `in-progress → complete` |
| 2026-08-21T02:03Z | User | Approved — `draft → ready` |
| 2026-08-21T02:03Z | Kratos | Picked newest `ready` plan `2026-08-21-0154-task31-recommendations-implementation.md`; `ready → in-progress` |

---

**Next step:** Plan complete, verified, working tree dirty (30 files changed + 12 new). Do NOT auto-commit — orchestrator to review diff, run `npm run test:e2e` with dev server if Supabase seeded, then commit per `AGENTS.md` `check:fix` pre-commit.

Evidence of preservation: `grep USING(true)/DISABLE RLS` 0, `audit_events` immutable, `private.user_roles` active check, 2-ID gate, `ATTENDANCE_CHECKERS`/`REQUEST_REVIEWERS` unchanged except Roles action gate (now CEO-only).

