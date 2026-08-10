# 07 - DEVELOPMENT ROADMAP

[Back to start](00%20-%20START%20HERE.md) · Previous: [06 - DIAGRAMS](06%20-%20DIAGRAMS.md) · Next: [08 - ROADMAP TRACKER](08%20-%20ROADMAP%20TRACKER.md)

## What this covers

This roadmap orders the development work described in the supplied documents. It reaches from shared accounts and records through vehicle browsing, communication, recommendations, transactions, staff work, payroll, reports, and mobile acceptance checks. It does not schedule academic writing, budgets, hiring, marketing campaigns, or launch dates.

## Where the plan came from

The plan is drawn from [02 - DOCUMENT FINDINGS](02%20-%20DOCUMENT%20FINDINGS.md), especially the promised features, stated limits, detailed role modules, presentation revisions, and unresolved contradictions. The revision list is the current authority where it overlaps older material, followed by the Markdown role document. No source code was supplied, so the roadmap does not treat any feature as already built.

Items `R-27` through `R-41` come from the revision list. They were added to the phases where their work belongs rather than gathered into a phase of their own, because renumbering or resequencing the earlier items would break every reference pointing at them.

## The phases at a glance

| Phase | What it delivers | Waits on |
|---|---|---|
| Phase 1 — One shared foundation | Recognised users, role boundaries, and one consistent set of records | Nothing — this one starts |
| Phase 2 — Vehicles can be found and understood | Live inventory, inspections, search, favourites, and vehicle views | Phase 1 |
| Phase 3 — Conversations stay together | Vehicle-linked inquiries, staff assignment, schedules, and notices | Phase 2 |
| Phase 4 — Recommendations can be explained | Buyer rankings and management decision information | Phase 2 |
| Phase 5 — Transactions can be followed | Buy, Sell, and Request-a-Car records with clear progress | Phases 3 and 4 |
| Phase 6 — Staff and managers can run the business | Staff records, payroll, permitted finance records, approvals, and reports | Phase 5 |
| Phase 7 — Mobile use and acceptance are checked | A responsive complete system checked with its intended users | Phase 6 |
| Cross-phase work | Readable text and consistent confirmation prompts across every screen built | Nothing — it applies to each phase as that phase is built |

The same order appears as a picture in [06 - DIAGRAMS](06%20-%20DIAGRAMS.md#7-the-order-of-the-phases).

---

## Phase 1 — One shared foundation

**The goal:** Customers and staff are recognised, see only their work, and use one consistent set of records.

**Why it comes first:** Every vehicle, message, recommendation, transaction, and staff record needs a known person and a shared place to be kept.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-01 | Registration, sign-in, email and phone checks, customer profiles, identification upload, and Sales Manager creation of walk-in buyer and seller accounts | People need a trusted account before private inquiries, financing records, and transactions can be shown | **GCE ADDITIONAL DOCUMENTS.docx**, page 1; **GCE USERS LEVELS MODULES.md**, headings “Sales Manager — 3. Walk-In Client Purchasing a Vehicle (No Account)” through “Sales Manager — 4. Walk-In Client Selling Their Own Vehicle” |
| R-02 | Role-based access for the customer, the supplier, and the eight operational roles, managed by the Account Manager | Each person must see and change only the work assigned to that role | **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security” and “Account Manager — 5. RBAC (Role-Based Access Control)”; **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management” |
| R-03 | One shared record foundation with consistent customer, vehicle, conversation, transaction, inspection, and staff information | Later areas must not create the same scattered and conflicting information the project is meant to replace | **GCE FULL CHAPTER 1 - 3.docx**, pages 10–16 and 20–21 |
| R-27 | Supplier registration and account management: Procurement Team creation of the account, a Company or Individual declaration, two primary valid IDs from a published accepted list, kept invitation evidence if a supplier portal is retained, and no sign-in until GCE approves | Suppliers are back in the system and must be identified and approved before they can act in it | **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management” |
| R-28 | Field checks on every form, covering smallest and largest numbers, largest text length, allowed kind of information, required fields, and valid formats | Every later area collects information, so the checking rules belong with the shared foundation rather than being repeated per screen | **REVISIONS LISTS.md**, heading “8. Form Data Validation” |
| R-29 | Automatic filling of forms from details already held, across the system rather than in one journey | The revision list asks for repeated typing to be removed generally, not only in the sales forms | **REVISIONS LISTS.md**, heading “4. Autofill Functionality” |

**How you know the phase is finished:**

- A customer and each agreed staff role can sign in and reach only the work intended for them.
- The Sales Manager can create a buyer or seller account for a walk-in client, and the new account becomes available to that client.
- A supplier account can be created by staff, records Company or Individual and two primary valid IDs, and cannot sign in until GCE approves it.
- Updating shared information once produces the same result wherever that information is shown.
- A customer's private identification is not visible to unrelated users.
- A form refuses information outside its stated limits and says why, and a returning person is not asked again for details already held.

**What could hold it up:** Financing eligibility and walk-in account security rules remain open in [Q-12](00%20-%20START%20HERE.md#open-questions) and [Q-17](00%20-%20START%20HERE.md#open-questions). The supplier work also waits on the Procurement Team's identity, the supplier portal decision, and the accepted ID list in [Q-19](00%20-%20START%20HERE.md#open-questions), [Q-20](00%20-%20START%20HERE.md#open-questions), and [Q-21](00%20-%20START%20HERE.md#open-questions), and no field limits have been supplied yet — [Q-25](00%20-%20START%20HERE.md#open-questions).

---

## Phase 2 — Vehicles can be found and understood

**The goal:** Staff can prepare reliable vehicle records and customers can browse, compare, save, and inspect them.

**Why it comes here:** Vehicle work needs the shared records and access rules from Phase 1.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-04 | Live vehicle inventory with make, model, year, price, condition, mileage, fuel, and availability | The Virtual Showroom and every vehicle-linked journey need one current vehicle record | **GCE FULL CHAPTER 1 - 3.docx**, pages 12, 16, 20–22; **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-05 | Mechanic inspection reports with condition score, photographs, notes, and visible repair progress from pending to fixed | Sell decisions, listing readiness, and recommendations depend on verified condition and repair information | **GCE ADDITIONAL DOCUMENTS.docx**, pages 1 and 3; **GCE USERS LEVELS MODULES.md**, heading “Mechanic” |
| R-06 | Browse, search, filters, vehicle details, and saved favourites | Customers need to find suitable vehicles and return to choices | **GCE FULL CHAPTER 1 - 3.docx**, pages 34–38; **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-07 | 360-degree vehicle viewing limited to the active vehicle | The Virtual Showroom must let customers inspect a vehicle remotely without loading every view at once | **GCE FULL CHAPTER 1 - 3.docx**, pages 19 and 22; **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-08 | Landing-page content, promotions, featured vehicles, and chief-executive approval of a proposed price before the Marketing Specialist posts a vehicle | Marketing and management need controlled ways to prepare and approve public vehicle content | **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; **GCE USERS LEVELS MODULES.md**, heading “Marketing Specialist” |
| R-30 | Warranty details, promotional or sale offers, vehicle condition, and a pricing type of Negotiable Price or Fixed Price on every listing | Buyers were told too little about what they were looking at, and price expectations were not stated | **REVISIONS LISTS.md**, heading “9. Car Listing Improvements” |
| R-31 | A nested mechanic checklist of vehicle systems, then components, then parts | A flat checklist made findings hard to organise and read | **REVISIONS LISTS.md**, heading “11. Mechanic Inspection Checklist” |
| R-32 | Extra fields that appear as soon as a part is marked For Repair or For Replacement, holding the replacement item name, brand, and estimated cost | Repair decisions need the part, its brand, and its cost recorded at the moment the mechanic decides | **REVISIONS LISTS.md**, heading “12. Parts Repair and Replacement” |
| R-33 | A simplified inspection report where each component carries one status of Good, For Repair, or For Replacement, filled from the checklist answers | The earlier report repeated the checklist and made mechanics enter the same findings twice | **REVISIONS LISTS.md**, heading “13. Inspection Report” |
| R-34 | A checklist of required vehicle documents, showing which are submitted and which are checked | Missing vehicle paperwork must be visible before a vehicle moves further | **REVISIONS LISTS.md**, heading “10. Vehicle Document Checklist” |

**How you know the phase is finished:**

- Staff can move an inspected and approved vehicle into the live inventory.
- Customers can filter the catalogue, open a vehicle, save it, and view its available 360-degree material.
- A listing shows its warranty details, any offer, its condition, and whether the price is negotiable or fixed.
- A mechanic can work down systems, components, and parts, and marking a part for repair or replacement opens the item, brand, and cost fields.
- The inspection report shows one status per component and contains no field the mechanic had to type twice.
- A vehicle's required documents can be seen as submitted or still missing.
- A sold or unavailable vehicle is not presented as available elsewhere.

**What could hold it up:** The pricing approval path and exact meaning of “real-time” are stated only broadly. Final business rules must come from the Sales Manager and project owners. The approved checklist contents and the required vehicle document list are also missing — [Q-26](00%20-%20START%20HERE.md#open-questions) and [Q-27](00%20-%20START%20HERE.md#open-questions). — **GCE FULL CHAPTER 1 - 3.docx**, pages 20–22; **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; **REVISIONS LISTS.md**, headings “10. Vehicle Document Checklist” and “11. Mechanic Inspection Checklist”

---

## Phase 3 — Conversations stay together

**The goal:** Every customer inquiry stays tied to its vehicle, assigned staff member, schedule, and unread-message state.

**Why it comes here:** A conversation cannot be tied to a vehicle until Phase 2 provides reliable vehicle records.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-09 | Real-time inquiry chat tied to a vehicle and able to carry images | Customers and staff need one conversation instead of scattered outside channels | **GCE FULL CHAPTER 1 - 3.docx**, pages 14–15 and 39–40; **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-10 | Inquiry routing to the Account Manager, Buy Now routing to the Sales Manager, registration-detail autofill, delivery or meet-up or GCE-visit forms, viewing schedules, and the Account Manager-to-Sales Manager handoff | Inquiries and sales need clear ownership, complete arrangement details, and a visible handoff | **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 2. Inquiries and Viewing Schedule” and “Sales Manager — 1. Buy Now and Inquiry Handling” |
| R-11 | Unread-message count and clear read state | Staff and customers need to see which conversations need attention | **GCE FULL CHAPTER 1 - 3.docx**, page 41 |
| R-35 | Photograph and file sending inside chat, improved chat controls, and a way to report a message or conversation | Customers and staff need to exchange documents and photographs where the conversation already lives, and misuse needs a route to a person | **REVISIONS LISTS.md**, heading “1. Chat, Notifications, and Reports” |
| R-36 | An automatic filter that hides or censors inappropriate words | Bad language must be dealt with by the system rather than after a complaint | **REVISIONS LISTS.md**, heading “1. Chat, Notifications, and Reports” |

**How you know the phase is finished:**

- Starting from a vehicle creates or opens the correct conversation.
- A photograph or file sent in chat reaches only the people in that conversation.
- An inappropriate word is hidden or censored without a person having to act first.
- A reported message reaches whoever is responsible for reviewing it.
- Inquiry and Buy Now actions reach the correct role.
- The Account Manager can send a form with registration details already filled, record the chosen arrangement, schedule a GCE visit, and show it to the Sales Manager.
- The Sales Manager can see the visit and take over when the client arrives.
- New and read messages show the correct notice count.

**What could hold it up:** The documents do not say whether Facebook, Viber, WhatsApp, or phone records are imported, linked, or simply replaced. The complete arrangement-form rules remain [Q-18](00%20-%20START%20HERE.md#open-questions), and the words, languages, and hide-or-censor choice for the filter remain [Q-28](00%20-%20START%20HERE.md#open-questions). — **GCE FULL CHAPTER 1 - 3.docx**, pages 14–15; **GCE USERS LEVELS MODULES.md**, heading “Account Manager — 2. Inquiries and Viewing Schedule”; **REVISIONS LISTS.md**, heading “1. Chat, Notifications, and Reports”

---

## Phase 4 — Recommendations can be explained

**The goal:** Customers receive traceable vehicle rankings, while managers receive the agreed decision information.

**Why it comes here:** Recommendations need Phase 2 inventory, vehicle details, inspection scores, and sales information.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-12 | Customer vehicle ranking using the five stated criteria and weights | Buyers need matches based on budget and preferences rather than an unexplained list | **GCE ADDITIONAL DOCUMENTS.docx**, pages 2–3 |
| R-13 | Agreed management views for pricing, stock turnover, buying patterns, and market information | Managers are promised decision support for business planning | **GCE FULL CHAPTER 1 - 3.docx**, pages 19–20 |
| R-14 | A way to report recommendation accuracy | The chief executive dashboard is expected to show Decision Support System accuracy | **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |

**How you know the phase is finished:**

- A customer can enter the stated preferences and see ranked vehicles.
- The result can show which stated criteria affected the order.
- Managers can see only the final agreed decision measures and accuracy result.

**What could hold it up:** The Decision Support System has three different descriptions. Its final users and outputs must be settled through [Q-05](00%20-%20START%20HERE.md#open-questions).

---

## Phase 5 — Transactions can be followed

**The goal:** Buyers, sellers, and staff can follow each transaction from request through a final result.

**Why it comes here:** Transactions need known people, vehicles, conversations, inspections, and recommendation results from the earlier phases.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-15 | Buy path with Buy Now routing, registered or walk-in accounts, form autofill, two valid IDs, proof of billing, arrangement details, and cash, financing, cheque, or down-payment records | Customers and staff need one visible and documented path for purchasing a listed vehicle | **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Sales Manager — 1. Buy Now and Inquiry Handling” through “Sales Manager — 3. Walk-In Client Purchasing a Vehicle (No Account)” |
| R-16 | Sell path with registered or walk-in accounts, mechanic inspection, valuation, Sales Manager review, acceptance or rejection, acquisition, and repair progress | A client-offered vehicle must be checked and taken into company control before listing | **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–2; **GCE USERS LEVELS MODULES.md**, headings “Confidential Informant — 1. Car Acquisition”, “Mechanic”, and “Sales Manager — 4. Walk-In Client Selling Their Own Vehicle” |
| R-17 | Request-a-Car path from customer specifications through price discussion and confidential-informant sourcing | Customers need a tracked path when the desired vehicle is not in inventory | **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-18 | Shared pending, under-review, approved, rejected, and completed states | Customers and staff need a consistent view of progress | **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| R-19 | Purchase history, payment-method record, financing and installment progress, due-date escalation, sales records, paperwork, invoice or receipt record, and automatic sold status | The system must preserve the sale and later payment follow-up without processing the money itself | **GCE FULL CHAPTER 1 - 3.docx**, pages 16 and 20; **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Head Accountant — 5. Installment Accounts” and “Sales Manager — 5. Record of Sales” through “Sales Manager — 6. Paperwork” |
| R-37 | Flexible payment terms and payment arrangements recorded against a purchase | Buyers were not limited to the fixed payment choices already described, and the agreed terms must be visible on the sale | **REVISIONS LISTS.md**, heading “2. Payment Terms” |

**How you know the phase is finished:**

- Each of the three transaction types follows its own stated work and the shared status path.
- A rejected transaction cannot appear completed.
- Approved financial settlement remains outside the system, while its permitted record and receipt remain visible.
- A late installment reaches the Account Manager for buyer contact and, after the final agreed rule, can become a Confidential Informant recovery assignment.
- The Sales Manager can trace each sold vehicle to the buyer, payment information, and required paperwork.
- Completing a sale makes the vehicle unavailable everywhere.

**What could hold it up:** Finance, approval, installment, and arrangement boundaries remain open in [Q-04](00%20-%20START%20HERE.md#open-questions), [Q-15](00%20-%20START%20HERE.md#open-questions), and [Q-18](00%20-%20START%20HERE.md#open-questions). The allowed payment terms and their approver remain [Q-22](00%20-%20START%20HERE.md#open-questions).

---

## Phase 6 — Staff and managers can run the business

**The goal:** The agreed staff records, approvals, security work, finance records, and management reports are available in one place.

**Why it comes here:** Staff and management summaries need the customer, vehicle, conversation, and transaction records created earlier.

**Implementation plan:** [14 - PHASE 6 IMPLEMENTATION PLAN](../../tasks/10.md) contains the source-code audit, mandatory Phase 1–5 recovery gates, stakeholder decision gates, Phase 6 workstreams, and verification evidence required before this phase can be marked started or finished. Phase 6 implementation remains unstarted.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-20 | Daily time, late arrival, leave, overtime, performance, employee-record, and customer-account tracking with Head Accountant attendance cross-checking | Employees and managers need the requested staff and account records, and payroll needs checked attendance inputs | **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 3. Employee Records and Customer Account Records” through “Account Manager — 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements” and “Head Accountant — 6. Attendance Monitoring” |
| R-21 | Permitted vehicle-purchase and reconditioning disbursements, payment requests, financing, installment, cheque, invoice, case-expense, and financial reports | The named roles need traceable financial requests and records without a direct payment gateway or full accounting system | **GCE FULL CHAPTER 1 - 3.docx**, pages 16–17; **GCE USERS LEVELS MODULES.md**, headings “CEO — 2. Approval and Rejection of Reports”, “Account Manager — 1. Dashboard Overview”, “Head Accountant”, and “Confidential Informant — 6. Payment Approval Process” through “Confidential Informant — 7. Case Expenses” |
| R-22 | Chief executive dashboard with sales, revenue, inventory, pending work, staff performance, report and price approvals, employee announcements, and agreed recommendation measures | Management needs one current view for oversight, decisions, and employee communication | **GCE FULL CHAPTER 1 - 3.docx**, pages 18–21; **GCE USERS LEVELS MODULES.md**, heading “CEO” |
| R-23 | Security photographs, sourcing, mechanic assignment, delivery, case expenses, and vehicle-recovery records within the agreed boundary | The named staff need a traceable record of physical duties and evidence | **GCE USERS LEVELS MODULES.md**, headings “Confidential Informant” and “Head Security” |
| R-26 | Payroll workflow covering attendance inputs, salary and deduction entry, report preparation, payslip approval, and salary-payment responsibility | Payroll now has named inputs and role handoffs that must be kept together and checked | **GCE USERS LEVELS MODULES.md**, headings “CEO — 2. Approval and Rejection of Reports”, “Account Manager — 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements”, and “Head Accountant — 2. Payroll” through “Head Accountant — 6. Attendance Monitoring” |
| R-38 | A direct chief-executive-to-supplier communication channel, built only if the business confirms it applies | The revision list asks for direct coordination between the two, but marks it conditional | **REVISIONS LISTS.md**, heading “3. CEO-to-Supplier Communication” |

**How you know the phase is finished:**

- Each agreed employee can submit and review only the records assigned to that role.
- The Account Manager can prepare payroll from the stated attendance, salary, and deduction inputs.
- The final approved payroll handoff produces payslips and leaves salary-payment responsibility with the agreed role.
- The Head Accountant can cross-check attendance, inventory, sales, installments, and permitted finance reports without taking money online.
- The chief executive can trace dashboard totals and approvals back to the underlying records and send an employee announcement.
- Head Security can attach before-and-after photographic proof to a duty record.

**What could hold it up:** Offline finance boundaries, the payroll approval order, the fund-release handoff, the installment rule, and salary and deduction calculations remain [Q-04](00%20-%20START%20HERE.md#open-questions), [Q-13](00%20-%20START%20HERE.md#open-questions), [Q-14](00%20-%20START%20HERE.md#open-questions), [Q-15](00%20-%20START%20HERE.md#open-questions), and [Q-16](00%20-%20START%20HERE.md#open-questions). Whether the chief-executive-to-supplier channel is wanted at all remains [Q-23](00%20-%20START%20HERE.md#open-questions).

---

## Phase 7 — Mobile use and acceptance are checked

**The goal:** The complete browser-based system works on phones for customers and employees and is checked with its intended users.

**Why it comes here:** Mobile and acceptance checks are meaningful only after the complete journeys and management work exist.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-24 | Responsive customer and employee experiences across the completed features | Both groups are promised on-the-go browser access without native phone applications | **GCE FULL CHAPTER 1 - 3.docx**, pages 15–17 and 21 |
| R-25 | User acceptance, usability, and satisfaction checks with recorded results | The study says adoption and user experience will be measured through questionnaires and feedback | **GCE FULL CHAPTER 1 - 3.docx**, pages 21–22 |
| R-41 | A way to obtain the mobile application from inside the system, with avoidable trips to outside websites removed | The revision list asks users to get the application without leaving the system, once the business settles what that application is | **REVISIONS LISTS.md**, heading “7. Mobile Application Download” |

**How you know the phase is finished:**

- The main customer and employee journeys work at phone and computer sizes while online.
- Intended users can complete their work and their feedback is recorded.
- A user can obtain the mobile application without being sent to an outside website.
- The accepted system stays within the agreed boundary, once that boundary is settled.

**What could hold it up:** The final meaning of separate customer and employee mobile experiences remains [Q-06](00%20-%20START%20HERE.md#open-questions). R-41 cannot start until [Q-24](00%20-%20START%20HERE.md#open-questions) settles what the downloadable application is, because the older documents exclude native phone applications. See [C-06](02%20-%20DOCUMENT%20FINDINGS.md#active-disagreement).

---

## Cross-phase work

**The goal:** Every screen built in any phase is readable and asks before it does something that cannot be casually undone.

**Why it sits outside the phases:** These two items are not features of one area. They apply to whatever has just been built, so they are done alongside each phase rather than waiting for a phase of their own.

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-39 | Stronger text-against-background contrast on every screen, with Light Mode checked specifically | Some text currently cannot be read comfortably against its background, worst in Light Mode | **REVISIONS LISTS.md**, heading “6. UI and Text Visibility” |
| R-40 | Consistent confirmation prompts before submissions, approvals, and deletions, and consistent wording for confirmation messages and system notices | People need a chance to stop, and the same action must not be worded differently in different areas | **REVISIONS LISTS.md**, headings “1. Chat, Notifications, and Reports” and “14. Submission, Approval, and Deletion Confirmation” |

**How you know this work is finished:**

- Text is readable against its background on every screen, in both Light Mode and the darker one.
- Submitting, approving, or deleting always asks first, in the same words wherever it appears.
- Confirmation messages and system notices use one consistent style across every area.

**What could hold it up:** The revision list does not name a contrast standard or a required wording, so those must be agreed with the project owners before the work is checked.

## Deliberately left out

| What | Why it is not here |
|---|---|
| Direct online payment and a payment gateway | Explicitly outside scope in **GCE FULL CHAPTER 1 - 3.docx**, page 16 |
| Delivery tracking and automatic logistics | Explicitly outside scope in **GCE FULL CHAPTER 1 - 3.docx**, pages 16–17 |
| Native iOS and Android applications | Explicitly outside scope in **GCE FULL CHAPTER 1 - 3.docx**, page 17. The revision list now asks for a downloadable mobile application, so this exclusion is contested rather than settled — see [C-06](02%20-%20DOCUMENT%20FINDINGS.md#active-disagreement) and R-41 above |
| Offline operation | Explicitly outside scope in **GCE FULL CHAPTER 1 - 3.docx**, page 17 |
| Automatic marketplace listing and advanced campaign tools | Explicitly outside scope in **GCE FULL CHAPTER 1 - 3.docx**, pages 16–17 |
| ~~Supplier area~~ — **no longer left out** | The role document left the supplier out, but the newer revision list restores supplier registration and approval. The work is now R-27 in Phase 1. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management” |
| Academic manuscript completion | Writing work rather than system development; retained in [09 - TASK TRACKER](09%20-%20TASK%20TRACKER.md#tasks-that-serve-no-roadmap-item) |
| Dates, budgets, hiring, and launch work | The supplied material does not provide an approved development schedule or operational plan |
