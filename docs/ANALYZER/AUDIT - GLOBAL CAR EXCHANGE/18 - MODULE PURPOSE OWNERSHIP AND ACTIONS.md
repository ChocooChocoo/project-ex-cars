# Module Purpose, Ownership, and Actions Audit

**System:** Global Car Exchange (GCE)
**Audit date:** 18 August 2026
**Scope:** Current working tree, active role-accessible GCE pages, shared access controls, and reachable child pages.
**Status:** Documentation only. No application data, code, configuration, schema, or permissions were changed.

## Start here

This is the simple guide. Find your role, open the suggested first page, and follow the short workflow. The detailed route and action audit is below for staff who need the exact technical record.

### Find your role

| If you are a... | Start at | Your main work |
|---|---|---|
| CEO | `/ceo/dashboard` | Oversee the business, approve prices, manage announcements, suppliers, and escalations. |
| Account Manager | `/account_manager/dashboard` | Handle customers, staff records, inquiries, requests, suppliers, and payroll preparation. |
| Head Accountant | `/head_accountant/finance` | Check finance, payments, payroll, and payslips. |
| Sales Manager | `/sales_manager/dashboard` | Handle sales inquiries, transactions, walk-ins, and field handoffs. |
| Confidential Informant | `/confidential_informant/dashboard` | Work on sourcing, delivery, recovery, and related finance requests. |
| Marketing Specialist | `/marketing_specialist/vehicles` | Add and update vehicles, propose prices, manage media, and publish content. |
| Mechanic | `/mechanic/inspections` | Inspect vehicles and record condition, repairs, and required documents. |
| Head Security | `/head_security/security-duty-checks` | Complete security checks, attendance checks, and staff requests. |
| Customer | `/customer/showroom` | Browse vehicles, ask questions, buy, sell, request a car, and save favourites. |
| Supplier | `/supplier/showroom` | Use the approved supplier portal; the current setup gives Supplier the same seven portal areas as Customer. |

## User Role: CEO

Start at: `/ceo/dashboard`
Access: 23 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Summary cards and notification links | open the work that needs attention. |
| Refresh | reload the latest business summary. |

### Module: Finance

Actions:

| Action | Purpose |
|---|---|
| Record Entry | add a ledger record. |
| Request Disbursement or Request Purchase Funds | request approved business funds. |
| Verify | confirm a finance entry. |
| Submit, Approve, Reject, Release, Receive, or Mark Paid | move a disbursement through its current stage. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Pending / Vehicles | switch between price proposals and inventory. |
| Search, Status, Condition, Pricing, and Sort | find vehicles. |
| View Details | inspect a vehicle. |
| Approve or Reject | decide a Marketing Specialist price proposal. |
| Delete | remove an eligible vehicle; protected records cannot be deleted. |

### Module: Staff Showroom

Actions:

| Action | Purpose |
|---|---|
| Find Your Car, Search, Make, Sort, and favourites | browse the preview showroom. |
| Vehicle card | open the customer-style vehicle detail. |
| Inquire or Buy Now | start the customer workflow from an eligible detail page. |

### Module: Content

Actions:

| Action | Purpose |
|---|---|
| Review content items | check what Marketing has prepared. |
| Create, Edit, Delete, or Publish | not available to CEO in the current content guard. |

### Module: Inspections

Actions:

| Action | Purpose |
|---|---|
| Search, filters, View Details, View Vehicle, and Print Report | review inspection records. |
| Verify or Reject | review vehicle documents when the action guard allows it. |

### Module: Inquiries

Actions:

| Action | Purpose |
|---|---|
| Open conversations and reports | review customer communication. |
| Dismiss or Uphold | decide a message report. |

### Module: Recommendations

Actions:

| Action | Purpose |
|---|---|
| Market period, chart, and table controls | change the insight view. |
| KPI and market panels | read sales and inventory information. |

### Module: Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | find and inspect transactions. |
| Move to Review, Approve, Reject, Complete, or Cancel | move a transaction when the current state allows it. |
| Verify documents or payments | check submitted transaction evidence. |
| Assign Informant or Instruct Repossession | start authorised field recovery work. |

### Module: Roadmap

Actions:

| Action | Purpose |
|---|---|
| Status filter | find roadmap items. |
| New, Edit, Save, or Delete | manage a roadmap item. |

### Module: Roles

Actions:

| Action | Purpose |
|---|---|
| Change Role | assign one of the available GCE roles to a user. |

### Module: Users

Actions:

| Action | Purpose |
|---|---|
| Search, Role, Team, Status, and Workspace | find accounts. |
| Hide, Customize, Export, Add User, List view, Grid view, and pagination | organize the displayed user list; these current controls do not perform a GCE account mutation. |

### Module: Suppliers

Actions:

| Action | Purpose |
|---|---|
| Create Supplier | start a supplier record. |
| Upload, Verify, or Reject Document | process supplier evidence when allowed. |
| Approve Supplier or Reject Supplier | decide supplier onboarding. |

### Module: Staff Records

Actions:

| Action | Purpose |
|---|---|
| Search, Status, Joined date, Role, and Sort | find staff or customer accounts. |
| Edit, Change Status, Save, and performance review controls | maintain permitted records. |
| Create Walk-in Account | create a customer account for an in-person visit. |

### Module: Attendance

Actions:

| Action | Purpose |
|---|---|
| Clock In or Clock Out | record your own attendance. |
| Check attendance and Save Check | review staff attendance when permitted. |

### Module: Employee Requests

Actions:

| Action | Purpose |
|---|---|
| Review | open a leave or overtime request. |
| Approve or Reject | decide the request. |

### Module: Payroll

Actions:

| Action | Purpose |
|---|---|
| Create Run, Add Compensation, and Save Compensation | prepare payroll. |
| Approve or Reject | review a payroll run at the permitted stage. |

### Module: Payslips

Actions:

| Action | Purpose |
|---|---|
| Open and Print | view a permitted payslip. |
| Add Item | add a pay line when allowed. |
| Mark as Paid | controlled by the payment authorization. |

### Module: Field Cases

Actions:

| Action | Purpose |
|---|---|
| Create Field Case | start authorised field work. |
| Assign Informant or Assign Mechanic | assign workers. |
| Update | maintain case status and notes. |

### Module: Security Duty Checks

Actions:

| Action | Purpose |
|---|---|
| View the table, list, or grid | review duty checks. |
| Before/After evidence and Complete Check | review security evidence. |

### Module: Reports

Actions:

| Action | Purpose |
|---|---|
| Submit Report | create a report. |
| Mark Reviewed | record review completion. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| New Announcement, Save Draft, Publish, Expire, or Archive | manage company notices. |

### Module: Supplier Messages

Actions:

| Action | Purpose |
|---|---|
| Supplier selector | choose an approved supplier. |
| Type a message and Send | communicate with the supplier. |

## User Role: Account Manager

Start at: `/account_manager/dashboard`
Access: 19 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Summary cards and notification links | open customer, request, payroll, and due-installment work. |

### Module: Finance

Actions:

| Action | Purpose |
|---|---|
| Record Entry | add a permitted ledger record. |
| Request Disbursement or Request Purchase Funds | request business funds. |
| Submit Request | send a request for finance review. |

### Module: Roles

Actions:

| Action | Purpose |
|---|---|
| Change Role | assign a permitted GCE role to a user. |

### Module: Users

Actions:

| Action | Purpose |
|---|---|
| Search, filters, list/grid view, selection, and pagination | find and organize account rows. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, View Details, and pagination | inspect inventory. |
| Vehicle changes | controlled by the Marketing and CEO action guards. |

### Module: Inspections

Actions:

| Action | Purpose |
|---|---|
| Filters, View Details, View Vehicle, and Print Report | review inspections and documents. |

### Module: Inquiries

Actions:

| Action | Purpose |
|---|---|
| Assign to Me | take ownership of an inquiry. |
| Arrange Viewing or Schedule | record the next customer meeting. |
| Send message or Attach file | respond to the customer. |
| Dismiss or Uphold | decide a message report. |

### Module: Recommendations

Actions:

| Action | Purpose |
|---|---|
| Market period, chart, table, KPI, and insight panels | review sales and inventory information. |

### Module: Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, View Details, and pagination | find transactions. |
| State buttons | move a transaction only through the states allowed to Account Manager. |
| Upload or Verify documents | process evidence when allowed. |

### Module: Roadmap

Actions:

| Action | Purpose |
|---|---|
| Status filter and View Details | read roadmap items. |
| New/Edit/Delete | CEO-only roadmap changes. |

### Module: Suppliers

Actions:

| Action | Purpose |
|---|---|
| Create Supplier | start onboarding. |
| Upload, Verify, or Reject Document | process supplier evidence when allowed. |
| Approve Supplier or Reject Supplier | decide onboarding when the approval rules are met. |

### Module: Staff Records

Actions:

| Action | Purpose |
|---|---|
| Search, Status, Joined date, Role, and Sort | find accounts. |
| Edit, Change Status, Save, Reviews, and Create Walk-in Account | maintain permitted records. |

### Module: Attendance

Actions:

| Action | Purpose |
|---|---|
| Clock In or Clock Out | record your own attendance. |
| Check attendance and Save Check | review staff attendance. |

### Module: Employee Requests

Actions:

| Action | Purpose |
|---|---|
| New Request and Submit | send your own request. |
| Review, Approve, or Reject | process staff requests. |

### Module: Payroll

Actions:

| Action | Purpose |
|---|---|
| Create Run, Add Compensation, and Save Compensation | prepare payroll. |

### Module: Payslips

Actions:

| Action | Purpose |
|---|---|
| Open and Print | view permitted payslips. |
| Add Item | update a draft payslip when allowed. |

### Module: Field Cases

Actions:

| Action | Purpose |
|---|---|
| View and Update | follow field cases. |
| Create or Assign | available only when the recovery/action guard allows it. |

### Module: Reports

Actions:

| Action | Purpose |
|---|---|
| Submit Report | create a report. |
| Mark Reviewed | review a submitted report when allowed. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Head Accountant

Start at: `/head_accountant/finance`
Access: 9 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Finance and payroll summary cards | open current work. |

### Module: Finance

Actions:

| Action | Purpose |
|---|---|
| Ledger / Disbursements | switch finance views. |
| Verify | confirm finance entries. |
| Approve, Reject, Release, Receive, or Mark Paid | advance disbursements through allowed stages. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | read vehicle inventory. |

### Module: Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | find transactions. |
| Record Payment or Verify Payment | record and confirm payments. |
| Approve Terms, Activate & Generate Installments, Waive, or Instruct Repossession | perform authorised finance and recovery actions. |
| Verify or Reject document | review transaction evidence. |

### Module: Attendance

Actions:

| Action | Purpose |
|---|---|
| Clock In or Clock Out | record your own attendance. |
| Check attendance and Save Check | support payroll control. |

### Module: Payroll

Actions:

| Action | Purpose |
|---|---|
| Add Compensation | review compensation inputs. |
| Approve, Reject, or Finalize | control the payroll run at its current stage. |

### Module: Payslips

Actions:

| Action | Purpose |
|---|---|
| Open, Print, or Add Item | review and update permitted payslips. |
| Mark as Paid | record external payment. |

### Module: Reports

Actions:

| Action | Purpose |
|---|---|
| Submit Report | create a report. |
| Mark Reviewed | review a submitted report. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Sales Manager

Start at: `/sales_manager/dashboard`
Access: 11 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Sales summary cards and notification links | open current sales work. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, View Details, and pagination | inspect vehicle inventory. |

### Module: Staff Showroom

Actions:

| Action | Purpose |
|---|---|
| Find Your Car, Search, Make, Sort, favourites, and vehicle details | preview listings. |
| Inquire or Buy Now | start the customer workflow from an eligible detail page. |

### Module: Inspections

Actions:

| Action | Purpose |
|---|---|
| Filters, View Details, View Vehicle, and Print Report | review vehicle condition. |

### Module: Inquiries

Actions:

| Action | Purpose |
|---|---|
| Assign to Me | take Buy Now work. |
| Accept Handoff | accept an in-person customer conversation. |
| Arrange Viewing, Schedule, Send message, and Attach file | move the inquiry forward. |
| Dismiss or Uphold | decide a message report. |

### Module: Recommendations

Actions:

| Action | Purpose |
|---|---|
| Market period, chart, table, KPI, and insight panels | review sales information. |

### Module: Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, View Details, and pagination | find transactions. |
| Move to Review, Approve, Reject, Complete, or Cancel | progress an allowed transaction. |
| Accept or Reject | review a customer sell offer. |

### Module: Roadmap

Actions:

| Action | Purpose |
|---|---|
| Status filter and View Details | read roadmap items. |

### Module: Field Cases

Actions:

| Action | Purpose |
|---|---|
| Create, Assign Mechanic, Assign Informant, and Update | coordinate field work when allowed. |

### Module: Staff Records

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Edit, Change Status, and Save | review records. |
| Create Walk-in Account | create a customer account for an in-person visit. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Confidential Informant

Start at: `/confidential_informant/dashboard`
Access: 7 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Field and finance summary cards | open assigned work. |

### Module: Finance

Actions:

| Action | Purpose |
|---|---|
| Request Disbursement | request field-related funds. |
| View your own requests and their status. | View your own requests and their status. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | find vehicles relevant to field work. |

### Module: Inspections

Actions:

| Action | Purpose |
|---|---|
| Filters, View Details, View Vehicle, and Print Report | read vehicle condition. |

### Module: Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, and View Details | view assigned transaction work. |

### Module: Field Cases

Actions:

| Action | Purpose |
|---|---|
| View assigned cases | see field instructions. |
| Update | record case progress, notes, and expenses. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Marketing Specialist

Start at: `/marketing_specialist/vehicles`
Access: 5 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Listing and content summary cards | open current work. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Add Vehicle | create a listing. |
| Edit / Update Vehicle | change listing details. |
| Search, Status, Condition, Pricing, Sort, and pagination | organize inventory. |
| Propose Price / Submit Proposal | send a price for CEO review. |
| Publish or Archive | change listing visibility when allowed. |
| Upload Photo or 360° Frame | manage vehicle media. |

### Module: Staff Showroom

Actions:

| Action | Purpose |
|---|---|
| Find Your Car, Search, Make, Sort, favourites, and vehicle details | preview the public listing. |

### Module: Content

Actions:

| Action | Purpose |
|---|---|
| New Content Item | start a promotion or featured vehicle. |
| Create, Edit, Save Changes, Delete, or Publish | manage content. |
| Cancel | close the editor without saving. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Mechanic

Start at: `/mechanic/inspections`
Access: 5 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Work summary cards | open assigned inspection work. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | read vehicle information. |

### Module: Inspections

Actions:

| Action | Purpose |
|---|---|
| Filters, View Details, View Vehicle, and Print Report | find inspection work. |
| Good, For Repair, or For Replacement | record checklist results. |
| Save | store condition notes and estimates. |
| Upload, Verify, or Reject | process vehicle documents when allowed. |

### Module: Field Cases

Actions:

| Action | Purpose |
|---|---|
| View assigned cases and Update | support field work. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Head Security

Start at: `/head_security/security-duty-checks`
Access: 6 modules

### Module: Dashboard

Actions:

| Action | Purpose |
|---|---|
| Attendance and security summary cards | open current duty work. |

### Module: Vehicles

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Sort, and View Details | read vehicle records when needed. |

### Module: Attendance

Actions:

| Action | Purpose |
|---|---|
| Clock In or Clock Out | record your own attendance. |
| Check attendance and Save Check | perform permitted attendance checks. |

### Module: Employee Requests

Actions:

| Action | Purpose |
|---|---|
| New Request and Submit | send your own leave or overtime request. |

### Module: Security Duty Checks

Actions:

| Action | Purpose |
|---|---|
| Table, List, or Grid | change the check view. |
| Start Check | create a duty check. |
| Upload before/after evidence | add the required files. |
| Complete Check | finish the check after both files are present. |

### Module: Announcements

Actions:

| Action | Purpose |
|---|---|
| Read company announcements. | Read company announcements. |

## User Role: Customer

Start at: `/customer/showroom`
Access: 7 modules

### Module: Customer Showroom

Actions:

| Action | Purpose |
|---|---|
| Search vehicles, Make, and Sort | find a vehicle. |
| Add to favourites / Remove from favourites | save or remove a vehicle. |
| Open vehicle card | view the listing. |
| Inquire / Starting... | start a conversation. |
| Buy Now / Sending... | start a purchase request. |

### Module: Find Your Car

Actions:

| Action | Purpose |
|---|---|
| Preference fields | describe the vehicle you want. |
| Get Recommendations / Analyzing vehicles... | run the recommendation search. |
| Score Breakdown | see why a vehicle was suggested. |
| Yes / No | give feedback on a recommendation. |

### Module: My Inquiries

Actions:

| Action | Purpose |
|---|---|
| Open inquiry and Back to conversations | move between the list and a chat. |
| Type a message... and Send | reply to the conversation. |
| Attach file | send supporting information. |
| Mark messages read | clear unread messages. |
| Report message | report inappropriate content. |

### Module: My Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, and Open transaction actions | find a transaction. |
| Cancel Transaction | request cancellation when allowed. |
| Keep Transaction or Yes, Cancel Transaction | confirm or dismiss cancellation. |
| Save Details | save payment or arrangement details. |
| Upload | add required ID or proof of billing. |
| Print | print the transaction summary. |

### Module: Request a Car

Actions:

| Action | Purpose |
|---|---|
| Request fields | describe the vehicle you want. |
| Submit Request | send the request to GCE. |
| Cancel | leave without submitting. |

### Module: Sell Vehicle

Actions:

| Action | Purpose |
|---|---|
| Vehicle detail fields | describe the vehicle offered to GCE. |
| Submit Vehicle | send the sell offer. |
| Cancel | leave without submitting. |

### Module: Favourites

Actions:

| Action | Purpose |
|---|---|
| Open saved vehicle | return to the listing. |
| Remove from favourites | remove a saved vehicle. |

## User Role: Supplier

Start at: `/supplier/showroom`
Access: 7 modules after supplier approval

### Module: Customer Showroom

Actions:

| Action | Purpose |
|---|---|
| Search vehicles, Make, and Sort | find a vehicle. |
| Add to favourites / Remove from favourites | save or remove a vehicle. |
| Open vehicle card | view the listing. |
| Inquire / Starting... or Buy Now / Sending... | start the selected customer-style workflow. |

### Module: Find Your Car

Actions:

| Action | Purpose |
|---|---|
| Preference fields and Get Recommendations | search for suitable vehicles. |
| Score Breakdown and Yes / No | review and rate recommendations. |

### Module: My Inquiries

Actions:

| Action | Purpose |
|---|---|
| Open inquiry, Type a message..., Send, Attach file, Mark messages read, or Report message | manage your own conversations. |

### Module: My Transactions

Actions:

| Action | Purpose |
|---|---|
| Search, filters, Open transaction actions, Save Details, Upload, Print, and cancellation controls | manage your own transactions when allowed. |

### Module: Request a Car

Actions:

| Action | Purpose |
|---|---|
| Request fields, Submit Request, or Cancel | send or dismiss a vehicle request. |

### Module: Sell Vehicle

Actions:

| Action | Purpose |
|---|---|
| Vehicle detail fields, Submit Vehicle, or Cancel | send or dismiss a sell offer. |

### Module: Favourites

Actions:

| Action | Purpose |
|---|---|
| Open saved vehicle or Remove from favourites | manage saved listings. |

### What the action words mean

| Label | Plain meaning |
|---|---|
| View / Search / Filter | Look at records without changing them. |
| Submit / Save / Create | Send a form or save information. |
| Review | Check information before making a decision. |
| Approve / Reject | Move a request or record to the next decision state. |
| Upload | Add a photo, document, or other file. |
| Status | Shows where the item is in its workflow. Some buttons appear only in the right status. |

### Common workflows

**Customer or Supplier**

1. Open the showroom and select a vehicle.
2. Choose **Inquire** to ask questions or **Buy Now** to start a purchase.
3. Use **My Inquiries** to chat and arrange the next step.
4. Use **My Transactions** to upload required documents, save details, print, or cancel when allowed.

**Vehicle listing**

1. Marketing adds or edits the vehicle.
2. Marketing proposes a price.
3. CEO approves or rejects the price proposal.
4. Marketing publishes or archives the listing when its status allows it.

**Customer inquiry and sale**

1. Account Manager responds to the inquiry.
2. Sales Manager accepts a handoff when an in-person sale is needed.
3. Staff move the transaction through review, documents, payment, and completion.

**Inspection and security evidence**

1. Mechanic records vehicle condition and required documents.
2. Head Security starts a duty check.
3. The checker uploads the **before** and **after** evidence.
4. **Complete Check** appears only when both files are present.

**Finance and payroll**

1. An authorised requester submits a finance or payroll item.
2. The responsible finance role reviews, approves, releases, receives, or marks it paid.
3. Head Accountant controls final payment and payslip actions.

## Technical audit detail

<details>
<summary>Expand the current-state hierarchy, route inventory, and evidence notes</summary>

The audit below records the current working tree. The code uses exact-role allowlists; roles do not inherit one another's permissions. Evidence priority is current page components and guards → role/navigation definitions → server actions and RLS-facing checks → existing GCE documentation.

## 1. User-level hierarchy and coverage

```text
CEO
  ↓
Account Manager / Head Accountant
  ↓
Sales Manager
  ↓
Confidential Informant / Marketing Specialist / Mechanic / Head Security
  ↓
Customer / Supplier (external users)
```

This is the requested responsibility map, not permission inheritance. The application uses exact role allowlists, page guards, action guards, and RLS; Customer and Supplier remain external portal users even though they are shown at the end of the map.

| User level | Operational position | Active navigation grants | Primary ownership |
|---|---|---:|---|
| CEO | Executive owner and approver | 23 | Company oversight, approvals, announcements, supplier channel |
| Account Manager | Administrative and customer-operations lead | 19 | RBAC, staff records, inquiries, requests, payroll preparation |
| Head Accountant | Finance and payroll control | 9 | Financial verification, payroll review/finalisation, payment records |
| Sales Manager | Sales and in-person handoff lead | 11 | Sales pipeline, walk-ins, transactions, customer handoff |
| Confidential Informant | Field acquisition, delivery, and recovery worker | 7 | Field cases, vehicle sourcing, delivery, recovery expenses |
| Marketing Specialist | Listings, price proposals, and public content | 5 | Vehicle presentation, price proposals, landing-page content |
| Mechanic | Vehicle condition and inspection worker | 5 | Inspection checklist, repairs, condition evidence |
| Head Security | Building security and attendance checker | 6 | Duty evidence, attendance/request checking |
| Customer | External buyer or seller | 7 | Browse, inquire, buy, sell, request, and save vehicles |
| Supplier | External vehicle source | 7 | Supplier portal access after approval; the same portal set is currently granted as Customer |

### 1.1 Active navigation inventory by role

Child routes are listed beside their parent so create/detail pages are not lost in the menu count.

### CEO — 23 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/ceo/dashboard` | Dashboard | CEO | Executive operating summary and drill-down links. |
| `/ceo/finance` | Finance | CEO / Head Accountant | Read the ledger and advance authorised disbursement stages; CEO requests purchase funds. |
| `/ceo/vehicles`, `/ceo/vehicles/new`, `/ceo/vehicles/[id]` | Vehicles | Marketing / CEO | View all inventory; CEO approves prices and alone deletes vehicles. |
| `/ceo/staff-showroom`, `/ceo/showroom/[id]` | Staff Showroom | Marketing / Sales | Preview the public listing presentation. |
| `/ceo/content` | Content | Marketing Specialist | CEO can review content; current source exposes management mutations to Marketing only. |
| `/ceo/inspections`, `/ceo/inspections/[id]` | Inspections | Mechanic | Read inspections, vehicle documents, and reports. |
| `/ceo/inquiries`, `/ceo/inquiries/[id]`, `/ceo/inquiries/reports` | Inquiries | Account Manager / Sales Manager | Review conversations, arrangements, and handoffs. |
| `/ceo/staff-recommendations` | Recommendations | CEO | Read inventory, sales, and market insight panels. |
| `/ceo/transactions`, `/ceo/transactions/[id]` | Transactions | Sales Manager / Head Accountant | Review deals, documents, payments, terms, and recovery actions. |
| `/ceo/roadmap`, `/ceo/roadmap/new`, `/ceo/roadmap/[id]` | Roadmap | CEO | Maintain platform planning items; write actions are CEO-gated. |
| `/ceo/roles` | Roles | CEO / Account Manager | Assign roles and inspect permission-management views. |
| `/ceo/users` | Users | Account Manager | Review real staff and customer account records. |
| `/ceo/suppliers` | Suppliers | CEO / Account Manager | Create, verify, approve, reject, and suspend supplier records. |
| `/ceo/staff-records` | Staff Records | Account Manager | Review employee/customer records, status, reviews, and walk-in accounts. |
| `/ceo/attendance` | Attendance | Account Manager / Head Accountant | Clock own attendance and check staff records. |
| `/ceo/employee-requests` | Employee Requests | Account Manager | Review leave and overtime requests. |
| `/ceo/payroll` | Payroll | Account Manager / Head Accountant | Review payroll runs and approval state. |
| `/ceo/payslips`, `/ceo/payslips/[id]` | Payslips | Head Accountant | Inspect individual pay records. |
| `/ceo/field-cases` | Field Cases | Informant / Mechanic | Review field work and create recovery cases where authorised. |
| `/ceo/security-duty-checks` | Security Duty Checks | Head Security | Review before/after security evidence. |
| `/ceo/reports` | Reports | CEO / Head Accountant | Submit or mark submitted reports reviewed. |
| `/ceo/announcements` | Announcements | CEO | Create, publish, expire, and archive company notices. |
| `/ceo/supplier-messages` | Supplier Messages | CEO | Send and read the CEO-to-supplier thread. |

### Account Manager — 19 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/account_manager/dashboard` | Dashboard | Account Manager | Operational summary, employee requests, and due-installment notices. |
| `/account_manager/finance` | Finance | Account Manager / Head Accountant | Create permitted disbursement requests and read ledger data. |
| `/account_manager/roles` | Roles | Account Manager / CEO | Assign roles under the role-management action guard. |
| `/account_manager/users` | Users | Account Manager | Review account records. |
| `/account_manager/vehicles`, `/account_manager/vehicles/new`, `/account_manager/vehicles/[id]` | Vehicles | Marketing | View inventory; vehicle mutations are action-gated. |
| `/account_manager/inspections`, `/account_manager/inspections/[id]` | Inspections | Mechanic | Review inspection and vehicle-document state. |
| `/account_manager/inquiries`, `/account_manager/inquiries/[id]`, `/account_manager/inquiries/reports` | Inquiries | Account Manager | Take customer inquiries, answer, and schedule arrangements. |
| `/account_manager/staff-recommendations` | Recommendations | Account Manager | Read management insight panels. |
| `/account_manager/transactions`, `/account_manager/transactions/[id]` | Transactions | Sales Manager | View and perform only the allowed transaction transitions. |
| `/account_manager/roadmap`, `/account_manager/roadmap/new`, `/account_manager/roadmap/[id]` | Roadmap | CEO | View planning board; writes remain CEO-gated. |
| `/account_manager/suppliers` | Suppliers | Account Manager / CEO | Maintain supplier onboarding and KYC state. |
| `/account_manager/staff-records` | Staff Records | Account Manager | Maintain employee/customer records and walk-in accounts. |
| `/account_manager/attendance` | Attendance | Account Manager | Check attendance and clock own record. |
| `/account_manager/employee-requests` | Employee Requests | Account Manager | Submit own requests and review staff requests. |
| `/account_manager/payroll` | Payroll | Account Manager | Maintain compensation and create payroll runs. |
| `/account_manager/payslips`, `/account_manager/payslips/[id]` | Payslips | Account Manager | View permitted payslip records. |
| `/account_manager/field-cases` | Field Cases | Account Manager | View field cases; recovery creation is separately restricted. |
| `/account_manager/reports` | Reports | Account Manager | Submit reports and read/review according to action guard. |
| `/account_manager/announcements` | Announcements | CEO | Read company notices. |

### Head Accountant — 9 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/head_accountant/dashboard` | Dashboard | Head Accountant | Finance/payroll-oriented summary. |
| `/head_accountant/finance` | Finance | Head Accountant | Verify entries and advance/release disbursements. |
| `/head_accountant/vehicles` | Vehicles | Marketing | Monitor inventory and listing state. |
| `/head_accountant/transactions`, `/head_accountant/transactions/[id]` | Transactions | Head Accountant / Sales Manager | Verify payments, approve terms, and instruct recovery when allowed. |
| `/head_accountant/attendance` | Attendance | Head Accountant | Check attendance for payroll control. |
| `/head_accountant/payroll` | Payroll | Head Accountant | Review, finalise, and control payroll state. |
| `/head_accountant/payslips`, `/head_accountant/payslips/[id]` | Payslips | Head Accountant | Mark payslips paid and inspect details. |
| `/head_accountant/reports` | Reports | Head Accountant | Submit and review reports. |
| `/head_accountant/announcements` | Announcements | CEO | Read company notices. |

### Sales Manager — 11 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/sales_manager/dashboard` | Dashboard | Sales Manager | Sales and operational summary. |
| `/sales_manager/vehicles`, `/sales_manager/vehicles/new`, `/sales_manager/vehicles/[id]` | Vehicles | Marketing | Read inventory and listing details; mutations are action-gated. |
| `/sales_manager/staff-showroom`, `/sales_manager/showroom/[id]` | Staff Showroom | Marketing | Preview public listings. |
| `/sales_manager/inspections`, `/sales_manager/inspections/[id]` | Inspections | Mechanic | Review condition and required vehicle documents. |
| `/sales_manager/inquiries`, `/sales_manager/inquiries/[id]`, `/sales_manager/inquiries/reports` | Inquiries | Sales Manager | Receive Buy Now work and accept customer handoffs. |
| `/sales_manager/staff-recommendations` | Recommendations | Sales Manager | Read sales and market insights. |
| `/sales_manager/transactions`, `/sales_manager/transactions/[id]` | Transactions | Sales Manager | Move sales through the allowed stages and record paperwork. |
| `/sales_manager/roadmap`, `/sales_manager/roadmap/new`, `/sales_manager/roadmap/[id]` | Roadmap | CEO | View planning board; writes remain CEO-gated. |
| `/sales_manager/field-cases` | Field Cases | Informant / Mechanic | Create and coordinate field work where permitted. |
| `/sales_manager/staff-records` | Staff Records | Account Manager | Create walk-in accounts and review records. |
| `/sales_manager/announcements` | Announcements | CEO | Read company notices. |

### Confidential Informant — 7 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/confidential_informant/dashboard` | Dashboard | Confidential Informant | Field and finance summary. |
| `/confidential_informant/finance` | Finance | Head Accountant | Create and view own disbursement requests; no ledger verification/advance controls. |
| `/confidential_informant/vehicles` | Vehicles | Marketing | View vehicles relevant to field work. |
| `/confidential_informant/inspections`, `/confidential_informant/inspections/[id]` | Inspections | Mechanic | Read condition and vehicle-document state. |
| `/confidential_informant/transactions`, `/confidential_informant/transactions/[id]` | Transactions | Sales Manager | View assigned transaction work. |
| `/confidential_informant/field-cases` | Field Cases | Confidential Informant | Work assigned sourcing, acquisition, delivery, and recovery cases. |
| `/confidential_informant/announcements` | Announcements | CEO | Read company notices. |

### Marketing Specialist — 5 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/marketing_specialist/dashboard` | Dashboard | Marketing Specialist | Listing and content summary. |
| `/marketing_specialist/vehicles`, `/marketing_specialist/vehicles/new`, `/marketing_specialist/vehicles/[id]` | Vehicles | Marketing Specialist | Create/update listings, propose prices, publish, archive where allowed, and manage media. |
| `/marketing_specialist/staff-showroom`, `/marketing_specialist/showroom/[id]` | Staff Showroom | Marketing Specialist | Check the public presentation. |
| `/marketing_specialist/content` | Content | Marketing Specialist | Create, edit, publish, and delete landing-page content. |
| `/marketing_specialist/announcements` | Announcements | CEO | Read company notices. |

### Mechanic — 5 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/mechanic/dashboard` | Dashboard | Mechanic | Work summary. |
| `/mechanic/vehicles` | Vehicles | Marketing | Read vehicle details needed for inspection. |
| `/mechanic/inspections`, `/mechanic/inspections/[id]` | Inspections | Mechanic | Complete checklist answers, repairs, and condition evidence. |
| `/mechanic/field-cases` | Field Cases | Informant | View/coordinate cases and accept mechanic assignments. |
| `/mechanic/announcements` | Announcements | CEO | Read company notices. |

### Head Security — 6 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/head_security/dashboard` | Dashboard | Head Security | Attendance and security summary. |
| `/head_security/vehicles` | Vehicles | Marketing | Read vehicle records if needed for security work. |
| `/head_security/attendance` | Attendance | Head Security | Clock in/out and check staff attendance where permitted. |
| `/head_security/employee-requests` | Employee Requests | Head Security | Submit requests; page-level access is broader than review actions. |
| `/head_security/security-duty-checks` | Security Duty Checks | Head Security | Start checks and upload required before/after evidence. |
| `/head_security/announcements` | Announcements | CEO | Read company notices. |

### Customer — 7 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/customer/showroom`, `/customer/showroom/[id]` | Customer Showroom | Customer | Browse available vehicles, filter, open details, favourite, inquire, or buy. |
| `/customer/recommendations` | Find Your Car | Customer | Enter preferences and receive a ranked shortlist. |
| `/customer/my-inquiries`, `/customer/my-inquiries/[id]` | My Inquiries | Customer / Account Manager | Read owned conversations, send messages/files, and view arrangements. |
| `/customer/my-transactions`, `/customer/my-transactions/[id]` | My Transactions | Customer / Sales Manager | Track purchases, sales, requests, documents, payments, and schedules. |
| `/customer/request-a-car` | Request a Car | Customer / Sales Manager | Submit a sourcing request. |
| `/customer/sell-vehicle` | Sell Vehicle | Customer / Account Manager | Submit a vehicle offer to GCE. |
| `/customer/favourites` | Favourites | Customer | Review saved vehicles. |

### Supplier — 7 grants

| Route | Module | Handled by | Purpose and access note |
|---|---|---|---|
| `/supplier/showroom`, `/supplier/showroom/[id]` | Customer Showroom | Supplier after approval | Current role configuration grants the same showroom access as Customer. |
| `/supplier/recommendations` | Find Your Car | Supplier after approval | Same portal route is granted; this is a documented/system mismatch. |
| `/supplier/my-inquiries`, `/supplier/my-inquiries/[id]` | My Inquiries | Supplier / CEO | Same portal route is granted; supplier message access is separately approved. |
| `/supplier/my-transactions`, `/supplier/my-transactions/[id]` | My Transactions | Supplier | Same portal route is granted by current role configuration. |
| `/supplier/request-a-car` | Request a Car | Supplier | Same portal route is granted by current role configuration. |
| `/supplier/sell-vehicle` | Sell Vehicle | Supplier | Same portal route is granted by current role configuration. |
| `/supplier/favourites` | Favourites | Supplier | Same portal route is granted by current role configuration. |

## 2. Shared access and application controls

These controls are shared infrastructure rather than role-owned business modules. They are documented once so they are not duplicated in every role table.

| Page/control | Visible action | Type | Purpose and condition |
|---|---|---|---|
| `/auth/v1/login` and `/auth/v2/login` | Login | Form submit | Authenticates an account and redirects it to the role landing page; supplier sign-in remains approval-gated. |
| Login | Email Address / Password | Form fields | Supply the credentials submitted to the login action. |
| Login | Remember me for 30 days | Visible but unwired form control | The checkbox is displayed, but its value is not included in the submitted sign-in data. |
| Login | Continue with Google | OAuth-looking control | Present in the shared component but currently receives no auth action and is unwired. |
| Login | Register | Navigation | Opens the registration flow for visitors without an account. |
| `/auth/v1/register` and `/auth/v2/register` | Register | Form submit | Creates a self-service account where the selected registration flow permits it. |
| Register | Full Name / Email Address / Password / Confirm Password | Form fields | Supply the values submitted to account registration and validation. |
| Register | Login | Navigation | Returns an existing account to the login flow. |
| Staff/customer shell | Sidebar item | Navigation | Opens the role-prefixed path generated from the active navigation allowlist. |
| Staff shell | Search | Utility control | Opens the application search interface. |
| Staff shell | Quick Create | Utility control | Visible in the sidebar configuration but currently has no wired click handler or destination. |
| Staff shell | Inbox | Utility control | Visible as an icon-only control in the sidebar configuration but currently has no wired click handler or destination. |
| Staff shell | Notifications | Utility control | Opens the notification list and shows the unread count. |
| Notification item | Mark notification as read | State mutation | Marks one unread notification read through the guarded notification action. |
| Notifications | Mark all as read | State mutation | Marks all displayed unread notifications read through the guarded notification action. |
| Staff shell | Theme / Font / Layout controls | Preference control | Changes presentation preferences; it does not change business permissions. |
| Layout controls | Restore Defaults | Preference mutation | Restores the saved presentation preferences. |
| Staff shell | Account menu | Account control | Opens profile/session actions. |
| Account menu | Profile | Navigation | Opens the profile route. |
| Account menu | Sign out | Session action | Ends the authenticated session and returns to login. |
| Tables | Search, filter, sort, rows-per-page, previous/next page | View controls | Change the displayed records only; they do not mutate business data. |
| Dialogs/sheets | Cancel / close | Navigation control | Dismisses an open form without submitting it. |
| Forms | Submit/Create/Save/Update | Mutation control | Validates and sends the form to its server action; the exact role/state guard remains authoritative. |

## 3. Active module catalog

### 3.1 Dashboard

**Routes:** `/{staff-role}/dashboard`
**Handled by:** every staff role, with role-specific panels.
**Purpose:** the first operational summary after sign-in. It presents counts, alerts, and links to the work pages that need attention. The CEO receives the broadest overview; other roles receive panels relevant to their work.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Summary cards and drill-down links | Navigation | Role-specific panel | Opens the underlying module or filtered work queue. |
| Refresh/reload links where shown | View control | Page-specific | Re-reads current server data. |
| Notification links | Navigation | Authenticated staff | Opens the related request, installment, or work item. |

### 3.2 Finance

**Route:** `/{ceo\|account_manager\|head_accountant\|confidential_informant}/finance`
**Handled by:** Head Accountant owns verification/release; CEO, Account Manager, and Confidential Informant create the request types permitted to them.
**Purpose:** records revenue, expenses, adjustments, and disbursement requests. The Informant sees only their own requests.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Record Entry | Opens form | CEO, Account Manager, Head Accountant where action guard permits | Enter a financial ledger record. |
| Request Disbursement | Opens form | CEO, Account Manager, Confidential Informant | Create a general money request. |
| Request Purchase Funds | Opens form | CEO / permitted requester with a transaction | Link a purchase-fund request to a transaction. |
| Ledger / Disbursements | Tabs | Finance roles | Switch between ledger records and disbursement requests. |
| Verify | Row mutation | Head Accountant / authorised verifier | Mark a financial entry verified. |
| Submit / Approve / Reject / Release / Receive / Mark Paid | State mutations | Request owner for submission; CEO or Head Accountant for the advance/reject controls when the current state permits | Move a disbursement through its explicit lifecycle. A draft visible to other roles shows the automatic "Awaiting approval by finance roles" message instead of a button. |
| Cancel / Record / Submit Request | Dialog controls | Form owner | Close or submit the selected finance form. |

### 3.3 Vehicles

**Routes:** `/{staff-role}/vehicles`, `/{staff-role}/vehicles/new`, `/{staff-role}/vehicles/[id]`
**Handled by:** Marketing Specialist for operational listing writes; CEO for price approval and vehicle deletion; all staff have inventory visibility through the active menu.
**Purpose:** the master vehicle inventory, public-listing state, media, pricing proposal, and archive state.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Add Vehicle | Navigation/form | Marketing Specialist | Open the vehicle creation sheet/page. |
| Edit / Update Vehicle | Row/form mutation | Marketing Specialist | Change vehicle details. |
| Search vehicles... | View control | Inventory viewers | Search the vehicle inventory. |
| Status, Condition, Pricing, Sort | Filters | Inventory viewers | Narrow or order the vehicle list. |
| Propose Price / Submit Proposal | Mutation/form | Marketing Specialist; pending duplicate proposals are rejected | Submit a price proposal and move the vehicle to awaiting-price-approval. |
| Publish / Publish this vehicle? | Approval-confirmed mutation | Marketing Specialist after required price approval | Make an eligible vehicle available to the public showroom. |
| Pending / Vehicles | View toggle | Vehicle-operation viewers | Switch between pending price proposals and the vehicle inventory table. |
| Search proposals... / Sort | View controls | CEO price-approval viewer | Find and order pending price proposals. |
| Approve / Reject | Approval mutation | CEO on a pending price proposal | Open the confirmation dialog and approve or reject the proposal; approval sets the proposed vehicle price. |
| Cancel / Approve / Reject / Submitting... | Confirmation controls | CEO price-approval decision dialog | Dismiss or confirm the selected price decision; the submitting label reflects the in-flight request. |
| Archive / Archive this vehicle? | Destructive/state mutation | Marketing Specialist; reserved, sold, and awaiting-approval states are blocked | Remove an eligible vehicle from active listings. |
| Delete / Delete this vehicle? | Destructive mutation | CEO only; reserved/sold and related-transaction records are protected | Permanently remove an eligible vehicle record. |
| View Details | Navigation | Inventory viewers | Open the vehicle detail route. |
| Upload Media | File upload | Marketing Specialist / authorised vehicle manager | Add a photo or 360° frame to a vehicle. |
| Photo / 360° Frame | Media-kind select | Marketing Specialist on vehicle detail | Choose whether the next upload is a photo or a 360° frame. |
| Upload / Uploading... | File upload | Marketing Specialist / authorised vehicle manager | Add the selected media kind; the progress label reflects the in-flight upload. |
| Delete media | Destructive media action | Authorised vehicle manager | Delete an uploaded media item. |
| Cancel / Create Vehicle / Update Vehicle | Form controls | Marketing Specialist | Close or submit the vehicle form. |
| Select all / row selection / Rows per page / page navigation | Table controls | Inventory viewers | Select rows or move through the table without mutating records. |

### 3.4 Staff Showroom

**Routes:** `/{ceo\|marketing_specialist\|sales_manager}/staff-showroom` and vehicle detail links.
**Handled by:** Marketing Specialist owns presentation; CEO and Sales Manager review it.
**Purpose:** preview the customer-facing showroom and verify that published listings look correct.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Vehicle card/link | Navigation | Granted staff roles | Open the public-style vehicle detail. |
| Find Your Car | Navigation | Granted staff showroom roles | Open the recommendations route from the showroom header. |
| Search vehicles... | View control | Granted staff showroom roles | Search visible vehicle cards by make, model, or stock text. |
| Make / All Makes | View control | Granted staff showroom roles | Filter the preview list by make. |
| Newest First / Price: Low to High / Price: High to Low | Sort control | Granted staff showroom roles | Change the preview ordering. |
| Add to favourites / Remove from favourites | Mutation | Authenticated viewer when a vehicle is eligible | Add or remove a vehicle from the signed-in viewer's favourites. |
| Inquire / Buy Now on vehicle detail | Customer workflow entry | Viewer on the linked eligible vehicle detail | Starts the same inquiry or purchase path available from the public showroom. |

### 3.5 Content

**Route:** `/{ceo\|marketing_specialist}/content`
**Handled by:** Marketing Specialist.
**Purpose:** manage landing-page promotions and featured vehicles. The current page allows the CEO to review content but exposes content mutations only to Marketing Specialist.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| New Content Item | Form opener | Marketing Specialist | Open a new promotion, banner, or featured-vehicle form. |
| Type / Vehicle | Select controls | Marketing Specialist | Choose content kind and, for featured vehicles, the linked vehicle. |
| Create / Save Changes | Mutation | Marketing Specialist; title required | Create or update a content item. |
| Edit content | Icon action | Marketing Specialist | Load an existing item into the edit form. |
| Delete content | Destructive icon action | Marketing Specialist | Delete a content item after browser confirmation. |
| Publish | State mutation | Marketing Specialist; unpublished item only | Publish the item to the public content surface. |
| Cancel | Form control | Editing Marketing Specialist | Close editing and clear the form. |

### 3.6 Inspections

**Routes:** `/{ceo\|account_manager\|confidential_informant\|mechanic\|sales_manager}/inspections` and `/.../inspections/[id]`
**Handled by:** Mechanic.
**Purpose:** record vehicle condition, nested checklist answers, repairs/replacements, inspection reports, and required vehicle documents.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Export | Unwired output-looking control | Inspection viewers | Visible in the current table, but the button has no click handler and does not currently export data. |
| Score, Date, Recommendation, Sort | Filters | Inspection viewers | Narrow/order inspection records. |
| View Details | Navigation | Inspection viewers | Open the inspection detail route. |
| View Vehicle | Navigation | Inspection viewers | Open the linked vehicle detail. |
| Print Report | Output control | Inspection viewers | Open the inspection report in a printable window. |
| Good / For Repair / For Replacement | Checklist state select | Mechanic on editable checklist entries | Record the condition of a checklist item. |
| Save | Checklist mutation | Mechanic | Save an answer, note, repair, or replacement estimate. |
| Upload | File upload | Role/state permitting document entry | Upload a required vehicle document. |
| Verify / Reject | Document review | Authorised verifier | Change a vehicle-document verification state. |
| Select all / rows-per-page / pagination | Table controls | Inspection viewers | Manage the visible table only. |

### 3.7 Inquiries

**Routes:** `/{ceo\|account_manager\|sales_manager}/inquiries`, `/.../inquiries/[id]`, and `/.../inquiries/reports`
**Handled by:** Account Manager for first response and arrangements; Sales Manager for Buy Now/in-person handoff; CEO can review.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Assign to me | Ownership mutation | Account Manager / Sales Manager according to inquiry type | Claim the inquiry for the current staff role. |
| Handoff to Sales Manager | Workflow mutation | Account Manager on a GCE-visit arrangement | Offer the in-person conversation to Sales Manager. |
| Accept Handoff | Workflow mutation | Sales Manager on an offered handoff | Take over the in-person customer conversation. |
| Arrange Viewing / Show Arrangement | Form toggle | Inquiry handler | Open delivery, CALABARZON meet-up, or GCE visit fields. |
| Schedule | Workflow mutation | Inquiry handler with a date/time | Save the viewing arrangement. |
| Cancel arrangement | Form control | Inquiry handler | Close arrangement editing without saving. |
| Send message | Chat mutation | Inquiry owner/customer participant | Send a text message. |
| Attach file / Send with attachment | Upload + mutation | Inquiry participant | Send a message with a file attachment. |
| Report message | Moderation action | Conversation participant | Report an inappropriate message. |
| Dismiss / Uphold | Moderation mutations | Authorised staff reviewer | Dismiss the report or uphold it through the report-review action. |
| Reports | Navigation | Route currently lacks an equivalent child guard; data/action checks still apply | Review inquiry reports. |

### 3.8 Recommendations and Insights

**Route:** `/{ceo\|account_manager\|sales_manager}/staff-recommendations`
**Handled by:** CEO, Account Manager, and Sales Manager as decision users.
**Purpose:** read sales overview, inventory status/allocation, top vehicles, KPIs, and market activity.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Market period selector | View control | Insight viewers | Switch weekly, monthly, or yearly market activity. |
| Chart/table selectors | View controls | Insight viewers | Change the displayed analytical slice. |
| KPI, sales, inventory, market panels | Read-only view | Insight viewers | Support pricing, buying, and inventory decisions. |
| Customer recommendation feedback | Automatic/customer action | Customer recommendation flow | Stores helpful/not-helpful feedback; no current staff accuracy view reads it. |

### 3.9 Transactions

**Routes:** `/{ceo\|account_manager\|head_accountant\|confidential_informant\|sales_manager}/transactions` and `/.../transactions/[id]`
**Handled by:** Sales Manager for sales progression; Head Accountant for payment and terms controls; CEO/Account Manager have selected transition permissions.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Search, status/type filters, sort, rows-per-page | View controls | Transaction viewers | Find and order transactions. |
| Open transaction actions / View Details | Navigation | Transaction viewers | Open the complete transaction record. |
| Move to Review / Approve / Reject / Complete / Cancel | State mutation | Exact role/state allowlist in `transactions/actions.ts` | Progress or close a transaction. |
| Upload Document | File upload | Customer on owned transaction | Add valid ID or proof-of-billing evidence. |
| Verify / Reject document | Document review | Authorised staff | Decide whether a submitted transaction document is accepted. |
| Record Payment | Financial record | Authorised staff | Record an offline payment; the app does not move money. |
| Verify Payment | Financial verification | Head Accountant and other explicitly authorised roles | Confirm a payment record. |
| Approve Terms | Approval mutation | Head Accountant when proposed terms are present | Approve proposed financing terms. |
| Activate & Generate Installments | Workflow mutation | CEO / Account Manager according to action guard | Generate the installment schedule from approved terms. |
| Record invoice / Record receipt | Paperwork mutation | Authorised staff after completion | Record the final transaction paperwork kind. |
| Valuation / Notes / Accept / Reject | Sell-offer review controls | Sales Manager on an unreviewed sell transaction | Record the valuation and notes, then accept or reject the customer offer. |
| Create Payment Terms | Server action helper; no current UI caller | Exported transaction action only | The action can propose terms, but the current rendered staff detail does not expose a Create Payment Terms button. |
| Assign Informant | Server action helper; no current UI caller | Exported transaction action only | The action can assign field work, but the current rendered staff detail does not expose an Assign Informant button. |
| Mark Installment Waived | Financial state mutation | Head Accountant | Waive an installment when permitted. |
| Instruct Repossession | Recovery mutation | Head Accountant; recovery case is created for an Informant | Start the documented recovery path. |
| Create Walk-in Transaction | Server action helper; no current UI caller | Exported transaction action only | The action exists for walk-in transaction creation, but the current rendered transaction pages do not expose a matching button. |
| Save Details | Customer form mutation | Transaction owner | Save payment method, arrangement, and purchase details. |
| Cancel Transaction / Keep Transaction / Yes, Cancel Transaction | Destructive-confirmed customer action | Eligible customer-owned transaction | Cancel or retain the transaction according to lifecycle rules. |

### 3.10 Roadmap

**Routes:** `/{ceo\|account_manager\|sales_manager}/roadmap`, `/.../roadmap/new`, `/.../roadmap/[id]`
**Handled by:** CEO for roadmap writes; Account Manager and Sales Manager are viewers.
**Purpose:** plan platform work. It is development/platform tooling rather than a capstone business module.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Status filter | View control | Roadmap viewers | Filter active, planning, or completed items. |
| New Roadmap Item | Navigation | Visible to granted viewers; create action is CEO-gated | Open the item form. |
| Edit | Navigation/action | CEO action guard | Open an existing item for editing. |
| Save / Create | Mutation | CEO | Create or update a roadmap item. |
| Delete | Destructive mutation | CEO | Delete an item after confirmation. |
| Cancel / Back | Navigation control | Form user | Close the form without saving. |

### 3.11 Suppliers

**Route:** `/{ceo\|account_manager}/suppliers`
**Handled by:** CEO and Account Manager; supplier cannot self-approve.
**Purpose:** create supplier records, collect two primary valid IDs, verify each document, and approve/reject the supplier. Approval is required before supplier sign-in.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Create Supplier | Sheet/form opener | CEO / Account Manager | Start a Company or Individual supplier record. |
| Company / Individual | Select | Supplier creator | Set supplier kind. |
| View supplier actions / Supplier Documents | Navigation | CEO / Account Manager | Open supplier details and KYC evidence. |
| Upload Document | File upload | CEO, Account Manager, or Head Accountant where the action guard permits | Add a supplier document. |
| Verify / Reject document | Verification action | Authorised staff | Decide individual supplier-document state. |
| Approve Supplier | State mutation | CEO / Account Manager after two verified primary IDs | Move a pending supplier to approved. |
| Reject Supplier | State mutation | CEO / Account Manager | Reject the supplier record. |
| Cancel / Create | Form controls | Supplier creator | Close or submit supplier creation. |

### 3.12 Staff Records

**Routes:** `/{ceo\|account_manager\|sales_manager}/staff-records`
**Handled by:** Account Manager; CEO and Sales Manager have the current page access required for oversight/walk-ins.
**Purpose:** maintain staff profiles, account status, performance reviews, and walk-in customer accounts.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Search staff... | View control | Staff-record viewers | Find a person or account. |
| Status / Joined date / Role / Sort | Filters | Staff-record viewers | Narrow or order the staff and account records. |
| Edit profile/details | Mutation | Authorised staff-record manager | Update stored profile details. |
| Staff / Reviews | Tabs | Staff-record viewers | Switch between account records and performance reviews. |
| Workdays | Checkbox group | Editing a staff account | Set the employee's scheduled workdays. |
| Start time / End time | Time inputs | Editing a staff account | Set the employee's scheduled work period. |
| Grace minutes | Number input | Editing a staff account | Set the allowed attendance grace period. |
| Save / Saving... | Mutation control | Editing an account | Persist profile and, for staff, schedule details; the progress label reflects the in-flight save. |
| Set account state | State mutation | Authorised staff-record manager | Set invited, active, suspended, or archived state. |
| Change Status | State mutation | Authorised staff-record manager | Persist the selected account status. |
| Submit Performance Review / Update Review | Mutation | Account Manager/CEO action guard | Create or revise an employee performance review. |
| Create Walk-in Account | Form opener | CEO, Account Manager, Sales Manager | Create a customer account for a walk-in. |
| Cancel / Create | Form controls | Walk-in form user | Close or submit the walk-in account form. |

### 3.13 Attendance

**Route:** `/{ceo\|account_manager\|head_accountant\|head_security}/attendance`
**Handled by:** Account Manager and designated checkers; all staff can clock their own attendance when the authenticated attendance state allows it.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Clock In | Attendance mutation | Staff whose schedule allows it | Record the start of the work period. |
| Clock Out | Attendance mutation | Staff whose state allows it | Record the end of the work period. |
| Refresh attendance | View control | When data is unavailable | Re-read attendance state. |
| Check attendance | Review opener | CEO, Account Manager, Head Accountant, Head Security where permitted | Open a staff attendance review. |
| Save Check | Review mutation | Checker role | Save status, notes, or review result. |
| Cancel | Dialog control | Attendance reviewer | Close the review without saving. |

### 3.14 Employee Requests

**Route:** `/{ceo\|account_manager\|head_security}/employee-requests`
**Handled by:** Account Manager and CEO for review; staff submit their own leave/overtime requests.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| New Request | Form opener | Authenticated staff page access | Start a leave or overtime request. |
| Submit | Mutation | Request owner | Save the request for review. |
| Cancel request | Mutation | Request owner while cancellable | Withdraw the request. |
| Review | Review opener | CEO / Account Manager | Open the request decision dialog. |
| Approve / Reject | Review mutation | CEO / Account Manager | Decide the request and feed the attendance/payroll workflow. |
| Cancel / close | Dialog control | Form/reviewer | Dismiss without a new decision. |

### 3.15 Payroll

**Route:** `/{ceo\|account_manager\|head_accountant}/payroll`
**Handled by:** Account Manager prepares; Head Accountant reviews/finalises; CEO approves.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Create Run | Form opener | CEO / Account Manager preparer | Start a payroll period. |
| Add Compensation | Form opener | CEO / Account Manager preparer | Store salary and deduction inputs for an employee. |
| Save Compensation | Mutation | Payroll preparer | Save the compensation record. |
| Reject / Approve | Review mutation | Head Accountant or CEO according to the current run stage | Move a payroll run through review. |
| Finalize | State mutation | Head Accountant on approved run | Finalise the payroll run. |
| Create Run / Cancel | Form controls | Payroll preparer | Submit or dismiss payroll-run creation. |

### 3.16 Payslips

**Routes:** `/{ceo\|account_manager\|head_accountant}/payslips` and `/.../payslips/[id]`; an employee can reach their own detail by ownership.
**Handled by:** Head Accountant for payment marking; employees/authorised staff read permitted records.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Open payslip | Navigation | Employee owner or authorised payroll role | View one payslip. |
| Print | Output control | Payslip viewer | Send the payslip to the browser print flow. |
| Add Item | Form opener | Draft/authorised record | Add an earning or deduction line. |
| Save Item | Mutation | Draft/authorised record | Save the line item. |
| Mark as Paid / Marking... | State mutation | Head Accountant only | Record that the payslip was paid outside the system; the progress label reflects the in-flight action. |
| Cancel | Dialog control | Item editor | Close without saving. |

### 3.17 Field Cases

**Route:** `/{ceo\|account_manager\|confidential_informant\|mechanic\|sales_manager}/field-cases`; Head Accountant is page/action-authorised for recovery but has no sidebar grant.
**Handled by:** Confidential Informant for field execution; CEO, Sales Manager, and authorised roles create/assign cases; Mechanic handles assigned inspection support.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Create Field Case | Form opener | Field-case creator allowlist; recovery is more restricted | Start sourcing, acquisition, delivery, or recovery work. |
| Assign Informant / worker | Assignment field | Case creator and allowed worker roles | Assign the person responsible for field execution. |
| Assign Mechanic | Assignment action | CEO, Informant, Sales Manager where permitted | Attach a mechanic to the case. |
| Edit / Update field case | Mutation | Case owner/authorised role | Change state, notes, dates, vehicle, worker, or expenses. |
| Save / Create / Assign | Mutation controls | Matching action guard | Persist the selected case operation. |
| Cancel | Dialog control | Form user | Close without saving. |

**Current UI limitation:** the standalone Create Field Case dialog is visible to permitted creators, but its current form does not supply the `transaction_id` or `vehicle_id` required by the server-side creation action. A submission therefore returns a validation error until one of those links is supplied. This is recorded as an implementation limitation, not as a successful field-case creation path.

### 3.18 Security Duty Checks

**Route:** `/{ceo\|head_security}/security-duty-checks`
**Handled by:** Head Security; CEO reviews.
**Purpose:** photographic before/after evidence for security shifts. Both evidence slots are required before completion.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Table / List / Grid | View toggle | Duty-check viewers | Change the presentation of duty checks. |
| Start Check / Start / Starting... | Form opener | Head Security / authorised starter | Create a check for a duty date; the progress label reflects the in-flight start. |
| Choose before/after file | File chooser | Check owner | Select evidence for the required slot. |
| Upload | File mutation | Check owner | Store before or after evidence. |
| Complete Check | State mutation | Both required files present | Mark the duty check complete. |
| Cancel / close | Dialog control | Form user | Close without starting a check. |

### 3.19 Reports

**Route:** `/{ceo\|account_manager\|head_accountant}/reports`
**Handled by:** report submitters and CEO/Head Accountant reviewers. The current implementation is a general report list; it does not expose the four fixed documentation streams as separate modules.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Submit Report | Form opener | Role-specific creator | Start a report submission. |
| Report Kind | Select | Report creator | Classify the report. |
| Submit | Mutation | Report creator | Save the report as submitted. |
| Mark Reviewed | Review mutation | CEO / Head Accountant where allowed | Mark a submitted report reviewed. |
| Cancel | Dialog control | Form user | Close without submitting. |

### 3.20 Announcements

**Route:** `/{staff-role}/announcements`
**Handled by:** CEO creates and manages; all eight staff roles read.
**Purpose:** company-wide notices.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| New Announcement | Form opener | CEO | Start a company notice. |
| Save Draft | Mutation | CEO | Save a draft announcement. |
| Publish | State mutation | CEO on eligible draft | Make the announcement visible to staff. |
| Expire | State mutation | CEO on published item | Mark an announcement expired. |
| Archive | State mutation | CEO on eligible item | Move an announcement to archived state. |
| Cancel | Dialog control | CEO editor | Close without saving. |

### 3.21 Supplier Messages

**Routes:** `/ceo/supplier-messages` and the supplier-permitted direct route when an approved supplier is linked.
**Handled by:** CEO and approved supplier.
**Purpose:** direct sourcing communication. The supplier is permitted by the page/action contract but has no active sidebar item.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Message composer | Form control | CEO or approved supplier participant | Enter a sourcing message. |
| Supplier | Select | CEO | Choose which approved supplier receives the CEO message. |
| Send | Mutation | CEO or approved supplier participant | Add a message to the thread. |
| Thread/read state | Read/view control | Thread participant | Read the current conversation. |

### 3.22 Roles

**Route:** `/{ceo\|account_manager}/roles`
**Handled by:** CEO and Account Manager.
**Purpose:** view and assign role-based access.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| User / Status / Current Role / Created | Read-only table columns | CEO or Account Manager | Inspect the account values loaded into the role-management table. |
| Change Role | Select/mutation | CEO or Account Manager | Assign the selected GCE role to a user account; the affected user must sign in again. |
| Role options | Select options | Change Role control | Choose one of the current `GCE_ROLES` values for the selected account. |

### 3.23 Users

**Route:** `/{ceo\|account_manager}/users`
**Handled by:** Account Manager and CEO.
**Purpose:** present the current account table and its template-style organization controls. The rendered component does not expose account detail, role-assignment, or account-state row actions.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Search users... | View control | CEO / Account Manager | Search the rendered user rows. |
| Hide / Customize / Export / Add User | Interface controls | CEO / Account Manager | Visible organization controls; the current component does not wire these buttons to a GCE mutation or export flow. |
| Role / Team / Status / Workspace | Filters | CEO / Account Manager | Narrow the displayed user table. |
| List view / Grid view | Visible but unwired interface control | CEO / Account Manager | The tabs are displayed, but no controlled state or alternate table presentation is connected. |
| Select all / row selection | Selection controls | CEO / Account Manager | Select visible rows; no row mutation is wired here. |
| Rows per page / first / previous / next / last | Pagination controls | CEO / Account Manager | Change the visible page of user rows. |

### 3.24 Customer Showroom and vehicle detail

**Routes:** `/{customer\|supplier}/showroom` and `/.../showroom/[id]`
**Handled by:** Customer/Supplier as viewers; Account Manager/Sales Manager receive the resulting inquiry or transaction.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Make filter | View control | Portal viewer | Filter vehicles by make. |
| Search vehicles... | View control | Portal viewer | Search visible vehicle cards by make, model, or stock text. |
| Newest First / Price: Low to High / Price: High to Low | Sort control | Portal viewer | Change vehicle ordering. |
| Add to favourites / Remove from favourites | Mutation | Authenticated portal user | Save or remove a vehicle from the shortlist. |
| Open vehicle card | Navigation | Portal viewer | Open photos, specification, and listing details. |
| Inquire / Starting... | Workflow mutation | Authenticated portal user on an eligible vehicle | Create an inquiry for staff; `Starting...` is shown while the request is in flight. |
| Buy Now / Sending... | Workflow mutation | Authenticated portal user on an eligible vehicle | Create a purchase transaction and inquiry path; `Sending...` is shown while the request is in flight. |

### 3.25 Find Your Car

**Route:** `/{customer\|supplier}/recommendations`
**Handled by:** Customer/Supplier as requesters; staff use the resulting demand/feedback data.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Budget and preference fields | Form controls | Portal user | Set the five weighted recommendation inputs. |
| Get Recommendations | Mutation | Portal user | Run the ranking and show scored available vehicles. |
| Score Breakdown | View toggle | Result viewer | Show the reasons behind a vehicle’s score. |
| Yes / No | Feedback mutation | Result viewer | Record recommendation feedback. |
| Open vehicle result | Navigation | Result viewer | Inspect the selected vehicle. |

### 3.26 My Inquiries

**Routes:** `/{customer\|supplier}/my-inquiries` and `/.../my-inquiries/[id]`
**Handled by:** Customer/Supplier for owned conversations; Account Manager/Sales Manager on staff inquiry pages.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Open inquiry | Navigation | Owned inquiry participant | Open the thread detail. |
| Back to conversations | Navigation control | Mobile thread view | Return from the selected thread to the conversation list. |
| Send message | Chat mutation | Owned inquiry participant | Reply to the conversation. |
| Attach file / send attachment | Upload + mutation | Owned inquiry participant | Send a file with a message. |
| Type a message... / Send / Sending... | Chat controls | Owned inquiry participant | Enter and submit text; `Sending...` reflects the in-flight request. |
| Mark messages read | View-state mutation | Thread participant | Clear unread state for the thread. |
| Report message | Moderation mutation | Thread participant | Submit a message report. |
| Arrangement details | Read-only view | Thread participant | See the scheduled delivery, meet-up, or GCE visit. |

### 3.27 My Transactions

**Routes:** `/{customer\|supplier}/my-transactions` and `/.../my-transactions/[id]`
**Handled by:** Customer/Supplier for owned records; Sales Manager/Head Accountant for staff-side processing.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Request a Car | Navigation | Portal user | Open the sourcing-request form. |
| Sell Your Vehicle | Navigation | Portal user | Open the sell-vehicle form. |
| Search/status/type filters | View controls | Portal user | Find a transaction. |
| Open transaction actions | Navigation menu | Owned transaction | Open transaction details. |
| Cancel Transaction | Confirmed mutation | Eligible owned transaction | Open the cancellation confirmation. |
| Keep Transaction / Yes, Cancel Transaction | Confirmation controls | Cancellation dialog | Close the dialog or confirm cancellation. |
| Save Details | Mutation | Eligible purchase owner | Save payment method and arrangement details. |
| Upload | File upload | Eligible purchase owner | Upload valid ID or proof of billing. |
| Print | Output control | Transaction owner | Print the transaction summary. |

### 3.28 Request a Car

**Route:** `/{customer\|supplier}/request-a-car`
**Handled by:** Customer/Supplier submits; Sales Manager/CEO route the request into sourcing work.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Vehicle request fields | Form controls | Portal user | Describe the requested make, model, budget, and preferences. |
| Submit Request | Mutation | Portal user | Create a request transaction. |
| Cancel | Navigation control | Form user | Return without submitting. |

### 3.29 Sell Vehicle

**Route:** `/{customer\|supplier}/sell-vehicle`
**Handled by:** Customer/Supplier submits; staff review the resulting sell transaction.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Vehicle detail fields | Form controls | Portal user | Describe the vehicle offered to GCE. |
| Submit Vehicle | Mutation | Portal user | Create a sell-to-GCE transaction. |
| Cancel | Navigation control | Form user | Return without submitting. |

### 3.30 Favourites

**Route:** `/{customer\|supplier}/favourites`
**Handled by:** Customer/Supplier as portal users.
**Purpose:** review vehicles saved from the showroom. The page is read-oriented; save/remove is performed from the showroom card control.

| Action / button | Control type | Available to / condition | Purpose / result |
|---|---|---|---|
| Open saved vehicle | Navigation | Portal user | Return to vehicle details. |
| Remove from favourites | Mutation | Portal user | Remove the saved vehicle. |

## 4. Action and authorization notes

The following are important when reading the tables above:

- `ROLE_NAV_ACCESS` controls what appears in the sidebar. It is not the complete authorization system.
- Current page guards are uneven. Examples include `/staff-recommendations`, inquiry reports, roadmap child routes, transaction detail, and vehicle detail routes that do not all repeat the parent guard.
- The middleware rewrites role-prefixed paths and the staff layout authenticates the session, but an unlisted direct URL can still reach an unguarded staff page. Record visibility and mutations remain constrained by page/action/RLS checks where implemented.
- Head Accountant can access and create the permitted recovery path in Field Cases but has no Field Cases sidebar item.
- All staff can reach the Payslips page directly to see their own owned payslip even though only three staff roles receive the menu item.
- Supplier Messages is permitted to an approved supplier by the page/action contract, but Supplier has no active sidebar link to it.
- Current vehicle/content working-tree changes are reflected here: Marketing Specialist owns the listing/content mutations, CEO retains price approval and vehicle deletion, and Content is review-only for CEO.
- Export, create-user, and other template-looking controls are documented as interface controls when visible in the current component, and are explicitly marked unwired where no current business mutation exists. Unmounted template controls are excluded from active-module action tables.
- Server-side read helpers, KPI loaders, unread-count helpers, and data-fetch functions are not presented as user buttons. They are implementation details or automatic behavior.

## 5. Unlisted and inactive route appendix

These routes exist in the repository but are not active GCE modules in any role’s current navigation. They are listed to make the coverage boundary explicit.

| Route family | Classification | Treatment |
|---|---|---|
| `/template/*` (including the template CRM, analytics, calendar, chat, ecommerce, invoice, kanban, logistics, mail, productivity, and related page families) | Template/demo pages | Repository examples only; not counted as GCE modules and not granted by `ROLE_NAV_ACCESS`. |
| `/crm`, `/analytics`, `/productivity`, `/ecommerce`, `/academy`, `/logistics`, `/infrastructure` | Template/demo pages | Not counted as GCE modules; no role receives them in `ROLE_NAV_ACCESS`. |
| `/mail`, `/chat`, `/calendar`, `/kanban`, `/invoice` and standalone variants | Template/demo pages | Not counted as GCE modules; sidebar access is not granted. |
| `/default-v1`, `/crm-v1`, `/finance-v1`, `/analytics-v1` | Legacy dashboard pages | Retained for reference only; excluded from active role coverage. |
| `/coming-soon` | Disabled placeholder | Excluded from active module coverage. |
| `/auth/v2/*` | Alternate authentication shell | Listed in shared access because it exists, but current redirects use `/auth/v1/*`. |
| `/unauthorized` and catch-all not-found pages | System boundary pages | Not role-owned business modules; they represent denial or missing-route behavior. |
| `/supplier/supplier-messages` | Direct supplier channel path | Page/action permitted for approved supplier, but no active supplier sidebar item exposes it. |

## 6. Verification record

- All ten roles appear in the hierarchy and in a dedicated access section.
- Active navigation counts reconcile to the current role definitions: 23, 19, 9, 11, 7, 5, 5, 6, 7, and 7 respectively.
- Parent routes and known create/detail routes are listed in the role inventory and module catalog.
- Visible mutation, navigation, filter, upload, approval, destructive, confirmation, and state-dependent controls are catalogued by module.
- Template, legacy, disabled, duplicate-authentication, direct-only, and unwired controls are separated from active GCE business behavior.
- Control labels and conditional behavior were verified from the current rendered-component source and authorization paths. No live mutating browser session was required, so stateful controls that depend on real records are marked with their guard/fixture limitation rather than simulated with fabricated data.
- No credentials, identity evidence, personal records, or record identifiers are included.

## 7. Evidence index

- `src/lib/auth/roles.ts` — roles, labels, staff set, landing pages, navigation allowlists.
- `src/navigation/sidebar/sidebar-items.ts` — sidebar groups, labels, and route targets.
- `src/app/(staff)/_components/sidebar/app-sidebar.tsx` — role-based sidebar filtering and role-prefixed paths.
- `src/middleware.ts`, `src/lib/auth/guards.ts`, and staff/customer layouts — authentication, rewrites, and page guard behavior.
- `src/app/(staff)/**/page.tsx` and `src/app/(customer)/**/page.tsx` — page composition and route-level access.
- `src/app/(staff)/**/_components/*.tsx` and `src/app/(customer)/**/_components/*.tsx` — visible controls and forms.
- `src/app/(staff)/**/actions.ts`, `src/app/(customer)/**/actions.ts`, and `src/app/auth/actions.ts` — mutation names, role checks, lifecycle transitions, and uploads.
- `docs/ANALYZER/AUDIT - GLOBAL CAR EXCHANGE/15 - SYSTEM STATUS.md` and `17 - ROADMAP AUDIT.md` — current status and roadmap context.

</details>
