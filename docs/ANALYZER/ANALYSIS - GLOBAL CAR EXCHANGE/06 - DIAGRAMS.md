# 06 - DIAGRAMS

[[00 - START HERE|Back to start]] · Previous: [[05 - SYSTEM ARCHITECTURE]] · Next: [[07 - DEVELOPMENT ROADMAP]]

Pictures of the proposed system. Each picture has a plain-language reading beneath it, so nothing here depends on knowing how to read a diagram.

## 1. The big picture

```mermaid
flowchart LR
    subgraph people["People"]
        customer["Buyer or seller"]
        operations["Operational staff"]
        leaders["Chief executive and managers"]
    end

    subgraph system["Proposed online system"]
        pages["Responsive web pages"]
        access["Accounts and role access"]
        vehicles["Vehicles and repair work"]
        sales["Inquiries, sales, and delivery choices"]
        workforce["Attendance and payroll"]
        finance["Finance, approvals, and reports"]
        decisions["Recommendations and oversight"]
    end

    records["Shared information store"]
    payments["Offline financial settlement"]
    movement["Human delivery and vehicle recovery"]

    customer --> pages
    operations --> pages
    leaders --> pages
    pages --> access
    pages --> vehicles
    pages --> sales
    pages --> workforce
    pages --> finance
    pages --> decisions
    access --> records
    vehicles --> records
    sales --> records
    workforce --> records
    finance --> records
    decisions --> records
    finance --> payments
    sales --> movement
```

**Reading this:** Buyers, sellers, operational staff, and leaders would all enter through responsive web pages. The pages would check accounts and role access before opening the areas for vehicles, sales, payroll, finance, recommendations, and oversight. Every area would share one information store. Money would still be settled outside the system, while delivery and vehicle recovery would remain assigned human work. This picture is *drawn from* **GCE FULL CHAPTER 1 - 3.docx**, pages 15–22; **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; and **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”. It matches [[05 - SYSTEM ARCHITECTURE#The arrangement being proposed]].

## 2. How a job gets done — buying a listed vehicle

```mermaid
flowchart TD
    beginBuy(["Customer selects Buy Now"])
    accountBuy{"Does the customer have an account?"}
    createBuy["Sales Manager creates a walk-in account"]
    fillBuy["Registration details fill the sale form"]
    documentsBuy["Customer provides two valid IDs and proof of billing"]
    arrangementBuy["Customer completes the required purchase and arrangement details"]
    reviewBuy["Sales Manager handles the sale and paperwork"]
    settleBuy["Money is settled outside the system"]
    completeBuy["Sale and payment records are completed"]
    finishBuy(["Finished"])

    beginBuy --> accountBuy
    accountBuy -->|"no"| createBuy
    accountBuy -->|"yes"| fillBuy
    createBuy --> fillBuy
    fillBuy --> documentsBuy
    documentsBuy --> arrangementBuy
    arrangementBuy --> reviewBuy
    reviewBuy --> settleBuy
    settleBuy --> completeBuy
    completeBuy --> finishBuy
```

**Reading this:** Buy Now work goes to the Sales Manager. A registered customer's saved details fill the form. For a walk-in customer, the Sales Manager first creates an account, then the same sale form is used. The customer still supplies two valid IDs and proof of billing. The Sales Manager handles the sale and paperwork, while money is settled outside the system and the permitted records remain online. The exact approval checks and arrangement fields remain open questions. — **GCE FULL CHAPTER 1 - 3.docx**, page 16; **GCE USERS LEVELS MODULES.md**, headings “Sales Manager — 1. Buy Now and Inquiry Handling” through “Sales Manager — 6. Paperwork”

## 3. How a job gets done — selling a vehicle to Global Car Exchange

```mermaid
flowchart TD
    beginSell(["Customer offers a vehicle"])
    accountSell{"Does the customer have an account?"}
    createSell["Sales Manager creates a walk-in account"]
    recordSell["Sell record is opened"]
    inspectSell["Mechanic inspects the vehicle"]
    valueSell["Condition, photographs, notes, and repair needs are recorded"]
    reviewSell["Sales Manager reviews the offer"]
    decideSell{"Is it accepted?"}
    refuseSell["Offer is rejected"]
    acquireSell["Confidential Informant takes possession of the vehicle"]
    prepareSell["Repair progress is recorded before listing"]
    finishSell(["Finished"])

    beginSell --> accountSell
    accountSell -->|"no"| createSell
    accountSell -->|"yes"| recordSell
    createSell --> recordSell
    recordSell --> inspectSell
    inspectSell --> valueSell
    valueSell --> reviewSell
    reviewSell --> decideSell
    decideSell -->|"no"| refuseSell
    decideSell -->|"yes"| acquireSell
    acquireSell --> prepareSell
    prepareSell --> finishSell
    refuseSell --> finishSell
```

**Reading this:** A seller needs an account. The Sales Manager creates one for a walk-in seller before opening the Sell record. A mechanic inspects the vehicle and records its condition and repair needs. The Sales Manager reviews the offer. If accepted, the Confidential Informant takes possession and repair progress is recorded before listing. The exact valuation and approval rules are not supplied. — **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; **GCE USERS LEVELS MODULES.md**, headings “Confidential Informant — 1. Car Acquisition”, “Mechanic”, and “Sales Manager — 4. Walk-In Client Selling Their Own Vehicle”

## 4. How a job gets done — requesting a vehicle

```mermaid
flowchart TD
    beginRequest(["Customer describes a vehicle not in inventory"])
    pendingRequest["Request is pending"]
    salesRequest["Sales Manager discusses the price"]
    sourceRequest["Confidential Informant looks for a matching vehicle"]
    reviewRequest["A sourced option is reviewed"]
    decideRequest{"Is the option approved?"}
    refuseRequest["Request is rejected"]
    approveRequest["Request is approved"]
    completeRequest["Request is completed"]
    finishRequest(["Finished"])

    beginRequest --> pendingRequest
    pendingRequest --> salesRequest
    salesRequest --> sourceRequest
    sourceRequest --> reviewRequest
    reviewRequest --> decideRequest
    decideRequest -->|"no"| refuseRequest
    decideRequest -->|"yes"| approveRequest
    approveRequest --> completeRequest
    completeRequest --> finishRequest
    refuseRequest --> finishRequest
```

**Reading this:** The customer starts with specifications for a vehicle that is not listed. The Sales Manager discusses price, then a confidential informant searches for a match. The shared status path allows approval or rejection before completion. The material does not say what happens when several possible vehicles are found. — **GCE ADDITIONAL DOCUMENTS.docx**, page 2

## 5. The life story of a transaction

```mermaid
stateDiagram-v2
    state "Pending" as pending
    state "Under review" as review
    state "Approved" as approved
    state "Rejected" as rejected
    state "Completed" as completed

    [*] --> pending
    pending --> review
    review --> approved
    review --> rejected
    approved --> completed
    rejected --> [*]
    completed --> [*]
```

**Reading this:** Every Buy, Sell, and Request-a-Car record begins as pending. It then moves under review. Review ends in approval or rejection. An approved transaction can be completed; a rejected one ends. The additional document writes the statuses in one line, but this picture treats approval and rejection as separate paths because a rejected transaction cannot sensibly continue to completion. That branch is *drawn from* **GCE ADDITIONAL DOCUMENTS.docx**, page 2.

## 6. How the recommendation is produced

```mermaid
flowchart LR
    preferences["Customer budget and preferences"]
    inspection["Mechanic condition score"]
    vehicleData["Fuel use and mileage"]
    history["Past sales and demand"]
    scoring["Apply the five stated weights"]
    inventory["Compare available vehicles"]
    ranking["Rank matching vehicles"]
    customerResult["Show the ranked choices"]
    managerResult["Provide pricing and sales insight"]

    preferences --> scoring
    inspection --> scoring
    vehicleData --> scoring
    history --> scoring
    scoring --> inventory
    inventory --> ranking
    ranking --> customerResult
    history --> managerResult
    inventory --> managerResult
```

**Reading this:** The customer-facing path combines budget and preferences with mechanic findings, vehicle details, and past demand. The fixed weights are then applied before available vehicles are ranked. The chapter document separately asks for management pricing and sales insight. Whether these are one Decision Support System or two related tools remains [[00 - START HERE#Open questions|Q-05]]. — **GCE FULL CHAPTER 1 - 3.docx**, pages 16 and 19–20; **GCE ADDITIONAL DOCUMENTS.docx**, pages 2–3

## 7. The order of the phases

```mermaid
flowchart LR
    phase1["Phase 1 - One shared foundation"]
    phase2["Phase 2 - Vehicles can be found and understood"]
    phase3["Phase 3 - Conversations stay together"]
    phase4["Phase 4 - Recommendations can be explained"]
    phase5["Phase 5 - Transactions can be followed"]
    phase6["Phase 6 - Staff, managers, and payroll can run the business"]
    phase7["Phase 7 - Mobile use and acceptance are checked"]

    phase1 --> phase2
    phase2 --> phase3
    phase2 --> phase4
    phase3 --> phase5
    phase4 --> phase5
    phase5 --> phase6
    phase6 --> phase7
```

**Reading this:** The shared people and information foundation starts first. Vehicle records follow because conversations and recommendations both need a vehicle to refer to. Conversations and recommendations can then be developed alongside each other. Transactions need both. Staff, management, finance, and payroll work build on the earlier records, and the final phase checks the complete experience on phones and with intended users. This order is *drawn from* **GCE FULL CHAPTER 1 - 3.docx**, pages 14–22; **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; and **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”. It matches [[07 - DEVELOPMENT ROADMAP#The phases at a glance]].

## 8. The proposed arrangement

```mermaid
flowchart LR
    subgraph access["How people enter"]
        web["Responsive web pages"]
        account["Registered and walk-in accounts"]
        roles["Role access managed by the Account Manager"]
    end

    subgraph customerWork["Customer and vehicle work"]
        catalog["Inventory, inspection, and repair"]
        contact["Inquiries, schedules, and sales handoffs"]
        deals["Buy, Sell, and Request-a-Car"]
        advice["Decision support"]
    end

    subgraph staffWork["Staff and management work"]
        payroll["Attendance and payroll"]
        finance["Finance and installment records"]
        approvals["Approvals, announcements, and reports"]
        security["Delivery, recovery, and security evidence"]
    end

    shared["Shared information store"]
    outsideMoney["Offline financial settlement"]
    outsideMovement["Human delivery and vehicle recovery"]

    web --> account
    account --> roles
    roles --> catalog
    roles --> contact
    roles --> advice
    roles --> deals
    roles --> payroll
    roles --> finance
    roles --> approvals
    roles --> security
    catalog --> shared
    contact --> shared
    advice --> shared
    deals --> shared
    payroll --> shared
    finance --> shared
    approvals --> shared
    security --> shared
    finance --> outsideMoney
    security --> outsideMovement
```

**Reading this:** One responsive entry point accepts registered accounts and the walk-in accounts created by the Sales Manager. Role checks decide which work each person can reach. Customer, vehicle, payroll, finance, approval, delivery, and security areas all share the same information. Financial settlement and physical vehicle movement cross the boundary into human work outside the program. This proposed arrangement is *drawn from* **GCE FULL CHAPTER 1 - 3.docx**, pages 15–22; **GCE ADDITIONAL DOCUMENTS.docx**, pages 1–3; and **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”. The current arrangement cannot be verified, as explained in [[05 - SYSTEM ARCHITECTURE#The arrangement today]].

## 9. Payroll handoff

```mermaid
flowchart LR
    attendance["Attendance, leave, overtime, and late-arrival records"]
    prepare["Account Manager enters salaries and deductions"]
    report["Account Manager prepares the payroll report"]
    accountant["Head Accountant reviews the payslip work"]
    executive["Chief executive reviews stated payroll reports"]
    unclear["Final approval order is not stated"]
    payment["Head Accountant has salary-payment responsibility"]

    attendance --> prepare
    prepare --> report
    report --> accountant
    report --> executive
    accountant --> unclear
    executive --> unclear
    unclear --> payment
```

**Reading this:** Employee time and request records feed the Account Manager's payroll preparation. The Account Manager enters salaries and deductions and prepares the report. The source separately gives payslip review work to the Head Accountant and report approval work to the chief executive. It then gives salary-payment responsibility to the Head Accountant. The order between those approvals is not stated, so the middle of the handoff remains [[00 - START HERE#Open questions|Q-13]]. — **GCE USERS LEVELS MODULES.md**, headings “CEO — 2. Approval and Rejection of Reports”, “Account Manager — 4. Attendance, Leave, and Overtime Records; Payroll Processing; and Reconditioning Disbursements”, and “Head Accountant — 2. Payroll” through “Head Accountant — 6. Attendance Monitoring”

## 10. Installment escalation and vehicle recovery

```mermaid
flowchart TD
    due(["An installment reaches its due date"])
    notify["Head Accountant notifies the Account Manager"]
    contact["Account Manager contacts the buyer"]
    paidFirst{"Does the buyer pay?"}
    wait["Buyer receives an ultimatum"]
    paidLater{"Does the buyer pay within it?"}
    continueAccount["Installment account continues"]
    instruct["Head Accountant instructs the Confidential Informant"]
    recover["Confidential Informant retrieves or tows the vehicle"]
    finish(["Finished"])

    due --> notify
    notify --> contact
    contact --> paidFirst
    paidFirst -->|"yes"| continueAccount
    paidFirst -->|"no"| wait
    wait --> paidLater
    paidLater -->|"yes"| continueAccount
    paidLater -->|"no"| instruct
    instruct --> recover
    continueAccount --> finish
    recover --> finish
```

**Reading this:** The Head Accountant watches installment due dates and asks the Account Manager to contact a late buyer. If payment is still missing after an ultimatum, the Head Accountant instructs the Confidential Informant to retrieve or tow the vehicle. The source does not state the ultimatum length or whether another approval is required, so those points remain [[00 - START HERE#Open questions|Q-15]]. — **GCE USERS LEVELS MODULES.md**, headings “Head Accountant — 5. Installment Accounts” and “Confidential Informant — 3. Repossession”

## 11. Supplier registration and approval

```mermaid
flowchart TD
    beginSupplier(["GCE decides to work with a supplier"])
    routeSupplier{"Who creates the account?"}
    staffSupplier["Procurement Team creates the supplier account"]
    portalSupplier["Supplier registers through the supplier portal"]
    proofSupplier["Evidence that GCE invited the supplier is kept"]
    kindSupplier["Supplier states Company or Individual"]
    identitySupplier["Supplier presents two primary valid IDs from the accepted list"]
    reviewSupplier["GCE reviews the registration"]
    decideSupplier{"Is it approved?"}
    refuseSupplier["Registration is rejected"]
    allowSupplier["Supplier may now sign in"]
    finishSupplier(["Finished"])

    beginSupplier --> routeSupplier
    routeSupplier -->|"Procurement Team"| staffSupplier
    routeSupplier -->|"supplier portal is kept"| portalSupplier
    portalSupplier --> proofSupplier
    staffSupplier --> kindSupplier
    proofSupplier --> kindSupplier
    kindSupplier --> identitySupplier
    identitySupplier --> reviewSupplier
    reviewSupplier --> decideSupplier
    decideSupplier -->|"no"| refuseSupplier
    decideSupplier -->|"yes"| allowSupplier
    allowSupplier --> finishSupplier
    refuseSupplier --> finishSupplier
```

**Reading this:** The revision list prefers the Procurement Team creating the supplier account outright. If a separate supplier portal is kept instead, the system must also hold evidence that GCE invited that supplier. Both paths then require a Company or Individual declaration and two primary valid IDs. Sign-in stays closed until GCE approves. The source does not say who the Procurement Team is, whether the portal is kept, or which IDs are accepted, so those points remain [[00 - START HERE#Open questions|Q-19]], [[00 - START HERE#Open questions|Q-20]], and [[00 - START HERE#Open questions|Q-21]]. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management”

## 12. Checklist to inspection report

```mermaid
flowchart TD
    openCheck(["Mechanic opens the vehicle checklist"])
    systemCheck["Choose a vehicle system, such as Engine or Brakes"]
    partCheck["Open its components and parts, such as Oil System or Brake Pads"]
    statusCheck{"What is this part's status?"}
    goodCheck["Good"]
    repairCheck["For Repair or For Replacement"]
    detailCheck["Extra fields open for replacement item name, brand, and estimated cost"]
    saveCheck["Checklist answers are saved"]
    moreCheck{"Any parts left?"}
    reportCheck["Inspection report reads the saved checklist answers"]
    finishCheck(["Report is ready without re-entering anything"])

    openCheck --> systemCheck
    systemCheck --> partCheck
    partCheck --> statusCheck
    statusCheck -->|"Good"| goodCheck
    statusCheck -->|"For Repair or For Replacement"| repairCheck
    repairCheck --> detailCheck
    goodCheck --> saveCheck
    detailCheck --> saveCheck
    saveCheck --> moreCheck
    moreCheck -->|"yes"| partCheck
    moreCheck -->|"no"| reportCheck
    reportCheck --> finishCheck
```

**Reading this:** The mechanic works down a nested list: a vehicle system, then its components, then its parts. Each part gets exactly one of three statuses. Choosing For Repair or For Replacement opens fields for the replacement item name, brand, and estimated cost. The inspection report is then built from those saved answers, so the mechanic never types the same finding twice. Only engine, brakes, and suspension are given as examples, so the approved full list remains [[00 - START HERE#Open questions|Q-27]]. — **REVISIONS LISTS.md**, headings “11. Mechanic Inspection Checklist” through “13. Inspection Report”
