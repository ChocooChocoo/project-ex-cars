# 12 - DATABASE SCHEMA

[Back to start](00%20-%20START%20HERE.md) · Previous: [11 - TECH STACK](11%20-%20TECH%20STACK.md)

## Status and purpose

This is a **proposed Supabase database schema**, not a record of an existing database. No database, source code, migration, or running system was supplied. Every implementation status therefore remains ❓ Unclear as recorded in [08 - ROADMAP TRACKER](08%20-%20ROADMAP%20TRACKER.md).

The design is *drawn from* [02 - DOCUMENT FINDINGS](02%20-%20DOCUMENT%20FINDINGS.md), [05 - SYSTEM ARCHITECTURE](05%20-%20SYSTEM%20ARCHITECTURE.md), [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md), and [09 - TASK TRACKER](09%20-%20TASK%20TRACKER.md). It turns the documented work into a table-level plan for the Next.js and Supabase arrangement selected in conversation on 7 August 2026. Where the material is incomplete, the design keeps a safe place for the future answer without inventing the answer itself.

## The shape in one paragraph

Supabase Auth would keep sign-in identities. The application would add a profile and one protected role for each identity. PostgreSQL tables would then connect people to vehicles, conversations, transactions, physical assignments, finance records, staff records, payroll, reports, content, and recommendations. Supabase Storage would hold the files while the tables keep their paths and ownership. Row Level Security would decide which rows each customer or staff role may read or change.

## Design rules

- Every custom record gets a generated unique primary key unless it shares the identifier of the one record it extends.
- Supabase's managed `auth.users` record remains the source of sign-in email and phone information. The application does not copy passwords or sign-in secrets into its own tables.
- Every foreign key receives an index unless a unique rule already provides one.
- Money uses an exact two-decimal number. Amounts cannot be negative unless a later approved rule explicitly requires a reversal record.
- Saved dates and times include their time zone. Business dates such as an installment due date or payroll period use a date without an invented time.
- Controlled statuses use short text values with database constraints. New values require a reviewed migration rather than free-form spelling.
- Customer identification, payroll, finance, and security records are not physically deleted through ordinary screens. Their approved retention and removal rules remain open.
- Files stay in Supabase Storage. Tables keep the bucket, path, owner, document kind, and verification state.
- Approval, money, role, and status changes create an audit event that ordinary screens cannot edit or delete.
- Row Level Security is enabled on every table exposed through the Data API. Private helper tables are kept outside the exposed `public` schema. — [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Supabase-managed identity

`auth.users` is supplied and maintained by Supabase Auth. Global Car Exchange should reference it but should not create custom tables or functions inside the managed `auth` schema. Supabase has restricted custom changes in its managed `auth`, `storage`, and `realtime` schemas, so application-owned objects belong in `public` or a non-exposed `private` schema. — [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [managed-schema restriction](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)

## Proposed table catalogue

The plan uses 52 custom tables. This is the smallest arrangement here that keeps private access rules, approvals, status history, payroll details, supplier registration, the inspection checklist, and the three transaction types understandable without putting unrelated information into one catch-all table. Ten of the tables come from the presentation revision list and are marked below.

### A. Accounts, access, evidence, and acceptance

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `profiles` | The business profile belonging to one Supabase account | Same identifier as `auth.users`; full name, address, account state, creator, activation date, and created date | [R-01](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation), [R-03](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation) |
| `private.user_roles` | The one current role assigned to an account | Account identifier, one of the ten current roles, active state, assigned by, and assigned date | [R-02](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation) |
| `customer_documents` | One valid ID or proof-of-billing file supplied by a customer | Customer, document kind, private Storage path, verification state, verifier, and verification date | [R-01](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation), [R-15](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `audit_events` | One protected history entry for a sensitive change | Actor, action, record kind, record identifier, non-sensitive change summary, and event time | *Drawn from* the approval, role, money, and status responsibilities across [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md) |
| `acceptance_feedback` | One completed usability or acceptance questionnaire | Respondent or anonymous code, respondent role, questionnaire version, variable answers, comments, and submission time | [R-25](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-7-mobile-use-and-acceptance-are-checked) |
| `suppliers` — *from the revision list* | One supplier known to GCE | Optional account identifier, supplier kind of company or individual, business or personal name, contact details, creator, creation route of staff-created or portal, optional invitation evidence path, approval decision, approver, approval date, and current state | [R-27](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation) |
| `supplier_documents` — *from the revision list* | One valid ID or supporting file supplied by a supplier | Supplier, document kind, whether it counts as one of the two primary valid IDs, private Storage path, verification state, verifier, and verification date | [R-27](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation) |

The role values are `customer`, `supplier`, `ceo`, `account_manager`, `head_accountant`, `confidential_informant`, `marketing_specialist`, `mechanic`, `sales_manager`, and `head_security`. `supplier` was previously left out because the role document did not contain it. The newer revision list restores supplier registration, so the value returns. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management”

No role value is proposed for the Procurement Team, because the revision list names that group without saying which of the existing roles it is. `suppliers.created_by` records whoever actually created the account until [Q-19](00%20-%20START%20HERE.md#open-questions) is answered. A supplier row may exist before any sign-in account exists, which is why the account identifier is optional; the account must stay unusable until the approval decision is recorded.

### B. Vehicles and the Virtual Showroom

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `vehicles` | One vehicle known to Global Car Exchange | Unique stock code, optional unique VIN, make, model, year, condition, mileage, fuel, availability, current approved price, pricing type of negotiable or fixed, warranty details, current offer or promotion, listing state, and posting date | [R-04](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood), [R-06](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood), [R-30](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `vehicle_media` | One photograph or 360-degree media item for a vehicle | Vehicle, media kind, Storage path, display order, public state, uploader, and upload date | [R-07](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `vehicle_inspections` | One mechanic inspection | Vehicle, mechanic, optional field case, condition score, findings, recommendation, and inspection date | [R-05](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `repairs` | One repair job and its current progress | Vehicle, mechanic, description, status, start date, completion date, and notes | [R-05](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `vehicle_price_proposals` | One price proposed by Marketing for chief-executive review | Vehicle, proposed amount, proposer, decision, decision maker, decision date, and notes | [R-08](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `favourites` | One customer saving one vehicle | Customer, vehicle, and saved date; customer and vehicle are unique together | [R-06](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `inspection_checklist_nodes` — *from the revision list* | One entry in the nested checklist: a vehicle system, one of its components, or one part | Parent entry, level of system or component or part, name, display order, checklist version, and active state | [R-31](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `inspection_checklist_results` — *from the revision list* | One mechanic's answer for one checklist entry in one inspection | Inspection, checklist entry, status of good or for_repair or for_replacement, notes, and answered time; inspection and checklist entry are unique together | [R-31](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood), [R-33](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `part_replacements` — *from the revision list* | The repair or replacement detail attached to one checklist answer | Checklist answer, replacement item name, brand, estimated cost, and recorded time | [R-32](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `vehicle_document_items` — *from the revision list* | One required document for one vehicle and its current state | Vehicle, document kind, required state, submitted state, private Storage path, checker, and check date; vehicle and document kind are unique together | [R-34](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |

Only an approved price proposal may become `vehicles.current_price`. Only a vehicle marked approved, available, and posted may appear in the public catalogue. The application may calculate that public condition, but the database must still prevent an unapproved price from being presented as approved.

The checklist entries are kept apart from the answers so the approved list can be versioned without rewriting past inspections. A finished inspection therefore keeps the wording it was answered against. The nesting uses a parent link on each entry, which supports the three levels in the example — a system such as Engine, a component such as Oil System, and a part beneath it — without fixing the depth in the table shape. The example names only engine, brakes, and suspension, so no entries are proposed here; the approved list is [Q-27](00%20-%20START%20HERE.md#open-questions).

A repair detail row may exist only for an answer whose status is for_repair or for_replacement. The inspection report reads `inspection_checklist_results` and `part_replacements` rather than storing a second copy of the same findings, which is what the revision list asks for. The required vehicle document kinds are likewise not listed here — see [Q-26](00%20-%20START%20HERE.md#open-questions). — **REVISIONS LISTS.md**, headings “10. Vehicle Document Checklist” through “13. Inspection Report”

### C. Inquiries, messages, and arrangements

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `inquiries` | One customer's Inquiry or Buy Now intention for a vehicle | Customer, vehicle, intention kind, assigned Account Manager, assigned Sales Manager, handoff state, and overall state | [R-09](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together), [R-10](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together) |
| `inquiry_messages` | One message inside an inquiry | Inquiry, sender, message text, optional private image path, sent time, and read time | [R-09](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together), [R-11](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together) |
| `viewing_arrangements` | One delivery, CALABARZON meet-up, or GCE-visit arrangement | Inquiry, optional purchase transaction, arrangement kind, schedule, location, down-payment amount, confirmation state, confirmer, and notes | [R-10](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together), [R-15](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `message_attachments` — *from the revision list* | One photograph or file sent inside a message | Message, file kind, private Storage path, original file name, file size, uploader, and upload time | [R-35](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together) |
| `message_reports` — *from the revision list* | One report raised against a message or conversation | Reported message or inquiry, reporter, reason, state, reviewer, decision, and decision date | [R-35](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together) |
| `supplier_messages` — *from the revision list* | One message in a direct chief-executive-to-supplier conversation | Supplier, sender, message text, optional private file path, sent time, and read time | [R-38](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |

The arrangement table contains only the common fields currently supported by evidence. Additional required delivery, meet-up, or visit fields wait for [Q-18](00%20-%20START%20HERE.md#open-questions).

`inquiry_messages` keeps the original text as sent. The filtered form shown to readers is produced when the message is displayed, so a later change to the word list does not rewrite history and a moderator can still see what was actually written. Whether words are hidden or censored, and which words are covered, remain [Q-28](00%20-%20START%20HERE.md#open-questions). `supplier_messages` is proposed but should not be built until [Q-23](00%20-%20START%20HERE.md#open-questions) confirms the channel is wanted. — **REVISIONS LISTS.md**, headings “1. Chat, Notifications, and Reports” and “3. CEO-to-Supplier Communication”

### D. Buy, Sell, Request-a-Car, installments, and physical assignments

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `transactions` | One Buy, Sell, or Request-a-Car case | Customer, transaction kind, optional vehicle, current state, creator, opened date, and completed date | [R-15](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) through [R-18](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `transaction_status_history` | One movement from one transaction state to another | Transaction, earlier state, new state, actor, reason, and change time | [R-18](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `purchase_details` | The Buy-only information for one transaction | Transaction, payment method, final price, arrangement, document-check state, checker, and check date | [R-15](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed), [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `sell_details` | The Sell-only information for one transaction | Transaction, offered amount, valuation amount, review notes, decision, decision maker, and decision date | [R-16](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `vehicle_requests` | The Request-a-Car information for one transaction | Transaction, requested make, model, year range, budget, other preferences, agreed price, and assigned Confidential Informant | [R-17](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `transaction_documents` | One invoice, receipt, sale document, or other transaction file | Transaction, document kind, private Storage path, uploader, verification state, verifier, and upload date | [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `payment_records` | One record of money settled outside the application | Transaction, optional installment, amount, method, external reference, recorded by, verified by, and settlement date | [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `installment_accounts` | One installment agreement for a completed purchase | Purchase transaction, financed total, down payment, opening balance, start date, state, and closed date | [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `installments` | One scheduled payment within an installment account | Account, sequence number, due date, amount due, state, and payment date | [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| `collection_actions` | One late-payment notice, ultimatum, recovery instruction, or recovery result | Installment, action kind, actor, optional deadline, notes, and action time | [R-19](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed), [R-23](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `field_cases` | One physical acquisition, delivery, or vehicle-recovery assignment | Vehicle, optional transaction, case kind, assigned Confidential Informant, optional mechanic, schedule, location, state, and completion date | [R-23](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `payment_terms` — *from the revision list* | The agreed payment arrangement for one purchase | Purchase transaction, arrangement description, total amount, down payment, number of payments, payment frequency, first due date, agreed by, approver, approval date, and state | [R-37](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |

`payment_terms` holds what was agreed with a buyer before the installments themselves are created, so an arrangement can be agreed and approved without inventing a schedule the business has not confirmed. The allowed arrangements and their approver remain [Q-22](00%20-%20START%20HERE.md#open-questions). — **REVISIONS LISTS.md**, heading “2. Payment Terms”

`payment_records` records money handled elsewhere; it does not authorize online collection. `collection_actions` records the steps without automatically starting recovery. The deadline and extra approval rules remain [Q-15](00%20-%20START%20HERE.md#open-questions).

### E. Finance, disbursements, and reports

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `financial_entries` | One permitted expense or revenue record | Entry kind, category, amount, date, optional transaction, optional field case, recorder, and notes | [R-21](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `disbursement_requests` | One request for vehicle-purchase, reconditioning, case, or payroll funds | Request kind, amount, requester, optional vehicle, field case, or payroll run, current state, and created date | [R-21](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `disbursement_events` | One submission, approval, rejection, release, receipt, or payment event for a request | Request, event kind, actor, amount, event date, and notes | [R-21](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `reports` | One submitted attendance, payroll, disbursement, expense, revenue, inventory, sales, or management report | Report kind, covered period, submitter, summary, optional private file path, decision, decision maker, decision date, and notes | [R-22](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |

The event table preserves both described fund paths without choosing a final sequence. The approved sequence and responsibility still require [Q-14](00%20-%20START%20HERE.md#open-questions). Finance records stop at recording and verification until [Q-04](00%20-%20START%20HERE.md#open-questions) settles the final boundary.

### F. Attendance, requests, compensation, and payroll

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `attendance_entries` | One employee's work record for one date | Employee, work date, time in, time out, late minutes, absence state, recorder, and check state | [R-20](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business), [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `employee_requests` | One leave or overtime request | Employee, request kind, dates or hours, reason, state, decision maker, and decision date | [R-20](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `private.staff_compensation` | One employee's salary setting for an effective period | Employee, base salary, start date, optional end date, set by, and set date | [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `payroll_runs` | One payroll period prepared for staff | Period start, period end, preparer, preparation date, state, and payment date | [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `payslips` | One employee's result within one payroll run | Payroll run, employee, gross pay, total deductions, net pay, payslip state, and salary-payment state | [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `payslip_items` | One earning or deduction line on a payslip | Payslip, item kind, code, description, amount, source value, and calculation note | [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `payroll_approvals` | One review decision made against a payroll run or payslip | Payroll run, optional payslip, reviewer role, reviewer, decision, optional sequence, decision date, and notes | [R-26](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |

The payroll tables store entered amounts and the exact values used for each payslip. They do not invent salary formulas or government-deduction calculations. Those rules remain [Q-16](00%20-%20START%20HERE.md#open-questions). `payroll_approvals.sequence` remains optional until [Q-13](00%20-%20START%20HERE.md#open-questions) settles the order.

### G. Content, announcements, and security evidence

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `content_items` | One landing-page section, promotion, or featured-vehicle item | Content kind, optional vehicle, title, body, author, publication state, and publication dates | [R-08](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| `announcements` | One chief-executive announcement for employees | Title, body, author, publication state, published date, and optional expiry date | [R-22](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| `security_duty_checks` | One Head Security before-and-after duty check | Head Security account, duty date, before and after private media paths, notes, and completion time | [R-23](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |

### H. Recommendations and decision support

| Table | What one row represents | Important fields and links | Serves |
|---|---|---|---|
| `recommendation_runs` | One customer's request for ranked vehicle choices | Customer, budget, stated preferences, criteria version, and run date | [R-12](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-4-recommendations-can-be-explained) |
| `recommendation_results` | One vehicle's score and rank inside a recommendation run | Run, vehicle, budget score, condition score, fuel score, demand score, mileage score, total score, and rank | [R-12](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-4-recommendations-can-be-explained) |
| `recommendation_feedback` | One later outcome used to judge recommendation usefulness | Run, selected vehicle, helpful state, resulting transaction, outcome, and feedback date | [R-14](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-4-recommendations-can-be-explained) |

The five documented customer-ranking factors can be stored now. No separate management Decision Support System tables are proposed until [Q-05](00%20-%20START%20HERE.md#open-questions) confirms whether management pricing and market insights are part of the same tool. Existing vehicle, price, transaction, installment, and report records can support those views after the required outputs are approved.

## Main relationships

| From | Relationship | To |
|---|---|---|
| `auth.users` | One sign-in identity has one business profile and one current role | `profiles`, `private.user_roles` |
| `profiles` | One customer may own many documents, favourites, inquiries, transactions, and recommendation runs | Customer-facing records |
| `vehicles` | One vehicle may have many media items, inspections, repairs, price proposals, inquiries, and transactions | Vehicle-work records |
| `inquiries` | One inquiry may have many messages and one current arrangement | `inquiry_messages`, `viewing_arrangements` |
| `inquiry_messages` | One message may carry many attachments and may be reported | `message_attachments`, `message_reports` |
| `suppliers` | One supplier has its own documents, an optional sign-in account, and any direct messages | `supplier_documents`, `profiles`, `supplier_messages` |
| `vehicle_inspections` | One inspection has one answer per checklist entry, and a repair answer carries its replacement detail | `inspection_checklist_results`, `part_replacements` |
| `inspection_checklist_nodes` | One checklist entry may contain further entries beneath it | `inspection_checklist_nodes` |
| `transactions` | One transaction has one type-specific detail row and many status or document records | Purchase, Sell, or Request-a-Car details; history; documents |
| `installment_accounts` | One account has ordered installments, recorded payments, and collection actions | `installments`, `payment_records`, `collection_actions` |
| `field_cases` | One physical case may connect a vehicle, transaction, Confidential Informant, mechanic, expense, and evidence | Vehicle and operational records |
| `payroll_runs` | One run has many payslips, payslip items, approvals, and an optional disbursement request | Payroll and finance records |
| `recommendation_runs` | One run has ordered vehicle results and optional later feedback | Recommendation records |

## Controlled states

| Area | Proposed values | What is still open |
|---|---|---|
| Account | invited, active, suspended, archived | Walk-in activation and first access — [Q-17](00%20-%20START%20HERE.md#open-questions) |
| Vehicle | draft, inspecting, repairing, awaiting_price_approval, available, reserved, sold, archived | Final meaning of every business state |
| Inquiry | open, assigned, scheduled, handed_off, closed | Whether outside-channel conversations are imported |
| Transaction | pending, under_review, approved, rejected, completed, cancelled | Cancellation rules were not supplied |
| Installment | upcoming, due, paid, overdue, waived | Ultimatum length and recovery authorization — [Q-15](00%20-%20START%20HERE.md#open-questions) |
| Field case | assigned, accepted, in_progress, completed, cancelled | Proof and cancellation requirements |
| Approval | pending, approved, rejected | Payroll order and fund handoffs — [Q-13](00%20-%20START%20HERE.md#open-questions), [Q-14](00%20-%20START%20HERE.md#open-questions) |
| Payroll | draft, submitted, under_review, approved, paid, rejected | Final review and payment sequence — [Q-13](00%20-%20START%20HERE.md#open-questions) |
| Supplier | invited, registered, pending_approval, approved, rejected, suspended | Which group performs the approval — [Q-19](00%20-%20START%20HERE.md#open-questions) |
| Supplier kind | company, individual | Which extra details each kind must supply |
| Checklist answer | good, for_repair, for_replacement | The approved checklist entries themselves — [Q-27](00%20-%20START%20HERE.md#open-questions) |
| Vehicle document item | required, submitted, verified, rejected | Which documents are required — [Q-26](00%20-%20START%20HERE.md#open-questions) |
| Pricing type | negotiable, fixed | Whether a negotiated final price is recorded separately |
| Message report | open, reviewed, upheld, dismissed | Who reviews reports and what follows an upheld one |
| Payment terms | proposed, approved, rejected, active, completed | The allowed arrangements and their approver — [Q-22](00%20-%20START%20HERE.md#open-questions) |

Every movement between transaction states goes into `transaction_status_history`. Approval and money-related movements also go into `audit_events`. A status must never be changed merely to hide or overwrite an earlier decision.

## Proposed Storage buckets

| Bucket | Files | Public? | Access rule |
|---|---|---|---|
| `showroom-media` | Approved public vehicle photographs and 360-degree media | Yes | Anyone may read; only authorised Marketing or vehicle staff may publish or replace files |
| `vehicle-work` | Inspection, repair, acquisition, delivery, and recovery evidence | No | Only staff assigned to the vehicle or case and authorised managers may read |
| `customer-documents` | Valid IDs and proof of billing | No | The customer may upload and read their own files; authorised Sales and finance staff may review |
| `transaction-documents` | Invoices, receipts, sale documents, and payment paperwork | No | The customer may read their own permitted documents; authorised Sales and finance staff may manage |
| `staff-documents` | Payslip and payroll report files | No | The employee may read their own payslip; authorised payroll staff may prepare; required approvers may review |
| `business-evidence` | Reports and Head Security before-and-after photographs | No | Access follows the related report or security-duty record |
| `chat-attachments` | Photographs and files sent inside conversations | No | Only the people in that conversation and the staff assigned to it may read; reviewers may read a reported file |
| `supplier-documents` | Supplier valid IDs and invitation evidence | No | The supplier may upload and read their own files; the staff who create and approve supplier accounts may review |

Private files use short-lived signed links. Storage paths are arranged by the owning record's identifier rather than a person's typed name. Upload policies must check both the bucket and the related row; a guessed path must not grant access. — [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

## Role-by-role row access plan

These are proposed policy outcomes, not SQL. “Own” means the row points to the signed-in account. “Assigned” means the row names that staff member or a case assigned to them.

### Customer

- Read and change permitted parts of their own profile.
- Upload and read their own identification and proof-of-billing files; they cannot mark them verified.
- Read approved public vehicles and media; add and remove their own favourites.
- Read and add messages only in their own inquiries.
- Read their own arrangements, transactions, documents, payment records, installment schedule, and recommendation results.
- They cannot approve prices, payments, documents, payroll, reports, or transaction status changes.

### Supplier

- Read and change permitted parts of their own supplier record while it is still being prepared.
- Upload and read their own valid IDs and supporting files; they cannot mark them verified.
- Reach nothing at all until the approval decision on their record is `approved`.
- Read and add messages only in their own direct conversation, and only if that channel is confirmed by [Q-23](00%20-%20START%20HERE.md#open-questions).
- Cannot read customer, vehicle-work, transaction, payroll, finance, or another supplier's records. What else an approved supplier may do is not stated by the revision list and is not invented here.

### Chief executive

- Read the operational summaries and submitted reports needed for the executive dashboard.
- Read and write the direct supplier conversation, if that channel is confirmed.
- Decide the report, price, and fund requests assigned to the chief executive.
- Create and publish employee announcements.
- Read audit events for executive decisions.
- No automatic access is proposed to raw customer identification or every employee's detailed payslip; those require an explicit approved business need.

### Account Manager

- Maintain customer and employee profile records allowed by the final policy.
- Create and assign roles through a protected server action; ordinary profile updates cannot change roles.
- Read and manage inquiries, messages, viewing arrangements, attendance, employee requests, and payroll preparation records.
- Create payroll runs, payslips, payslip items, and relevant reports, but cannot approve their own submission unless the final payroll rule explicitly permits it.
- Contact buyers through installment collection work assigned to the role.

### Head Accountant

- Read inventory and completed sales information needed for financial cross-checking.
- Read attendance used for payroll checking and payroll records assigned for review.
- Manage installment accounts, installments, payment records, financial entries, disbursement records, and financial reports.
- Create collection actions and recovery instructions allowed by the final rule.
- Cannot change customer identity files or vehicle prices merely because they can read financial evidence.

### Confidential Informant

- Read and update only assigned acquisition, delivery, recovery, and sourcing field cases.
- Read the mechanic reports connected to assigned cases.
- Create related case expenses and disbursement requests.
- Cannot approve their own payment request or browse unrelated customer, payroll, or financial records.

### Marketing Specialist

- Create and change public content, promotions, featured-vehicle items, vehicle media, and price proposals.
- Read the vehicle information needed to prepare a listing.
- Cannot mark their own proposed price approved or publish a vehicle under an unapproved price.

### Mechanic

- Read assigned vehicles and field cases.
- Read the active checklist entries and create and change their own checklist answers and replacement details.
- Create and change their own assigned inspections and repair records.
- Upload related private vehicle-work evidence.
- Cannot change prices, transaction decisions, financial records, or another mechanic's assignment.

### Sales Manager

- Receive Buy Now cases and scheduled GCE-visit handoffs.
- Create a walk-in account only through the protected server process required by [Q-17](00%20-%20START%20HERE.md#open-questions).
- Read the customer documents required for an assigned purchase and record their verification result.
- Manage assigned Buy and Sell transaction details, paperwork, and completed sales information.
- Cannot read unrelated customer identification or approve financial records outside the role's documented responsibility.

### Head Security

- Read and change their own attendance and employee requests.
- Create and complete their own security-duty checks and upload the before-and-after evidence.
- Cannot read unrelated vehicle, customer, finance, payroll, or security records belonging to another duty record.

## Index and constraint plan

| Need | Proposed protection |
|---|---|
| Public catalogue filters | Index available and posted vehicles by state, make, model, year, approved price, fuel, and mileage; use a smaller index containing only currently available listings |
| Vehicle identity | Unique stock code; optional VIN is unique when present |
| Favourites | Unique customer-and-vehicle pair |
| Inquiry queue | Index open inquiries by assigned Account Manager, assigned Sales Manager, state, and last activity |
| Message history | Index messages by inquiry and sent time |
| Transaction lookup | Index transactions by customer, vehicle, kind, state, and opened date |
| Status history | Index by transaction and change time |
| Installment follow-up | Unique account-and-sequence pair; index unpaid installments by due date |
| Field assignments | Index open cases by assigned Confidential Informant, mechanic, case kind, and state |
| Attendance | Unique employee-and-work-date pair |
| Payroll | Prevent overlapping finalised payroll periods; unique payroll-run-and-employee payslip |
| Reports and approvals | Index pending reports, price proposals, disbursement requests, and payroll approvals by decision state and submitted date |
| Money | Require amounts to be zero or positive and use fixed two-decimal values |
| Year and score ranges | Reject impossible vehicle years, negative mileage, ranks below one, and scores outside their approved scale |
| Supplier identity | Require the supplier kind to be company or individual; require the approval decision before the account may sign in; require at least two verified primary valid IDs before approval |
| Checklist answers | Unique inspection-and-checklist-entry pair; allow a replacement detail row only when the answer is for_repair or for_replacement |
| Checklist structure | Prevent an entry from being its own parent; index entries by parent and display order |
| Vehicle documents | Unique vehicle-and-document-kind pair; index outstanding required documents by vehicle |
| Listing prices | Require the pricing type to be negotiable or fixed on any posted vehicle |
| Chat attachments and reports | Index attachments by message; index open reports by state and reported time |
| Field limits | Apply the agreed smallest and largest numbers, text lengths, and formats as database constraints as well as browser checks, once [Q-25](00%20-%20START%20HERE.md#open-questions) supplies the values |

Indexes must follow real page and report searches. This list is the starting set, not permission to index every column. Supabase's PostgreSQL guidance recommends indexes for foreign keys and frequent filters while avoiding unused indexes that slow changes. — [Supabase index guidance](https://supabase.com/docs/guides/database/postgres/indexes)

## Realtime plan

Realtime is proposed only for:

- new inquiry messages;
- message read-state changes;
- an inquiry assignment or handoff relevant to the connected customer or assigned staff member;
- a transaction status change relevant to its customer or assigned staff member; and
- an employee announcement becoming published.

Payroll amounts, customer identification, financial entries, security photographs, and general audit events are not broadcast. Their pages read protected current records when opened. Realtime channel access must follow the same ownership and assignment rules as the underlying rows. — [Supabase Realtime](https://supabase.com/docs/guides/realtime)

## How the open questions affect implementation

| Question | Safe schema position now | What waits for the answer |
|---|---|---|
| Q-04 | Store offline payment, financial, and approval records | Any broader accounting or payment-processing behaviour |
| Q-05 | Store customer recommendation runs, results, and feedback | Separate management Decision Support System tables or measures |
| Q-06 | Keep one account and shared records for one responsive application | Any split into separate customer and employee applications |
| Q-08 | Use Supabase Auth identities and a profile extension | The exact registration, verification, recovery, and sign-in screens |
| Q-12 | Store submitted documents and verification results | The final financing-eligibility decision rules |
| Q-13 | Store each payroll approval with an optional sequence | Enforcing a fixed approval order or automatic salary-payment readiness |
| Q-14 | Store each disbursement event without assuming its order | Enforcing who requests, releases, receives, and finally pays each fund type |
| Q-15 | Store notices, deadlines, instructions, and results | Automatic ultimatum deadlines or recovery authorization |
| Q-16 | Store each entered payslip item and calculation note | Automatic salary and government-deduction formulas |
| Q-17 | Store creator and activation state for a walk-in account | Credential delivery, consent, identity confirmation, and first-access enforcement |
| Q-18 | Store common arrangement fields | Arrangement-specific required fields, charges, and confirmation rules |
| Q-19 | Record whoever created the supplier account in `suppliers.created_by` | A Procurement Team role value and its own permissions |
| Q-20 | Record the creation route and an optional invitation evidence path | Whether the supplier portal exists at all, and what evidence it must carry |
| Q-21 | Record each document's kind and whether it counts as a primary valid ID | The list of accepted IDs and whether the two-ID rule also applies to customers |
| Q-22 | Store the agreed payment arrangement and its approval | Which arrangements are allowed and who approves them |
| Q-23 | Keep `supplier_messages` in the plan but unbuilt | Whether the direct channel exists |
| Q-24 | Nothing; no table is affected | What the downloadable application is |
| Q-25 | Apply the obvious kind, sign, and uniqueness rules already listed | The agreed numeric limits, text lengths, and formats per field |
| Q-26 | Store one row per required document with its state | Which document kinds are required |
| Q-27 | Store versioned checklist entries with no entries created | The approved systems, components, and parts |
| Q-28 | Store the message as written and filter on display | The word list, languages, and whether words are hidden or censored |

## Schema build order

The database should follow the existing roadmap rather than being created as one unreviewed batch.

| Order | Tables introduced | Why this order |
|---|---|---|
| 1. Shared foundation | Profiles, protected roles, customer documents, audit events, suppliers, supplier documents | Every later record needs a recognised person and enforceable role, and a supplier must be approved before it can act. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-1-one-shared-foundation) |
| 2. Vehicles | Vehicles, media, inspections, repairs, price proposals, favourites, public content, checklist entries, checklist answers, replacement details, vehicle document items | Inquiries, recommendations, and transactions all need reliable vehicle records, and the inspection report is built from the checklist answers. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-2-vehicles-can-be-found-and-understood) |
| 3. Conversations | Inquiries, messages, attachments, message reports, arrangements | Establish ownership and handoffs before transaction work depends on them. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-3-conversations-stay-together) |
| 4. Recommendations | Recommendation runs, results, and feedback | Vehicle and inspection information must exist first. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-4-recommendations-can-be-explained) |
| 5. Transactions | Transactions, type details, history, documents, payments, payment terms, installments, collection actions, field cases | These records depend on people, vehicles, conversations, and inspections. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-5-transactions-can-be-followed) |
| 6. Staff and management | Attendance, requests, compensation, payroll, finance, disbursements, reports, announcements, security checks, and supplier messages if confirmed | These areas depend on the operational records they summarize or approve. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-6-staff-and-managers-can-run-the-business) |
| 7. Acceptance | Acceptance feedback | Feedback becomes meaningful after intended journeys can be used. — [07 - DEVELOPMENT ROADMAP](07%20-%20DEVELOPMENT%20ROADMAP.md#phase-7-mobile-use-and-acceptance-are-checked) |

## Before any migration is written

1. Confirm Q-12 through Q-28 with the named business owners.
2. Review every table against its exact customer and staff screens.
3. Approve the role-by-role read and change rules.
4. Approve private-file retention and removal rules.
5. Confirm which reports are live views and which are submitted snapshots.
6. Turn one roadmap phase at a time into reviewed Supabase migrations.
7. Test every Row Level Security policy as the customer, an unapproved supplier, an approved supplier, and all eight operational roles, including denied actions.
8. Run Supabase security and performance advisors before treating a migration as ready.

No SQL is included here. The first migration should begin only after the relevant open questions and access rules are approved.
