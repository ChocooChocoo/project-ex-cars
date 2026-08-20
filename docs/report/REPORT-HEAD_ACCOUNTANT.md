# Head Accountant Audit Report

> User Level: Head Accountant - Investigation #3

## Summary

The Head Accountant has access to 9 staff modules — focused only on dashboards, money movement, and staff cost. This limited breadth is intentional: unlike the CEO (23 modules), this role does not handle operations such as inspections, inquiries, or suppliers, so the system keeps Head Accountant on financial oversight, transaction verification, and attendance-based payroll. All 9 modules are needed for that job; most can stay as they are, with two that would benefit from a lighter summary view.

## Modules Audited

### 1. Dashboard (Default) — Dashboards
- **What it does for Head Accountant:** Shows a daily snapshot — key metrics, performance, reconditioning, and alerts — to decide what finance or payroll task to handle first.
- **Necessary for Head Accountant?** Yes — needs one starting view to spot payroll or finance items without opening each section.
- **Workflow:** Appropriate — read-only overview with no extra steps. Same view for all staff; CEO sees one extra operations panel, which is correct.
- **Recommendation:** Keep — preserve as the daily starting view.

### 2. Finance — Dashboards
- **What it does for Head Accountant:** Central money record. Records financial entries (revenue, expense, disbursement, adjustment), verifies entries made by others, and moves disbursement requests through their steps (draft → submitted → approved → released → received → paid). Also shows revenue, expense, and active disbursement totals.
- **Necessary for Head Accountant?** Yes — this is the core control for recording and confirming that money records are correct.
- **Workflow:** Appropriate — detailed but needed for control. Separation is correct: Head Accountant can record, verify, and advance requests, but cannot create a disbursement request or purchase-fund request for themselves. That prevents self-approval.
- **Recommendation:** Keep — can record, verify and move requests forward is correct; no broader access needed. Preserve verification and disbursement audit trail.

### 3. Vehicles — Operations
- **What it does for Head Accountant:** Shows the full vehicle inventory — make, model, year, stock code, condition, and status (available, reserved, sold, archived). Helps link the cars on the lot to their value and to purchase transactions.
- **Necessary for Head Accountant?** Yes, for asset and value awareness — but only to see, not to manage listings.
- **Workflow:** Appropriate — view-only for Head Accountant. Only Marketing Specialist can edit listings and only CEO can delete; Head Accountant is not asked to publish or price.
- **Recommendation:** Keep — keep view-only access. Consider showing a finance-focused summary on top (price, acquisition cost, status) because the full marketing inventory view is broader than finance needs. No edit access needed. Note: pending price proposals are currently visible only to CEO; a read-only view of those proposals would help Head Accountant tie purchase costs to finance without giving approval power — a small helpful gap.

### 4. Transactions — Operations
- **What it does for Head Accountant:** Lists all customer buy, sell, and request-a-car transactions with state, vehicle, and customer, plus a summary bar at the top (pending, under review, completed, buy/sell/request counts). Used to verify what should be recorded in finance.
- **Necessary for Head Accountant?** Yes — confirms the sales and purchase activity that drives revenue and payouts.
- **Workflow:** Appropriate — filtered history and state views support audit. Head Accountant sees the same table as CEO and Account Manager but is not the daily coordinator; Account Manager and Sales handle the state changes.
- **Recommendation:** Keep — preserve full history and audit view; leave daily handling to Account Manager and Sales.

### 5. Attendance — Staff Management
- **What it does for Head Accountant:** Shows clock-ins, clock-outs, hours worked, and status for every employee, and allows a checker to confirm records. This matters because payroll is built from checked attendance.
- **Necessary for Head Accountant?** Yes — checked attendance is the direct input to payroll. Without verified attendance, payroll would be inaccurate. Head Accountant is one of three checker roles (with CEO and Account Manager).
- **Workflow:** Appropriate for a checker, but full 100-row logs are heavy to scan every day.
- **Recommendation:** Keep — keep checker access and the ability to confirm records. Add a daily summary and exception view (late, absent, unchecked) on top, with full logs available on drill-down. Preserve checked-by audit trail.

### 6. Payroll — Staff Management
- **What it does for Head Accountant:** Shows staff compensation records (base salary and statutory deductions) and payroll runs by pay period. Head Accountant reviews and gives final approval, which locks the payslips.
- **Necessary for Head Accountant?** Yes — this is the main staff-cost control before money is marked as paid.
- **Workflow:** Appropriate — strong separation of duties: Account Manager and CEO prepare runs and enter compensation; Head Accountant and CEO review; only Head Accountant can finalize. This prevents the preparer from approving their own work.
- **Recommendation:** Keep — keep review and finalize-only-for-Head-Accountant as the final sign-off. No preparation access needed.

### 7. Payslips — Staff Management
- **What it does for Head Accountant:** Lists individual payslips for every employee and pay period — gross and net, status (draft/finalized), and payment status (pending/paid). Head Accountant alone can mark a finalized payslip as paid, recording who and when.
- **Necessary for Head Accountant?** Yes — individual detail is essential here to confirm correct pay and to control the final payment step. This is different from the CEO, where summary is enough.
- **Workflow:** Appropriate — table view with gated actions (only finalized can be paid, already-paid cannot be re-paid).
- **Recommendation:** Keep — keep full detail and the exclusive mark-paid control. Preserve paid_at and paid_by audit fields.

### 8. Reports — Staff Management
- **What it does for Head Accountant:** Stores formal reports by kind (attendance, payroll, disbursement, expense, revenue, inventory, sales, management, other) and period. Head Accountant both submits financial reports and reviews reports from others.
- **Necessary for Head Accountant?** Yes — needed to document finance and payroll results for leadership and audit.
- **Workflow:** Appropriate — Head Accountant and CEO can create and mark as reviewed; Account Manager can create but not review. Simple submit → reviewed flow.
- **Recommendation:** Keep — preserve create and review access; no change.

### 9. Announcements — Staff Management
- **What it does for Head Accountant:** Displays company-wide announcements that are published and still active (with expiry dates). Head Accountant reads them; only CEO can create, publish, expire, or archive.
- **Necessary for Head Accountant?** Yes, for awareness — pay dates, policy changes, or deadlines are shared this way.
- **Workflow:** Appropriate — view-only, no creation required for this role.
- **Recommendation:** Keep — keep view-only; no publish needed for Head Accountant.

## Overall Recommendations

- **Keep as is:** Dashboard, Finance (with current verify/advance limits), Transactions, Payroll, Payslips, Reports, Announcements
- **Simplify (show summary first, details on drill-down):** Vehicles — add a finance summary view (price, cost, status) while keeping full inventory on drill-down; Attendance — add daily summary and exception alerts while keeping checker ability and full logs behind drill-down
- **Consider for Revision/Removal:** No module is recommended for full removal. The only helpful addition to consider is a read-only view of pending vehicle price proposals for Head Accountant (currently CEO-only), so purchase-fund releases can be tied to the proposed price without granting approval. All suggestions are non-destructive and preserve existing approvals, verification steps, and audit trails — no functionality should be deleted.

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as verification, disbursement flow, payroll review → finalize, payslip paid-by tracking, and role protection should be preserved when adding summaries.
- Why breadth is limited for Head Accountant vs CEO: The CEO (23 modules) is accountable for the whole business — showroom, inspections, inquiries, suppliers, field cases, security checks, roles/users, and strategy. Head Accountant (9 modules) is focused only on money and staff cost — finance, transactions, attendance-based payroll, payslips, and reporting. Modules not assigned are appropriately absent: Content and Showroom belong to Marketing Specialist, Inspections to Mechanic, Inquiries/Recommendations/Roadmap to Sales/Account Manager, Suppliers and Supplier Messages to CEO/Account Manager, Staff Records/Employee Requests/Field Cases/Security Checks to HR/Security specialists, and Roles/Users to CEO. This keeps finance independent from operations and protects sensitive HR and supplier decisions.
- Overly broad or missing: Vehicles is broader than finance needs today — the full marketing inventory is shown when only price and cost context is needed; a summary would reduce clutter. Attendance at full log depth is operationally heavy without a summary. No major module is missing — the small gap is the CEO-only price-proposal view noted above, which would help finance verify purchase amounts. Direct access to Staff Records compensation detail is also not needed because compensation is already surfaced inside Payroll; that separation is correct.
- Evidence: evaluated 9 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.head_accountant` = default, finance, vehicles, transactions, attendance, payroll, payslips, reports, announcements) and group order from `src/navigation/sidebar/sidebar-items.ts` (Dashboards → Operations → Staff Management). Spot-checked `src/app/(staff)/dashboard/page.tsx`, `src/app/(staff)/finance/page.tsx` and `_components/finance-client.tsx` (permissions in code: `canRecord`, `canVerify`, `canAdvance`), `src/app/(staff)/vehicles/page.tsx` and `_components/vehicle-operations.tsx`, `src/app/(staff)/transactions/page.tsx` (`_components/transactions-kpi-strip.tsx` — KPI strip), `src/app/(staff)/attendance/page.tsx` and `_components/attendance-client.tsx`, `src/app/(staff)/payroll/page.tsx` and `_components/payroll-client.tsx` and `actions.ts`, `src/app/(staff)/payslips/page.tsx`, `src/app/(staff)/reports/page.tsx` and `_components/reports-client.tsx`, `src/app/(staff)/announcements/page.tsx` and `_components/announcements-client.tsx`. Style reference: `docs/report/REPORT-CEO.md` and `docs/report/REPORT-ACCOUNT_MANAGER.md`. Workflow notes are based on code-level role guards, not live user testing — confirm simplifications with Head Accountant, HR, and Finance owners before changing views.
