# User Roles Audit — GCE System vs. Capstone Documentation

> **Audit type:** Requirement-to-implementation alignment review (review-only; no code was changed)
> **Primary source of truth:** `docs/DOCUMENTS/` (`GCE USERS LEVELS MODULES.md`, `GCE FULL CHAPTER 1 - 3.docx`, `GCE ADDITIONAL DOCUMENTS.docx`, `REVISIONS LISTS.md`)
> **Supporting context:** `docs/ANALYZER/ANALYSIS - GLOBAL CAR EXCHANGE/`
> **Implementation reviewed:** `src/`, `supabase/migrations/`, `src/lib/auth/roles.ts`
> **Date:** 9 August 2026
> **Remediation status:** All section-7.1 recommendations were implemented on 9 August 2026 (migrations 00024–00028; see docs/tasks/13.md). A follow-up RBAC/least-privilege pass on 10 August 2026 (migration `00038_rbac_least_privilege.sql`, `ROLE_NAV_ACCESS` refinements in `src/lib/auth/roles.ts`, page guards, action-guard narrowing; see docs/tasks/26.md) scoped operational writes to the responsible roles while keeping CEO visibility and approval authority. Per-item status is tracked live in [15 - SYSTEM STATUS](15%20-%20SYSTEM%20STATUS.md). Remaining deviations are documented, deliberate substitutions (Informant cash-handoff ledger, supplier portal, general autofill).

---

## 1. Executive Summary

The GCE system defines **10 user roles**, and the capstone documentation describes the same 10 roles. Every documented role has a corresponding implemented role with role-based navigation (`ROLE_NAV_ACCESS`), page guards, server-action guards, and Supabase RLS policies.

| Count | Meaning |
|---|---|
| 10 / 10 | Documented roles present in implementation |
| 8 | Internal staff roles (CEO, Account Manager, Head Accountant, Confidential Informant, Marketing Specialist, Mechanic, Sales Manager, Head Security) |
| 2 | External roles (Customer, Supplier) |
| 1 | Extra group in docs only: **Procurement Team** (revision list; no role value assigned) |

**Overall alignment: ~90%.** All roles exist and their core modules are built, and the 9–10 August 2026 remediation passes closed most documented gaps; a few behaviours remain deliberately substituted or partially enforced:

1. **Supplier onboarding (R-27) is implemented** — two-primary-ID upload + verification, approval-gated sign-in, server-side Company/Individual validation, and auth-account linkage landed 9 August 2026 (migrations 00024–00028). The creators are CEO/Account Manager per the Q-19 resolution (CEO/AM as the procurement capability); the self-registration portal + invitation evidence remain a documented backlog item.
2. **Inquiry routing is visibility-based, not automatic** — "Inquiry → Account Manager" and "Buy Now → Sales Manager" are enforced by queue filtering + RLS + a manual "Assign to Me" button rather than auto-assignment at creation.
3. **Head Accountant's documented duties are implemented** — installment due-date notification to Account Manager (`checkAndNotifyDueInstallments`), repossession instruction to Confidential Informant (`instructRepossession`; head_accountant field-case access via migration 00038), release-of-funds for car purchases (`requestPurchaseFunds` → `advanceDisbursement`), and payroll salary payment (`markPayslipPaid`).
4. **Confidential Informant's documented fund path differs** — the payment-request-to-CEO workflow is replaced by a generalized disbursement ledger; the Informant can *create* requests and open the finance page (read-only, since 10 Aug 2026) but there is no CEO fund-release handoff.
5. **Some documented roles lack an owner in the sidebar hierarchy** — Head Security is not listed as an administrator, yet the docs describe it using attendance and proof-of-duty. Implementation treats it as a staff role, which is consistent.

The detailed findings, per-role profiles, gap matrix, communication flows, and recommendations follow.

---

## 2. Methodology

1. **Documentation collection** — extracted every role, module heading, access rule, approval handoff, and communication pattern from `docs/DOCUMENTS/` (the four source documents above), cross-checked against the analyzer notes for the revision list and open questions.
2. **Implementation inventory** — enumerated the role system (`src/lib/auth/roles.ts`), the middleware routing (`src/middleware.ts`, `src/lib/supabase/middleware.ts`), the auth/role actions (`src/app/auth/actions.ts`), the nav filtering (`src/app/(staff)/_components/sidebar/app-sidebar.tsx`), and the transaction state machine (`src/lib/transactions/state-machine.ts`).
3. **Per-module review** — inspected every `(staff)` page's server actions and role gates, plus the customer/supplier modules, the finance, payroll, reports, field-cases, security, announcements, supplier, and recommendations modules.
4. **Comparison matrix** — mapped each documented responsibility to its implemented counterpart, marking **Implemented**, **Partial**, **Missing**, or **Differs**.
5. **Gap analysis & recommendations** — grouped findings by priority and impact, with references to source files and to the open questions (`docs/ANALYZER/…/00 - START HERE.md`).

---

## 3. User Role Matrix — Documented vs. Implemented

### 3.1 Inventory of all roles

| # | Role (label) | Role key | Tier (docs) | Implemented | Implementation source |
|---|---|---|---|---|---|
| 1 | CEO | `ceo` | Admin | ✅ `roles.ts:4` |
| 2 | Account Manager | `account_manager` | Admin (also acts as HR) | ✅ `roles.ts:5` |
| 3 | Head Accountant | `head_accountant` | Admin | ✅ `roles.ts:6` |
| 4 | Sales Manager | `sales_manager` | Admin | ✅ `roles.ts:10` |
| 5 | Confidential Informant | `confidential_informant` | Employee (×4) | ✅ `roles.ts:7` |
| 6 | Mechanic | `mechanic` | Employee (×4) | ✅ `roles.ts:9` |
| 7 | Marketing Specialist | `marketing_specialist` | Employee | ✅ `roles.ts:8` |
| 8 | Head Security | `head_security` | Employee | ✅ `roles.ts:11` |
| 9 | Customer | `customer` | Public | ✅ `roles.ts:2` |
| 10 | Supplier | `supplier` | Public (B2B/B2C) | ✅ `roles.ts:3` |
| 11 | Procurement Team | *(none)* | Staff (undocumented role) | ❌ Not implemented — creators are CEO/Account Manager | `src/app/auth/actions.ts:224`; open question Q-19 |

> **Note on role counts:** the documents specify 4 Confidential Informants and 4 Mechanics. The implementation assigns roles per user account (`assign_user_role`); it does not enforce quantity limits, which is fine — the count is a staffing fact, not an access rule.

### 3.2 Documented access vs. implemented nav access

| Capstone module | Documented owner | Implemented? | Nav item / action gate |
|---|---|---|---|
| Executive dashboard overview | CEO | ✅ | `dashboard` page; CEO-only `Phase6Overview` (operations overview) |
| Approval/rejection of reports | CEO | ✅ | `reports/actions.ts` (CEO+Head Acct review); price approval CEO-only |
| Announcements | CEO | ✅ | CEO-only create/publish/expire/archive |
| Dashboard overview | Account Manager | ✅ | leave/overtime visible in `dashboard` |
| Inquiries + viewing schedule | Account Manager | ✅ (partial routing) | `inquiries` nav; schedule + handoff implemented |
| Employee records + customer accounts | Account Manager | ✅ | `staff-records` (CEO+AM), `users` |
| Attendance/leave/overtime/payroll | Account Manager | ✅ | `attendance`, `employee-requests`, `payroll` |
| RBAC management | Account Manager | ✅ | `roles` (CEO+AM via `assignRole`) |
| Disbursement for car purchases | Head Accountant | ❌ (no release-funds action) | `finance` — no car-purchase release; disbursements advanced by CEO+Head Acct |
| Payroll / payslip payment | Head Accountant | ✅ | `markPayslipPaid` head_accountant-only |
| Car inventory monitoring | Head Accountant | ✅ | `vehicles` nav |
| Car sales monitoring | Head Accountant | ✅ | `transactions` nav |
| Installment accounts | Head Accountant | ⚠️ Partial | installment generation + waive exist; no due-date → Account Manager notify; no repossession instruction |
| Attendance monitoring | Head Accountant | ✅ | `attendance` (checker role) |
| Car acquisition | Confidential Informant | ✅ (field cases) | `field-cases` worker |
| Mechanic assignment | Confidential Informant | ❌ | No mechanic-assignment action |
| Repossession | Confidential Informant | ⚠️ Partial | `recovery` case kind exists; no Head-Accountant instruction flow |
| Delivery | Confidential Informant | ✅ | `field-cases` (delivery kind) |
| Mechanic reports | Confidential Informant | ✅ | `vehicles`, `inspections` nav |
| Payment approval process | Confidential Informant | ⚠️ Differs | generalized disbursement requests; no CEO→funds handoff; finance page readable (own requests) since 10 Aug 2026 |
| Case expenses | Confidential Informant | ✅ | `field-cases` expenses editable |
| Vehicle posting | Marketing Specialist | ✅ | `vehicles` (INSERT/UPDATE marketing-only; DELETE ceo-only, migration 00038) |
| Price approval | Marketing Specialist | ✅ | `proposePrice` → CEO `approvePrice` |
| Vehicle inspection | Mechanic | ✅ | `inspections`, nested checklist |
| Repair progress tracking | Mechanic | ✅ | checklist results + part replacements |
| Buy Now / Inquiry handling | Sales Manager / Account Manager | ✅ (visibility-based) | `inquiries` queue filter |
| Purchase via website + GCE visit | Sales Manager | ✅ | transactions, viewing arrangements |
| Walk-in buyer/seller accounts | Sales Manager | ✅ | `createWalkInAccount` (ceo/am/sales_mgr) |
| Record of sales | Sales Manager | ✅ | `transactions`, auto `sold` on completion |
| Paperwork | Sales Manager | ✅ | `recordPaperwork` |
| Attendance + leave/overtime | Head Security | ✅ | `attendance`, `employee-requests` (all staff) |
| Proof of duty (before/after photos) | Head Security | ✅ | `security-duty-checks` head_security-only |

---

## 4. Detailed Role Profiles

### 4.1 CEO

- **Purpose / business value:** Top-level oversight of the entire GCE operation; the executive decision-maker and approver.
- **Real-world scenario:** The owner/chief executive watches daily operations on one screen, approves price proposals before a car is posted, signs off on reports, and broadcasts company announcements to employees.
- **Access level:** Full — every nav item (`ROLE_NAV_ACCESS.ceo` lists all 23 items, `src/lib/auth/roles.ts:103-127`). Sole owner of announcement creation, price approval, vehicle deletion, and supplier-message channel. Since migration 00038 (10 Aug 2026) operational writes are RLS-scoped to the responsible roles — the CEO keeps SELECT-all visibility plus approval/review authority rather than blanket CRUD.
- **Responsibilities (docs):** Executive dashboard overview; approval/rejection of payslip & disbursement reports (Account Manager), expense & revenue reports (Head Accountant), vehicle price proposals (Marketing Specialist), inventory reports (Sales Manager); company announcements; approves cars for inventory.
- **Implemented:** ✅ Executive dashboard with live operations overview (`dashboard/page.tsx` CEO-only `Phase6Overview`). ✅ Price approval CEO-only (`vehicles/actions.ts:178-232`). ✅ Announcements CEO-only (`announcements/actions.ts`). ✅ Report review (CEO + Head Acct). ⚠️ "Approves cars for inventory" is approximated by `publishVehicle` requiring an approved price proposal; there is no separate explicit "approve car for inventory" decision distinct from pricing. ✅ Supplier messages (CEO-only side, read-only UI).
- **Communication patterns:**
  - ↓ Marketing Specialist: approves/rejects price proposals (`vehicles/actions.ts:184`).
  - ↓ Head Accountant / Account Manager: report review (2-step payroll: Head Acct seq 1 → CEO seq 2).
  - ↓ All staff: announcements.
  - ↔ Supplier: `supplier-messages` (read-only currently).
  - → Sales Manager: `assignInformant` for sourcing field cases (CEO + SM).
- **Documented vs. implemented:** Strongly aligned. The only nuance is that "approve cars for inventory" is folded into price approval + publishing.

### 4.2 Account Manager

- **Purpose / business value:** The operational hub — HR, client-relations, payroll preparation, and RBAC administrator.
- **Real-world scenario:** The office manager who fields client inquiries about cars, arranges viewings, keeps employee/customer records, processes attendance and leave, prepares payroll, and decides who in the company may see what.
- **Access level:** Broad staff access — `ROLE_NAV_ACCESS.account_manager` (19 items, `roles.ts:128-148`): Dashboard, Finance, Roles, Users, Vehicles, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Suppliers, Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Reports, Announcements. Not granted: Showroom, Content, Security Duty Checks, Supplier Messages.
- **Responsibilities (docs):** Dashboard overview (leave, overtime, reconditioning); inquiries + viewing schedule with handoff to Sales Manager; employee & customer account records; attendance/leave/overtime/late-arrival processing; payroll preparation (salary + statutory deductions) submitted to Head Accountant; RBAC management.
- **Implemented:**
  - ✅ Inquiries: queue + schedule (`scheduleArrangement`) + handoff (`handoffInquiry`).
  - ✅ Attendance/requests: checker role (`attendance/actions.ts:11`), request reviewer (`employee-requests/actions.ts:11`).
  - ✅ Payroll preparation: `PAYROLL_PREPARERS = [ceo, account_manager]`.
  - ✅ RBAC: `assignRole` (CEO+AM), `roles` page.
  - ⚠️ Employee/customer account records: `staff-records` exists (CEO+AM) with walk-in form; `users/` page is **static mock data**, not DB-backed (`users/_components/data.tsx`).
  - ⚠️ Statutory deductions (SSS, Pag-IBIG, TIN, PhilHealth): recorded as free-form `payslip_items`; **no automatic deduction computation, no dedicated TIN field** (`payslips/[id]/…/payslip-detail-client.tsx:241` placeholder text).
  - ❌ Vehicle reconditioning (in dashboard scope) — no reconditioning module found.
- **Communication patterns:**
  - ↔ Customer: inquiries, viewing schedule, auto-filled arrangement forms.
  - → Sales Manager: handoff on GCE visit (`handoffInquiry`, single click).
  - → Head Accountant: payroll report (preparation handoff).
  - → CEO: report submissions for approval.
  - → All employees: RBAC role assignment.
- **Documented vs. implemented:** Strongly aligned for the core (inquiries, payroll, RBAC). Gaps: mock `users/` page, no reconditioning module, statutory deductions not automated.

### 4.3 Head Accountant

- **Purpose / business value:** Financial oversight, payroll/payslip payment authority, and cross-checking of inventory, sales, attendance, and installment accounts.
- **Real-world scenario:** The finance lead who checks the books against the lot and sales, signs off payroll, pays employees, monitors installment payers, and watches for non-payment so recovery can be triggered.
- **Access level:** `ROLE_NAV_ACCESS.head_accountant` (9 items, `roles.ts:149-159`): Dashboard, Finance, Vehicles, Transactions, Attendance, Payroll, Payslips, Reports, Announcements.
- **Responsibilities (docs):** Disbursement for car purchases (upon CEO request); payroll/payslip payment responsibility; car inventory monitoring (view); car sales monitoring (view); installment accounts (notify AM at due date → repossession path → instruct Confidential Informant to retrieve); attendance monitoring (view).
- **Implemented:**
  - ✅ Payroll payment responsibility: `markPayslipPaid` head_accountant-only (`payroll/actions.ts:58`); payroll review seq 1; `finalizePayrollRun` head_accountant-only.
  - ✅ Inventory & sales monitoring: `vehicles`, `transactions` nav.
  - ✅ Attendance monitoring: checker role.
  - ✅ Installment accounts (partial): payment terms approve (`approvePaymentTerms`), installment waive (`markInstallmentWaived`), payment verify (`verifyPayment`). The *schedule generation* is triggered by CEO/Account Manager (`activatePaymentTerms`), not Head Acct.
  - ❌ Car-purchase disbursement release: **no release-of-funds action**; disbursements are advanced through a generic ledger by CEO+Head Acct, but there is no documented CEO-request → Head-Acct-release handoff for purchases.
  - ❌ Installment due-date notification to Account Manager: **not implemented** (no notification flow found).
  - ✅ Repossession instruction to Confidential Informant: `instructRepossession` creates a `recovery` field case; migration 00038 grants head_accountant field-cases SELECT + INSERT (10 Aug 2026).
- **Communication patterns (documented vs. actual):**
  - Documented: notifies Account Manager at due date; instructs Confidential Informant to retrieve vehicles; releases car-purchase funds on CEO request.
  - Actual: approves payment terms, verifies payments, waives installments, pays payslips, reviews reports.
- **Documented vs. implemented:** Well aligned. Payment/payslip authority and the full financial duty chain (due-date notification, repossession instruction, purchase-funds release) are implemented; the only nuance is that installment schedule *generation* is triggered by CEO/Account Manager, not Head Acct.

### 4.4 Sales Manager

- **Purpose / business value:** Owner of the sales pipeline — Buy Now handling, walk-in accounts, transactions, paperwork, and record of sales.
- **Real-world scenario:** The sales lead who closes deals: takes over when an inquiring client walks in, creates accounts for walk-in buyers/sellers, records each sale with buyer and payment details, and manages paperwork.
- **Access level:** `ROLE_NAV_ACCESS.sales_manager` (11 items, `roles.ts:170-182`): Dashboard, Vehicles, Showroom, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Field Cases, Staff Records, Announcements.
- **Responsibilities (docs):** Buy Now handling (vs. Inquiry → Account Manager); auto-filled purchase forms + 2 valid IDs + proof of billing; walk-in buyer/seller account creation; record of sales; paperwork.
- **Implemented:**
  - ✅ Buy Now routing (visibility): staff `inquiries` page filters to `buy_now` for sales_manager (`inquiries/page.tsx:15-17`); RLS `Sales Manager can read buy_now inquiries`; "Assign to Me" derives `sales_manager` for `buy_now`.
  - ✅ Transactions: `createWalkInTransaction`, `transitionTransaction` (SM is in SCA/SC/SCH transition roles), `recordPaperwork`, auto `sold` on completion (`transactions/actions.ts:73-75`).
  - ✅ Walk-in accounts: `createWalkInAccount` includes sales_manager.
  - ⚠️ 2 valid IDs + proof of billing: purchase details schema (`buyDetailsSchema`) — need to confirm whether ID capture exists; no explicit two-ID verification step was found in the walk-in/transaction flow.
  - ⚠️ Record of sales: `transactions` list + KPIs serve this; no dedicated "sales ledger" report.
- **Communication patterns:**
  - ← Account Manager: viewing-schedule handoff.
  - ↔ Customer: Buy Now chat, sale completion.
  - → CEO: `assignInformant` for sourcing (CEO+SM).
  - → Mechanic: inspections on incoming vehicles (indirect via vehicle flow).
- **Documented vs. implemented:** Well aligned. Minor gaps: explicit two-ID/proof-of-billing verification step and a dedicated sales-record report.

### 4.5 Confidential Informant

- **Purpose / business value:** The field agent — physically acquires, delivers, and recovers vehicles, and records related expenses.
- **Real-world scenario:** The person dispatched to pick up a purchased car, deliver a sold car, or repossess one from a non-paying buyer; logs travel expenses per assignment.
- **Access level:** `ROLE_NAV_ACCESS.confidential_informant` (7 items, `roles.ts:160-168`): Dashboard, Finance, Vehicles, Inspections, Transactions, Field Cases, Announcements.
- **Responsibilities (docs):** Car acquisition; mechanic assignment; repossession; delivery; mechanic reports viewing; payment approval process (request → CEO approval → funds); case expenses.
- **Implemented:**
  - ✅ Field cases: worker role (`FIELD_CASE_WORKERS = [ceo, confidential_informant, mechanic, sales_manager]`); kinds include `acquisition`, `delivery`, `recovery`, `sourcing`; expenses editable (`expenses_cents`).
  - ⚠️ Repossession: `recovery` case kind exists but no Head-Accountant → Informant instruction flow.
  - ❌ Mechanic assignment: **no action** for assigning a mechanic to accompany an inspection.
  - ⚠️ Payment approval process: **differs**. The Informant can *create* disbursement requests (`finance/actions.ts:13`, `DISBURSEMENT_REQUESTERS`) and has had the finance page since 10 Aug 2026 (`FINANCE_ROLES = [ceo, head_accountant, account_manager, confidential_informant]`, read-only — record/verify/advance disabled for Informant), but there is no CEO → Informant fund-release handoff tied to a vehicle transaction.
  - ✅ Case expenses recorded.
- **Communication patterns:**
  - ← Head Accountant (documented): repossession instruction. **Missing.**
  - ↑ CEO (documented): payment request → approval → funds. **Changed** to a generic disbursement ledger.
  - → Mechanic (documented): assignment for inspection. **Missing.**
  - → CEO: sourcing leads via `assignInformant` (as the assignee, receives cases).
- **Documented vs. implemented:** Partial. Field-case handling (all four kinds), expenses, mechanic assignment (`assignMechanic`), and read-only finance access exist; the CEO payment-funds flow remains a generalized ledger rather than a per-request handoff.

### 4.6 Marketing Specialist

- **Purpose / business value:** Owns public-facing content — vehicle postings, prices, landing page, promos, and showroom presentation.
- **Real-world scenario:** The marketer who makes cars visible and appealing online: posts listings, sets proposed prices for CEO approval, and curates hero/promo/featured content.
- **Access level:** `ROLE_NAV_ACCESS.marketing_specialist` (5 items): Dashboard, Vehicles, Showroom, Content, Announcements.
- **Responsibilities (docs):** Vehicle posting; price approval (propose → CEO approve before posting).
- **Implemented:**
  - ✅ Vehicle posting: `createVehicle`/`updateVehicle`/`archiveVehicle` marketing-only since 10 Aug 2026 (action guards + RLS, migration 00038).
  - ✅ Price approval: `proposePrice` (marketing-only since 10 Aug 2026) → CEO-only `approvePrice`; `publishVehicle` **requires an approved price proposal** (`vehicles/actions.ts:126-135`).
  - ✅ Content: `createContentItem`/`publishContent` (hero/promotion/featured_vehicle).
  - ✅ Showroom presentation: `staff-showroom` preview.
  - ✅ 360° media: upload manager for `360_view` frames.
- **Communication patterns:**
  - ↑ CEO: price proposals for approval.
  - ↓ Public: vehicle postings and promotions.
- **Documented vs. implemented:** Fully aligned.

### 4.7 Mechanic

- **Purpose / business value:** Provides condition intelligence — inspections feed the DSS scores and repair records.
- **Real-world scenario:** The technician who checks each car GCE is acquiring (on-site or with the Confidential Informant), works the nested system → component → part checklist, records repairs, and produces the inspection report that feeds pricing and recommendations.
- **Access level:** `ROLE_NAV_ACCESS.mechanic` (5 items, `roles.ts:183`): Dashboard, Vehicles, Inspections, Field Cases, Announcements.
- **Responsibilities (docs):** Vehicle inspection; repair progress tracking; accompanies Confidential Informant off-site.
- **Implemented:**
  - ✅ Nested checklist: `ChecklistEntry { level: system|component|part }` (`inspections/_components/checklist-form.tsx:19-25`).
  - ✅ Condition scoring: `submitChecklistAnswer` (mechanic-only since 10 Aug 2026; migration 00038 scopes inspections/repairs/checklist/part-replacement writes to mechanic) with part replacements (name/brand/cost).
  - ✅ Repair progress: per-entry results + `part_replacements`.
  - ⚠️ Inspection report: a summary list/detail exists; revision R-33 (one status per component, auto-filled from checklist) is approximated by the checklist itself.
  - ⚠️ Accompanies Informant: no explicit pairing flow (same gap as Informant's mechanic-assignment).
- **Communication patterns:**
  - → DSS: inspection scores feed `recommendations/engine.ts` condition sub-score.
  - ↔ Confidential Informant (documented): accompany off-site inspections. **No formal link.**
- **Documented vs. implemented:** Strongly aligned for inspection/repair; the Informant pairing is not formalized.

### 4.8 Head Security

- **Purpose / business value:** Physical security evidence — attendance and before/after proof-of-duty photographs.
- **Real-world scenario:** The guard on duty clocks in, submits leave/overtime requests, and uploads photos of the building's locks and grounds before and after each shift as proof the site was secured.
- **Access level:** `ROLE_NAV_ACCESS.head_security` (6 items, `roles.ts:184-191`): Dashboard, Vehicles, Attendance, Employee Requests, Security Duty Checks, Announcements.
- **Responsibilities (docs):** Attendance functions (leave, overtime, time-in/out); proof of duty (before/after photographic evidence).
- **Implemented:**
  - ✅ Attendance: any staff can clock in/out; `employee-requests` for leave/overtime.
  - ✅ Proof of duty: `security-duty-checks` head_security-only; before/after image upload to `security-evidence` bucket; completion requires **both** images (`security-duty-checks/actions.ts:112-114`).
- **Communication patterns:**
  - ↑ CEO/Account Manager: attendance and requests reviewed.
- **Documented vs. implemented:** Fully aligned.

### 4.9 Customer

- **Purpose / business value:** Primary end user — browses, inquires, buys, sells, and requests cars.
- **Real-world scenario:** A shopper visits the showroom, filters by budget/preferences, uses the DSS recommendation, asks about a car via inquiry chat, or buys one outright; may also sell their own vehicle or request a car GCE doesn't have.
- **Access level:** Customer header nav (Showroom, My Inquiries, Find Your Car); pages `/customer/showroom`, `showroom/[id]`, `my-inquiries`, `recommendations`, `my-transactions`, `favourites`, `sell-vehicle`, `request-a-car`. No dashboard sidebar.
- **Implemented:**
  - ✅ Showroom with search/filters/360° views; favourites.
  - ✅ Inquiry chat + Buy Now (`intention_kind`), vehicle-linked, image/file attachments, word filter.
  - ✅ Recommendations: DSS with 5 weighted criteria (`budget 0.35, condition 0.25, fuel 0.15, demand 0.15, mileage 0.10`), explainable scores.
  - ✅ Transactions: buy / sell / request-a-car with shared state path; payment terms & installment schedule visible; purchase history.
  - ⚠️ Two valid IDs + proof of billing (documented purchase requirement): schema exists in `buyDetailsSchema`/`purchase_details` but no enforcement/verification flow confirmed.
- **Communication patterns:**
  - → Account Manager: inquiries.
  - → Sales Manager: Buy Now.
  - ↔ Staff: inquiry chat with attachments.
- **Documented vs. implemented:** Well aligned.

### 4.10 Supplier

- **Purpose / business value:** Supplies vehicles to GCE for sale; B2B and B2C.
- **Real-world scenario:** A company or individual that GCE sources cars from. Created by staff (not self-registering), declares Company/Individual, provides two primary IDs, and is blocked from signing in until approved. Once approved, can coordinate with the CEO.
- **Access level:** Same customer header (Showroom, My Inquiries, Find Your Car); pages `/supplier/showroom`, `showroom/[id]`, `my-inquiries`, `recommendations`, `my-transactions`. Supplier also appears in `supplier-messages` page gate.
- **Implemented:**
  - ✅ Staff-created supplier rows: `createSupplier` (ceo/account_manager), `approveSupplier` → approved/rejected.
  - ✅ Supplier messages table + RLS (approved supplier or CEO), realtime enabled.
  - ⚠️ Company/Individual: UI select + DB CHECK; **no server-side zod validation** (`auth/actions.ts:211` accepts any string).
  - ❌ Two primary valid IDs: `supplier_documents`/`ACCEPTED_ID_TYPES` exist but **no upload/verification flow**.
  - ❌ No sign-in before approval: **not enforced** — `signIn`/middleware never check `suppliers.state`; `approveSupplier` never links an auth account (`suppliers.account_id` never set).
  - ❌ Invitation evidence: `invitation_evidence_path` column exists, never written; `invited`/`registered` states never used.
  - ⚠️ Supplier self-registration: **none** (staff-created only) — consistent with the revision list.
- **Communication patterns:**
  - ↔ CEO: `supplier-messages` (read-only UI; no send action wired yet).
- **Documented vs. implemented:** Partial — the biggest gap cluster in the system (R-27). Core row lifecycle exists but KYC, sign-in gating, and account linkage are missing.

### 4.11 Procurement Team (documented-only group)

- **Purpose (documented):** The revision list (heading 5) assigns supplier-account creation to the Procurement Team instead of self-registration.
- **Status:** Not a role value anywhere in the system; unresolved open question **Q-19** ("Who is the 'Procurement Team'?"). Implementation delegates supplier creation to CEO/Account Manager — a documented substitution in `docs/tasks/10.md`.
- **Recommendation:** Either confirm that CEO/Account Manager act as the Procurement Team (and update the revision list), or define the procurement capability (a nav permission or a dedicated role) and assign it.

---

## 5. Gap Analysis

### 5.1 Consolidated discrepancy table

Priority: **H** = blocks documented behaviour; **M** = meaningful behaviour differs; **L** = cosmetic/minor.

| # | Documented requirement | Source | Implementation status | Impact | Evidence |
|---|---|---|---|---|---|
| G1 | Supplier provides **two primary valid IDs** (verification) | Revisions §5 | ❌ No upload/verification flow; `supplier_documents` unused | H | `auth/actions.ts:210-259` |
| G2 | Supplier **cannot sign in until GCE approves** | Revisions §5 | ❌ No gate in `signIn`/middleware; `suppliers.state` unchecked | H | `src/app/auth/actions.ts:14-47`, `src/middleware.ts` |
| G3 | Supplier Company/Individual **validation** | Revisions §5 | ❌ DB CHECK only; no server-side enum validation | M | `auth/actions.ts:211` |
| G4 | Supplier **auth-account linkage** | Revisions §5 | ❌ `suppliers.account_id` never set | M | `auth/actions.ts` |
| G5 | Supplier **invitation evidence** (if portal kept) | Revisions §5 | ❌ Column exists, never written; `invited`/`registered` states unused | M | migration `00001`; `roles.ts:71-79` |
| G6 | **Procurement Team** creates supplier accounts | Revisions §5 | ⚠️ CEO/Account Manager instead; role not defined | M | `auth/actions.ts:224`; Q-19 |
| G7 | Inquiry → Account Manager; Buy Now → Sales Manager (auto-routing) | USERS LEVELS §Sales Mgr 1 | ⚠️ Visibility + RLS + manual "Assign to Me"; not auto-assigned | M | `inquiries/page.tsx:15-17`, `staff-chat-view.tsx:95-98`, migration `00005` |
| G8 | Head Accountant notifies AM at installment **due date** | USERS LEVELS §Head Acct 5 | ❌ No notification flow | H | installments module |
| G9 | Head Accountant instructs Informant to **repossess** | USERS LEVELS §Head Acct 5, §Conf Inf 3 | ✅ `instructRepossession` creates a `recovery` field case; migration 00038 grants head_accountant field-cases SELECT + INSERT (10 Aug 2026) | — | `transactions/actions.ts:708`; migration `00038` |
| G10 | Head Accountant **releases car-purchase funds** on CEO request | USERS LEVELS §Head Acct 1 | ❌ No release-of-funds action for purchases | M | `finance` |
| G11 | Confidential Informant **payment-request → CEO approval → funds** | USERS LEVELS §Conf Inf 6 | ⚠️ Generalized disbursement; no CEO-funds handoff; finance page readable (own requests) since 10 Aug 2026 | M | `finance/actions.ts:13`, `finance/page.tsx:8` |
| G12 | Informant **assigns a mechanic** for off-site inspection | USERS LEVELS §Conf Inf 2 | ❌ No mechanic-assignment action | M | field-cases |
| G13 | Account Manager **vehicle reconditioning** dashboard | USERS LEVELS §Acct Mgr 1 | ❌ No reconditioning module | L | dashboard |
| G14 | Account Manager **statutory deductions** (SSS/Pag-IBIG/TIN/PhilHealth) | USERS LEVELS §Acct Mgr 4 | ⚠️ Free-form line items; no computation; no TIN field | M | `payslips/[id]` detail |
| G15 | `users/` page reflects **real records** | USERS LEVELS §Acct Mgr 3 | ⚠️ Static mock data (`users/_components/data.tsx`) | M | `users/page.tsx` |
| G16 | **Two valid IDs + proof of billing** on purchases | USERS LEVELS §Sales Mgr 2 | ⚠️ Schema fields exist; no enforcement/verification step | M | `buyDetailsSchema` |
| G17 | CEO **approves cars for inventory** | USERS LEVELS §CEO | ⚠️ Folded into price-approval + publish; no separate step | L | `vehicles/actions.ts:178-232` |
| G18 | Admin vs Employee tier distinction | USERS LEVELS (implicit) | ✅ 8 staff roles; docs list 4 admins; implementation grants fine-grained per-role nav (defensible) | — | `roles.ts` |
| G19 | CEO↔Supplier direct channel | Revisions §3 | ⚠️ Read-only page; no send action wired (`supplierMessageSchema` unused) | M | `supplier-messages/page.tsx` |
| G20 | Head Security admin status | USERS LEVELS | ✅ Treated as staff role (consistent with using attendance) | — | `roles.ts` |
| G21 | Payment/messaging **word filter** | Revisions §1 | ✅ Implemented (`src/lib/word-filter`) | — | chat |
| G22 | Chat **photo/file sending** | Revisions §1 | ✅ Implemented (attachment action) | — | my-inquiries |
| G23 | Form **autofill** from stored details | Revisions §4 | ⚠️ Partial — purchase flow autofills registration; no general autofill layer | M | sales forms |
| G24 | Field-case **creation from transactions** | USERS LEVELS §Conf Inf | ⚠️ Only `sourcing` via `assignInformant`; no acquisition/delivery/recovery creation UI | M | `transactions/actions.ts:400-429` |

### 5.2 Highest-impact gaps

1. **Supplier onboarding & sign-in gating (G1–G6, G19).** KYC, two-ID evidence, approval gating, account linkage, and the CEO channel are all incomplete. This is the single weakest area against the revision list and blocks the documented B2B/B2C supplier story.
2. **Head Accountant financial duty chain (G8–G10).** Resolved 9–10 August 2026 — due-date notifications (`checkAndNotifyDueInstallments`), the repossession instruction (`instructRepossession`; head_accountant field-case access via migration 00038), and purchase fund release (`requestPurchaseFunds` → `advanceDisbursement`) are all implemented.
3. **Informant financial/field flows (G11, G12, G24).** Mostly resolved — mechanic assignment (`assignMechanic`) and `createFieldCase` for all four kinds (recovery restricted to CEO/Head Accountant) exist, and the Informant can open the finance page (read-only). The payment-request-to-CEO path remains a generalized disbursement ledger (deliberate substitution).

---

## 6. Communication Flow Documentation

### 6.1 Inquiry → sale journey (Customer ↔ AM ↔ SM)

```
Customer (showroom/[id])  --Inquire-->  inquiry row (intention_kind='inquiry')
Customer (showroom/[id])  --Buy Now-->  inquiry row ('buy_now') + transaction (buy)
        |                                        |
        |                    Sales Manager queue filtered to buy_now (RLS + page)
        |                    Account Manager sees all inquiries
        v                                        v
   Inquiry chat  --"Assign to Me"-->  assigned AM (inquiry) or SM (buy_now)
        |
        v
   Account Manager schedules viewing (scheduleArrangement: delivery/meetup/gce_visit)
        |
        v
   GCE visit chosen  -->  state 'scheduled'  -->  Handoff button (handoffInquiry)
        |
        v
   Sales Manager takes over in-person  (documented; single-click handoff in system)
```
**Gap:** handoff is a one-way state flip (`handoff_state='handed_off'`); the schema's `pending_handoff` intermediate state is never used — no "AM requests → SM accepts" workflow.

### 6.2 Vehicle listing & pricing (Marketing ↔ CEO)

```
Mechanic inspects  -->  inspection_score  -->  DSS condition sub-score
Marketing proposePrice --> listing_state='awaiting_price_approval' --> CEO approvePrice
CEO approves  -->  current_price set, state='available'  -->  publishVehicle (requires approval)
```
✅ Fully aligned with documentation.

### 6.3 Purchase pipeline & funds (Customer ↔ SM ↔ HA ↔ CEO ↔ Informant)

```
Customer Buy Now / walk-in  -->  transaction (buy, state machine SCA/SC/SCH)
Sales Manager creates walk-in account / createWalkInTransaction
Sales Manager recordPaperwork, recordPayment
Head Accountant verifyPayment, markInstallmentWaived, approvePaymentTerms
CEO/SM/AM activatePaymentTerms --> installment schedule --> installments (due/paid/overdue)
Completion (buy)  -->  vehicle auto-marked 'sold' everywhere
```
**Documented-but-missing edges:**
- `CEO (request) → Head Accountant (release funds for car purchase)` — absent.
- `Head Accountant (installment due) → Account Manager (contact buyer)` — absent.
- `Head Accountant (ultimatum passed) → Confidential Informant (repossess)` — absent; `recovery` case kind exists but nothing creates it.
- `Confidential Informant (payment request) → CEO (approve) → funds` — replaced by generic disbursement ledger; the Informant can open the finance page (read-only) since 10 Aug 2026.

### 6.4 Payroll chain (AM → HA → CEO → HA)

```
Account Manager prepares (saveCompensation, createPayrollRun, addPayslipItem)
  → draft
Head Accountant approves (seq 1)  -->  pending_approval
CEO approves (seq 2)              -->  approved
Head Accountant finalizePayrollRun -->  finalized
Head Accountant markPayslipPaid    -->  paid
```
✅ Implemented exactly as the 2-step approval order (matches provisional Q-13 answer).

### 6.5 Report & approval flows

```
Account Manager / Head Accountant / CEO --submitReport--> CEO/Head Acct --reviewReport--> reviewed
Announcements: CEO only (create → publish → expire/archive)
Supplier messages: CEO ↔ approved Supplier (read-only UI; RLS enforced)
```

### 6.6 Field operations (Informant / Mechanic / Head Security)

```
Field cases: kinds acquisition | delivery | recovery | sourcing
  - created via assignInformant (CEO+SM) or createFieldCase (ceo, confidential_informant, sales_manager, head_accountant); recovery restricted to CEO/Head Accountant
  - workers: ceo, confidential_informant, mechanic, sales_manager (Head Security removed 10 Aug 2026)
  - expenses_cents recorded per case
Security duty checks: head_security start → upload before/after → complete (both required)
Mechanic: checklist → inspection_score → DSS + repair progress
```
**Gap:** creation paths for all four kinds and mechanic assignment (`assignMechanic`) exist; only automatic Informant↔Mechanic pairing is absent.

### 6.7 Role hierarchy (permission tiers)

```
CEO                     (select-all visibility + approvals; operational writes scoped per role, migration 00038)
├── Account Manager     (RBAC, payroll prep, inquiries, staff records, finance)
├── Head Accountant     (payroll pay, verify payments, reports, finance; due-date notices + repossession instructions)
├── Sales Manager       (sales pipeline, Buy Now, walk-in accounts, transitions)
└── Staff workers       Confidential Informant / Mechanic / Marketing Specialist / Head Security
Public:  Customer | Supplier
```

---

## 7. Recommendations

### 7.1 Align implementation with documentation (code changes)

All items below were implemented on 9 August 2026 (migrations 00024–00028) and the RBAC/least-privilege pass on 10 August 2026 (migration 00038, page guards, `ROLE_NAV_ACCESS`).

1. **Close the supplier onboarding gap (R-27).** — Implemented 9 Aug 2026 (migrations 00024–00028):
   - Add a `supplier_documents` upload flow (two primary IDs from `ACCEPTED_ID_TYPES`) and a verification step before approval (`approveSupplier`).
   - Gate sign-in on `suppliers.state = 'approved'` in `signIn` (and middleware) — reject with a "pending approval" message otherwise.
   - Add server-side validation for `supplierKind` (`z.enum(["company","individual"])`) and a state-transition guard in `approveSupplier` (only `pending_approval` may be decided).
   - Set `suppliers.account_id` when a supplier user signs in / is linked.
   - Resolve Q-19 (Procurement Team identity) — either document CEO/Account Manager as the procurement capability or add a permission set for it.
2. **Wire the CEO↔Supplier channel (R-38 / Revisions §3):** — Implemented 9 Aug 2026: `sendSupplierMessage` sends via the existing `supplierMessageSchema`; the page is no longer read-only.
3. **Restore the Head Accountant financial chain (G8–G10):** — Implemented 9–10 Aug 2026: due-date notifications (`checkAndNotifyDueInstallments`), repossession instruction (`instructRepossession`; head_accountant field-case access via migration 00038), and purchase fund release (`requestPurchaseFunds` → `advanceDisbursement`).
   - Add a due-date notification from installments to the Account Manager (and, if in scope, a route for Account Manager to contact the buyer).
   - Add a "repossession instruction" action that creates a `recovery` field case assigned to a Confidential Informant (Head Accountant only).
   - Add an explicit car-purchase fund-release action (CEO request → Head Accountant release) or document that the generic disbursement ledger supersedes it.
4. **Give the Confidential Informant their documented flows (G11–G12):** — Implemented: mechanic assignment (`assignMechanic`, 9 Aug 2026) and finance page read access (10 Aug 2026, `ROLE_NAV_ACCESS` + `FINANCE_ROLES`). The fund-release path remains the generalized disbursement ledger (deliberate substitution).
   - Grant the Informant read access to the finance page for their own disbursement requests, or provide a dedicated payment-request UI to the CEO with a fund-release state.
   - Add a mechanic-assignment action on field cases/inspections.
5. **Add creation paths for field cases** — Implemented 9 Aug 2026: `createFieldCase` covers all four kinds; `recovery` is restricted to CEO/Head Accountant (migration 00038).
6. **Replace the static `users/` page** — Implemented 9 Aug 2026: `users/` is DB-backed (profiles + roles).
7. **Automate statutory deductions** — Implemented 9 Aug 2026: compensation record fields auto-create payslip deduction items (SSS/Pag-IBIG/PhilHealth/TIN).
8. **Implement a general autofill layer (R-29)** — Partial: purchase-flow and arrangement-location autofill exist; general autofill stays on the backlog (see [15 - SYSTEM STATUS](15%20-%20SYSTEM%20STATUS.md)).
9. **Enforce the two-ID + proof-of-billing requirement** — Implemented 9 Aug 2026: `verifyTransactionDocument`; `buy → completed` blocked until 2 verified IDs + billing, per `USERS LEVELS §Sales Mgr 2`.
10. **Add the `pending_handoff` step** — Implemented 9 Aug 2026: `pending_handoff` → `acceptHandoff` (Sales Manager accepts the handoff).
11. **Add a vehicle-reconditioning view** — Implemented 9 Aug 2026: `ReconditioningOverview` widget on the Account Manager dashboard, per `USERS LEVELS §Acct Mgr 1`.

### 7.2 Update documentation to reflect implementation (docs changes)

1. **Supplier role:** revise Revisions §5 to note supplier creation is delegated to CEO/Account Manager (or add the Procurement Team role), and record the sign-in gating and two-ID steps once implemented.
2. **Head Accountant:** annotate `USERS LEVELS §Head Acct 1/5` to reflect that installment-notification and repossession-instruction flows are not yet implemented (or are planned).
3. **Confidential Informant:** annotate §6 (payment approval) to reflect the generalized disbursement ledger instead of a CEO fund handoff.
4. **Executive dashboard:** note that "approve cars for inventory" is realized as price-approval + publish.
5. **Record of sales / purchases:** note the two-ID requirement's current status (schema-only).
6. **Add a "System status" section** to `docs/ANALYZER/…/13 - USER ACCOUNTS.md` mapping each documented responsibility to its implementation status, so future tasks (like this audit) have a living reference.

### 7.3 Roadmap suggestion

Fold the supplier work (7.1.1) and the Head Accountant chain (7.1.3) into the next implementation phase before any further Phase 6 work, since both are high-priority documented behaviours with no current coverage. — Done: both were implemented in the 9–10 August 2026 passes before further Phase 6 work. Track the rest as a documented backlog tied to the open questions in `docs/ANALYZER/…/00 - START HERE.md` (Q-04, Q-12, Q-13, Q-14, Q-15, Q-19, Q-22).

---

## 8. Appendix — Source references

| Concern | File | Lines |
|---|---|---|
| RBAC least-privilege RLS (role-scoped operational writes) | `supabase/migrations/00038_rbac_least_privilege.sql` | — |
| Role definitions, nav access, landing pages | `src/lib/auth/roles.ts` | 1–177 |
| Page guard | `src/lib/auth/guards.ts` | `requireRole` |
| Server-action guard | `src/lib/auth/action-guard.ts` | `authorizeAction` |
| Cookie routing middleware | `src/middleware.ts`, `src/lib/supabase/middleware.ts` | — |
| Auth/role actions (signIn, signUp, assignRole, createWalkInAccount, createSupplier, approveSupplier) | `src/app/auth/actions.ts` | 14–302 |
| Sidebar role filtering | `src/app/(staff)/_components/sidebar/app-sidebar.tsx` | ~72 |
| Transaction state machine | `src/lib/transactions/state-machine.ts` | 1–119 |
| Installment schedule generator | `src/lib/transactions/installments.ts` | 1–81 |
| DSS recommendation engine (5 weighted criteria) | `src/lib/recommendations/engine.ts` | 1–195 |
| Inquiry intent + routing | `src/lib/validation/inquiries.ts`, `src/app/(customer)/my-inquiries/actions.ts`, `src/app/(staff)/inquiries/page.tsx`, `src/app/(staff)/inquiries/_components/staff-chat-view.tsx` | — |
| Inquiries/viewing/handoff schema | `supabase/migrations/00005_phase3_schema.sql` | 5–141 |
| Transactions/financing schema | `supabase/migrations/00011_phase5_schema.sql` | — |
| Finance (disbursements, entries) | `src/app/(staff)/finance/` + `supabase/migrations/00016_phase6_finance_reports.sql` | — |
| Payroll/payslips | `src/app/(staff)/payroll/actions.ts`, `src/app/(staff)/payslips/` + migrations `00017`, `00022` | — |
| Reports | `src/app/(staff)/reports/` | — |
| Supplier messages | `src/app/(staff)/supplier-messages/page.tsx` + migration `00019` | — |
| Supplier schema | `supabase/migrations/00001_phase1_schema.sql` | 124–289 |
| Security duty checks | `src/app/(staff)/security-duty-checks/actions.ts` | — |
| Field cases | `src/app/(staff)/field-cases/actions.ts` + `transactions/actions.ts` (`assignInformant`) | — |
| Vehicle/pricing/content | `src/app/(staff)/vehicles/actions.ts` | — |
| Static `users/` mock data | `src/app/(staff)/users/_components/data.tsx` | — |
| Word filter | `src/lib/word-filter` | — |
| Open questions (incl. Q-19 Procurement Team) | `docs/ANALYZER/ANALYSIS - GLOBAL CAR EXCHANGE/00 - START HERE.md` | — |
