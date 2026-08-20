# Sales Manager Audit Report

> User Level: Sales Manager - Investigation #7

## Summary

The Sales Manager has access to 11 staff modules — a mid-size, sales-focused set. Compared to the CEO (23 modules) or Account Manager (19), it is narrower than leadership but broader than single-purpose roles such as Marketing Specialist and Mechanic (5 each). Compared to Head Accountant (9) or Confidential Informant (7), Sales Manager sees more of the customer-facing pipeline. The set covers the full sales cycle: what is for sale, how it looks to customers, whether it is ready to sell, who is asking, what to recommend, and how deals close, plus field coordination and basic people awareness.

This focus is appropriate. The Sales Manager owns vehicle sales and deal movement — handling customer inquiries, guiding recommendations, managing transactions, and coordinating field actions when a vehicle must be sourced, acquired, or delivered — not company finance, payroll, supplier management, or security. Staff Records and Announcements are included only for visibility, not for HR management. All 11 modules are necessary at some level; most should stay as they are, with a small number best shown as summary first with detail on drill-down.

Sidebar order is Dashboards (Default) → Operations (Vehicles, Showroom, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Field Cases) → Staff Management (Staff Records, Announcements). Field Cases sits under Staff Management in the sidebar, but for the Sales Manager it works as an Operations task — coordinating people in the field to move a vehicle toward a sale — so it is reviewed here as operational coordination.

## Modules Audited

### 1. Dashboard (Default) — Dashboards
- **What it does for Sales Manager:** Gives a quick daily snapshot — key metrics, performance, reconditioning progress, and notifications — to see what needs attention before opening the sales areas. This is the same base dashboard other staff see; the CEO alone sees one extra operations panel, which is correct for leadership and not needed here. The Sales Manager's landing page after sign-in is `/vehicles`, so this dashboard is the overview, not the daily starting point.
- **Necessary for Sales Manager?** Yes — needs one place to spot open inquiries, transactions, or vehicle alerts without opening each section.
- **Workflow:** Appropriate — read-only overview with no extra steps.
- **Recommendation:** Keep — preserve as the daily overview.

### 2. Vehicles — Operations
- **What it does for Sales Manager:** Shows the full vehicle inventory — stock code, make, model, year, condition, pricing status, and listing state (available, reserved, sold, archived). The Sales Manager uses it to know what is sellable, what is reserved, and what is waiting on price approval or inspection.
- **Necessary for Sales Manager?** Yes — cannot sell without knowing stock, condition, and availability. This is sales context, not listing ownership.
- **Workflow:** Appropriate — view-only for the Sales Manager. Only Marketing Specialist can create or edit listings and upload photos or 360-views, and only the CEO can approve a price or permanently delete. The Sales Manager is not asked to publish, price, or archive, which keeps the view simple. Pending price proposals are shown only to the CEO in code.
- **Recommendation:** Keep — keep view-only. No edit or publish permission needed; a small filter for "available" or "awaiting ready-to-sell" on top would help prioritize, with the full inventory still available on drill-down.

### 3. Showroom (Staff Showroom) — Operations
- **What it does for Sales Manager:** Shows what customers see when browsing — available and reserved vehicles in the shared showroom grid, with a link to "Find Your Car" recommendations. It is the preview of what Sales is selling before a customer asks.
- **Necessary for Sales Manager?** Yes — needed to check presentation, photos, pricing, and availability exactly as a customer will see it, and to catch display issues that block a sale.
- **Workflow:** Appropriate — viewing and checking only. Editing happens in Vehicles (Marketing owns listings and media) and Content (Marketing owns banners). Sales Manager, CEO, and Marketing Specialist share this view, which is correct — each needs to verify the public face.
- **Recommendation:** Keep — keep view-only for Sales Manager; no editing needed here.

### 4. Inspections — Operations
- **What it does for Sales Manager:** Shows mechanic inspection reports for each vehicle — condition score (0–100), findings, recommendation, mechanic, dates, and vehicle links. Used to confirm whether a car is ready to promise to a customer.
- **Necessary for Sales Manager?** Yes — needs confidence that a vehicle meets quality standards before closing a deal or answering a customer about condition.
- **Workflow:** Appropriate — status viewing only. The detailed checklist form is available only to Mechanic; other viewers including Sales Manager see a read-only summary. Table supports search, filters, sorting, and print, which is detailed but needed to find history.
- **Recommendation:** Keep — preserve read-only view; no checklist editing needed for this role.

### 5. Inquiries — Operations
- **What it does for Sales Manager:** The main customer-conversation workspace. Holds inbound questions linked to a vehicle, with chat history, intent, and follow-up status. In code, the Sales Manager sees only buy-intent inquiries (`intention_kind = buy_now` filtered), while CEO and Account Manager see all kinds.
- **Necessary for Sales Manager?** Yes — this is a core responsibility. The Sales Manager is a primary responder alongside the Account Manager for turning interest into a transaction.
- **Workflow:** Appropriate — filtered chat with reply, handoff, and unread counts. Volume is the only pressure point; the buy-now filter already narrows the list correctly for Sales.
- **Recommendation:** Keep — keep response access with the existing buy-now filter. Consider a "my assigned" or "needs reply" view on top to reduce scanning, with the full filtered list still available on drill-down.

### 6. Recommendations — Operations
- **What it does for Sales Manager:** Displays recommendations and insights — sales overview, market activity, inventory allocation, inventory status, and top vehicles — to match customers to available stock and explain demand trends.
- **Necessary for Sales Manager?** Yes — helps guide what to offer next, which vehicles to push, and where demand is moving.
- **Workflow:** Appropriate — overview dashboards, not daily editing. Read-only insights that support sales decisions without adding steps to the deal flow.
- **Recommendation:** Keep — preserve as an insight and matching aid; no edit needed.

### 7. Transactions — Operations
- **What it does for Sales Manager:** Tracks all customer purchase, sell, and request-a-car transactions with state, vehicle, customer, and kind, plus a summary bar at the top (pending, under review, completed, buy, sell, requests over the last 4 weeks). Used to move deals forward and resolve issues.
- **Necessary for Sales Manager?** Yes — this is the central deal pipeline. Sales Manager coordinates deal progression and customer follow-up here.
- **Workflow:** Appropriate — filtering by state and full history supports both daily handling and audit. Sales Manager sees the same table as CEO, Account Manager, Head Accountant, and Confidential Informant; daily state handling is shared with Account Manager and CEO.
- **Recommendation:** Keep — keep full coordination view and state handling. Consider keeping the summary bar at the top (pending, under review…) as the summary top and the full table behind filters, which is already the pattern.

### 8. Roadmap — Operations
- **What it does for Sales Manager:** Shows company plans, projects, performance highlights, and upcoming milestones — strategy and timing at a glance.
- **Necessary for Sales Manager?** Yes, for awareness — so sales timing, promotions, and sourcing work align with company direction.
- **Workflow:** Appropriate — view-only for Sales Manager. Only the CEO can create or edit roadmap items, which is correct; Sales should not own strategy, only see it.
- **Recommendation:** Keep — keep read-only access; no edit needed for this role.

### 9. Field Cases — Operations (Staff Management in sidebar, operational in practice)
- **What it does for Sales Manager:** Coordination workspace for off-site work — acquisition, delivery, and sourcing cases — with kind, state, vehicle, location, schedule, expenses, and notes. Sales Manager is a coordinator here: creates cases when a vehicle must be acquired, sourced, or delivered, assigns field workers, and tracks progress through states (assigned → accepted → completed).
- **Necessary for Sales Manager?** Yes, for field case coordination — links the sales promise to the field action that fulfills it (going to get a car, bringing a car to a customer, or sourcing one that is not on the lot). Without this, deals that need field movement would stall.
- **Workflow:** Appropriate and well-scoped — Sales Manager can create and update acquisition, delivery and sourcing cases and assign mechanics; recovery case creation stays with Head Accountant and CEO. Informants and mechanics are selectable as workers. This keeps Sales as coordinator, not just observer.
- **Recommendation:** Keep — preserve create, update, and mechanic-assignment access. No recovery-case creation needed for this role; that boundary should stay. A small filter for "my created" or "needs assignment" on top would help prioritize, with the full list available on drill-down.

### 10. Staff Records — Staff Management
- **What it does for Sales Manager:** Holds staff and customer account profiles, work schedules, and performance reviews — who is on the team, their role, account state, schedule, and review history. Tabs for Staff and Reviews; walk-in registration is available.
- **Necessary for Sales Manager?** Yes, but only for visibility — needs to know who is on the sales and support team, schedules, and basic people context to staff deals and field tasks. Not needed for HR decisions.
- **Workflow:** Appropriate for viewing, but sensitive. All three allowed roles (CEO, Account Manager, Sales Manager) can view profiles and reviews, but only CEO and Account Manager can create and manage reviews; Sales Manager sees reviews read-only, which is correct. The full account list is broad; showing summary by default reduces clutter.
- **Recommendation:** Keep — keep view-only for Sales Manager; do not add review-create or edit permission. Show summary performance by default and keep detailed reviews behind a drill-down. Preserve the existing CEO and Account Manager as review owners.

### 11. Announcements — Staff Management
- **What it does for Sales Manager:** Displays company-wide announcements that are published and still active (with expiry dates) — policy updates, deadlines, sales priorities, or operational notices from leadership.
- **Necessary for Sales Manager?** Yes, for awareness — so customer messaging, deal timing, and field schedules align with company direction, pay dates, or policy changes.
- **Workflow:** Appropriate — view-only. Only the CEO can create drafts, publish, expire, or archive. Other staff including Sales Manager see only published items that have not expired.
- **Recommendation:** Keep — keep view-only; no publish needed for this role. The CEO-owned channel is correct for company-wide communication.

## Overall Recommendations

- **Keep as is:** Dashboard (daily overview), Vehicles (view-only inventory for sales context), Showroom (customer-view preview), Inspections (read-only quality check), Inquiries (buy-now filtered response workspace), Recommendations (insight and matching aid), Transactions (deal pipeline coordination), Roadmap (read-only strategy awareness), Field Cases (coordinator create, update, and mechanic assignment for acquisition, delivery, and sourcing), Staff Records (view-only team visibility), Announcements (view-only company news)
- **Simplify (show summary first, details on drill-down):** Consider lightweight summary strips or "my items" filters on top of Vehicles ("available" or "ready to sell"), Inquiries ("needs reply" within buy-now), Field Cases ("my created" or "needs assignment"), and Staff Records (summary performance by default) — all with full lists still available on drill-down. These are quality-of-life enhancements, not required simplifications; the current views are already appropriately scoped.
- **Consider for Revision/Removal:** No module is recommended for removal. All 11 match the Sales Manager's scope — vehicle sales, customer inquiries, recommendations, transaction handling, field case coordination, and basic staff visibility. Any extra module would add clutter or expose sensitive areas; any fewer would break the sales cycle (without Inquiries and Transactions there is no deal flow; without Vehicles, Showroom, and Inspections there is no product context; without Recommendations there is no guided matching; without Field Cases there is no fulfillment path for off-site moves).

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as Marketing Specialist-only vehicle create/edit and media upload, CEO-only price approval and vehicle deletion, Mechanic-only inspection checklist editing, buy-now inquiry filter for Sales Manager, CEO-only roadmap write, field-case kind rules (acquisition and delivery for CEO, Confidential Informant, and Sales Manager; sourcing for CEO and Sales Manager; recovery reserved for CEO and Head Accountant), mechanic-assignment limited to CEO, Confidential Informant, and Sales Manager, staff-review management limited to CEO and Account Manager, and CEO-only announcement publish and expiry should be preserved when adding summaries or filters.
- Why this set is appropriate and what is intentionally excluded: The Sales Manager set is mid-breadth by design — focused on selling, not on running the whole business. The CEO (23 modules) and Account Manager (19) cover everything from finance to supplier management to HR and admin. Sales Manager (11) is deliberately not given that breadth. Modules not assigned are appropriately absent: Finance, Payroll, Payslips, and Reports belong to Head Accountant and CEO for money movement and staff cost; Suppliers and Supplier Messages belong to CEO and Account Manager for supplier onboarding and negotiation; Content belongs to Marketing Specialist for public banners and featured picks; Attendance and Employee Requests belong to Account Manager, CEO, and Head of Security for people operations; Security Duty Checks belongs to Head of Security for guard rounds; and Roles and Users belong to CEO (with delegated user management to Account Manager) for admin access control. This separation keeps financial, HR, supplier, marketing, and security decisions independent, prevents Sales from seeing sensitive pay, supplier negotiation, and security data, and limits the role to what it needs: product, customer, deal, and field coordination.
- Evidence: evaluated 11 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.sales_manager` = default, vehicles, showroom, inspections, inquiries, recommendations, transactions, roadmap, field-cases, staff-records, announcements; `ROLE_LANDING_PAGES.sales_manager` = `/vehicles`) and group order from `src/navigation/sidebar/sidebar-items.ts` (Dashboards → Operations → Staff Management, with field-cases functionally in Operations as requested). Spot-checked `src/app/(staff)/dashboard/page.tsx`, `src/app/(staff)/vehicles/page.tsx` and `_components/vehicle-operations.tsx`, `src/app/(staff)/staff-showroom/page.tsx`, `src/app/(staff)/inspections/page.tsx` and `_components/inspections-table.tsx`, `src/app/(staff)/inquiries/page.tsx` and `_components/staff-inquiry-chat.tsx` (buy-now filter for Sales Manager), `src/app/(staff)/staff-recommendations/page.tsx` and `_components/kpi-strip.tsx`, `sales-overview.tsx`, `inventory-allocation.tsx`, `src/app/(staff)/transactions/page.tsx` and `_components/transactions-kpi-strip.tsx`, `src/app/(staff)/roadmap/page.tsx` and `_components/roadmap-dashboard-shell.tsx` (write limited to CEO), `src/app/(staff)/field-cases/page.tsx` and `_components/field-cases-client.tsx` (kind rules and canCreate, canUpdate, canAssignMechanic), `src/app/(staff)/staff-records/page.tsx` and `_components/staff-table/table.tsx`, `performance-reviews.tsx` (canManage limited to CEO and Account Manager), and `src/app/(staff)/announcements/page.tsx`. Style reference: `docs/report/REPORT-CEO.md`, `docs/report/REPORT-MARKETING_SPECIALIST.md`, `docs/report/REPORT-MECHANIC.md`, `docs/report/REPORT-HEAD_ACCOUNTANT.md`, `docs/report/REPORT-ACCOUNT_MANAGER.md`, and `docs/report/REPORT-CONFIDENTIAL_INFORMANT.md`. Workflow notes are based on code-level role guards and components, not live user testing — confirm with Sales Manager and Operations owners before changing views.
