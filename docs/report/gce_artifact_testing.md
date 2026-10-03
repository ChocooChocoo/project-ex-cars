# GCE Testing Report

Date: October 3, 2026

Each scenario has its own table, with results and notes kept together. Scenarios 3 through 6 show the latest results and have no remaining problems from the checks performed. Every item that failed earlier was checked again after a fix and passed. No ❌ Fail rows remain. The rechecks used a local copy of the app, and the fixes are not yet on the shared app.

✅ Passed means the action worked. ❌ Fail means a problem was observed. ℹ️ Note gives context, not another failure. ⬜ Not tested means there is not enough evidence to decide.

## Scenario 1: Juan sells his car, with no problems found

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 1. Juan sells his car, with no problems found | Test car and agreed price | Test setup | ℹ️ Note | Used GCE Test Artifact S1 20261003. Juan asked for ₱520,000. The maximum approved price was ₱500,000. The agreed price was ₱480,000. |
| 1 | 1. Submit the car, papers, and photo | Customer | ✅ Passed | The offer page opened with Chat with GCE. The meeting option was GCE Visit. |
| 1 | 1. Submit without the ORCR | Customer | ✅ Passed | The app stopped the submission and asked for the required papers. Adding the ORCR allowed submission. |
| 1 | 2. Check the papers and ask for price approval | Marketing Specialist | ✅ Passed | The approval button was unavailable until all four papers were checked. The ₱500,000 request showed Pending CEO Approval. |
| 1 | 3. Approve the maximum price | CEO | ✅ Passed | The app accepted approval. The car did not appear in the Showroom at this point. |
| 1 | 4. Send a message about the price | Customer | ✅ Passed | The message appeared in Chat with GCE. |
| 1 | 5. Reply, save the price, and arrange the inspection | Marketing Specialist | ✅ Passed | The app saved the reply, ₱480,000 price, meeting details, and assigned staff. An inspection visit link appeared. |
| 1 | 5. Try a price above the approved maximum | Marketing Specialist | ⬜ Not tested | A ₱600,000 attempt did not create a visit. Other required details were missing during some attempts. The reason was not clear enough to decide. |
| 1 | 6. Confirm Juan's identity and record the expense | Confidential Informant | ✅ Passed | The app recorded the identity check and ₱850 fuel and toll expense, with a picture as proof. |
| 1 | 7. Check the plate and report no problems | Mechanic | ✅ Passed | The app recorded the plate check and showed that the car was ready for payment. |
| 1 | 8. Ask for money to pay Juan | Account Manager | ✅ Passed | The app accepted the ₱480,000 request and waited for the Head Accountant. |
| 1 | 9. Approve the money request and record payment | Head Accountant | ✅ Passed | Payment showed paid. The offer showed Completed. The CEO received a payment notice. |
| 1 | 10. Prevent payment of the expense before resale | Head Accountant | ✅ Passed | The expense could not be paid yet. The button was visible but unavailable, rather than hidden as the instructions suggested. |
| 1 | 10. Pay back the expense after resale | Head Accountant | ⬜ Not tested | The car was later sold during Scenario 3, but paying back the expense was not tested. |
| 1 | Details on the completed offer | Customer | ✅ Passed | Checked again at about 12:21 PM after a fix. The completed offer showed Agreed Price ₱480,000 and Decision Completed. Earlier it showed both as Pending. |
| 1 | Amount on the payment summary | Customer | ✅ Passed | Checked again at about 12:21 PM after a fix. The summary showed ₱480,000, Payments received ₱480,000, and Balance due ₱0. Earlier it showed ₱520,000 due. |
| 1 | Records checked | Test conditions | ℹ️ Note | The recheck reopened the completed Scenario 1 offer on a local copy of the app. The selling steps were not repeated. The fix is not yet on the shared app. |

## Scenario 2: Juan sells his car, but inspection finds a problem

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 2. Juan sells his car, but inspection finds a problem | Test car and revised price | Test setup | ℹ️ Note | Used GCE Test Artifact S2 20261003. The asking price was ₱520,000 and first agreed price was ₱480,000. The repair estimate was ₱30,000. The revised maximum was ₱460,000 and final agreed price was ₱450,000. |
| 2 | 1. Submit a car with a known problem | Customer | ✅ Passed | The offer opened with the papers and photo. The problem was a weak air conditioner. The meeting option was Meet Halfway within Calabarzon. |
| 2 | 2. Check the papers, approve the price, and arrange inspection | Marketing Specialist and CEO | ✅ Passed | The papers were checked. The CEO approved ₱500,000. The app saved the ₱480,000 price and inspection visit. The Confidential Informant confirmed Juan's identity. |
| 2 | 3. Report the inspection problem | Mechanic | ✅ Passed | The app saved the plate check, air conditioner problem, ₱30,000 repair estimate, and photo. The report appeared on the offer. |
| 2 | 4. Send the lower price to the CEO | Marketing Specialist | ✅ Passed | The app accepted the explanation, ₱450,000 proposed price, and ₱460,000 maximum price. It sent the request to the CEO. |
| 2 | 4. End an offer that is no longer worthwhile | Marketing Specialist | ⬜ Not tested | This alternative was not tested on another offer. |
| 2 | 5. Approve the new maximum price | CEO | ✅ Passed | The app accepted ₱460,000 and showed the approval in the offer history. |
| 2 | 6. Record Juan's agreement | Marketing Specialist | ✅ Passed | The agreed price changed to ₱450,000. The app showed that the car was ready for payment. |
| 2 | 6. End the offer when Juan refuses | Marketing Specialist | ⬜ Not tested | This alternative was not tested on another offer. |
| 2 | 7. Ask for the money and record payment | Account Manager and Head Accountant | ✅ Passed | The app recorded ₱450,000 paid. The offer showed Completed. Its history included Juan's agreement and payment. |
| 2 | Details on the completed offer | Customer | ✅ Passed | Checked again at about 12:06 PM after a fix. The completed offer showed Agreed Price ₱450,000 and Decision Completed. Earlier it showed both as Pending. |
| 2 | Amount on the payment summary | Customer | ✅ Passed | Checked again at about 12:06 PM after a fix. The summary showed ₱450,000, Payments received ₱450,000, and Balance due ₱0. Earlier it showed ₱520,000 due. |
| 2 | Records checked | Test conditions | ℹ️ Note | The recheck reopened the completed Scenario 2 offer on a local copy of the app. The selling steps were not repeated. The fix is not yet on the shared app. |

## Scenario 3: Maria buys with cash and visits GCE

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 3. Maria buys with cash and visits GCE | Latest result | All required accounts | ✅ Passed | The purchase steps and final payment summary passed. No problems remain from the Scenario 3 checks performed. |
| 3 | Test car and visit | Test setup | ℹ️ Note | Used GCE Test Artifact S3 Retry 20261003, listed at ₱500,000. The visit was booked for 1:00 PM. Leaving Final Price empty kept the correct price. |
| 3 | 1. Open the car, add papers, and book the visit | Customer | ✅ Passed | Clicked Buy Now. Added a Passport, a Driver's License, and Proof of Billing. Saved Cash and GCE Visit. The app locked 1:00 PM. |
| 3 | 2. Send the request | Customer | ✅ Passed | The app said the request was sent and would be reviewed within seven days. |
| 3 | 3. Try booking the same car and time again | Customer | ✅ Passed | The app refused the second booking and asked for another time. |
| 3 | 4. Try approving before checking the papers | Sales Manager | ✅ Passed | The app refused approval until both IDs and Proof of Billing were checked. |
| 3 | 4. Check the papers and approve | Sales Manager | ✅ Passed | The request changed to Approved. The Customer received an approval notice. |
| 3 | 5. Record payment and complete the sale | Sales Manager | ✅ Passed | Recorded ₱500,000 as Cash and Full payment. The request showed Completed. The staff page showed ₱500,000 paid and nothing left to pay. |
| 3 | 5. Remove the sold car from the Showroom | Customer and Sales Manager | ✅ Passed | Neither Showroom listed the car after the sale. The Customer's request page showed Sold. |
| 3 | 5. Close the other request | Sales Manager | ✅ Passed | The second request changed to Cancelled. Its history said the car was sold to another buyer. |
| 3 | 5. Try Buyer declined on another request | Sales Manager | ✅ Passed | The other request closed. The car stayed in the Showroom until the main purchase completed. |
| 3 | 6. Find the sale in Finance | Head Accountant | ✅ Passed | The sale listed the car, buyer, and Cash payment method. Sale price and Payments received both showed ₱500,000. |
| 3 | Amount left to pay on the printable summary | Customer | ✅ Passed | Checked again at about 11:28 AM. Car price and Payments received showed ₱500,000. Balance due showed ₱0, including after refreshing. |
| 3 | Cash payment label | Sales Manager | ℹ️ Note | During the full retry, the payment record showed Pending. The instructions did not include a separate payment check. The label was not checked again during the final summary check. |
| 3 | Visit timing | Test conditions | ℹ️ Note | The sale completed at about 11:16 AM, before the 1:00 PM visit. No physical visit or real cash payment occurred. |
| 3 | Records checked | Test conditions | ℹ️ Note | The full retry used fresh requests. The final summary check reopened that completed purchase. First-test records were not checked again. |
| 3 | Records left in the app | Test conditions | ℹ️ Note | Both Scenario 3 test cars are sold. The extra requests from both tests are closed. No payments were recorded for those extra requests. |

## Scenario 4: Two buyers want the same car and meet halfway

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 4. Two buyers want the same car and meet halfway | Latest result | All required accounts | ✅ Passed | All eight steps passed at about 12:35 PM to 12:55 PM. Two small problems seen along the way were fixed and checked again. |
| 4 | Test cars | Test setup | ℹ️ Note | Used GCE Test Artifact S4 20261003 for the main steps, after the CEO approved its ₱500,000 price. Four extra test cars, S4b to S4e, were added for the cancel, no-show, and decline steps. |
| 4 | 1. Ask to meet halfway and send the request | Customer | ✅ Passed | Clicked Buy Now. Added a Passport, a Driver's License, and Proof of Billing. Chose Cash and CALABARZON Meet-up with a time and place. The app said the request was sent. |
| 4 | 1. Try saving without the condition tick | Customer | ✅ Passed | The app refused to save. It asked the buyer to review the car's condition and acknowledge it first. |
| 4 | 2. Send a second request for the same car | Customer | ✅ Passed | The app said another buyer's request was in progress and this one was On Hold. The request page showed On Hold. |
| 4 | 3. Check the waiting buyer cannot be made active yet | Sales Manager | ✅ Passed | The Buyers for this car panel listed both requests. Make Active was unavailable while the first request was still open. |
| 4 | 3. Reject the first request and make the second active | Sales Manager | ✅ Passed | The first request changed to Rejected. Make Active then worked, and the app said the request was now Active. |
| 4 | 4. Try cancelling a meet-up about 3 hours away | Customer | ✅ Passed | The app refused. It said cancellation is only allowed 5 hours or more before the scheduled time. The request stayed open. |
| 4 | 5. Try recording a no-show too early | Sales Manager | ✅ Passed | Before the meet-up, and again 2 hours after it, the Buyer didn't show up option was not offered at all. The instructions expected it to be refused; it was hidden, which has the same effect. |
| 4 | 5. Record a no-show after 2½ hours | Sales Manager | ✅ Passed | With the meet-up 3 hours in the past, the option appeared. The app recorded that the buyer didn't show up and closed the request. The buyer's record showed one no-show. |
| 4 | 6. Limit the buyer after a second no-show | Customer | ✅ Passed | After a second no-show, a note said the account was limited to GCE visits. The Arrangement Type list offered GCE Visit only. |
| 4 | 7. Record Declined, Not Legit | Sales Manager | ✅ Passed | The app recorded the decline. The buyer got one strike and was limited to GCE visits straight away. |
| 4 | 7. Record Declined, Legit | Sales Manager | ✅ Passed | The app recorded the decline and closed the request. The buyer's record did not change, so there was no penalty. |
| 4 | 8. Approve, record payment, and mark the car sold | Sales Manager | ✅ Passed | Recorded ₱500,000 as Cash and Full payment. The request changed to Completed with nothing left to pay. The car left the Showroom. |
| 4 | 8. Tell the waiting buyer | Customer | ✅ Passed | A third request was waiting On Hold. It changed to Cancelled, its history said the car was sold to another buyer, and the buyer received a notice that the car had been sold. |
| 4 | Amount due on a closed request | Customer | ✅ Passed | First seen as a problem: the printable summary of a cancelled, rejected, or no-show request still showed ₱500,000 due. After a fix, those summaries showed Balance due ₱0. Open requests still show the full amount due. |
| 4 | Wording of the approval notice | Customer | ✅ Passed | First seen as a problem: the notice for an approved meet-up said GCE would expect the buyer on the "scheduled visit". After a fix, a newly approved meet-up said "at the scheduled date and time". |
| 4 | Label for the active request | Sales Manager | ℹ️ Note | After Make Active, the panel showed the request as Pending Sales Manager Approval, not as Active. The message did say the request was now Active. |
| 4 | Moving the clock | Test conditions | ℹ️ Note | The 5-hour and 2½-hour rules were not waited out. Each meet-up was booked through the app, then its time was moved directly in the test data: to 3 hours ahead for the cancel step, and to 2 and 3 hours in the past for the no-show steps. |
| 4 | Buyer account reset | Test conditions | ℹ️ Note | The Customer's no-shows, strike, and GCE-visit-only limit were cleared after the test, as the instructions ask. The limit was also cleared once mid-test so that a waiting request could be made for step 8. |
| 4 | Records left in the app | Test conditions | ℹ️ Note | The S4 car is sold. S4b to S4e are still listed, and every request made on them is closed. One extra request was approved to recheck the notice wording, then closed with Declined, Legit. No real meet-up or payment took place. |
| 4 | Where this was tested | Test conditions | ℹ️ Note | All steps ran on a local copy of the app against the shared test data. The two fixes are not yet on the shared app. |

## Scenario 5: Maria buys with cash and has the car delivered

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 5. Maria buys with cash and has the car delivered | Latest result | All required accounts | ✅ Passed | All seven steps passed at about 1:05 PM to 1:20 PM. One problem seen along the way was fixed and checked again. The two items GCE staff marked Fail on this scenario were also checked. |
| 5 | Test cars | Test setup | ℹ️ Note | Used GCE Test Artifact S5 20261003 for the main steps, after the CEO approved its ₱500,000 price. One extra test car, S5b, was added for the not-serviceable check. |
| 5 | GCE staff feedback on step 1 | Customer | ✅ Passed | On 2 October, GCE staff reported that Save Details asked for a future visit hour even with a future time. That message appears when a GCE visit time is not exactly on the hour. After a fix, a visit entered as 10:25 AM was saved and locked as 10:00 AM. The cause of the staff report was not confirmed, so this is the most likely one, not a proven one. |
| 5 | GCE staff feedback on step 2 | Sales Manager | ✅ Passed | On 1 October, GCE staff reported that a request reached the Sales Manager before the buyer filled it in. A request that was started but not sent did not appear in the Sales Manager's Transactions list, and its page said Page not found. The sent request appeared. |
| 5 | 1. Ask for delivery and send the request | Customer | ✅ Passed | Clicked Buy Now. Added a Passport, a Driver's License, and Proof of Billing. Chose Cash and Delivery for October 8 at 10:30 AM with an address in Calamba. Ticked the condition box. The app saved the details and said the request was sent. |
| 5 | 2. Approve and set the delivery terms | Sales Manager | ✅ Passed | Checked the three papers and approved. Chose Yes, we can deliver, with a ₱2,500 delivery fee and ₱50,000 downpayment. The app said the terms were sent to the buyer. |
| 5 | 2. Show the buyer what to pay and by when | Customer | ✅ Passed | The request page showed the ₱2,500 fee and ₱50,000 downpayment by bank transfer before October 7, three working days after the test date. It said the balance is paid in cash on delivery. |
| 5 | 2. Reject an address that cannot be served | Sales Manager | ✅ Passed | On the S5b request, choosing No, not serviceable offered only Reject: not serviceable. The app said the request was closed as not serviceable, and it changed to Rejected. |
| 5 | 3. Record and check the fee and downpayment | Head Accountant | ✅ Passed | Recorded ₱2,500 as Delivery fee and ₱50,000 as Downpayment, both by Bank Transfer. After checking each one, both showed as verified. |
| 5 | 4. Hold the delivery team until the fee is checked | Sales Manager | ✅ Passed | While the delivery fee was still unchecked, Create delivery field case was unavailable. |
| 5 | 4. Create the delivery team | Sales Manager | ✅ Passed | Chose a Confidential Informant, a Mechanic, and a Head Security. The app said the delivery field case was created, and an Open field case link appeared. |
| 5 | 4. Reschedule the delivery | Sales Manager | ✅ Passed | Entered October 9 at 3:00 PM and a ₱500 fee. The app said the delivery was rescheduled, and the new date showed on the staff, team, and buyer pages. |
| 5 | 5. Report a delay and tell the buyer | Confidential Informant and Sales Manager | ✅ Passed | The Confidential Informant reported a traffic delay. The Sales Manager then clicked Tell the buyer about the delay. The buyer's page showed the Running late note. |
| 5 | 6. Move the delivery to Delivered | Head Security | ✅ Passed | Mark Dispatched, Mark In Transit, Mark Arriving, and Mark Delivered each showed its Marked message. The buyer's page lit up each step in turn. |
| 5 | 6. Refuse Mark Dispatched before the downpayment is checked | Head Security | ⬜ Not tested | The downpayment was checked before the delivery team existed, so this could not be tried on the main request. |
| 5 | 7. Refuse Mark Sold before Delivered | Sales Manager | ✅ Passed | Before the delivery was marked Delivered, the app refused and said to mark the car sold after the delivery team reports it delivered. |
| 5 | 7. Record the balance and mark the car sold | Sales Manager | ✅ Passed | Recorded ₱450,000 as Cash, Balance on delivery. The request changed to Completed. The car left both Showrooms. The buyer's summary showed ₱500,000 received and ₱0 due. |
| 5 | 7. The other endings | Sales Manager | ⬜ Not tested | Buyer unavailable, Declined, Legit with a downpayment refund, and Declined, Not Legit were not tried by hand on delivery requests. The team's automated checks did run two of them and both passed: Buyer unavailable kept the downpayment, and Declined, Legit put a Downpayment refund in Finance. Declined, Not Legit on a delivery was not checked either way. |
| 5 | Sale in Finance | Head Accountant | ✅ Passed | Sale records listed the car at a ₱500,000 sale price with ₱502,500 received, split into delivery fee ₱2,500, downpayment ₱50,000, and balance ₱450,000. |
| 5 | Amount still to pay on the staff page | Sales Manager | ✅ Passed | First seen as a problem: the delivery fee was counted toward the car price. Before the balance was paid, the staff page showed ₱447,500 left to pay, not ₱450,000. After the sale it showed ₱502,500 paid on a ₱500,000 car. After a fix, it showed ₱500,000 paid, ₱0 left, and a note that ₱2,500 in fees is not counted. |
| 5 | Reschedule fee | Sales Manager | ℹ️ Note | The ₱500 reschedule fee was entered but never asked for or recorded. The sale still completed. The app leaves it to the Head Accountant to record that fee by hand. |
| 5 | Payment rows | Head Accountant | ℹ️ Note | The payment table shows the amount, method, and date of each payment, but not what the payment was for. With two bank transfers waiting, the fee and the downpayment can only be told apart by amount. |
| 5 | Wording on the rejected request | Sales Manager | ℹ️ Note | The not-serviceable delivery request said its visit slot was released. A delivery has no visit slot. |
| 5 | Delivery timing | Test conditions | ℹ️ Note | The delivery was dated October 9. It was marked Delivered and the sale completed on October 3. No real delivery or payment took place. |
| 5 | Records left in the app | Test conditions | ℹ️ Note | The S5 car is sold. The S5b car is still listed and its request is rejected. One extra request, used to check the visit time, was cancelled. |
| 5 | Where this was tested | Test conditions | ℹ️ Note | All steps ran on a local copy of the app against the shared test data. The fixes are not yet on the shared app. |

## Scenario 6: Maria buys in monthly instalments and visits GCE

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 6. Maria buys in monthly instalments and visits GCE | Latest result | All required accounts | ✅ Passed | All nine steps passed at about 5:10 PM to 5:40 PM. Two problems seen along the way were fixed and checked again. The two items GCE staff marked Fail on this scenario were also checked. |
| 6 | Test cars | Test setup | ℹ️ Note | Used GCE Test Artifact S6 20261003 for the main steps, after the CEO approved its ₱500,000 price. Two extra test cars, S6b and S6c, were added for the returned-terms, Don't proceed, and Potential Buyer checks. |
| 6 | GCE staff feedback on step 1 | Customer | ✅ Passed | On 2 October, GCE staff reported that Save Details asked for a future visit hour. In this scenario the request is sent with no visit time, and it saved and sent without that message. The visit is booked later, in step 5, where the same message did appear. See the row on the visit time below. |
| 6 | GCE staff feedback on step 2 | Sales Manager | ✅ Passed | On 1 October, GCE staff reported that a request reached the Sales Manager before the buyer filled it in. A request that was started but not sent showed Page not found for the Sales Manager. The sent request opened normally. |
| 6 | 1. Ask for instalments and send the request | Customer | ✅ Passed | Clicked Buy Now. Added a Passport, a Driver's License, and Proof of Billing. Chose Financing and GCE Visit with no time, ticked the condition box, saved, and sent. The app said the request was sent. |
| 6 | 2. Approve and propose the plan | Sales Manager | ✅ Passed | Checked the three papers and approved. Entered 12 months, ₱500,000 price, ₱100,000 Initial Downpayment, and a first instalment on November 3. The app said the terms were sent to the Head Accountant. The page showed a ₱400,000 balance at ₱33,333.33 a month. |
| 6 | 3. Approve the plan | Head Accountant | ✅ Passed | The app said the terms were sent to the CEO. The plan then showed Waiting for the CEO. |
| 6 | 3. Return the plan for revision | Head Accountant and Sales Manager | ✅ Passed | On the S6b request, Return for revision with a reason said the terms were returned to the Sales Manager. The Sales Manager saw Returned for revision, changed the downpayment to ₱150,000, and sent it again. It was then approved and confirmed. |
| 6 | 4. Confirm the plan | CEO | ✅ Passed | The app said the financing was confirmed and the buyer was notified. The plan showed Confirmed. |
| 6 | 5. Read the approved financing | Customer | ✅ Passed | The request showed Your approved financing: ₱100,000 Initial Downpayment, then 12 monthly payments on a ₱400,000 balance, paid only after inspecting the car at GCE. |
| 6 | 5. Accept and book the visit | Customer | ✅ Passed | After a fix, the visit was booked and the app said no payment is taken before inspecting the car. The request showed Visit Scheduled, Initial Downpayment Pending. |
| 6 | 5. Visit time that is not on the hour | Customer | ✅ Passed | First seen as a problem: a visit entered as 10:25 AM was refused with "Pick a future GCE visit slot on the hour", the same message GCE staff reported. The earlier fix covered only the first booking form. After a second fix, 10:25 AM was booked as 10:00 AM. |
| 6 | 5. Choose Don't proceed | Customer | ✅ Passed | On the S6b request, the app said the request was closed. It changed to Cancelled with nothing paid and Balance due ₱0. |
| 6 | 6. Record the Purchase Claim and the downpayment | Sales Manager | ✅ Passed | The app said the Purchase Claim was recorded. Recorded ₱100,000 by Bank Transfer as Downpayment. The request showed Initial Downpayment, Awaiting Verification. |
| 6 | 6. Hold the car and tell the waiting buyer | Customer | ✅ Passed | A second request was waiting On Hold for the same car. The car was marked reserved, and the waiting buyer received a notice that the car was under a Purchase Claim and that their request stays open. |
| 6 | 6. Choose Needs time: Potential Buyer | Sales Manager | ✅ Passed | On the S6c request, the app said it was recorded as Potential Buyer. The car stayed in the Showroom. |
| 6 | 7. Check the payment and complete the agreement | Head Accountant | ✅ Passed | Complete financing agreement was not offered until the downpayment was checked. After checking it, the app said the financing account was opened. A 12-row monthly schedule appeared, each row with Record paid. |
| 6 | 8. Mark the car sold | Sales Manager | ✅ Passed | The request changed to Completed. The buyer's page showed In-House Financing, Active. The waiting request changed to Cancelled. |
| 6 | 9. Record a monthly payment | Head Accountant | ✅ Passed | Record paid on the first instalment said it was recorded as paid. The account showed ₱33,333.33 paid and ₱366,666.67 remaining. |
| 6 | 9. A missed month flags the account | Head Accountant | ✅ Passed | With one instalment overdue, the account showed Flagged: missed payment and Missed installments 1. |
| 6 | 9. Taking the car back only from the 4th missed month | Head Accountant | ✅ Passed | With one missed month, Instruct Repossession was refused: it said repossession starts after 4 missed installments and this account has 1. With four missed months, the account showed Missed installments 4 and the option was offered. The repossession was not carried out. |
| 6 | Sale in Finance | Head Accountant | ✅ Passed | Sale records listed the car as Financing at a ₱500,000 sale price with ₱100,000 received as downpayment. |
| 6 | Amounts on the buyer's page | Customer | ✅ Passed | The summary showed ₱500,000, Payments received ₱133,333.33, and Balance due ₱366,666.67 after the downpayment and one instalment. First seen as a problem: the buyer's page labelled the ₱500,000 car price as Financed and the ₱400,000 financed amount as Balance. After a fix, they read Vehicle Price and Amount Financed, matching the staff page. |
| 6 | Instruct Repossession shown early | Head Accountant | ℹ️ Note | The Instruct Repossession button appears from the first missed month and can be opened. The app only refuses when Instruct is clicked. |
| 6 | Wording after approval | Sales Manager | ℹ️ Note | Right after approval, the page told the Sales Manager to record the payment and mark the car sold after the visit. For instalments, the plan has to be agreed first. |
| 6 | Reserved car in the Showroom | Sales Manager | ℹ️ Note | After the Purchase Claim, the car was still listed in the Showroom. Its record was marked reserved. Whether the page shows it as reserved to buyers was not checked. |
| 6 | Reason for returning the plan | Sales Manager | ℹ️ Note | The Sales Manager's page showed Returned for revision. Whether the Head Accountant's reason was also shown was not checked. |
| 6 | Moving the dates | Test conditions | ℹ️ Note | The missed months were not waited out. Instalment due dates were moved into the past in the test data, first one and then four, and put back afterwards. The missed-payment flag was cleared. Notices sent to staff during that check remain. |
| 6 | Not tested | Test conditions | ⬜ Not tested | The full repossession, the Waive option on an instalment, and paying all twelve instalments were not tried by hand. |
| 6 | Records left in the app | Test conditions | ℹ️ Note | The S6 car is sold on instalments with one instalment paid. The S6b request is cancelled and the car is still listed. The S6c request is still open as a Potential Buyer with a visit booked for October 10. One extra unsent request was cancelled. No real visit or payment took place. |
| 6 | Where this was tested | Test conditions | ℹ️ Note | All steps ran on a local copy of the app against the shared test data. The fixes are not yet on the shared app. |

## Scenario 7: Maria pays by bank transfer

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 7. Maria pays by bank transfer | Latest result | All required accounts | ✅ Passed | All four steps and the delivery wording check passed in the final browser test run on October 3. Both client-reported failures were checked on the local app and did not recur. No new product-code fix was needed. |
| 7 | Test cars | Test setup | ℹ️ Note | Created dedicated E2E-T01 test cars for the draft, bank-transfer visit, and bank-transfer delivery checks. The visit car price was ₱500,000. The previously prepared Scenario 7 car was not used. |
| 7 | GCE staff feedback on step 1 | Customer | ✅ Passed | The client reported that Save Details asked for a future visit hour despite a future or same-day schedule. A future visit entered at 25 minutes past the hour saved and submitted successfully with Bank Transfer. Existing local fixes handle the whole-hour booking. Same-day scheduling was not separately tested, and the exact cause of the original report was not confirmed. |
| 7 | GCE staff feedback on step 2 | Sales Manager | ✅ Passed | The client reported that a request appeared before the buyer filled it in. After Buy Now, before any details or papers were added, the draft had no link in the Sales Manager's Transactions list. Opening its page directly showed Page not found. The submitted request later opened normally. |
| 7 | 1. Add papers, book the visit, and submit | Customer | ✅ Passed | Added a Passport, a Driver's License, and Proof of Billing. Chose Bank Transfer and GCE Visit, saved a future schedule entered at :25, and submitted. The app showed Details saved and Request sent. |
| 7 | 2. Approve and record the bank transfer | Sales Manager | ✅ Passed | Checked all three papers and approved. Recorded ₱500,000 by Bank Transfer. No payment Verify button was offered to the Sales Manager. |
| 7 | 2. Refuse the sale before checking the transfer | Sales Manager | ✅ Passed | Mark Sold to This Buyer was refused with: The Head Accountant must verify the bank transfer before the car is marked sold. |
| 7 | 3. Check the bank transfer | Head Accountant | ✅ Passed | One payment Verify button appeared. Clicking it removed the button; the sale could then proceed. |
| 7 | 4. Mark the car sold | Sales Manager | ✅ Passed | The app showed Transaction moved to completed. The transaction record showed completed and the car record showed sold. |
| 7 | Balance on the buyer's summary | Customer | ✅ Passed | Reopened the completed request. Its summary showed ₱0.00 due. |
| 7 | 4. Bank-transfer delivery wording | Customer and Sales Manager | ✅ Passed | On a separate Bank Transfer and Delivery request, the Sales Manager approved and confirmed a ₱2,500 delivery fee and ₱50,000 downpayment. The buyer's page said: The balance is paid by bank transfer on delivery. |
| 7 | Earlier test attempts | Test conditions | ℹ️ Note | The first run hit the two-minute test limit during approval. The next reached completion but failed because the test selected two zero-balance labels. Increased the test limit and scoped the assertion to the summary. The final run passed all three tests in 3.8 minutes. These were test-run issues, not confirmed product failures. |
| 7 | Test evidence | Test conditions | ℹ️ Note | Ran src/tests/e2e/t01-phase6-bank-transfer.spec.ts through Playwright with the local environment loaded. The three tests cover draft visibility, the visit payment flow, and delivery wording. A later visible-browser run also passed all three tests in 3.5 minutes. The delivery was not carried through dispatch or final sale; a bank-transfer meet-up was not separately tested. |
| 7 | Records left in the app | Test conditions | ℹ️ Note | Draft requests were cancelled. Three visit purchases completed across the retries and visible-browser run and remain sold. Completed delivery-wording checks ended with cancelled requests. Cleanup archived only available test cars created by each run; it did not reset the Customer's standing or archive unrelated test cars. No real visit, delivery, or payment occurred. |
| 7 | Where this was tested | Test conditions | ℹ️ Note | Browser tests used the local app against shared test data. This does not prove that the fixes are deployed to the shared app. The shared artifact was later updated to four Pass marks, with original client feedback preserved and local-test limitations recorded. All four marks and notes persisted after reload. |

## Scenario 8: Maria pays in instalments and meets halfway

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 8. Maria pays in instalments and meets halfway | Latest result | All required accounts | ✅ Passed | All four main steps passed on the local app in a visible Playwright run on October 3. Both client-reported problems did not recur. No new product-code fix was needed. Some alternative endings remain untested, as listed below. |
| 8 | Test cars and financing | Test setup | ℹ️ Note | Used dedicated E2E-T01-S8-DRAFT and E2E-T01-S8-MEETUP cars, not the previously prepared car. Financing was 12 months on a ₱500,000 car, with ₱100,000 downpayment and ₱400,000 financed. |
| 8 | GCE staff feedback on step 1 | Customer | ✅ Passed | The client reported a future visit-hour error. Financing and CALABARZON Meet-up saved and submitted without a schedule at this stage, as the instructions require. The time was entered later in step 3. The original cause was not confirmed; same-day scheduling was not separately tested. |
| 8 | GCE staff feedback on step 2 | Sales Manager | ✅ Passed | A Buy Now draft, before details or papers were added, had no link in the Sales Manager's Transactions list. Opening its page directly showed Page not found. After submission, the request opened normally. |
| 8 | 1. Add papers, choose financing and meet-up, and submit | Customer | ✅ Passed | Added a Passport, a Driver's License, and Proof of Billing. Chose Financing and CALABARZON Meet-up, acknowledged the condition, saved, and submitted. The app showed Details saved and Request sent. |
| 8 | 2. Approve and propose financing | Sales Manager | ✅ Passed | Checked three papers, approved, and proposed 12 months, ₱500,000 price, and ₱100,000 Initial Downpayment. Terms were sent to the Head Accountant. |
| 8 | 2. Approve and confirm financing | Head Accountant and CEO | ✅ Passed | The Head Accountant sent the terms to the CEO. The CEO confirmed financing and the app said the buyer was notified. Receipt of that notification was not separately checked. |
| 8 | 3. Accept and book the meet-up | Customer | ✅ Passed | Booked a future time at 25 minutes past the hour, with SM Calamba parking, Laguna as the location. The app said Meet-up booked. No payment is taken before you inspect the car. There were zero payment records at this point. |
| 8 | 4. Record the Purchase Claim and downpayment | Sales Manager | ✅ Passed | The app recorded the Purchase Claim. Recorded ₱100,000 by Bank Transfer as Downpayment. |
| 8 | 4. Verify downpayment and complete agreement | Head Accountant | ✅ Passed | Complete financing agreement was not offered before verification. After verifying the one payment, the agreement completed and the app said Financing account opened. |
| 8 | 4. Complete the sale and show active financing | Sales Manager and Customer | ✅ Passed | Mark Sold showed Transaction moved to completed. The record showed completed and financing_active; the car record showed sold. The buyer page showed In-House Financing, Active. |
| 8 | Refuse cancellation within five hours | Customer | ✅ Passed | Temporarily moved the booked meet-up to three hours ahead in test data. Cancel Transaction was refused with the five-hour message. Restored the original schedule afterwards. |
| 8 | Refuse a premature no-show | Sales Manager | ✅ Passed | With the meet-up still in the future, Buyer didn't show up was not offered. |
| 8 | Alternative endings and optional visit | Test conditions | ⬜ Not tested | Optional Buyer meet-up field-case logging, a no-show after 2½ hours, the second-no-show account limit, Declined, Legit, Declined, Not Legit, and cancellation outside five hours were not separately tested on financing meet-up requests. Scenario 4 results are not counted as fresh Scenario 8 proof. |
| 8 | First attempt and rerun | Test evidence | ℹ️ Note | The first visible run completed the sale but its final assertion expected separate In-House Financing and Active labels. The UI combines them. Corrected the test selector, added the cancellation cutoff check, and reran. Both browser tests passed in 3.0 minutes. This was a test-selector issue, not a product failure. |
| 8 | Test file | Test evidence | ℹ️ Note | Added src/tests/e2e/scenario-8-financing-meetup.spec.ts. Ran it with Playwright in headed mode and the local environment loaded. A further visible rerun with fresh cars passed both tests in 3.6 minutes. Cleanup is scoped to cars created by the run; it does not archive unrelated test cars or reset customer standing. |
| 8 | Records and timing | Test conditions | ℹ️ Note | Three financed meet-up purchases completed across the runs and remain sold with active accounts. Draft requests were cancelled. The meet-ups were in the future but the purchases completed during testing. No physical inspection, real payment, or signed agreement occurred. |
| 8 | Where this was tested and shared results | Test conditions | ℹ️ Note | Tested local app against shared test data. Shared-app deployment was not verified. Updated artifact to four Pass marks with original feedback preserved, local-only verification notes, and untested alternatives recorded. All marks and notes persisted after reload. |

## Scenario 9: Maria pays in instalments and has the car delivered

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| 9. Maria pays in instalments and has the car delivered | Latest result | All required accounts | ✅ Passed | All eight artifact steps passed locally in a visible Playwright run on October 3. Both client-reported failures did not recur. No new product-code fix was needed. |
| 9 | Test cars and amounts | Test setup | ℹ️ Note | Created dedicated E2E-T01-S9-DRAFT and E2E-T01-S9-DELIVERY cars. Used ₱500,000 price, 12 months, ₱100,000 Initial Downpayment, ₱400,000 financed, and ₱2,500 delivery fee. The previously prepared Scenario 9 car was not used. |
| 9 | GCE staff feedback on step 1 | Customer | ✅ Passed | The client reported a future visit-hour error. Financing and Delivery saved and submitted with no schedule at this stage. Delivery was booked later in step 3. The original cause was not confirmed; same-day scheduling was not separately tested. |
| 9 | GCE staff feedback on step 2 | Sales Manager | ✅ Passed | A Buy Now draft had no link in the Sales Manager's Transactions list. Opening its page directly showed Page not found. The submitted request opened normally. |
| 9 | 1. Add papers, choose financing and delivery, and submit | Customer | ✅ Passed | Added Passport, Driver's License and Proof of Billing. Chose Financing and Delivery, acknowledged condition, saved, and submitted. Details saved and Request sent appeared. |
| 9 | 2. Approve and confirm the plan | Sales Manager, Head Accountant and CEO | ✅ Passed | Checked papers and approved. Proposed 12 months, ₱500,000 price and ₱100,000 downpayment. Head Accountant approved and CEO confirmed. The app said the buyer was notified; receipt of the notification was not separately checked. |
| 9 | 2. Wait for buyer acceptance and booking | Sales Manager | ✅ Passed | Before buyer booking, the delivery panel said to set terms after the buyer accepts the financing offer and books delivery. |
| 9 | 3. Accept and book delivery | Customer | ✅ Passed | Entered a future delivery time at :25 and SM Calamba parking, Laguna as the address. The app said Delivery booked. GCE will confirm the delivery terms. |
| 9 | 4. Reject the wrong downpayment | Sales Manager | ✅ Passed | With ₱2,500 delivery fee and ₱50,000 downpayment, confirmation was refused: Set the downpayment to the Initial Downpayment of ₱100,000. |
| 9 | 4. Confirm matching downpayment | Sales Manager | ✅ Passed | Changed downpayment to ₱100,000. The app said Delivery terms sent to the buyer. |
| 9 | 5. Explain the remaining balance | Customer | ✅ Passed | Buyer page said The balance is paid in monthly installments under your financing agreement. |
| 9 | 6. Record and verify both upfront payments | Head Accountant | ✅ Passed | Recorded ₱2,500 Delivery fee and ₱100,000 Downpayment by Bank Transfer. Verified both payment records. |
| 9 | 6. Block agreement completion before delivery | Head Accountant | ✅ Passed | Complete financing agreement was refused with Complete the agreement after the car is delivered and the buyer accepts it. |
| 9 | 7. Create team and progress delivery | Sales Manager and Head Security | ✅ Passed | Assigned Confidential Informant, Mechanic and Head Security. Created delivery field case. Head Security saw Collect nothing on delivery: the balance is financed by GCE. Dispatched, In Transit, Arriving and Delivered each succeeded. |
| 9 | 8. Complete financing and sale | Head Accountant and Sales Manager | ✅ Passed | After Delivered, Complete financing agreement showed Financing account opened. Mark Sold showed Transaction moved to completed. Record showed completed and financing_active; car record showed sold. |
| 9 | 8. Show active financing to buyer | Customer | ✅ Passed | Reopened buyer page and confirmed In-House Financing, Active. |
| 9 | Test evidence | Test conditions | ℹ️ Note | Added src/tests/e2e/scenario-9-financing-delivery.spec.ts. Both tests passed in headed Playwright in 3.8 minutes: draft visibility and the eight-step financing delivery flow. Cleanup archived only available cars created by this run; customer standing and unrelated test cars were not changed. |
| 9 | Scope limits | Test conditions | ⬜ Not tested | Separate buyer-acceptance enforcement after Delivered, instalment collection, missed payments, refund/decline alternatives, and blocking dispatch with an unchecked downpayment were not separately exercised. Both payments were verified before team creation. |
| 9 | Records and timing | Test conditions | ℹ️ Note | One financed delivery car remains sold with an active account and both upfront payments recorded. Draft request was cancelled. Future delivery was marked Delivered during testing. No physical delivery, real payment or signed agreement occurred. |
| 9 | Local app and shared artifact | Test conditions | ℹ️ Note | Tested local app against shared test data. Shared-app deployment not verified. Artifact updated to eight Pass marks with original client feedback and local-test caveats preserved. All eight marks and notes persisted after reload. |

## General testing results and notes

| Scenario | Step or item | Who | Status | Notes |
| --- | --- | --- | --- | --- |
| Earlier testing | Open the instructions and GCE app | Tester | ✅ Passed | Both opened. Results are saved in this report, not in the shared instructions page. |
| Earlier testing | Sign in with the required accounts | Tester | ✅ Passed | All accounts needed for Scenarios 1, 2, and 3 worked. The password is not included here. |
| Earlier testing | Customer menu after switching accounts | Customer | ✅ Passed | Checked again at about 12:08 PM after a fix. Switching between the Customer, Sales Manager, Marketing Specialist, and Head Accountant accounts showed the correct menu each time, including Sell Vehicle for the Customer. The earlier problem happened once and could not be made to happen again, so the fix was not seen correcting it directly. |
| Earlier testing | Warning while preparing test cars | Tester | ✅ Passed | Checked again at about 12:08 PM after a fix. The warning appeared when typing in the Mileage or Price box. After the fix, typing in the add-car and edit-car forms showed no warning. Nothing was saved during this check. |
| Earlier testing | Open the sign-out menu | Tester | ℹ️ Note | A small testing tool blocked a mouse click. The keyboard opened the menu. |
| Earlier testing | Browser tab name | Tester | ℹ️ Note | The tab showed Studio Admin rather than the GCE name. |
| Earlier testing | Warnings on the instructions page | Tester | ℹ️ Note | The page showed warnings but opened. These were separate from the GCE app. |
| Earlier testing | Pauses during testing | Tester | ℹ️ Note | Some attempts waited for the wrong page or message. Later checks confirmed successful actions. These pauses were not counted as app failures. |
| All tests | Test conditions | Tester | ℹ️ Note | Cars, amounts, papers, and visits were for testing. No real money moved. No physical inspection occurred. |
| All tests | Earlier pause after Scenario 2 | Tester | ℹ️ Note | The Scenario 1 car was listed for ₱500,000. Its unfinished purchase request was later completed in Scenario 3. After the pause, no buying or selling continued until the user requested it. |
| All tests | Preparation for later scenarios | Tester | ℹ️ Note | Six test cars were created for Scenarios 4 through 9 with proposed prices of ₱500,000. The Scenario 8 and 9 cars appeared in the Showroom. The Scenario 4 car was approved and sold during Scenario 4. The Scenario 5 car was approved and sold during Scenario 5. The Scenario 6 car was approved and sold on instalments during Scenario 6. The Scenario 7 car was still awaiting price approval. |
| All tests | Current stopping point | Tester | ℹ️ Note | Testing stopped after Scenario 9. Its eight main steps and both reported failures were checked on the local app. Untested alternatives and scope limits remain listed within each scenario. Test records remain in the app. Deployment of earlier fixes to the shared app was not verified. |
