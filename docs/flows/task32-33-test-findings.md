# GCE — Testing Findings: What Needs Fixing

**What this is:** the list of problems found while testing the system by hand, following every scenario
in [`task32-33-implemented-flow.md`](./task32-33-implemented-flow.md) click by click.

**Tested on:** 11 September 2026, against the running app on `http://localhost:3000`, signed in as the
real seeded accounts (customer, Sales Manager, Head Accountant, CEO, Account Manager, Confidential
Informant, Mechanic).

**How to read it:** every item has two halves.

- **In plain terms** — what a person actually sees or experiences.
- **In technical terms** — where it lives in the code and why it happens.

**Confidence labels** — please don't treat these as equally proven:

| Label | Meaning |
|---|---|
| ✅ **Confirmed** | Reproduced with evidence. Safe to schedule. |
| ⚠️ **Needs a recheck** | Something looked off once, but it wasn't proven. Verify before filing. |
| ⬜ **Not tested** | Nobody has tried this. Unknown, not broken. |
| ✅ **Fixed** / **Rechecked** | Resolved, or re-verified with no defect. See the resolution log at the end. |

**Status as of this revision.** Every confirmed item below has been fixed or explained, and the two items
that needed a recheck were re-verified. The original wording of the findings is preserved; corrections
are added as blockquotes, so the record of what was believed at test time survives alongside what turned
out to be true. The remaining open work is in **List 5** (test data — a business decision) and
**List 6** (paths nobody has clicked through — a testing gap).

**The headline:** Task 32 and Task 33 work. The purchase ladder runs end to end
(`Requested → Details → Documents → Review → Complete`), documents render as real images, Elena can
verify, Carlos can approve, and the car is marked sold automatically. The items below are what's left.

---

# Summary — at a glance

| # | What | Who's affected | Severity | Status |
|---|---|---|---|---|
| 1.1 | Mechanic can't see sell photos, but the document says he can | Migs (Mechanic) | **High** — product vs. document disagree | ✅ Fixed |
| 1.2 | Vehicle list throws errors for Sales Manager | Patrick (Sales Manager) | Medium | ✅ Fixed |
| 1.3 | Mechanic gets two different "no access" screens | Migs (Mechanic) | Low | ✅ Fixed |
| 2.1 | "Details saved." confirmation not seen | Maria (Customer) | Low | ⚠️ Rechecked — no defect |
| 2.2 | "Field case created." confirmation not seen | Ben (Confidential Informant) | Low | ⚠️ Rechecked — no defect |
| 3.1 | Transaction list shows duplicated labels | Customers | Low | ✅ Fixed |
| 3.2 | Dropdown headings differ from the document | Ben (Confidential Informant) | Cosmetic | ✅ Document corrected |
| 3.3 | Walk-in link leaves a leftover tag in the address bar | Ana (Account Manager) | Low | ✅ Fixed |
| 4.1 | Every customer page broke after a code change | Everyone | **High** — already fixed | ✅ Fixed |
| 4.2 | Background errors in the server log | Everyone | Medium | ✅ Fixed / not reachable |
| 4.3 | A leftover "disabled" file next to the active one | Maintainers | Low | ✅ Fixed |

**Two corrections to the write-up below, found while implementing the fixes.** Both matter, so they are
called out here rather than buried:

- **1.1** claimed *"the data is already readable; only the surface is missing."* That was wrong. The
  database did grant mechanics the sell photos and the checklist, but `transactions` had **no** read
  policy for the mechanic role in any migration, so the transaction could not be located at all. The
  fix needed a scoped data path, not just a screen.
- **1.2** claimed the page *"still looks fine."* It did not. The Vehicle column rendered **blank** in
  every row; the console errors were the visible half of a real display fault.

The outcome of each item is recorded in the **resolution log** at the end of this document.

---

# List 1 — Correctness problems (confirmed)

## 1.1 — The Mechanic cannot see sell photos, but the document promises he can

✅ **Confirmed — fixed**

**In plain terms.**
The document says Migs the Mechanic and Ben the Confidential Informant can both *see* Juan's car
photos and the damage checklist. Ben can. **Migs cannot.**

When Migs tries to open the transactions list he is told *"You do not have permission to view the
requested content."* His menu has no **Transactions** item at all — only Vehicles, Inspections, Field
Cases, and Announcements. And the inspect-a-car screen he *does* have shows no car photos and no
checklist.

So the one person whose job is to inspect cars — the person the photos and checklist were added for in
Task 32 — is the one person who can't look at them.

**In technical terms.**
Three layers disagree, and only one of them is wrong:

1. **Database — correct, agrees with the document.** Migration
   `supabase/migrations/00044_task32_sell_visibility.sql` deliberately grants `mechanic` read access:
   a `SELECT` policy on `sell_details` (line 7–17), a `SELECT` policy on `transaction_documents` where
   `document_kind = 'sell_photo'` (line 20–31), and a matching `storage.objects` policy for the
   `transaction-documents` bucket (line 36–46). Mechanics are named explicitly in all three.

2. **Route guard — blocks the mechanic.** `src/app/(staff)/transactions/page.tsx` line 14:
   ```ts
   await requireRole(["ceo", "account_manager", "head_accountant", "confidential_informant", "sales_manager"]);
   ```
   `mechanic` is not in the list, so the list route redirects to `/unauthorized`. The detail route
   `src/app/(staff)/transactions/[id]/page.tsx` has no `requireRole` of its own and relies on RLS, so
   it returns a bare `404` (the row is filtered out before the `notFound()` on line 22).

3. **UI surface — never rendered.** The `Vehicle photos & condition` block exists in exactly one
   place: `src/app/(staff)/transactions/[id]/_components/transaction-detail-sidebar-v1.tsx` line 355–388,
   gated on `showSellExtras` (line 133) which requires `kind === "sell"`. That component is only
   reachable through the staff transaction detail route — which the mechanic can't open. The
   mechanic's own detail surface, `src/app/(staff)/inspections/[id]/page.tsx`, renders condition
   *scores* and findings but no sell photos and no submitted checklist.

**Fix options — someone needs to decide which:**
- **Preferred:** expose the sell photos and checklist on the mechanic's inspection detail screen
  (`inspections/[id]`), and add `"mechanic"` to the `requireRole` list if he is also meant to browse
  transactions. The data is already readable; only the surface is missing.
- **Alternative:** correct the flow document and the cheat sheet to say *Confidential Informant only*,
  and state plainly that the mechanic sees the checklist through the inspection report instead.

> ⚠️ **Correction — "the data is already readable" was wrong, and the "preferred" option above was
> not implementable as written.** Verified against the migrations: `public.transactions` has no
> `SELECT` policy for `mechanic` anywhere — `00011_phase5_schema.sql` names only ceo, sales_manager,
> account_manager, head_accountant, and confidential_informant, and no later migration widens it.
> So adding `"mechanic"` to the route guard would have produced an **empty list**, and the detail route
> would still have 404'd, because RLS removes the row before `notFound()` is reached. There is also no
> view or `SECURITY DEFINER` function that reads `transactions`, so no bridge already existed.
>
> The `00044` policies are scoped to *rows*, not to *a mechanic's own work*: they let a mechanic read
> **every** sell submission's `sell_details` — including the offered amount, valuation, review notes,
> and decision — plus every sell photo in the bucket. That is wider than the documented intent
> ("see the photos of the car I am inspecting") as well as unusable, since none of it can be tied to a
> vehicle without the blocked `transactions` read.

**What was actually done.** The flow document was kept, and "preferred" was implemented *narrowly*
rather than by widening the transaction policies. A new `SECURITY DEFINER` function
(`00047_task32_inspection_sell_submission.sql`) bridges **inspection → sell submission** and returns
only the sell `transaction_id` and the submitted `condition_items`. It authorises the assigned mechanic
only when `vehicle_inspections.mechanic_id = auth.uid()` and the role is an active `mechanic`; an
active `confidential_informant` may also read it. The CEO, Account Manager, Sales Manager, and Head
Accountant are deliberately **not** granted through this function — they already have their own
transaction access. The inspection detail page then loads only that transaction's `sell_photo`
documents, signs the private paths server-side, resolves the checklist ids to their names, and renders
a read-only `Vehicle photos & condition` card.

The mechanic still cannot browse transactions, and that remains deliberate: he needs the car he is
inspecting, not the ledger. See 1.3 for the denial-screen half of this fix.

**Why this matters most:** it is the only place where the shipped product and the client-facing
document actively contradict each other.

---

## 1.2 — The vehicle list throws errors for the Sales Manager

✅ **Confirmed — fixed**

**In plain terms.**
When Patrick the Sales Manager signs in he lands on the Vehicles page — and behind the scenes the page
reports 60 errors. The page still *looks* fine, which is what makes it easy to miss. It's the same
kind of problem the flow document already lists under **"Still open"** item 3.

> ⚠️ **Correction — "the page still looks fine" was wrong.** It was not fine. The **Vehicle column
> rendered blank in every row**; the console errors were the visible half of a real display fault, not
> just noise. `@tanstack/table-core` only reports the missing column in development, and `row.getValue`
> returns `undefined` rather than throwing — which is exactly why this survived seven commits and went
> unnoticed: in production it was silently blank, with no message at all.

**In technical terms.**
`/sales_manager/vehicles` logs, repeatedly:
```
[Table] Column with id 'make' does not exist.
[Table] Column with id 'model' does not exist.
[Table] Column with id 'year' does not exist.
```
Thrown from `@tanstack/table-core`'s `getColumn` → `getValue`, called from a cell renderer. A column
definition is reading `row.getValue("make" | "model" | "year")` while no column with that `id` exists in
the table's column array — the accessors and the `id`s are out of sync. It trips once per rendered row
(hence 60).

Not a crash, but it means the vehicle table is rendering from a partly-broken definition and any future
change to those columns will fail quietly. **This page is `landingPath()`'s destination for
`sales_manager`** (`src/lib/routing/paths.ts` line 64), so it is the first thing that role sees every
day — worth fixing for that reason alone.

**Fixed:** the composite `vehicle` column declares neither `accessorKey` nor `accessorFn`, so it has no
value to read; the cell now reads `make`, `model`, and `year` straight off the row (`row.original`),
which matches how this file's own `search` accessor already reads them. A missing year renders an em
dash instead of nothing. A regression test renders the real column set and fails if the table logs a
missing-column error **or** if the Vehicle cell comes back blank — verified red against the old code.
Because every `/{role}/vehicles` URL resolves to this one table, all eight staff roles that can reach
Vehicles were affected, not just Patrick.

---

## 1.3 — The Mechanic gets two different "no access" screens

✅ **Confirmed — fixed**

**In plain terms.**
If Migs browses to the transactions list, he gets a polite *"Unauthorized Access — contact your
administrator"* page. If he opens a specific transaction address directly, he gets a blunt
*"Page not found."* Two different messages for the same situation is confusing — it reads like the page
doesn't exist rather than like he isn't allowed in.

**In technical terms.**
Inconsistent denial handling. The list route calls `requireRole`, which redirects to `/unauthorized`
(with a friendly screen). The detail route has no guard and returns `notFound()` → the 404 screen.
Everywhere else in the app the pattern is a redirect to `/unauthorized`. The detail route should adopt
the same guard so both paths produce the same, accurate message.

**Fixed:** the allowed list now lives once, as `TRANSACTION_VIEWER_ROLES` in `src/lib/auth/roles.ts`, and
both routes pass it to `requireRole`. The detail route runs the guard **before** its row fetch, so an
unauthorized caller redirects instead of relying on RLS to filter the row into a 404. A test asserts the
guard precedes the `.from("transactions")` call, so the two screens cannot drift apart again.

---

# List 2 — Confirmations not observed (rechecked — no defect)

Both operations **succeeded** — the data saved correctly. What I could not confirm was the
confirmation message on screen at the moment I looked. These are feedback problems **if** they are real,
not save failures. Please re-test before adding to a sprint.

> **Rechecked: both were sampling artifacts, not defects.** The code paths are correct and guarded, and
> the toast container is mounted above every route group. The original hypothesis — Sonner's 4-second
> auto-dismiss beating a post-hoc DOM sample, immediately after a `router.refresh()` round-trip — is
> consistent with everything in the source. Details under each item. **Nothing was changed.**

## 2.1 — "Details saved." was not seen

✅ **Rechecked — no defect**

**In plain terms.**
The document promises Maria gets a green *"Details saved."* message when she saves her viewing
arrangement. The save itself definitely worked — I reloaded the page and her arrangement was still
there (`GCE Visit · Sep 20, 2026 at 2:30 PM · GCE Office, Sta. Rosa, Laguna`). But I didn't see the
green message appear.

**In technical terms.**
`src/app/(customer)/my-transactions/_components/transaction-detail.tsx` line 220 does call
`toast.success("Details saved.")` on the success path, and the server action `saveBuyDetails` returned
200 with the row persisted (`POST` → `200`, logged as `ƒ saveBuyDetails({}) in 1135ms`). So the code
path exists. The likely explanations are the Sonner toast auto-dismissing before I sampled the DOM, or
a re-render. **Not proven.** Re-run the save and watch for the toast in real time.

> **Rechecked — no defect found.** The call is on the correct success branch, guarded by an explicit
> `if (result.error)` check with the error path taking `toast.error` instead, so it cannot fire on a
> failure. There is no `try`/`catch` in the handler, the trigger is a plain button (not a form submit),
> `saveBuyDetails` never calls `redirect()`, and the root layout mounts `<Toaster />` above every route
> group — verified in `src/app/layout.tsx`. The original guess was right: the toast had auto-dismissed
> (Sonner's default is 4 seconds) before the DOM was sampled after the fact. Nothing to change.

## 2.2 — "Field case created." was not seen

✅ **Rechecked — no defect**

**In plain terms.**
Same shape as above, for Ben creating a field case. The case was definitely created — the list went
from 10 to 11 cases and the new row appeared (`Acquisition · Assigned`). But I didn't catch the success
message.

**In technical terms.**
`src/app/(staff)/field-cases/_components/field-cases-client.tsx` line 285 calls
`toast.success("Field case created.")`. The dialog closed and the list revalidated, both consistent
with the success branch having run. Same sampling caveat as 2.1 — verify by watching, not by DOM
scraping after the fact.

> **Rechecked — no defect found.** Same shape as 2.1 and the same conclusion: the call is guarded by
> `if ("error" in result && result.error)` with an early return, the trigger is `type="button"`, there
> is no `try`/`catch`, `createFieldCase` never redirects, and the root `<Toaster />` covers the route.
> Nothing to change.

---

# List 3 — Display and cosmetic issues

## 3.1 — The customer transaction list shows duplicated labels

✅ **Confirmed — fixed**

**In plain terms.**
On a customer's **Transactions** list, rows that aren't tied to a specific car look odd. Instead of a
car name with a stock number underneath, both lines say the same thing:
```
Request a Car          ← the big line
Request a Car          ← the small line, meant for a stock number
```
You also see `Sell / Sell`. For request-a-car rows the real vehicle column just shows `—`. It looks
like a placeholder leaking into a spot where real information should be.

**In technical terms.**
`src/app/(customer)/my-transactions/page.tsx` lines 25–32. Both fields fall back to the *same*
expression when there is no linked vehicle:
```ts
const vehicleLabel = vehicles
  ? `${vehicles.make} ${vehicles.model} (${vehicles.year})`
  : transactionKindLabel(kind as never);          // line 25–27

subLabel: vehicles?.stock_code
  ? `Stock ${vehicles.stock_code as string}`
  : transactionKindLabel(kind as never),          // line 32 — same fallback
```
`transactions-columns.tsx` line 57–58 then renders both in the same cell, one above the other. The fix
is to make the two fallbacks differ — e.g. suppress the sub-label when the vehicle label already fell
back, or use a distinct secondary string (reference id, opened date, or `—`).

> **Correction — "the real vehicle column just shows `—`" was not true of the current code.** There is
> no em-dash fallback anywhere in the customer list; the vehicle column showed the kind label on both
> lines and never a dash. The `—` renderer the note was thinking of lives in the **staff** transactions
> "Plan" column and in the inspections vehicle column. Worth recording so nobody hunts for a dash that
> was never rendered.

**Fixed:** the row mapping moved into one pure, tested function, `buildTransactionRows`, in
`_components/transactions-data.ts`. The primary line stays the kind label when there is no vehicle; the
secondary line is now the house reference idiom, `#<first 8 of the id>` — the same form already used by
the staff transactions table, the staff records table, the transaction overview, and the printed
invoice. A linked vehicle still shows `Stock <code>` beneath the car name. The two lines can no longer
collide, and a joined-but-empty vehicle row degrades to the kind label rather than rendering
`"undefined"`. The cell was also brought in line with the repo's two-line typography
(`grid … gap-0.5`, muted `text-xs` secondary). Note the Kind column independently prints the same kind
string, so a request-a-car row used to show "Request a Car" **three** times; it is now twice by design
(vehicle line and Kind column) — the Kind column is a deliberate, separately filterable field.

## 3.2 — Dropdown headings differ from the document

✅ **Confirmed** — cosmetic / documentation accuracy (**document corrected**)

**In plain terms.**
The document shows the Transaction dropdown with headings styled like `— Buy —`. On screen they are
plain: `None`, `Buy`, `Request a Car`. Nothing is broken and the dropdown is genuinely much clearer
than the old version — the document just draws them with dashes that don't exist. Worth knowing so
nobody hunts for a styling bug that isn't there.

**In technical terms.**
`src/app/(staff)/field-cases/_components/field-cases-client.tsx` lines 496 and 501 render
`<SelectLabel>None</SelectLabel>` and `<SelectLabel>{transactionKindDisplayLabel(group.kind)}</SelectLabel>` —
no dash decoration. Decide whether to change the document's illustration or add the decoration to the UI.

> **Decision: the document was corrected, the UI was not.** Verified that the plain form is the
> repo-wide convention — every `SelectLabel` in the app is an undecorated word (`None`, `Vehicles`,
> `Period`, `Segments`), and there is no `—` string anywhere in `src/`. Adding dashes to one dropdown
> would have introduced the only occurrence of a pattern nobody else uses, so the illustration in
> [`task32-33-implemented-flow.md`](./task32-33-implemented-flow.md) now matches the screen.

**Related, and genuinely fixed — worth recording as verified:** the same file sets
`<SelectContent className="max-h-64">` (line 494, and likewise for the vehicle dropdown at line 522–533).
Measured live: the listbox was 774px tall holding 1304px of content with a working `overflow-y: auto`
scroll container. The "dropdown grew so tall it covered the screen" problem is **fixed**.

## 3.3 — The walk-in link leaves a leftover tag in the address bar

✅ **Confirmed — fixed**

**In plain terms.**
When Ana clicks **Create Walk-In**, the address bar picks up a tag (`?createWalkIn=1`). After she
creates the account the window closes — but the tag stays. If she refreshes the page, the window pops
open again on its own, which can feel like the app is nagging her.

**In technical terms.**
`src/app/(staff)/staff-records/_components/walk-in-form.tsx`. The dialog is controlled by
`useState(initialOpen)` plus an effect that re-opens when `initialOpen` is true (lines 22, 32–34). On
success the handler calls `setOpen(false)` (line 63) but never clears the `createWalkIn` search param,
so a reload re-reads `?createWalkIn=1` in `staff-records/page.tsx` line 19 and passes `initialOpen={true}`
again. Fix: strip the param with `router.replace` after the dialog closes, so the deep link is
consumed once.

**Fixed:** the dialog now routes every intentional close — successful creation, Cancel, and the Radix
X/Escape/outside-click path — through one handler that spends the deep link exactly once, using a
`useRef` guard and `router.replace(pathname)`. Deriving the path from `usePathname()` preserves the
role-prefixed URL the middleware rewrite produced, so the replace only drops the query string. Opening
the dialog from the ordinary in-card button (no deep link) never touches the URL. Because the form is
mounted only for the Account Manager, the leftover tag never affected the other roles that can view the
page.

---

# List 4 — Environment and infrastructure

## 4.1 — Every customer page broke after a code change — FIXED

✅ **Confirmed and fixed during this test session**

**In plain terms.**
This one is worth writing down because it wasted real time and will bite the next person who pulls the
latest code.

At first, **every customer page was broken** — Showroom, Transactions, the Buying Guide, all of them
returned "Page not found", even though signing in worked and sent Maria to the Showroom as normal. The
run of the system couldn't even start.

The cause was leftover build files from an earlier code change (a file that had been renamed, leaving
an old cache behind that mentioned both the old and new names). Clearing the build cache and restarting
the server fixed it completely — every page came back, and the whole walkthrough then passed.

**Nothing in the product was wrong.** This is a "leave your workspace clean after renaming a file"
issue.

**In technical terms.**
Running `next build` failed with:
```
Error: Both middleware file "./src\src\middleware.ts" and proxy file "./src\src\proxy.ts" are detected.
Please use "./src\src\proxy.ts" only.
```
`.git` showed `src/middleware.ts` deleted and `src/proxy.ts` added (both uncommitted). The stale
`.next` directory still described the removed middleware, so Next.js saw a double registration. Fix:
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```
After that, `GET /customer/showroom` → `200` and `/my-transactions` → `200`.

You can tell you've hit this variant rather than a real routing bug because `next build` refuses to
start, and `proxy.ts` is already handling middleware duties in the dev log
(`GET /customer/showroom 200 ... proxy.ts: 1050ms`).

## 4.2 — Background errors in the server log

✅ **Rechecked — the first error was real and is now fixed; the second is not reachable**

**In plain terms.**
While testing, the server console repeatedly printed two errors. The pages involved still worked, but
something underneath is unhappy. One notable symptom: the staff Transactions page returned a **500
error once**, then loaded fine on the next try.

**Caveat:** the files involved were being edited by someone else at the same time (see 4.4), so this
needs re-verifying against the current code before anyone spends time on it.

**In technical terms.**
```
Error: Cookies can only be modified in a Server Action or Route Handler.
    at setAll (src/lib/supabase/server.ts:48:23)
⨯ Error: Missing PreferencesStoreProvider
    at usePreferencesStore (src/stores/preferences/preferences-provider.tsx:118:21)
    at AppSidebar (src/app/(staff)/_components/sidebar/app-sidebar.tsx:66:79)
```
The first is a read-write Supabase client writing cookies during a Server Component render, where
Next.js forbids it. Note that `src/app/auth/actions.ts` currently carries an uncommitted change moving
`getCurrentRole()` onto the read-only `createServerSupabase()` specifically to avoid this, with a
comment saying `src/proxy.ts` now owns the refresh — so this may already be addressed, or the write
path may still be reachable from another caller.

The second means `AppSidebar` is rendering outside `PreferencesStoreProvider` on some route.
Unhandled rejections from the first error are the most likely cause of the observed single 500.

> **Recheck outcome — error 1: real, and still reachable when this was filed. Now fixed.**
>
> The `getCurrentRole`/`getCurrentUser` half was already fixed before this review (that is what the
> "uncommitted change" note refers to — it has since been committed as `1faff9e`). But the same class of
> fault was still live through a **third** caller the note did not mention: `getNotifications()` and
> `getUnreadNotificationCount()` in `src/lib/notifications/actions.ts` were using the read-write client
> while being awaited **during layout render** by the staff, customer, and supplier layouts and the staff
> dashboard. The Supabase SDK refreshes an expiring token lazily on *any* query, so those reads could
> attempt a cookie write and produce exactly the `server.ts:48` frame in the log.
>
> This was reproduced in a test — mocking `next/headers` so a cookie write throws the same Next.js error,
> then driving an expired session through `getNotifications`, yields the identical failure (`setAll` at
> `supabase/server.ts:48:23`). Both reads now use the read-only client; the write paths
> (`checkAndNotifyDueInstallments` via the admin client, and the two mark-as-read actions) are unchanged.
>
> A second, subtler half was also fixed. `src/proxy.ts` refreshed the session and wrote the rotated
> cookies onto the **response** only, never onto the request it forwarded — so the render for the very
> request that triggered the refresh still read the pre-refresh cookies, while the old refresh token was
> already spent server-side. The proxy now applies the rotated cookies to the request as well and
> forwards the request headers on the rendering branches, keeping the response-side writes exactly as
> they were. `src/lib/supabase/server.ts`'s comment still said "middleware refreshes tokens" and now
> names `src/proxy.ts`.
>
> **Error 2: not reachable.** `PreferencesStoreProvider` is mounted unconditionally in the single root
> layout (`src/app/layout.tsx`) above every route group, and all three `AppSidebar` call sites sit inside
> those groups, so the throw at `preferences-provider.tsx:118` cannot fire from `AppSidebar` in the
> current tree. The frame's line number also only matches the **pre-commit** file: `9c42c82` removed an
> import line above it, moving the call from line 66 to 65. Combined with the 4.4 note that
> `app-sidebar.tsx` was being edited at that exact time, and with 4.1 being a stale-`.next` artifact from
> the same session, the most likely explanation is a mid-edit/mid-HMR client bundle. No code change was
> made: the hard throw is the repo's only context-based store and remains the house behaviour for a
> genuinely missing provider.

## 4.3 — A leftover "disabled" file sits next to the active one

✅ **Confirmed — fixed**

**In plain terms.**
There are two similarly named files, one active and one switched off. The switched-off one says, in
its own first lines, *"rename this file to `proxy.ts` to enable it."* If someone follows that
instruction the system breaks (and per 4.1, breaks confusingly — every page 404s). It's a trap.

**In technical terms.**
`src/proxy.disabled.ts` coexists with the live `src/proxy.ts`. Its header comment (lines 1–2) invites a
rename that would produce two candidate middleware entry points, reproducing the 4.1 failure. Since
`proxy.ts` is now implemented and doing real work (session refresh + role routing), the disabled
template has no remaining purpose — delete it, or move it out of `src/`.

**Fixed:** both files deleted. A repo-wide grep confirmed nothing imported either one before removal.
Testing also turned up a **second** dead file the original report did not name:
`src/lib/supabase/middleware.ts`, the retired `updateSession` helper, also with zero importers —
deleted in the same change, since leaving it invites the same "restore the old middleware" mistake.
Tests now assert both are gone and that `src/middleware.ts` stays absent. Active guidance in
`AGENTS.md`, `CLAUDE.md`, and `README.md` that still described `/dashboard*` as rewritten by
`src/middleware.ts` now names `src/proxy.ts`.

## 4.4 — Another editor is working in this tree

✅ **Confirmed — resolved (tree now clean)**

**In plain terms.**
Someone else was changing files while this test ran. Twice the browser jumped to a different page on
its own mid-test, and one page failed once and then worked. Results are trustworthy, but anything that
looked intermittent should be re-checked on a quiet tree.

**In technical terms.**
During the session these appeared or changed, none of them by this test run:
`src/app/(staff)/_components/sidebar/app-sidebar.tsx` (modified),
`src/app/(staff)/_components/sidebar/sidebar-support-card.tsx` (deleted),
`src/lib/supabase/server.test.ts` (new),
`src/tests/e2e/expired-session.spec.ts` (new) — timestamps 22:05–22:20.

**No source files were edited by this testing run.** Only browser interaction, test images generated
under `%TEMP%`, and a dev-server restart.

---

# List 5 — Test data written to the live database

The walkthrough ran against the **real Supabase project**, not a throwaway fixture. These records now
exist and should be reviewed or cleaned up.

| What was done | Effect | Suggested action |
|---|---|---|
| Completed the Toyota Hilux (GCE-002) purchase | **Car marked sold — Showroom went 17 → 16 vehicles** | Decide whether to keep as a legitimate sale or revert |
| Submitted a sell: Honda "Walkthrough Civic" 2019, 4 photos, 2 checklist items | New pending sell transaction | Delete if unwanted |
| Created a field case | Acquisition case linked to Ford Everest + Carlos Mendoza; case count 10 → 11 | Delete if unwanted |
| Created a walk-in account | `walkin294728@example.com` | Delete if unwanted |
| Edited the Hilux transaction | Viewing arrangement + notes ("Walkthrough test: picking up the Hilux.") | Clear the note text |
| Verified 3 documents + approved + completed the Hilux transaction | Status history and audit trail rows | Consequence of the above |

**The Hilux is the only item that changes inventory state.** Everything else is inert rows.

**One positive result worth keeping:** the walk-in account's `created_by` field was checked directly in
the database and correctly holds Angela Reyes' user id (`b9915c20-…-202fe439c6ef`) — a real person's id,
not the literal string `"staff"`. That is exactly the Task 33 fix, confirmed at the data layer rather
than through the screen.

---

# List 6 — Not tested (unknown, not broken)

These were **not** exercised. Nothing above should be read as covering them.

**Highest priority — the unhappy paths:**
- **Rejecting a document.** The document claims that if Elena rejects one, the status shows `rejected`
  instead of silently staying `pending`. **Only the verify path was tested.** This is the single most
  valuable untested claim, because it is a named Task 33 fix.
- **CEO Reject.** Only *Approve (CEO)* was exercised.

**Documents:**
- **PDF uploads** — the *"Open valid ID"* new-tab link and the *"Preview unavailable"* fallback. Only
  PNG images were uploaded, so both branches are unverified.
- **The one-hour expiry** on the secure image links, and that refreshing issues fresh ones.

**Transactions and workflows:**
- **Cancel Transaction.**
- **Creating a walk-in *transaction*** (as opposed to a walk-in *account*) — Sales Manager, CEO,
  Account Manager.
- **Request a Car** end to end.
- **Assign Mechanic** inside a field case (Task 32 moved this to the Confidential Informant).
- **Recording payments and paperwork** on the staff transaction page.

**Roles and areas entirely untouched:**
- **Supplier portal.**
- **Attendance, Payroll, Payslips.**
- **Marketing Specialist** and **Head Security** roles.
- **Staff records, roles, and permissions screens.**

**Data volume:**
- **Field Cases with realistic data.** Tested against the 42 seeded transactions only. The flow
  document itself flags this as open item 2 — a handful of entries is not the same as months of real
  trading.

---

# Recommended order of work

1. ~~**1.1** — Resolve the mechanic/sell-photo contradiction. It's the only true product-vs-document
   conflict, it affects a primary user's job, and the data layer is already correct — it's a surface
   and a guard entry, not a redesign.~~
   **Done.** Note the "data layer is already correct" premise was wrong; see the correction in 1.1.
2. **Reject paths (List 6)** — Verify Elena's reject and Carlos's reject. They are named Task 33 fixes
   that nobody has tested. **Still open — this remains the highest-value unverified claim.**
3. ~~**4.3** — Delete `src/proxy.disabled.ts`. One minute, removes a documented way to break the whole app.~~
   **Done**, along with the second dead file found beside it.
4. ~~**1.2** — Fix the vehicle table column ids. It's the Sales Manager's landing page.~~ **Done.**
5. ~~**3.1** — Fix the duplicated fallback labels. Small, visible to customers.~~ **Done.**
6. ~~**4.2** — Re-verify the cookie/provider errors once the tree is quiet.~~ **Done** — the cookie error
   was real and reachable through notification reads; the provider error is not reachable.
7. ~~**2.1 / 2.2** — Recheck the two confirmations; close out if they were sampling artifacts.~~
   **Done** — both were sampling artifacts, no defect.
8. ~~**3.2 / 3.3 / 1.3** — Polish.~~ **Done.**
9. **List 5** — Decide what to do about the test records, especially the sold Hilux. **Still open — a
   decision for the business, not a code change.**
10. **List 6 — the untested paths.** Rejecting a document, CEO Reject, PDF uploads, the one-hour link
    expiry, Cancel Transaction, walk-in *transactions*, Request a Car end to end, Assign Mechanic,
    payments, the supplier portal, Attendance/Payroll/Payslips, and the Marketing Specialist and Head
    Security roles. **Still untested.** The reject paths are implemented and covered by unit tests, so
    these are testing gaps rather than known breakage.

---

# Resolution log

What was actually changed, and which non-changes were deliberate. Commits are on branch
`fix/task32-33-findings`.

| Finding | Outcome | What changed |
|---|---|---|
| 1.1 | **Fixed** | New migration `00047_task32_inspection_sell_submission.sql` adds a `SECURITY DEFINER`, `STABLE`, fixed-`search_path` function returning only the sell `transaction_id` and `condition_items` for an inspection's vehicle, authorising the assigned mechanic or an active Confidential Informant. `inspections/[id]/page.tsx` loads that transaction's `sell_photo` documents, signs the private paths server-side through the existing helper, resolves checklist ids to names, and renders a read-only `Vehicle photos & condition` card. Generic transaction access was **not** widened. |
| 1.2 | **Fixed** | The vehicle table's composite column now reads `make`/`model`/`year` from the row instead of looking up columns that never existed. A missing year renders an em dash. A regression test asserts both a populated cell and the absence of missing-column console output. |
| 1.3 | **Fixed** | `TRANSACTION_VIEWER_ROLES` added to `src/lib/auth/roles.ts` and used by both the transactions list and detail routes; the detail guard runs before its row fetch, so a denial redirects to `/unauthorized` instead of 404ing. |
| 2.1, 2.2 | **No defect** | Nothing changed. Both toasts sit on guarded success branches under the root `<Toaster />`; the original "sampling artifact" guess was correct. |
| 3.1 | **Fixed** | Row mapping extracted to a tested `buildTransactionRows`; the no-vehicle secondary line is now `#<first 8 of id>` instead of repeating the kind label. Cell typography aligned with the repo's two-line convention. |
| 3.2 | **Document corrected** | The flow document's `— Buy —` illustration now shows the plain headings the UI actually renders. No UI change, because plain headings are the repo-wide convention. |
| 3.3 | **Fixed** | The walk-in dialog consumes `?createWalkIn=1` once, on the first intentional close, via `router.replace(pathname)`. Ordinary in-card opening never touches the URL. |
| 4.1 | **Already fixed** | Stale `.next` left behind by a renamed middleware file. No product defect; the tree is verified clean. |
| 4.2 | **Fixed / not reachable** | Notification reads moved to the read-only Supabase client (this was the live `server.ts:48` path); `src/proxy.ts` now applies refreshed cookies to the request as well as the response. The provider error is not structurally reachable — no change, with the reasoning recorded in 4.2. |
| 4.3 | **Fixed** | `src/proxy.disabled.ts` and the newly found `src/lib/supabase/middleware.ts` deleted; active docs repointed at `src/proxy.ts`. |
| 4.4 | **Resolved** | The tree is clean; every finding was re-verified against committed code rather than a mid-edit working copy. |

**Deliberate non-changes, for the record.** The mechanic was *not* added to the transactions navigation,
route guard, or RLS policy — the documented requirement is that he sees the car he inspects, and
widening the ledger for that would have been a far larger permission change than the finding asked for.
No preferences-provider fallback was added for a path that cannot be reached. No toast duration or
duplicate Toaster was introduced for two confirmations that were never broken.

**Reject-path regression coverage** lives in the existing unit tests
(`src/app/(staff)/transactions/actions.task33.test.ts`, `review-sell-action.test.ts`); what is missing is
a click-through, which is tracked in List 6 rather than presented here as a fix.

---

# Related documents

- [`task32-33-implemented-flow.md`](./task32-33-implemented-flow.md) — the walkthrough this testing
  followed, and the source of the claims checked above. The mechanic's photo surface and the
  dropdown-heading illustration have been corrected there to match the shipped product.
- `docs/tasks/32.md`, `docs/tasks/33.md` — the original requirements.
- `supabase/migrations/00044_task32_sell_visibility.sql` — the sell-photo read policies that were at the
  centre of finding 1.1.
- `supabase/migrations/00047_task32_inspection_sell_submission.sql` — the scoped inspection bridge that
  resolved it.
