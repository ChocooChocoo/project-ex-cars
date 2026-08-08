# 08 - ROADMAP TRACKER

[Back to start](00%20-%20START%20HERE.md) · Previous: [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md) · Next: [09 - TASK TRACKER](09%20-%20TASK%20TRACKER.md)

**Last checked:** 8 August 2026

## Where everything stands

| Status | How many |
|---:|---|
| ✅ Finished | 26 |
| 🟨 Being worked on | 3 |
| ⭕ Not started | 0 |
| ❌ Blocked | 0 |
| 🔵 Already there | 0 |
| ⬜ Dropped | 0 |
| ❓ Unclear | 12 |
| **Total** | **41** |

Phases 1–5 completed. Phase 5 completed 8 August 2026. R-07 (360° viewer) remains placeholder; R-28/R-29 remain in-progress spanning later phases.

## Phase 1 — One shared foundation

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-01 | Registration, sign-in, email and phone checks, customer profiles, identification upload, and Sales Manager creation of walk-in buyer and seller accounts | ✅ | Auth forms connected to Supabase; profile auto-creation via database trigger; customer document upload server action; walk-in account creation via admin client. |
| R-02 | Role-based access for the customer, the supplier, and the eight operational roles, managed by the Account Manager | ✅ | All 10 roles in `src/lib/auth/roles.ts`; RLS policies per table; role assignment RPC; RBAC page at /dashboard/roles; middleware; role-based sidebar filtering and landing pages. |
| R-03 | One shared record foundation with consistent customer, vehicle, conversation, transaction, inspection, and staff information | ✅ | Phase 1 migration executed. All 6 tables (profiles, private.user_roles, customer_documents, audit_events, suppliers, supplier_documents) live with RLS. |
| R-27 | Supplier registration and account management with staff-created accounts, Company or Individual, two primary valid IDs, and approval before sign-in | ✅ | suppliers and supplier_documents tables with RLS; createSupplier and approveSupplier server actions; controlled states. |
| R-28 | Field checks on every form for numbers, lengths, kinds of information, required fields, and formats | 🟨 | Zod schemas in src/lib/validation/forms.ts; applied in auth forms. Remaining per-form integration spans later phases. |
| R-29 | Automatic filling of forms from details already held | 🟨 | getProfileAutoFill() utility in src/lib/autofill/; needs integration in later phases. |

## Phase 2 — Vehicles can be found and understood

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-04 | Live vehicle inventory with make, model, year, price, condition, mileage, fuel, and availability | ✅ | CRUD at /dashboard/vehicles with TanStack table, search, filter, pagination; vehicle form. |
| R-05 | Mechanic inspection reports with condition score, photographs, notes, and repair progress | ✅ | /dashboard/inspections with nested checklist form; repairs table with status tracking. |
| R-06 | Browse, search, filters, vehicle details, and saved favourites | ✅ | Public showroom at /showroom with search, filter, sort, card grid, detail page; favourites toggle action. |
| R-07 | 360-degree vehicle viewing limited to the active vehicle | 🟨 | Media table and upload action exist. 360° viewer is placeholder — requires format decisions. |
| R-08 | Landing-page content, promotions, featured vehicles, and chief-executive approval of a proposed price before posting | ✅ | /dashboard/content CRUD with publish; price proposal flow (Marketing→CEO) via server actions. |
| R-30 | Warranty details, offers, condition, and a Negotiable or Fixed pricing type on every listing | ✅ | Fields in vehicle form, displayed on cards and detail page. |
| R-31 | A nested mechanic checklist of vehicle systems, components, and parts | ✅ | Hierarchical checklist via inspection_checklist_nodes table with system/component/part levels. |
| R-32 | Extra fields for replacement item name, brand, and estimated cost when marked for repair or replacement | ✅ | Dynamic fields appear in checklist form for for_repair/for_replacement status. part_replacements table. |
| R-33 | Simplified inspection report with one status per component, filled from the checklist | ✅ | Per-entry status (good/for_repair/for_replacement); report from answers without duplication. |
| R-34 | Checklist of required vehicle documents showing submitted and checked state | ✅ | vehicle_document_items table with required/submitted/verified/rejected states. |

## Phase 3 — Conversations stay together

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-09 | Real-time inquiry chat tied to a vehicle and able to carry images | ✅ | /inquiries list + chat with Supabase Realtime; customer and staff chat views. |
| R-10 | Inquiry routing to Account Manager, Buy Now to Sales Manager, auto-fill, viewing schedules, and handoff | ✅ | Staff queue at /dashboard/inquiries; assignment; arrangement form (GCE visit/meetup/delivery); handoff action. |
| R-11 | Unread-message count and clear read state | ✅ | markMessagesRead called on chat view; read_at stored per message. |
| R-35 | Photograph and file sending, chat controls, and message reporting | ✅ | message_attachments table; reportMessage server action; report review at /dashboard/inquiries/reports. |
| R-36 | Automatic filter that hides or censors inappropriate words | ✅ | Word filter in src/lib/word-filter.ts; censored on display; original preserved in DB. |

## Phase 4 — Recommendations can be explained

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-12 | Customer vehicle ranking using the five stated criteria and weights | ✅ | Ranking engine in src/lib/recommendations/engine.ts; customer-facing page at /recommendations with budget input, preference form, ranked results and per-criterion score breakdowns; runs saved to recommendation_runs/results. |
| R-13 | Agreed management views for pricing, stock turnover, buying patterns, and market information | ✅ | Management dashboard at /dashboard/recommendations with tabs: Pricing Trends, Stock Turnover, Buying Patterns, Market Insights, Accuracy. All data derived from existing platform tables. |
| R-14 | A way to report recommendation accuracy | ✅ | Accuracy tracking view comparing recommendation feedback (helpful/not_helpful) against runs; accuracy percentage, most recommended vehicles, feedback tally. |

## Phase 5 — Transactions can be followed

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-15 | Buy path with Buy Now routing, registered or walk-in accounts, form autofill, two valid IDs, proof of billing, arrangement details, and cash, financing, cheque, or down-payment records | ✅ | Buy Now from showroom creates transaction; purchase details form; viewing arrangements; walk-in buy via createWalkInTransaction. |
| R-16 | Sell path with registered or walk-in accounts, mechanic inspection, valuation, Sales Manager review, acceptance or rejection, acquisition, and repair progress | ✅ | Customer sell-vehicle form; draft vehicle; sell_details; Sales Manager reviewSellTransaction with valuation/decision. |
| R-17 | Request-a-Car path from customer specifications through price discussion and confidential-informant sourcing | ✅ | Customer request-a-car form; vehicle_requests; informant assignment via assignInformant; field_cases for sourcing. |
| R-18 | Shared pending, under-review, approved, rejected, and completed states | ✅ | State machine in src/lib/transactions/state-machine.ts; role-gated transitions; transaction_status_history; admin-client writes. |
| R-19 | Purchase history, payment-method record, financing and installment progress, due-date escalation, sales records, paperwork, invoice or receipt record, and automatic sold status | ✅ | payment_records + verifyPayment; installment_accounts/installments with schedule generator; payment_terms; recordPaperwork; auto sold on buy completion; collection_actions. |
| R-37 | Flexible payment terms and payment arrangements recorded against a purchase | ✅ | payment_terms table; propose/approve/activate workflow; generateInstallmentSchedule from terms. |

## Phase 6 — Staff and managers can run the business

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-20 | Daily time, late arrival, leave, overtime, performance, employee-record, and customer-account tracking with Head Accountant attendance cross-checking | ❓ Unclear | Not yet started. |
| R-21 | Permitted vehicle-purchase and reconditioning disbursements, payment requests, financing, installment, cheque, invoice, case-expense, and financial reports | ❓ Unclear | Not yet started. |
| R-22 | Chief executive dashboard with sales, revenue, inventory, pending work, staff performance, report and price approvals, employee announcements, and agreed recommendation measures | ❓ Unclear | Not yet started. |
| R-23 | Security photographs, sourcing, mechanic assignment, delivery, case expenses, and vehicle-recovery records within the agreed boundary | ❓ Unclear | Not yet started. |
| R-26 | Payroll workflow covering attendance inputs, salary and deduction entry, report preparation, payslip approval, and salary-payment responsibility | ❓ Unclear | Not yet started. |
| R-38 | Direct chief-executive-to-supplier communication channel | ❓ Unclear | Marked "if applicable". |

## Phase 7 — Mobile use and acceptance are checked

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-24 | Responsive customer and employee experiences across the completed features | ❓ Unclear | Not yet started. |
| R-25 | User acceptance, usability, and satisfaction checks with recorded results | ❓ Unclear | Not yet started. |
| R-41 | Mobile application obtained from inside the system, without avoidable outside websites | ❓ Unclear | Disagrees with native-app exclusion. |

## Cross-phase work

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-39 | Stronger text-against-background contrast on every screen, Light Mode included | ❓ Unclear | Not yet started. |
| R-40 | Consistent confirmation prompts before submissions, approvals, and deletions, and consistent notice wording | ❓ Unclear | Not yet started. |

## What is blocked

No roadmap item is marked blocked. Several open questions could block future work. R-41 disagrees with a stated exclusion. See [Open questions](00%20-%20START%20HERE.md#open-questions).

## Status legend

| Emoji | Means |
|---|---|
| ✅ | Finished — built, checked, working |
| 🟨 | Being worked on right now |
| ⭕ | Not started — waiting its turn |
| ❌ | Blocked — something is stopping it |
| 🔵 | Already there — found in the supplied material, built before this plan |
| ⬜ | Dropped — decided against, kept for the record |
| ❓ | Unclear — the material does not say |
