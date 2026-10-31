# GCE Vehicle Marketplace

## Buying &amp; Selling Transaction Process Flows

*Internal Process Documentation — Prepared October 2026*

---

## Contents

1. [Scenario 1: Maria buys with cash and visits GCE](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-1-maria-buys-with-cash-and-visits-gce)
2. [Scenario 2: Two buyers want the same car and meet halfway](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-2-two-buyers-want-the-same-car-and-meet-halfway)
3. [Scenario 3: Maria buys with cash and has the car delivered](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-3-maria-buys-with-cash-and-has-the-car-delivered)
4. [Scenario 4: Maria buys in monthly instalments and visits GCE](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-4-maria-buys-in-monthly-instalments-and-visits-gce)
5. [Scenario 5: Maria buys in monthly instalments, visits GCE, and pays the upfront amount through PayMongo](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-5-maria-buys-in-monthly-instalments-visits-gce-and-pays-the-upfront-amount-through-paymongo)
6. [Scenario 8: Maria buys in monthly instalments and meets halfway in Calabarzon](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-8-maria-buys-in-monthly-instalments-and-meets-halfway-in-calabarzon)
7. [Scenario 9: Maria buys in monthly instalments and has the car delivered](https://claude.ai/chat/953cd0a5-5880-4cc0-97bb-c86bb31c6554#scenario-9-maria-buys-in-monthly-instalments-and-has-the-car-delivered)

---

> **Note:** I updated all five workflows with your changes, and the PDF hasn't been rebuilt yet. The "Check and Confirm" step was missing the part where the Sales Manager opens each image to look at it, and can ask for a resubmission if it's unclear. That is now in every buying scenario.

## Rules that apply to every scenario

*These go on the first page of the PDF.*

- **Schedules:** Only on the hour, 9 AM to 9 PM, Monday to Saturday. Anything earlier, later, or on a Sunday is refused.
- **Images:** Every submitted image is clickable and opens in a larger view. The Sales Manager can ask the buyer (or the seller, on the selling side) to resubmit an image.
- **Papers release (every buying flow):** The Sales Manager requests release of the vehicle papers from the CI, the CI approves, and only then can the Sales Manager click **Mark as Sold**.
- **Selling:** When GCE buys a car from a seller, the CI keeps the car's papers.

---

## Scenario 1: Maria buys with cash and visits GCE

Maria picks a car, books a visit, pays in cash at GCE, and receives the papers. The Sales Manager then marks the car as sold.

### 1 · Buyer (Maria) · `customer@gce.local`

- Open the Showroom, open a car, and click **Buy Now**.
- Upload Valid ID #1, Valid ID #2 (choose the ID type for each), and Proof of Billing.
- Choose **Cash** and **Visit GCE**. Pick a date and time on the hour, 9 AM to 9 PM, Monday to Saturday. No location field should show.
- Click **Save Details**, then **Submit Request**.

**You should see:** "Request sent. The Sales Manager will review it within 7 days." The time is reserved as a 1-hour block.

**Also try:** Pick a slot already taken. You should see "That visit slot is already taken. Choose another time." Then pick 10:30, 8:00 AM, 10:00 PM, or a Sunday. Each should show "Please choose a time on the hour, between 9 AM and 9 PM, Monday to Saturday."

### 2 · Sales Manager · `sales_manager@gce.local`

- Open **Transactions** and click Maria's request. Status should be **Waiting for Sales Manager Review**.
- Click each image (Valid ID #1, Valid ID #2, Proof of Billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing.
- Click **Approve**.

**You should see:** Maria is notified and the request is **Approved**.

**Also try:**

- Ask Maria to resubmit one image. Maria is notified and can upload a new one. The request cannot be approved until the new image is confirmed.
- Approve before all three documents are confirmed. It should be refused.
- Reject. The reserved 1-hour block should be freed.
- Leave a request for 7 days. Status should become **Delayed, Needs Action**, with the time still reserved.

### 3 · Buyer (Maria) and Sales Manager, visit day

- Maria visits GCE at her reserved time.
- The Sales Manager shows her the car. Maria says yes.

**You should see:** The request is ready for payment.

**Also try:** Maria says no and the Sales Manager clicks **Buyer Declined**. Status should be **Buyer Said No**, the car stays in the Showroom, and her time block is freed.

### 4 · Sales Manager · `sales_manager@gce.local`

- Enter the amount, choose **Cash** and **Paid in Full**, and click **Record Cash Received**.

**You should see:** "Payment recorded." Status: **Cash Received, Waiting for Accountant Check**.

### 5 · Head Accountant · `head_accountant@gce.local`

- Open the payment, confirm the money was received and the amount is correct, and approve it.

**You should see:** Status **Payment Received and Checked**.

**Also try:** Mark the amount as wrong. It should go back to the Sales Manager to correct, and the papers step should not start.

### 6 · Sales Manager and Confidential Informant · `sales_manager@gce.local`, `confidential_informant@gce.local`

- Sales Manager: request release of the vehicle papers from the CI.
- CI: approve the request and hand over the papers.
- Sales Manager: receive the papers.

**You should see:** Statuses **Papers Requested**, then **Papers Handed Over**, then **Papers Received**.

### 7 · Sales Manager · `sales_manager@gce.local`

- Click **Mark as Sold**.

**You should see:** The car is **Sold** and removed from the Showroom, and any other request for that car is closed. The sale appears under **Completed Sales** on the Head Accountant's side with its amount.

**Also try:** Click **Mark as Sold** before the CI has approved the papers release. It should be refused.

---

## Scenario 2: Two buyers want the same car and meet halfway

### 1 · Buyer (Maria)

- Open a car and click **Buy Now**. Upload Valid ID #1, Valid ID #2, and Proof of Billing.
- Choose **Cash** and **Meet Halfway (Calabarzon)**. Pick a date and time on the hour, 9 AM to 9 PM, Monday to Saturday.
- Type the meetup place (for example, SM Calamba parking) in **Location**.
- Tick "I have reviewed this car's condition and intend to purchase it as shown."
- Click **Save Details**, then **Submit Request**.

**You should see:** "Request sent." Her request becomes **Active**.

**Also try:**

- Untick the condition box and click **Save Details**. It should be refused.
- Pick 8:00 AM, 10:00 PM, or a Sunday. It should be refused.

### 2 · Second buyer

- Send a request for the same car, using the same steps as step 1.

**You should see:** "Another buyer's request is in progress, so yours is On Hold. We'll notify you." The request stays visible in the buyer's transaction list.

### 3 · Sales Manager

- Open Maria's request and check the **Buyers for this car** panel. Status should be **Waiting for Sales Manager Review**.
- Click each image (Valid ID #1, Valid ID #2, Proof of Billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing.
- Click **Approve**.
- After approving, assign a Confidential Informant and a Mechanic to the Field Case.

**You should see:** Maria is notified and the On Hold buyer stays on hold. The Field Case is created and received by the assigned Mechanic and Confidential Informant.

**Also try:**

- Ask Maria to resubmit one image. She is notified and can upload a new one. The request cannot be approved until the new image is confirmed.
- Reject. **Make Active**, which was greyed out, should now be available so you can pick the next On Hold buyer.
- Cancel a request less than 5 hours before the meetup. You should see "Cancellation is only allowed 5 hours or more before the scheduled time."
- Try to finish the approval without choosing a Mechanic or a Confidential Informant. It should be refused.

### 4 · Confidential Informant, before meetup day

- Mechanic and CI: open the Field Case and click **Receive Field Case**.
- CI only: release the vehicle papers (OR/CR, Deed of Sale, and related documents) and record the release under the CI's account.
- CI: bring the papers before the meetup day.

**You should see:** Status **Papers Released to CI**. The Field Case is ready for meetup day.

**Also try:**

- Meetup day cannot proceed until the CI has recorded the papers as released and brought them.
- The Mechanic tries to release or record the papers. It should be refused.

### 5 · Mechanic and CI, meetup day

- Open the Field Case. The vehicle papers are already with the CI.
- Meet Maria at the agreed location. Maria inspects the car and says yes.

**You should see:** The Field Case is open and Maria's purchase can continue.

**Also try:**

- Maria does not show up. After the waiting time, the Sales Manager clicks **Buyer didn't show up**. Status becomes **Buyer Didn't Show Up** and counts as one no-show (after 2 no-shows, the buyer is limited to Visit GCE). The CI records the papers back under his account, and the Sales Manager picks the next On Hold buyer with **Make Active**.
- Maria says no. The Sales Manager chooses **Declined, Legit** (no penalty) or **Declined, Not Legit** (one strike, limited to Visit GCE). Status becomes **Buyer Said No** and the papers go back under the CI's account.

### 6 · Mechanic and CI, contract signing and payment

- Maria reads the contract for the car she is buying and signs it at the meetup. She gets a copy of the signed contract.
- Mechanic and CI: each keeps a signed copy of the contract and records on the Field Case that they are holding it.
- Receive the cash from Maria.
- CI: hand the vehicle papers to Maria and record the release on his account.
- Report the payment to the Sales Manager.

**You should see:** The Field Case shows **Contract Signed**, with the Mechanic and the CI each listed as holding a signed copy. The Sales Manager is told the cash was received. Status **Papers Handed Over**.

**Also try:**

- Record the cash payment before Maria has signed. It should not be allowed.
- The CI hands over the papers before the contract is signed or the cash is received. It should be refused.
- Only one of the two records keeping the signed contract. The Field Case should not show the contract as fully kept, and the Sales Manager should be told which one is missing.
- The Mechanic tries to hand over the papers. It should be refused.

### 7 · Sales Manager

- Enter the amount, choose **Cash** and **Paid in Full**, and click **Record Cash Received**.

**You should see:** Status **Cash Received, Waiting for Accountant Check**.

### 8 · Head Accountant

- Check the payment and approve it.

**You should see:** Status **Payment Received and Checked**.

**Also try:** Mark the amount as wrong. It should go back to the Sales Manager, and the car cannot be marked as sold.

### 9 · Sales Manager

- Click **Mark as Sold**.

**You should see:** The car is **Sold** and removed from the Showroom, and every On Hold request is cancelled with those buyers notified that the car was sold. The sale appears under **Completed Sales** with the balance due at ₱0.

**Also try:**

- Click **Mark as Sold** before the CI has recorded the papers as handed over. It should be refused.
- Click **Mark as Sold** before both the Mechanic and the CI have recorded keeping the signed contract. It should be refused.

---

## Scenario 3: Maria buys with cash and has the car delivered

Maria asks for delivery. GCE sets a delivery fee and a downpayment, Maria pays both through PayMongo, and the CI releases the vehicle papers before delivery. A team drives the car over. If Maria wants the car, she signs the contract, and she and the CI each keep a copy. She then pays the balance in cash on arrival and receives the papers.

### 1 · Buyer (Maria)

- Open a car and click **Buy Now**. Upload Valid ID #1, Valid ID #2, and Proof of Billing.
- Choose **Cash** and **Delivery**. Pick a date and time on the hour, 9 AM to 9 PM, Monday to Saturday, at least 7 days after today. Type the delivery address.
- Read the delivery terms notice and click **I agree**.
- Tick "I have reviewed this car's condition and intend to purchase it as shown."
- Click **Save Details**, then **Submit Request**.

**You should see:** The delivery terms notice ("Delivery has a delivery fee and a downpayment. The downpayment and fee are paid first through PayMongo. The rest is paid in cash when the car arrives."), then "Request sent."

**Also try:**

- Pick a date sooner than 7 days. You should see "Delivery must be scheduled at least 7 days after your request date."
- Pick 8:00 AM, 10:00 PM, or a Sunday (at least 7 days out). It should be refused.
- On another test, do not click **I agree**. The request should not reach the Sales Manager.

### 2 · Sales Manager *(updated)*

- Open the Active request. Status should be **Waiting for Sales Manager Review**.
- Click each image (Valid ID #1, Valid ID #2, Proof of Billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing. Click **Approve**.
- Enter the **Delivery fee (₱)** and the **Downpayment (₱)**.

**You should see:** Maria gets a breakdown with the delivery fee, downpayment, total to pay now through PayMongo, remaining cash balance on arrival, her requested delivery date, and a 3-working-day payment deadline.

**Also try:**

- Ask Maria to resubmit one image. She is notified and can upload a new one. The request cannot be approved until the new image is confirmed.
- Leave the Delivery fee or Downpayment empty. It should not be sent.
- On another test, click **Reject: not serviceable**. You should see "Request closed: not serviceable."

### 3 · Buyer (Maria)

- Click **Pay**. PayMongo opens. Pay the delivery fee and downpayment by bank transfer.

**You should see:** On the Head Accountant's side, each payment row is labeled **Delivery Fee** or **Downpayment**, with the total cash balance Maria must pay on arrival.

**Also try:** Do not pay within 3 working days. The request should be cancelled, the downpayment forfeited, and the Sales Manager picks the next On Hold buyer.

### 4 · Head Accountant

- Confirm the money has entered the GCE account and that you have the PayMongo receipt. Click **Approve Payment**.

**You should see:** The Sales Manager is notified that the payment was approved.

**Also try:** Do not approve (money not in, or receipt missing). **Mark Dispatched** should be refused later.

### 5 · Sales Manager, then Confidential Informant

- Sales Manager: choose the team (a CI, a Mechanic, and a Head Security), then click **Create Delivery Field Case**.
- CI: before the delivery, release the vehicle papers (OR/CR, Deed of Sale, and related documents) and record the release under the CI's account. The CI brings the papers on delivery day.

**You should see:** A Field Case with the transaction, buyer, vehicle, address, payment, scheduled delivery, and the vehicle papers. After the CI releases them, status **Papers Released to CI**.

**Also try:**

- Click **Reschedule** with a date sooner than 7 days after the request date. It should be refused.
- Reschedule to a time outside 9 AM to 9 PM, or a Sunday. It should be refused.
- Reschedule with a valid date and you should see "Delivery rescheduled." If there is a rescheduling fee, it should be sent to Maria to pay through PayMongo and approved by the Head Accountant.
- Head Security clicks **Mark Dispatched** before the CI has recorded the papers as released. It should be refused.
- The Mechanic or Head Security tries to release or record the papers. It should be refused.

### 6 · Head Security

- Open the delivery field case.
- Click **Mark Dispatched**, **Mark In Transit**, **Mark Arriving**, and **Mark Delivered** in turn.

**You should see:** Maria sees each step on her request page.

**Also try:**

- GCE is late. The CI types a note under **Report a delay** and clicks **Report delay**, and the Sales Manager clicks **Tell the buyer about the delay**. Maria should see a **Running late** note with no penalty.
- Maria is not there. Status becomes **Buyer Unavailable**, counts as one no-show, the downpayment is kept, and the CI records the papers back under his account.

### 7 · Buyer (Maria), on arrival

- Inspect the car in person and say yes.

**You should see:** The delivery continues to contract signing and payment.

**Also try:** Maria says no. The Sales Manager chooses **Declined, Legit** (no strike, downpayment refunded within 2 to 3 working days, refund shown on the Head Accountant's Finance page) or **Declined, Not Legit** (one strike, limited to Visit GCE, downpayment kept). Status becomes **Buyer Said No**, the car stays in the Showroom, and the papers go back under the CI's account.

### 8 · Delivery team

- Maria reads the contract for the car and signs it.
- Maria and the CI each keep a signed copy. The CI records on the Field Case that the contract is signed and kept.
- Maria pays the remaining cash balance to the delivery team.
- CI: hand the vehicle papers to Maria and record the release on his account.
- Report the payment to the Sales Manager.

**You should see:** The Field Case shows **Contract Signed**, with Maria and the CI each holding a copy. The Sales Manager is told the cash balance was received. Status **Papers Handed Over**.

**Also try:**

- Record the cash payment before Maria has signed. It should not be allowed.
- The CI hands over the papers before the contract is signed or the cash is received. It should be refused.
- The Mechanic or Head Security tries to hand over the papers. It should be refused.

### 9 · Sales Manager

- Enter the amount, choose **Cash** and **Balance on Delivery**, and click **Record Cash Received**.

**You should see:** Status **Cash Received, Waiting for Accountant Check**.

### 10 · Head Accountant

- Check the payment and approve it.

**You should see:** Status **Payment Received and Checked**.

**Also try:** Mark the amount as wrong. It should go back to the Sales Manager, and the car cannot be marked as sold.

### 11 · Sales Manager

- Click **Mark as Sold**.

**You should see:** The car is **Sold** and removed from the Showroom, and every On Hold request is cancelled with those buyers notified. The sale appears under **Completed Sales** with the downpayment and the delivery fee. The delivery fee is not counted toward the car price.

**Also try:**

- Click **Mark as Sold** before the status is **Delivered**. It should be refused.
- Click **Mark as Sold** before the CI has recorded the papers as handed over. It should be refused.
- Click **Mark as Sold** before the contract is recorded as signed and kept. It should be refused.

---

## Scenario 4: Maria buys in monthly instalments and visits GCE

Maria asks to pay in instalments. The Sales Manager explains GCE's financing offers in the website chat and agrees the plan with her. The Head Accountant and CEO approve it, Maria accepts and visits, and the Sales Manager prepares a contract. The Head Accountant approves and stores it, and Maria signs it. She then pays the upfront amount, the CI releases the papers, and the sale is completed.

### 1 · Customer (Maria) · `customer@gce.local`

- Open a test car, click **Buy Now**, and upload the 2 IDs and proof of billing.
- Choose **Financing** and **GCE Visit**. No time is needed yet.
- Tick the condition box and click **Save Details**.
- Click **Submit Request**.

**You should see:** "Request sent."

> **To be confirmed:** A notice currently appears before the request is sent: "The final price may vary depending on your payment duration. The longer or shorter you take to pay, the more the price can change." GCE does not know what this "Final price" notice is for. Decide whether to keep or remove it. If it stays, Maria must acknowledge it first, and closing it without acknowledging should stop the request from being sent.

### 2 · Sales Manager · `sales_manager@gce.local`

- Open the request.
- Click each image (the 2 IDs and the proof of billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing.
- Before setting any terms, open the website chat with Maria. Ask how long she wants her instalment period to be, and explain GCE's financing offers, since she may not know them.

**You should see:** The chat with Maria is open on the request, and the Sales Manager can reply to her.

**Also try:** Ask Maria to resubmit one image. She is notified and can upload a new one. The terms cannot be sent until the new image is confirmed.

### 3 · Sales Manager · `sales_manager@gce.local`

- After Maria agrees to the plan, click **Approve**.
- Fill in **Payment duration (months)** (12), **Vehicle total price (₱)** (500000), **Initial Downpayment (₱)** (100000), **Monthly payment**, **First installment due**, and the **Missed payment policy**.
- Click **Send to Head Accountant**.

**You should see:** "Terms sent to the Head Accountant."

**Also try:** Leave a field empty, especially the Missed payment policy. It should not be sent.

### 4 · Head Accountant · `head_accountant@gce.local`

- Open the request and click **Approve**.

**You should see:** "Terms sent to the CEO."

**Also try:** Return for revision with a reason. It should send the terms back to the Sales Manager.

### 5 · CEO · `ceo@gce.local`

- Open the request and click **Confirm**.

**You should see:** "Financing confirmed; the buyer is notified."

### 6 · Customer (Maria) · `customer@gce.local`

- Open the request. Read **Your approved financing**.
- Pick a GCE visit (on the hour, 9 AM to 9 PM, Monday to Saturday) and click **Accept and book visit**.

**You should see:** "Visit booked. No payment is taken before you inspect the car."

**Also try:**

- **Don't proceed** should close the request with nothing paid.
- Pick a time like 10:25 AM. It should be refused with "Pick a future GCE visit slot on the hour."
- Pick 8:00 AM, 10:00 PM, or a Sunday. It should be refused.

### 7 · Sales Manager · `sales_manager@gce.local`

- After the visit, when Maria says she will buy the car, write the contract. Either type it or use a pre-made one.
- Save it on your account and send it for approval.

**You should see:** The contract is saved under the Sales Manager's account and is waiting for the Head Accountant's approval. *The exact message is still to be confirmed.*

### 8 · Head Accountant · `head_accountant@gce.local`

- Open the contract on the request, read it, and click **Approve**.

**You should see:** The contract is approved and stored on the request.

**Also try:** Return for revision with a reason. It should send the contract back to the Sales Manager. On another test, Maria should not be able to sign a contract that is not yet approved.

### 9 · Customer (Maria) · `customer@gce.local`

- Read the approved contract and sign it.

**You should see:** The contract shows as signed by Maria.

**Also try:** Try to record her payment before she has signed. It should not be allowed.

### 10 · Sales Manager · `sales_manager@gce.local`

- Click **Record Purchase Claim**.
- Record the upfront payment: 100000, Bank Transfer, for Downpayment.

**You should see:** "Purchase Claim recorded. The car is held for Maria and other interested buyers are told."

**Also try:** **Needs time: Potential Buyer** should leave the car available to others.

### 11 · Head Accountant · `head_accountant@gce.local`

- Open the request, click **Verify** on the payment (this is where he receives it), then **Complete financing agreement**.

**You should see:** "Financing account opened." The monthly schedule appears.

**Also try:** **Complete financing agreement** should not be offered until the downpayment is verified.

### 12 · Sales Manager and Confidential Informant · `sales_manager@gce.local`, `confidential_informant@gce.local`

- Sales Manager: request release of the vehicle papers from the CI.
- CI: approve the request and hand over the papers.
- Sales Manager: receive the papers.

**You should see:** Statuses **Papers Requested**, then **Papers Handed Over**, then **Papers Received**.

### 13 · Sales Manager · `sales_manager@gce.local`

- Click **Mark Sold to This Buyer**.

**You should see:** The sale completes and the request shows **In-House Financing — Active**. Maria's page shows ₱500,000 as Vehicle Price and ₱400,000 as Amount Financed.

**Also try:**

- Mark Sold should not work before the Head Accountant has verified the payment.
- Mark Sold should not work before the CI has approved the papers release.

### 14 · Head Accountant · `head_accountant@gce.local`

- Over the following months, record each monthly payment as paid on the request.

**You should see:** A missed month flags the account. From the 4th missed month, staff can start taking the car back. Ask the team if you want to see this without waiting months.

---

## Scenario 5: Maria buys in monthly instalments, visits GCE, and pays the upfront amount through PayMongo

Same as Scenario 4, except Maria pays the upfront amount herself on the website through PayMongo. The payment goes to the Head Accountant to verify, the CI releases the papers, and then the Sales Manager marks the car as sold.

### 1 · Customer (Maria) · `customer@gce.local`

- Open a test car, click **Buy Now**, and upload the 2 IDs and proof of billing.
- Choose **Financing** and **GCE Visit**. No time is needed yet.
- Tick the condition box and click **Save Details**.
- Click **Submit Request**.

**You should see:** "Request sent."

> **To be confirmed:** Same "Final price" notice question as Scenario 4, step 1.

### 2 · Sales Manager · `sales_manager@gce.local`

- Open the request.
- Click each image (the 2 IDs and the proof of billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing.
- Open the website chat with Maria. Ask how long she wants her instalment period to be, and explain GCE's financing offers.

**You should see:** The chat with Maria is open on the request, and the Sales Manager can reply to her.

**Also try:** Ask Maria to resubmit one image. She is notified and can upload a new one. The terms cannot be sent until the new image is confirmed.

### 3 · Sales Manager · `sales_manager@gce.local`

- After Maria agrees to the plan, click **Approve**.
- Fill in **Payment duration (months)** (12), **Vehicle total price (₱)** (500000), **Initial Downpayment (₱)** (100000), **Monthly payment**, **First installment due**, and the **Missed payment policy**.
- Click **Send to Head Accountant**.

**You should see:** "Terms sent to the Head Accountant."

**Also try:** Leave a field empty, especially the Missed payment policy. It should not be sent.

### 4 · Head Accountant · `head_accountant@gce.local`

- Open the request and click **Approve**.

**You should see:** "Terms sent to the CEO."

**Also try:** Return for revision with a reason. It should send the terms back to the Sales Manager.

### 5 · CEO · `ceo@gce.local`

- Open the request and click **Confirm**.

**You should see:** "Financing confirmed; the buyer is notified."

### 6 · Customer (Maria) · `customer@gce.local`

- Open the request. Read **Your approved financing**.
- Pick a GCE visit (on the hour, 9 AM to 9 PM, Monday to Saturday) and click **Accept and book visit**.

**You should see:** "Visit booked. No payment is taken before you inspect the car."

**Also try:**

- **Don't proceed** should close the request with nothing paid.
- Pick a time like 10:25 AM. It should be refused with "Pick a future GCE visit slot on the hour."
- Pick 8:00 AM, 10:00 PM, or a Sunday. It should be refused.

### 7 · Sales Manager · `sales_manager@gce.local`

- After the visit, when Maria says she will buy the car, write the contract (typed or pre-made).
- Save it on your account and send it for approval.

**You should see:** The contract is saved under the Sales Manager's account and is waiting for the Head Accountant's approval.

### 8 · Head Accountant · `head_accountant@gce.local`

- Open the contract on the request, read it, and click **Approve**.

**You should see:** The contract is approved and stored on the request.

**Also try:** Return for revision with a reason. It should send the contract back to the Sales Manager. On another test, Maria should not be able to sign a contract that is not yet approved.

### 9 · Customer (Maria) · `customer@gce.local`

- Read the approved contract and sign it.

**You should see:** The contract shows as signed by Maria.

**Also try:** Try to pay before signing. It should not be allowed.

### 10 · Sales Manager · `sales_manager@gce.local`

- Click **Record Purchase Claim**. Do not record a payment by hand.

**You should see:** "Purchase Claim recorded. The car is held for Maria and other interested buyers are told." No payment is recorded yet.

**Also try:** **Needs time: Potential Buyer** should leave the car available to others.

### 11 · Customer (Maria) · `customer@gce.local`

- Open the request and click **Pay**.
- On the website, pay the upfront amount (100000, for Downpayment) through PayMongo.

**You should see:** Maria's page shows her payment as sent and waiting for the Head Accountant.

**Also try:** Do not pay. The Sales Manager should not be able to mark the car as sold.

### 12 · Head Accountant · `head_accountant@gce.local`

- Open the request. The PayMongo payment should already be listed as a Downpayment.
- Click **Verify** on the payment, then **Complete financing agreement**.

**You should see:** "Financing account opened." The monthly schedule appears.

**Also try:** **Complete financing agreement** should not be offered until the PayMongo payment is verified.

### 13 · Sales Manager and Confidential Informant · `sales_manager@gce.local`, `confidential_informant@gce.local`

- Sales Manager: request release of the vehicle papers from the CI.
- CI: approve the request and hand over the papers.
- Sales Manager: receive the papers.

**You should see:** Statuses **Papers Requested**, then **Papers Handed Over**, then **Papers Received**.

### 14 · Sales Manager · `sales_manager@gce.local`

- Click **Mark Sold to This Buyer**.

**You should see:** The sale completes and the request shows **In-House Financing — Active**. Maria's page shows ₱500,000 as Vehicle Price and ₱400,000 as Amount Financed.

**Also try:**

- Mark Sold should not work before the Head Accountant has verified the PayMongo payment.
- Mark Sold should not work before the CI has approved the papers release.

### 15 · Head Accountant · `head_accountant@gce.local`

- Over the following months, record each monthly payment as paid on the request.

**You should see:** A missed month flags the account. From the 4th missed month, staff can start taking the car back.

---

## Scenario 8: Maria buys in monthly instalments and meets halfway in Calabarzon

Maria asks to pay in instalments. The Sales Manager explains GCE's financing offers in the website chat and agrees the plan with her. The Head Accountant and CEO approve it, and Maria accepts and books a halfway meet-up in Calabarzon. The Sales Manager prepares the contract and the Head Accountant approves it. The Sales Manager then assigns a Confidential Informant (CI) and a Mechanic, and the CI releases the vehicle papers before the meet-up. At the meet-up, if Maria wants the car, she signs the contract, and she and the CI each keep a signed copy. The CI hands her the papers and reports the signing, the Head Accountant completes the financing agreement, and the sale is completed. No downpayment is taken.

### 1 · Customer (Maria) · `customer@gce.local`

- Open a test car, click **Buy Now**, and upload the 2 IDs and proof of billing.
- Choose **Financing** and **CALABARZON Meet-up**. No date or time is needed yet.
- Choose the payment term (1, 2, 3 or 5 years). Maria sees the monthly payment for that term.
- Tick the condition box, click **Save Details**, then **Submit Request**.

**You should see:** "Request sent."

> **To be confirmed:** Keep or remove the "Final price may vary" notice, as in Scenario 4.

### 2 · Sales Manager · `sales_manager@gce.local`

- Open the request and click each image to check it is clear and readable.
- If an image is unclear, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing.
- Open the website chat with Maria. Ask how long she wants her instalment period to be and explain GCE's financing offers.

**You should see:** The chat with Maria is open on the request, and the Sales Manager can reply.

### 3 · Sales Manager · `sales_manager@gce.local`

- After Maria agrees to the plan, click **Approve**.
- Fill in **Payment duration (months)**, **Vehicle total price (₱)**, **Monthly payment**, **First installment due**, and the **Missed payment policy**. There is no Initial Downpayment field.
- Click **Send to Head Accountant**.

**You should see:** "Terms sent to the Head Accountant."

**Also try:** Leave a field empty, especially the Missed payment policy. It should not be sent.

### 4 · Head Accountant · `head_accountant@gce.local`

- Open the request and click **Approve**.

**You should see:** "Terms sent to the CEO."

**Also try:** Return for revision with a reason. The terms go back to the Sales Manager.

### 5 · CEO · `ceo@gce.local`

- Open the request and click **Confirm**.

**You should see:** "Financing confirmed; the buyer is notified."

### 6 · Customer (Maria) · `customer@gce.local`

- Open the request and read **Your approved financing**.
- Fill in **Meet-up date and time** and **Meet-up location (Calabarzon)**, then click **Accept and book meet-up**.

**You should see:** "Meet-up booked. No payment is taken before you inspect the car."

**Also try:**

- **Don't proceed** closes the request with nothing paid.
- A location outside Calabarzon should be refused.
- A past date or time should be refused.

### 7 · Sales Manager · `sales_manager@gce.local`

- After Maria books the meet-up, write the contract (typed or pre-made). It states the contract length and that GCE will take back the vehicle if it is not paid for.
- Save it on your account, keep a copy, and send it for approval.

**You should see:** The contract is saved and is waiting for the Head Accountant's approval.

### 8 · Head Accountant · `head_accountant@gce.local`

- Open the contract, read it, and click **Approve**.

**You should see:** The contract is approved and stored on the request.

**Also try:** Return for revision with a reason. The Sales Manager should not be able to assign the CI and Mechanic until the contract is approved.

### 9 · Sales Manager, then Confidential Informant · `sales_manager@gce.local`, `confidential_informant@gce.local`, `mechanic@gce.local` *(updated)*

- Sales Manager: because the buyer chose CALABARZON Meet-up, open the booked request, assign a Confidential Informant and a Mechanic, and send the command: "You have a client to meet halfway," with the vehicle, buyer, date, time and Calabarzon location.
- CI and Mechanic: open the notice and accept it.
- CI only: before the meet-up, release the vehicle papers (OR/CR, Deed of Sale, and related documents) and record the release under the CI's account.
- CI: bring the vehicle, the papers and the printed contract to the meet-up. Maria can track the status and progress of the vehicle.
- Optional: the Sales Manager opens **Field Cases** and logs the **Buyer meet-up visit**.

**You should see:** "Confidential Informant notified." The request shows the CI and Mechanic assigned. After the CI releases the papers, status **Papers Released to CI**. The CI sees the meet-up details.

**Also try:**

- The CI should not receive the command before Maria has booked the meet-up. Without a booking, the Sales Manager cannot send it.
- Try to send the command without choosing a CI or a Mechanic. It should be refused.
- The meet-up cannot go ahead until the CI has recorded the papers as released.
- The Mechanic tries to release or record the papers. It should be refused.

### 10 · Confidential Informant and Mechanic, at the meet-up · `confidential_informant@gce.local`, `mechanic@gce.local` *(updated)*

- Meet Maria at the agreed location. Notify GCE that the buyer has been met.
- Maria inspects the car and says yes.

**You should see:** The request shows **Buyer Met**. The meet-up continues to contract signing.

**Also try:**

- If the meet-up does not happen, the buyer is flagged unless there was a valid reason. The CI records the papers back under his account.
- Maria says no. The papers go back under the CI's account and the request follows the Scenario 4 rules for saying no.
- The no-show and cancelling rules from Scenario 4 also apply.

### 11 · Customer (Maria) and CI, contract signing · `customer@gce.local`, `confidential_informant@gce.local` *(updated)*

- Maria reads the approved contract and signs it.
- Maria and the CI each keep a signed copy. The CI records on the request that the contract is signed and kept.
- CI: hand the vehicle papers to Maria and record the release on his account.
- CI: report that the buyer signed the contract.

**You should see:** The request shows **Contract Signed (reported by CI)**, with Maria and the CI each holding a copy. Status **Papers Handed Over**. The Head Accountant is notified: "The buyer has signed the contract."

**Also try:**

- The CI should not be able to report the signing before **Buyer Met** is recorded.
- The CI hands over the papers before the contract is signed. It should be refused.
- Maria should not be able to sign a contract that is not yet approved.
- The Mechanic tries to hand over the papers. It should be refused.

### 12 · Head Accountant · `head_accountant@gce.local`

- Open the notification, then click **Complete financing agreement**.

**You should see:** "Financing account opened." The monthly schedule appears.

**Also try:** **Complete financing agreement** should not be offered until the CI has reported that the buyer signed.

### 13 · Sales Manager · `sales_manager@gce.local`

- Click **Mark Sold to This Buyer**.

**You should see:** The sale completes and the request shows **In-House Financing — Active**. Maria's page shows ₱500,000 as both Vehicle Price and Amount Financed.

**Also try:**

- Mark Sold should not work before the financing account is open.
- Mark Sold should not work before the CI has recorded the papers as handed over.
- Mark Sold should not work before the contract is recorded as signed and kept.

### 14 · Head Accountant · `head_accountant@gce.local`

- Over the following months, record each monthly payment as paid.

**You should see:** A missed month flags the account. From the 4th missed month, staff can start taking the car back.

### Please confirm

- I read "both of them" as Maria and the CI. If you meant the Mechanic and the CI, step 11 should say so.
- The CI now hands the papers to Maria at the meet-up, right after she signs, which is before the Head Accountant completes the financing agreement in step 12. If you want the papers held back until the financing account is open, the handover would need to move after step 12.
- The Mechanic only receives the assignment and attends the meet-up. He has no papers role.

---

## Scenario 9: Maria buys in monthly instalments and has the car delivered

Maria asks for delivery and pays in instalments. The Sales Manager agrees the plan with her in chat. GCE sets a delivery fee and a downpayment, and the Head Accountant and CEO approve the terms. Maria pays the fee and downpayment through PayMongo, and the CI releases the vehicle papers before delivery. A team drives the car over. If Maria wants the car, she signs the contract, and she and the CI each keep a copy. The CI hands her the papers, and the rest is paid in monthly instalments.

### 1 · Buyer (Maria)

- Open a car and click **Buy Now**. Upload Valid ID #1, Valid ID #2, and Proof of Billing.
- Choose **Financing** and **Delivery**. Pick a date and time on the hour, 9 AM to 9 PM, Monday to Saturday, at least 7 days after today. Type the delivery address.
- Read the delivery terms notice and click **I agree**.
- Tick "I have reviewed this car's condition and intend to purchase it as shown."
- Click **Save Details**, then **Submit Request**.

**You should see:** The delivery terms notice ("Delivery has a delivery fee and a downpayment. The downpayment and fee are paid first through PayMongo. The rest is paid in monthly instalments."), then "Request sent."

**Also try:**

- Pick a date sooner than 7 days. You should see "Delivery must be scheduled at least 7 days after your request date."
- Pick 8:00 AM, 10:00 PM, or a Sunday (at least 7 days out). It should be refused.
- On another test, do not click **I agree**. The request should not reach the Sales Manager.

### 2 · Sales Manager *(updated)*

- Open the Active request. Status should be **Waiting for Sales Manager Review**.
- Click each image (Valid ID #1, Valid ID #2, Proof of Billing) to open it in a larger view. Check that it is clear and readable.
- If an image is unclear or not acceptable, ask Maria to resubmit it and tell her what to fix.
- When all three are clear, click **Check and Confirm** on both IDs and the Proof of Billing. Click **Approve**.
- Open the website chat with Maria. Ask how long she wants her instalment period to be and explain GCE's financing offers.

**You should see:** The chat with Maria is open on the request, and the Sales Manager can reply.

**Also try:**

- Ask Maria to resubmit one image. She is notified and can upload a new one. The request cannot be approved until the new image is confirmed.
- On another test, click **Reject: not serviceable**. You should see "Request closed: not serviceable."

### 3 · Sales Manager *(new)*

- After Maria agrees to the plan, enter the **Delivery fee (₱)** and the **Downpayment (₱)** (for example, 100000).
- Fill in **Payment duration (months)**, **Vehicle total price (₱)** (for example, 500000), **Monthly payment**, **First installment due**, and the **Missed payment policy**.
- Click **Send to Head Accountant**.

**You should see:** "Terms sent to the Head Accountant."

**Also try:** Leave the Delivery fee, Downpayment or Missed payment policy empty. It should not be sent.

### 4 · Head Accountant *(new)*

- Open the request and click **Approve**.

**You should see:** "Terms sent to the CEO."

**Also try:** Return for revision with a reason. The terms go back to the Sales Manager.

### 5 · CEO *(new)*

- Open the request and click **Confirm**.

**You should see:** "Financing confirmed; the buyer is notified." Maria gets a breakdown with the delivery fee, downpayment, total to pay now through PayMongo, amount financed, monthly payment, her requested delivery date, and a 3-working-day payment deadline.

### 6 · Buyer (Maria)

- Click **Pay**. PayMongo opens. Pay the delivery fee and downpayment by bank transfer.

**You should see:** On the Head Accountant's side, each payment row is labeled **Delivery Fee** or **Downpayment**.

**Also try:** Do not pay within 3 working days. The request should be cancelled, the downpayment forfeited, and the Sales Manager picks the next On Hold buyer.

### 7 · Head Accountant

- Confirm the money has entered the GCE account and that you have the PayMongo receipt. Click **Approve Payment**.

**You should see:** The Sales Manager is notified that the payment was approved.

**Also try:** Do not approve (money not in, or receipt missing). **Mark Dispatched** should be refused later.

### 8 · Sales Manager, then Confidential Informant

- Sales Manager: choose the team (a CI, a Mechanic, and a Head Security), then click **Create Delivery Field Case**.
- CI: before the delivery, release the vehicle papers (OR/CR, Deed of Sale, and related documents) and record the release under the CI's account. The CI brings the papers and the printed contract on delivery day.

**You should see:** A Field Case with the transaction, buyer, vehicle, address, payment, scheduled delivery, and the vehicle papers. After the CI releases them, status **Papers Released to CI**.

**Also try:**

- Click **Reschedule** with a date sooner than 7 days after the request date. It should be refused.
- Reschedule to a time outside 9 AM to 9 PM, or a Sunday. It should be refused.
- Reschedule with a valid date and you should see "Delivery rescheduled." If there is a rescheduling fee, it should be sent to Maria to pay through PayMongo and approved by the Head Accountant.
- Head Security clicks **Mark Dispatched** before the CI has recorded the papers as released. It should be refused.
- The Mechanic or Head Security tries to release or record the papers. It should be refused.

### 9 · Head Security

- Open the delivery field case.
- Click **Mark Dispatched**, **Mark In Transit**, **Mark Arriving**, and **Mark Delivered** in turn.

**You should see:** Maria sees each step on her request page.

**Also try:**

- GCE is late. The CI types a note under **Report a delay** and clicks **Report delay**, and the Sales Manager clicks **Tell the buyer about the delay**. Maria should see a **Running late** note with no penalty.
- Maria is not there. Status becomes **Buyer Unavailable**, counts as one no-show, the downpayment is kept, and the CI records the papers back under his account.

### 10 · Buyer (Maria), on arrival

- Inspect the car in person and say yes.

**You should see:** The delivery continues to contract signing.

**Also try:** Maria says no. The Sales Manager chooses **Declined, Legit** (no strike, downpayment refunded within 2 to 3 working days, refund shown on the Head Accountant's Finance page) or **Declined, Not Legit** (one strike, limited to Visit GCE, downpayment kept). Status becomes **Buyer Said No**, the car stays in the Showroom, and the papers go back under the CI's account.

### 11 · Delivery team *(updated)*

- Maria reads the contract for the car and signs it.
- Maria and the CI each keep a signed copy. The CI records on the Field Case that the contract is signed and kept.
- CI: hand the vehicle papers to Maria and record the release on his account.
- CI: report to the Sales Manager and the Head Accountant that the buyer signed the contract.

**You should see:** The Field Case shows **Contract Signed**, with Maria and the CI each holding a copy. Status **Papers Handed Over**. The Head Accountant is notified: "The buyer has signed the contract."

**Also try:**

- The CI hands over the papers before the contract is signed. It should be refused.
- The Mechanic or Head Security tries to hand over the papers. It should be refused.

### 12 · Head Accountant *(new)*

- Open the notification, then click **Complete financing agreement**.

**You should see:** "Financing account opened." The monthly schedule appears.

**Also try:** **Complete financing agreement** should not be offered until the CI has reported that the buyer signed.

### 13 · Sales Manager *(updated)*

- Click **Mark Sold to This Buyer**.

**You should see:** The sale completes and the request shows **In-House Financing — Active**. The car is removed from the Showroom and every On Hold request is cancelled with those buyers notified. Maria's page shows ₱500,000 as Vehicle Price and ₱400,000 as Amount Financed. The delivery fee is not counted toward the car price.

**Also try:**

- Click **Mark Sold** before the status is **Delivered**. It should be refused.
- Click **Mark Sold** before the financing account is open. It should be refused.
- Click **Mark Sold** before the CI has recorded the papers as handed over. It should be refused.
- Click **Mark Sold** before the contract is recorded as signed and kept. It should be refused.

### 14 · Head Accountant *(new)*

- Over the following months, record each monthly payment as paid.

**You should see:** A missed month flags the account. From the 4th missed month, staff can start taking the car back.

### Please confirm

- I removed the cash balance on arrival, the Sales Manager's Record Cash Received step, and the old payment check that followed it. The financing account replaces them in steps 12 and 13.
- The contract is still signed on delivery day, as in your Scenario 3. Do you also want the Sales Manager to write it and the Head Accountant to approve it before delivery, as in Scenario 4?
- Should the Head Accountant approve the instalment terms before the CEO, as I wrote in step 4, or only the CEO?