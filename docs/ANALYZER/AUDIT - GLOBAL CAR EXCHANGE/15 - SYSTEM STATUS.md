# System Status — Documented Responsibilities vs. Implementation

> **Living reference** mapping every documented role responsibility to its implementation status.
> Maintained alongside `14 - AUDIT USER ROLES.md`. Status key: ✅ Implemented · ⚠️ Partial / differs · ❌ Missing · 🗂️ Planned backlog.

**Last updated:** 9 August 2026 (audit remediation pass)

---

## Supplier (R-27 cluster)

| Documented requirement | Status | Where / note |
|---|---|---|
| Staff-created supplier accounts (Procurement Team) | ✅ | `createSupplier` (CEO/Account Manager act as the procurement capability; Q-19 resolution: CEO/AM) |
| Two primary valid IDs before approval | ✅ | `supplier_documents` upload + `verifySupplierDocument`; `approveSupplier` requires 2 verified primary IDs |
| No sign-in before approval | ✅ | `signIn` rejects suppliers whose `suppliers.state ≠ 'approved'` |
| Company / Individual declaration | ✅ | Zod enum `z.enum(["company","individual"])` server-side + DB CHECK |
| Auth-account linkage | ✅ | `signIn` sets `suppliers.account_id` on first approved sign-in |
| Invitation evidence | 🗂️ | `invitation_evidence_path` column exists; portal route not built (staff-created only) |
| CEO ↔ Supplier channel | ✅ | `sendSupplierMessage` (CEO or approved supplier); realtime thread on `/supplier-messages` |

## CEO

| Responsibility | Status | Where / note |
|---|---|---|
| Executive dashboard overview | ✅ | `/dashboard` `Phase6Overview` (CEO-only) |
| Report approval/rejection | ✅ | `reports/actions.ts` (CEO + Head Acct); price approval CEO-only |
| Announcements | ✅ | `announcements/actions.ts` CEO-only |
| Approve cars for inventory | ✅ | Realized as `approvePrice` + `publishVehicle` (requires approved proposal) |
| Supplier messages | ✅ | Read + send on `/supplier-messages` |

## Account Manager

| Responsibility | Status | Where / note |
|---|---|---|
| Dashboard (leave, overtime, reconditioning) | ✅ | Dashboard + `ReconditioningOverview` widget |
| Inquiries + viewing schedule + handoff | ✅ | `scheduleArrangement`, two-stage handoff (`pending_handoff` → `acceptHandoff`) |
| Employee & customer records | ✅ | `staff-records` DB-backed with edit + status management (`updateProfileDetails`, `updateAccountState`); `users/` DB-backed (profiles + roles) |
| Attendance / leave / overtime / late arrivals | ✅ | `attendance`, `employee-requests` |
| Payroll preparation → Head Accountant | ✅ | `saveCompensation`, `createPayrollRun` (2-step approval) |
| Statutory deductions (SSS/Pag-IBIG/TIN/PhilHealth) | ✅ | Compensation record fields; auto-created payslip deduction items |
| RBAC | ✅ | `assignRole` (CEO+AM), `roles` page |
| Installment due-date notification (recipient) | ✅ | `notifications` table; dashboard panel |

## Head Accountant

| Responsibility | Status | Where / note |
|---|---|---|
| Disbursement for car purchases (on CEO request) | ✅ | `requestPurchaseFunds` (CEO/AM) → Head Accountant-only release in `advanceDisbursement` |
| Payroll / payslip payment | ✅ | `markPayslipPaid`, `finalizePayrollRun` (head_accountant-only) |
| Inventory / sales monitoring | ✅ | `vehicles`, `transactions` nav |
| Installment accounts (waive, verify, approve terms) | ✅ | `markInstallmentWaived`, `verifyPayment`, `approvePaymentTerms` |
| Notify Account Manager at due date | ✅ | `checkAndNotifyDueInstallments` → Account Manager notifications |
| Instruct Confidential Informant to repossess | ✅ | `instructRepossession` → creates `recovery` field case + `collection_action` |

## Confidential Informant

| Responsibility | Status | Where / note |
|---|---|---|
| Car acquisition / delivery / sourcing / recovery | ✅ | `createFieldCase` (all four kinds) + `updateFieldCase` |
| Mechanic assignment | ✅ | `assignMechanic` on field cases |
| Payment request → CEO approval → funds | ⚠️ | Generalized disbursement ledger; Informant can view own requests on finance page (read-only) |
| Case expenses | ✅ | `expenses_cents` per field case |

## Sales Manager

| Responsibility | Status | Where / note |
|---|---|---|
| Buy Now handling | ✅ | Queue filtering + `assignInquiry` |
| Walk-in buyer/seller accounts | ✅ | `createWalkInAccount` (ceo/am/sales_mgr) |
| Record of sales + paperwork | ✅ | `transactions`, `recordPaperwork` |
| Two valid IDs + proof of billing | ✅ | `recordPaperwork` (pending → `verifyTransactionDocument`); `purchase_details.document_check_state` auto-verified when 2 IDs + billing verified |
| Accept AM handoff | ✅ | `acceptHandoff` (sales_manager) |

## Marketing Specialist / Mechanic / Head Security

| Responsibility | Status | Where / note |
|---|---|---|
| Vehicle posting + price approval | ✅ | `proposePrice` → CEO `approvePrice`; `publishVehicle` gated |
| Content / showroom / 360° media | ✅ | `createContentItem`, `publishContent`, media manager |
| Nested checklist inspection + repairs | ✅ | `inspection_checklist_nodes/results`, `part_replacements` |
| Attendance + proof of duty (before/after photos) | ✅ | `attendance`, `security-duty-checks` (both images required) |

## Customer

| Responsibility | Status | Where / note |
|---|---|---|
| Showroom, favourites, DSS recommendations | ✅ | `showroom`, `favourites`, `recommendations` (5 weighted criteria) |
| Inquiry chat + Buy Now + attachments | ✅ | `my-inquiries` (word filter, attachments) |
| Buy / sell / request-a-car + payment terms | ✅ | `my-transactions` |
| Two valid IDs + proof of billing | ✅ | Customer upload UI on purchase (`uploadPurchaseDocument`); staff verification (`verifyTransactionDocument`); `buy → completed` blocked until 2 verified IDs + billing |

## Backlog (documented but intentionally not built)

- Supplier self-registration portal + invitation evidence upload (staff-created route is the implemented path).
- General autofill layer beyond purchase flow (R-29; partial: arrangement location autofill exists).
