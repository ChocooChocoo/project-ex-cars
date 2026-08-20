# Confidential Informant Audit Report

> User Level: Confidential Informant - Investigation #4

## Summary

The Confidential Informant has access to 7 staff modules — a deliberately narrow set focused on field intelligence and verification, not management. Compared to the CEO (23 modules) or Account Manager (19), this role sees only a dashboard, a limited finance view, vehicle and inspection context, transaction history, field cases, and announcements. The limited breadth is appropriate: this is a discreet, field-focused role that needs visibility to gather and report accurately, without the authority to manage payroll, attendance, staff records, suppliers, or system admin. All 7 modules are necessary at some level; most can stay as they are, with Finance best kept as a summary-owned view rather than full financial control.

## Modules Audited

### 1. Dashboard (Default) — Dashboards
- **What it does for Confidential Informant:** Provides a daily landing view — key metrics, performance, reconditioning progress, and notifications — to see what needs attention in the field.
- **Necessary for Confidential Informant?** Yes — gives a single starting point without requiring the informant to open each section to know where to look.
- **Workflow:** Appropriate — read-only overview with no extra steps. Same base dashboard as other staff; the CEO sees one extra operations panel, which is correct for leadership and not needed here.
- **Recommendation:** Keep — preserve as the daily starting view.

### 2. Finance — Dashboards
- **What it does for Confidential Informant:** Shows the financial ledger (revenue, expense, disbursement, adjustment entries) and disbursement requests. This is the only finance touchpoint the informant needs to request field-related funds and check the status of their own requests.
- **Necessary for Confidential Informant?** Yes, but only in a limited way — needed to request disbursement for field work and to verify that the request is moving through approval, not to manage company money.
- **Workflow:** Appropriate but sensitive — correctly restricted. The informant can request disbursements but cannot record financial entries, verify entries, advance approvals, or request car-purchase funds. Informants see only their own disbursement requests (filtered by requested_by) with a clear notice that CEO or Head Accountant must advance them. The ledger of all entries is still visible, which is broader than a field role strictly needs.
- **Recommendation:** Simplify — keep request and own-request tracking, but consider limiting ledger visibility to a summary or own-related entries. The current block on record/verify/advance is correct and should be preserved. Full revenue and expense detail is overly sensitive for a field intelligence role; a totals-only or filtered view would reduce exposure without harming field work.

### 3. Vehicles — Operations
- **What it does for Confidential Informant:** Displays the full vehicle inventory — make, model, year, stock code, condition, and status (available, reserved, sold, archived) — so the informant can identify vehicles tied to field cases and inspections.
- **Necessary for Confidential Informant?** Yes, for context — needs to know which vehicle is being inspected, recovered, or sourced without managing the listing itself.
- **Workflow:** Appropriate — view-only. Only Marketing Specialist can edit listings and only CEO can delete; pending price proposals are CEO-only. The informant is not asked to publish, price, or approve.
- **Recommendation:** Keep — keep view-only access. A small field-focused filter (e.g., vehicles linked to assigned field cases) on top would help field work while keeping the full inventory available on drill-down.

### 4. Inspections — Operations
- **What it does for Confidential Informant:** Provides mechanic inspection reports, checklist results, condition scores, findings, and recommendations for each vehicle.
- **Necessary for Confidential Informant?** Yes, for inspection support — helps the informant understand vehicle condition before or after field activity and share accurate intelligence.
- **Workflow:** Appropriate — status viewing only. The checklist form is available only to Mechanic; other viewers including the informant see a read-only summary (score, findings, recommendation) which matches a support role.
- **Recommendation:** Keep — preserve read-only inspection view; no editing needed for this role.

### 5. Transactions — Operations
- **What it does for Confidential Informant:** Lists all buy, sell, and request-a-car transactions with customer, vehicle, kind, and state, plus a summary bar at the top (pending, under review…) to track what is happening in the market.
- **Necessary for Confidential Informant?** Yes, for verification context — links field cases to the underlying customer transactions that may need sourcing, acquisition, or recovery awareness.
- **Workflow:** Appropriate — filtered table and state views support discreet checking without requiring the informant to change transaction states daily.
- **Recommendation:** Keep — preserve full history and filtered view for context; leave daily state handling to Account Manager and Sales.

### 6. Field Cases — Operations
- **What it does for Confidential Informant:** Core workspace for field intelligence — acquisition, delivery, sourcing, and recovery assignments. Shows assignment status, location, schedule, expenses, and notes, and supports the full case lifecycle (create → assigned → accepted → completed, etc.).
- **Necessary for Confidential Informant?** Yes — this is the primary responsibility. The informant is both a creator and a field worker for this module.
- **Workflow:** Appropriate and well-scoped — informant can create acquisition and delivery cases (also sourcing via sales), update assigned cases (state, expenses, notes), and assign mechanics where needed. Recovery cases are correctly reserved for Head Accountant and CEO, and sourcing is shared with Sales, which keeps role boundaries clear. Informants and mechanics are selectable as assignees, matching real field teaming.
- **Recommendation:** Keep — preserve create, update, and mechanic-assignment access. This is the one area where the informant should retain active control rather than just visibility.

### 7. Announcements — Staff Management
- **What it does for Confidential Informant:** Displays company-wide announcements that are published and still active (with expiry dates) — policy updates, deadlines, or operational notices.
- **Necessary for Confidential Informant?** Yes, for awareness — ensures field schedules and reporting align with company direction.
- **Workflow:** Appropriate — view-only. Only CEO can create, publish, expire, or archive; other roles read active published items.
- **Recommendation:** Keep — keep view-only; no publish needed for this role.

## Overall Recommendations

- **Keep as is:** Dashboard, Vehicles (view-only), Inspections (read-only support), Transactions (context view), Field Cases (core create/update/assign), Announcements (view-only)
- **Simplify (show summary first, details on drill-down):** Finance — keep disbursement-request and own-request status, but show a summary-only ledger view by default with full entries available only on drill-down or to finance roles. The existing restrictions (cannot record, verify, advance, or request purchase funds) should remain; this is about reducing visible financial detail, not adding capability. Vehicles would also benefit from a small field-focused summary (assigned-case vehicles) as noted above.
- **Consider for Revision/Removal:** No module is recommended for full removal. The only sensitivity to revisit is Finance ledger breadth — showing all company revenue and expense entries to a discreet field role is broader than field duties require. A summary or own-related filter would better match the principle of least exposure while preserving the informant's ability to request and track field funds. All suggestions are non-destructive and preserve existing approvals and separation of duties.

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as disbursement filtering by requester, finance role guards (record/verify/advance), inspection checklist restricted to Mechanic, vehicle proposal visibility limited to CEO, and announcement publish limited to CEO should be preserved when simplifying views.
- Why the limited set is appropriate for Confidential Informant vs broader roles: The CEO and Account Manager cover strategy, customers, suppliers, HR, and admin across 19–23 modules. The Confidential Informant (7 modules) is intentionally not given that breadth. Modules not assigned are appropriately absent: Showroom and Content belong to Marketing Specialist for public presentation, Inquiries and Recommendations to Sales/Account Manager for customer contact, Suppliers and Supplier Messages to CEO/Account Manager for supplier management, and Staff Management details such as Staff Records, Attendance, Employee Requests, Payroll, Payslips, Security Duty Checks, and Reports to HR/Finance/Security specialists, plus Roles and Users to CEO for admin. Paying staff, checking attendance, managing records, or handling supplier negotiations are not field-intelligence duties and would expose sensitive HR and financial controls unnecessarily.
- Sensitive exposure: Finance is the most sensitive module in this set. The current code correctly limits the informant to requesting and viewing only their own disbursements and blocks financial recording, verification, and fund release. The remaining exposure is the visible ledger of all company entries (revenue/expense totals and 100-row history), which is not required for field work and could be narrowed to a summary without impact. No other module appears overly sensitive at this scope — Vehicles, Inspections, and Transactions are correctly view-only and support the field workflow.
- Evidence: evaluated 7 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.confidential_informant` = default, finance, vehicles, inspections, transactions, field-cases, announcements) and group order from `src/navigation/sidebar/sidebar-items.ts` (Dashboards → Operations → Staff Management, with field-cases functionally in Operations as requested). Spot-checked `src/app/(staff)/dashboard/page.tsx`, `src/app/(staff)/finance/page.tsx` and `_components/finance-client.tsx` and `actions.ts`, `src/app/(staff)/vehicles/page.tsx` and `_components/vehicle-operations.tsx`, `src/app/(staff)/inspections/page.tsx` and `[id]/page.tsx`, `src/app/(staff)/transactions/page.tsx` and `_components/transactions-kpi-strip.tsx`, `src/app/(staff)/field-cases/page.tsx` and `_components/field-cases-client.tsx` and `actions.ts`, and `src/app/(staff)/announcements/page.tsx`. Style reference: `docs/report/REPORT-CEO.md`, `docs/report/REPORT-HEAD_ACCOUNTANT.md`, and `docs/report/REPORT-ACCOUNT_MANAGER.md`. Workflow notes are based on code-level role guards and components, not live user testing — confirm simplifications with the Confidential Informant, Finance, and Operations owners before changing views.
