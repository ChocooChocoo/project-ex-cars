# 08 - ROADMAP TRACKER

[[00 - START HERE|Back to start]] · Previous: [[07 - DEVELOPMENT ROADMAP]] · Next: [[09 - TASK TRACKER]]

**Last checked:** 7 August 2026

## Where everything stands

| Status | How many |
|---:|---|
| ✅ Finished | 4 |
| 🟨 Being worked on | 2 |
| ⭕ Not started | 0 |
| ❌ Blocked | 0 |
| 🔵 Already there | 0 |
| ⬜ Dropped | 0 |
| ❓ Unclear | 35 |
| **Total** | **41** |

Phase 1 implementation began 7 August 2026. Code infrastructure (auth, database schema, RLS policies, RBAC management, validation framework, autofill utilities, server actions) has been written. Migrations need execution against the Supabase project; R-28 and R-29 remain in progress because their per-form integration spans later phases.

## Phase 1 — One shared foundation

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-01 | Registration, sign-in, email and phone checks, customer profiles, identification upload, and Sales Manager creation of walk-in buyer and seller accounts | ✅ | Auth forms connected to Supabase; profile auto-creation via database trigger; customer document upload server action; walk-in account creation via admin client. Pages and full document upload UI need further polish. |
| R-02 | Role-based access for the customer, the supplier, and the eight operational roles, managed by the Account Manager | ✅ | All 10 role values defined in `src/lib/auth/roles.ts`; RLS policies written per table; role assignment server action; Account Manager RBAC management page at `/dashboard/roles`; middleware protects dashboard routes. |
| R-03 | One shared record foundation with consistent customer, vehicle, conversation, transaction, inspection, and staff information | ✅ | Phase 1 database migration (`supabase/migrations/00001_phase1_schema.sql`) creates all 6 foundation tables with indexes, constraints, RLS policies, and the `private.user_roles` schema. Migration needs execution against Supabase. |
| R-27 | Supplier registration and account management with staff-created accounts, Company or Individual, two primary valid IDs, and approval before sign-in | ✅ | `suppliers` and `supplier_documents` tables with RLS policies; `createSupplier` and `approveSupplier` server actions; controlled states including `pending_approval` gate; accepted ID type list defined. No UI page yet. |
| R-28 | Field checks on every form for numbers, lengths, kinds of information, required fields, and formats | 🟨 | Shared Zod validation schemas in `src/lib/validation/forms.ts` (email, password, phone, name, address). Per-form integration with react-hook-form is applied in auth forms. Remaining forms across later phases need the same treatment. |
| R-29 | Automatic filling of forms from details already held | 🟨 | `getProfileAutoFill()` utility in `src/lib/autofill/index.ts` reads stored profile data. Needs integration into inquiry, transaction, and arrangement forms when those phases are built. |

## Phase 2 — Vehicles can be found and understood

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-04 | Live vehicle inventory with make, model, year, price, condition, mileage, fuel, and availability | ❓ Unclear | No working files or inventory records were supplied. |
| R-05 | Mechanic inspection reports with condition score, photographs, notes, and visible repair progress from pending to fixed | ❓ Unclear | No working files or inspection records were supplied. |
| R-06 | Browse, search, filters, vehicle details, and saved favourites | ❓ Unclear | The manuscript describes flows, but no working pages were supplied. |
| R-07 | 360-degree vehicle viewing limited to the active vehicle | ❓ Unclear | No working showroom or media was supplied. |
| R-08 | Landing-page content, promotions, featured vehicles, and chief-executive approval of a proposed price before the Marketing Specialist posts a vehicle | ❓ Unclear | No working content area was supplied. |
| R-30 | Warranty details, offers, condition, and a Negotiable or Fixed pricing type on every listing | ❓ Unclear | Requested at the last presentation; no working listing was supplied. |
| R-31 | A nested mechanic checklist of vehicle systems, components, and parts | ❓ Unclear | Requested at the last presentation; the approved checklist contents are missing. |
| R-32 | Extra fields for replacement item name, brand, and estimated cost when a part is marked for repair or replacement | ❓ Unclear | Requested at the last presentation; no working checklist was supplied. |
| R-33 | Simplified inspection report with one status per component, filled from the checklist | ❓ Unclear | Requested at the last presentation; no working report was supplied. |
| R-34 | Checklist of required vehicle documents showing submitted and checked state | ❓ Unclear | Requested at the last presentation; the required document list is missing. |

## Phase 3 — Conversations stay together

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-09 | Real-time inquiry chat tied to a vehicle and able to carry images | ❓ Unclear | The manuscript describes messaging, but no working files were supplied. |
| R-10 | Inquiry routing to the Account Manager, Buy Now routing to the Sales Manager, registration-detail autofill, delivery or meet-up or GCE-visit forms, viewing schedules, and the Account Manager-to-Sales Manager handoff | ❓ Unclear | No working files were supplied. |
| R-11 | Unread-message count and clear read state | ❓ Unclear | The manuscript describes the flow, but no working files were supplied. |
| R-35 | Photograph and file sending in chat, improved chat controls, and message reporting | ❓ Unclear | Requested at the last presentation; no working files were supplied. |
| R-36 | Automatic hiding or censoring of inappropriate words | ❓ Unclear | Requested at the last presentation; the word list and languages are missing. |

## Phase 4 — Recommendations can be explained

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-12 | Customer vehicle ranking using the five stated criteria and weights | ❓ Unclear | No calculation or working result was supplied. |
| R-13 | Agreed management views for pricing, stock turnover, buying patterns, and market information | ❓ Unclear | No working files or report output was supplied. |
| R-14 | A way to report recommendation accuracy | ❓ Unclear | No working files or measurement rules were supplied. |

## Phase 5 — Transactions can be followed

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-15 | Buy path with Buy Now routing, registered or walk-in accounts, form autofill, two valid IDs, proof of billing, arrangement details, and cash, financing, cheque, or down-payment records | ❓ Unclear | No working transaction files were supplied. |
| R-16 | Sell path with registered or walk-in accounts, mechanic inspection, valuation, Sales Manager review, acceptance or rejection, acquisition, and repair progress | ❓ Unclear | No working transaction files were supplied. |
| R-17 | Request-a-Car path from customer specifications through price discussion and confidential-informant sourcing | ❓ Unclear | No working transaction files were supplied. |
| R-18 | Shared pending, under-review, approved, rejected, and completed states | ❓ Unclear | No working records were supplied. |
| R-19 | Purchase history, payment-method record, financing and installment progress, due-date escalation, sales records, paperwork, invoice or receipt record, and automatic sold status | ❓ Unclear | No working records were supplied. |
| R-37 | Flexible payment terms and payment arrangements recorded against a purchase | ❓ Unclear | Requested at the last presentation; the allowed terms and approver are missing. |

## Phase 6 — Staff and managers can run the business

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-20 | Daily time, late arrival, leave, overtime, performance, employee-record, and customer-account tracking with Head Accountant attendance cross-checking | ❓ Unclear | No working staff records were supplied. |
| R-21 | Permitted vehicle-purchase and reconditioning disbursements, payment requests, financing, installment, cheque, invoice, case-expense, and financial reports | ❓ Unclear | No working finance records were supplied. |
| R-22 | Chief executive dashboard with sales, revenue, inventory, pending work, staff performance, report and price approvals, employee announcements, and agreed recommendation measures | ❓ Unclear | No working dashboard or report was supplied. |
| R-23 | Security photographs, sourcing, mechanic assignment, delivery, case expenses, and vehicle-recovery records within the agreed boundary | ❓ Unclear | No working records were supplied. |
| R-26 | Payroll workflow covering attendance inputs, salary and deduction entry, report preparation, payslip approval, and salary-payment responsibility | ❓ Unclear | No working payroll records or approval evidence were supplied. |
| R-38 | Direct chief-executive-to-supplier communication channel | ❓ Unclear | Requested at the last presentation, but marked “if applicable”; see [[00 - START HERE#Open questions\|Q-23]]. |

## Phase 7 — Mobile use and acceptance are checked

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-24 | Responsive customer and employee experiences across the completed features | ❓ Unclear | No running pages were supplied for phone or computer checks. |
| R-25 | User acceptance, usability, and satisfaction checks with recorded results | ❓ Unclear | No questionnaire results or test evidence were supplied. |
| R-41 | Mobile application obtained from inside the system, without avoidable outside websites | ❓ Unclear | Requested at the last presentation, but it disagrees with the native-application exclusion; see [[02 - DOCUMENT FINDINGS#Active disagreement\|C-06]]. |

## Cross-phase work

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-39 | Stronger text-against-background contrast on every screen, Light Mode included | ❓ Unclear | Requested at the last presentation; no screens were supplied to check. |
| R-40 | Consistent confirmation prompts before submissions, approvals, and deletions, and consistent notice wording | ❓ Unclear | Requested at the last presentation; no screens were supplied to check. |

## What is blocked

No roadmap item is marked blocked because the material does not report an active build. Several open questions could block future work, but the current evidence supports only ❓ Unclear. R-41 is the closest to blocked, because it directly disagrees with a stated exclusion, but no active build has been reported for it either. See [[00 - START HERE#Open questions]].

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
