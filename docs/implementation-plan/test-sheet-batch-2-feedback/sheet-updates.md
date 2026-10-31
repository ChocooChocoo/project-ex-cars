# Test sheet updates (batch 2) — replacement copy

The artifact `c04b0c2d-579f-4317-94eb-efad451fb527` renders read-only steps: the browser only exposes the
answer buttons and Dev mode. These are the exact strings to regenerate the artifact with.

## Test 1 — Landing page with Log in and Register

**Status in sheet:** Needs fixing. Client comment:

> Di po namin ma-address yung landing page sir pwede po sir bigay niyo nalang po samin yung link kasi diba po
> tatanggalin po namin yung https://global-exchange-car.vercel.app/auth/v1/login "login" sa last "/" pero
> napupunta pa rin po kami sa login sir

**Replacement steps**

| Do this | You should see |
| --- | --- |
| Open `https://global-exchange-car.vercel.app/` — this is the landing page. Save this link. | The landing page with Log in and Register. |
| On the login page, press "← Home", or press the GCE logo. | The same landing page. |
| Remove `/login` from the address bar and open `/auth/v1` again. | The login page. `/auth/v1` is the login area, not the landing page. |

**Dev note:** The landing page lives at `/`. `/auth/v1` redirects to `/auth/v1/login` on purpose, because it is
the sign-in area. The logo and "← Home" on both auth screens open the landing page.

## Test 7 — Bank Transfer downpayment at a meet-up

**Status in sheet:** Not sure. Client comment:

> di po namin matuloy yung process ng buying atm sir kasi may sira po sa scheduling/calendar

The client never reached the downpayment step. The old steps asked staff to record a Bank Transfer by hand; that
option was removed on purpose, because Bank Transfer is now paid through PayMongo. Replace the whole test.

**Sign in as:** Buyer, then Sales Manager, then Head Accountant

**Before**

Recording a Bank Transfer downpayment by hand failed with "The buyer must sign the contract before a payment is
recorded." Staff also had no Bank Transfer choice once the buyer chose Bank Transfer.

**Now**

For a Bank Transfer meet-up, the Sales Manager sets the downpayment when approving the request. The buyer pays it
online through PayMongo before the meet-up. The balance is paid after the contract is signed. Staff no longer
record a Bank Transfer by hand.

**Steps**

| Do this | You should see |
| --- | --- |
| As the Buyer, open a car, press Buy Now, choose Full Payment, Bank Transfer (via PayMongo) and CALABARZON Meet-up, pick a date and hour, tick the condition box, and press Save Details. | The slot is locked, and the Send panel appears. |
| Upload two valid IDs and one proof of billing, then press Submit Request. | "Under review." |
| As the Sales Manager, open the request, verify the three documents, choose the Confidential Informant and the Mechanic, type 50000 in "Downpayment required (₱)", then Approve. | "Transaction moved to approved." and the meet-up field case opens. |
| As the Buyer, open the request again. | "Pay by bank transfer (PayMongo)" with the ₱50,000 downpayment. |
| Press Pay and complete the PayMongo test checkout. | A Pending payment row for the downpayment. |
| As the Head Accountant, open the request and press Verify on that row. | The row shows Verified, and the balance is due after the contract is signed. |

**Dev note:** The approval now refuses to go through without a downpayment for a Bank Transfer meet-up. A cash
meet-up still pays in person, so it has no downpayment.

## Test 9 — A bought car goes to posting

Already updated in the sheet on Oct 29 with the Request Purchase Funds steps. Two additions for the retest:

**Dev note:** When the CEO approves the price, the car is published with a posted date, so it appears in the
Showroom feed immediately rather than sorting last.

**Last step check**

| Do this | You should see |
| --- | --- |
| Sign in as the CEO, open Vehicles, approve the price, then open the Showroom. | The car appears in the Showroom with its price. |

## Live verification (2026-10-31, Brave + Playwright over CDP)

Both tests were run as a user clicking and typing, against the local app and the hosted database.

**Test 9:** CEO approved the Honda City at ₱520,000. The vehicle ended as `listing_state = available`,
`current_price = 520000`, `posted_at = 2026-10-31T07:12:42Z`, and `/showroom/<id>` rendered the car with its price.

**Test 7:** Buyer bought the Honda City with Full Payment + Bank Transfer (via PayMongo) + CALABARZON Meet-up,
slot Nov 2 2026 10:00 AM, uploaded 2 IDs and proof of billing, and submitted (Under review). The Sales Manager
verified the three documents, chose the Confidential Informant and Mechanic, entered 50000, and approved
("Transaction moved to approved."). The buyer then saw "Downpayment ₱50,000.00" and pressed "Pay by bank transfer
(PayMongo)", which opened `checkout.paymongo.com` for ₱50,000 with the transaction as reference.

Not covered: completing the PayMongo payment and its webhook, and the Head Accountant's verification of the paid
row (the test stops at the checkout page).

**Later the same day — payment completed.** The ₱50,000 checkout was paid with the PayMongo 3DS test card
(`4111 1111 1111 1111`) and authorised on the 3DS test page. Result: "Card Payment Received!", payment
`pay_apCWwDyVgau83qM5n8VARuiN`. The signed webhook replay returned 200 and the record was already settled:
`payment_kind = downpayment`, `amount = 50000`, `method = paymongo`, `paid_at` set, `verified_by` set,
`rejected_at = null`. The buyer page then showed the ₱50,000 downpayment as paid, with no Pay button and no
"Waiting for PayMongo".

