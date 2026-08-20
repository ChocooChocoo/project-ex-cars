# Supplier Audit Report

> User Level: Supplier - Investigation #10

## Summary

The Supplier currently has access to 7 modules — all under Customer Portal, identical to the Customer: Showroom, Find Your Car, My Inquiries, Transactions, Request a Car, Sell Vehicle, and Favourites. Compared to the CEO (23 staff modules) or Account Manager (19), this is a narrow, shopping-focused set. That set is correct for a Customer, but not for a Supplier.

The Supplier's job is to supply — register as a supplier, provide valid IDs, wait for approval, and communicate with GCE about supply — not to shop as a private buyer. The system already has supplier-specific data and tools that the Supplier cannot see from the Customer Portal — their own supplier profile and approval state, ID uploads and verification status, and direct chat with GCE. The dedicated staff tools for handling suppliers and supplier messages exist but neither is assigned to the Supplier in the navigation. As a result, the current sharing of the Customer Portal is not appropriate — it gives the Supplier shopping tools they rarely need and hides the supply tools they do need.

Most of the 7 shopping modules are not necessary for supply work; two are actively confusing (they mix customer buying with supplier supplying). None should be kept as the Supplier's primary workspace. The correct fix is not to add more Customer tools, but to provide a small dedicated Supplier view — own profile, document status, and messages — and remove or hide the shopping set. No code has been changed here; all notes below are suggestions.

Sidebar order today is Customer Portal (Showroom → Find Your Car → My Inquiries → Transactions → Request a Car → Sell Vehicle → Favourites). The configured landing page after sign-in is the showroom browsing page, which is browsing-first — correct for a Customer, but not for a Supplier waiting on approval or documents.

## Modules Audited

### 1. Showroom — Customer Portal (shared with Customer)

- **What it does for Supplier:** Same as Customer — a card grid of available and reserved vehicles with photo, make/model/year, price (fixed/negotiable), mileage/fuel/transmission, offer badge, search, make filter, and sorting. Each card opens a detail page with photos/360-views, specs, price, warranty, and Inquiry/Buy buttons. Heart button saves to Favourites.
- **Necessary for Supplier?** No, for supply work. It lets a Supplier browse as if they were a private buyer, but it does not show their supplier profile, document status, or supply requests. A Supplier who also wants to buy a personal car could use it, but that is a second role, not the supply role.
- **Workflow:** Appropriate for shopping — familiar grid, instant filtering, clear detail page. For supply, it is off-purpose and may confuse "I am here to supply" vs "I am here to buy."
- **Recommendation:** Consider for Revision — do not keep as the Supplier landing view. If browsing is kept at all, keep it as a secondary "Market View" behind the Supplier workspace, not the default. The Supplier landing after sign-in should be supply-related (profile / documents / messages), not the showroom browsing page.

### 2. Find Your Car (Recommendations) — Customer Portal

- **What it does for Supplier:** Same guided helper as Customer — enter a budget (₱50k–₱5M slider plus number input) and optional filters (condition, fuel, make, body type), tap "Get Recommendations," receive a ranked list scored on five criteria with percentage badges.
- **Necessary for Supplier?** No — this helps a private buyer narrow a purchase. It has no link to supplying, sourcing, or fulfilment. A Supplier does not need a personal-buying ranking to do their job.
- **Workflow:** Appropriate for a buyer (short form, one submit, ranked results), but extra steps and clutter for a Supplier.
- **Recommendation:** Consider for Removal — remove from Supplier access. It adds noise without supply value and blurs Customer vs Supplier intent.

### 3. My Inquiries — Customer Portal

- **What it does for Supplier:** Same as Customer — an inbox of your own buying chats about vehicles, with a chat thread, message history, attachments, and scheduled viewings. Creating an inquiry starts from the Showroom detail (Inquiry/Buy buttons).
- **Necessary for Supplier?** No, as the supply channel. Supplier-to-GCE communication is not via that buying inbox; it is via a separate direct chat with GCE for approved suppliers. Keeping My Inquiries gives the Supplier a Customer-style chat about buying, not a supply channel, and risks mixing two separate inboxes.
- **Workflow:** Appropriate for Customer chat (list on left, thread on right, file upload), but the wrong channel for supply. A Supplier with a supply question would land in the wrong place.
- **Recommendation:** Consider for Removal — replace with Supplier Messages for supply conversations. If a Supplier is also a Customer (personal buying), that should be a distinct mode, not the same inbox.

### 4. Transactions — Customer Portal

- **What it does for Supplier:** Same as Customer — a combined history of customer purchase flows such as buying, selling, and requesting a car, showing only your own past activity with search, filters, sorting, and a detail view for each transaction including price, arrangement, and document uploads.
- **Necessary for Supplier?** No, for supply tracking. A Supplier's history as a Customer is usually empty, and supply-related records are not tracked as customer purchases. Showing this list to a Supplier suggests they should track personal shopping to understand their supply status, which is incorrect.
- **Workflow:** Appropriate for Customer tracking, but potentially complex for anyone — a buy requires several steps (payment details, arrangement schedule/location, ID upload) shown without a clear progress guide. For a Supplier, that complexity is also misdirected.
- **Recommendation:** Consider for Removal — do not show Customer Transactions to Suppliers. Supply progress should be shown in a Supplier view (profile state and document verification), not in a Customer buy/sell table.

### 5. Request a Car — Customer Portal

- **What it does for Supplier:** Same as Customer — a short form (make, model required; year min/max, budget in pesos required; other preferences free-text) that creates a customer sourcing request shown in Transactions.
- **Necessary for Supplier?** No — this is a Customer asking GCE to source a car. The Supplier is the source, not the requester. Keeping it reverses the role.
- **Workflow:** Appropriate for a Customer sourcing request (concise, validated, success redirect to the new transaction), but no supply action for a Supplier.
- **Recommendation:** Consider for Removal — remove from Supplier access. If GCE later wants Suppliers to receive sourcing requests, that should be a dedicated inbound request in the Supplier portal, not the Customer outbound form.

### 6. Sell Vehicle — Customer Portal

- **What it does for Supplier:** Same as Customer — a short form (make, model, year, mileage, condition free-text, offered amount in pesos, optional description) that creates a customer sell request with a draft vehicle for staff review (mechanic inspection and sales review on the staff side).
- **Necessary for Supplier?** Partially, but not as designed. It looks supplier-like (offer a car to GCE), yet it is a one-off customer sale, not the formal supplier onboarding which moves through invitation and approval and requires two primary IDs to be approved. A Supplier who is already approved should not need to re-sell via a customer form.
- **Workflow:** Appropriate for a Customer one-off sale (single page, 6 required fields, numeric validation, success redirect). For an approved Supplier, it is lightweight to the point of being insufficient — no link to their supplier record, no document checklist, no way to track verification.
- **Recommendation:** Simplify — do not rely on Sell Vehicle as the Supplier channel. Keep the Customer Sell Vehicle only for personal one-off sales (if the Supplier as a person wants to sell a personal car), but direct supply work through a Supplier profile view that shows approval state and document verification. Consider replacing the free-text Condition with a dropdown if the form is kept, to match staff terms and reduce back-and-forth — same small wording improvement noted for Customers.

### 7. Favourites — Customer Portal

- **What it does for Supplier:** Same as Customer — the shortlist saved via the heart button in Showroom/detail, shown in the same card grid with a header count ("You have 3 saved vehicles" / "You haven't saved any yet") and immediate save/unsave feedback.
- **Necessary for Supplier?** No — pure shopping convenience for comparing personal purchases.
- **Workflow:** Appropriate for shopping (one click, instant feedback, clear empty state), but no supply purpose.
- **Recommendation:** Consider for Removal — remove from Supplier access.

## Appendix: Missing Supplier Tools (Informational — not a Customer module)

This is the missing piece. Today the Supplier sees the same 7 Customer Portal items as a Customer. The two staff tools that actually handle supply are not in that set:

- **Suppliers** — staff list of all suppliers: create supplier, upload documents, verify documents, and approve or reject (requires two primary IDs to be approved). Only senior staff can open this list. The full management view should not be given to Suppliers — they should not see other suppliers' records or verification controls.
- **Supplier Messages** — chat threads between an approved linked supplier and GCE, with live updates. Only GCE and the approved supplier can open the conversation; each supplier sees only their own thread. Sending is limited to approved suppliers and GCE.

**Is current assignment appropriate?** No — needs revision. The current sharing hides the Supplier's actual tools and shows the wrong ones. Evidence in plain terms:

- Suppliers must be approved before they can sign in — otherwise they see a pending or no-record message. Approval depends on document verification, yet the Supplier has no navigation to see their own profile or document checklist. That data exists but is not visible to them.
- Supplier Messages is already built but not in the sidebar — you can only open it by typing the address, which is undiscoverable.

**What should the Supplier have instead?** A small dedicated Supplier view (not the shopping portal, not the full staff Suppliers page):

- Own supplier profile — business name, kind (company or individual), contact, approval state, and approved or rejected date.
- Own document status — list of the supplier's documents, each with type, whether it is a primary ID, check status, and how many of the required two primary IDs are approved.
- Supplier Messages — the existing thread for that supplier.

This keeps the boundary correct: Suppliers see only their own record and messages, not all suppliers, not other verification queues. Staff keep full management (create, upload on behalf, verify, approve).

## Overall Recommendations

- **Keep as is:** None of the 7 Customer Portal modules need to be kept as the Supplier's primary workspace. The only staff tool that should be kept for Supplier is Supplier Messages — but it must be made discoverable in the Supplier sidebar (currently it can be opened directly but has no menu entry).
- **Simplify (show summary first, details on drill-down):** If any shopping module is retained for Suppliers who also buy personally, hide it behind a secondary "Personal (buy/sell as Customer)" section with a clear label, so shopping does not look like supply work. The primary Supplier view should show a plain summary strip first — approval state, document progress (e.g., "2 of 2 primary IDs verified"), and an inbox badge — with detail on drill-down.
- **Consider for Revision/Removal:**
  - Remove from Supplier: Find Your Car, Favourites, Request a Car, Transactions, and My Inquiries (all pure Customer shopping/tracking). These add clutter and misdirect supply inquiries to the wrong place.
  - Revise: Showroom — remove as landing; keep only as optional Market View, not the default. Sell Vehicle — do not use as the supply channel; keep only for personal one-off sale if needed, while supply uses the Supplier profile and documents flow.
  - Do not give Supplier the full staff Suppliers page — that is correctly staff-only. Instead provide a new Supplier-scoped view: own supplier record plus own documents and messages.
- **Dedicated Supplier view needed (vs. current portal sharing):** Replace the current sharing where Supplier sees the same as Customer with a minimal Supplier portal. The current mirroring is not appropriate. Proposed Supplier navigation: My Supplier Profile, My Documents (with verification progress and two primary IDs checklist), and Messages with GCE. Keep the landing page aligned — change from the showroom browsing page to the Supplier overview (once the portal exists) so a Supplier who is pending approval immediately understands what is blocking them, with shopping as an opt-in secondary area.
- **No deletion of functionality implied:** All suggestions preserve existing controls — approvals still require two approved primary IDs, document status checks remain, Supplier Messages remain limited to the linked approved supplier and GCE, private document storage remains with size and type limits, and audit events are kept. Suggestions are navigation and visibility changes only.

## Notes

- All recommendations are suggestions only — no functionality has been removed. Controls such as supplier sign-in requiring an `approved` supplier row (`src/app/auth/actions.ts` `signIn()`), staff-only supplier creation/approval/verification (`createSupplier`, `approveSupplier`, `uploadSupplierDocument`, `verifySupplierDocument` restricted to `ceo` / `account_manager` / `head_accountant` as coded), document verification states, storage bucket `supplier-documents` (private, 5 MB, jpeg/png/webp/pdf), and RLS/route guards on `suppliers`, `supplier_documents`, and `supplier_messages` (including realtime on `supplier_messages`) should be preserved.
- Why the 7 Customer modules are not the Supplier's scope — correct separation: Finance, Vehicles staff inventory, Content, Inspections, Recommendations/Transactions staff coordination views, Roadmap, Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Security Duty Checks, Reports, Announcements creation, Roles, and Users are all intentionally not assigned to Supplier — that block is correct. What is incorrect is that the Customer set (shopping, personal requests, personal records) was copied to Supplier instead of the Supplier set (own profile, own documents, messages). Fixing that copy is the main revision.
- Workflow complexity for Supplier: No shopping form is complex on its own, but the overall experience is confusing — a Supplier who just needs to know "Am I approved? Are my two IDs verified? How do I contact GCE?" lands in a showroom with no answer. The right simplification is not to simplify the shopping forms, but to show supply status first and keep shopping separate.
- Technical traceability for plain-language bodies (moved from Summary/Modules/Overall): `suppliers` (own profile and approval state), `supplier_documents` (ID uploads and verification), `supplier_messages` (direct chat with CEO), `inquiries`/`inquiry_messages` where `customer_id = auth.uid()` for My Inquiries, customer transactions `buy`/`sell`/`request_a_car` where `customer_id = auth.uid()` for Transactions, `ROLE_NAV_ACCESS.supplier` identical to `ROLE_NAV_ACCESS.customer` (7 items) and `ROLE_LANDING_PAGES.supplier = /showroom` from `src/lib/auth/roles.ts` and `src/navigation/sidebar/sidebar-items.ts`, supplier link `suppliers.account_id = auth.uid() and state='approved'`, page-guarded Supplier Messages via `supplierMessageSchema` with server check `supplier.state === 'approved'`, RLS and realtime on `supplier_messages`, `src/app/auth/actions.ts` `signIn()` approval gate, `ACCEPTED_ID_TYPES` and verification states pending/verified/rejected, and storage bucket `supplier-documents` (see Evidence for file paths).
- Evidence: evaluated 7 modules from `src/lib/auth/roles.ts` (`ROLE_NAV_ACCESS.supplier` = `cust-showroom`, `cust-recommendations`, `cust-inquiries`, `cust-transactions`, `cust-request-car`, `cust-sell-vehicle`, `cust-favourites` — identical to `customer`; `ROLE_LANDING_PAGES.supplier` = `/showroom`; supplier states `invited`/`registered`/`pending_approval`/`approved`/`rejected`/`suspended`, `DOCUMENT_VERIFICATION_STATES` pending/verified/rejected) and group order from `src/navigation/sidebar/sidebar-items.ts` (Customer Portal, 7 items: Showroom `/showroom` → Find Your Car `/recommendations` → My Inquiries `/my-inquiries` → Transactions `/my-transactions` → Request a Car `/request-a-car` → Sell Vehicle `/sell-vehicle` → Favourites `/favourites`; Operations `suppliers` `/suppliers`; Staff Management `supplier-messages` `/supplier-messages`). Spot-checked `src/app/(customer)/layout.tsx`, `showroom/page.tsx` and `showroom/_components/showroom-grid.tsx`, `recommendations/page.tsx`, `my-inquiries/page.tsx`, `my-transactions/page.tsx` and `my-transactions/_components/transactions-view.tsx`, `request-a-car/page.tsx` and `_components/request-car-form.tsx`, `sell-vehicle/page.tsx` and `_components/sell-vehicle-form.tsx`, `favourites/page.tsx` (all share the Customer implementation), `src/app/(staff)/suppliers/page.tsx` (`ceo`/`account_manager` only) and `_components/supplier-admin.tsx` (create, docs, verify, approve), `src/app/(staff)/supplier-messages/page.tsx` (`ceo`/`supplier` only, `ownSupplierId` scoping) and `_components/supplier-message-thread.tsx` and `actions.ts` (`supplierMessageSchema`), `src/app/auth/actions.ts` (`signIn` supplier approval gate, `createSupplier`/`approveSupplier`/`uploadSupplierDocument`/`verifySupplierDocument`), and `supabase/migrations/00001_phase1_schema.sql` (`suppliers`, `supplier_documents`), `00019_phase6_supplier_messages.sql` (`supplier_messages` RLS + realtime), `00024_audit_supplier_onboarding.sql` (`supplier-documents` bucket + RLS). Style reference: `docs/report/REPORT-CEO.md` (23 staff modules) and `docs/report/REPORT-CUSTOMER.md` (7 Customer Portal modules, Investigation #9). Workflow notes are based on code-level routes, components, and validation, not live user testing — confirm the dedicated Supplier view and navigation changes (especially removing shopping set from default vs. keeping an optional Market View) with the CEO/Account Manager and a sample Supplier before changing access.
