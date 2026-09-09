# Documentation Alignment Audit — Final Report

**System:** Global Car Exchange (GCE)
**Audit date:** 10 August 2026
**Scope:** Whether the documented process and overall system flow align with actual operations across all user levels and portals.
**Deliverable type:** documentation-only revisions. No application code, schema, migration, or configuration was changed by this audit (the modified `src/**` files in the working tree are the pre-existing task31/RBAC pass that was itself the audit subject — untouched, uncommitted).

---

## 1. Findings recap (severity-ordered)

### High

| # | Finding | Evidence | Fixed in |
|---|---|---|---|
| **H1** | Supplier-portal docs described a 7-module customer-style portal; system ships a 2-item isolated portal (`/supplier/overview` + messages, redirect traps on legacy URLs) | `roles.ts:173,268`, `roles.supplier.test.ts`, `supplier-portal.spec.ts`; stale claims in 5+ docs | Docs 13, 15, 18, REPORT-SUPPLIER, doc-12 access plan note, GCE USERS LEVELS scope note |
| **H2** | "All staff pages repeat their parent guard" is false — `/staff-recommendations` has **zero page guard**, and `inquiries/reports`, `roadmap/new`, `roadmap/[id]`, `transactions/[id]`, `vehicles/[id]`, `vehicles/new` don't repeat it; bare customer URLs have no customer-role guard at all | Page-level greps across `(staff)`/`(customer)` | Doc 18 §4 exception list (exact seven paths), doc 13 footnotes, doc 15 RBAC row |
| **H3** | Action layer permits what RLS denies: HA payroll review/finalise + payslip mark-paid blocked by `payroll_runs`/`payslips` FOR ALL (ceo/am only, `00017`); CI case creation & CI/Mechanic updates blocked by `field_cases` policies; conversely HA's read-only pending-proposals visibility (`00039`) was documented nowhere | Migration reads + server-action allowlists | Docs 15, 18 (§3.15–3.17 limitation notes), REPORT-HEAD_ACCOUNTANT, doc 12 "Known RLS/action mismatches" |
| **H4** | Doc 12 marked 13 built Phase-6 tables as ⭕ and omitted 9 live tables (incl. the entire task30 five-table permissions catalog ~120 seeded permissions); its own counts were internally wrong (claimed 36✅/53 total; rows held 37✅/52) | Full migration reconciliation | `12 - DATABASE SCHEMA.md` rewritten header, beyond-plan table, task30 section, migration-numbering note |
| **H5** | README/CLAUDE/AGENTS/CONTRIBUTING still described the upstream template (wrong commands, false "no tests" claim, missing route groups/backend story) | Repo inspection vs. docs | All four root docs retargeted to GCE (vitest/playwright truth, four route groups + nested `(legacy)`, middleware rewrite chain, Supabase/43-migrations story) |
| **H6** | Audit 17's prescribed tracker corrections were never applied to tracker 08 (stale summary counts; stale R-07/R-28/R-29 sentence; R-13/R-14 still ✅ despite "Regressed" verdicts) | `17 - ROADMAP AUDIT.md` §3.1–3.2 | Tracker 08 restated: 34✅ + 2🔻(R-13/R-14 with regression pointers) + 5❓ = 41; stale paragraph corrected |
| **H7** | Completed security duty checks are not immutable — `uploadDutyEvidence` re-uploads after completion, overwriting evidence paths and reverting status to `in_progress` | `security-duty-checks/actions.ts` | Docs 15, 18 §3.18 storage/immutability notes |

### Medium

- **M1** Customer/supplier sections in doc 13 rewired to sidebar-shell reality.
- **M2** Entry points fixed (HA/HS land `/dashboard`, supplier lands `/supplier/overview`) in doc 18 find-your-role table + reports.
- **M3** Storage reconciled: **5 real buckets vs 8 documented** (`business-evidence` never existed → split into `security-evidence`/`report-evidence`; `vehicle-work`/`chat-attachments` never created; ⚠️ `customer-documents` used by code but never provisioned — flagged as deployment risk in doc 12).
- **M4** Realtime publication corrected (actual trio: inquiry chat, supplier messages, attendance suite).
- **M5** Seed-script description fixed (`scripts/seed-roles.sql` direct UPDATE bypassing the RPC).
- **M6** "**Customer or Supplier**" workflow header → Customer-only, supplier workflow added.
- **M7** AM field-cases rows marked view-only with RLS note.
- **M8** HA phantom "Verify or Reject document" row deleted (excluded from `verifyTransactionDocument`).
- **M9** HS attendance clarified personal-clock-only.
- **M10** Price-approval auto-publish behavior documented (`approvePrice` sets `listing_state='available'`; no separate publish step).
- **M11** Payroll-inputs clarification (checked attendance only; leave/overtime recorded but unpriced) in docs 05/06.
- **M12** "Phase 6 remains unstarted" replaced across analysis set with implemented-status + outstanding-gates statement.
- **M13** Word-list gaps closed ("Buy Now", "Find Your Car", "Showroom").

### Low

- **L1** tasks/10's 14 dead links repointed.
- **L2** tasks/10 L7 status inversion fixed (completed work was listed as remaining).
- **L3** tasks/05 empty stub annotated.
- **L4** Plan file's dangling REQUIRED-SUB-SKILL neutralized.
- **L5** Analyzer templates given per-run-target scoping notes (legend promise now scoped to ANALYSIS set; audit set declares local keys).
- **L6** Doc 18 route-inventory phantom `[id]` cells removed ×3 + supplier row rebuilt.
- **L7** Metadata/last-checked dates harmonized.

---

## 2. Delegation summary

### Exploration (5 parallel subagents, all completed)

| ID | Task | Outcome |
|---|---|---|
| `4629fc51` | Staff routes / RBAC / guards | ✅ ~14 findings incl. H2/H3/H7 |
| `6d7e51c4` | Customer + supplier portals | ✅ H1 corroborations, portal model |
| `208262f7` | Database / migrations / RLS / buckets / realtime | ✅ H3/H4/M3/M4 evidence |
| `f59df065` | Docs-corpus cross-consistency | ✅ H4/H5/L1–L7 inventory |
| `8a4f443a` | E2E flow walkthroughs per role | ✅ journey-level gaps (two mid-run failures revived via bounded finishing passes) |

### Implementation

All six write-capable subagents were launched twice (12 launches, disjoint file partitions) and **all failed systemically** — each closed with an empty message and zero writes (confirmed via `git status --porcelain` returning nothing after both waves). Read-only explorers were unaffected.

**Deviation disclosure:** every implementation partition was executed directly rather than re-delegating a third time. Partitions: Impl-1 root docs · Impl-2 audit docs 13/15/18 · Impl-3 doc 12 · Impl-4 analysis set (7 files) · Impl-5 six REPORT-* files · Impl-6 tasks/plans/GCE-USERS/templates. One mid-run mis-edit on doc 18 (an anchor consumed two section headers) was caught and repaired within the same pass; the repaired region was re-read and verified.

---

## 3. Verification checklist — every user level & portal

Automated gates:

- `git status` scope audit clean (33 intended doc files only).
- Relative-link scan of all `docs/**/*.md`: **549 resolved, 0 broken in the GCE corpus** (the only unresolved links are inside the generic SYSTEM ANALYZER template cluster: the `link.md` placeholder and the deliberately-absent 03/04 "Not made this time" references).
- Contradiction greps: no current-tense `/supplier/showroom` access claim remains (all 5 hits are annotated redirect-trap/legacy notes), no "visible only to the CEO"-class wording, vitest present in CLAUDE/AGENTS, doc-18 exception list present, tracker counts recomputed (34+2+5=41), doc 12 counts recomputed against actual rows (51✅+9 beyond-plan = 60 live tables).

| Level / portal | Coverage check |
|---|---|
| **Customer** | Portal = 7-link dashboard sidebar shell (no header nav exists anywhere); bare-URL no-guard caveat documented; workflows (inquire/buy-now/documents/cancel) match actions; DML-fix posture noted in doc 12 corrections block ✔ |
| **Supplier** | Dedicated 2-item portal, `/supplier/overview` landing, approval gating, redirect traps, historical note for the old 7-area grant — consistent across docs 12/13/15/18, REPORT-SUPPLIER, GCE USERS LEVELS ✔ |
| **CEO** | Price approval auto-publish, inquiry-update narrowing (`00038`), roadmap CEO-only writes, duty-check review + immutability caveat, roles/users management incl. task30 catalog ✔ |
| **Account Manager** | Preparer-only payslips/payroll comp, view-only field-cases with RLS note, attendance management ✔ |
| **Head Accountant** | Landing `/dashboard`; verify/reject-document row removed; pending-proposals read-only via `00039`; payroll/payslip RLS limitations stated where the steps are prescribed ✔ |
| **Confidential Informant** | Field-case create/update action-vs-RLS gap documented in docs 12/15/18 + REPORT-CI ✔ |
| **Marketing Specialist** | Listing/content/media ownership; staff-showroom detail-route correction; proposal duplicate rejection ✔ |
| **Mechanic** | Inspection/checklist ownership; field-case update RLS gap in REPORT-MECHANIC ✔ |
| **Sales Manager** | Walk-in creation, transaction verification, field-cases write rights, showroom row fix in REPORT-SALES_MANAGER ✔ |
| **Head Security** | Personal-clock-only attendance; duty-check storage folder-scoping + non-immutability caveat in REPORT-HEAD_SECURITY + docs 15/18 ✔ |
| **Auth surface** | Exactly 4 screens documented; seed flow corrected (seed-roles.sql direct UPDATE); env vars + quoted `SEED_USER_PASSWORD` in README ✔ |
| **Public/template surface** | New "Public web surface" section in doc 15: login-first app, unreachable `(external)/page.tsx` dead code, middleware-skipped `template/**` previews flagged as non-product ✔ |

---

## 4. Open items (documented risks awaiting engineering decisions)

Deliberately recorded as risks, not papered over:

1. The `customer-documents` bucket provisioning gap (bucket used by code, never created/policy-less).
2. The payroll/payslip RLS policy additions needed before Head Accountant steps work end-to-end.
3. Field-cases worker INSERT/UPDATE policies for Confidential Informant / Mechanic.
4. R-13/R-14 restoration (management decision views and recommendation-accuracy reporting).
5. RLS verification against a live database reset and stakeholder sign-offs on the remaining Phase 6 decision gates.

The corpus is now internally consistent with the audited working tree.
