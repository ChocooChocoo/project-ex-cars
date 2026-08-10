# 17 - ROADMAP AUDIT

[Back to start](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Related: [07 - DEVELOPMENT ROADMAP](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md) · [08 - ROADMAP TRACKER](../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/08%20-%20ROADMAP%20TRACKER.md) · [16 - USER LEVEL AND PROCESS GUIDE](16%20-%20USER%20LEVEL%20AND%20PROCESS%20GUIDE.md)

**Written:** 10 August 2026
**Type:** Review only. No roadmap item, tracker status, or code was changed.

---

## How to read this guide

The roadmap (`07`) says what should be built, in what order. The tracker (`08`) says where each item stands. This file checks both against the running system, item by item, using the same three-column shape as `16`:

1. **What the roadmap promised** — the R-item as written.
2. **What the tracker claims** — its recorded status and note.
3. **What is actually there** — checked in the system.

Verdicts:

| Verdict | Meaning |
|---|---|
| **Confirmed** | Roadmap, tracker, and system agree. The ✅ is earned. |
| **Overstated** | The tracker says finished; part of the item is not there. |
| **Understated** | The tracker says unclear or not started; some of it exists. |
| **Regressed** | It was genuinely built, then lost or replaced by later work. The tracker note now describes something that no longer exists. |
| **Unverifiable** | Cannot be judged from the files available. Recorded, not guessed. |

A note on where the tracker's ✅ came from: the tracker was last updated on 9 August 2026. Ten more tasks (`docs/tasks/16.md` through `25.md`) were carried out after that date, all of them interface redesigns. Some of those redesigns replaced screens the tracker was pointing at. That is the main source of drift in this file.

---

## Part 1 — Problems with the roadmap documents themselves

Before comparing anything with the system, four faults sit inside `07` and `08`.

### 1.1 The tracker's own arithmetic is wrong

| What the summary table says | What the rows actually contain |
|---|---|
| ✅ Finished — **35** | ✅ Finished — **36** |
| ❓ Unclear — **6** | ❓ Unclear — **5** |
| Total — 41 | Total — 41 ✔ |

Counted by phase: Phase 1 has 6 finished, Phase 2 has 10, Phase 3 has 5, Phase 4 has 3, Phase 5 has 6, Phase 6 has 6 — that is 36. Phase 7 has 3 unclear and cross-phase work has 2 — that is 5. The total is right; the split is not.

**Verdict: the summary table is wrong.** A reader taking the headline figure gets a different picture from a reader counting the rows.

### 1.2 The tracker contradicts itself in the same file

The paragraph under the summary table says:

> "R-07 (360° viewer) remains a placeholder, and R-28/R-29 remain in progress."

But the rows for R-07, R-28, and R-29 all carry ✅ with detailed completion notes. The paragraph is left over from an earlier state and was never removed when the rows were updated.

**Verdict: internal contradiction.** The rows are the accurate ones — all three items are genuinely built.

### 1.3 The roadmap says Phase 6 is unstarted; the tracker says it is finished

`07 - DEVELOPMENT ROADMAP`, Phase 6:

> "Phase 6 implementation remains unstarted."

`08 - ROADMAP TRACKER`, Phase 6: all six items ✅, with implementation notes dated 8 August 2026.

The system confirms the tracker — attendance, employee requests, payroll, payslips, finance, field cases, security duty checks, reports, and announcements are all built and working.

**Verdict: the roadmap sentence is stale.** Phase 6 was implemented; `07` was never updated.

### 1.4 Two different documents both numbered 14

`14 - AUDIT USER ROLES` sits in this folder. A separate document titled `# 14 - PHASE 6 IMPLEMENTATION PLAN` lives at `docs/tasks/10.md`, and both `07` and `08` link to it by that number. Anyone following a reference to "14" can land on either.

**Verdict: numbering clash.** Not a system fault, but it makes the paper trail hard to follow.

---

## Part 2 — Item-by-item audit

### Phase 1 — One shared foundation

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-01** | Registration, sign-in, **email and phone checks**, profiles, ID upload, walk-in account creation | ✅ Auth connected, profile trigger, document upload, walk-in creation | Registration, sign-in, profiles, customer document upload, and walk-in creation all work. Email confirmation is handled by the sign-in provider. **Phone verification does not exist** — a phone number is format-checked when typed and never confirmed. | **Overstated** — the phone half of "email and phone checks" is not built. |
| **R-02** | Role-based access for the customer, the supplier, and the eight operational roles, managed by the Account Manager | ✅ All 10 roles, RLS per table, role assignment, middleware, sidebar filtering, landing pages | All ten roles exist. Role assignment is restricted to the CEO and Account Manager. Menus filter per role. **But several pages carry no role check of their own**, so the menu hides them without blocking them — see finding A-1 in [16](16%20-%20USER%20LEVEL%20AND%20PROCESS%20GUIDE.md). | **Overstated** — the roles exist; the boundary leaks. |
| **R-03** | One shared record foundation across customer, vehicle, conversation, transaction, inspection, and staff information | ✅ All 6 Phase 1 tables live with RLS | Confirmed. Later phases build on the same records; a completed sale updates the vehicle everywhere. | **Confirmed** |
| **R-27** | Supplier account created by the **Procurement Team**, Company or Individual, two primary valid IDs from a published list, invitation evidence if a portal is kept, no sign-in until approved | ✅ Full KYC flow, verified IDs before approval, sign-in gating, account linkage | Company/Individual validated, two IDs required and verified before approval, sign-in genuinely refused before approval, account linked on first sign-in. **The creator is the CEO or Account Manager, not a Procurement Team, and no portal or invitation evidence exists.** | **Overstated** — the security half is fully built; the ownership question (who is the Procurement Team) was never answered, and the tracker's ✅ hides that. |
| **R-28** | Field checks on every form: number ranges, text lengths, allowed kinds, required fields, formats | ✅ Validation schemas wired into auth, vehicles, transactions, buy/sell/request, inquiries, Phase 6 | A validation layer exists and is wired into the named areas. **Whether every field carries its stated limits cannot be judged, because the documents never state the limits** — that is still an open question. | **Unverifiable** — not the builder's fault; the requirement has no target to measure against. |
| **R-29** | Automatic filling of forms from details already held, **across the system** rather than in one journey | ✅ Wired into buy-details location and inquiry arrangement forms | Autofill works in the purchase and arrangement forms. The roadmap explicitly asked for it generally, not in one journey. `15 - SYSTEM STATUS` already lists the general layer as backlog. | **Overstated** — the tracker's ✅ and the status file's "backlog" disagree with each other. |

### Phase 2 — Vehicles can be found and understood

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-04** | Live inventory with make, model, year, price, condition, mileage, fuel, availability | ✅ CRUD with table, search, filter, pagination | Confirmed. | **Confirmed** |
| **R-05** | Inspection reports with condition score, photographs, notes, repair progress from pending to fixed | ✅ Nested checklist, repairs with status tracking | Confirmed. | **Confirmed** |
| **R-06** | Browse, search, filters, vehicle details, saved favourites | ✅ Public showroom with search, filter, sort, detail page, favourites | Confirmed. | **Confirmed** |
| **R-07** | 360-degree viewing limited to the active vehicle | ✅ Image-sequence viewer with gallery fallback, media bucket, staff upload manager | Confirmed. The contradicting sentence at the top of the tracker is stale, not the row. | **Confirmed** |
| **R-08** | Landing content, promotions, featured vehicles, and CEO approval of a proposed price before posting | ✅ Content management with publish; price proposal Marketing → CEO | Confirmed, and the rule is genuinely enforced — a car cannot be published without an approved price proposal. | **Confirmed** |
| **R-30** | Warranty, offers, condition, and a Negotiable or Fixed pricing type on every listing | ✅ Fields in the vehicle form, shown on cards and detail page | Confirmed. All four are on the listing and displayed publicly. | **Confirmed** |
| **R-31** | Nested mechanic checklist: systems, then components, then parts | ✅ Three-level checklist | Confirmed. | **Confirmed** |
| **R-32** | Extra fields for replacement item name, brand, and estimated cost when a part is marked for repair or replacement | ✅ Dynamic fields, replacements recorded | Confirmed. | **Confirmed** |
| **R-33** | A **simplified inspection report**, one status per component, filled from the checklist | ✅ Per-entry status; report from answers without duplication | The three statuses exist and nothing is typed twice — the intent is met. **There is no separate simplified report document**; the checklist is the report. | **Overstated in wording, met in intent.** The revision list asked for a simpler report, not for the report to be removed. Worth confirming with the project owners that the checklist-as-report is acceptable. |
| **R-34** | A checklist of required vehicle documents, showing which are submitted and which are checked | ✅ Vehicle document items with required/submitted/verified/rejected states | Confirmed. It lives on the **Inspections** page. Note the documents never say *which* vehicle documents are required — that list is still an open question, so the checklist has a mechanism but no agreed contents. | **Confirmed**, with the contents still undecided. |

### Phase 3 — Conversations stay together

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-09** | Real-time inquiry chat tied to a vehicle, able to carry images | ✅ Live chat, customer and staff views | Confirmed. | **Confirmed** |
| **R-10** | Inquiry to Account Manager, Buy Now to Sales Manager, autofill, delivery/meet-up/GCE-visit forms, schedules, **and the handoff** | ✅ Staff queue, assignment, arrangement form, handoff action | The queue, the three arrangement kinds, and a **two-stage** handoff all work. **Routing is by visibility, not automatic assignment** — a person clicks to take the work. **The CALABARZON meet-up limit and the Marketing-set delivery down payment are not enforced.** | **Overstated** — three documented rules inside one ✅ are not built. |
| **R-11** | Unread-message count and clear read state | ✅ Read marking, read timestamp per message | Confirmed. | **Confirmed** |
| **R-35** | Photograph and file sending, improved chat controls, message reporting | ✅ Attachments, report action, staff report review | Confirmed. | **Confirmed** |
| **R-36** | Automatic filter hiding or censoring inappropriate words | ✅ Word filter, censored on display, original kept | Confirmed as a mechanism. **Which words, in which languages, and whether to hide or censor was never decided** — the filter runs on a list nobody has approved. | **Confirmed** mechanically; the contents are still an open question. |

### Phase 4 — Recommendations can be explained

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-12** | Customer ranking using the five stated criteria and weights | ✅ Ranking engine, customer page, per-criterion breakdowns, runs saved | Confirmed. The five weights are exactly the documented values, and the reasoning is shown to the customer. | **Confirmed** |
| **R-13** | Agreed management views for pricing, stock turnover, buying patterns, and market information | ✅ Management dashboard with tabs: Pricing Trends, Stock Turnover, Buying Patterns, Market Insights, Accuracy | **Those five tabs no longer exist.** The page now carries a KPI strip, a sales overview, market activity, inventory status, inventory allocation, and top vehicles — generic dashboard panels installed during a later interface redesign. The subject areas are loosely covered; the named views are gone. | **Regressed** |
| **R-14** | A way to report **recommendation accuracy** | ✅ Accuracy view comparing feedback against runs; accuracy percentage, most recommended vehicles, feedback tally | **Gone entirely.** Customers still submit helpful / not-helpful feedback, and it is still stored — but **no staff screen reads the recommendation records at all.** There is no accuracy figure anywhere in the system. | **Regressed** — this is the most serious finding in this file. |

> **Why R-14 matters more than it looks.** The chapter document promises the CEO a dashboard showing Decision Support System accuracy. A capstone whose headline feature is a Decision Support System, with no way to show whether its recommendations were any good, has lost its own evidence. The data is still being collected — only the reporting was removed. Restoring it is a display problem, not a rebuild.

### Phase 5 — Transactions can be followed

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-15** | Buy path: Buy Now routing, registered or walk-in accounts, autofill, **two valid IDs, proof of billing**, arrangement details, and cash / financing / cheque / down-payment records | ✅ Buy Now creates a transaction; purchase details; arrangements; walk-in buy | Confirmed, and stronger than the tracker note suggests — a purchase now **cannot be completed** until two IDs and a proof of billing are uploaded and verified. | **Confirmed** |
| **R-16** | Sell path: accounts, mechanic inspection, valuation, Sales Manager review, acceptance or rejection, acquisition, repair progress | ✅ Sell form, draft vehicle, sell details, review with valuation and decision | Confirmed. | **Confirmed** |
| **R-17** | Request-a-Car from specifications through price discussion to informant sourcing | ✅ Request form, requests table, informant assignment, sourcing cases | Confirmed. | **Confirmed** |
| **R-18** | Shared pending, under-review, approved, rejected, completed states | ✅ State machine, role-gated transitions, history | Confirmed, with named roles per transition. | **Confirmed** |
| **R-19** | Purchase history, payment method, financing and installment progress, **due-date escalation**, sales records, paperwork, receipt, automatic sold status | ✅ Payments, installments, terms, paperwork, auto-sold, collection actions | Confirmed, including the escalation chain: due-date notice to the Account Manager, then a repossession instruction that creates a recovery case. **No ultimatum period is enforced** — the roadmap's own completion test says "after the final agreed rule", and that rule was never agreed. | **Confirmed**, with the waiting period still undecided. |
| **R-37** | Flexible payment terms and arrangements recorded against a purchase | ✅ Terms table, propose/approve/activate, schedule generation | Confirmed — weekly, fortnightly, monthly, and quarterly schedules. **Which terms are allowed and who approves each one was never decided**, so the system permits any combination a user types. | **Confirmed** mechanically; the business limits are still an open question. |

### Phase 6 — Staff and managers can run the business

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-20** | Time, late arrival, leave, overtime, **performance**, employee records, customer accounts, Head Accountant attendance cross-check | ✅ "Performance reviews table exists; **review UI pending**" | The review interface **does exist** — reviews can be written and updated from Staff Records. The tracker note is out of date in the system's favour. | **Understated** |
| **R-21** | Permitted purchase and reconditioning disbursements, payment requests, financing, installment, cheque, invoice, case-expense, and financial reports | ✅ Record-only ledger, disbursement request → approve → release → receive → paid, report submission and review | Built and working. **But the page carrying it is granted to no role**, so it appears in nobody's menu — see finding A-7 in [16](16%20-%20USER%20LEVEL%20AND%20PROCESS%20GUIDE.md). Built is not the same as reachable. | **Overstated** — the feature is finished; nobody can find it. |
| **R-22** | CEO dashboard with sales, revenue, inventory, pending work, **staff performance**, report and price approvals, announcements, and **agreed recommendation measures** | ✅ CEO totals, performance review UI, price-approval queue, report queue, every metric links to its source | Sales, revenue, inventory, pending approvals, price queue, and announcements are all present and traceable. **The recommendation measure is not** — it was removed with R-14. | **Overstated** — one of the eight promised dashboard contents is missing. |
| **R-23** | Security photographs, sourcing, **mechanic assignment**, delivery, case expenses, vehicle-recovery records | ✅ Field case state and expense updates; security before/after uploads requiring both images | Confirmed, and now broader than the note says — mechanic assignment and all four case kinds exist. | **Confirmed** |
| **R-26** | Payroll: attendance inputs, salary and deduction entry, report preparation, payslip approval, salary-payment responsibility | ✅ Compensation entry, run generation, payment status with Head Accountant handoff, approval sequence, printable payslips | Confirmed, including automatic statutory deduction lines. **The approval order itself is a working assumption, not an approved decision** — the roadmap's own blocker list says so, and it is still unresolved. | **Confirmed** in build; the order still needs sign-off. |
| **R-38** | A direct CEO-to-supplier channel, **built only if the business confirms it applies** | ✅ CEO and approved suppliers send and read messages | The channel works in both directions. **The supplier has no menu link to it**, so their half is unreachable by normal navigation. And the confirmation the roadmap made a precondition was recorded as a provisional "treated as yes", not an actual business decision. | **Overstated** — working feature, unreachable for one of its two users, built on an unconfirmed condition. |

### Phase 7 — Mobile use and acceptance are checked

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-24** | Responsive customer and employee experiences across the completed features | ❓ Unclear — "not yet started" | The interface is built on a responsive foundation and adapts to phone widths as a matter of course. **No deliberate check of the main journeys at phone size has been recorded.** | **Understated** — not "not started"; unmeasured. Rewording it as "built, not yet checked" would be more honest. |
| **R-25** | User acceptance, usability, and satisfaction checks with recorded results | ❓ Unclear — "not yet started" | Correct. This is field work with real users, not a coding task. Nothing in the system could show it. | **Confirmed as unstarted** |
| **R-41** | Obtain the mobile application from inside the system, without trips to outside websites | ❓ Unclear — "disagrees with native-app exclusion" | Correct and unchanged. The two source documents contradict each other on whether a downloadable application is even wanted. Nothing should be built until that is settled. | **Confirmed as blocked by a decision, not by work** |

### Cross-phase work

| # | Roadmap promised | Tracker claims | Actually there | Verdict |
|---|---|---|---|---|
| **R-39** | Stronger text-against-background contrast on every screen, Light Mode checked specifically | ❓ Unclear — "not yet started" | Cannot be judged from the files. Several later tasks were interface-quality passes that may have addressed it. No contrast standard was ever agreed, so there is nothing to measure against. | **Unverifiable** |
| **R-40** | Consistent confirmation prompts before submissions, approvals, and deletions, and consistent notice wording | ❓ Unclear — "not yet started" | **Partly built.** Confirmation dialogs appear on eight screens. Whether every submission, approval, and deletion across the system asks first, in consistent wording, was not audited page by page. | **Understated** — some of it exists; completeness unknown. |

---

## Part 3 — Corrected picture

### 3.1 Status count, recalculated

| Status | Tracker says | This audit finds | Change |
|---|---|---|---|
| ✅ Genuinely finished | 35 (rows show 36) | **22** | Items where roadmap, tracker, and system all agree |
| ⚠️ Finished but overstated | — | **10** | R-01, R-02, R-10, R-21, R-22, R-27, R-29, R-33, R-38, and the wording of R-19/R-26/R-36/R-37 caveats |
| 🔻 Regressed | — | **2** | R-13, R-14 |
| ⬆️ Understated | — | **3** | R-20, R-24, R-40 |
| ❓ Genuinely unclear or blocked | 6 | **2** | R-25, R-41 |
| ❔ Unverifiable | — | **2** | R-28, R-39 |
| **Total** | 41 | **41** | ✔ |

The headline changes: nothing collapses, but ten ✅ marks are carrying an unfinished piece inside them, two items were genuinely lost, and three were sold short.

### 3.2 What should change in the roadmap documents

Ordered by how much confusion it causes. **These are recommendations, not changes — nothing was edited.**

| Priority | Document | What to fix |
|---|---|---|
| **High** | `08` | Correct the summary table: 36 finished, 5 unclear — or restate the counts using this audit's breakdown. |
| **High** | `08` | Delete the stale paragraph claiming R-07 is a placeholder and R-28/R-29 are in progress. It contradicts the rows directly beneath it. |
| **High** | `08` | Move R-13 and R-14 out of ✅. They were built and then replaced. |
| **High** | `07` | Delete "Phase 6 implementation remains unstarted." It was implemented on 8 August 2026. |
| **Medium** | `08` | Update the R-20 note — the performance review interface is no longer pending. |
| **Medium** | `08` | Add a caveat to R-21 and R-38 that the feature is built but not reachable from any menu. |
| **Medium** | `07` and `08` | Renumber the Phase 6 implementation plan so it stops clashing with `14 - AUDIT USER ROLES`. |
| **Medium** | `08` | Reword R-24 from "not yet started" to "built, not yet checked", and R-40 from "not yet started" to "partly built". |
| **Low** | `08` | Note against R-27, R-29, R-33, and R-37 which sub-part remains open, so the ✅ does not hide it. |

### 3.3 What should change in the system

Two items only. Everything else in this audit is a documentation correction.

| Priority | What | Why |
|---|---|---|
| **High** | Restore a recommendation-accuracy view for management (R-14) | The data is still collected. A capstone built around a Decision Support System cannot show whether it works. Smallest possible fix in this list, biggest loss if skipped. |
| **Medium** | Restore or re-map the four management decision views (R-13) | Pricing trends, stock turnover, buying patterns, and market information are named promises in the chapter document. The replacement panels cover the ground loosely; the named views do not exist. |

Grant the Finance menu item to the four roles that already have permission for the page — see finding A-7 in [16](16%20-%20USER%20LEVEL%20AND%20PROCESS%20GUIDE.md). That is a navigation fix, not a roadmap item, but it is what turns a finished R-21 into a usable one.

---

## Closing note

The roadmap was written before any code existed and has aged well — its phases, dependencies, and completion tests still describe the system that got built. The tracker has aged less well: it was accurate on 9 August 2026, then ten interface tasks ran without it being updated, and two of them silently removed features it still records as finished.

The pattern worth naming: **the tracker records what was built, not what is still there.** Nothing checks whether a later redesign removed an earlier promise. R-13 and R-14 were lost exactly that way, and neither the tracker nor the status file noticed.

Nothing in this file was changed. It records what is, not what should be.
