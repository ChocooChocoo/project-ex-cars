# 16 - USER LEVEL AND PROCESS GUIDE

[Back to start](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Related: [13 - USER ACCOUNTS](13%20-%20USER%20ACCOUNTS.md) · [14 - AUDIT USER ROLES](14%20-%20AUDIT%20USER%20ROLES.md) · [15 - SYSTEM STATUS](15%20-%20SYSTEM%20STATUS.md) · [17 - ROADMAP AUDIT](17%20-%20ROADMAP%20AUDIT.md)

**Written:** 10 August 2026
**Type:** Review only. Nothing was changed, added, or fixed while writing this.

---

## How to read this guide

This file answers three questions for every user level and every page:

1. **What is it for in real life?** Written for a person doing the job, not for a programmer.
2. **What do the capstone documents say?** Taken only from the files in `docs/`.
3. **Does the system actually do that?** Checked against the running application's role rules, pages, and actions.

Every section ends with a verdict:

| Verdict | Meaning |
|---|---|
| **Matches** | The documents and the system say the same thing. |
| **Partly matches** | The purpose is built, but a rule, a step, or an owner is different. |
| **Does not match** | The documents describe something the system does not do, or the system does something the documents never described. |
| **Unclear** | The documents do not say enough to judge. Recorded, not guessed. |
| **Unverified** | Could not be confirmed from the files available. Recorded, not guessed. |

**Sources used**

- `docs/DOCUMENTS/GCE USERS LEVELS MODULES.md` — the role and responsibility list (primary).
- `docs/DOCUMENTS/REVISIONS LISTS.md` — the newest instructions; controls where it overlaps older material.
- `docs/ANALYZER/ANALYSIS - GLOBAL CAR EXCHANGE/` — overview, findings, architecture, accounts, prior audit, live status.
- The application itself, for the "what is implemented" column.

The two `.docx` files in `docs/DOCUMENTS/` are summarised inside the ANALYZER notes; their content is used through those notes, not read directly here.

---

## Part 0 — The business in one page

Global Car Exchange (GCE) buys used vehicles, checks and repairs them, prices them, advertises them, and sells them — sometimes for cash, sometimes on an installment plan. Everything the system does supports one of five repeating cycles.

| Cycle | Plain description | Who leads it |
|---|---|---|
| **Get a car in** | Someone finds a car, a mechanic checks it, GCE releases money, someone collects it. | Confidential Informant, Mechanic, Head Accountant, CEO |
| **Put a car on sale** | The car is listed, a price is proposed, the CEO approves the price, the listing goes public. | Marketing Specialist, CEO |
| **Sell a car** | A customer asks or buys, a viewing is arranged, documents are collected, the sale is recorded, the car is marked sold. | Account Manager, Sales Manager |
| **Collect the money** | Payment terms, installment schedule, verification, reminders, and — as a last step — recovery of the vehicle. | Head Accountant, Account Manager, Confidential Informant |
| **Run the company** | Attendance, leave, payroll, payslips, reports, announcements, building security. | Account Manager, Head Accountant, CEO, Head Security |

There are **ten user levels**: eight who work at GCE and two who come from outside.

```
OUTSIDE                         INSIDE GCE
Customer  ──asks / buys──▶  Account Manager ──hands over──▶ Sales Manager
Supplier  ──supplies────▶   CEO (approves everything important)
                            Head Accountant (money and payroll)
                            Marketing Specialist (listings and prices)
                            Mechanic (vehicle condition)
                            Confidential Informant (field work)
                            Head Security (building security)
```

---

# PART 0.5 — THE SIDEBAR: WHERE EVERY PROCESS LIVES

Use this part to find a page. The menu is one shared list; each role is shown only the items granted to it, and a group with no granted items disappears entirely.

## 0.5.1 The full menu, group by group

Below is every item the sidebar can show, in the order it appears, with the page it opens and the section of this guide that explains it.

### Group 1 — "Dashboards"

| Menu item | Opens | Explained in | Granted to |
|---|---|---|---|
| **Default** | Dashboard | [2.1](#21-dashboard) | All 8 staff roles |
| **Finance** | Finance ledger and money requests | [2.23](#223-finance--a-page-the-documentation-does-not-describe) | CEO, Head Accountant, Account Manager, Informant |
| CRM, Analytics, Productivity, E-commerce, Academy, Logistics, Infrastructure | Interface-template demo screens | — | Nobody |

> **Finance is the important one.** A menu entry for it exists and points at the real GCE money page. It is now granted to the CEO, Head Accountant, Account Manager, and Confidential Informant (who sees only their own requests), so it appears in those four menus. The page is still absent from the documentation and from the access table in `13 - USER ACCOUNTS`.

### Group 2 — "Operations"

Everything about cars and customers.

| Menu item | Opens | Explained in | Granted to |
|---|---|---|---|
| **Vehicles** | Vehicle inventory | [2.2](#22-vehicles-inventory) | All 8 staff roles |
| **Showroom** | Public showroom as staff preview | [2.3](#23-showroom-staff-view) | CEO, Marketing, Sales Manager |
| **Content** | Landing page, promos, featured cars | [2.4](#24-content) | CEO, Marketing |
| **Inspections** | Mechanic checklists, reports, **vehicle document checklist** | [2.5](#25-inspections) | CEO, Account Manager, Informant, Mechanic, Sales Manager |
| **Inquiries** | Customer conversations and viewing schedules | [2.6](#26-inquiries) | CEO, Account Manager, Sales Manager |
| **Recommendations** | Management insight dashboard | [2.7](#27-recommendations--insights-staff) | CEO, Account Manager, Sales Manager |
| **Transactions** | Every buy, sell, and request | [2.8](#28-transactions) | CEO, Account Manager, Head Accountant, Informant, Sales Manager |
| **Roadmap** | Platform planning board | [2.9](#29-roadmap) | CEO, Account Manager, Sales Manager |
| **Suppliers** | Create, verify, approve suppliers | [2.10](#210-suppliers) | CEO, Account Manager |
| Favourites | Saved cars | — | Nobody (customer-side feature listed in the staff group) |

### Group 3 — "Staff Management"

Everything about people, money, field work, and reporting.

| Menu item | Opens | Explained in | Granted to |
|---|---|---|---|
| **Staff Records** | Employee files, reviews, walk-in accounts | [2.11](#211-staff-records) | CEO, Account Manager, Sales Manager |
| **Attendance** | Clock in/out and checking | [2.12](#212-attendance) | CEO, Account Manager, Head Accountant, Head Security |
| **Requests** | Leave and overtime | [2.13](#213-employee-requests) | CEO, Account Manager, Head Security |
| **Payroll** | Compensation, runs, approvals | [2.14](#214-payroll) | CEO, Account Manager, Head Accountant |
| **Payslips** | Individual pay records | [2.15](#215-payslips) | CEO, Account Manager, Head Accountant |
| **Field Cases** | Sourcing, acquisition, delivery, recovery | [2.16](#216-field-cases) | CEO, Account Manager, Informant, Mechanic, Sales Manager |
| **Security Checks** | Before/after duty photographs | [2.17](#217-security-duty-checks) | CEO, Head Security |
| **Reports** | Submit and review reports | [2.18](#218-reports) | CEO, Account Manager, Head Accountant |
| **Announcements** | Company news | [2.19](#219-announcements) | CEO, Account Manager, Head Accountant, Informant, Marketing, Mechanic, Sales Manager, Head Security |
| **Suppliers** *(second item with this name)* | CEO ↔ supplier message thread | [2.20](#220-supplier-messages) | CEO |

> **Two menu items are both labelled "Suppliers".** The CEO sees one under Operations (creating and approving suppliers) and a second under Staff Management (messaging them). Same word, two different jobs. Worth renaming the second to "Supplier Messages".

### Group 4 — "Pages"

| Menu item | Opens | Explained in | Granted to |
|---|---|---|---|
| **Users** | All accounts, staff and customer | [2.22](#222-users) | CEO, Account Manager |
| **Roles** | Assign a role to a person | [2.21](#221-roles) | CEO, Account Manager |
| Email, Chat, Calendar, Kanban, Invoice, Authentication | Interface-template demo screens | — | Nobody |

### Groups 5 and 6 — "Legacy" and "Misc"

Old dashboard variants kept for reference and a disabled placeholder. Granted to nobody. They never appear.

### Group 7 — "Customer Portal"

Shown to customers and suppliers. See [2.24](#224-customer-and-supplier-pages).

| Menu item | Opens |
|---|---|
| **Showroom** | Browse available cars |
| **Find Your Car** | Ranked recommendations |
| **My Inquiries** | Conversations with GCE |
| **Transactions** | Their buys, sells, and requests |
| **Request a Car** | Ask GCE to source one |
| **Sell Vehicle** | Offer their own car |
| **Favourites** | Saved shortlist |

## 0.5.2 What each role actually sees

Read down the column for the role you are interested in. This is the menu, in order, exactly as that person sees it.

### CEO — 23 items (everything)

```
Dashboards        Default · Finance
Operations        Vehicles · Showroom · Content · Inspections · Inquiries ·
                  Recommendations · Transactions · Roadmap · Suppliers
Staff Management  Staff Records · Attendance · Requests · Payroll · Payslips ·
                  Field Cases · Security Checks · Reports · Announcements · Suppliers
Pages             Users · Roles
```

### Account Manager — 19 items

```
Dashboards        Default · Finance
Operations        Vehicles · Inspections · Inquiries · Recommendations ·
                  Transactions · Roadmap · Suppliers
Staff Management  Staff Records · Attendance · Requests · Payroll · Payslips ·
                  Field Cases · Reports · Announcements
Pages             Users · Roles
```
Missing compared with the CEO: Showroom, Content, Security Checks, Supplier Messages.

### Head Accountant — 9 items

```
Dashboards        Default · Finance
Operations        Vehicles · Transactions
Staff Management  Attendance · Payroll · Payslips · Reports · Announcements
```
**Note:** Finance is now in the menu. Field Cases has no menu link, but the page itself admits them to view cases and create repossession cases (findings A-3 and A-7 resolved).

### Sales Manager — 11 items

```
Dashboards        Default
Operations        Vehicles · Showroom · Inspections · Inquiries ·
                  Recommendations · Transactions · Roadmap
Staff Management  Field Cases · Staff Records · Announcements
```
**Note:** no Reports — the documented inventory report still has no owner here. Findings A-5 and A-9 resolved.

### Confidential Informant — 7 items

```
Dashboards        Default · Finance
Operations        Vehicles · Inspections · Transactions
Staff Management  Field Cases · Announcements
```

### Marketing Specialist — 5 items

```
Dashboards        Default
Operations        Vehicles · Showroom · Content
Staff Management  Announcements
```

### Mechanic — 5 items

```
Dashboards        Default
Operations        Vehicles · Inspections
Staff Management  Field Cases · Announcements
```

### Head Security — 6 items

```
Dashboards        Default
Operations        Vehicles
Staff Management  Attendance · Requests · Security Checks · Announcements
```
**Note:** Attendance, Employee Requests, and Announcements are now in the menu (finding A-6 resolved).

### Customer and Supplier — 7 items each

```
Customer Portal   Showroom · Find Your Car · My Inquiries · Transactions ·
                  Request a Car · Sell Vehicle · Favourites
```
Both outside roles are granted the identical seven. The documents describe a three-link header bar instead, and give the supplier only five pages. See findings A-10 and E-4.

## 0.5.3 Quick lookup — "which page do I need?"

| I need to… | Go to | Role needed |
|---|---|---|
| Add a car, or set its price | Vehicles | CEO, Marketing, Sales Manager |
| Approve a price so a car can be posted | Vehicles | CEO only |
| Record what condition a car is in | Inspections | Mechanic (CEO may also) |
| Check which vehicle documents are still missing | Inspections | CEO, Account Manager, Informant, Mechanic, Sales Manager |
| Answer a customer's question, or book a viewing | Inquiries | Account Manager (CEO, Sales Manager may view) |
| Take over a customer who has arrived | Inquiries | Sales Manager |
| Create an account for a walk-in | Staff Records | CEO, Account Manager |
| Move a sale forward, or verify a buyer's IDs | Transactions | Sales Manager, CEO, Account Manager, Head Accountant |
| Set up an installment plan | Transactions | Head Accountant approves; CEO/Account Manager activate |
| Start a repossession | Transactions | Head Accountant only |
| Send someone to collect or deliver a car | Field Cases | CEO, Informant, Sales Manager |
| Send a mechanic along on a trip | Field Cases | CEO, Informant, Sales Manager |
| Release money for a car purchase | Finance | Head Accountant only |
| Ask for money for a case | Finance | CEO, Account Manager, Informant |
| Approve someone's leave | Requests | CEO, Account Manager |
| Build the payroll | Payroll | CEO, Account Manager |
| Pay the staff | Payslips | Head Accountant only |
| Change what someone can see | Roles | CEO, Account Manager |
| Tell the whole company something | Announcements | CEO only |
| Prove the building was locked | Security Checks | Head Security |
| Talk to a supplier | Suppliers *(Staff Management group)* | CEO |
| Approve a new supplier | Suppliers *(Operations group)* | CEO, Account Manager |

---

# PART 1 — THE USER LEVELS

---

## 1.1 CEO

### Who they are
The owner and top decision-maker. They do not run any single desk; they watch all of them and give the final "yes" on the decisions that cost money or become public.

### A normal day
Open the dashboard, look at how many cars sold, how much money came in, what is waiting for approval. Approve or reject the prices Marketing proposed so those cars can go live. Read the reports Finance and Admin submitted. Post an announcement when there is company news. Reply to a supplier if one wrote in.

### What the CEO can open
Everything. Dashboard, Finance, Vehicles, Showroom, Content, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Suppliers, Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Security Duty Checks, Reports, Announcements, Supplier Messages, Roles, Users.

### What only the CEO can do
- Approve or reject a proposed vehicle price. Nobody else can.
- Create, publish, expire, and archive announcements.
- Delete a vehicle record.
- Message suppliers directly.

### RBAC enforcement (Aug 2026)

Operational CRUD is now assigned to the owning roles, not the CEO. Vehicle creation, editing, posting, and media stay with the Marketing Specialist; inspections, repairs, and checklist entry with the Mechanic; vehicle documents with the Sales Manager. The CEO keeps company-wide visibility, the approval/rejection authority on price proposals, reports, and disbursements, announcement publishing, and vehicle deletion. Page-level guards now match the sidebar, so no staff role can open a page by typing its address unless the menu grants it.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Receives from | Marketing Specialist | Price proposals waiting for approval |
| Receives from | Account Manager, Head Accountant | Reports submitted for review |
| Sends to | All staff | Announcements |
| Sends to | Head Accountant | A request to release money for a car purchase |
| Works with | Sales Manager | Assigning a Confidential Informant to source a requested car |
| Talks to | Supplier | Direct message thread |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Executive dashboard giving full oversight | CEO-only operations overview on the dashboard with live counts and drill-down links | **Matches** |
| Approves/rejects payslip and disbursement reports (Account Manager), expense and revenue reports (Head Accountant), price proposals (Marketing), inventory reports (Sales Manager) | One Reports page where Account Manager, Head Accountant, and CEO submit and CEO or Head Accountant review. Price approval is separate and CEO-only. | **Partly matches** — the four report types are not separate, named streams with fixed owners; they are one general report list. |
| Creates announcements for employees | CEO-only create → publish → expire/archive | **Matches** |
| Approves cars for inventory | There is no separate "approve this car" button. A car cannot be published until its price proposal is approved, so the price approval is the approval. | **Partly matches** — deliberate substitution, already recorded in the analyzer notes. |

---

## 1.2 Account Manager

### Who they are
The office manager and HR person combined. First point of contact for customers who are still asking questions, and the person who keeps employee records and prepares payroll.

### A normal day
Answer customer inquiries in the chat. Set a viewing schedule when a customer wants to come to the lot. Hand the customer to the Sales Manager when they actually arrive. Check who clocked in. Approve leave and overtime requests. Once a period closes, build the payroll run and send it for review. Create accounts for walk-in customers. Change someone's role when their job changes.

### What they can open
Dashboard, Finance, Roles, Users, Vehicles, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Suppliers, Staff Records, Attendance, Employee Requests, Payroll, Payslips, Field Cases, Reports, Announcements.

### What only they (with the CEO) can do
- Assign roles to staff — this is the access-control desk.
- Open Staff Records and the Users list.
- Approve or reject leave and overtime requests.
- Prepare a payroll run.
- Create supplier records.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Talks to | Customer | Inquiry chat, viewing arrangements |
| Hands to | Sales Manager | A customer who is arriving for a GCE visit |
| Sends to | Head Accountant | The prepared payroll run, for review |
| Sends to | CEO | Reports for approval |
| Receives from | Head Accountant | A notice that an installment fell due, so the buyer can be called |
| Manages | All staff | Roles, records, attendance, leave |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Dashboard shows leave, overtime, and vehicle reconditioning | Dashboard shows requests plus a reconditioning panel driven by inspection items marked for repair or replacement | **Matches** |
| Handles inquiries and sets viewing schedules; hands off to Sales Manager on a GCE visit | Inquiry queue, arrangement scheduling (delivery / meet-up / GCE visit), and a two-stage handoff: Account Manager offers, Sales Manager accepts | **Matches** |
| Customer form is auto-filled from registration details; delivery needs a down payment set by Marketing before posting; meet-ups limited to CALABARZON | Registration details fill the arrangement and purchase forms. The CALABARZON limit and the Marketing-set delivery down payment were **not found as enforced rules**. | **Partly matches** |
| Keeps employee records and customer account records | Staff Records page (view, edit, change account status, performance reviews) and a Users list, both reading real records | **Matches** |
| Processes attendance, leave, overtime, and late arrivals | Attendance page with clock-in/out and checking; Employee Requests page for leave and overtime | **Matches** |
| Prepares payroll, sets salary, enters deductions including SSS, Pag-IBIG, TIN, PhilHealth | Compensation record per employee holds the statutory amounts; creating a payroll run adds them automatically as deduction lines | **Matches** |
| Manages role-based access for staff | Roles page; role assignment restricted to CEO and Account Manager | **Matches** |

---

## 1.3 Head Accountant

### Who they are
The finance lead. Signs off on money going out, pays the staff, watches the installment payers, and cross-checks the numbers against what is actually on the lot.

### A normal day
Look at what money was requested and release what is approved. Verify payments customers claim to have made. Check which installments fell due and make sure the Account Manager knows. If someone has stopped paying entirely, instruct a Confidential Informant to recover the vehicle. Review the payroll run the Account Manager prepared, finalise it after the CEO approves, then mark each payslip paid.

### What they can open
Dashboard, Finance, Vehicles, Transactions, Attendance, Payroll, Payslips, Reports, Announcements. (Plus the Field Cases page, which admits them to view cases and create repossession cases — see [2.16](#216-field-cases).)

### What only they can do
- Release a purchase-fund disbursement.
- Finalise a payroll run.
- Mark a payslip as paid.
- Instruct a repossession.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Receives from | CEO or Account Manager | A request to release funds for a car purchase |
| Sends to | Account Manager | Notice that an installment is due |
| Sends to | Confidential Informant | Instruction to recover a vehicle |
| Reviews for | Account Manager | Payroll runs and submitted reports |
| Cross-checks | Sales Manager, Marketing | Inventory and sales figures |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Releases funds for a vehicle purchase, on the CEO's request | CEO or Account Manager raises a "Request Purchase Funds" entry; only the Head Accountant can advance it to released | **Matches** |
| Has responsibility in paying employee salaries | Only the Head Accountant can finalise a payroll run or mark a payslip paid | **Matches** |
| Can view the vehicle inventory to double-check sales/revenue | Vehicles page is in their menu | **Matches** |
| Can view vehicle sales, including individual sold vehicles | Transactions page is in their menu | **Matches** |
| Manages installment accounts | Approves payment terms, verifies payments, waives installments | **Matches** |
| Notifies the Account Manager when an installment falls due | A due-date check runs and creates a notification for the Account Manager, shown on their dashboard | **Matches** |
| Instructs the Confidential Informant to retrieve the vehicle after continued non-payment | "Instruct Repossession" creates a recovery field case and records the collection action | **Matches** |
| Can view attendance to double-check payroll | Attendance page is in their menu, with checking rights | **Matches** |
| Towing begins after five months of non-payment (older brief) | No fixed ultimatum period is enforced anywhere. The instruction is manual. | **Does not match** — the five-month rule exists only on paper. |

---

## 1.4 Sales Manager

### Who they are
The person who closes deals. Takes over from the Account Manager when the customer is ready to buy or is standing in the showroom.

### A normal day
Work the "Buy Now" queue — those are people who have already decided. Accept handoffs from the Account Manager. For a walk-in with no account, create the account on the spot, then start the sale. Collect two valid IDs and a proof of billing. Move the transaction from pending to review to approved to completed. Record the paperwork.

### What they can open
Dashboard, Vehicles, Showroom, Inspections, Inquiries, Recommendations, Transactions, Roadmap, Staff Records, Field Cases, Announcements.

### What only they (with the CEO and Account Manager) can do
- Create a walk-in customer account.
- Create a walk-in transaction.
- Accept an inquiry handoff.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Receives from | Account Manager | Customers arriving for a scheduled visit |
| Talks to | Customer | Buy Now chat, the sale itself |
| Depends on | Mechanic | Inspection results on the car being sold |
| Sends to | Head Accountant | Completed sales that need payment verification |
| Works with | CEO | Assigning an Informant to source a requested car |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| "Buy Now" goes to the Sales Manager; "Inquiry" goes to the Account Manager | The Sales Manager's inquiry list is filtered to Buy Now only; the Account Manager sees everything. Assignment is a manual "assign to me" click, not automatic. | **Partly matches** — the right person sees the right work, but nothing is auto-assigned at creation. |
| Registered customer's details auto-fill the sale form | Registration details fill the purchase form | **Matches** |
| Two valid IDs and one proof of billing are still required | Documents are uploaded and staff-verified; a purchase cannot be completed until two IDs and a proof of billing are verified | **Matches** |
| Creates accounts for walk-in buyers with no account, and the account also appears on the client side | Walk-in account creation exists and produces a real customer account | **Matches** |
| Same account creation for a walk-in who wants to sell their own vehicle | The same account creation is used; the sell path exists as its own transaction type | **Matches** |
| Keeps a record of sales for reporting | The Transactions list with its summary figures serves this. There is no separate, named "record of sales" report document. | **Partly matches** |
| Handles the paperwork for the sale and the payment | Paperwork recording and document verification exist | **Matches** |

---

## 1.5 Confidential Informant

### Who they are
The field agent. Goes out to look at cars GCE might buy, brings them in, delivers sold cars, and recovers vehicles from buyers who stopped paying.

### A normal day
Check assigned cases. Bring a mechanic along to inspect a car in someone's garage. Log travel and other costs against the case. Request money for something the case needs. Deliver a sold car. If instructed, go recover a vehicle.

### What they can open
Dashboard, Finance, Vehicles, Inspections, Transactions, Field Cases, Announcements.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Receives from | CEO or Sales Manager | Sourcing assignments |
| Receives from | Head Accountant | Repossession instructions |
| Brings along | Mechanic | To inspect a car off-site |
| Requests from | CEO / Head Accountant | Money for the case |
| Reads | Mechanic reports | To judge whether a car is worth acquiring |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Takes possession of a vehicle when the company buys it | Field cases of kind "acquisition" can be created and worked | **Matches** |
| Assigns a mechanic to come along on an inspection | "Assign Mechanic" exists on a field case | **Matches** |
| May be assigned by the Head Accountant to retrieve or tow a vehicle | Repossession instruction creates a recovery case assigned to an Informant | **Matches** |
| Can see vehicles assigned to them for delivery | Delivery-kind field cases | **Matches** |
| Can view the mechanic's reports for a vehicle | Vehicles and Inspections are in their menu | **Matches** |
| Sends a payment request to the CEO; after approval the CEO gives them the funds | Replaced by a general money-request ledger: the Informant raises a request, the CEO or Head Accountant approve and release. There is no person-to-person cash handoff step. | **Partly matches** — a documented, deliberate substitution. |
| Records case expenses for travel and delivery | Expenses are recorded per case | **Matches** |

---

## 1.6 Marketing Specialist

### Who they are
The person who makes cars visible and attractive to the public.

### A normal day
Add a new car to the inventory with its photos and 360° frames. Propose a selling price and wait for the CEO. Once approved, publish it so it appears in the showroom. Update the landing page banner, promos, and featured cars.

### What they can open
Dashboard, Vehicles, Showroom, Content, Announcements.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Sends to | CEO | Price proposals |
| Depends on | Mechanic | Condition information that supports the price |
| Serves | The public | Listings, promotions, featured cars |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Posts vehicles so consumers can view them | Creates, edits, and publishes vehicle listings; manages showroom media | **Matches** |
| Submits the proposed price to the CEO before posting; the approved price is what is used | Proposing a price moves the car to "awaiting price approval"; publishing is blocked until an approved proposal exists | **Matches** |
| Sets the required down payment for delivery before a vehicle is posted | **Not found.** No down-payment field owned by Marketing was located. | **Does not match** |
| Listings should carry warranty, promo, condition, and pricing type (Negotiable / Fixed) | All four are on the listing: condition, `pricing_type` limited to negotiable or fixed, warranty details, and offer details. Shown on the showroom card and detail page. | **Matches** |

---

## 1.7 Mechanic

### Who they are
The technician who says whether a car is sound, what is broken, and what it will cost to fix.

### A normal day
Open the assigned inspection. Work down the checklist — system, then component, then part. Mark each item Good, For Repair, or For Replacement. When something needs replacing, record the part name, brand, and estimated cost. Finish, and the score feeds pricing and customer recommendations.

### What they can open
Dashboard, Vehicles, Inspections, Field Cases, Announcements.

### Who they work with
| Direction | Who | About what |
|---|---|---|
| Goes with | Confidential Informant | Off-site inspections |
| Feeds | Marketing, Sales, CEO | Condition score used for pricing |
| Feeds | The recommendation engine | Condition is 25% of a customer's match score |

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Checks the vehicle when the company is going to acquire it | Inspections with a nested checklist | **Matches** |
| Accompanies responsible personnel when the vehicle is off-site | The Informant can now assign a mechanic to a field case | **Matches** |
| Account shows repair progress — fixed or still pending | Per-item results and part replacements are recorded and shown | **Matches** |
| The checklist is nested: systems → components → parts | Implemented at three levels | **Matches** |
| Marking a part for repair/replacement opens fields for item name, brand, estimated cost | Implemented | **Matches** |
| The inspection report reuses the checklist rather than asking twice; one status per component | The checklist *is* the report; there is no second, separate report form. | **Partly matches** — the intent (no double entry) is met; a distinct simplified report document was not built. |

---

## 1.8 Head Security

### Who they are
The guard responsible for the building. The narrowest role in the system.

### A normal day
Clock in. At the start of the shift, photograph the locks and the building. At the end, photograph them again. Submit. File leave or overtime requests like any other employee.

### What they can open
Dashboard, Vehicles, Attendance, Employee Requests, Security Duty Checks, Announcements.

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Uses attendance for leave, overtime, time-in and time-out | Attendance and Employee Requests are open to all staff and both are now in this role's menu | **Matches** |
| Provides before-and-after photos of the locks and building security | Duty check: start, upload before image, upload after image, complete. Both images are required to complete. | **Matches** |

---

## 1.9 Customer

### Who they are
The buying public. Also anyone selling their own car to GCE or asking GCE to find a car.

### A normal day
Browse the showroom, filter by price and preference, save favourites. Use "Find Your Car" to get a ranked shortlist. Ask about a car in the chat, or press Buy Now. Choose delivery, a meet-up, or a visit to GCE. Upload two IDs and a proof of billing. Watch the purchase move through its stages, and follow the installment schedule afterwards.

### What they can open
Showroom, vehicle detail pages, Find Your Car (recommendations), My Inquiries, Transactions, Request a Car, Sell Vehicle, Favourites.

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| Browses a live catalogue with details, filters, favourites, 360° views | All present | **Matches** |
| Ranked recommendations using budget 0.35, condition 0.25, fuel 0.15, demand 0.15, mileage 0.10 | Exactly those five weights, with a per-criterion breakdown shown | **Matches** |
| One chat queue tied to the vehicle being discussed; photos and files; bad words hidden | Implemented, including attachments, message reporting, and a word filter | **Matches** |
| Buy, sell to GCE, and request a car; each moves through pending → review → approved/rejected → completed | Implemented as one shared status path | **Matches** |
| Purchase requires two valid IDs and one proof of billing | Customer uploads them; staff verify; the purchase cannot complete until they are verified | **Matches** |
| Customers and suppliers use a top header bar with three links and **do not see a dashboard sidebar** | They see the same left dashboard sidebar as staff, carrying seven customer items | **Does not match** |

---

## 1.10 Supplier

### Who they are
A company or an individual that sells vehicles to GCE. They do not sign themselves up — GCE creates the account for them.

### The onboarding story
GCE staff create the supplier record and say whether it is a Company or an Individual. Two primary valid IDs are uploaded and verified. Only then can the supplier be approved. Until approval, sign-in is refused with a "pending approval" message. On the first successful sign-in the account is linked to the supplier record.

### What they can open
The same customer-side pages: Showroom, Find Your Car, My Inquiries, Transactions, Request a Car, Sell Vehicle, Favourites. The CEO message thread is open to them by permission but **is not linked anywhere in their menu**.

### Documentation vs. system

| Documentation says | System does | Verdict |
|---|---|---|
| The Procurement Team creates supplier accounts instead of self-registration | The CEO and Account Manager create them. "Procurement Team" is not a role anywhere. | **Partly matches** — recorded substitution; the open question about who the Procurement Team is remains unanswered. |
| Supplier must declare Company or Individual | Checked on the server and in the database | **Matches** |
| Two primary valid IDs from a published list | Ten accepted ID types; approval is blocked until two primary IDs are verified | **Matches** |
| Cannot sign in until GCE approves | Sign-in is refused for any supplier not in the approved state | **Matches** |
| If a separate supplier portal is kept, keep proof GCE invited them | No portal was built; the invitation-evidence field exists but is never filled. Recorded as an intentional backlog item. | **Does not match** (deliberately) |
| Direct CEO-to-supplier communication channel | A working two-way message thread exists between the CEO and approved suppliers | **Matches** |
| Supplier's accessible pages are showroom, vehicle detail, inquiries, recommendations, transactions | The supplier is granted the same seven items as a customer, including Sell Vehicle, Request a Car, and Favourites | **Does not match** — broader access than documented. |

---

## 1.11 Procurement Team (documented only)

The revision list assigns supplier-account creation to a "Procurement Team". No such role exists in the system, and the open question asking who they are has never been answered. The CEO and Account Manager perform the duty instead.

**Verdict: Does not match.** Either confirm in the documents that the CEO and Account Manager *are* the procurement capability, or define the role. This is a documentation decision, not a coding one.

---

# PART 2 — THE MODULES AND PAGES

Each entry answers: what the page is for, who opens it, what they do there, why it matters, what it connects to, what usually happens before and after, and how it compares with the documents.

---

## 2.1 Dashboard

**Who opens it:** every staff role.
**Purpose:** the first screen after signing in — a summary of what is happening and what needs attention.
**What you do:** read the figures, read your notifications, click through to the page that needs work.
**Why it matters:** it is the only place that pulls several departments into one view.
**Connects to:** every operational page, through drill-down links.
**Before:** you sign in. **After:** you go where the numbers point you.

Not every role sees the same dashboard. The CEO gets an extra operations overview with live counts across staff, payroll, field work, and money. The Account Manager gets a reconditioning panel and the installment-due notifications.

| Documents | System | Verdict |
|---|---|---|
| A management dashboard with sales, inventory, pending work, revenue, staff performance, recommendation accuracy | Present for the CEO. Other roles get a lighter version. | **Matches** |
| Account Manager's dashboard shows leave, overtime, reconditioning | Present | **Matches** |

---

## 2.2 Vehicles (inventory)

**Who opens it:** every staff role has it in their menu.
**Purpose:** the master list of every car GCE owns or is selling — the single source of truth the whole company works from.
**What you do:** add a car, edit its details, upload photos and 360° frames, propose a price, publish it, archive it. The CEO also sees the queue of prices waiting for approval here, and is the only one who can delete a record.
**Why it matters:** if this list is wrong, the showroom is wrong, the recommendations are wrong, and the sales figures are wrong.
**Connects to:** Inspections (condition), Showroom (what the public sees), Transactions (what was sold), Recommendations (what gets ranked), Field Cases (what has to be collected or delivered).
**Before:** the Informant sources a car and the Mechanic inspects it. **After:** the price is approved and the car is published.

| Documents | System | Verdict |
|---|---|---|
| Live catalogue with details, photos, 360°, filters | Present | **Matches** |
| Head Accountant may view inventory to cross-check revenue | Present in their menu | **Matches** |
| Sold vehicles and their listings must never disagree | Completing a purchase marks the vehicle sold automatically | **Matches** |
| Warranty, promotional offers, condition, pricing type (Negotiable / Fixed) | All four present on the listing and displayed publicly | **Matches** |

---

## 2.3 Showroom (staff view)

**Who opens it:** CEO, Marketing Specialist, Sales Manager.
**Purpose:** see the public showroom exactly as a customer sees it.
**What you do:** look, check that the right cars are visible and presented properly.
**Why it matters:** it is the quality check before a customer finds the mistake.
**Before:** Marketing publishes a car. **After:** a customer browses it and inquires.

**Verdict: Matches.** The documents call for a live Virtual Showroom; the staff-side preview is a sensible addition and contradicts nothing.

---

## 2.4 Content

**Who opens it:** CEO and Marketing Specialist.
**Purpose:** manage what appears on the public landing page — the banner, promotions, and featured cars.
**What you do:** create a content item, publish it.
**Connects to:** the public landing page and the showroom.

**Verdict: Matches** the documented requirement that marketing staff manage landing-page content, promotions, and featured showroom vehicles.

---

## 2.5 Inspections

**Who opens it:** CEO, Account Manager, Confidential Informant, Mechanic, Sales Manager.
**Purpose:** the record of what condition each vehicle is actually in.
**What you do:** the Mechanic works the nested checklist and records replacements. Everyone else reads the result.
**Why it matters:** it justifies the price, it warns the Informant off a bad car, and it is a quarter of the customer's recommendation score.
**Before:** a car is sourced or brought in. **After:** the condition score feeds pricing and the reconditioning panel.

| Documents | System | Verdict |
|---|---|---|
| Mechanics record condition scores, notes, and repairs before a vehicle is listed | Present | **Matches** |
| Nested systems → components → parts | Present | **Matches** |
| Repair/replacement opens item name, brand, estimated cost | Present | **Matches** |
| Simplified report auto-filled from the checklist, one status per component | The checklist doubles as the report | **Partly matches** |

---

## 2.6 Inquiries

**Who opens it:** CEO, Account Manager, Sales Manager.
**Purpose:** the shared conversation desk with customers.
**What you do:** read the customer's message, take the conversation, answer, arrange a viewing (delivery, meet-up, or a visit to GCE), and — for a GCE visit — hand the customer to the Sales Manager, who accepts the handoff.
**Why it matters:** this is where a browser becomes a buyer, and it replaces the scattered Facebook, Viber, and phone conversations the project set out to fix.
**Connects to:** Vehicles (each chat is tied to a car), Transactions (Buy Now creates one), Customer's My Inquiries.
**Before:** the customer presses Inquire or Buy Now in the showroom. **After:** a viewing happens, or a transaction starts.

| Documents | System | Verdict |
|---|---|---|
| Inquiry → Account Manager, Buy Now → Sales Manager | The Sales Manager only sees Buy Now; the Account Manager sees everything; the person clicks to take the item | **Partly matches** — routing by visibility, not by automatic assignment |
| Form changes by arrangement: delivery / meet-up / GCE visit | Three arrangement kinds exist | **Matches** |
| Meet-ups limited to CALABARZON | **Not enforced** | **Does not match** |
| Delivery uses a down payment set by Marketing before posting | **Not found** | **Does not match** |
| Sales Manager takes over the in-person discussion after the handoff | Two-stage handoff: offered, then accepted | **Matches** |
| Chat carries photos and files; bad words are hidden; a message can be reported | All present | **Matches** |

---

## 2.7 Recommendations & Insights (staff)

**Who opens it:** CEO, Account Manager, Sales Manager.
**Purpose:** management-side analytics — what is selling, what is sitting, what customers are asking for.
**What you do:** read the charts and use them to decide what to buy and how to price.
**Connects to:** the customer-facing recommendation engine and the transactions history.

| Documents | System | Verdict |
|---|---|---|
| Management pricing suggestions, stock turnover, buying patterns, market information | These were built once as five named views. The page now carries generic inventory, sales, and market panels instead, after an interface redesign replaced the originals. | **Partly matches** |
| A way to report recommendation accuracy | **Gone.** Customers still give feedback on their recommendations, but no staff screen reads it. The accuracy view no longer exists. | **Does not match** |
| The documents disagree on whether the recommendation system is for buyers, for staff pricing advice, or for guided buying | Both a customer-facing ranking and a staff analytics view exist | **Unclear in the documents** — the system implements both readings; the source conflict is still open. |

---

## 2.8 Transactions

**Who opens it:** CEO, Account Manager, Head Accountant, Confidential Informant, Sales Manager.
**Purpose:** every buy, sell-to-GCE, and request-a-car in one place, with its stage, its money, and its documents.
**What you do:** move a deal through pending → under review → approved → completed (or rejected/cancelled), record payments, verify documents, set up payment terms and the installment schedule, assign an Informant to source a requested car, and — if payments stop — instruct a repossession.
**Why it matters:** this is the company's sales and receivables record.
**Connects to:** Vehicles (marks a car sold), Finance (payments and money requests), Field Cases (sourcing, delivery, recovery), the customer's own Transactions page.
**Before:** a Buy Now, a walk-in, or a customer's sell/request submission. **After:** the car is marked sold, the schedule starts, the paperwork is filed.

**Who may move a deal forward**

| From → To | Allowed |
|---|---|
| Pending → Under review, or Cancelled | Sales Manager, CEO, Account Manager |
| Under review → Approved / Rejected / Cancelled | Sales Manager, CEO |
| Approved → Completed | Sales Manager, CEO, Head Accountant |
| Approved → Cancelled | Sales Manager, CEO |

| Documents | System | Verdict |
|---|---|---|
| Buy, sell, and request-a-car, each tracked through pending, review, approval or rejection, completion | Exactly this | **Matches** |
| Flexible payment terms and arrangements | Terms proposed → approved → activated, then a generated schedule (weekly, fortnightly, monthly, quarterly) | **Matches** |
| Purchase history, payment method, financing progress, receipt | Present on the customer side | **Matches** |
| Money is settled outside the system; no payment gateway | The system only records payments; it never moves money | **Matches** |
| A checklist of required vehicle documents | Present. A vehicle-document checklist with required / submitted / verified / rejected states lives on the **Inspections** page, separate from the buyer's two IDs and proof of billing. | **Matches** |

---

## 2.9 Roadmap

**Who opens it:** CEO, Account Manager, Sales Manager.
**Purpose:** planning board for the platform's own initiatives.
**Note:** the analyzer notes record this as platform tooling, outside the GCE business roadmap.

**Verdict: Not in the source documents.** It is an extra page. Harmless, but it should be described in the documentation or acknowledged as a development tool so reviewers do not look for it in the capstone requirements.

---

## 2.10 Suppliers

**Who opens it:** CEO and Account Manager.
**Purpose:** create, verify, and approve the companies and individuals GCE buys vehicles from.
**What you do:** create the supplier record, mark Company or Individual, upload their two primary IDs, verify each one, then approve or reject.
**Why it matters:** an unapproved supplier cannot sign in at all, so this page is the gate.
**Before:** GCE decides to source from someone. **After:** the supplier can sign in and coordinate with the CEO.

| Documents | System | Verdict |
|---|---|---|
| Staff create the account rather than the supplier self-registering | Present | **Matches** |
| Company or Individual declaration | Present and validated | **Matches** |
| Two primary valid IDs, from a clearly listed set | Present; approval blocked until two are verified | **Matches** |
| Approval required before first sign-in | Enforced at sign-in | **Matches** |
| The **Procurement Team** does the creating | The CEO and Account Manager do | **Partly matches** |
| Invitation evidence if a supplier portal is retained | No portal; the field exists but is never used | **Does not match** (recorded as deliberate) |

---

## 2.11 Staff Records

**Who opens it:** CEO, Account Manager, and Sales Manager.
**Purpose:** the employee file — who works here, their details, their status, and their performance reviews. It is also where a walk-in customer account gets created.
**What you do:** view and edit a staff member's details, set their account status (invited, active, suspended, archived), write and update performance reviews, and create walk-in accounts.
**Why it matters:** it is the human record behind payroll, attendance, and access. Suspending someone here is how you stop them using the system.
**Connects to:** Roles (what they may see), Attendance and Payroll (what they are paid for), Users (the account list).
**Before:** someone is hired, or a walk-in customer arrives without an account. **After:** they can sign in, appear in payroll, and be scheduled.

**Worked example — the CEO opens Staff Records**
The CEO is not the one maintaining this page day to day; the Account Manager is. The CEO opens it to check something specific: whether a person is still active, what their last performance review said, or whether a new hire has been set up. The CEO can do everything the Account Manager can here. What normally happens before is that the Account Manager entered or updated the record; what normally happens after is that the CEO acts on it elsewhere — approving a payroll run that includes the person, or asking for a role change on the Roles page.

| Documents | System | Verdict |
|---|---|---|
| The Account Manager maintains employee records and customer account records | Present, reading real records, with edit and status management | **Matches** |
| Staff attendance, leave, overtime, and **performance** records | Performance reviews are here | **Matches** |
| The Sales Manager creates walk-in accounts | Walk-in creation is allowed for CEO, Account Manager, and Sales Manager, and Staff Records is now in the Sales Manager's menu (finding A-9 resolved) | **Matches** |

---

## 2.12 Attendance

**Who opens it:** every staff role may use it; it is in the menus of CEO, Account Manager, Head Accountant, and Head Security, and the first three may check other people's records.
**Purpose:** who came in, when, and whether it counts.
**What you do:** clock in and out; a checker reviews and confirms records.
**Why it matters:** payroll is built from checked attendance. An unchecked day is an unpaid day.
**Before:** the working day. **After:** payroll preparation.

| Documents | System | Verdict |
|---|---|---|
| Account Manager processes attendance, including late arrivals | Present, with schedule-based grace-period handling | **Matches** |
| Head Accountant may view attendance to double-check payroll | Present with checking rights | **Matches** |
| Head Security uses time-in and time-out | Clocking works for all staff, and Attendance is now in the Head Security menu | **Matches** |

---

## 2.13 Employee Requests

**Who opens it:** in the menus of CEO, Account Manager, and Head Security; the page itself is open to all staff so that anyone can file a request.
**Purpose:** leave and overtime.
**What you do:** an employee submits or cancels a request; the CEO or Account Manager approves or rejects it.
**Why it matters:** approved leave changes what attendance is expected and what payroll pays.
**Before:** an employee needs time off. **After:** the decision feeds attendance and payroll.

**Verdict: Matches.**

---

## 2.14 Payroll

**Who opens it:** CEO, Account Manager, Head Accountant.
**Purpose:** turn a period's attendance into money owed.
**What you do:** the Account Manager records each employee's compensation (base salary and the SSS, Pag-IBIG, PhilHealth, TIN amounts), then creates a payroll run from checked attendance. The Head Accountant reviews it first, the CEO approves second, the Head Accountant finalises it.
**Why it matters:** it is the company's largest recurring obligation and the one with the most approval steps.
**Connects to:** Attendance (the days), Employee Requests (approved leave), Payslips (the result), Reports (what gets submitted upward).
**Before:** the period closes and attendance is checked. **After:** payslips are produced and paid.

**The approval order actually built**

```
Account Manager prepares      →  draft
Head Accountant reviews (1st) →  pending approval
CEO approves (2nd)            →  approved
Head Accountant finalises     →  finalized
Head Accountant marks paid    →  paid
```

| Documents | System | Verdict |
|---|---|---|
| Account Manager prepares the payroll report and submits it for payslip approval | Present | **Matches** |
| Account Manager sets salary and enters deductions, including for lateness and absence | Present; a draft payslip is built from checked attendance against a daily rate | **Matches** |
| Account Manager enters SSS, Pag-IBIG, TIN, PhilHealth amounts | Held on the compensation record and added automatically as deduction lines | **Matches** |
| The Head Accountant has salary-payment responsibility | Only they may finalise and mark paid | **Matches** |
| The final approval order was never stated in the documents | A working order was chosen and recorded as provisional | **Unclear in the documents** — the built order still needs the CEO's, Head Accountant's, and Account Manager's sign-off. |
| How salaries and statutory amounts are calculated | No formula is invented; amounts are entered by a person | **Unclear in the documents** — deliberately left to the user. |

---

## 2.15 Payslips

**Who opens it:** CEO, Account Manager, Head Accountant.
**Purpose:** the individual pay record for each employee in a run.
**What you do:** open a payslip, edit its lines while it is still a draft, print it, and — Head Accountant only — mark it paid.
**Before:** a payroll run is finalised. **After:** the employee is paid outside the system and the record says so.

**Verdict: Matches.**

---

## 2.16 Field Cases

**Who opens it (menu):** CEO, Account Manager, Confidential Informant, Mechanic, Sales Manager. The page itself also admits the Head Accountant (to view cases and create repossession cases), but they have no menu link to it.
**Purpose:** the job sheet for work that happens away from the office — sourcing a car, acquiring it, delivering it, or recovering it.
**What you do:** create a case of one of four kinds, assign an Informant, assign a Mechanic to come along, move it through assigned → accepted → in progress → completed, and record expenses.
**Why it matters:** it is the only record of what field staff actually did and what it cost.
**Connects to:** Transactions (a requested car becomes a sourcing case; a repossession becomes a recovery case), Inspections (the mechanic who came along), Finance (the expenses and money requests).
**Before:** a car needs finding, collecting, delivering, or recovering. **After:** the case closes and its cost lands in the money records.

| Documents | System | Verdict |
|---|---|---|
| Acquisition, delivery, recovery, and sourcing work for the Informant | All four kinds exist and can be created | **Matches** |
| Mechanic accompanies the Informant | Mechanic assignment exists on a case | **Matches** |
| Case expenses | Recorded per case | **Matches** |
| Head Security is a user of field cases | **Nowhere in the documents.** Access was revoked under the least-privilege pass; Head Security can no longer open the page. | **Resolved** — unexpected access removed (finding A-4). |
| The Head Accountant instructs repossession | They can create a repossession case and now open the Field Cases page to follow it, though it has no menu link for them | **Partly matches** — viewable, but reachable only by address (finding A-3 resolved). |

---

## 2.17 Security Duty Checks

**Who opens it:** CEO and Head Security only.
**Purpose:** photographic proof that the building was secured at the start and end of a shift.
**What you do:** start a check, upload the "before" photo, upload the "after" photo, complete it. Both photos are required.
**Why it matters:** it is evidence, not a formality — if something goes missing overnight, this is the record.
**Before:** the shift starts. **After:** the CEO can review the evidence.

**Verdict: Matches.**

---

## 2.18 Reports

**Who opens it:** CEO, Account Manager, Head Accountant.
**Purpose:** formal submissions that need a decision.
**What you do:** the Account Manager, Head Accountant, or CEO submits a report; the CEO or Head Accountant reviews it.
**Before:** a period closes or a figure needs sign-off. **After:** the reviewed report becomes the record of the decision.

| Documents | System | Verdict |
|---|---|---|
| The CEO approves or rejects four named report types with fixed owners: payslip and disbursement (Account Manager), expense and revenue (Head Accountant), price proposals (Marketing), inventory (Sales Manager) | One general report list. Price approval is handled separately and correctly. The Sales Manager **cannot open Reports at all**, so the documented inventory report has no owner in the system. | **Partly matches** |

---

## 2.19 Announcements

**Who it is for:** all staff should read them.
**Purpose:** company news from the CEO to the workforce.
**What you do:** the CEO drafts, publishes, expires, and archives. Everyone else reads.
**Before:** there is news. **After:** staff know.

| Documents | System | Verdict |
|---|---|---|
| The CEO creates announcements for GCE employees | CEO-only creation and publishing | **Matches** |
| The access table in `13 - USER ACCOUNTS` shows Announcements available to **all eight** staff roles | The page is open to all staff and every role now has the menu link | **Matches** |

---

## 2.20 Supplier Messages

**Who opens it:** the CEO, and an approved supplier.
**Purpose:** a direct line between GCE's chief executive and a supplier.
**What you do:** send and read messages in a live thread.
**Before:** the supplier is approved. **After:** sourcing is coordinated.

| Documents | System | Verdict |
|---|---|---|
| Provide a direct CEO-to-supplier channel, "if applicable" | Built and working in both directions | **Matches** |
| — | The supplier is permitted to use it but has **no menu link to it** | **Partly matches** — the supplier's half of the channel is not reachable through normal navigation. |

---

## 2.21 Roles

**Who opens it (menu):** CEO and Account Manager.
**Purpose:** decide what each person may see and do.
**What you do:** assign a role to a user account.
**Why it matters:** every other permission in the system follows from this one page.
**Before:** someone is hired or changes jobs. **After:** their menu and their permissions change.

| Documents | System | Verdict |
|---|---|---|
| The Account Manager manages role-based access for employees and administrators | Role assignment is restricted to the CEO and Account Manager | **Matches** |
| — | The page now carries a role guard matching the menu — CEO and Account Manager only. Other staff are redirected to an unauthorized screen before anything loads. | **Matches** |

---

## 2.22 Users

**Who opens it:** CEO and Account Manager.
**Purpose:** the full account list — staff and customers together.
**What you do:** look up an account, see its role and status.
**Note:** the earlier audit found this page was showing sample data. It now reads real records.

**Verdict: Matches.**

---

## 2.23 Finance — a page the documentation does not describe

**Who can open it:** CEO, Head Accountant, Account Manager, and the Confidential Informant (who sees only their own requests).
**Purpose:** the money record — revenue, expenses, disbursements, adjustments — and the request-and-release ledger for money going out.
**What you do:** record an entry, verify an entry, raise a request for purchase funds, and advance a request through approval and release.
**Why it matters:** this is where the Head Accountant's "release funds for a car purchase" duty and the Informant's "payment request" duty actually live.

**The problem:** the page was once granted to no role and reached only through a link on the CEO's dashboard overview or by typing the address. It is now in the menus of the CEO, Head Accountant, Account Manager, and Confidential Informant (who sees only their own requests), so the granting gap is closed. What remains is documentation: the page is still absent from the access table in `13 - USER ACCOUNTS`.

| Documents | System | Verdict |
|---|---|---|
| The Head Accountant releases funds for a car purchase on the CEO's request | Built here | **Matches in behaviour** |
| The Informant requests payment approval | Built here | **Partly matches** — no CEO-to-Informant cash handoff, by design |
| — | The page exists and is navigable, but still has no entry in the documentation | **Partly matches** — the access table in `13 - USER ACCOUNTS` has no Finance row. |

---

## 2.24 Customer and supplier pages

| Page | What it is for | Before | After |
|---|---|---|---|
| **Showroom** | Browse available cars, filter, open a car, save a favourite | The customer arrives | They inquire or press Buy Now |
| **Vehicle detail** | Photos, 360° view, specification, and the two buttons: Inquire, Buy Now | A car catches their eye | A conversation or a purchase begins |
| **Find Your Car** | Enter a budget and preferences and receive a ranked shortlist with the reasoning shown | They do not know what they want | They open the top match |
| **My Inquiries** | Their side of the chat with GCE, including attachments and the viewing arrangement | They asked a question | Staff answer and schedule |
| **Transactions** | Every buy, sell, and request they have with GCE; upload IDs and proof of billing; see the installment schedule | They committed to a deal | They complete it and pay |
| **Request a Car** | Ask GCE to find a car that is not in stock | Nothing in the showroom fits | The Sales Manager or CEO assigns an Informant to source it |
| **Sell Vehicle** | Offer their own car to GCE | They want to sell | Staff review and value it |
| **Favourites** | Their shortlist | Browsing | Coming back later |

**Verdict on the customer set: Matches.** All documented customer behaviour is present.

**Verdict on the supplier set: Does not match.** The documents describe five supplier pages; the system gives suppliers the same seven pages as a customer, including Sell Vehicle, Request a Car, and Favourites. Whether that is wrong or simply undocumented is a decision for the project owners — but as written, the documents and the system disagree.

---

# PART 3 — HOW THE WORK ACTUALLY FLOWS

---

## 3.1 Getting a car into GCE

```
Confidential Informant finds a car
        │
        ├─ assigns a Mechanic to come along
        │        └─ Mechanic works the checklist  →  condition score
        │
        ├─ raises a money request  →  CEO / Head Accountant approve  →  Head Accountant releases
        │
        └─ collects the car   →   acquisition case completed, expenses recorded
                 │
                 ▼
        The car appears in Vehicles
```

**Status:** built end to end. The one documented step that is different is the last hop of the money: the documents describe the CEO physically handing funds to the Informant; the system stops at "released" in the ledger.

---

## 3.2 Putting a car on sale

```
Mechanic's condition score
        ▼
Marketing Specialist adds photos, 360° frames, and proposes a price
        ▼
Car sits in "awaiting price approval"
        ▼
CEO approves  →  price is set  →  car becomes available
        ▼
Marketing publishes  →  the car is now in the public showroom
```

**Status: fully matches the documents.** Publishing is genuinely blocked until the CEO approves a price — the rule is enforced, not just described.

---

## 3.3 A customer asks, visits, and buys

```
Customer opens a car in the showroom
        │
        ├─ presses "Inquire"  →  Account Manager's queue
        │        ▼
        │   Account Manager takes it, chats, arranges:
        │        delivery  |  meet-up  |  visit to GCE
        │        ▼
        │   If a GCE visit: Account Manager offers the handoff
        │        ▼
        │   Sales Manager accepts  →  takes over in person
        │
        └─ presses "Buy Now"   →  Sales Manager's queue + a purchase record
                 ▼
        Customer uploads two IDs and a proof of billing
                 ▼
        Staff verify each document
                 ▼
        Pending → Under review → Approved → Completed
                 ▼
        Vehicle is automatically marked sold everywhere
```

**Status: matches**, with two exceptions. Work is not auto-assigned — a person clicks to take it. And the CALABARZON meet-up limit and the Marketing-set delivery down payment are described in the documents but not enforced by the system.

---

## 3.4 A walk-in with no account

```
Walk-in arrives
        ▼
Sales Manager (or CEO / Account Manager) creates the customer account
        ▼
That account is a real account — the customer can sign in and see it
        ▼
The sale proceeds exactly as above, with the same two-ID requirement
```

**Status: matches** for the account creation itself. The documents never say how the walk-in receives or secures the credentials for the account created for them — that question is still open.

---

## 3.5 Installments, missed payments, and recovery

```
Payment terms proposed  →  Head Accountant approves  →  activated
        ▼
Installment schedule generated (weekly / fortnightly / monthly / quarterly)
        ▼
Each due date passes  →  the system creates a notification for the Account Manager
        ▼
Account Manager contacts the buyer
        ▼
Buyer still does not pay
        ▼
Head Accountant issues a repossession instruction
        ▼
A recovery field case is created and assigned to a Confidential Informant
        ▼
Informant retrieves the vehicle; the collection action is on record
```

**Status: matches the documented chain.** The one gap: the documents (older brief) say towing begins after **five months** of non-payment, and the newer material never states an ultimatum period. The system enforces no waiting period at all — the Head Accountant decides. That is a business rule still missing from both the documents and the system.

---

## 3.6 Payday

```
Attendance is clocked and checked
        ▼
Approved leave and overtime are applied
        ▼
Account Manager records compensation (salary + SSS, Pag-IBIG, PhilHealth, TIN)
        ▼
Account Manager creates the payroll run  →  draft
        ▼
Head Accountant reviews  →  pending approval
        ▼
CEO approves  →  approved
        ▼
Head Accountant finalises  →  finalized
        ▼
Head Accountant marks each payslip paid  →  paid
```

**Status: built and consistent.** But the order itself was a working assumption, not an instruction from the documents. It still needs the CEO's, Head Accountant's, and Account Manager's confirmation before it can be called final.

---

## 3.7 Bringing on a supplier

```
GCE decides to source from a company or an individual
        ▼
CEO or Account Manager creates the supplier record and marks Company / Individual
        ▼
Two primary valid IDs are uploaded
        ▼
Each ID is verified one by one
        ▼
Approval is now possible — and not before
        ▼
Supplier signs in for the first time; the account is linked
        ▼
Supplier and CEO can message each other
```

**Status: matches the revision list**, except that the creator is the CEO or Account Manager rather than a "Procurement Team", and no separate supplier portal (with invitation evidence) was built. Both were recorded as deliberate decisions.

---

# PART 4 — FINDINGS

---

## 4.1 What matches

- All ten user levels in the documents exist in the system, with the same names and the same core duties.
- Each role's menu matches, item for item, the per-role listings in `13 - USER ACCOUNTS`.
- The price-approval rule is genuinely enforced: no approved price, no published car.
- The two-ID-plus-proof-of-billing rule is genuinely enforced: no verified documents, no completed purchase.
- Supplier approval genuinely blocks sign-in.
- The recommendation weights are exactly the five documented values.
- The Head Accountant's full financial chain — release funds, notify at due date, instruct repossession — is built.
- The Informant's field work — all four case kinds, mechanic assignment, expenses — is built.
- Both security duty photographs are required before a check can be completed.

## 4.2 Documented but missing

| # | What the documents say | Where |
|---|---|---|
| M-1 | Meet-ups are limited to CALABARZON | Account Manager, inquiries |
| M-2 | Marketing sets a required down payment for delivery before the car is posted | Account Manager, inquiries / Marketing |
| M-3 | Towing begins after five months of non-payment | Older brief, installments |
| M-4 | Four separately named report streams with fixed owners (payslip/disbursement, expense/revenue, price, inventory) | CEO, reports |
| M-5 | Management decision views for pricing trends, stock turnover, buying patterns, market information, and **recommendation accuracy** | Chapter document, pages 19–21; roadmap R-13 and R-14. Built once, then replaced during an interface redesign. Nothing on the staff side now reads the recommendation records. |
| M-6 | Invitation evidence for a supplier portal | Revision list §5 — recorded as deliberately not built |
| M-7 | A "Procurement Team" that creates supplier accounts | Revision list §5 |

## 4.3 Present but different from the documents

| # | Documented | Built | Why it matters |
|---|---|---|---|
| D-1 | Inquiry and Buy Now are routed to their owner | Filtered to their owner; a person clicks to take it | Nothing is lost, but nobody "owns" an item until someone claims it. |
| D-2 | CEO approves the Informant's payment request and gives them the funds | A general money ledger; approval and release, no handoff | The documents' cash step has no equivalent. |
| D-3 | CEO approves cars for inventory | Folded into price approval plus publishing | Reasonable, but the documents still describe a step that has no button. |
| D-4 | The Sales Manager keeps a record of sales for reporting | The transactions list serves this | No named report exists, and the Sales Manager cannot open Reports. |
| D-5 | A simplified inspection report auto-filled from the checklist | The checklist is the report | The intent (no double entry) is met; the artefact is not. |

## 4.4 In the system but not in the documents

| # | What | Note |
|---|---|---|
| E-1 | The **Finance** page | Real and now in the menus of four roles, but still in no documentation. |
| E-2 | The **Roadmap** page | Recorded elsewhere as platform tooling, not a GCE business module. |
| E-3 | The **Recommendations & Insights** staff dashboard | Broadly covered by the documented "management information" requirement, but never named as a page. |
| E-4 | Supplier access to Sell Vehicle, Request a Car, and Favourites | The documents give suppliers five pages; the system gives seven. |
| E-5 | Head Security access to Field Cases | No document gives Head Security any field-case duty. Access was revoked in the RBAC pass — resolved (see A-4). |
| E-6 | A large set of unused template pages (CRM, Analytics, E-commerce, Academy, Logistics, Mail, Chat, Calendar, Kanban, Invoice and similar) inside the staff area | Not in any role's menu, but reachable by address. They are leftovers from the interface template, not GCE features. |

## 4.5 Unexpected access and conflicting responsibilities

These are the findings that matter most for a capstone defence, because they are places where the system's own rules disagree with each other.

| # | Finding | Effect | Status |
|---|---|---|---|
| **A-1** | Several staff pages have **no role check on the page itself** — Vehicles, Content, Inspections, Transactions, Roles, staff Showroom, Recommendations, Roadmap, and the Dashboard. Any signed-in staff member can open them by typing the address, regardless of their menu. | The menu hides them; it does not block them. Actions inside are still restricted, and the database blocks the sensitive role list, so a Head Security user opening Roles sees names and account statuses but not roles and cannot change anything. Still, this is read access nobody granted. | **Resolved (Aug 2026)** — page-level `requireRole` guards now match the sidebar access. |
| **A-2** | A **customer or supplier** who types an address that does not exist for them is sent to the **staff dashboard** rather than being refused. | Outside users can land on an internal screen. What data appears there was not confirmed in this review — it should be tested. | Open |
| **A-3** | The **Head Accountant** can create a field case (including the repossession they are supposed to instruct) but **cannot open the Field Cases page**. | They issue an instruction they can never see the result of. | **Resolved (Aug 2026)** — Head Accountant added to `FIELD_CASE_ROLES`; they can now view cases and create repossession cases (RLS SELECT/INSERT included). |
| **A-4** | **Head Security** can open Field Cases, which no document assigns to them. | Unexpected access. | **Resolved (Aug 2026)** — Head Security removed from the page guard and from the RLS SELECT policy. |
| **A-5** | The **Mechanic, Sales Manager, and Head Security** have no Announcements link, yet the documented access table says all staff have it and the page admits them. | Company announcements do not reach three of eight roles through normal use. | **Resolved (Aug 2026)** — Announcements added to all three menus. |
| **A-6** | **Head Security** has no Attendance or Employee Requests link, yet the documents specifically describe them using both. | Their documented duty is unreachable from their menu. | **Resolved (Aug 2026)** — Attendance and Employee Requests added to the Head Security menu. |
| **A-7** | The **Finance** page is in no menu at all. | The Head Accountant's fund-release duty and the Informant's money requests are only reachable by address or a single dashboard link. | **Resolved (Aug 2026)** — Finance added to the CEO, Head Accountant, Account Manager, and Confidential Informant menus. |
| **A-8** | An approved **supplier** may use the CEO message thread but has no link to it. | Half of a documented feature is unusable from the supplier's side. | Open |
| **A-9** | The **Sales Manager** may create walk-in accounts but cannot open Staff Records, where the walk-in form lives. | The documented duty and the page that carries it are separated. | **Resolved (Aug 2026)** — Staff Records added to the Sales Manager menu. |
| **A-10** | Customers and suppliers see the **dashboard sidebar**, not the three-link header the documents describe. | Straight contradiction between `13 - USER ACCOUNTS` and the system. | Open |

## 4.6 Unclear or unverified

Recorded honestly rather than guessed.

| # | Item | Why it is not settled |
|---|---|---|
| U-1 | Whether the **management recommendation views** still exist | The tracker records five decision views (Pricing Trends, Stock Turnover, Buying Patterns, Market Insights, Accuracy). The page now carries generic inventory and sales panels instead, and **no staff screen reads the recommendation records at all**. Recommendation accuracy has no reporting surface. Treated as a regression in [17 - ROADMAP AUDIT](17%20-%20ROADMAP%20AUDIT.md). |
| U-3 | Consistent confirmation prompts before every submission, approval, and deletion | Present in places; not audited page by page. |
| U-4 | Field-by-field validation limits across every form | A validation layer exists; whether every field carries its stated limits was not checked, and the documents never state the limits. |
| U-5 | Light-mode text contrast | A presentation requirement; not assessed here. |
| U-6 | Mobile application download | The documents contradict each other on whether a downloadable application is even wanted. Nothing was assessed. |
| U-7 | What a customer or supplier actually sees if they land on the staff dashboard (finding A-2) | Needs a live test with a customer account. |
| U-8 | Two separate files both claim the site's front address: one redirects a signed-in person to their own landing page, the other is a public welcome page showing the published banner and promos | A previous build compiled both, so it does not appear to break the application. Which one a first-time visitor actually lands on was **not** confirmed. Worth a live check, because it decides whether a stranger sees a welcome page or is sent straight to sign-in. |

## 4.7 Business questions the documents still do not answer

These are not system faults. They are decisions the project owners have never made, and the system currently runs on working assumptions in their place.

| Question | Who must answer |
|---|---|
| Who is the "Procurement Team"? | CEO and project owners |
| What is the final payroll approval order? | CEO, Head Accountant, Account Manager |
| How exactly do funds pass between the CEO, Head Accountant, and Informant? | CEO and Head Accountant |
| How long is the installment ultimatum, and does repossession need another approval? | Head Accountant and CEO |
| How are salaries and the SSS, Pag-IBIG, TIN, PhilHealth amounts calculated and checked? | Head Accountant and Account Manager |
| How does a walk-in client receive and secure the account created for them? | Sales Manager and project owners |
| What are the complete rules for delivery, meet-up, and GCE-visit forms? | Account Manager, Marketing, Sales Manager |
| Which flexible payment terms are allowed, and who approves each one? | Head Accountant and CEO |
| Which vehicle documents belong on the required checklist? | Sales Manager and Head Accountant |
| What is the approved inspection checklist of systems, components, and parts? | Mechanic and project owners |
| What counts as the accepted valid IDs, and does the two-ID rule change the customer rule? | Project owners |
| Is the recommendation system for buyers, for staff pricing advice, or for guided buying? | Sales Manager and project owners |

---

## Closing summary

Measured against the documents, the system is in good shape on **substance** and weaker on **navigation and documentation upkeep**.

- Every documented user level exists, and almost every documented duty is built and enforced — including the hard ones the earlier audit flagged as missing: supplier approval gating, the Head Accountant's money and recovery chain, the Informant's field and mechanic-assignment duties, and the two-ID purchase rule.
- The genuine remaining behaviour gaps are small and specific: the CALABARZON meet-up limit, the Marketing-set delivery down payment, the five-month towing rule, the four named report streams, and the management recommendation views that were built and then replaced.
- The August 2026 RBAC least-privilege pass closed the largest cluster: page-level guards now match the sidebar on every staff page, Finance is in the menus of the four roles that use it, Announcements, Attendance, Employee Requests, and Staff Records reached the roles that needed them, Head Security's field-case access was revoked, and operational CRUD (vehicles, inspections, repairs, checklist, content, vehicle documents) moved to the owning roles. What remains of the navigation cluster is narrower: a supplier who cannot reach a channel they are allowed to use, and outside users being routed to an internal screen.
- The documentation itself has drifted in one place: it describes a customer header bar the system does not use.

None of these were changed. This file records what is, not what should be.
