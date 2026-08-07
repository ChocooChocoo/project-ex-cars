---
name: system-analyzer
description: Use when the user hands over documents, source code, or both and wants them understood, or asks for a development roadmap, a status tracker, a task tracker with origins, Mermaid diagrams or flowcharts, or system architecture documentation. Triggers on "analyze these documents", "analyze this code", "analyze this project", "review this material", "make me a roadmap", "track the roadmap", "track these tasks", "diagram this system", "document the architecture", "explain this in plain English". Produces a numbered, interlinked set of plain-language notes inside the Obsidian vault.
---

# System Analyzer

Reads what the user hands over and writes a numbered, linked set of plain-language notes into this Obsidian vault. Everything the analyzer produces is words, tables, and Mermaid diagrams. No program is written, no script is run, nothing is installed.

## The one rule above all others

**Write for someone who has never opened a code editor.** Every note must be readable start to finish by a person with no technical background, while still being precise enough that a developer would agree it is correct. If a sentence would make a non-technical reader stop and squint, rewrite it.

Read `references/writing-rules.md` before writing a single output file. It is the contract every module obeys.

## Step 1 — Take in the material

Ask for two things, unless the user already gave them:

1. **The material** — file paths, a folder, pasted text, or a mix.
2. **A short subject name** — what to call this analysis. A few words: "Payroll App", "Client Portal", "Booking System".

Then work out which of the three inputs you were given:

| What you were given | Which path |
|---|---|
| Documents only | Documents path |
| Source code only | Code path |
| Both | Combined path — do both, then compare them |

Documents means anything carrying written content: Word, PDF, Markdown, plain text, spreadsheets used as written specs, exported notes, and anything else of that kind. Source code means the working files of a program.

If the material is large, read the entry points and the highest-traffic files first, then widen. Say in `00 - START HERE` what you read and what you did not.

## Step 2 — Open the files

Never write a parser. Use what is already installed:

| Format | How to read it |
|---|---|
| PDF | The `anthropic-skills:pdf` skill |
| Word — .docx, .dotx | The `anthropic-skills:docx` skill |
| Spreadsheet — .xlsx, .csv | The `anthropic-skills:xlsx` skill |
| Slides — .pptx | The `anthropic-skills:pptx` skill |
| Markdown, text, source code | Read directly |

If a file cannot be opened, do not guess at its contents. Record it in the *Open Questions* section of `00 - START HERE` and carry on.

## Step 3 — Make the run folder

One folder per analysis, at the top of the vault:

```
ANALYSIS - <SUBJECT NAME>\
```

If that folder already exists, ask whether to update it in place or start a fresh one with a different subject name. Never silently overwrite an earlier analysis.

## Step 4 — Write the files

Eleven files, fixed numbers. A number is never reused for something else and never shifts, so links stay good between runs. A file that does not apply is simply not created, and `00 - START HERE` says so in its place.

| File | What it holds | Module | Written when |
|---|---|---|---|
| `00 - START HERE.md` | Front door: what was handed over, the index, the legend, open questions | Entry point | Always |
| `01 - OVERVIEW.md` | What this thing is and what it does, in everyday words | Overview | Always |
| `02 - DOCUMENT FINDINGS.md` | What the documents say | Document analyzer | Documents supplied |
| `03 - CODE FINDINGS.md` | What the code does, described in words | Code analyzer | Code supplied |
| `04 - COMBINED FINDINGS.md` | Where documents and code agree, disagree, or leave gaps | Combined analyzer | Both supplied |
| `05 - SYSTEM ARCHITECTURE.md` | The parts, what each is for, how they hand work along | Architecture analyzer and creator | Always |
| `06 - DIAGRAMS.md` | The pictures, all in Mermaid | Diagram module | Always |
| `07 - DEVELOPMENT ROADMAP.md` | Phases in time order, items `R-01`… | Roadmap creator | Always |
| `08 - ROADMAP TRACKER.md` | Every roadmap item with its status | Roadmap tracker | Always |
| `09 - TASK TRACKER.md` | Every task with where it came from | Task tracker | Always |
| `10 - WORD LIST.md` | Any unavoidable technical word, explained | Word list | Always |

Write them in number order. Later files lean on earlier ones — the roadmap draws on the findings, the trackers draw on the roadmap, the diagrams draw on the architecture.

Templates live in:

- `references/analysis-templates.md` — for `00`, `01`, `02`, `03`, `04`, `05`, `10`
- `references/planning-templates.md` — for `07`, `08`, `09`, plus the status legend and the ID scheme
- `references/diagram-templates.md` — for `06`, plus the Mermaid rules that keep diagrams from breaking

## Step 5 — Add the run to the vault front door

Add one line for this run to `00 - START HERE.md` at the top of the vault, linking to the run's own `00 - START HERE`. Create that vault-level file if it is missing.

## Step 6 — Check your own work

Before telling the user it is done, confirm each of these:

- [ ] Every file that should exist, exists — and is named exactly right, prefix and spacing included.
- [ ] Every `[[link]]` points at a file that is really there. A typo in a link is a dead end in Obsidian.
- [ ] Every file has its navigation line at the top.
- [ ] Every Mermaid block follows the rules in `references/diagram-templates.md`.
- [ ] Every roadmap item has an `R-` number, and every one of them appears in `08 - ROADMAP TRACKER`.
- [ ] Every task in `09 - TASK TRACKER` names where it came from. Not one blank.
- [ ] Every technical word left in the output appears in `10 - WORD LIST`.
- [ ] Nothing was invented. Every claim traces back to the material or sits in *Open Questions*.

## The nine modules

Each module is a section of this skill, not a separate thing to run. Each writes one numbered file.

### 1. Document analyzer → `02 - DOCUMENT FINDINGS.md`

Reads the supplied documents. Pulls out what the system is meant to do, the rules it must follow, who uses it, what has been decided, and what has been promised. Every point cites its document and page or heading. Contradictions between documents are recorded, not resolved by guessing.

### 2. Code analyzer → `03 - CODE FINDINGS.md`

Reads the supplied source code and describes, in plain words, what it actually does: the main pieces, what each piece is responsible for, the paths work travels along, where information is kept, and what the program connects to outside itself. Points at files and line numbers rather than quoting code. Notes what is clearly unfinished, switched off, or unused.

### 3. Combined analyzer → `04 - COMBINED FINDINGS.md`

Only when both were supplied. Sets the documents beside the code and reports three things: what was promised and built, what was promised and is missing, and what was built but never written down. This is where the real picture appears, so give it room.

### 4. System architecture analyzer and creator → `05 - SYSTEM ARCHITECTURE.md`

Two jobs in one file. First, describes the arrangement that already exists — the parts, each part's job, and how work passes between them. Second, where the material calls for an arrangement that does not exist yet, describes the one being proposed and says plainly which parts are existing and which are proposed.

### 5. Roadmap creator → `07 - DEVELOPMENT ROADMAP.md`

Turns the findings into phases in chronological order. Development work only — what gets built, in what order, and why that order. Nothing about budget, hiring, marketing, or launch. Every item carries an `R-` number. Content comes strictly from what the user supplied, including any revisions, suggestions, and improvements they mentioned.

### 6. Roadmap tracker → `08 - ROADMAP TRACKER.md`

Every `R-` item with a status emoji, so the state of the whole plan reads at a glance. Statuses come from the legend in `references/planning-templates.md`. Anything already built, found sitting in the supplied code, starts as already there — not as not started.

### 7. Task tracker → `09 - TASK TRACKER.md`

Every task with a `T-` number and, without exception, where it came from: which file, which page or line, which conversation. A task with no traceable origin does not belong in the table.

### 8. Diagram and flowchart module → `06 - DIAGRAMS.md`

The pictures, all in Mermaid, with the processes given the most attention. Every diagram is followed by a short plain-language reading of it, because a picture nobody can read is decoration.

### 9. Linking and naming → applies to every file

Every file carries the navigation line, links out to whatever it mentions, and follows the numbered naming pattern. Covered in `references/writing-rules.md`.

## When the user asks for only one piece

If the user asks only for a roadmap, or only for diagrams, write that file and `00 - START HERE`, and nothing else. `00` lists the rest as not yet made. Do not build the full set uninvited.

## When the user brings new material later

Update the existing run folder rather than starting a second one. Add new roadmap items with fresh `R-` numbers rather than renumbering old ones — renumbering breaks every reference pointing at them. Record what changed in the *What Changed* section of `00 - START HERE`.
