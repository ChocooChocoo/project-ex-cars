# GCE Change Requests: Test Sheet Feedback

Source: [GCE Change Requests Test Sheet](https://claude.ai/artifact/T2iggmM7pgrQgzqX1rY7KH) (Claude artifact). Tested by Cesar Bonifacio on 2026-10-27. Feedback comments are translated from Filipino.

**Totals:** 16 work, 3 need fixing, 4 not sure, 1 not answered.

| # | Part | Test | Ref | Result | Feedback (translated) | Next action |
|---|---|---|---|---|---|---|
| 1 | Look around | Menu says "Dashboard" and GCE name | G2, G4 | Works | — | — |
| 2 | Look around | Dashboard real numbers in pesos | G3, G5, MS1 | Not sure | Don't understand "Subscribed or Plan". GCE has no subscriptions. Fine if it means financing. | Fix sheet wording |
| 3 | Look around | Notifications open right page | G1 | Works | — | — |
| 4 | Look around | Profile page | C15 | Needs fixing | Password needs uppercase, lowercase, number and special character. Customer changes own email with an OTP code. Profile photo for staff and customers. Improve UI, looks "laid out flat". | Code change |
| 5 | Shop for a car | Showroom filter by purpose | C1 | Works | Does Marketing Specialist set purpose when posting a car? Not in original request. | Ask client |
| 6 | Shop for a car | Request a Car: Brand, Model, Purpose | C2, C3, C5 | Works | — | — |
| 7 | Shop for a car | Request a Car: cars within budget | C4 | Works | — | — |
| 8 | Shop for a car | Photos and files in My Inquiries | C16 | Works | — | — |
| 9 | Buy a car | Buyer documents shown wider | SM1, HA1 | Works | — | — |
| 10 | Buy a car | Auto-check on IDs and OR/CR | SM2, C11 | Works | — | — |
| 11 | Buy a car | Cheque or deposit photo before verifying | HA2 | Not sure | Their video says the cheque should be removed. | Ask client: drop cheque payment or only the photo |
| 12 | Buy a car | Reject a payment with reason | HA3 | Not sure | Couldn't find where this is. | Clearer directions in sheet |
| 13 | Buy a car | See why request was rejected | C14 | Not sure | Skipped because #12 not checked. | Retest after #12 |
| 14 | Sell a car to GCE | Sell a Car: new form fields | C6–C10, C12 | Needs fixing | Step 7 should be Marketing Specialist, not Sales Manager. | Ask client: sheet wording or access change |
| 15 | Sell a car to GCE | Seller sees counter-offer remarks | C13 | Works | — | — |
| 16 | Sell a car to GCE | Price change during inspection | CI1, CI2, CI3 | Works | — | — |
| 17 | Deliver the car | Courier location sharing | D1 | Not answered | — | Needs testing |
| 18 | Office work | Fewer unused parts (Dashboard, Vehicles) | SM3, SM4 | Works | — | — |
| 19 | Office work | Finance tables 10 rows per page | HA5 | Works | — | — |
| 20 | Office work | Disbursement detail window | HA4 | Works | — | — |
| 21 | Office work | Account Manager only employee tools | AM1, AM3, AM6, R2, R3 | Works | — | — |
| 22 | Office work | Inventory Allocation no currency list | AM2 | Works | — | — |
| 23 | Office work | Create walk-in account | AM4 | Needs fixing | Password needs uppercase, lowercase, number and special character. | Code change (same rule as #4) |
| 24 | Office work | Payroll: Create Run | AM5 | Works | — | — |
| 25 | Office work | CEO full access | R1 | Works | — | — |

## Changes after feedback (2026-10-28)

Code is committed on `fix/auth-batch2-phase-1` and not deployed yet. The test sheet was republished the same day. Saved
answers were cleared only for #4, #12, #13, #14 and #23, so the client re-tests those; every other answer was kept.

| # | What changed |
|---|---|
| 2 | Sheet wording only: "Subscribed or Plan" is replaced by "no list of sample customers". The answer is now "Works" (re-answered 2026-10-27 23:26), so it was kept. |
| 4 | Code: new passwords need upper and lower case letters, a number and a symbol, with a live checklist. Staff and customers can add a profile photo, shown on Profile, in the top-right menu and in the sidebar. A new header card replaces the flat layout. Customers change their own email with a confirmation link sent to the new address (the owner chose a link over an OTP code). The test was rewritten. |
| 5 | Answer added to the sheet: yes, the Marketing Specialist sets Purpose in Vehicles → Add Vehicle → Purpose. |
| 11 | Not changed (out of scope by owner decision). |
| 12 | Exact path added: Transactions → search P5-FINANCE → View Details → Payment Records → the ₱25,000 Pending row → Reject. That ₱25,000 unverified payment was set up for the test. Reject was checked end to end, including the Buyer's notice and the crossed-out amount. |
| 13 | A rejected sell offer with a reason (Honda City 2018) was set up for the Buyer, so the test no longer depends on #12. |
| 14 | Step 7 now names the Marketing Specialist. Checked: they see condition, owner number, ticked issues, the Others text and the issue photos. No code change was needed. |
| 17 | Kept. Delivery case 307390ab (E2E Test CLIENT-DELIVERY) is still In Progress. Location sharing was checked as Head Security, then as Sales Manager and Buyer. The steps now say how to find the transaction. |
| 23 | Same password rule as #4, and the test checks that `abcdefgh` is refused. |

