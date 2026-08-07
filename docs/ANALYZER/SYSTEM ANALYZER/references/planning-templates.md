# Planning Templates

Templates for `07 - DEVELOPMENT ROADMAP`, `08 - ROADMAP TRACKER`, and `09 - TASK TRACKER`, plus the two things that bind them together: the status legend and the ID scheme.

---

## The status legend

Used in every tracker, in `00 - START HERE`, and at the top of the vault. Never reworded, never re-emoji'd — a legend that shifts between files is worse than no legend.

| Emoji | Status | Means |
|---|---|---|
| ✅ | Finished | Built, checked, and working |
| 🟨 | Being worked on | Started, not finished |
| ⭕ | Not started | Waiting its turn — the normal state of a new item |
| ❌ | Blocked | Something is stopping it; the tracker says what |
| 🔵 | Already there | Found in the supplied material — built before this plan existed |
| ⬜ | Dropped | Decided against, kept on the list so nobody proposes it again |
| ❓ | Unclear | The material does not say whether this is done |

More emojis may be added when a run genuinely needs one — but add it to the legend everywhere it appears, or it means nothing.

Two of these carry weight and are easy to get wrong:

- **🔵 Already there** is for work found sitting in the supplied code, finished before this analysis began. Marking it ⭕ Not started would send someone off to rebuild something that already works.
- **❓ Unclear** is honest and useful. Use it rather than guessing at ✅.

---

## The ID scheme

Three prefixes, and they are how the three files find each other.

| Prefix | For | Lives in | Example |
|---|---|---|---|
| `R-` | A roadmap item — one thing to be built | `07`, tracked in `08` | `R-04` |
| `T-` | A task — one piece of work under a roadmap item | `09` | `T-11` |
| `Q-` | An open question | `00` | `Q-02` |

Rules:

- Numbers run in order across the whole run, not restarted per phase. `R-01` through `R-24`, straight through.
- A number is never reused, even after its item is dropped. Dropped items stay in the tracker as ⬜, because a reference to `R-07` must always find `R-07`.
- New material later means new numbers on the end. Never renumber — every renumbering silently breaks every link pointing at the old number.
- Every `R-` in the roadmap appears in the tracker. Every `T-` in the task tracker names the `R-` it serves, or says plainly that it serves none.
- Phase headings are frozen once written. Because roadmap items and tasks are rows rather than headings, every link to one goes through its phase heading — so a reworded phase name breaks every link pointing into that phase, exactly as renumbering would. Reword the phase's description if it reads badly; leave the heading alone.

---

## 07 - DEVELOPMENT ROADMAP.md

Phases in chronological order. **Development work only** — what gets built and in what order. Nothing about budget, hiring, marketing, launch dates, or team arrangements, even if the supplied material discusses them.

Everything here comes from what the user supplied — the documents, the code, and anything they said about revisions, suggestions, and improvements. A roadmap item with no root in the material does not belong on the roadmap.

````markdown
# 07 - DEVELOPMENT ROADMAP

[[00 - START HERE|Back to start]] · Previous: [[06 - DIAGRAMS]] · Next: [[08 - ROADMAP TRACKER]]

## What this covers

<One paragraph. What the plan sets out to build, and how far ahead it reaches. Says plainly that it covers building work only.>

## Where the plan came from

<Two or three sentences naming the material this was drawn from — the findings files, the documents, the code, anything the user asked for directly. Links to [[02 - DOCUMENT FINDINGS]], [[03 - CODE FINDINGS]], [[04 - COMBINED FINDINGS]].>

## The phases at a glance

| Phase | What it delivers | Waits on |
|---|---|---|
| Phase 1 — <name> | <one line> | Nothing — this one starts |
| Phase 2 — <name> | <one line> | Phase 1 |

<The picture of this order lives in [[06 - DIAGRAMS]].>

---

## Phase 1 — <Name>

**The goal:** <One sentence. What is true at the end of this phase that was not true at the start.>

**Why it comes first:** <What makes this the starting point — usually that everything else leans on it.>

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-01 | <plain description of one thing to be built> | <what it makes possible> | `<file>`, page <n> |
| R-02 | <plain description> | <what it makes possible> | [[04 - COMBINED FINDINGS#G-01]] |

**How you know the phase is finished:**

- <Something a non-technical person could check for themselves.>
- <Another one.>

**What could hold it up:** <Known obstacles, drawn from the material. If none are known, say so.>

---

## Phase 2 — <Name>

**The goal:** <one sentence>

**Why it comes here:** <What it needed from Phase 1 that it could not have started without. This is the sentence that justifies the order — do not skip it.>

**What gets built:**

| # | What gets built | Why it is needed | Where the need came from |
|---|---|---|---|
| R-03 | <plain description> | <what it makes possible> | `<file>`, line <n> |

**How you know the phase is finished:**

- <checkable statement>

**What could hold it up:** <obstacles>

---

<Repeat for every phase.>

## Deliberately left out

| What | Why it is not here |
|---|---|
| <thing the material mentions> | Not building work — <what it is instead>. |
| <thing the material mentions> | <another reason, such as: the material never says enough about it to plan it. See [[00 - START HERE#Open questions]].> |

<This section stops readers wondering whether something was forgotten.>
````

### Getting the phases right

- **Chronological, and honestly so.** A phase sits where it sits because of what it needs from the phases before it. Every phase after the first says what it was waiting for.
- **Three to seven phases** suits most projects. Twelve phases usually means several should be merged; two usually means the middle was skipped.
- **Name phases by outcome, not activity.** "People can sign in and be recognised" beats "Authentication work".
- **No dates unless the user gave them.** Order is the promise; dates are a guess. If the user supplied dates, use theirs and say where they came from.
- **Every item traces back.** The last column is not decoration — an item that cannot cite its source should not be on the list.

---

## 08 - ROADMAP TRACKER.md

Every roadmap item, with its status. Read at a glance, top to bottom.

````markdown
# 08 - ROADMAP TRACKER

[[00 - START HERE|Back to start]] · Previous: [[07 - DEVELOPMENT ROADMAP]] · Next: [[09 - TASK TRACKER]]

**Last checked:** <date in full>

## Where everything stands

| Status | How many |
|---|---|
| ✅ Finished | <n> |
| 🟨 Being worked on | <n> |
| ⭕ Not started | <n> |
| ❌ Blocked | <n> |
| 🔵 Already there | <n> |
| ⬜ Dropped | <n> |
| ❓ Unclear | <n> |
| **Total** | **<n>** |

<One sentence reading the numbers aloud — what state the plan is in overall.>

## Phase 1 — <Name>

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-01 | <plain description> | 🔵 Already there | Found working in `<file>`, line <n>. |
| R-02 | <plain description> | ⭕ Not started | |
| R-03 | <plain description> | ❌ Blocked | Waiting on <what>. Raised as [[00 - START HERE#Open questions\|Q-02]]. |

## Phase 2 — <Name>

| # | What gets built | Status | Notes |
|---|---|---|---|
| R-04 | <plain description> | ⭕ Not started | |

<One table per phase, phases in the same order as [[07 - DEVELOPMENT ROADMAP]].>

## What is blocked

Pulled out of the tables above so nothing hides in a long list.

| # | What gets built | What is stopping it | What would clear it |
|---|---|---|---|
| R-03 | <plain description> | <the obstacle in plain words> | <what has to happen> |

<If nothing is blocked, one line saying so.>

## Status legend

| Emoji | Means |
|---|---|
| ✅ | Finished — built, checked, working |
| 🟨 | Being worked on right now |
| ⭕ | Not started — waiting its turn |
| ❌ | Blocked — something is stopping it |
| 🔵 | Already there — found in the supplied material, built before this plan |
| ⬜ | Dropped — decided against, kept for the record |
| ❓ | Unclear — the material does not say |
````

Every `R-` item in the roadmap appears here exactly once. The count in the summary table equals the number of rows in the phase tables — if it does not, one of them is wrong.

The Notes column earns its keep on ❌, 🔵, ⬜, and ❓ rows, which are the four that raise a question in the reader's mind. On a plain ⭕ row it can stay empty.

---

## 09 - TASK TRACKER.md

Every task, and where it came from. **No task without an origin** — that is the whole point of this file.

A task is a piece of work small enough that one person could pick it up and know what to do. Roadmap items are usually bigger than tasks: one `R-` item often breaks into several `T-` tasks.

````markdown
# 09 - TASK TRACKER

[[00 - START HERE|Back to start]] · Previous: [[08 - ROADMAP TRACKER]] · Next: [[10 - WORD LIST]]

**Last checked:** <date in full>

Every task here names where it came from. A task with no traceable origin is not on this list.

## Where everything stands

| Status | How many |
|---|---|
| ✅ Finished | <n> |
| 🟨 Being worked on | <n> |
| ⭕ Not started | <n> |
| ❌ Blocked | <n> |
| 🔵 Already there | <n> |
| ⬜ Dropped | <n> |
| ❓ Unclear | <n> |
| **Total** | **<n>** |

## The tasks

| # | The task | Where it came from | What it refers to | Serves | Status |
|---|---|---|---|---|---|
| T-01 | <plain description of one piece of work> | `Requirements.docx`, page 4 | The rule that a booking cannot be made for a past date | [[07 - DEVELOPMENT ROADMAP#Phase 1 — <Name>\|R-01]] | ⭕ |
| T-02 | <plain description> | `booking.py`, lines 200–230 | The check that already exists but only covers one of the two ways in | [[07 - DEVELOPMENT ROADMAP#Phase 1 — <Name>\|R-01]] | 🔵 |
| T-03 | <plain description> | Asked for in conversation, <date in full> | The user's request to <what they asked for> | [[07 - DEVELOPMENT ROADMAP#Phase 2 — <Name>\|R-04]] | ⭕ |
| T-04 | <plain description> | *Drawn from* `Spec.pdf` page 9 and `orders.py` line 88 | The gap between what was promised and what was built — [[04 - COMBINED FINDINGS#G-02]] | [[07 - DEVELOPMENT ROADMAP#Phase 2 — <Name>\|R-05]] | ⭕ |

## Tasks that serve no roadmap item

Work that came out of the material but does not sit under any phase. Kept here so it is not lost.

| # | The task | Where it came from | Why it is not on the roadmap | Status |
|---|---|---|---|---|
| T-<n> | <plain description> | <source> | <reason — not building work, too vague to place, waiting on an answer> | ⭕ |

<If every task serves a roadmap item, one line saying so.>

## Status legend

| Emoji | Means |
|---|---|
| ✅ | Finished — built, checked, working |
| 🟨 | Being worked on right now |
| ⭕ | Not started — waiting its turn |
| ❌ | Blocked — something is stopping it |
| 🔵 | Already there — found in the supplied material, built before this plan |
| ⬜ | Dropped — decided against, kept for the record |
| ❓ | Unclear — the material does not say |
````

### The four kinds of origin

Every task's origin falls into one of these, and the column is written accordingly:

| Kind | Written as |
|---|---|
| A document said so | `Requirements.docx`, page 4 |
| The code shows it | `booking.py`, lines 200–230 |
| The user asked for it | Asked for in conversation, 5 August 2026 |
| Worked out from more than one source | *Drawn from* `Spec.pdf` page 9 and `orders.py` line 88 |

The fourth kind is where honesty matters most. A task that came from your own reading of the material, rather than from anything the material states outright, says so — *drawn from* — and names everything it was drawn from. That way a reader can go and check whether they agree.

The **What it refers to** column is not a repeat of the origin. The origin says where to look; this column says what is actually there — the rule, the gap, the half-built thing that made this task necessary.
