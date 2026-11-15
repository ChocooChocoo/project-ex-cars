# GCE Buying and Selling Process

Reviewed: November 14, 2026.

This guide explains the process in plain English. It covers customers selling vehicles to GCE and customers buying vehicles from GCE.

The latest workflow request, [T10](docs/tasks/T10.md), defines the intended process. The current source code explains what the app enforces. Differences appear near the end of this guide.

This is a review of local documents and code, not a live transaction test. It does not confirm which database changes run on the deployed website.

## 1. Understand the two transactions

| Process | Customer's role | GCE's role | Main staff owner |
| --- | --- | --- | --- |
| Selling | Offers a vehicle to GCE | Inspects and buys the vehicle | Marketing Specialist |
| Buying | Purchases a vehicle from GCE | Sells an approved showroom vehicle | Sales Manager |

A customer selling a car does not post it directly in the showroom. GCE first buys it, completes any repairs, and approves its selling price.

The Sales Manager does not own the selling process. The Marketing Specialist does not approve buyer financing.

Sources: [T10](docs/tasks/T10.md), [seller actions](src/app/(staff)/transactions/sell-actions.ts), and [buyer actions](src/app/(staff)/transactions/actions.ts).

## 2. Who does what

| Person | Responsibility |
| --- | --- |
| Customer acting as seller | Submits vehicle details and papers, negotiates, presents the vehicle, and accepts or refuses a revised offer. |
| Customer acting as buyer | Selects a vehicle, submits requirements, accepts terms, signs required contracts, and pays. |
| Marketing Specialist | Reviews seller offers, negotiates within an approved limit, requests price approvals, and prepares showroom listings. |
| CEO | Decides purchase limits and selling prices, and confirms financing terms. |
| Mechanic | Inspects vehicles, records defects and repair estimates, and completes reconditioning. |
| Confidential Informant | Confirms identity during seller meetups, handles assigned field work, carries vehicle papers, and accounts for field funds. |
| Head Accountant | Reviews financial terms, releases approved funds, verifies payments, and confirms returned funds. |
| Sales Manager | Reviews buyer requests, prepares financing terms, assigns buyer field cases, and marks eligible purchases Sold. |
| Head Security | Joins assigned deliveries and vehicle recovery work. |

A field case is a work record for an assigned team. Reconditioning means repairing a vehicle before sale.

Sources: [T10](docs/tasks/T10.md), [field inspection](src/app/(staff)/field-cases/sell-inspection-actions.ts), and [delivery actions](src/app/(staff)/transactions/delivery-actions.ts).

## 3. Selling a vehicle to GCE

The normal sequence is:

Seller submits an offer → Marketing Specialist reviews it → CEO decides the purchase limit → Price and schedule are agreed → Funds are released → Mechanic inspects → Seller is paid → Repairs, if needed → Selling price approval → Showroom.

### 3.1 Submit the vehicle

The seller opens Sell Vehicle and supplies:

- Vehicle make, model, year, and mileage.
- Vehicle condition, description, and asking price.
- Ownership order, such as first or second owner.
- Vehicle photos.
- Known defects, or a declaration that no known defects exist.
- Front and back photos of two different valid IDs.
- A separate Official Receipt (OR) upload.
- A separate Certificate of Registration (CR) upload.
- A Deed of Sale.
- A choice between GCE Visit and Meet Halfway within CALABARZON.

The OR and CR are vehicle registration papers. The Deed of Sale records the sale agreement.

The app creates a pending sell transaction and a vehicle record that is not visible in the showroom. It also creates a chat thread for negotiation.

Sources: [submission action](src/app/(customer)/my-transactions/actions.ts#L816) and [submission rules](src/lib/validation/transactions.ts#L44).

### 3.2 Review the submission

The Marketing Specialist reviews the IDs, vehicle papers, photos, condition, and declared defects. The vehicle and ownership information must match the papers.

If the submission fails review, the Marketing Specialist rejects it and records the reason. If it passes, the Marketing Specialist proposes a purchase ceiling.

A purchase ceiling is the maximum amount GCE authorizes for acquisition. It is not the minimum offer or the future showroom price.

Sources: [seller document rules](src/lib/transactions/sell-flow.ts#L33) and [seller review actions](src/app/(staff)/transactions/sell-actions.ts#L40).

### 3.3 Obtain the CEO's decision

The Marketing Specialist sends the proposed ceiling to the CEO. The CEO can approve it, set a different ceiling, or reject it.

An approved ceiling permits negotiation, not payment or showroom publication. The agreed purchase price cannot exceed the approved ceiling.

The review has a seven-day window. An overdue review remains open for manual action rather than automatic cancellation.

Sources: [ceiling proposal](src/app/(staff)/transactions/sell-actions.ts#L89), [CEO decision](src/app/(staff)/vehicles/actions.ts#L235), and [review rules](src/lib/transactions/state-machine.ts#L136).

### 3.4 Negotiate and arrange inspection

The Marketing Specialist negotiates with the seller through the transaction chat. The agreement includes the purchase price, meeting location, date, and time.

The Marketing Specialist records the agreement and creates an acquisition field case. Staff assignments depend on the seller's chosen method.

Source: [price agreement and team assignment](src/app/(staff)/transactions/sell-actions.ts#L162).

### 3.5 Follow the selected meeting method

| Step | GCE Visit | Meet Halfway within CALABARZON |
| --- | --- | --- |
| Assign staff | Marketing Specialist books a Mechanic. | Marketing Specialist assigns a Confidential Informant and Mechanic. |
| Request funds | Marketing Specialist requests the agreed vehicle price. | Assigned Confidential Informant requests the vehicle price plus estimated travel expenses. |
| Release funds | Head Accountant approves and releases funds to the requester. | Head Accountant approves and releases funds to the requester. |
| Meet the seller | Seller brings the vehicle to GCE. | Assigned team meets the seller at the agreed location. |
| Confirm identity | Mechanic records the identity confirmation in the current app. | Confidential Informant confirms the seller's identity. |
| Inspect the vehicle | Mechanic confirms the plate or chassis and reports the condition. | Mechanic confirms the plate or chassis and reports the condition. |
| Pay after clearance | Marketing Specialist pays the seller. | Confidential Informant pays the seller and brings the vehicle to GCE. |

Releasing funds to a staff member is not the same as paying the seller. Seller payment waits until the vehicle passes the required inspection and price decisions.

Sources: [purchase fund requests](src/app/(staff)/finance/actions.ts#L120), [inspection actions](src/app/(staff)/field-cases/sell-inspection-actions.ts#L117), and [seller payment rules](supabase/migrations/20261111150000_t10_seller_paid_by_requester.sql).

### 3.6 Handle inspection results

The intended process separates three outcomes:

1. No defects: Clear the vehicle for payment, then send it to the Marketing Specialist for listing preparation.
2. Previously declared defects: Buy at the accepted price, then send the vehicle for reconditioning.
3. Hidden or additional defects: Pause payment and review the price again.

For hidden defects, the Mechanic supplies photos, a description, and a repair estimate. The Marketing Specialist decides whether the purchase remains profitable.

If it remains profitable, the Marketing Specialist prepares an Inspection Issue Report and sends a revised ceiling to the CEO. After approval, staff present the revised purchase price to the seller.

If the seller accepts, staff record acceptance and clear the vehicle for payment. If the seller refuses, the CEO rejects the revised ceiling, or the purchase is unprofitable, the transaction ends.

The current app combines defects into one `issue_found` outcome. The difference from the intended declared-defect route appears in Section 7.

Sources: [T10 selling workflows](docs/tasks/T10.md#L61), [inspection report](src/app/(staff)/field-cases/sell-inspection-actions.ts#L145), and [issue review](src/app/(staff)/transactions/sell-actions.ts#L275).

### 3.7 Pay the seller and account for funds

The fund requester pays the final agreed price after clearance. The requester or Head Accountant records the seller as paid.

This completes the customer's sell transaction. It does not mean that GCE already resold the vehicle.

Staff record field expenses with a purpose and supporting receipt. The fund requester records unused funds returned to GCE, and the Head Accountant confirms receipt.

If the purchase ends without payment, released purchase funds must be returned. Expense records remain linked to the field case.

Sources: [record seller paid](src/app/(staff)/finance/actions.ts#L256), [payment completion](supabase/migrations/20261111150000_t10_seller_paid_by_requester.sql), and [fund returns](src/app/(staff)/field-cases/budget-actions.ts#L113).

### 3.8 Repair and prepare the showroom listing

If repairs are required, the Mechanic submits a condition report and an itemized estimate. Each part entry includes a photo, part name, replacement brand, and estimated cost.

The Head Accountant reviews and releases repair funds. The Mechanic completes the work and records the final repair report and expenses.

The Marketing Specialist then prepares vehicle photos and proposes a selling price. The CEO approves the price, enters a different price, or returns it for revision.

In the current app, CEO approval of a selling price makes the vehicle available in the showroom. Purchase-ceiling approval alone does not publish it.

Sources: [reconditioning actions](src/app/(staff)/vehicles/reconditioning-actions.ts), [price proposal](src/app/(staff)/vehicles/actions.ts#L171), and [price approval](src/app/(staff)/vehicles/actions.ts#L298).

## 4. Buying a vehicle from GCE

The shared start is:

Buyer selects a showroom vehicle → Opens Buy Now → Supplies requirements → Chooses payment and arrangement → Submits request → Sales Manager reviews.

Creating a Buy Now transaction starts a draft. The buyer must complete the requirements and send the request before staff review begins.

### 4.1 Complete the purchase request

The buyer supplies:

- Front and back photos of two different valid IDs.
- One proof of billing.
- A payment option.
- A way to receive or inspect the vehicle.
- An address for a meetup or delivery.
- A schedule when the selected flow requires one.
- A financing term when financing is selected.

The payment options in the current app are Full Payment and In-House Financing. Full Payment supports cash paid in person or Bank Transfer through PayMongo.

The arrangements are GCE Visit, Meet Halfway within CALABARZON, and Delivery. Buyers must acknowledge the vehicle's condition for meetups, deliveries, and financing.

Delivery also requires acceptance of the delivery terms. An address saved during buying updates the customer's profile.

Sources: [buyer request actions](src/app/(customer)/my-transactions/actions.ts#L167), [request submission](src/app/(customer)/my-transactions/actions.ts#L398), and [purchase rules](src/lib/validation/transactions.ts).

### 4.2 Wait for review or a queue position

The Sales Manager reviews the request and verifies the documents. Approval requires both IDs and the proof of billing to be verified.

Meet Halfway, Delivery, and financing requests use a queue for each vehicle. One queued request is Active, and additional requests wait On Hold.

A direct-payment GCE Visit uses a locked appointment slot instead. A locked slot is not a completed sale or a reservation of the whole vehicle.

The Sales Manager manually promotes an eligible On Hold request when the current opportunity ends. A seven-day review deadline does not automatically cancel the request.

Sources: [submission and queue handling](src/app/(customer)/my-transactions/actions.ts#L398), [approval requirements](src/app/(staff)/transactions/actions.ts#L102), and [queue promotion](src/app/(staff)/transactions/actions.ts#L585).

### 4.3 Full Payment with a GCE Visit

1. The buyer books an available visit slot and submits the request.
2. The Sales Manager verifies the requirements and approves or rejects it.
3. The buyer visits GCE and inspects the vehicle.
4. If the buyer proceeds, the buyer pays in cash or through the Bank Transfer checkout.
5. For cash, the Sales Manager records the payment. For online payment, the app records the payment.
6. The Head Accountant verifies the payment.
7. The Sales Manager requests the vehicle papers from the Confidential Informant.
8. The Confidential Informant releases the papers, and the Sales Manager records receipt.
9. The Sales Manager marks the purchase Sold.

If the buyer declines after inspection, staff close that purchase opportunity. If staff reject the request, its appointment slot is released.

This direct-payment GCE Visit does not require the separate financing or field-sale contract workflow in the current code. Required sale paperwork still applies.

Sources: [original onsite process](docs/DOCUMENTS/GCE_Process_Flows.md#L276), [payment recording](src/app/(staff)/transactions/actions.ts#L631), and [papers release](src/app/(staff)/transactions/handover-actions.ts#L111).

### 4.4 Full Payment with Meet Halfway

1. The buyer acknowledges the vehicle's condition, supplies the location and schedule, and submits the request.
2. The Sales Manager reviews the Active request.
3. For Bank Transfer, the Sales Manager sets a downpayment during approval.
4. The buyer pays that downpayment, and the Head Accountant verifies it before the field case is created.
5. The Sales Manager assigns a Confidential Informant and Mechanic.
6. The team meets the buyer and presents the vehicle.
7. If the buyer proceeds, the buyer signs the required contract.
8. The buyer pays the remaining balance through PayMongo, or pays cash for a cash purchase.
9. The Head Accountant verifies the full payment before the Confidential Informant hands over the papers.
10. Required staff record their signed contract copies, and the Sales Manager marks the purchase Sold.

A cash meetup does not require the Bank Transfer downpayment step. Its team is assigned during request approval.

Sources: [request approval](src/app/(staff)/transactions/actions.ts#L127), [meetup assignment](src/app/(staff)/transactions/delivery-actions.ts#L270), and [handover rules](src/app/(staff)/transactions/handover-actions.ts#L246).

### 4.5 Full Payment with Delivery

1. The buyer acknowledges the condition, accepts delivery terms, and supplies an address and delivery schedule.
2. The Sales Manager approves the request and confirms that GCE can serve the address.
3. The Sales Manager sets the delivery fee. The current app calculates a downpayment of 10% of the vehicle price.
4. The buyer pays the required downpayment and delivery fee through PayMongo.
5. The Head Accountant verifies both required payments.
6. The Sales Manager creates a field case for the Confidential Informant and Head Security.
7. The Confidential Informant requests an expense budget, and the Head Accountant approves and releases it.
8. The Confidential Informant records taking the vehicle papers before dispatch.
9. The team updates delivery progress and records expenses with receipts.
10. At the destination, the buyer inspects the vehicle and signs the required contract if proceeding.
11. For Bank Transfer, the buyer pays the remaining balance through PayMongo.
12. The Head Accountant verifies full payment before the team marks the vehicle Delivered and hands over its papers.
13. The Sales Manager marks the purchase Sold after the required handover and contract records are complete.
14. The Confidential Informant records unused budget returned to GCE, and the Head Accountant confirms receipt.

Delivery progress follows Dispatched → In Transit → Arriving → Delivered. Delivery and rescheduling fees do not reduce the vehicle price.

The current app also supports cash delivery. That route collects the remaining vehicle balance in cash rather than through the Bank Transfer checkout.

The local app splits large Bank Transfer balances into payments of at most PHP 999,000. Each verified part reduces the remaining amount.

Sources: [delivery terms and assignment](src/app/(staff)/transactions/delivery-actions.ts), [delivery progress](src/app/(staff)/field-cases/delivery-actions.ts), [field budgets](src/app/(staff)/field-cases/budget-actions.ts), and [payment rules](src/lib/transactions/buy-flow.ts#L428).

## 5. Buying through In-House Financing

Financing divides the approved price into a downpayment, when applicable, and monthly installments. It requires financial approval in addition to approval of the buyer request.

The common approval order is Sales Manager → Head Accountant → CEO. Delivery and physical visits differ in when money becomes due.

### 5.1 Approve the financing terms

1. The buyer selects financing, an arrangement, and a term of 6, 12, 24, 36, or 60 months.
2. The Sales Manager verifies the buyer's documents and approves the request.
3. The Sales Manager prepares the total price, downpayment, monthly amount, and first due date.
4. The Head Accountant approves the terms or returns them with a reason.
5. The CEO confirms the terms or returns them for revision.
6. The buyer receives the confirmed financing details.

The current default total uses the showroom price plus the configured financing markup. The original markup is 10%, but the stored configuration can change it.

The current downpayment is 10% of the vehicle price for GCE Visit and Delivery. A financed Meet Halfway uses no downpayment.

Sources: [financing actions](src/app/(staff)/transactions/financing-actions.ts#L61), [financing rules](src/lib/transactions/buy-flow.ts#L43), and [markup configuration](src/lib/settings/financing.ts).

### 5.2 Financing with a GCE Visit

1. The buyer reviews the confirmed offer and accepts or declines it.
2. If accepting, the buyer books an inspection visit.
3. The buyer inspects the vehicle at GCE.
4. If proceeding, the Sales Manager records a Purchase Claim, which reserves the vehicle.
5. If the buyer needs time, the Sales Manager records Potential Buyer instead. This does not reserve the vehicle.
6. The Sales Manager prepares the contract, and the Head Accountant approves it.
7. The buyer signs electronically or chooses the supported face-to-face signing process.
8. After inspection, acceptance, and the required signature, the buyer pays the initial downpayment.
9. The Head Accountant verifies the downpayment and activates the financing account.
10. Staff complete the required papers handover and continue the installment schedule.

Do not collect the initial downpayment before the buyer inspects and accepts the vehicle in this arrangement. Do not mark the car Sold while installments remain unsettled.

Sources: [buyer offer response](src/app/(customer)/my-transactions/actions.ts#L556), [visit decision](src/app/(staff)/transactions/financing-actions.ts#L317), and [contract actions](src/app/(staff)/transactions/handover-actions.ts#L280).

### 5.3 Financing with Meet Halfway

After financing approval, the buyer accepts the offer and books a meetup. The Sales Manager prepares the contract and obtains Head Accountant approval.

The Sales Manager assigns a Confidential Informant and Mechanic. This financing arrangement does not collect a downpayment.

The team meets the buyer, records the meeting, and completes the required signing and signed-copy records. The Confidential Informant reports the signing.

The Head Accountant activates the financing account after the required signing report. The buyer then pays installments according to the approved schedule.

Sources: [financing terms](src/app/(staff)/transactions/financing-actions.ts#L95), [meetup assignment](src/app/(staff)/transactions/delivery-actions.ts#L270), and [account activation](src/app/(staff)/transactions/financing-actions.ts#L384).

### 5.4 Financing with Delivery

1. The buyer submits the financing request with a delivery date and address.
2. The Sales Manager prepares financing terms that include the delivery fee.
3. The Head Accountant reviews the terms, and the CEO confirms them.
4. The buyer pays the initial downpayment and delivery fee through PayMongo.
5. The Head Accountant verifies both required payments.
6. The Sales Manager assigns the Confidential Informant and Head Security.
7. The Confidential Informant requests the field budget and receives the released funds.
8. The team delivers the vehicle and records progress, expenses, and the buyer meeting.
9. If the buyer accepts, the buyer signs the contract and the Confidential Informant reports the signing.
10. Staff complete the delivery and papers handover. The Head Accountant activates the financing account.
11. The buyer pays the remaining amount through scheduled installments.
12. After all installments are settled, the Sales Manager marks the purchase Sold.

The team does not collect the financed balance at the door. The next vehicle payment follows the installment schedule.

Unlike financing with a GCE Visit, delivery requires the initial downpayment before dispatch. Delivered, financing active, and Sold are separate milestones.

Sources: [financed delivery confirmation](src/app/(staff)/transactions/financing-actions.ts#L236), [account activation](src/app/(staff)/transactions/financing-actions.ts#L384), and [T10 target workflow](docs/tasks/T10.md#L138).

### 5.5 Pay installments and close the account

For an online installment, the buyer pays through PayMongo. The Sales Manager approves the online payment, and the Head Accountant verifies it.

For a cash installment, the Sales Manager records the payment and the Head Accountant verifies it. An unverified payment does not settle the installment.

When every installment is paid or formally waived, the app closes the financing account. The Sales Manager can then complete the sale after the other handover requirements pass.

The current recovery instruction requires four consecutive missed installments. Recovery requires staff action and an assigned case, not an automatic vehicle seizure.

A recovered vehicle returns through inspection, reconditioning, paperwork processing, price approval, and relisting. These are app workflow rules, not legal authorization to repossess a vehicle.

Sources: [online installment approval](src/app/(staff)/transactions/payment-review-actions.ts), [payment verification](src/app/(staff)/transactions/actions.ts#L764), [account closure](src/lib/transactions/financing-server.ts#L101), and [recovery instruction](src/app/(staff)/transactions/actions.ts#L1307).

## 6. Scheduling, cancellations, and unsuccessful purchases

| Situation | Current rule or process |
| --- | --- |
| Appointment times | Whole-hour slots from 9 AM through 9 PM, Monday through Saturday, in Manila time. |
| Initial delivery booking | At least seven days after the request date. |
| Normal meetup or delivery cancellation | At least five hours before the scheduled time. |
| Meetup no-show | Staff wait two hours and 30 minutes before recording it. |
| Two no-shows | Buyer becomes restricted to GCE Visit. |
| Decline classified Not Legit | Buyer immediately becomes restricted to GCE Visit. |
| Legitimate delivery decline | Downpayment refund enters the Head Accountant's disbursement process. The stated target is two to three working days. |
| Delivery buyer absent without notice | Staff record Buyer Unavailable, add a no-show, and forfeit the downpayment. |
| Delivery rescheduled more than 24 hours before the original appointment | No rescheduling fee. The new schedule is sent to the relevant staff. |
| Delivery rescheduled 24 hours or less before the original appointment | Fee equals 50% of the original delivery fee. The new schedule waits for verified payment. |
| GCE causes a delivery delay | Confidential Informant reports it, and the Sales Manager informs the buyer. No buyer strike applies. |
| Cancellation after financing activation or financed delivery | The customer must acknowledge towing and recovery. This is not an ordinary unused-booking cancellation. |

The rescheduling window uses the original delivery appointment, not the most recently changed appointment. At exactly 24 hours, the current code applies the fee.

The downpayment deadline is separate from the seven-day review period. Delivery currently sets its payment deadline three working days after terms are confirmed.

Sources: [timing rules](src/lib/transactions/buy-flow.ts), [cancellation cutoff](src/lib/transactions/state-machine.ts#L152), [buyer cancellation](src/app/(customer)/my-transactions/actions.ts#L1472), and [buyer rescheduling](src/app/(customer)/my-transactions/actions.ts#L987).

## 7. Differences that need attention

Do not treat older process text, UI wording, and current code as identical. The following differences affect how this guide must be read.

| Topic | Intended or older wording | Current local implementation |
| --- | --- | --- |
| Purchase ceiling | The older process calls it the lowest negotiating price. | The app enforces a maximum purchase price. |
| Declared defects versus hidden defects | T10 allows accepted declared defects to proceed to payment and reconditioning. | Inspection exposes only No Issues and Issue Found. Issue Found requires the issue-report and revised-price route before payment clearance. |
| Cash buying | T10 emphasizes Financing and Bank Transfer. | Cash remains supported in buyer forms, rules, and staff payment actions. |
| Delivery team | The older process includes a Mechanic. | Current delivery assignment uses Confidential Informant and Head Security. |
| Financed sale completion | The older process marks Sold when financing starts. Some code comments and notifications still say this. | The completion action blocks Sold until every installment is paid or waived, matching T10's later completion rule. |
| Financing markup | The customer Buying Guide states a fixed 10%. | The financing calculation reads a configurable markup. |
| GCE Visit financing deadline | A code comment says two to three working days. | The Purchase Claim action adds three calendar days. Delivery uses a working-day calculation instead. |
| Showroom publication | T10 describes a separate posting step after CEO approval. | The current price-approval action publishes an approved selling price immediately. |

The current fund-return action permits the original requester to record returned funds. For a GCE Visit, this permits the Marketing Specialist to account for the return.

These findings describe the inspected files only. They do not mean that a live website test reproduced each difference.

Sources: [original process](docs/DOCUMENTS/GCE_Process_Flows.md), [T10](docs/tasks/T10.md), [inspection actions](src/app/(staff)/field-cases/sell-inspection-actions.ts), [sale completion](src/app/(staff)/transactions/actions.ts#L161), [financing actions](src/app/(staff)/transactions/financing-actions.ts), [Buying Guide](src/app/(customer)/buying-requirements/page.tsx), and [price approval](src/app/(staff)/vehicles/actions.ts#L298).

## 8. Final completion requirements

For selling to GCE, completion means that the vehicle is cleared and the seller is paid. Listing preparation or repairs can continue afterward.

For a buyer's full-payment purchase, staff must finish document verification, payment verification, required signing, and papers handover. Delivery must also reach its required completion status.

For financing, vehicle release does not mean the debt is settled. The vehicle remains unavailable to other buyers while financing is active, and Sold waits for settled installments.

When staff finalize a buyer sale, the vehicle becomes Sold and leaves the available listings. Other open buyer requests for that vehicle are closed and their customers are notified.

Sources: [seller payment completion](supabase/migrations/20261111150000_t10_seller_paid_by_requester.sql), [buyer completion gates](src/app/(staff)/transactions/actions.ts#L161), and [sale finalization](src/lib/transactions/buy-flow-server.ts#L139).
