# T06 live browser test — prompt for Playwright MCP

Before running: apply the 6 migrations (`supabase/migrations/20261104*_t06rc_*.sql`), start `npm run dev`, and
promote one account to Super Admin (SQL in `docs/implementation-plan/t06-reviewer-changes/phase-2.md`).

Paste everything below the line into a new Claude Code session.

---

Test the T06 reviewer changes in a live browser using the Playwright MCP tools (mcp__playwright__browser_*).
Do NOT write or run Playwright CLI specs, and do NOT edit any code. This is a test pass only: record what you see.

## Setup
- App: http://localhost:3000 (dev server is already running). If it is not reachable, stop and tell me.
- Sign in at /auth/v1/login. Seeded accounts all use the password in SEED_USER_PASSWORD from .env.local:
  ceo@gce.local, marketing_specialist@gce.local, sales_manager@gce.local, head_accountant@gce.local,
  account_manager@gce.local, confidential_informant@gce.local, customer@gce.local.
  Super Admin: <PUT THE EMAIL YOU PROMOTED HERE>.
- Sign out between roles. Take a screenshot for every FAIL and for each key screen.
- Background: docs/tasks/T06.md and docs/implementation-plan/t06-reviewer-changes/phase-1.md … phase-12.md.

## Test cases (report PASS / FAIL / BLOCKED for each, with one line of evidence)

### A. Marketing Specialist — /marketing_specialist/vehicles  (phase 3)
1. Open Add Vehicle. Stock Code is pre-filled with the next GCE number after the highest existing one, and is read-only.
2. Make, Model and Year are dropdowns. Model is disabled until a Make is chosen; changing Make clears Model.
3. Type something in a few fields, open a dropdown, then click elsewhere on the page without choosing. The form stays open and keeps the typed data.
4. Try to save with VIN, Plate, Engine or Chassis empty: each shows a "required" error.
5. Fill everything and save. The vehicle appears with the stock code shown in step 1.
6. Propose a price for that vehicle (needed for section B).

### B. CEO — vehicles  (phase 4)
1. /ceo/vehicles: the row menu has only "View Details" (no Edit, no Delete).
2. Open the vehicle from A6. A pending-price bar shows Approve and Request Revision.
3. Request Revision: a dialog asks for a reason; the confirm button is disabled until a reason is typed. Submit it.
4. Sign in as Marketing Specialist: the vehicle page shows "Price revision requested" with that reason, and the notification bell has an item that opens the car.
5. As Marketing, propose a price again. As CEO, click Approve: an "Are you sure you want to approve this?" dialog appears; confirm. The car becomes Available and shows in /customer/showroom.

### C. CEO — dashboard and settings  (phases 1, 5)
1. /ceo/dashboard shows a "Forecast for <next month>" card with expected sales, expected income and a "Likely between" range.
2. Sign in as Sales Manager: the forecast card is NOT shown.
3. As CEO, open Settings in the sidebar. Change Financing profit from 10 to 12 and save. The example amount updates; a success toast appears.
4. Check that the new percentage shows on the public home page ("Financing +12%") and in the customer financing estimate (1,000,000 → 1,120,000). Then set it back to 10.
5. Sign in as Sales Manager and open /sales_manager/settings directly: you get /unauthorized.

### D. Super Admin  (phase 2)
1. Sign in as the Super Admin. You land on the Users page; the sidebar shows only Users, Roles and Settings.
2. Users, Roles and Settings all open and load data.
3. Open /super_admin/dashboard, /super_admin/transactions and /super_admin/finance directly: each one is blocked (/unauthorized or no data).

### E. Registration  (phase 6)
1. Signed out, open /auth/v1/register. Both agreement checkboxes are disabled.
2. Click "Read the Terms and Conditions": "I have read this" is disabled until you scroll to the end. Click it; only the Terms checkbox unlocks.
3. Do the same for the Company Policy. Both checkboxes can now be ticked.
4. (Optional) Register a new account with a test email. After signing in, the tutorial dialog appears (see H).

### F. Customer — buying with financing  (phases 7, 8)
1. As customer, open an available car in the showroom: VIN, plate, engine and chassis numbers are not shown. In the browser network responses for the showroom page, check that none of those values appear.
2. Start a buy request and choose In-House Financing. Pick a term. The hint shows a monthly amount "after the 10% downpayment".
3. The Loan calculator appears. Enter a monthly income, registration and docs stamp. Each term shows a monthly payment and "Likely" or "Stretch"; cash needed upfront updates.
4. Documents section shows three boxes: Valid ID #1, Valid ID #2, Proof of billing, each with a status ("Missing" at first).
5. For Valid ID #1: the Front/Back uploads stay disabled until an ID type is chosen. Upload a small image for the front: the status changes to "Uploaded, being checked". Valid ID #2 cannot pick the same ID type.
6. Upload the rest so all five files are present. Send the request.

### G. Staff — financing and signing  (phases 7, 8, 9)
1. Sales Manager: approve the request from F. A confirmation dialog appears for Approve.
2. On the financing panel, the propose form shows "Payment term (chosen by the buyer)" with the customer's term and a calculated Monthly payment. There is NO term or monthly payment input. Send to the Head Accountant.
3. Head Accountant: Approve and "Return for revision" each open an "Are you sure?" dialog. Approve.
4. CEO: Confirm opens a dialog. Confirm.
5. Continue the flow until the contract is approved (the Sales Manager writes it, the Head Accountant approves it; both Approve and Return ask for confirmation).
6. Customer: "Your contract" offers E-signature and Face-to-face.
   - E-signature: "Sign contract" stays disabled until a name is typed AND a signature is drawn on the pad. Sign it; the page shows that you signed it.
   - On a second transaction (if available), choose Face-to-face. The Sales Manager sees "The buyer chose to sign face-to-face" and "Mark signed in person" (at a GCE visit). Clicking it marks the contract signed.

### H. Tutorial  (phase 10)
1. With a brand-new account, the tutorial shows "Step 1 of N" and the Next, Skip and (after step 1) Back buttons.
2. Click Next to the last step, then Finish. Reload: the tutorial does not return.
3. Existing seeded accounts do NOT see the tutorial.

### I. Confirm dialogs elsewhere  (phase 9)
Each of these opens an "Are you sure?" dialog before anything happens. Cancel must change nothing.
- Payroll run Approve/Reject (Account Manager or CEO, /payroll).
- Employee request Approve/Reject (/employee-requests, Review request).
- Inspections vehicle document Verify/Reject.
- Transaction payment "Verify" and transaction document "Verify".
- Delivery "Reject: not serviceable" and "Confirm and notify buyer".
- Sell-offer Reject, and the CEO's ceiling Approve/Reject.

### J. Customer — recommendations  (phase 12)
1. /customer/recommendations: Make, Body type, Number of seats and Purpose are labelled "(required)"; the others are labelled "(optional)".
2. Submit with a required field empty: an error shows under it.
3. Fill only the required fields and submit: results appear.
4. The Condition, Fuel and Transmission dropdowns open and can be changed.

### K. Payment reminders  (phase 11). Only if CRON_SECRET is set in .env.local
1. Open http://localhost:3000/api/cron/payment-reminders without a header: the answer is 401.
2. With `Authorization: Bearer <CRON_SECRET>` (use browser_evaluate with fetch): the answer is JSON like {"sent":…,"failed":…}.
   If RESEND_API_KEY is not set, failures saying "Email is not set up" are expected: mark it BLOCKED, not FAIL.

## Report
- A table: section and number | PASS/FAIL/BLOCKED | evidence (one line) | screenshot name.
- For each FAIL: the URL, the steps, what you expected and what happened, and any console or network errors (browser_console_messages, browser_network_requests).
- Save the report as docs/implementation-plan/t06-reviewer-changes/test-run-<date>.md and tell me the totals.
