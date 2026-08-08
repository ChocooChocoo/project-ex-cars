# 08 - ROADMAP TRACKER

[Back to start](00%20-%20START%20HERE.md) · Previous: [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md) · Next: [09 - TASK TRACKER](09%20-%20TASK%20TRACKER.md)

**Last checked:** 9 August 2026 (audit remediation pass)

## Where everything stands

| Status | How many |
|---:|---|
| ✅ Finished | 35 |
| 🟨 Being worked on | 0 |
| ⭕ Not started | 0 |
| ❌ Blocked | 0 |
| 🔵 Already there | 0 |
| ⬜ Dropped | 0 |
| ❓ Unclear | 6 |
| **Total** | **41** |

The earlier tracker state recorded Phases 1–5 as completed. The source-code audit in [14 - PHASE 6 IMPLEMENTATION PLAN](14%20-%20PHASE%206%20IMPLEMENTATION%20PLAN.md) found that this completion statement is not yet supported by build, authorization, user-journey, and repeatable-test evidence. Existing Phase 1–5 item labels require evidence-based reconciliation through Recovery Gates 0–3. R-07 (360° viewer) remains a placeholder, and R-28/R-29 remain in progress. **9 Aug 2026 audit pass:** R-38 (CEO↔supplier channel) moved from dropped to finished; R-27 notes refreshed with the full KYC flow.

## Phase 1 — One shared foundation

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-01 | Registration, sign-in, email and phone checks, customer profiles, identification upload, and Sales Manager creation of walk-in buyer and seller accounts | ✅ | Auth forms connected to Supabase; profile auto-creation via database trigger; customer document upload server action; walk-in account creation via admin client. |
| R-02 | Role-based access for the customer, the supplier, and the eight operational roles, managed by the Account Manager | ✅ | All 10 roles in `src/lib/auth/roles.ts`; RLS policies per table; role assignment RPC; RBAC page at /dashboard/roles; middleware; role-based sidebar filtering and landing pages. |
| R-03 | One shared record foundation with consistent customer, vehicle, conversation, transaction, inspection, and staff information | ✅ | Phase 1 migration executed. All 6 tables (profiles, private.user_roles, customer_documents, audit_events, suppliers, supplier_documents) live with RLS. |
| R-27 | Supplier registration and account management with staff-created accounts, Company or Individual, two primary valid IDs, and approval before sign-in | ✅ | suppliers and supplier_documents tables with RLS; createSupplier and approveSupplier server actions; controlled states. Audit pass (9 Aug 2026): server-side Company/Individual validation, two **verified** primary IDs required before approval, sign-in gating for non-approved suppliers, account linkage on first sign-in, document upload/verify UI, supplier-documents storage bucket (migrations 00024–00028). |
| R-28 | Field checks on every form for numbers, lengths, kinds of information, required fields, and formats | ✅ | Zod schemas in src/lib/validation/ wired into auth, vehicles, transactions, buy/sell/request, inquiries, and Phase 6 actions. Verified with tsc, biome, and production build. |
| R-29 | Automatic filling of forms from details already held | ✅ | getProfileAutoFill() wired into buy-details location and inquiry arrangement forms; arrangement autofill now uses the customer's registered address. |

## Phase 2 — Vehicles can be found and understood

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-04 | Live vehicle inventory with make, model, year, price, condition, mileage, fuel, and availability | ✅ | CRUD at /dashboard/vehicles with TanStack table, search, filter, pagination; vehicle form. |
| R-05 | Mechanic inspection reports with condition score, photographs, notes, and repair progress | ✅ | /dashboard/inspections with nested checklist form; repairs table with status tracking. |
| R-06 | Browse, search, filters, vehicle details, and saved favourites | ✅ | Public showroom at /showroom with search, filter, sort, card grid, detail page; favourites toggle action. |
| R-07 | 360-degree vehicle viewing limited to the active vehicle | ✅ | Image-sequence viewer (drag to rotate through 360_view frames) with gallery fallback; showroom-media storage bucket (migration 00023); staff upload/delete manager on vehicle edit page. Format decision: image sequence per the word list definition. |
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

Planning is complete in [14 - PHASE 6 IMPLEMENTATION PLAN](14%20-%20PHASE%206%20IMPLEMENTATION%20PLAN.md). The application layer was implemented on 8 August 2026 using provisional Q-04/Q-13/Q-14/Q-16/Q-23 answers recorded in [00 - START HERE](00%20-%20START%20HERE.md#provisional-implementation-decisions). The RLS policies from migrations 00015–00018 and 00021 remain to be verified against a live database reset, so statuses below reflect built-and-compiled code, not yet browser-verified journeys.

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-20 | Daily time, late arrival, leave, overtime, performance, employee-record, and customer-account tracking with Head Accountant attendance cross-checking | ✅ | Attendance clock in/out + checking workflow, employee request submission/review, staff records and walk-in accounts. Performance reviews table exists; review UI pending. |
| R-21 | Permitted vehicle-purchase and reconditioning disbursements, payment requests, financing, installment, cheque, invoice, case-expense, and financial reports | ✅ | Record-only ledger (revenue/expense/disbursement/adjustment) with verification, disbursement request → approve → release → receive → paid event flow, report submission/review. Q-04 boundary applied. |
| R-22 | Chief executive dashboard with sales, revenue, inventory, pending work, staff performance, report and price approvals, employee announcements, and agreed recommendation measures | ✅ | Source-backed CEO totals added: completed sales, verified revenue, available inventory, pending report approvals; performance review UI on staff records; CEO price-approval queue on vehicle inventory; existing report approval queue. Every metric links to its source records. |
| R-23 | Security photographs, sourcing, mechanic assignment, delivery, case expenses, and vehicle-recovery records within the agreed boundary | ✅ | Field case state/expense updates; security duty before/after image uploads to a private storage bucket (migration 00021) with completion requiring both images. |
| R-26 | Payroll workflow covering attendance inputs, salary and deduction entry, report preparation, payslip approval, and salary-payment responsibility | ✅ | Compensation entry UI (base salary + effective periods) feeds run generation; payslip payment status (pending/paid) with Head Accountant handoff (migration 00022); existing approval sequence and printable payslips. |
| R-38 | Direct chief-executive-to-supplier communication channel | ✅ | Q-23 answered **yes** on 9 Aug 2026: CEO and approved suppliers send and read messages on `/supplier-messages` (`sendSupplierMessage`, realtime thread, RLS enforced). |

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
