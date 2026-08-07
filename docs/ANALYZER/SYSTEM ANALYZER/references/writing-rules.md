# Writing Rules

The contract every output file obeys. Read this before writing any of them.

## 1. Plain language is not optional

The reader is bright, curious, and has never written a line of code. Write for them. Precision stays; jargon goes.

### Swap table

| Do not write | Write instead |
|---|---|
| API | the way two programs talk to each other |
| endpoint | a specific address the program listens at |
| database | the store where information is kept |
| schema | the shape the stored information takes |
| query | a request for information from the store |
| authentication | checking who someone is |
| authorization | checking what someone is allowed to do |
| token / session | the pass that proves someone is already signed in |
| cache | a short-term copy kept close by for speed |
| deploy | put the new version in front of real users |
| repository | the folder holding all the working files |
| function / method | a small named job the program can do |
| class / module / component | a self-contained part of the program |
| variable | a labelled box holding one piece of information |
| parameter / argument | something handed to a job so it knows what to work on |
| return value | what a job hands back when it finishes |
| refactor | tidy the inner workings without changing what it does |
| dependency | something this part needs in order to work |
| library / package / framework | ready-made work built by someone else |
| middleware | a step every request passes through on its way in |
| asynchronous | started now, finished later, without holding anything up |
| race condition | two things happening at once and tripping over each other |
| null / undefined | nothing is there |
| exception / error handling | what happens when something goes wrong |
| validation | checking that what came in makes sense |
| migration | moving stored information into a new shape |
| build / compile | turning the working files into the thing that actually runs |
| latency / throughput | how long it takes / how much it can handle |
| scalability | whether it keeps working as it gets busier |
| stateless / stateful | remembers nothing between visits / remembers |
| CRUD | create, read, change, delete |
| frontend / backend | the part people see / the part doing the work behind it |

The table is a starting point, not a boundary. Any technical word not listed still needs a plain replacement.

### When a technical word cannot be avoided

Real names stay real. A file called `payroll_service.py`, a product called PostgreSQL, a company's own term for something — these are names, and renaming them would make the notes useless. Keep them, and:

1. Write the plain meaning right beside the first use — "PostgreSQL, the program that stores the information".
2. Add it to `10 - WORD LIST` with a one-line meaning.

### Sentences

Short. One idea each. Active voice — "the booking page checks the date" beats "the date is checked by the booking page". If a sentence needs a comma to hold itself together, it is probably two sentences.

## 2. No code in the output

The only fenced block permitted anywhere in the output is Mermaid. Not one line of source code, not one command, not one configuration snippet, not one sample of stored information.

To point at code, name it and describe it:

> The check that stops a booking in the past lives in `booking.py`, around line 214. It compares the requested date against today's date and refuses anything earlier.

Never:

> ```python
> if requested_date < date.today():
>     raise ValueError("past date")
> ```

Field names, file names, and settings names may appear as inline `code ticks` — they are labels, not code.

## 3. Everything is traceable

Every statement of fact earns its place by naming where it came from.

| Source | How to cite it |
|---|---|
| Document | `Requirements.docx`, page 4 — or the heading, if the file has no pages |
| Source code | `booking.py`, lines 200–230 |
| Something the user said | asked for in conversation, 5 August 2026 |
| Worked out from the material | *drawn from* `booking.py` and `Requirements.docx`, page 4 |

That last row matters. Reasoning is allowed — inventing is not. When a conclusion is yours rather than the material's, mark it *drawn from* and name what you drew it from.

Anything the material does not settle goes to *Open Questions* in `00 - START HERE`. Never fill a gap with a plausible guess.

Dates are written out in full — 5 August 2026, not 05/08/26 and not "last Tuesday".

## 4. Naming

```
00 - START HERE.md
01 - OVERVIEW.md
02 - DOCUMENT FINDINGS.md
```

- Two digits, zero-padded.
- Space, hyphen, space.
- **The name in capitals.** `01 - OVERVIEW`, not `01 - Overview`. Every letter, every file, no exceptions.
- `00` is always the entry point and always called `START HERE`.

The run folder is in capitals too — `ANALYSIS - SAMPLE CHECK`, not `Analysis - Sample Check`.

The heading at the top of each file matches its name exactly, capitals included — `# 03 - CODE FINDINGS`. A file whose heading and name disagree is confusing to look at and easy to mislink.

Capitals apply to the file name only. Everything inside the file — headings below the first, table cells, prose — is written normally. A note shouting at its reader is a note nobody finishes.

Numbers are fixed and never shift. If `02 - DOCUMENT FINDINGS` does not apply because no documents were supplied, the number `02` goes unused for that run and `00` records why. Renumbering the files that follow would break every link pointing at them.

## 5. Linking

Obsidian wikilinks: `[[01 - OVERVIEW]]`. To point at a section inside a file: `[[07 - DEVELOPMENT ROADMAP#Phase 2 — Booking]]`.

**Navigation line.** Every file opens with one, directly under its title, before any other content:

```
[[00 - START HERE|Back to start]] · Previous: [[01 - OVERVIEW]] · Next: [[03 - CODE FINDINGS]]
```

- `00 - START HERE` has no previous. Its line is just the next file.
- The last file has no next.
- Previous and next skip files that were not made this run.

**Links in the body.** Whenever the text mentions something covered elsewhere, link it — the first time it comes up in that file. Roadmap items, tasks, and diagrams get linked to their section.

A link after `#` points at a heading, never at a row in a table. Roadmap items and tasks live in rows, so they are linked through the heading they sit under, with the number kept as the visible text:

```
[[08 - ROADMAP TRACKER#Phase 2 — The Rules Match What Was Promised|R-04]]
```

Not `[[08 - ROADMAP TRACKER#R-04]]` — there is no heading called `R-04`, so that link goes nowhere.

**No orphans.** Every file is reachable from `00 - START HERE`, and every file links back to it. Checkable in Obsidian's graph view: one connected cluster, nothing floating.

## 6. Tables

Tables carry facts; prose carries meaning. Use a table when the same shape of information repeats — the trackers, the word list, the parts of the system. Use prose when explaining why something is the way it is.

Keep cells short. A cell running past a line or two wants to be prose in the section beneath.

## 7. Length

Detailed enough to be genuinely useful, short enough to be read. A findings file covering a small project might run one page; a large one, several. What decides length is how much the material actually says — never padding, never a section written just because a template lists it. A section with nothing to report says so in one line and moves on.
