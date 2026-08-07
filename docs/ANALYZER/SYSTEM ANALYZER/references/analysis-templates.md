# Analysis Templates

Templates for `00`, `01`, `02`, `03`, `04`, `05`, and `10`. Everything in angle brackets gets replaced. Sections with nothing to report say so in one line rather than being dropped — an empty section is information too.

---

## 00 - START HERE.md

The front door. Written first as a skeleton, finished last once the other files exist.

````markdown
# 00 - START HERE

Next: [01 - OVERVIEW](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/01%20-%20OVERVIEW.md)

**What this is about:** <subject name>
**Written:** <date in full>
**Last updated:** <date in full>

## What was handed over

| What | Kind | Read? |
|---|---|---|
| `<file or folder name>` | Document / Source code | Yes — in full |
| `<file or folder name>` | Source code | Yes — main parts only |
| `<file or folder name>` | Document | No — <reason> |

<One paragraph: what all this material adds up to, and how much of it was covered. If large parts went unread, say which and why.>

## The short version

<Three to six sentences. What the thing is, what state it is in, and the single most important thing the reader should know. Someone who reads only this section should still come away with the truth.>

## Everything in this analysis

| File | What it holds |
|---|---|
| [01 - OVERVIEW](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/01%20-%20OVERVIEW.md) | What this thing is and what it does |
| [02 - DOCUMENT FINDINGS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/02%20-%20DOCUMENT%20FINDINGS.md) | What the documents say |
| [03 - CODE FINDINGS](03%20-%20CODE%20FINDINGS.md) | What the working files actually do |
| [04 - COMBINED FINDINGS](04%20-%20COMBINED%20FINDINGS.md) | Where the documents and the working files agree and disagree |
| [05 - SYSTEM ARCHITECTURE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/05%20-%20SYSTEM%20ARCHITECTURE.md) | The parts and how they hand work along |
| [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md) | The pictures |
| [07 - DEVELOPMENT ROADMAP](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md) | What to build, in what order |
| [08 - ROADMAP TRACKER](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/08%20-%20ROADMAP%20TRACKER.md) | Where each roadmap item stands |
| [09 - TASK TRACKER](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/09%20-%20TASK%20TRACKER.md) | Every task and where it came from |
| [10 - WORD LIST](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/10%20-%20WORD%20LIST.md) | Plain meanings for the words that could not be avoided |

## Not made this time

| File | Why not |
|---|---|
| `02 - DOCUMENT FINDINGS` | No documents were supplied. |

<Drop this whole section if all eleven files were made.>

## How to read this

<A short paragraph pointing the reader at the right door. Something like: for the plan, go to the roadmap; for where things stand, the roadmap tracker; for how it all fits together, the architecture note and the diagrams.>

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

## Open questions

Things the material does not settle. Each one is a real gap, not a guess dressed up as a question.

| # | Question | Why it matters | Who can answer |
|---|---|---|---|
| Q-01 | <question in plain words> | <what stays uncertain until this is answered> | <person, team, or "the supplied documents may cover it elsewhere"> |

## What changed

Only after a later update. Newest first.

| Date | What changed |
|---|---|
| <date in full> | <what new material arrived and what it changed> |
````

---

## 01 - OVERVIEW.md

The one file a reader in a hurry will actually open. No findings, no plan — just what the thing is.

````markdown
# 01 - OVERVIEW

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Next: [02 - DOCUMENT FINDINGS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/02%20-%20DOCUMENT%20FINDINGS.md)

## What it is

<Two or three sentences. If you cannot say what it is without a technical word, you do not yet understand it well enough to write this section.>

## Who uses it

| Who they are | What they come here to do |
|---|---|
| <plain description of the person> | <what they are trying to get done> |

## What it does

<A handful of short paragraphs or a list. The main things the system does, in the order a user would meet them.>

## What state it is in

<Plainly: is this an idea, a half-built thing, or something already running? Say what is working, what is half-done, and what is only written down. Cite where you can see this.>

## What it does not do

<Boundaries stated in the material. Just as useful as the list above, and often skipped.>

## Where the details are

<Two or three lines pointing at [05 - SYSTEM ARCHITECTURE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/05%20-%20SYSTEM%20ARCHITECTURE.md), [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md), [07 - DEVELOPMENT ROADMAP](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md).>
````

---

## 02 - DOCUMENT FINDINGS.md

Written when documents were supplied. What the documents say — not what you think of it.

````markdown
# 02 - DOCUMENT FINDINGS

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [01 - OVERVIEW](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/01%20-%20OVERVIEW.md) · Next: [03 - CODE FINDINGS](03%20-%20CODE%20FINDINGS.md)

## What was read

| Document | Kind | How much was read |
|---|---|---|
| `<file name>` | Word document, 14 pages | All of it |

## What the documents say the system must do

| # | What it must do | Where it says so |
|---|---|---|
| D-01 | <plain description> | `<file>`, page <n> |

## Rules it has to follow

<Rules, limits, and conditions the documents impose — how long something may take, who may see what, what must never happen. Each with its source. If the documents set none, say so.>

## Decisions already made

| Decision | Reasoning given | Where it says so |
|---|---|---|
| <what was decided> | <why, if the document says — otherwise "no reason given"> | `<file>`, page <n> |

## Where the documents disagree

Contradictions found between documents, or inside one. Recorded, not resolved.

| # | One says | The other says | Where |
|---|---|---|---|
| C-01 | <first version> | <second version> | `<file>` page <n> and `<file>` page <n> |

## What the documents leave unsaid

<Gaps that matter. Each becomes a question in the *Open questions* section of [00 - START HERE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md).>
````

---

## 03 - CODE FINDINGS.md

Written when source code was supplied. What the code actually does, in words, pointing at files and lines.

````markdown
# 03 - CODE FINDINGS

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [02 - DOCUMENT FINDINGS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/02%20-%20DOCUMENT%20FINDINGS.md) · Next: [04 - COMBINED FINDINGS](04%20-%20COMBINED%20FINDINGS.md)

## What was read

| Folder or file | What it appears to be for | How much was read |
|---|---|---|
| `<path>` | <plain description> | All of it / main parts only |

<If large parts went unread, say which and why. A reader must never mistake a partial reading for a full one.>

## The main parts

| Part | Where it lives | What it is responsible for |
|---|---|---|
| <plain name> | `<path>` | <one sentence> |

## How work travels through it

<For each main journey through the system — someone signs in, someone places an order — walk it step by step in plain words, naming the file and line each step lives at. These journeys become the flowcharts in [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md).>

**<Name of the journey>**

1. <what happens> — `<file>`, line <n>
2. <what happens next> — `<file>`, line <n>

## Where information is kept

| What is kept | Where it is kept | What it is for |
|---|---|---|
| <plain description> | <the store, named plainly> | <why the system needs it> |

## What it connects to on the outside

| What it talks to | What for | Where that happens |
|---|---|---|
| <other program or service> | <why> | `<file>`, line <n> |

## What is unfinished, switched off, or unused

| # | What | Where | How it looks |
|---|---|---|---|
| U-01 | <plain description> | `<file>`, line <n> | Half-built / switched off / written but never used |

## Things worth flagging

<Anything a reader would want to know: work that appears twice in different places, a step that looks fragile, a piece nothing else depends on. Plain words, no scolding, each with its location. If the code looks sound, say that — it is a finding too.>
````

---

## 04 - COMBINED FINDINGS.md

Written only when both documents and source code were supplied. Usually the most valuable file in the set — give it room.

````markdown
# 04 - COMBINED FINDINGS

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [03 - CODE FINDINGS](03%20-%20CODE%20FINDINGS.md) · Next: [05 - SYSTEM ARCHITECTURE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/05%20-%20SYSTEM%20ARCHITECTURE.md)

## The picture in one paragraph

<How closely the written intentions and the built reality match. One paragraph, honest.>

## Promised and built

| # | What was promised | Where it was promised | Where it was built | Does it match? |
|---|---|---|---|---|
| M-01 | <plain description> | `<file>`, page <n> | `<file>`, line <n> | Fully / partly — <what differs> |

## Promised but missing

| # | What was promised | Where it was promised | What is there instead |
|---|---|---|---|
| G-01 | <plain description> | `<file>`, page <n> | Nothing / <the partial version that exists> |

<These are the strongest candidates for the roadmap in [07 - DEVELOPMENT ROADMAP](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md).>

## Built but never written down

| # | What exists | Where | Why it matters |
|---|---|---|---|
| X-01 | <plain description> | `<file>`, line <n> | <what happens if nobody knows it is there> |

## Where they flatly contradict each other

| # | The documents say | The working files do | Where |
|---|---|---|---|
| K-01 | <written version> | <built version> | `<file>` page <n> and `<file>` line <n> |

<Each contradiction becomes a question in [00 - START HERE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) — which one is right is not yours to decide.>

## What this means for what happens next

<A short section carrying the reader from findings to plan. Names the biggest gaps and why they lead the roadmap. Links into [07 - DEVELOPMENT ROADMAP](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md).>
````

---

## 05 - SYSTEM ARCHITECTURE.md

Two jobs: describe the arrangement that exists, and set out the one being proposed. Never let a reader mistake one for the other.

````markdown
# 05 - SYSTEM ARCHITECTURE

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [04 - COMBINED FINDINGS](04%20-%20COMBINED%20FINDINGS.md) · Next: [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md)

## How to read this note

<One short paragraph. Says that the first half describes what is there now, the second half what is being proposed, and that every part is labelled either existing or proposed.>

## The arrangement today

### The parts

| Part | Status | What it is for | Who or what it serves |
|---|---|---|---|
| <plain name> | 🔵 Already there | <one sentence> | <the part or person that depends on it> |

### How work passes between them

<Plain prose, part by part. What each hands to the next and what comes back. This section is the words behind the big-picture diagram in [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md) — the two must agree.>

### Where things are kept

<The stores of information, what lives in each, and which parts reach for them.>

### Where it touches the outside world

<Anything beyond this system's own walls: other services, other companies' systems, hardware. What each is for and what happens when one is unavailable, if the material says.>

### What holds the arrangement together

<The choices that shape everything else — the decisions that would be expensive to reverse. Each with its source. If the material never explains a choice, say that rather than inventing a reason.>

## The arrangement being proposed

<Drop this whole half if nothing new is being proposed and say so in one line.>

### What changes and why

| Part | Status | What it is for | Why it is being added or changed |
|---|---|---|---|
| <plain name> | ⭕ Proposed | <one sentence> | <the problem it solves, cited> |

### How work would pass between them

<Same as above, for the proposed arrangement. Matches the proposed diagram in [06 - DIAGRAMS](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/06%20-%20DIAGRAMS.md).>

### What it would take to get there

<Plain description of the move from today's arrangement to the proposed one — what must happen first, what can happen alongside, what cannot be undone once started. Feeds the phase order in [07 - DEVELOPMENT ROADMAP](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/07%20-%20DEVELOPMENT%20ROADMAP.md).>

### What is being given up

<Every arrangement trades something away. Say what. If the material does not say, this becomes a question in [00 - START HERE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md).>
````

---

## 10 - WORD LIST.md

Every technical word that survived into the output, explained once, properly.

````markdown
# 10 - WORD LIST

[Back to start](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/00%20-%20START%20HERE.md) · Previous: [09 - TASK TRACKER](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/09%20-%20TASK%20TRACKER.md)

Words that could not be avoided, because they are real names of real things. Each one explained as it is used here.

| Word | What it means here | Where it comes up |
|---|---|---|
| `<the word>` | <one plain sentence — no other technical words inside the explanation> | [03 - CODE FINDINGS](03%20-%20CODE%20FINDINGS.md), [05 - SYSTEM ARCHITECTURE](../../ANALYSIS%20-%20GLOBAL%20CAR%20EXCHANGE/05%20-%20SYSTEM%20ARCHITECTURE.md) |

## How this list was built

Any technical word left in the notes had to earn its place by being a real name — a file, a product, a term this project already uses. Everything else was replaced with everyday words. If a word here is still unclear, that is a fault in this list, not in the reader.
````

---

## Filling these in

- Delete the angle brackets and the guidance text. None of it belongs in the finished file.
- Keep the ID prefixes as given — `D-`, `C-`, `U-`, `M-`, `G-`, `X-`, `K-`, `Q-`. They let one file point at an exact line in another.
- Numbers run in order within a file and are never reused, even after something is deleted.
- A section with nothing in it gets one line — "No contradictions were found between the documents." — and then the next section starts.
