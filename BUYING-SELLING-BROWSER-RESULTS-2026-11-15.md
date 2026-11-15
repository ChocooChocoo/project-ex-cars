# Buying and selling browser test

Date: 2026-11-15 (Asia/Singapore)
Target: http://localhost:3000
Method: Playwright MCP browser interactions. No product source changes or real payments.

## Result: incomplete; browser automation blocked

The seller entry and initial staff-review steps were exercised. Buying, financial actions, field inspection, and completion were not verified.

## Verified steps

| Step | Result | Browser evidence |
| --- | --- | --- |
| Customer login | Pass | Seeded customer reached /customer/showroom. |
| Seller requirements | Pass | Form exposes vehicle details, ownership, issues declaration, two IDs with front/back, separate OR and CR, deed, and vehicle photos. |
| Meeting choices | Pass | GCE Visit and Meet Halfway within Calabarzon available. |
| Different ID types | Pass | After selecting Passport for ID 1, Passport is absent from ID 2 options. |
| Missing photos | Pass | Submit reports “At least one vehicle photo is required.” |
| Seller submission | Pass | Synthetic Toyota Vios 2019 offer at PHP 520,000 created pending sell transaction f2a52b92-6a9c-4ff3-9296-007df42780a5. |
| Customer transaction | Pass | Pending/Sell, seven pending document images, verified sell photo, status history and Chat with GCE link rendered. Chat link was not opened. |
| Marketing review | Pass | Marketing Specialist login and transaction page show correct vehicle, amount, method, mileage, ownership and no-known-issue declaration. |
| Ceiling gate | Pass | Propose ceiling to CEO was disabled before document verification. |
| Verify confirmation | Pass | Verify opens confirmation dialog. |
| Repeated verification | Blocked | Following first confirmation, a subsequent Verify click timed out. Exact persisted document state not confirmed. |

## Observed issues

1. Seller page says “A mechanic will inspect it and a Sales Manager will review.” This contradicts the documented Marketing Specialist responsibility and the actual Marketing review screen.
2. OR, CR and ID-front auto-checks show “needs manual review” and “The verification service did not answer.” Synthetic one-pixel images were deliberately used, so this does not prove valid real documents would fail verification.
3. Browser became unresponsive during document verification. A click timed out after element instability/detachment; subsequent snapshot, console, isolated-tab creation, and browser-close calls also timed out. Root cause is unconfirmed: this may be the page, browser, or MCP connection. Separately, HTTP GET /auth/v1/login returned 200, so the app server remained reachable.

## Unverified coverage

- Seller CEO ceiling decision, negotiated-price limit, team assignment, funds, inspections, issue/revised-price paths, seller payment, fund returns, reconditioning and showroom publication.
- All buying branches: full payment and financing with GCE Visit, Meet Halfway and Delivery.
- Queue promotion, payment verification, contracts, papers handover, installment settlement, Sold gates and recovery.
- Scheduling boundaries, no-shows, cancellation, refunds and rescheduling fees.
- New seller vehicle exclusion from showroom was not independently checked.

## Test data left behind

Transaction: f2a52b92-6a9c-4ff3-9296-007df42780a5
Vehicle: Toyota Vios, 2019, 40,000 km, first owner, PHP 520,000 offer.
Description: “PLAYWRIGHT QA 2026-11-15: synthetic test offer, not a real vehicle sale.”
Uploads: eight synthetic PNGs, named QA-synthetic-not-a-real-document.png. These are not real identity or registration papers.
Some verification updates may have persisted before the timeout. The ceiling proposal sequence was not reached. Cleanup was not attempted after losing browser access.

## Continuation checks

- Automatic continuation round 1: Playwright tab listing still returns `SdkError: Request timed out`. No additional transaction actions were attempted. Browser artifacts named by MCP for today's run are not present in the workspace's .playwright-mcp directory; the recorded tool outputs remain the evidence for this run.

## Continuation round 2: browser recovered

The browser connection recovered. Seller transaction persisted with deed verified and all six other required document images pending.

Buyer test transaction: fde2d9e5-2c8e-4fe3-bbc0-19db0cce0a95, Honda Brio 2023 (GCE-012), PHP 698,000. Buy Now created a pending transaction. Full-payment choices are Cash and Bank Transfer (via PayMongo); arrangements are Delivery, CALABARZON Meet-up and GCE Visit.

Verified buyer steps:
- Cash/GCE Visit details saved; Nov 17, 2026 at 10 AM slot persisted after reload.
- Submit Request disabled with no documents.
- Four ID images plus billing upload enabled submission.
- Submission reached Pending Sales Manager Approval / Under Review.
- Sales Manager attempted approval with pending documents; status remained Under Review.
- After manually verifying all five synthetic images, approval persisted as Approved with Document Check verified. Reloading between each verification avoided the earlier browser stall.
- Mark Sold action was attempted with PHP 0 paid and papers not released; transaction remained Approved. No explanatory error was captured, so only non-completion is confirmed, not the precise gate reason.

Additional wording mismatch: immediately after request submission, customer progress says Sales has processed the request and Head Accountant is verifying, while the same page says Pending Sales Manager Approval and staff review is assigned to Sales Manager.

The buyer test uses existing demo inventory; another older Approved request exists for this vehicle. No older records were changed. New request carries the note “PLAYWRIGHT QA synthetic purchase test; no real payment or reservation intent.” No payment was recorded. This request and its slot remain for continued testing/cleanup.

## Remaining work

Continue seller approvals and inspect additional buyer branches, then cancel synthetic open requests where supported. Full end-to-end success is not claimed. Earlier blanket statements that all buying steps were unverified are superseded by the round 2 evidence above.
