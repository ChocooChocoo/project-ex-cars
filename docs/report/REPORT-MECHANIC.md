# Mechanic Audit Report

> User Level: Mechanic - Investigation #6

## Summary

The Mechanic has access to 5 staff modules — the smallest focused set in the system alongside Marketing Specialist. Compared to the CEO (23 modules) or Account Manager (19), this role is deliberately narrow: one dashboard, two operations tools for vehicles and inspections, and two staff-management channels for field support and company news. This focus is correct. The Mechanic's job is hands-on and technical — checking vehicle condition, completing inspections, and supporting field cases when a vehicle needs expert assessment — not handling money, payroll, customer sales, or staff management — so the system keeps the role on vehicle health and field support while blocking sensitive finance and HR areas.

All 5 modules are necessary; none should be removed. Three are core working tools (Vehicles for context, Inspections for the main job, and Field Cases for technical support) that should stay as they are. The other two (Dashboard and Announcements) are correctly view-only.

Sidebar order is Dashboards (Default) → Operations (Vehicles, Inspections) → Staff Management (Field Cases, Announcements). Field Cases is listed under Staff Management in the sidebar, but for the Mechanic it works like an Operations task — an assignment to go see a vehicle and report back — so it is reviewed here as operational field support.

## Modules Audited

### 1. Dashboard (Default) — Dashboards

- **What it does for Mechanic:** Gives a quick daily snapshot — key metrics, performance, reconditioning progress, and notifications — to see what needs attention before opening the work areas. The Mechanic shares the same base dashboard as other staff; the CEO alone sees one extra Operations Overview panel, which is right for leadership and not needed here. The Mechanic's configured landing page after sign-in is `/inspections`, so this dashboard is a starting point, not the daily landing.
- **Necessary for Mechanic?** Yes — needs one place to spot new inspections or alerts without opening each section first.
- **Workflow:** Appropriate — read-only overview with no extra steps.
- **Recommendation:** Keep — preserve as the daily starting view.

### 2. Vehicles — Operations

- **What it does for Mechanic:** Shows the full vehicle inventory — stock code, make, model, year, condition, and listing state (available, reserved, sold, archived) and pricing status. The Mechanic uses it to see which cars are on the lot, what condition they were logged as, and which ones are tied to an upcoming inspection or field case. This is context before touching a car.
- **Necessary for Mechanic?** Yes, for vehicle condition awareness — needs to know the vehicle history and current state before assessing it, but not to manage the listing itself.
- **Workflow:** Appropriate — view-only for the Mechanic. Only Marketing Specialist can create or edit listings, upload photos or 360-views, and propose a price, and only the CEO can approve a price or permanently delete. The Mechanic is not asked to publish, price, or archive. A toggle between Pending proposals (CEO-only view) and Vehicles is shown, but the Mechanic sees only the vehicle list, which keeps the view simple.
- **Recommendation:** Keep — keep view-only access. No edit or price-proposal permission needed; adding a small filter for "vehicles needing inspection" or "my field-case vehicles" on top would help the Mechanic prioritize, with the full inventory still available on drill-down. Preserve the existing Marketing-owned listing controls.

### 3. Inspections — Operations

- **What it does for Mechanic:** The main workspace. Lists all vehicle inspections with vehicle, stock code, condition score (0–100), findings, recommendation, mechanic, and inspection date, with filters for score, date, and recommendation and a link to each vehicle's detail. On the detail page the Mechanic alone sees the full checklist form — the structured inspection checklist with part-level results and replacements — while other roles see a read-only summary. This is where condition assessment, scoring, findings, and recommendations are recorded.
- **Necessary for Mechanic?** Yes — this is the core responsibility. The Mechanic is the only role that fills the checklist and sets the condition score and recommendation that Sales, Account Manager, and CEO use to decide if a car is ready to sell.
- **Workflow:** Appropriate — focused on assessment, not complex. Table view with search, filters, sorting, pagination, and print, plus a dedicated checklist form on the detail page. The table is detailed but needed to find past inspections; the checklist form is the day-to-day tool. Showing the score with a color bar and clear findings/recommendation keeps the result easy to hand off to Sales and the CEO.
- **Recommendation:** Keep — preserve as the Mechanic's primary tool with the existing Mechanic-only checklist control. No broader permission needed; the checklist should remain restricted to Mechanic, with other roles staying read-only.

### 4. Field Cases — Staff Management (operational in practice)

- **What it does for Mechanic:** Shows field assignments that need technical support — acquisition, delivery, sourcing, and recovery cases — with case kind, state, vehicle, location, schedule, expenses, and notes. The Mechanic is a field worker here, not a creator: used to accept and update cases assigned by a coordinator, log expenses and notes, and move the case through its states (assigned → accepted → completed, etc.).
- **Necessary for Mechanic?** Yes, for field case support (technical) — when a vehicle in the field needs an expert check, the Mechanic is the one who goes, assesses, and reports back. The case list ties the vehicle to the reason it is in the field.
- **Workflow:** Appropriate — assignment and status tracking without requiring the Mechanic to create cases. Mechanic can update assigned cases and log expenses/notes; creating cases and assigning mechanics stays with coordinators. The table supports search and status updates via a dialog. This keeps the Mechanic focused on doing the work, not on creating or assigning work.
- **Recommendation:** Keep — keep update access and assignment-as-worker; no creation or assignment control needed for this role. Preserve the existing flow so coordinators create and assign while the Mechanic executes and reports. A small filter for "assigned to me" on top would help the Mechanic find their cases faster without hiding other cases that need context.

### 5. Announcements — Staff Management

- **What it does for Mechanic:** Displays company-wide announcements that are published and still active (with expiry dates) — policy updates, deadlines, safety notices, or operational changes from leadership. The Mechanic reads them; only the CEO can create drafts, publish, expire, or archive.
- **Necessary for Mechanic?** Yes, for awareness — so inspection schedules, field dispatches, and shop priorities align with company direction and safety policy.
- **Workflow:** Appropriate — view-only. Published items that have not expired are shown; expired items are hidden for non-CEO roles. No creation required for this role.
- **Recommendation:** Keep — keep view-only; no publish needed for the Mechanic. The CEO-owned channel is correct for company-wide communication.

## Overall Recommendations

- **Keep as is:** Dashboard (daily snapshot), Vehicles (view-only inventory for context), Inspections (Mechanic-owned checklist and scoring workspace), Field Cases (worker update access — state, expenses, notes), Announcements (view-only company news)
- **Simplify (show summary first, details on drill-down):** None required. The current set is already minimal and focused; the only small quality-of-life addition to consider is a summary strip or "my items" filter on top of Vehicles ("needs inspection") and Field Cases ("assigned to me") so the Mechanic reaches their work in one click, with full lists still available on drill-down. This is an enhancement, not a needed simplification.
- **Consider for Revision/Removal:** No module is recommended for removal. All five match the Mechanic's scope — vehicle condition assessment, inspections, and technical field support. Any extra module would add clutter and risk; any fewer would break the core job (without Inspections there is no assessment function; without Vehicles there is no vehicle context; without Field Cases there is no field support channel).

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as Mechanic-only checklist editing, Marketing Specialist-only vehicle create/edit/publish and media upload, CEO-only vehicle deletion and price approval, publish-blocked-without-approved-price, pending-proposal visibility limited to CEO, field-case create and mechanic-assignment restricted to coordinators (CEO, Confidential Informant, Sales Manager, and for recovery Head Accountant), and CEO-only announcement publish/expire/archive should be preserved.
- Why this narrow set is correct for Mechanic vs broader roles: The CEO (23 modules) and Account Manager (19) cover finance, transactions, suppliers, field cases, and HR. Mechanic (5 modules) is intentionally not given that breadth. Modules not assigned are appropriately absent: Finance, Transactions, Payroll, Payslips, and Reports belong to Finance and HR; Suppliers and Supplier Messages belong to CEO and Account Manager for supplier management; Inquiries, Recommendations, Content, and Showroom belong to Sales and Marketing Specialist for customer contact and presentation; Roadmap belongs to CEO for strategy; and Staff Records, Attendance, Employee Requests, Security Duty Checks, plus Roles and Users belong to HR, Security, and Admin. The Mechanic should not have access to money movement (Finance, Transactions, Payroll, Payslips), customer money conversations (Inquiries, Transactions), supplier negotiations (Suppliers, Supplier Messages), people management (Staff Records, Attendance, Employee Requests), or security operations (Security Duty Checks) — that separation keeps financial, HR, and supplier decisions independent, prevents the Mechanic from seeing sensitive pay, customer payment, and supplier negotiation data, and limits the role to what it needs: vehicle health and field support.
- Evidence: evaluated 5 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.mechanic` = default, vehicles, inspections, field-cases, announcements; `ROLE_LANDING_PAGES.mechanic` = `/inspections`) and group order from `src/navigation/sidebar/sidebar-items.ts` (Dashboards → Operations → Staff Management, with field-cases functionally in Operations as requested). Spot-checked `src/app/(staff)/dashboard/page.tsx` and `_components/metric-cards.tsx`, `reconditioning-overview.tsx`, `notifications-panel.tsx`, `src/app/(staff)/vehicles/page.tsx` and `_components/vehicle-operations.tsx`, `vehicles-table.tsx`, `price-approvals.tsx`, `src/app/(staff)/inspections/page.tsx` and `[id]/page.tsx` and `_components/inspections-table.tsx`, `inspections-columns.tsx`, `checklist-form.tsx`, `src/app/(staff)/field-cases/page.tsx` and `_components/field-cases-client.tsx` (permissions in code: `canUpdate` includes Mechanic; `canCreate` and `canAssignMechanic` are coordinator-only), `field-cases-table.tsx`, `src/app/(staff)/announcements/page.tsx` and `_components/announcements-client.tsx`. Style reference: `docs/report/REPORT-CEO.md`, `docs/report/REPORT-ACCOUNT_MANAGER.md`, `docs/report/REPORT-HEAD_ACCOUNTANT.md`, `docs/report/REPORT-MARKETING_SPECIALIST.md`, and `docs/report/REPORT-CONFIDENTIAL_INFORMANT.md`. Workflow notes are based on code-level role guards and components, not live user testing — confirm with Mechanic and Operations owners before changing views.
