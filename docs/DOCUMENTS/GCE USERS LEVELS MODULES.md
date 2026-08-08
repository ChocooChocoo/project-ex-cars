# CEO

## 1. Executive Dashboard Overview

- The Executive Dashboard gives the CEO full oversight of GCE's entire operation. It serves as the central view for monitoring the company's overall activities and the work handled by its different operational roles.

## 2. Approval and Rejection of Reports

- The CEO reviews reports submitted by the other responsible roles and decides whether to approve or reject them. These include payslip and disbursement reports from the Account Manager, expense and revenue reports from the Head Accountant, vehicle price proposals from the Marketing Specialist, and inventory reports from the Sales Manager.

## 3. Announcements

- The CEO creates announcements intended for GCE employees. This function provides a way to communicate company information directly to the workforce.

# Account Manager

## 1. Dashboard Overview

- The Account Manager's dashboard provides an overview of leave requests, overtime requests, and vehicle reconditioning activities. This brings the employee-request and vehicle-reconditioning information assigned to the role into one view.
- The Account Manager also prepares reports covering attendance, payroll, and disbursements. These reports support the administrative and financial processes assigned to the Account Manager.

## 2. Inquiries and Viewing Schedule

- The Account Manager handles client inquiries about vehicles and coordinates vehicle viewing schedules. This role manages the initial inquiry and scheduling stage before an in-person discussion is handed over to the Sales Manager.
- If a client likes a vehicle, the Account Manager sends a form requesting information about the selected vehicle and the customer's credentials. Details such as the customer's name, phone number, and email address are automatically filled in using the information supplied during account registration. The client then chooses delivery, a meet-up, or an in-person visit to GCE, and the form changes according to the chosen arrangement. For delivery, the Marketing Specialist sets the required down payment before the vehicle is posted. Meet-ups are limited to locations within CALABARZON.

### A. Client Visits GCE

- When the client chooses to visit GCE, the Account Manager sets the viewing schedule based on the arrangement discussed with the client through the website's inquiry chat. The confirmed schedule is also shown to the Sales Manager so that the Sales Manager is aware of the visit.
- Once the client arrives at GCE for the scheduled viewing, the Sales Manager takes over the direct discussion with the client. This marks the handoff from inquiry and scheduling by the Account Manager to the in-person sales interaction handled by the Sales Manager.

## 3. Employee Records and Customer Account Records

- The Account Manager maintains both employee records and customer account records. The role also performs the actions required for those records within the corresponding module.

## 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements

> **Implementation status (9 Aug 2026):** statutory deduction amounts (SSS, Pag-IBIG, PhilHealth, TIN) are captured on each employee's compensation record and are added automatically as deduction items when a payroll run is created. Vehicle reconditioning status is surfaced on the dashboard (vehicles with inspection items flagged for repair/replacement).

- The Account Manager processes the attendance records, leave requests, overtime requests, and late-arrival records of GCE employees and administrators. These records provide the employee information used in payroll processing.
- The Account Manager prepares a payroll report for GCE staff and submits it to the Head Accountant for payslip approval. This establishes the documented handoff between the Account Manager's payroll preparation and the Head Accountant's payroll responsibility.
  - As part of payroll preparation, the Account Manager sets the salary of each employee and enters the deductions that will appear on the employee's payslip, including deductions for late arrivals and absences. The original explanation notes that GCE did not disclose the individual salaries of its employees during the interview.
  - The Account Manager also enters the amounts to be deducted from each employee's salary for SSS, Pag-IBIG, TIN, and PhilHealth. The source assigns the entry of these statutory deduction amounts to the Account Manager.

## 5. RBAC (Role-Based Access Control)

- The Account Manager manages role-based access control for GCE employees and administrators. This function controls access according to the role assigned to each employee or administrator.

# Head Accountant

## 1. Disbursement for Car Purchases

> **Implementation status (9 Aug 2026):** implemented as the CEO/Account Manager "Request Purchase Funds" action on the Finance page; only the Head Accountant may advance (approve/release) purchase-tagged disbursements.

- The Head Accountant releases the funds needed for the company to purchase a vehicle. The disbursement is made in response to a request from the CEO.

## 2. Payroll

- The Head Accountant has responsibilities in the payment of employee salaries. This responsibility connects with the payroll report that the Account Manager submits for payslip approval.

## 3. Car Inventory Monitoring

- The Head Accountant can view the vehicle inventory to double-check the company's sales or revenue information. The inventory view provides a financial cross-check against the vehicles recorded by the company.

## 4. Car Sales Monitoring

- The Head Accountant can view the company's vehicle sales, including the individual vehicles that have been sold. This gives the role visibility into the sales records relevant to financial monitoring.

## 5. Installment Accounts

> **Implementation status (9 Aug 2026):** installment accounts are managed via `payment_terms` (approve/activate) and `installments` (verify, waive). The due-date notification to the Account Manager is implemented (automated notifications from the installment schedule), and the repossession instruction to the Confidential Informant is implemented via the "Instruct Repossession" action, which creates a recovery field case. See `docs/ANALYZER/ANALYSIS - GLOBAL CAR EXCHANGE/15 - SYSTEM STATUS.md`.

- The Head Accountant manages or monitors the accounts of customers who purchase vehicles through installment plans. These accounts identify the buyers whose vehicle payments are made on an installment basis.
- When an installment payment reaches its due date, the Head Accountant notifies the Account Manager so the buyer can be contacted. This assigns the payment monitoring to the Head Accountant and the buyer-contact step to the Account Manager.
  - If the buyer does not pay within the ultimatum provided, the process moves toward repossession of the vehicle.
  - If the buyer continues not to pay, the Head Accountant instructs the Confidential Informant to retrieve the vehicle from the buyer.

## 6. Attendance Monitoring

- The Head Accountant can also view employee attendance records. These records are used to double-check the attendance information applied during payroll processing.

# Confidential Informant

## 1. Car Acquisition

- The Confidential Informant retrieves or takes possession of a vehicle when the company purchases it. This role handles the physical acquisition of the vehicle for GCE.

## 2. Mechanic Assignment

- The Confidential Informant assigns a mechanic to accompany them when inspecting a vehicle that the company may acquire. The mechanic provides the vehicle-checking function during the visit.

## 3. Repossession

- The Head Accountant may assign the Confidential Informant to retrieve or tow a buyer's vehicle when the buyer has not made the required payment and the due date has already passed. This is the vehicle-recovery step described for unpaid installment accounts.

## 4. Delivery

- The Confidential Informant can view the vehicles assigned to them for delivery. The assignment identifies which vehicle the role is responsible for delivering.

## 5. Mechanic Reports

- The Confidential Informant can view the mechanic's reports for a vehicle. These reports provide the vehicle information recorded by the mechanic after inspection or repair work.

## 6. Payment Approval Process

> **Implementation status (9 Aug 2026):** realized through the generalized disbursement ledger. The Confidential Informant can create disbursement requests and view their own requests on the Finance page; the CEO/Head Accountant advance them through approval/release. There is no separate CEO → Informant cash handoff in the system.

- The Confidential Informant sends a payment request to the CEO for approval. The payment cannot proceed through this workflow until the CEO has reviewed the request.
- After the CEO approves the request, the CEO gives or sends the required funds to the Confidential Informant. The Confidential Informant then has the funds needed to make the payment connected with the vehicle transaction.

## 7. Case Expenses

- The Confidential Informant may record case-related expenses when traveling to a vehicle that GCE intends to purchase or when delivering a vehicle. These expenses relate specifically to carrying out an acquisition or delivery assignment.

# Marketing Specialist

## 1. Vehicle Posting

- The Marketing Specialist posts vehicles on GCE's page or website so that consumers can view them. This role is responsible for making the vehicle listing visible to potential customers.

## 2. Price Approval

- Before posting a vehicle, the Marketing Specialist submits its proposed price to the CEO for approval. The approved price is then used for the vehicle that the Marketing Specialist will post.

# Mechanic

## 1. Vehicle Inspection

- The Mechanic checks the vehicle unit when the company is going to acquire or purchase a vehicle. The inspection helps evaluate the vehicle involved in the proposed acquisition.
- The Mechanic accompanies the responsible personnel when the vehicle is located somewhere other than GCE. In other cases, the seller may bring the vehicle directly to GCE for inspection.

## 2. Repair Progress Tracking

- The Mechanic's account shows the progress of vehicle repairs. It records the repairs completed by the Mechanic and indicates whether the vehicle has already been fixed or is still pending.

# Sales Manager

## 1. Buy Now and Inquiry Handling

- The system has two forms of client interaction: "Buy Now" and "Inquiry." A client action marked "Buy Now" is shown to the Sales Manager for sales handling, while an action marked "Inquiry" is shown to the Account Manager for inquiry handling.

## 2. Purchasing a Vehicle Through the Website and Visiting GCE

- When a client already has a GCE account and visits GCE to purchase a vehicle, information from the client's account registration is automatically entered into the form provided by the Sales Manager. The client completes the remaining information instead of re-entering the registration details already held by GCE.
- Even when account information is automatically filled in, the client must still provide two valid IDs and one proof of billing. These documents remain part of GCE's stated requirements for the purchase process.

## 3. Walk-In Client Purchasing a Vehicle (No Account)

- When a completely walk-in client wants to purchase a vehicle but does not have a registered GCE account, the Sales Manager creates an account directly through the Sales Manager module. After the account has been created, the client proceeds to the form used for the vehicle sale.
- The account created by the Sales Manager is also shown on the client side. This allows the walk-in client's newly created account to be reflected in the customer-facing system.

## 4. Walk-In Client Selling Their Own Vehicle

- When a walk-in client wants to sell their own vehicle, the Sales Manager follows the same account-creation arrangement used for a walk-in purchasing client without an account. The Sales Manager creates the client's account directly through the Sales Manager module before proceeding with the transaction.
- The account created through this process is also shown on the client side. The source applies the same client-side account reflection to this type of walk-in client.

## 5. Record of Sales

- The Sales Manager maintains a record of sales for reporting purposes. The record includes the vehicles sold by the company together with the related buyer account and payment information.

## 6. Paperwork

- The Sales Manager handles and provides the paperwork required for a vehicle sale. This responsibility also covers the documents needed for the associated payment process.

# Head Security

## 1. Attendance and Requests

- Head Security uses the attendance functions for leave requests, overtime requests, and time-in and time-out records. These functions document attendance and work-schedule activity for the role.

## 2. Proof of Duty

- Head Security provides photographic proof of the locks and the overall security condition of the GCE building before and after duty. The before-and-after images serve as evidence that the building's security was checked at both points in the shift.
