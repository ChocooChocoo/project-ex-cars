# Marketing Specialist Audit Report

> User Level: Marketing Specialist - Investigation #5

## Summary

The Marketing Specialist has access to 5 staff modules — the smallest focused set in the system alongside Mechanic. Compared to the CEO (23 modules) or Account Manager (19), this role is deliberately narrow: one dashboard, three operations tools for presenting vehicles, and one view-only channel for company news. This focus is correct. Marketing's job is to create and showcase vehicles and content — not to handle money, payroll, customer transactions, or staff management — so the system keeps the role on showroom presentation, vehicle showcasing, and marketing content while blocking sensitive finance and HR areas.

All 5 modules are necessary; none should be removed. Four are core working tools that should stay as they are. The fifth, Announcements, is correctly view-only.

## Modules Audited

### 1. Dashboard (Default) — Dashboards
- **What it does for Marketing Specialist:** Gives a quick daily snapshot — key metrics, performance, reconditioning progress, and notifications — to see what needs attention before opening the work areas.
- **Necessary for Marketing Specialist?** Yes — needs one starting point without opening each section to know what to prioritize. Marketing lands here first, then moves to Vehicles (the configured landing page for this role is `/vehicles`).
- **Workflow:** Appropriate — read-only overview with no extra steps. Same base dashboard as other staff; the CEO sees one extra operations panel, which is right for leadership and not needed here.
- **Recommendation:** Keep — preserve as the daily starting view.

### 2. Vehicles — Operations
- **What it does for Marketing Specialist:** The main workspace. Manages the full vehicle inventory — stock code, make, model, year, condition, pricing, photos and 360-views, and listing state (draft, inspecting, awaiting approval, available, reserved, sold, archived). This is where listings are created, edited, and published to the showroom.
- **Necessary for Marketing Specialist?** Yes — this is the core responsibility. Marketing is the only role that can create and edit listings, upload or delete showroom media, propose a price for approval, publish an approved vehicle, and archive listings. No other specialist has this breadth in Vehicles.
- **Workflow:** Appropriate — detailed but correctly controlled. Marketing does the day-to-day listing work, but with guardrails: a price proposal must be approved by the CEO before publishing, a pending proposal blocks duplicate proposals, reserved/sold/awaiting-approval vehicles cannot be archived, and only the CEO can permanently delete. This prevents self-approval and protects sold stock while leaving creative control with Marketing.
- **Recommendation:** Keep — keep Marketing as the listing owner with the existing CEO approval gate. No broader permission needed; the publish-requires-approved-price rule should be preserved.

### 3. Showroom (Staff Showroom) — Operations
- **What it does for Marketing Specialist:** Shows what customers see when browsing — available and reserved vehicles in a shared showroom grid, with a quick link to "Find Your Car" recommendations. It is the preview of Marketing's work before customers see it.
- **Necessary for Marketing Specialist?** Yes — needed to check presentation, photos, and pricing exactly as a customer will see it, and to catch display issues before they affect sales.
- **Workflow:** Appropriate — viewing and checking, not complex. No editing here; editing happens in Vehicles and Content. Marketing, CEO, and Sales Manager share this view, which is right — each needs to verify the public face.
- **Recommendation:** Keep — keep view-only for Marketing. Editing can stay in Vehicles (for listing data and media) and Content (for banners and featured picks).

### 4. Content — Operations
- **What it does for Marketing Specialist:** Stores and publishes marketing content for the public site — banners, promotions, hero sections, and featured vehicle picks. Supports creating a new item (type, title, body, linked vehicle for featured picks), editing, deleting, and publishing to make it live.
- **Necessary for Marketing Specialist?** Yes — this is the other core responsibility alongside Vehicles. Marketing is the sole manager; the CEO can view but cannot create, edit, delete, or publish here. That gives Marketing clear ownership of what the public sees.
- **Workflow:** Appropriate — simple create → edit → publish flow. Types are limited to hero, promotion, and featured vehicle, and publishing is a one-click action with immediate feedback. Delete asks for confirmation.
- **Recommendation:** Keep — preserve Marketing as the only create/edit/publish owner. No change needed; the CEO's read-only view provides oversight without interfering with daily creation.

### 5. Announcements — Staff Management
- **What it does for Marketing Specialist:** Displays company-wide announcements that are published and still active (with expiry dates) — policy updates, deadlines, or operational notices from leadership.
- **Necessary for Marketing Specialist?** Yes, for awareness — so campaign timing, showroom updates, and vehicle publishing align with company direction, pay dates, or policy changes.
- **Workflow:** Appropriate — view-only. Only the CEO can create drafts, publish, expire, or archive. Other staff, including Marketing, see only published items that have not expired.
- **Recommendation:** Keep — keep view-only; no publish needed for this role. The CEO-owned channel is correct for company-wide communication.

## Overall Recommendations

- **Keep as is:** Dashboard (daily snapshot), Vehicles (Marketing-owned listing workspace with CEO price-approval gate), Showroom (customer-view preview), Content (Marketing-owned banners and featured picks), Announcements (view-only company news)
- **Simplify (show summary first, details on drill-down):** None recommended. The current set is already minimal and focused; adding summaries is not needed for these five.
- **Consider for Revision/Removal:** No module is recommended for removal. All five match the Marketing Specialist's scope — marketing content creation, showroom presentation, and vehicle showcasing. Any extra module would add clutter and risk; any fewer would break the core job (without Vehicles and Content, there is no marketing function; without Showroom, no way to verify the public view).

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as CEO-only price approval and vehicle deletion, publish-blocked-without-approved-price, pending-proposal guard, archive protection for reserved/sold stock, storage-backed media upload with display order, and CEO-only announcement publish/expire/archive should be preserved.
- Why this narrow set is correct for Marketing Specialist vs broader roles: The CEO (23 modules) and Account Manager (19) cover finance, transactions, suppliers, field cases, and HR. Marketing Specialist (5 modules) is intentionally not given that breadth. Modules not assigned are appropriately absent: Finance, Transactions, Roadmap, Reports, Payroll, Payslips, Attendance, Employee Requests, Staff Records, Field Cases, Security Duty Checks, Suppliers, Supplier Messages, Inspections, Inquiries, Recommendations, Roles, and Users all belong to Finance, Sales, Account Management, Mechanic, HR, or Security. Marketing should not have access to money movement (Finance, Transactions, Payroll, Payslips), customer money conversations (Inquiries, Transactions), supplier negotiations (Suppliers, Supplier Messages), people management (Staff Records, Attendance, Employee Requests), or field/security work (Field Cases, Security Duty Checks, Inspections) — that separation keeps financial, HR, and supplier decisions independent and prevents marketing from seeing sensitive pay and customer payment data.
- Evidence: evaluated 5 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.marketing_specialist` = default, vehicles, showroom, content, announcements) and group order from `src/navigation/sidebar/sidebar-items.ts` (Dashboards → Operations → Staff Management). Landing page verified as `ROLE_LANDING_PAGES.marketing_specialist` = `/vehicles`. Spot-checked `src/app/(staff)/dashboard/page.tsx` and `_components/*`, `src/app/(staff)/vehicles/page.tsx` and `_components/vehicle-operations.tsx`, `vehicles-table.tsx`, `vehicles-columns.tsx`, `vehicle-form.tsx`, `price-approvals.tsx` and `actions.ts` (createVehicle, updateVehicle, publishVehicle, proposePrice, approvePrice, uploadVehicleMedia, archiveVehicle, deleteVehicle, create/update/delete/publishContent), `src/app/(staff)/staff-showroom/page.tsx`, `src/app/(staff)/content/page.tsx` and `_components/content-manager.tsx`, and `src/app/(staff)/announcements/page.tsx` and `_components/announcements-client.tsx`. Style reference: `docs/report/REPORT-CEO.md`, `docs/report/REPORT-HEAD_ACCOUNTANT.md`, `docs/report/REPORT-ACCOUNT_MANAGER.md`, and `docs/report/REPORT-CONFIDENTIAL_INFORMANT.md`. Workflow notes are based on code-level role guards and components, not live user testing — confirm with Marketing and CEO owners before changing views.
