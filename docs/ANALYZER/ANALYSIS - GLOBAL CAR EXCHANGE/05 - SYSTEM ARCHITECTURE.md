# 05 - SYSTEM ARCHITECTURE

[[00 - START HERE|Back to start]] · Previous: [[02 - DOCUMENT FINDINGS]] · Next: [[06 - DIAGRAMS]]

## How to read this note

The first section explains what can be known about today's arrangement. The second explains the arrangement proposed by the documents. No part is called “already there” because no source code or live system was supplied. [[11 - TECH STACK]] names the proposed implementation choices, and [[12 - DATABASE SCHEMA]] gives the proposed table-level design.

## The arrangement today

### The parts

| Part | Status | What is known |
|---|---|---|
| Social-media and phone conversations | ❓ Unclear | The chapter document says Facebook, Viber, WhatsApp, and phone calls are currently disconnected, but no direct evidence from those channels was supplied. — **GCE FULL CHAPTER 1 - 3.docx**, page 14 |
| Spreadsheets and paper records | ❓ Unclear | The chapter document describes spreadsheet inventory, Excel tracking, paper finance records, and handwritten follow-up as current problems, but the files themselves were not supplied. — **GCE FULL CHAPTER 1 - 3.docx**, pages 10 and 14 |
| Web pages described in Chapter 3 | ❓ Unclear | Browse, detail, favourites, messages, notifications, and profile behaviour are described, but the working files are absent. — **GCE FULL CHAPTER 1 - 3.docx**, pages 33–43 |

### How work passes between them

The documents say vehicle information is placed in separate advertisements and spreadsheets. Customer conversations then arrive through several outside channels. Follow-up and finance records are handled separately. This is the problem the proposed system is meant to replace, but the present-day path cannot be independently checked. — **GCE FULL CHAPTER 1 - 3.docx**, pages 10 and 14

### Where things are kept

The current storage arrangement is not shown. The manuscript mentions spreadsheets, notes, and paper records but gives no filenames, owners, access rules, or master record. — **GCE FULL CHAPTER 1 - 3.docx**, pages 10 and 14

### Where it touches the outside world

The current work is said to use Facebook, Viber, WhatsApp, phone calls, paper records, and third-party listing sites. The material does not say whether the proposed system will connect to these services or merely replace their business use. — **GCE FULL CHAPTER 1 - 3.docx**, pages 12, 14, and 16–17

### What holds the arrangement together

The material does not describe a current technical arrangement. Its Chapter 3 data-flow picture refers to residents and a generic administrator rather than Global Car Exchange. Its architecture page contains a dummy image. These cannot be used as evidence of a real system. — **GCE FULL CHAPTER 1 - 3.docx**, pages 44–45

## The arrangement being proposed

The picture below is *drawn from* the stated scope, page-flow descriptions, and additional feature list. It is a plain arrangement of the promised responsibilities, not proof of a chosen technology.

### What changes and why

| Part | Status | What it is for | Why it is being added |
|---|---|---|---|
| Responsive customer and staff pages | ⭕ Proposed | Give people one browser-based place to use the system on computers and phones | Mobile access and one shared platform are explicit goals. — **GCE FULL CHAPTER 1 - 3.docx**, pages 15–17 and 21 |
| Identity and access area | ⭕ Proposed | Register people, verify contact details, create walk-in accounts, keep profiles, and show each role only its work | Accounts, identification, walk-in account creation, and Account Manager control of role access are required. — **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 5. RBAC (Role-Based Access Control)” and “Sales Manager — 3. Walk-In Client Purchasing a Vehicle (No Account)” through “Sales Manager — 4. Walk-In Client Selling Their Own Vehicle” |
| Shared information store | ⭕ Proposed | Keep customers, vehicles, conversations, transactions, inspections, and staff records together | The system is meant to replace scattered spreadsheets, paper, and conversations. — **GCE FULL CHAPTER 1 - 3.docx**, pages 10–16 |
| Vehicle inventory and Virtual Showroom | ⭕ Proposed | Hold live vehicle details, photographs, 360-degree views, filters, and favourites | Customers need current information and remote vehicle viewing. — **GCE FULL CHAPTER 1 - 3.docx**, pages 12, 19, and 22; **GCE ADDITIONAL DOCUMENTS.docx**, page 2 |
| Inquiry and sales handoff area | ⭕ Proposed | Route Inquiry and Buy Now actions, keep conversations and schedules, fill arrangement forms, and hand GCE visits to the Sales Manager | The newest material separates inquiry and sales ownership and describes the visit handoff. — **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 2. Inquiries and Viewing Schedule” and “Sales Manager — 1. Buy Now and Inquiry Handling” |
| Decision Support System | ⭕ Proposed | Rank matching vehicles and provide management decision information | Buyer recommendations and management insights are both requested, although their final boundary is open. — **GCE FULL CHAPTER 1 - 3.docx**, pages 13, 16, and 19–20; **GCE ADDITIONAL DOCUMENTS.docx**, pages 2–3 |
| Transaction and sales-record area | ⭕ Proposed | Follow Buy, Sell, and Request-a-Car work through named statuses and keep sales, buyer, payment, and paperwork records | The documents define three transaction types, a shared status path, and Sales Manager record duties. — **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Sales Manager — 5. Record of Sales” through “Sales Manager — 6. Paperwork” |
| Inspection, repair, and sourcing area | ⭕ Proposed | Record acquisition inspections, repair progress, mechanic reports, vehicle assignments, delivery, and recovery work | The current roles assign these handoffs to the Mechanic and Confidential Informant. — **GCE USERS LEVELS MODULES.md**, headings “Confidential Informant” and “Mechanic” |
| Staff and payroll area | ⭕ Proposed | Keep attendance, leave, overtime, late-arrival, salary, deduction, payroll, and payslip records | Payroll is now in scope, although its final approval order and calculations remain open. — **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements” and “Head Accountant — 2. Payroll” |
| Finance and reporting area | ⭕ Proposed | Keep allowed payment, financing, disbursement, installment, expense, sales, and management records | Detailed financial handoffs and monitoring are in scope; direct online payment processing is not. — **GCE FULL CHAPTER 1 - 3.docx**, pages 16–20; **GCE USERS LEVELS MODULES.md**, headings “CEO — 2. Approval and Rejection of Reports”, “Head Accountant”, and “Confidential Informant — 6. Payment Approval Process” through “Confidential Informant — 7. Case Expenses” |
| Content and announcements area | ⭕ Proposed | Manage public vehicle posts and approved prices and send employee announcements | The Marketing Specialist submits vehicle prices for chief-executive approval, and the chief executive creates employee announcements. — **GCE USERS LEVELS MODULES.md**, headings “CEO — 3. Announcements” and “Marketing Specialist” |
| Security evidence area | ⭕ Proposed | Keep attendance requests and before-and-after photographs of locks and the building's security condition | Head Security is assigned these records. — **GCE USERS LEVELS MODULES.md**, heading “Head Security” |
| Supplier registration and approval area | ⭕ Proposed | Create supplier accounts, record Company or Individual, collect two primary valid IDs, keep invitation evidence, and hold the account closed until GCE approves it | The revision list restores supplier work and gives the account-creation duty to the Procurement Team. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management” |
| Shared form and check layer | ⭕ Proposed | Fill forms from stored details, check every field against its stated limits, and ask for confirmation before a submission, approval, or deletion | Automatic filling, field checks, and confirmation prompts are required across all relevant areas. — **REVISIONS LISTS.md**, headings “4. Autofill Functionality”, “8. Form Data Validation”, and “14. Submission, Approval, and Deletion Confirmation” |
| Message safety and reporting layer | ⭕ Proposed | Carry photographs and files inside chat, let a user report a message, and hide or censor inappropriate words | The revision list adds attachments, reporting, and an automatic word filter to the chat. — **REVISIONS LISTS.md**, heading “1. Chat, Notifications, and Reports” |

### How work would pass between them

A customer would enter through the responsive pages. Identity checks would connect that person to a profile. Vehicle browsing would read from the shared inventory and showroom. A recommendation request would combine customer preferences, vehicle information, mechanic condition scores, and sales history before ranking available vehicles. — **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3

An Inquiry action would enter the Account Manager's queue, while a Buy Now action would go to the Sales Manager. Registration details would fill the later form automatically. For an inquiry that becomes a visit, the Account Manager would arrange the schedule and the Sales Manager would take over when the client arrives. Delivery, meet-up, and GCE-visit choices would remain attached to the case. — **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 2. Inquiries and Viewing Schedule” and “Sales Manager — 1. Buy Now and Inquiry Handling”

A Buy, Sell, or Request-a-Car record would move through the shared status path. A registered buyer's details would fill the sale form, while the Sales Manager would create an account for a walk-in buyer or seller. A purchase would still require two valid IDs and proof of billing. Sell work would wait for mechanic review and valuation. Request-a-Car work would pass from the Sales Manager to a Confidential Informant for sourcing. Approved financial settlement would still happen outside the system, while the system keeps the permitted record and paperwork. — **GCE FULL CHAPTER 1 - 3.docx**, page 16; **GCE ADDITIONAL DOCUMENTS.docx**, page 2; **GCE USERS LEVELS MODULES.md**, headings “Sales Manager — 2. Purchasing a Vehicle Through the Website and Visiting GCE” through “Sales Manager — 6. Paperwork”

Attendance, leave, overtime, and late-arrival records would feed payroll preparation. The Account Manager would enter salary and deduction amounts and send the payroll report onward. The Head Accountant would check attendance and carry salary-payment responsibility, while the chief executive would review the stated reports. The source does not settle the exact approval order. — **GCE USERS LEVELS MODULES.md**, headings “CEO — 2. Approval and Rejection of Reports”, “Account Manager — 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements”, and “Head Accountant — 2. Payroll” through “Head Accountant — 6. Attendance Monitoring”

Vehicle-purchase and case-payment requests would move through the chief executive, Head Accountant, and Confidential Informant, but the two described fund paths are not joined into one final handoff. Installment due dates would trigger Account Manager contact and could lead to a Confidential Informant recovery assignment. Repair progress, approved vehicle posts, employee announcements, sales records, and Head Security photographs would also use the shared information. — **GCE USERS LEVELS MODULES.md**, headings “CEO”, “Head Accountant”, “Confidential Informant”, “Marketing Specialist”, “Mechanic — 2. Repair Progress Tracking”, “Sales Manager — 5. Record of Sales”, and “Head Security — 2. Proof of Duty”

A supplier would not open its own working account. The Procurement Team would create it, or a retained supplier portal would carry evidence that GCE invited the supplier. Either way the supplier states whether it is a Company or an Individual, supplies two primary valid IDs from the published list, and waits for GCE approval before the first sign-in. This path is pictured in [[06 - DIAGRAMS#11. Supplier registration and approval]]. The group named as the Procurement Team is not one of the eight described roles, so no permissions are assigned to it here. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management”

A mechanic would work down the nested checklist of vehicle systems, components, and parts. Marking a part for repair or replacement would open fields for the replacement item name, brand, and estimated cost. The inspection report would then read those answers rather than asking for them a second time. This path is pictured in [[06 - DIAGRAMS#12. Checklist to inspection report]]. — **REVISIONS LISTS.md**, headings “11. Mechanic Inspection Checklist” through “13. Inspection Report”

Three pieces of behaviour would cross every area rather than belonging to one. Forms would fill themselves from details already stored. Every field would be checked against its stated limits before the record is accepted. Submissions, approvals, and deletions would ask for confirmation in the same words everywhere. — **REVISIONS LISTS.md**, headings “4. Autofill Functionality”, “8. Form Data Validation”, and “14. Submission, Approval, and Deletion Confirmation”

This proposed hand-off is pictured in [[06 - DIAGRAMS#8. The proposed arrangement]].

### What it would take to get there

The shared identity rules and information store must come first because every later part needs recognised people and consistent records. Vehicle inventory comes next because browsing, recommendations, inquiries, inspections, and transactions all refer to vehicles. Conversations and recommendations can then be added before the three transaction paths. Staff work, finance, payroll, reporting, and mobile acceptance checks complete the proposed arrangement. This order is *drawn from* the dependencies across **GCE FULL CHAPTER 1 - 3.docx**, pages 14–22; **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; and **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”. The exact order appears in [[07 - DEVELOPMENT ROADMAP]].

### What is being given up

The proposed boundary gives up direct online payment, offline use, automatic outside-marketplace listings, automatic logistics, live delivery tracking, advanced marketing campaigns, benefits administration, and full accounting. It keeps human delivery assignments, meet-ups, GCE visits, recovery work, and payroll. A supplier registration and approval area is now proposed again. The native-application exclusion is no longer a settled boundary, because the revision list asks for an in-system application download; that conflict stays open as [[00 - START HERE#Open questions|Q-24]] rather than being decided here. — **GCE FULL CHAPTER 1 - 3.docx**, pages 16–17; **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”; **REVISIONS LISTS.md**, headings “5. Supplier Registration and Account Management” and “7. Mobile Application Download”
