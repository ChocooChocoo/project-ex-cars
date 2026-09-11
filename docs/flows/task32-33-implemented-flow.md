# GCE — How It Works Now: Walkthroughs for Task 32 & Task 33

**What this is:** a plain-language, scenario-based walkthrough of the GCE system as it works today.

**Who it's for:** GCE staff, the client, and anyone testing the system who wants to know *"what do I
actually click, and what happens next?"*

**How to read it:** each scenario follows one person doing one job, from the first click to the last.
Boxes marked **🔧 Fixed in Task 33** show something that used to go wrong and now works.

**The short version:** Task 32 added the features GCE asked for. Task 33 fixed the things that were
broken in those features — photos showing up as file names instead of pictures, error messages when
saving or uploading, a stuck approval step, a pop-up window closing by itself, and a menu item the
Account Manager couldn't find.

---

## The people in these scenarios

| Person | Role | What they're responsible for |
|---|---|---|
| **Maria** | Customer | Buying a car |
| **Juan** | Customer | Selling his car |
| **Patrick** | Sales Manager | Processes transactions, reviews sell offers |
| **Elena** | Head Accountant | **The only person who can verify documents** |
| **Carlos** | CEO | **The only person who can approve or reject** |
| **Ana** | Account Manager | Customer accounts, walk-ins, attendance, HR |
| **Ben** | Confidential Informant | Field cases, assigning the mechanic |
| **Migs** | Mechanic | Inspects cars, looks at the photos customers sent |

> **Two rules to remember above all else:**
> 1. **Only Elena can verify.** Nobody else — not Sales, not the CEO, not Ana. This stops anyone from
>    rubber-stamping their own paperwork.
> 2. **Only Carlos can approve.** He cannot approve until Elena has verified **two valid IDs and one
>    proof of billing**. The system physically stops him otherwise.

---

# Scenario 1 — Maria buys a car

### Step 1 — She checks what to prepare

Maria logs in as a customer. Her menu has **Showroom**, **Find Your Car**, **My Inquiries**,
**Transactions**, **Request a Car**, **Sell Vehicle**, **Buying Guide**, **Favourites**.

She clicks **Buying Guide**. 🔧 *Task 32 added this page.*

She sees a 4-step list:

1. **Prepare two valid IDs** — current, readable, in her name, with a list of accepted ID types
2. **Prepare one proof of billing** — a recent electric, water, or internet bill in her name
3. **View the car and agree on payment** — cash, financing, cheque, or down payment
4. **Choose how to receive the car** — delivery, a CALABARZON meet-up, or a GCE visit

She now knows exactly what to bring before visiting. She clicks **Browse Showroom**.

### Step 2 — She finds a car and starts the purchase

She browses the showroom, finds a car, and starts a purchase. A new transaction appears in her
**Transactions** list. A progress bar shows where she is:

`Requested → Details → Documents → Review → Complete`

### Step 3 — She fills in her purchase details

On the transaction page she sees **Purchase Details** and fills in:

- **Payment Method** — Cash / Financing / Cheque / Down Payment
- **Final Price**
- **Viewing Arrangement** — Arrangement Type: Delivery, CALABARZON Meet-up, or GCE Visit
- **Schedule** — when she wants to receive or view the car
- **Location**
- **Notes**

She clicks **Save Details** and gets a green "Details saved." confirmation.

> **🔧 Fixed in Task 33 — "Save Details" used to fail.**
> Maria would pick a schedule, click **Save Details**, and get a red error about a security policy.
> Her viewing arrangement was never saved, so GCE never knew when she was coming.
> **Now:** the arrangement saves normally, and it shows up on her page and on the staff's page.

### Step 4 — She uploads her documents

Still on the same page, under **Documents**, Maria sees a reminder:

> *"GCE requires two valid IDs and one proof of billing to complete your purchase."*

And a progress line: **`1/2 valid IDs verified · proof of billing pending`**

She uploads:
1. Her passport, choosing **Valid ID** → **Passport** → picks the file → clicks **Upload**
2. Her driver's license, choosing **Valid ID** → **Driver's License** → **Upload**
3. Her electric bill, choosing **Proof of Billing** → **Upload**

Each time she gets: *"Valid ID uploaded. GCE staff will verify it."*

Now her Documents list shows each item with its picture, ready to view.

> **🔧 Fixed in Task 33 — her uploads used to show as text, not pictures.**
> Before, a document in the list appeared as a grey line reading only *"Valid ID — pending"*. The actual
> scan was invisible; all anyone could see was an internal file location like a folder path. If GCE
> wanted to look at the ID, they couldn't from this screen.
> **Now:** each uploaded image appears as an actual picture on the page. PDFs show an **Open valid ID**
> link instead. If a picture can't be displayed for any reason, it says *"Preview unavailable"* rather
> than showing a confusing file path.

### Step 5 — Patrick (Sales Manager) processes it

Patrick opens **Transactions**, finds Maria's purchase, and opens it. He reviews it and clicks
**Move to Review**.

The transaction is now marked **Under Review**. The staff page shows an **Approval flow** strip:

`Processed (Sales) → Verified (Head Accountant) → Approved (CEO) → Sold`

The **Processed** step is now green.

### Step 6 — Elena (Head Accountant) verifies the documents

Elena logs in. She opens the transaction and sees Maria's three documents, each marked **pending**,
each with **Verify** and **Reject** buttons next to it.

She looks at the passport image, then clicks **Verify**. Then the license — **Verify**. Then the
electric bill — **Verify**.

The transaction's document status switches to **verified**, and the **Verified** step in the approval
flow turns green.

> **⚠️ Only Elena sees those Verify / Reject buttons.** Sales, the CEO, and the Account Manager can see
> the documents but cannot verify them.

> **🔧 Fixed in Task 33 — "Not authorized."**
> When Elena tried to upload or verify a document, she got a blunt **"Not authorized"** message even
> though looking after documents is her main job. Her screen even showed her an Upload button that the
> system then refused to accept.
> **Now:** Elena can upload documents and verify them normally, and the verification counter updates
> correctly.

> **🔧 Fixed in Task 33 — verification could get "stuck".**
> The status badge only updated if Elena happened to verify the *last valid ID* after the bill. If she
> verified the proof of billing last — the natural order — the transaction kept showing as still
> waiting on documents even though she was finished. Staff would chase her for something she'd already
> done.
> **Now:** the status updates correctly no matter which document she does last. If she rejects one, the
> status shows as rejected instead of silently staying "pending".

### Step 7 — Carlos (CEO) approves

Carlos opens the same transaction. Because Elena has verified everything, he sees **Approve (CEO)**
and **Reject (CEO)**.

He clicks **Approve (CEO)**. The transaction becomes **Approved**, and the **Approved** step turns
green.

> **🔧 Fixed in Task 33 — approval used to be blocked or wrongly forgeable.**
> Two problems, pulling in opposite directions. Carlos kept getting told documents weren't verified
> even when they were — a knock-on effect of Elena's upload problem. At the same time, the underlying
> rules were loose enough that a customer could have marked their own documents as already-verified,
> which would have let an unverified purchase sail through to approval.
> **Now:** Carlos's approval works properly once Elena has verified, and nobody can mark their own
> documents as verified. His approval means something.

### Step 8 — The car is marked sold

Someone from Sales, the CEO, or Elena clicks **Complete**. The transaction becomes **Completed**, the
**Sold** step turns green, and the car is automatically marked as sold in inventory.

**Maria's purchase is done.** 🎉

---

# Scenario 2 — Juan sells his car

### Step 1 — He opens the sell form

Juan logs in, clicks **Sell Vehicle** in his menu, and lands on **Sell Your Vehicle**.

### Step 2 — He describes the car and attaches photos

He fills in **Vehicle Details**: Make, Model, Year, Mileage, Condition (Excellent / Good / Fair /
Needs Repair / Other), Offered Amount, and Description.

Then he reaches **Vehicle Photos** — marked with a required asterisk:

> *"Vehicle Photos \* (1–6 photos, JPEG/PNG/WebP, max 5MB each)"*

He picks 4 photos of his car — front, back, interior, and the scratch on the door.

**Optional:** he opens **Known issues checklist** and ticks the parts with problems, so the mechanic
knows what to look at first. 🔧 *Task 32 added this.*

He clicks **Submit Vehicle**.

> **🔧 Task 32 rule:** he **must** attach at least one photo. Submitting without one is refused with
> *"At least one vehicle photo is required."*

> **🔧 Fixed in Task 33 — a quiet accessibility bug in this form.**
> The labels on this form (Make, Model, Year, and the rest) weren't properly tied to their input boxes.
> Screen readers announced the fields as unlabelled, and automated tests couldn't find them at all —
> which is how the problem was caught.
> **Now:** every field is properly labelled and the form is testable.

### Step 3 — The photos are visible to staff

Migs the Mechanic and Ben the Confidential Informant can both **see** Juan's photos and his checklist
— but cannot change them. 🔧 *Task 32 granted this read access deliberately, so inspection can
prioritise the damaged parts.*

A mechanic or confidential informant opens the **inspection** for Juan's car and finds the section
titled **Vehicle photos & condition** there, beside the inspection report. On the staff transaction
page the same section appears for the roles that may open transactions.

> **🔧 Fixed in Task 33 — the photos were invisible.**
> This was the most visible complaint. The section showed a line per photo reading
> *"Photo attached (private storage: folder/filename.jpg)"* — a storage location, **not the actual
> photo**. Staff had to believe a file existed; they could not see Juan's car.
> **Now:** the real photos appear in the section. An **Assign Mechanic** decision can be made by
> actually looking at the vehicle.

> **🔧 Fixed after testing — the mechanic could not open the section at all.**
> Task 32 made the photos readable to the mechanic but left them on a page he is not allowed to open:
> the transaction list and detail are limited to the CEO, Account Manager, Head Accountant, Sales
> Manager, and Confidential Informant. The mechanic saw a "no permission" screen on the list and a
> **"Page not found."** on a specific transaction — two different messages for one denial.
> **Now:** the mechanic sees the photos and the customer's condition checklist on the inspection he is
> assigned, read-only, and both denial screens say the same thing. A mechanic still cannot browse
> transactions, which is deliberate: he needs the car he is inspecting, not the whole ledger.

### Step 4 — Patrick reviews the sell offer

Patrick opens the transaction, types a **Valuation**, adds **Review Notes**, and chooses **Accepted** or
**Rejected**. On acceptance the transaction moves to **Approved** and proceeds through the same
approval ladder as a purchase.

---

# Scenario 3 — Ana sets up a walk-in customer at the counter

A customer walks into the GCE office with no online account. Ana handles it.

### Step 1 — She finds the feature 🔧 Fixed in Task 33

Ana logs in as **Account Manager**. In her left menu she sees a dedicated item:

**Create Walk-In**

She clicks it. The **Create Walk-in Account** window opens immediately, ready to fill in.

If she instead uses the search box at the top of the page (or presses `⌘J`) and types "walk-in", the
same option appears for her.

> **🔧 Fixed in Task 33 — Ana couldn't find it.**
> The feature technically existed, but it was tucked away as a small button inside a page called
> **Staff Records**, sitting among staff lists and performance reviews. Nothing in the menu said
> "walk-in" anywhere. Staff testing reported they simply couldn't locate it.
> **Now:** there's an explicit **Create Walk-In** menu item for the Account Manager that jumps straight
> to the form. It also appears in the search box.

### Step 2 — She creates the account

She fills in:
- **Full Name**
- **Email**
- **Password** (minimum 8 characters)

She clicks **Create Account**. She gets *"Walk-in account created."* and the window closes. The new
customer can now be signed in and served like any other.

### Step 3 — If something goes wrong, nothing is left half-done

If the account can only be partly created, the system undoes the part that succeeded and tells Ana what
went wrong — rather than leaving a broken half-account behind while claiming success.

> **🔧 Fixed in Task 33 — it used to report success without doing the work.**
> The old version recorded the wrong value for *who created the account* (literally the word "staff"
> where a person's ID was required). That write failed silently, but the screen still said
> "Walk-in account created." Ana would have no idea.
> **Now:** the system records Ana as the creator automatically, checks every step, and rolls back if
> anything fails.

### 🔒 What Ana's colleagues see

| Person | Do they see **Create Walk-In**? |
|---|---|
| Ana (Account Manager) | ✅ Yes |
| Carlos (CEO) | ❌ No |
| Patrick (Sales Manager) | ❌ No |
| Everyone else | ❌ No |

> **🔧 Fixed in Task 33 — an important leak.**
> This is the subtle one. The left menu was correctly hidden from everyone but Ana — but the **search
> box** listed every screen in the system, regardless of who was logged in. So Patrick or Carlos could
> type "walk-in" and be offered the shortcut. Clicking it took them to a page that refused to show the
> form, so nothing harmful happened — but the option should never have been shown to them.
> **Now:** search only offers what that person is actually allowed to use.

> **Note — what changed from the original plan:** the CEO used to have an emergency override to create
> walk-in accounts. GCE's decision was that this belongs to Ana alone, so the override was removed.
> Sales Managers can still create walk-in **transactions**, which is a different thing.

---

# Scenario 4 — Ben creates a field case

Ben is the Confidential Informant, and field cases are his main job.

### Step 1 — He opens the form

Ben logs in and clicks **Field Cases**. He sees a list of existing cases with quick filters:
**All**, **Needs assignment**, **Assigned to me**.

He clicks **Create Field Case**.

### Step 2 — He picks a case type and links it

The **Create Field Case** window opens with:

- **Case Kind** — Acquisition, Delivery, Recovery, or Sourcing (he only sees the kinds his role may
  create)
- **Transaction (at least one link required)**
- **Vehicle (at least one link required)**
- **Assigned Worker**
- **Worker Type** — Confidential Informant or Mechanic
- **Schedule (optional)**, **Location (optional)**, **Instructions (optional)**

He must link at least one of transaction or vehicle, and assign a worker. Otherwise he gets a clear
message explaining what's missing — the window stays open so he can fix it.

### Step 3 — He chooses the transaction 🔧 Fixed in Task 33

He opens the **Transaction** dropdown. Instead of a wall of cryptic codes, he sees a neatly organised
list, grouped by kind:

```
None
No transaction

Buy
Buy · Under Review · Maria Santos · 2020 Toyota Vios · GCE-1042 · a1b2c3d4
Buy · Pending · Juan Cruz · 2018 Honda Civic · GCE-0987 · e5f6g7h8

Sell
Sell · Approved · Pedro Reyes · 2019 Mitsubishi Mirage · GCE-0912 · i9j0k1l2
```

> **On the headings:** they are plain — `None`, `Buy`, `Sell`. An earlier draft of this document drew
> them as `— Buy —`, which the screen never has. The plain form is the convention used by every other
> grouped list in the app, so the illustration was the thing out of step, and it has been corrected
> here rather than by adding dash decoration to one dropdown.

He can tell instantly which customer and which car each one is. The list scrolls inside its own box
rather than taking over the screen.

He does the same for **Vehicle**, which is sorted by year, make and model.

> **🔧 Fixed in Task 33 — two problems here.**
>
> **First, the window kept closing.** Ben would click the dropdown, pick a transaction, and the whole
> **Create Field Case** window would vanish — throwing away everything he'd typed. The cause was a
> clash between the pop-up window and the dropdown, which the browser draws in a separate layer; the
> browser treated a click on the dropdown as a click *outside* the window and closed it. Reported as
> "clicking fields closes the modal."
> **Now:** the window stays open while he picks. Only **Cancel**, the **X**, or pressing Escape closes
> it.
>
> **Second, he couldn't tell transactions apart.** Each entry read something like
> `buy · under_review · a1b2c3d4` — a type, a status, and the first characters of an internal ID. With
> dozens of transactions he had no reliable way to pick the right one, and choosing the wrong car would
> send a mechanic to the wrong place.
> **Now:** entries are grouped by kind and show the customer name, the vehicle, and the stock code.
>
> **Also fixed:** with many transactions, the dropdown grew so tall it covered the screen. Both
> dropdowns are now limited in height and scroll.

### Step 4 — He creates it

Ben clicks **Create** and gets *"Field case created."* The case appears in the list, and he can later
**Assign Mechanic** — a responsibility that belongs to the Confidential Informant. 🔧 *Task 32 moved
this from Sales Manager to Ben.*

---

# Scenario 5 — A quick look at the photo fix (for managers)

This one matters to anyone who reviews documents.

**Before Task 33:** when a customer uploaded a driving licence or a car photo, the screen showed a line
of text with an internal file location. You could confirm *that* a file had been uploaded. You could
not **see** it.

**After Task 33:** you see the picture.

- Images (JPEG, PNG, WebP) appear as pictures
- PDFs appear as **Open …** links that open in a new tab
- If a picture can't load, you see *"Preview unavailable"* — never a confusing file path
- This works in three places: the customer's Documents, the staff Documents, and the staff
  **Vehicle photos & condition** section

**Two safety points worth knowing:**
1. The pictures are shown through secure, temporary links that expire after **one hour**. Refreshing
   the page issues fresh ones.
2. The internal file location is never sent to the browser at all — so it can't leak through the page,
   even for someone inspecting the page's code.

---

# Scenario 6 — What these bugs were costing GCE

Before Task 33, this chain of problems could waste real staff time:

1. Maria saves her viewing schedule → **fails** → she may give up, or phone in confused
2. Elena gets **"Not authorized"** when uploading → documents can't be verified
3. Even when she does verify, the status is **stuck** if she does the bill last → staff chase her
4. Carlos sees documents as "not verified" → **cannot approve** → the sale stalls

Every step now works, and the whole chain from Maria's first click to **Sold** completes without a dead end.

---

# Who can do what — the cheat sheet

| Job | Who can do it |
|---|---|
| Read the Buying Guide | Customer |
| Submit a car for sale (with photos) | Customer |
| Save purchase details and viewing arrangement | Customer |
| Upload their own IDs and proof of billing | Customer |
| **Process** a transaction (Pending → Under Review) | Sales Manager, CEO, Account Manager |
| **Verify** documents | **Head Accountant only** |
| **Approve / Reject** a transaction | **CEO only** |
| Mark a car **Sold** (Complete) | Sales Manager, CEO, Head Accountant |
| Create a **walk-in account** | **Account Manager only** |
| Create a **walk-in transaction** | CEO, Sales Manager, Account Manager |
| Create a field case | CEO, Confidential Informant, Sales Manager, Head Accountant *(Recovery: CEO + Head Accountant)* |
| **Assign the mechanic** in a field case | Confidential Informant, CEO |
| Check attendance | **Account Manager only** |
| Read attendance | Account Manager, CEO, Head Accountant |
| See sell photos and the condition checklist | Mechanic, Confidential Informant (view only) — on the **inspection detail** for the mechanic, on the transaction page for the Confidential Informant |
| Open the transactions list | CEO, Account Manager, Head Accountant, Confidential Informant, Sales Manager |

---

# Quick reference — screens and buttons

**Customer menu:** Showroom · Find Your Car · My Inquiries · Transactions · Request a Car ·
Sell Vehicle · Buying Guide · Favourites

**Customer buttons:** Save Details · Upload · Browse Showroom · Submit Vehicle · Cancel Transaction

**Staff transaction page:** Approval flow · Status Triage · Transaction Details · Documents ·
Vehicle photos & condition · Record payment · Record paperwork · Verify · Reject

**Inspection detail (mechanic):** Checklist · Summary · Vehicle photos & condition (read-only)

**Staff transition buttons:** Move to Review · Approve (CEO) · Reject (CEO) · Complete · Cancel

**Field Cases:** Create Field Case · Case Kind · Transaction · Vehicle · Assigned Worker · Worker Type ·
Assign Mechanic · Update

**Walk-in:** Create Walk-In (menu) → Create Walk-in Account (window) → Create Account

**Attendance:** checked by Account Manager; readable by Account Manager, CEO, Head Accountant

---

# Still open

1. **Branding is deferred** — GCE's logo, company details, and final imagery are on hold until GCE can
   test the system directly. This was a deliberate decision, not an oversight.
2. **The Field Cases window should be re-tested with real GCE data** — it works, but a handful of test
   entries isn't the same as months of real transactions.
3. **Some older automated browser checks are failing** for reasons unrelated to the work above. They're
   pre-existing and don't affect anything described in this document — they concern a vehicle list page
   and some staff pages.
   > **Partially explained later:** the vehicle list page was reporting a broken column every time it
   > drew a row, and the Vehicle column it belonged to rendered **blank**. Both are fixed; see the
   > resolution log in [`task32-33-test-findings.md`](./task32-33-test-findings.md).
4. **A few things were verified through the data rather than by clicking**, specifically that the CEO's
   Approve button behaves correctly end-to-end. The rules behind it were confirmed against real
   records, and the button's logic is covered by automated tests.
