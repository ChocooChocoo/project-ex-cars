# GCE Vehicle Marketplace — Buying & Selling Transaction Process Flows

> **Document type:** Internal Process Documentation
> **Prepared:** September 2026
> **Scope:** The vehicle intake and selling pipeline, and all buyer purchase flows documented in the supplied process text.

---

## Table of Contents

| # | Section | Status in Source |
|---|---------|------------------|
| 1 | [Selling Scenario](#section-1--selling-scenario) | Documented |
| 2 | [Buying Scenario 1 — Cash Purchase: Onsite Visit](#section-2--buying-scenario-1--cash-purchase-onsite-visit) | Documented |
| 3 | [Buying Scenario 2 — Cash Purchase: Meet Halfway (Calabarzon)](#section-3--buying-scenario-2--cash-purchase-meet-halfway-calabarzon) | Documented |
| 4 | [Buying Scenario 3 — Cash Purchase: Delivery](#section-4--buying-scenario-3--cash-purchase-delivery) | Documented |
| 5 | [Buying Scenario 4 — Cheque Purchase: Onsite Visit](#section-5--buying-scenario-4--cheque-purchase-onsite-visit--disregard) | **DISREGARD** |
| 6 | [Buying Scenario 5 — In-House Financing: GCE Visit](#section-6--buying-scenario-5--in-house-financing-gce-visit) | Ongoing Workflow — For Client Validation |
| 7 | Bank-transfer: GCE Visit | *"Currently wala pa po sa pdf"* (not yet in the PDF) |
| 8 | Bank-transfer: Half way | *"Currently wala pa po sa pdf"* (not yet in the PDF) |
| 9 | Bank-transfer: Delivery | *"Currently wala pa po sa pdf"* (not yet in the PDF) |
| 10 | In-House Financing: Meet Halfway (Calabarzon) | *"Currently wala pa po sa pdf"* (not yet in the PDF) |
| 11 | In-House Financing: Delivery | *"Currently wala pa po sa pdf"* (not yet in the PDF) |

Supporting references (compiled from the document):
- [A. Roles & Responsibilities](#appendix-a--roles--responsibilities)
- [B. Transaction Statuses & Flags](#appendix-b--transaction-statuses--flags)
- [C. Shared Rules Across Flows](#appendix-c--shared-rules-across-flows)
- [D. Scenario Comparison](#appendix-d--scenario-comparison)
- [E. Markings & Review Notes from the Source](#appendix-e--markings--review-notes-from-the-source)

---

## SECTION 1 — Selling Scenario

**Summary:** A seller (example: *Juan*) submits a vehicle to GCE. The Marketing Specialist verifies it, proposes a price ceiling to the CEO, negotiates with the seller, and sends a field team (Mechanic + Confidential Informant) to inspect the vehicle before payment is released by the Head Accountant.

**Actors:** Seller (Juan), Marketing Specialist, CEO, Mechanic, Confidential Informant, Head Accountant

**Meet-up methods available to the seller:**
| Method | Description |
|---|---|
| **Meet Halfway within Calabarzon** | Juan goes to the agreed halfway location within Calabarzon. |
| **GCE Visit** | Juan goes directly to GCE. |

---

### Step 1 — Seller submits his car for sale

Juan logs in, clicks **Sell Vehicle**, and lands on the **Sell Your Vehicle** page.

**Required vehicle details:**
- Make
- Model
- Year
- Mileage
- Vehicle Condition
- Offered Amount
- Description of the Vehicle
- Vehicle Images
- Existing Vehicle Issues/Problems, if any

**Issue declaration rule:**
- If the vehicle has an existing issue, Juan **must declare the issue** in the submission.
- If there is no known issue, Juan **must indicate that there is no known issue**.

**Required attachments:**
- 2 Valid IDs
- ORCR
- Deed of Sale

**Meet-up method:** Juan also picks a meet-up method — *Meet Halfway within Calabarzon* or *GCE Visit*.

---

### Step 2 — Marketing Specialist verifies everything submitted

Before any price is proposed, the Marketing Specialist checks Juan's submitted information.

**The Marketing Specialist verifies:**
- Valid ID
- ORCR
- Deed of Sale
- Vehicle details
- Vehicle images
- Declared vehicle issues

**Consistency check:** The Marketing Specialist checks that the ORCR matches the vehicle and owner, and that the submitted information is consistent.

| Outcome | Result |
|---|---|
| Everything checks out | Proceed to Step 3. |
| Anything does not check out | The transaction is **flagged or rejected** at this stage. |

---

### Step 3 — Marketing Specialist proposes a provisional price ceiling to the CEO

- Once everything checks out, the Marketing Specialist sends the CEO a proposal stating the **lowest price GCE is willing to negotiate down to**, pending physical inspection.
- Status becomes **Pending CEO Approval**.
- A **7-day processing window** starts.
- Juan is notified to expect a response **within 5–7 days**.

---

### Step 4 — CEO approves or rejects the ceiling

| Outcome | Result |
|---|---|
| **REJECTED** | The transaction ends. |
| **APPROVED — WITHIN 7 DAYS** | The transaction moves forward using the approved ceiling as the negotiating limit. |
| **OVERDUE** | If 7 days pass with no action, status changes to **Overdue — Awaiting Action**. The Marketing Specialist and, optionally, the CEO are notified. There is **no automatic cancellation**; the transaction remains open until manually processed. |

---

### Step 5 — Marketing Specialist negotiates with Juan

- Using the **CEO-approved purchase price ceiling**, the Marketing Specialist negotiates with Juan until both parties agree on a price.
- The negotiation **must remain within** the CEO-approved purchase price ceiling.
- The Marketing Specialist contacts Juan through the **website chat feature**.
- All negotiation details, messages, offers, and agreements **must remain in the transaction's chat history**.

**Once a price is agreed:** A **Field Case** is created for the Mechanic and Confidential Informant.

**The Field Case contains:**
- Seller information
- Vehicle information
- Declared vehicle issues
- Vehicle images
- Verified ID and ORCR details
- Deed of Sale information
- Agreed purchase price
- Meetup location and method

This gives the field team the complete information before meeting Juan in person.

---

### Step 6 — Mechanic inspects the vehicle

At the meetup, the Mechanic and Confidential Informant carry out the Field Case.

**Identity & vehicle verification:**
- The **Confidential Informant** confirms that the person present matches Juan's verified ID.
- The **Mechanic** confirms that the vehicle's plate/chassis number matches the ORCR on file.

**Inspection:**
- The Mechanic inspects the vehicle in person.
- The Mechanic documents the vehicle's condition and gathers supporting proof through **images/photos only**.

| Outcome | Result |
|---|---|
| **IF NO ISSUES ARE FOUND** | The vehicle proceeds directly to the payment process (Step 10). |
| **IF AN ISSUE IS FOUND** | The Mechanic or Confidential Informant **immediately calls the Marketing Specialist by phone** (see below). |

**When an issue is found, they report:**
- The issue discovered
- Whether the vehicle is still profitable
- Supporting proof of the issue through images
- The Mechanic's estimated total repair cost

The Mechanic and Confidential Informant also **record their total expenses** for traveling to and attending the seller meetup.

---

### Step 7 — Marketing Specialist evaluates the inspection issue

The Marketing Specialist opens the **current request from the Transaction List** for the seller/current transaction.

**The Marketing Specialist creates an Inspection Issue Report containing:**
- Issue found by the Mechanic
- Supporting images supplied by the Mechanic
- Estimated total repair cost
- Explanation/reason showing why the vehicle is still profitable or is no longer profitable
- Recalculated purchase price
- New purchase price ceiling / maximum amount GCE is willing to pay

| Outcome | Result |
|---|---|
| **IF THE VEHICLE IS STILL PROFITABLE** | The Marketing Specialist sends the **new purchase price ceiling and Inspection Issue Report to the CEO** for approval. |
| **IF THE VEHICLE IS NO LONGER PROFITABLE** | The transaction is flagged. The Mechanic informs the seller that GCE will no longer get/buy the vehicle. The Marketing Specialist records the findings and reason and cancels the transaction. **The transaction ends.** |

---

### Step 8 — CEO reviews the revised purchase price

The CEO reviews:
- Inspection Issue Report
- Supporting images
- Repair cost estimate
- Profitability explanation
- Recalculated purchase price
- New purchase price ceiling

| Outcome | Result |
|---|---|
| **APPROVED** | The revised purchase price ceiling is approved and the transaction proceeds to the seller negotiation regarding the newly calculated price. |
| **REJECTED** | The transaction does not proceed under the proposed revised price and is rejected according to the GCE process. |

---

### Step 9 — Mechanic discusses the inspection issue and revised price with the seller

If the CEO approves the revised price, the **Marketing Specialist calls the Mechanic**.

**The Mechanic talks to the seller regarding:**
- The inspection issue
- The supporting findings
- The estimated repair cost
- The newly recalculated purchase price

| Outcome | Result |
|---|---|
| **SELLER AGREES** | GCE proceeds with the purchase. |
| **SELLER REFUSES** | GCE does not purchase the vehicle. The Marketing Specialist records the seller's refusal. **The transaction ends.** |

---

### Step 10 — Payment is disbursed and reported

- If the seller agrees and the vehicle purchase proceeds, payment is released through the applicable GCE disbursement process.
- The **Head Accountant** handles the payment disbursement.
- The completed payment is **reported to the CEO**.

---

### Step 11 — Mechanic and Confidential Informant report meetup expenses

- When the Mechanic and Confidential Informant return from the seller/meetup, they report their **total expenses incurred for going to the seller**.
- This expense report is required **whether or not the vehicle was purchased**.
- The reported expenses must include the applicable **proofs of expenses**.

---

### Step 12 — Meetup expenses are logged with the transaction

> *Note: This step's heading is highlighted in black in the source document.*

- The total expenses and supporting proofs are **logged on the website** together with the applicable transaction.
- The expense record remains connected to the transaction for accounting and reimbursement purposes.

---

### Step 13 — Reimbursement on resale

The Head Accountant is reimbursed once a **Vehicle Sold** status is triggered, together with the applicable approved expense records according to GCE procedure.

---

### Selling Scenario — Flow at a Glance

```
Seller Submits Vehicle + Docs + Meet-up Method
  → Marketing Specialist Verification ──(fails)──► Flagged / Rejected
  → Provisional Price Ceiling to CEO [Pending CEO Approval, 7-day window]
  → CEO Decision ──(rejected)──► Transaction Ends
                 ──(no action 7 days)──► Overdue — Awaiting Action
  → Negotiation via Website Chat (within ceiling)
  → Price Agreed → Field Case Created
  → Mechanic + CI Inspection at Meetup
       ├─ No issues ─────────────────────────────────► Payment Disbursed
       └─ Issue found → Phone call to Marketing Specialist
            → Inspection Issue Report
                 ├─ Not profitable ──► Flagged, Cancelled, Transaction Ends
                 └─ Still profitable → CEO Reviews Revised Price
                      ├─ Rejected ──► Rejected per GCE process
                      └─ Approved → Mechanic discusses with Seller
                           ├─ Refuses ──► Refusal Recorded, Transaction Ends
                           └─ Agrees ──► Payment Disbursed (Head Accountant → reported to CEO)
  → Field Team Reports Expenses (always) → Logged with Transaction
  → Head Accountant Reimbursed on "Vehicle Sold"
```

---

## SECTION 2 — Buying Scenario 1 — Cash Purchase: Onsite Visit

**Summary:** The buyer pays cash in person at GCE after booking a locked visit slot and receiving Sales Manager approval.

**Actors:** Buyer, Sales Manager, Head Accountant
**Payment:** Cash | **Meet-up:** GCE Visit (onsite)

---

### Step 1 — Buyer logs in and picks a car
The buyer logs in, browses GCE's listings, selects the car he wants, and presses **Buy Now**.

### Step 2 — Buyer fills up credentials and presents ID
He fills in his required buyer information and presents **2 valid IDs**.

### Step 3 — Buyer chooses payment method and schedules a visit
- He selects **Cash** as his payment method, then picks a date and time to visit GCE.
- The system checks and displays whether the chosen slot is available.
- Once confirmed, that date/time slot is **locked**.
- No other buyer can book the same slot for this car, **even before the Sales Manager reviews the request**.

### Step 4 — Sales Manager reviews the request
- The Sales Manager checks the buyer's credentials, IDs, and request details.
- Status becomes **Pending Sales Manager Approval**.
- A **7-day processing window** starts.

| Outcome | Result |
|---|---|
| **REJECTED** | Buyer is notified. His previously locked slot is **released** and becomes available again for other buyers. |
| **APPROVED — WITHIN 7 DAYS** | The buyer's account reflects approval. GCE waits for him to visit on the scheduled date/time. |
| **OVERDUE** | If 7 days pass with no action, status changes to **Overdue — Awaiting Action**. The Sales Manager is notified. No automatic cancellation. The slot **stays locked** and the transaction stays open until manually processed. |

### Step 5 — Buyer visits GCE; Sales Manager presents the car
On the scheduled date, the buyer visits GCE in person. The Sales Manager displays the car to him.

| Outcome | Result |
|---|---|
| **DECLINES** | The transaction is marked **Declined by Buyer**. The car becomes available again for other buyers. |
| **PROCEEDS** | The Sales Manager continues with the paperwork. The transaction moves to payment. |

### Step 6 — Payment is received and the car is marked sold
- Once the Sales Manager receives the cash payment, he opens his **dashboard**, which lists all pending buyer requests tied to their respective listed cars.
- Next to this buyer's request, he clicks **Mark Sold to This Buyer**.
- This finalizes the transaction, marks the car as **Sold**, and removes it from GCE's public listings so it is no longer visible or purchasable by other users.

### Step 7 — Sale figures go to the Head Accountant for reporting
- Once the car is marked Sold, the completed transaction is listed on the Head Accountant's side.
- The Head Accountant receives the sale figures/numbers for record-keeping.

### Flow at a Glance
```
Login → Buy Now → Credentials + 2 IDs → Cash + Pick Visit Slot (slot locked)
  → Sales Manager Review [7-day window]
       ├─ Rejected ──► Buyer notified, slot released
       ├─ Overdue ──► Overdue — Awaiting Action (slot stays locked)
       └─ Approved → Buyer Visits GCE
            ├─ Declines ──► Declined by Buyer, car available again
            └─ Proceeds → Cash Paid → "Mark Sold to This Buyer" → Head Accountant
```

---

## SECTION 3 — Buying Scenario 2 — Cash Purchase: Meet Halfway (Calabarzon)

**Summary:** The buyer pays cash at an agreed halfway location within Calabarzon. The field team (Mechanic and/or Confidential Informant) meets the buyer. Multiple buyers may queue for the same car using the **Active / On Hold** system.

**Actors:** Buyer, Sales Manager, Mechanic, Confidential Informant, Head Accountant
**Payment:** Cash | **Meet-up:** Meet Halfway within Calabarzon

---

### Step 1 — Buyer logs in and picks a car
The buyer logs in, browses GCE's listings, selects the car he wants, and presses **Buy Now**.

### Step 2 — Buyer fills up credentials and presents ID
He fills in his required buyer information and presents **2 valid IDs**.

### Step 3 — Buyer reviews the car and acknowledges its condition
- Before proceeding, the buyer reviews the car's **credit score** and **360° showroom view**.
- He confirms an acknowledgment, such as:
  > *"I have reviewed this car's condition and intend to purchase it as shown."*
- The buyer **must** provide this acknowledgment **before selecting Halfway** as his meetup option.

### Step 4 — Buyer chooses payment method and schedules a meetup
- He selects **Cash**, chooses **Meet Halfway within Calabarzon**, and picks a date and time.
- He is notified immediately after submitting.

| Outcome | Result |
|---|---|
| **ACTIVE** | If no other buyer's request is currently Active for this car, his request becomes Active. |
| **ON HOLD** | If another buyer's request is already Active, his request is placed on hold and remains visible in his transaction list. |

### Step 5 — Sales Manager reviews the Active Request
- The Sales Manager reviews the Active buyer's credentials, IDs, and details.
- Status becomes **Pending Sales Manager Approval**.
- A **7-day processing window** starts.

| Outcome | Result |
|---|---|
| **REJECTED** | The buyer is notified. The Sales Manager then reviews the remaining on-hold requests for this car and **manually selects** the next one to review. |
| **APPROVED — WITHIN 7 DAYS** | The buyer is notified. Other on-hold buyers for this car remain on hold. |
| **OVERDUE** | If 7 days pass with no action, status becomes **Overdue — Awaiting Action**. The Sales Manager is notified. No automatic cancellation. |

### ⚠ Cancellation Rule — Applies to the Meetup Request
A buyer, whether **Active or On Hold**, may cancel the request only when the cancellation is made **at least 5 hours before the scheduled meetup date and time**.

| Timing | Result |
|---|---|
| **5 hours or more before the scheduled time** | The buyer may cancel the request. The system records the cancellation and the applicable buyer/request process continues. |
| **Less than 5 hours before the scheduled time** | The buyer may no longer cancel the scheduled meetup through the normal cancellation process. If the buyer fails to attend, the applicable no-show procedure applies. |

### Step 6 — Meetup happens, logged as a Field Case
- On the scheduled date, the Mechanic and/or Confidential Informant meet the Active buyer at the agreed Calabarzon location.
- This is logged as a **Field Case**.

**No-Show Handling:**
1. If the buyer does not show up within **2 hours 30 minutes**, the field team reports to the Sales Manager.
2. The Sales Manager attempts to contact the buyer.
3. If the buyer confirms he cannot make it, or does not respond:
   - The transaction is flagged **Buyer Didn't Show Up**.
   - This counts as **one no-show** on the buyer's record.
   - After **2 no-shows**, the buyer is restricted to **GCE Visit only** going forward.
4. Either way, the Sales Manager reviews the remaining on-hold requests for the car and manually selects the next one to proceed through the approval process.

### Step 7 — Buyer decides whether to proceed
The buyer inspects the car in person.

| Outcome | Result |
|---|---|
| **PROCEEDS** | Payment is made in cash. The transaction moves to Step 8. |
| **DECLINES** | The Mechanic/Confidential Informant reports the incident to the Sales Manager. The Sales Manager classifies the reason. |

**Decline Classification:**
| Classification | Result |
|---|---|
| **LEGIT** | Legitimate surprise — no penalty. |
| **NOT LEGIT** | Counts as a strike, restricting the buyer to **GCE Visit only** immediately. |

Either way, the transaction is flagged **Declined by Buyer**, and the Sales Manager reviews the remaining on-hold requests and manually selects the next one for the approval process.

### Step 8 — Payment is received and the car is marked sold
- The Mechanic/Confidential Informant confirms that cash payment is received.
- The payment information is relayed to the Sales Manager.
- The Sales Manager marks the car as Sold using **Mark Sold to This Buyer**.
- The car is removed from GCE's public listings.
- All other buyers with on-hold requests for this car are **notified that it has been sold**.

### Step 9 — Sale figures go to the Head Accountant for reporting
Once marked Sold, the completed transaction is listed on the Head Accountant's side for record-keeping.

### Flow at a Glance
```
Login → Buy Now → Credentials + 2 IDs → Review Credit Score & 360° View + Acknowledge
  → Cash + Meet Halfway + Date/Time → Active OR On Hold
  → Sales Manager Reviews Active Request [7-day window]
       ├─ Rejected ──► Next on-hold request selected manually
       ├─ Overdue ──► Overdue — Awaiting Action
       └─ Approved → (Cancellation allowed only ≥5 hrs before meetup)
            → Meetup (Field Case)
                 ├─ No-show after 2h30m ──► Buyer Didn't Show Up (1 no-show; 2 = GCE Visit only)
                 └─ Buyer inspects
                      ├─ Declines ──► Legit (no penalty) / Not Legit (strike → GCE Visit only)
                      └─ Proceeds → Cash Paid → Mark Sold → On-hold buyers notified → Head Accountant
```

---

## SECTION 4 — Buying Scenario 3 — Cash Purchase: Delivery

**Summary:** The vehicle is delivered to the buyer's address by a delivery team (Mechanic, Confidential Informant, Head Security). A downpayment (via bank transfer) and delivery fee are paid before dispatch; the remaining cash balance is paid on delivery.

**Actors:** Buyer, Sales Manager, Head Accountant, Mechanic, Confidential Informant, Head Security
**Payment:** Cash (downpayment via bank transfer + remaining cash balance on delivery) | **Meet-up:** Delivery

---

### Step 1 — Buyer logs in and picks a car
The buyer logs in, browses GCE's listings, selects the car, and presses **Buy Now**.

### Step 2 — Buyer submits credentials and ID
The buyer fills in the required information and presents **2 valid IDs**.

### Step 3 — Buyer reviews and acknowledges car condition
- The buyer reviews the vehicle's **credit score** and **360° showroom view**.
- He confirms an acknowledgment that he has reviewed the car's condition and intends to purchase it as shown.

### Step 4 — Buyer selects Cash + Delivery
The buyer chooses **Cash**, selects **Delivery**, and provides:
- Delivery address
- Preferred delivery date
- Preferred delivery time, if applicable

| Outcome | Result |
|---|---|
| **ACTIVE** | If no other Active request exists, this request becomes Active. |
| **ON HOLD** | If another Active request exists, this request goes on hold. |

### Step 5 — Sales Manager reviews and approves

> *Note: This entire step is highlighted in black in the source document.*

- The Sales Manager reviews the buyer's request.
- Status becomes **Pending Sales Manager Approval**.
- A **7-day processing window** starts.

| Outcome | Result |
|---|---|
| **REJECTED** | The buyer is notified. The Sales Manager reviews on-hold requests and picks the next one. |
| **APPROVED — WITHIN 7 DAYS** | See the approval sequence below. |
| **OVERDUE** | If 7 days pass without action, status changes to **Overdue — Awaiting Action**. The Sales Manager is notified. No automatic cancellation. |

**Approval sequence (Approved — within 7 days):**
1. The Sales Manager determines the applicable delivery arrangement.
2. The system determines whether the buyer's selected delivery location is **serviceable and whether delivery is available**.
3. Once the delivery arrangement is confirmed, the applicable **delivery fee/payment** is determined.
4. The Head Accountant who receives the buyer's delivery payment reports to the **Sales Manager** that the buyer has paid the delivery fee.
5. The Head Accountant records the buyer's delivery-fee payment.
6. The Head Accountant then approves the Sales Manager's payment report.

**After delivery payment is approved:**
- The Sales Manager creates a **Delivery Field Case** assigned to:
  - Mechanic
  - Confidential Informant
  - Head Security
- The delivery Field Case contains the required transaction, buyer, vehicle, address, payment, and scheduled delivery information.
- The delivery team is dispatched on the scheduled date and time, and the client can **track the live geolocation** of the delivery.

### Step 5a — Buyer must pay the downpayment within 2–3 working days

| Outcome | Result |
|---|---|
| **PAID IN TIME** | The payment is confirmed by the Head Accountant. The transaction proceeds to the delivery process. |
| **DEADLINE PASSED** | The request is cancelled/forfeited according to the existing process. There is nothing to refund. The Sales Manager moves to the next on-hold request. |

### Step 6 — Buyer pays the downpayment
- The buyer pays the required downpayment through **bank transfer** within the deadline.
- The Head Accountant **confirms receipt before dispatch**.

### Step 7 — Car is dispatched for delivery
- The vehicle is dispatched with:
  - Mechanic
  - Confidential Informant
  - Head Security
- The delivery is logged as a **Field Case**.
- The assigned team travels to the buyer's scheduled delivery location.

### Step 7a — Buyer tracks the delivery
The buyer tracks the delivery progress from his account:

**Dispatched → In Transit → Arriving → Delivered**

Live location/ETA may be provided if available.

### Step 7b — GCE-side delays and advance late-arrival notice
- If delivery will be late due to a valid reason on GCE's end (such as weather, traffic, or team delay), the delivery team reports the expected delay.
- The **Confidential Informant reports the expected delay to the Sales Manager**.
- Based on the CI's delivery report, the **Sales Manager informs the buyer in advance** that the delivery is expected to arrive late.
- When available, the buyer is also informed of the updated expected arrival time.
- **No penalty or strike** applies to the buyer because the delay is caused by GCE.

### Step 7c — Buyer unavailable or address needs redirecting
- As long as the buyer has already paid the downpayment, GCE proceeds **in good faith** regardless of whether the original address checks out.
- The downpayment itself is treated as the **buyer's commitment**.

**If the buyer notifies GCE in advance:**
- If the buyer will not be available on the scheduled date, or needs to redirect to a new address, he must notify GCE in advance and pay the applicable **rescheduling/redirection fee**.
- A new date/address may be set according to GCE procedure.

**Cancellation cut-off:** The buyer **cannot cancel** the scheduled delivery when the cancellation is made **less than 5 hours before the scheduled delivery date and time**.

**If the buyer does NOT notify GCE and is simply unavailable when the team arrives:**
- The transaction is flagged **Buyer Unavailable**.
- This counts as **one no-show**.
- After **2 no-shows**, the buyer is restricted to **GCE Visit only**.
- The **downpayment is forfeited** in this case.

The Sales Manager is looped in for tracking notices and fees, and reviews on-hold requests as needed if the transaction is ultimately terminated.

### Step 8 — Buyer decides whether to proceed
Upon delivery, the buyer inspects the car in person.

| Outcome | Result |
|---|---|
| **PROCEEDS** | The buyer pays the remaining cash balance. The transaction moves to Step 9. |
| **DECLINES** | The delivery team reports the buyer's decision to the Sales Manager. The Sales Manager classifies the reason. |

**Decline Classification:**
| Classification | Examples / Result |
|---|---|
| **LEGIT** | Examples: car condition not as promised; vehicle damaged in transit. No strike applies. The downpayment is **refunded within 2–3 working days**. |
| **NOT LEGIT** | A strike is applied. The buyer is restricted to **GCE Visit only**. The downpayment is **forfeited and non-refundable**. |

Either way, the transaction is flagged **Declined by Buyer**, and the Sales Manager selects the next on-hold request for the applicable approval process.

### Step 9 — Payment received, car marked sold
- The Mechanic, Confidential Informant, and Head Security confirm that the remaining cash payment has been **received in full**.
- The payment information is relayed to the Sales Manager.
- The Sales Manager marks the car **Sold**.
- The car is removed from public listings.
- Other on-hold buyers are notified.

### Step 10 — Sale figures go to the Head Accountant
The completed transaction, **including the downpayment and delivery-fee payment**, is listed for Head Accountant record-keeping.

### Flow at a Glance
```
Login → Buy Now → Credentials + 2 IDs → Review & Acknowledge Condition
  → Cash + Delivery (address, date, time) → Active OR On Hold
  → Sales Manager Review [7-day window]
       ├─ Rejected ──► Next on-hold request
       ├─ Overdue ──► Overdue — Awaiting Action
       └─ Approved → Serviceability Check → Delivery Fee Paid & Recorded (Head Accountant)
            → Delivery Field Case Created
            → Downpayment via Bank Transfer within 2–3 working days
                 └─ Missed ──► Cancelled/Forfeited, next on-hold request
            → Dispatch (Mechanic + CI + Head Security), buyer tracks live
                 ├─ GCE delay ──► Advance notice, no penalty
                 ├─ Buyer reschedules/redirects in advance ──► fee applies
                 └─ Buyer unavailable, no notice ──► Buyer Unavailable, no-show, downpayment forfeited
            → Buyer Inspects on Delivery
                 ├─ Declines ──► Legit (refund 2–3 days) / Not Legit (strike, forfeited)
                 └─ Proceeds → Remaining Cash Paid → Marked Sold → Head Accountant
```

---

## SECTION 5 — Buying Scenario 4 — Cheque Purchase: Onsite Visit — ⛔ DISREGARD

> **⛔ DISREGARD — Cheque Purchase flow (Section 5).**
> This section is marked **DISREGARD** in both the Table of Contents and the section header. It is also labeled *"Ongoing Workflow"* and is highlighted in yellow in the source. It is retained below **for reference only** so no content is lost.

<details>
<summary><strong>Show the disregarded Cheque Purchase flow (reference only)</strong></summary>

**Actors:** Buyer, Sales Manager, Head Accountant
**Payment:** Cheque | **Meet-up:** GCE Visit

#### Step 1 — Buyer logs in and picks a car
The buyer logs in, browses GCE's listings, selects the car he wants, and presses **Buy Now**.

#### Step 2 — Buyer fills up credentials and presents ID
- The buyer fills in the required buyer information and presents **2 valid IDs**.
- The submitted information is attached to the purchase request for Sales Manager review.

#### Step 3 — Buyer chooses Cheque + GCE Visit
- The buyer selects **Cheque** as the payment method, chooses **GCE Visit**, and picks a date and time.
- The system checks slot availability.
- Once confirmed, the slot is locked for this buyer and vehicle.

| Outcome | Result |
|---|---|
| **AVAILABLE** | The selected date/time is available. The slot is locked and the buyer receives confirmation. |
| **UNAVAILABLE** | The selected date/time is occupied. The buyer must choose another available slot. |

#### Step 4 — Sales Manager reviews the request
The Sales Manager checks:
- Buyer's credentials
- 2 valid IDs
- Selected vehicle
- Payment method
- Scheduled visit

Status becomes **Pending Sales Manager Approval**. A 7-day processing window starts.

| Outcome | Result |
|---|---|
| **REJECTED** | The buyer is notified. The locked visit slot is released. The Sales Manager may review the remaining buyer requests for the vehicle. |
| **APPROVED — WITHIN 7 DAYS** | The buyer is notified. The scheduled GCE visit remains reserved. |
| **OVERDUE** | If 7 days pass with no action, status becomes **Overdue — Awaiting Action**. The Sales Manager is notified. No automatic cancellation. |

#### Step 5 — Buyer visits GCE and presents the cheque
- On the scheduled date, the buyer visits GCE in person.
- The Sales Manager presents the vehicle and continues with the purchase paperwork.
- The buyer inspects the vehicle.
- If proceeding, the buyer presents the cheque for verification.

| Outcome | Result |
|---|---|
| **DECLINES** | The transaction is marked **Declined by Buyer**. The vehicle becomes available for other buyers. The Sales Manager may proceed to the next eligible request. |
| **PROCEEDS** | The buyer presents the cheque. The transaction moves to Head Accountant verification. |

#### Step 6 — Head Accountant verifies the cheque
The Head Accountant checks the cheque using the information and verification procedures available to GCE, including required cheque details and other applicable checks under GCE policy.

| Outcome | Result |
|---|---|
| **REJECTED** | The cheque is not accepted. The buyer may provide another accepted payment method, if permitted by GCE policy. Otherwise, the transaction is not completed. |
| **ACCEPTED** | Initial verification passes. Status becomes **Accepted — Awaiting Clearance**. Acceptance does not yet mean payment is confirmed. |

#### Step 7 — Cheque is monitored until clearance
- The Head Accountant monitors the cheque until its clearance status is confirmed.
- While pending, the transaction remains **Accepted — Awaiting Clearance**.
- The vehicle is not treated as a completed sale until the required payment confirmation is received.

| Outcome | Result |
|---|---|
| **CLEARED** | The cheque clears successfully and payment is confirmed. The transaction moves to sale completion. |
| **NOT CLEARED** | The cheque is returned, bounced, or otherwise not confirmed. The transaction is flagged for action according to GCE policy. |

#### Step 8 — Vehicle is marked sold after payment confirmation
- Once the cheque has cleared and payment has been confirmed, the Sales Manager finalizes the transaction by selecting **Mark Sold to This Buyer**.
- The vehicle is marked Sold and removed from GCE's public listings.
- Other buyers with on-hold requests are notified.

#### Step 9 — Completed transaction goes to the Head Accountant
- Once marked Sold, the completed transaction is listed on the Head Accountant's side for record-keeping.
- The transaction records the cheque payment and successful payment confirmation.

#### Cancellation Rule
The buyer can cancel the cheque purchase request before the scheduled GCE visit, except when the cancellation is made **less than 5 hours before the scheduled visit date and time**.

| Timing | Result |
|---|---|
| **5 hours or more before the scheduled time** | Cancellation is allowed. |
| **Less than 5 hours before the scheduled time** | Cancellation is not allowed through the normal cancellation process. |

</details>

---

## SECTION 6 — Buying Scenario 5 — In-House Financing: GCE Visit

> **Status:** 🟡 *Ongoing Workflow — For Client Validation*

**Summary:** The buyer purchases through GCE's in-house financing. The financing arrangement (payment duration and Initial Downpayment) is calculated and approved **before** the GCE visit, but the Initial Downpayment is collected **only after** the buyer physically inspects and accepts the vehicle. The flow continues through installments, and — if payments are missed — through repossession, reconditioning, repricing, and relisting.

**Actors:** Buyer, Sales Manager, Head Accountant, CEO, Confidential Informant, Head Security, Mechanic, Marketing Specialist
**Payment:** In-House Financing (Initial Downpayment + installments) | **Meet-up:** GCE Visit

The flow is organized into five phases:

| Phase | Steps | Focus |
|---|---|---|
| A. Request & Approval | 1–5 | Buyer request and Sales Manager review |
| B. Financing Arrangement | 6–11 | Payment duration, Initial Downpayment, approvals, buyer review |
| C. GCE Visit & Purchase | 12–21 | Inspection, Purchase Claim / Potential Buyer, downpayment, sale |
| D. Installments | 22–25 | Active account, payments, missed payments, completion |
| E. Repossession & Relisting | 26–42 | Recovery, reconditioning, repricing, return to listing |

---

### Phase A — Request & Approval

#### Step 1 — Buyer logs in
The buyer logs into their GCE account, browses the available **GCE Cars** listings, and selects the vehicle they are interested in purchasing.

#### Step 2 — Buyer provides required credentials
- The buyer provides the required buyer information and presents **2 valid IDs**.
- The submitted information is attached to the purchase request for review.

#### Step 3 — Buyer reviews the vehicle
- The buyer reviews the vehicle information displayed on the website, including available photos, vehicle details, and 360° showroom information where available.
- The buyer **acknowledges the displayed vehicle condition** before proceeding.

#### Step 4 — Buyer selects In-House Financing
The buyer selects **In-House Financing** and chooses **GCE Visit** as the physical inspection and purchase-decision method.

| Outcome | Result |
|---|---|
| **ACTIVE** | If no other Active request exists for the vehicle, the request becomes Active. |
| **ON HOLD** | If another Active request already exists, the request is placed On Hold according to the applicable GCE process. |

#### Step 5 — Sales Manager reviews the financing request
The Sales Manager reviews:
- Buyer's credentials
- IDs
- Selected vehicle
- Request details

Status becomes **Pending Sales Manager Approval**. The applicable approval period begins.

| Outcome | Result |
|---|---|
| **REJECTED** | The buyer is notified and the request is closed according to GCE process. |
| **APPROVED** | The request proceeds to the financing arrangement and payment-duration selection. |
| **OVERDUE** | If the applicable period passes without action, status becomes **Overdue — Awaiting Action**. No automatic cancellation is assumed unless confirmed by GCE. |

---

### Phase B — Financing Arrangement

#### Step 6 — Buyer selects payment duration
- Before the Initial Downpayment and financing arrangement are calculated, the Sales Manager asks the buyer **how many months or years the buyer wants to pay for the vehicle**.
- The buyer selects the preferred payment duration in months or years, subject to the available GCE financing arrangements.
- The selected payment duration is recorded as part of the financing request.

#### Step 7 — Sales Manager and Head Accountant calculate the Initial Downpayment
- After the buyer selects the preferred payment duration, the Sales Manager calculates the applicable financing arrangement and Initial Downpayment.
- The calculation considers:
  - Vehicle price
  - Selected payment duration
  - Remaining balance
  - Applicable GCE financing rules
- The Sales Manager prepares the proposed Initial Downpayment.
- The proposed arrangement is submitted to the Head Accountant for financial review.

#### Step 8 — Head Accountant reviews the proposed Initial Downpayment
The Head Accountant reviews:
- Vehicle price
- Proposed Initial Downpayment
- Buyer's selected payment duration
- Remaining balance
- Buyer information
- Required documents
- Financing arrangement

| Outcome | Result |
|---|---|
| **APPROVED** | The proposed arrangement proceeds to CEO review. |
| **NOT APPROVED** | The arrangement is returned to the Sales Manager with the reason or requested adjustment. The Sales Manager revises the Initial Downpayment and/or financing details and resubmits them. |

#### Step 9 — CEO confirms the financing arrangement
The CEO reviews the financing arrangement and the Head Accountant's financial review.

| Outcome | Result |
|---|---|
| **CONFIRMED** | The approved arrangement proceeds to final recording. |
| **NOT CONFIRMED** | The arrangement is returned for further review or revision according to the GCE approval process. |

#### Step 10 — Head Accountant records final approved financing details
The Head Accountant records the final approved financing details, including:
- Buyer
- Vehicle
- Approved price
- Initial Downpayment
- Remaining balance
- Selected payment duration
- Financing arrangement
- Installment information
- Transaction status

Status becomes **Approved — Awaiting Buyer Decision**.

#### Step 11 — Buyer reviews approved financing details
The buyer reviews:
- Approved Initial Downpayment
- Remaining balance
- Selected payment duration
- Financing arrangement

| Outcome | Result |
|---|---|
| **DOES NOT PROCEED** | The request is closed. No Initial Downpayment is collected. The vehicle remains available. |
| **PROCEEDS** | The buyer continues to the GCE Visit. |

---

### Phase C — GCE Visit & Purchase

#### Step 12 — Buyer schedules GCE Visit
- The buyer schedules a visit to GCE.
- The appointment is treated as a **Vehicle Inspection and Purchase Decision Appointment**.
- **No Initial Downpayment is collected before the physical inspection.**
- Status becomes **GCE Visit Scheduled — Initial Downpayment Pending**.

#### Step 13 — Buyer visits GCE
- On the scheduled date, the buyer visits GCE.
- The Sales Manager handles the visit and presents the vehicle.
- The buyer physically inspects the vehicle and may ask questions about the vehicle and financing arrangement.

#### Step 14 — Buyer makes purchase decision
After physically inspecting the vehicle, the buyer decides whether to proceed.

| Outcome | Result |
|---|---|
| **WANTS TO PROCEED** | The Sales Manager records a **Purchase Claim**. The vehicle is placed under the buyer's active Purchase Claim. The buyer proceeds to the Initial Downpayment process. |
| **NEEDS TIME** | The buyer is recorded as a **Potential Buyer**. No Initial Downpayment is collected. The vehicle is **not reserved** solely because of Potential Buyer status and may continue to be presented to other buyers. |

#### Step 15 — Multiple Potential Buyers
- Multiple buyers may be recorded as Potential Buyers for the same vehicle.
- Potential Buyer status **does not constitute** a purchase or financial commitment.
- The Sales Manager may continue presenting the vehicle to interested buyers.

#### Step 16 — Potential Buyer submits Purchase Claim
- When a Potential Buyer decides to proceed, the Sales Manager records the Purchase Claim.
- The vehicle is placed under the buyer's active Purchase Claim.
- Other Potential Buyers are placed on hold or notified according to applicable GCE policy.
- The buyer proceeds to the Initial Downpayment.

#### Step 17 — Buyer pays the Initial Downpayment
- The Initial Downpayment is collected **only after** the buyer has physically inspected and accepted the vehicle.
- The buyer pays using a GCE-accepted payment method.
- The Sales Manager records or initiates the payment.
- Status becomes **Initial Downpayment — Awaiting Verification**.

#### Step 18 — Head Accountant verifies the Initial Downpayment
The Head Accountant verifies the payment amount and transaction records.

| Outcome | Result |
|---|---|
| **CONFIRMED** | Status becomes **Initial Downpayment — Confirmed**. |
| **NOT VERIFIED** | Payment remains pending. The buyer is informed. The payment issue is handled according to the applicable GCE process. |

#### Step 19 — Financing agreement is completed
- After the Initial Downpayment is confirmed, the required financing agreement is completed and the financing account is activated.
- Status becomes **In-House Financing — Active**.

#### Step 20 — Vehicle is marked sold
**Preconditions:** buyer acceptance, an active Purchase Claim, confirmed Initial Downpayment, and completed financing agreement.

- The Sales Manager marks the vehicle **Sold**.
- The vehicle is removed from the active listing.
- The transaction is updated.
- Other Potential/On-Hold buyers are notified according to GCE process.

#### Step 21 — Head Accountant records the sale
The Head Accountant records the completed transaction, including:
- Vehicle selling price
- Initial Downpayment
- Remaining balance
- Buyer information
- Financing account
- Selected payment duration
- Installment arrangement

---

### Phase D — Installments

#### Step 22 — Financing account becomes active
The Head Accountant monitors the active financing account. The account records:
- Total amount financed
- Amount paid
- Remaining balance
- Payment status
- Applicable next payment

#### Step 23 — Buyer continues installment payments
- The buyer continues installment payments according to the approved financing arrangement and selected payment duration.
- The Head Accountant records confirmed payments and updates:
  - Amount paid
  - Remaining balance
  - Payment status

#### Step 24 — Missed payment
- If the buyer fails to make an applicable installment payment, the financing account is **flagged** for the missed payment.
- The applicable payment or grace period is applied after **4–5 months of missed payments**.

#### Step 25 — Financing completed
- When the buyer completes all required installment payments, the Head Accountant confirms that the financing balance is fully paid.
- Status becomes **In-House Financing — Completed**.
- The financing account is closed according to GCE procedure.

---

### Phase E — Repossession, Reconditioning & Relisting

#### Step 26 — Repossession due to non-payment
If the buyer fails to pay within the applicable payment period:
1. The Head Accountant identifies the outstanding financing account.
2. The Head Accountant prepares:
   - Transaction bills/invoices
   - Total vehicle amount after including the payment penalties for the missed months
   - Amount already paid
   - Unsettled/remaining balance
   - Outstanding installments
3. The Confidential Informant and Head Security receive the transaction bills and unsettled balance as supporting documents.
4. Applicable GCE repossession/towing authorization or processing confirmation is provided as required.
5. The signed GCE rule/policy acknowledged by the client during the vehicle release process is verified.
6. The Confidential Informant and Head Security receive the required supporting documents.
7. Towing/recovery proceeds according to the approved GCE repossession procedure.
8. The vehicle is returned to GCE.
9. Status becomes **Repossessed / Recovered by GCE**.
10. The Head Accountant updates the financial and transaction records according to GCE policy.

#### Step 27 — Mechanic re-inspects the recovered vehicle
- After the repossessed vehicle is returned to GCE, the Mechanic conducts a complete inspection of the vehicle's overall condition.
- The Mechanic prepares an **Overall Vehicle Status Report**.

#### Step 28 — Mechanic identifies required repairs and replacement parts
- The Mechanic identifies damaged, defective, or missing parts.
- The Mechanic determines which parts need repair or replacement.
- Required repair and reconditioning work is documented.

#### Step 29 — Mechanic prepares restoration cost estimate
The Mechanic prepares an estimated total restoration cost covering:
- Replacement parts
- Repair expenses
- Reconditioning expenses
- Other restoration-related costs

#### Step 30 — Mechanic submits reconditioning fund request
The Mechanic submits:
- Overall Vehicle Status Report
- Damaged/required parts
- Repair requirements
- Estimated total restoration cost

The Mechanic requests the necessary funds through the applicable GCE funding/reimbursement process.

#### Step 31 — Vehicle repair and reconditioning begins
- Once the required funding/process is approved according to GCE procedure, the Mechanic begins repairing and reconditioning the vehicle.
- Damaged parts are repaired or replaced as required.
- Parts and expenses are recorded.

#### Step 32 — Mechanic monitors repair progress
- The Mechanic monitors the repair and reconditioning process.
- Additional damage or required repairs discovered during the work are documented.
- If additional parts or funds are required, the appropriate additional request is prepared according to the applicable GCE process.

#### Step 33 — Sales Manager re-processes vehicle papers
While the Mechanic performs repairs and reconditioning, the Sales Manager updates and re-processes the vehicle's required paperwork and records following the repossession and recovery process. *(Runs in parallel with Steps 31–34.)*

#### Step 34 — Mechanic completes repairs and reconditioning
The Mechanic completes the required repairs, replaces necessary damaged parts, and performs the required reconditioning to restore the vehicle to a sellable condition.

#### Step 35 — Mechanic conducts final inspection
The Mechanic performs a final inspection and prepares the **final repair/reconditioning report**, which includes:
- Repairs completed
- Parts replaced/repaired
- Actual repair and reconditioning expenses
- Updated vehicle condition
- Confirmation that the vehicle is ready for the next stage

#### Step 36 — Vehicle returns to sellable stage
- Once the Mechanic confirms that the vehicle is in a sellable condition, the completed repair and reconditioning records are retained.
- The vehicle proceeds to re-pricing.

#### Step 37 — Vehicle and repair records are given to Marketing Specialist
The vehicle is forwarded to the Marketing Specialist together with:
- Overall Vehicle Status Report
- Completed repairs
- Replaced parts
- Repair/reconditioning costs
- Updated vehicle condition

#### Step 38 — Marketing Specialist re-evaluates vehicle price
- The Marketing Specialist reviews the updated vehicle condition and repair/reconditioning costs.
- The Marketing Specialist prepares a **Revised Vehicle Price Proposal**.

#### Step 39 — Marketing Specialist submits revised price to CEO
The Marketing Specialist submits the revised vehicle price proposal and supporting repair/reconditioning information to the CEO for final approval.

#### Step 40 — CEO reviews revised vehicle price

| Outcome | Result |
|---|---|
| **APPROVED** | The revised price is finalized and the vehicle proceeds to listing. |
| **NOT APPROVED** | The proposal is returned to the Marketing Specialist for revision and resubmission. |

#### Step 41 — Vehicle information and price are updated
After CEO approval, the vehicle record is updated with:
- Final approved selling price
- Updated vehicle condition
- Completed repairs/reconditioning
- Relevant vehicle information

#### Step 42 — Vehicle returns to GCE Cars listing
- The vehicle is returned to the GCE Cars listing with its final approved price and updated information.
- The vehicle becomes available to potential buyers again and re-enters the normal GCE vehicle selling/buying process.

---

### Complete In-House Financing Flow (as stated in the source)

```
Buyer Logs In → Credentials + 2 IDs → Reviews Vehicle → In-House Financing
→ Sales Manager Review → Buyer Selects Payment Duration
→ Initial Downpayment/Financing Calculation → Head Accountant Review → CEO Confirmation
→ Approved Financing → GCE Visit & Physical Inspection
→ Purchase Claim OR Potential Buyer → Initial Downpayment → Verification
→ Financing Agreement → Sold → Installments
→ Financing Completed OR Missed Payment
→ Repossession → Vehicle Recovery → Mechanic Inspection → Restoration Estimate
→ Reconditioning Funding → Repair & Reconditioning → Final Inspection
→ Sales Manager Documentation → Marketing Specialist Repricing → CEO Approval
→ GCE Cars Listing
```

### Status Progression (In-House Financing)
```
Pending Sales Manager Approval
  → Approved — Awaiting Buyer Decision
  → GCE Visit Scheduled — Initial Downpayment Pending
  → Initial Downpayment — Awaiting Verification
  → Initial Downpayment — Confirmed
  → In-House Financing — Active
  → In-House Financing — Completed
       OR
  → Repossessed / Recovered by GCE
```

---

## SECTIONS 7–11 — Not Yet Documented

The following flows are listed in the Table of Contents but marked *"Currently wala pa po sa pdf"* (not yet in the PDF). No content exists for them in the source.

| # | Flow |
|---|---|
| 7 | Bank-transfer: GCE Visit |
| 8 | Bank-transfer: Half way |
| 9 | Bank-transfer: Delivery |
| 10 | In-House Financing: Meet Halfway (Calabarzon) |
| 11 | In-House Financing: Delivery |

---

## Appendix A — Roles & Responsibilities

*Compiled from the responsibilities assigned in the flows above.*

| Role | Responsibilities in the Document |
|---|---|
| **Seller** | Submits vehicle details, images, issue declaration, 2 Valid IDs, ORCR, Deed of Sale; chooses meet-up method; negotiates via website chat. |
| **Buyer** | Selects vehicle; submits credentials and 2 valid IDs; acknowledges condition (Halfway, Delivery, Financing); selects payment/meet-up; attends visit/meetup/delivery; pays; tracks delivery; pays installments (Financing). |
| **Marketing Specialist** | Verifies seller submissions; proposes provisional price ceiling to CEO; negotiates with seller via website chat; creates Inspection Issue Report; cancels unprofitable transactions; records seller refusal; re-evaluates repossessed vehicle price and prepares Revised Vehicle Price Proposal. |
| **CEO** | Approves/rejects price ceilings and revised purchase prices (Selling); receives payment report; confirms financing arrangements; approves revised vehicle prices after reconditioning. |
| **Sales Manager** | Reviews buyer requests; manages Active/On-Hold queue; presents vehicles; contacts no-show buyers; classifies declines (Legit/Not Legit); determines delivery arrangement; creates Delivery Field Case; informs buyer of delays; marks cars sold ("Mark Sold to This Buyer"); asks payment duration and prepares Initial Downpayment (Financing); records Purchase Claims / Potential Buyers; re-processes papers after repossession. |
| **Head Accountant** | Disburses seller payment and reports to CEO; reimbursed on "Vehicle Sold"; receives sale figures for record-keeping; records delivery-fee payment and approves Sales Manager's payment report; confirms downpayment before dispatch; reviews financing arrangements; records approved financing details; verifies Initial Downpayment; monitors financing accounts and installments; prepares repossession bills; updates records. |
| **Mechanic** | Inspects vehicles (Selling); confirms plate/chassis vs ORCR; documents condition via images/photos; estimates repair cost; discusses revised price with seller; attends Halfway meetups and deliveries; re-inspects repossessed vehicles; prepares status report, cost estimate, fund request; performs repairs and final inspection. |
| **Confidential Informant (CI)** | Confirms seller identity matches verified ID; reports issues by phone; attends Halfway meetups and deliveries; reports delivery delays to Sales Manager; receives repossession documents; participates in recovery. |
| **Head Security** | Part of the delivery team; confirms remaining cash payment on delivery; receives repossession documents; participates in recovery. |

---

## Appendix B — Transaction Statuses & Flags

*All statuses and flags named in the document.*

| Status / Flag | Where Used | Meaning |
|---|---|---|
| **Pending CEO Approval** | Selling | Awaiting CEO decision on the provisional price ceiling (7-day window). |
| **Pending Sales Manager Approval** | All buying flows | Awaiting Sales Manager review (7-day window; "applicable approval period" for Financing). |
| **Overdue — Awaiting Action** | Selling, all buying flows | Review window lapsed without action; no automatic cancellation. |
| **Active** | Halfway, Delivery, Financing | The request currently being processed for that vehicle. |
| **On Hold** | Halfway, Delivery, Financing | Queued behind an existing Active request. |
| **Declined by Buyer** | Onsite, Halfway, Delivery, (Cheque) | Buyer declined after seeing/inspecting the vehicle. |
| **Buyer Didn't Show Up** | Halfway | Buyer failed to appear within 2h30m or confirmed unable; counts as a no-show. |
| **Buyer Unavailable** | Delivery | Buyer absent at delivery without advance notice; counts as a no-show; downpayment forfeited. |
| **Sold** / **Vehicle Sold** | All | Vehicle finalized for a buyer and removed from listings; triggers Head Accountant reimbursement (Selling). |
| **Accepted — Awaiting Clearance** | Cheque *(disregarded)* | Cheque accepted, pending clearance. |
| **Approved — Awaiting Buyer Decision** | Financing | Financing recorded; buyer to review. |
| **GCE Visit Scheduled — Initial Downpayment Pending** | Financing | Inspection appointment booked; no downpayment yet. |
| **Purchase Claim** | Financing | Buyer committed after inspection; vehicle placed under their claim. |
| **Potential Buyer** | Financing | Buyer needs time; no commitment, vehicle not reserved. |
| **Initial Downpayment — Awaiting Verification** | Financing | Payment made, pending Head Accountant check. |
| **Initial Downpayment — Confirmed** | Financing | Payment verified. |
| **In-House Financing — Active** | Financing | Financing account activated. |
| **In-House Financing — Completed** | Financing | All installments paid; account closed. |
| **Repossessed / Recovered by GCE** | Financing | Vehicle recovered due to non-payment. |
| **Delivery tracking:** Dispatched → In Transit → Arriving → Delivered | Delivery | Buyer-visible delivery progress. |

---

## Appendix C — Shared Rules Across Flows

*Rules as stated in the document, grouped for reference.*

| Rule | Detail | Applies To |
|---|---|---|
| **Buyer identification** | Required buyer information + **2 valid IDs**. | All buying flows |
| **Seller documents** | 2 Valid IDs, ORCR, Deed of Sale. | Selling |
| **7-day processing window** | Starts when a request enters review. Lapse → **Overdue — Awaiting Action**, no automatic cancellation. | Selling (CEO), Onsite, Halfway, Delivery, (Cheque) |
| **Condition acknowledgment** | Buyer reviews credit score / 360° view and acknowledges condition before proceeding. | Halfway, Delivery, Financing |
| **Slot locking** | Chosen visit slot is locked for the buyer even before Sales Manager review; released on rejection; stays locked while Overdue. | Onsite, (Cheque) |
| **Active / On Hold queue** | One Active request per vehicle; others On Hold. Sales Manager **manually** selects the next on-hold request after rejection, no-show, or decline. | Halfway, Delivery, Financing |
| **5-hour cancellation cut-off** | Cancellation allowed only **≥ 5 hours** before the scheduled time. | Halfway, Delivery, (Cheque) |
| **No-show wait time** | Buyer has **2 hours 30 minutes** to arrive. | Halfway |
| **No-show limit** | **2 no-shows** → restricted to **GCE Visit only**. | Halfway, Delivery |
| **Decline classification** | **Legit** → no penalty (Delivery: downpayment refunded in 2–3 working days). **Not Legit** → strike, restricted to **GCE Visit only** (Delivery: downpayment forfeited). | Halfway, Delivery |
| **Downpayment deadline** | Within **2–3 working days** after approval; missed → cancelled/forfeited, nothing to refund. | Delivery |
| **GCE-caused delays** | No penalty or strike for the buyer. | Delivery |
| **Mark Sold to This Buyer** | Finalizes sale, removes car from public listings, notifies on-hold buyers. | All buying flows |
| **Field Case** | Created for field work (seller inspection, halfway meetup, delivery). | Selling, Halfway, Delivery |
| **Field expense reporting** | Always required with proofs, whether or not the vehicle is purchased; logged with the transaction. | Selling |
| **Negotiation channel** | Website chat only; full history retained in the transaction. | Selling |
| **Missed installments** | Account flagged; payment/grace period applied after **4–5 months** of missed payments. | Financing |

---

## Appendix D — Scenario Comparison

| Aspect | Onsite (Cash) | Meet Halfway (Cash) | Delivery (Cash) | In-House Financing (GCE Visit) |
|---|---|---|---|---|
| Condition acknowledgment | Not stated | Required | Required | Required |
| Scheduling | Locked slot at booking | Date/time with Active/On Hold | Delivery date/time with Active/On Hold | Visit scheduled after financing approval |
| Queue model | Slot lock | Active / On Hold | Active / On Hold | Active / On Hold; Potential Buyers |
| Approvers | Sales Manager | Sales Manager | Sales Manager (+ Head Accountant for fees) | Sales Manager → Head Accountant → CEO |
| Field team | None (at GCE) | Mechanic and/or CI | Mechanic + CI + Head Security | None (at GCE) |
| Upfront payment | None | None | Delivery fee + downpayment (bank transfer) | Initial Downpayment after inspection |
| Final payment | Cash at GCE | Cash at meetup | Remaining cash on delivery | Installments |
| Cancellation cut-off | Not stated | ≥ 5 hours before | ≥ 5 hours before | Not stated |
| No-show penalty | Not stated | 1 no-show; 2 → GCE Visit only | 1 no-show; 2 → GCE Visit only; downpayment forfeited | Not stated |
| Decline penalty | Declined by Buyer | Legit / Not Legit (strike) | Legit (refund) / Not Legit (strike, forfeit) | Needs Time → Potential Buyer |

---

## Appendix E — Markings & Review Notes from the Source

**Markings in the PDF:**
1. **Section 5 (Cheque Purchase)** is marked **DISREGARD** in the Table of Contents (highlighted row) and in a banner above the section.
2. **Section 6 (In-House Financing)** is labeled **"Ongoing Workflow — For Client Validation."**
3. **Sections 7–11** are listed in the Table of Contents with the note **"Currently wala pa po sa pdf"** (not yet in the PDF).
4. **Selling Scenario, Step 12** heading ("Meetup expenses are logged with the transaction") is highlighted in black.
5. **Delivery Scenario, Step 5** ("Sales Manager reviews and approves") is fully highlighted in black.

**Points in the source text that may need clarification** *(observations only — no changes made to the content above):*
1. **Delivery Step 5 vs. Steps 5a/6:** Step 5 describes a *delivery fee* being paid and recorded by the Head Accountant *before* the Delivery Field Case is created, while Steps 5a–6 describe a *downpayment* via bank transfer within 2–3 working days confirmed *before dispatch*. The document does not state whether these are one payment or two separate payments, or their exact order.
2. **Delivery Step 5 ordering:** The Delivery Field Case and dispatch are described inside Step 5, before the downpayment steps (5a, 6) and the dispatch step (7).
3. **Financing Step 7 title vs. body:** The title says "Sales Manager **and Head Accountant** calculate," but the body says the Sales Manager calculates and prepares it, then submits it to the Head Accountant for review.
4. **Selling Step 13:** States that the **Head Accountant** is reimbursed once "Vehicle Sold" is triggered; the expenses in Steps 11–12 are incurred by the Mechanic and Confidential Informant.
5. **Selling Step 6 vs. 7:** Step 6 says the field team reports "whether the vehicle is still profitable"; Step 7 has the Marketing Specialist make the profitability determination in the Inspection Issue Report.
6. **Financing Step 5 / Step 4:** The approval period for Financing is described as "the applicable approval period" rather than a fixed 7 days.
7. **Financing Step 24:** "Payment or grace period is applied after 4–5 months of missed payments" — the exact trigger (4 or 5 months) and how it links to Step 26 (repossession) is not specified.
8. **Onsite Scenario:** No cancellation cut-off or no-show rule is stated for the Cash Onsite Visit flow, unlike Halfway and Delivery.
