# 11 - TECH STACK

[[00 - START HERE|Back to start]] · Previous: [[10 - WORD LIST]] · Next: [[12 - DATABASE SCHEMA]]

## Status of this decision

This is a **proposed** technology arrangement. The user selected Next.js and Supabase in conversation on 7 August 2026. No application, Supabase project, database, installed supporting files, or published application was supplied, so none of this is marked as already built. See [[00 - START HERE#Open questions|Q-01]].

The arrangement below is *drawn from* the documented system responsibilities in [[02 - DOCUMENT FINDINGS]], the proposed parts in [[05 - SYSTEM ARCHITECTURE]], and the build order in [[07 - DEVELOPMENT ROADMAP]].

## The proposed stack

| Part | Proposed choice | What it would do | Why it fits this project |
|---|---|---|---|
| Web application | Next.js App Router | Provide the customer pages, staff work areas, server-side actions, and responsive layouts | One browser-based application can serve customers and employees without creating native phone applications. — **GCE FULL CHAPTER 1 - 3.docx**, pages 15–17 and 21 |
| Application language | TypeScript | Add clear checks around the shapes of users, vehicles, transactions, approvals, and payroll records | The system has many linked record types and role boundaries; early mismatch checks reduce avoidable mistakes. — *Drawn from* [[07 - DEVELOPMENT ROADMAP]] |
| Structured records | Supabase PostgreSQL | Keep the shared customer, vehicle, conversation, transaction, finance, and staff records | The documents require one consistent information store instead of scattered spreadsheets and paper records. — **GCE FULL CHAPTER 1 - 3.docx**, pages 10–16 and 20–21 |
| Accounts | Supabase Auth | Register users, verify sign-in details, maintain signed-in sessions, and supply each person's unique account identifier | Registration, sign-in, email and phone checks, profiles, and walk-in account creation are required by [[07 - DEVELOPMENT ROADMAP#Phase 1 — One shared foundation\|R-01]]. |
| File storage | Supabase Storage | Hold vehicle photographs, 360-degree media, identification, proof of billing, paperwork, reports, payslips, and security evidence | The documents require several public and private file types with different viewers. — **GCE FULL CHAPTER 1 - 3.docx**, pages 34–43; **GCE USERS LEVELS MODULES.md**, headings “Mechanic”, “Sales Manager”, and “Head Security” |
| Selected live updates | Supabase Realtime | Update inquiry messages, unread notices, and selected work-status changes without a manual page refresh | Vehicle-linked chat and unread notices are required by [[07 - DEVELOPMENT ROADMAP#Phase 3 — Conversations stay together\|R-09]] through [[07 - DEVELOPMENT ROADMAP#Phase 3 — Conversations stay together\|R-11]]. |
| Record access | PostgreSQL Row Level Security | Check each requested row against the signed-in person and assigned role | Customers, suppliers, and eight operational roles must see only their own or assigned work. — **GCE USERS LEVELS MODULES.md**, headings “CEO” through “Head Security”; **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management” |

Next.js documents the App Router as its current application structure. Supabase's official Next.js guide uses that arrangement with protected signed-in state, while its database documentation explains that Supabase records live in PostgreSQL. — [Next.js App Router](https://nextjs.org/docs/app), [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [Supabase database overview](https://supabase.com/docs/guides/database/overview)

## How responsibility would be divided

### The browser

The browser would show pages, collect input, upload permitted files, and subscribe only to the selected live updates a person may receive. It would use a Supabase publishable key. It would never receive the service-role key or another secret that bypasses access checks. — [Supabase API key guidance](https://supabase.com/docs/guides/api/api-keys)

### The Next.js server

The server side of Next.js would handle sensitive operations that ordinary browser requests must not perform directly. These include creating a walk-in account, creating and approving a supplier account, changing an employee's role, completing an approval, generating a private report, and carrying out a multi-record status change. The server would still rely on database rules and constraints rather than treating server code as the only protection.

Two of the revision-list items also belong on the server rather than in the browser alone. Field checks must be enforced again on the server and in the database, because a check that lives only in the browser can be bypassed. The word filter must likewise run before a message is stored, not only before it is displayed. — **REVISIONS LISTS.md**, headings “1. Chat, Notifications, and Reports” and “8. Form Data Validation”

### Supabase Auth

Supabase Auth would own sign-in identities. A separate profile record would hold business information, and a protected role record would decide which of the ten current roles the person has: customer, supplier, and the eight operational roles. Role information would not be accepted from user-editable account details. The Account Manager's access-management screen would call a protected server action rather than changing the role directly from the browser. A supplier identity would exist but stay unable to sign in until GCE approves the registration, so the approval state must be checked at sign-in and not only shown on a screen. — **GCE USERS LEVELS MODULES.md**, heading “Account Manager — 5. RBAC (Role-Based Access Control)”; **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management”; [Supabase Auth and Row Level Security](https://supabase.com/docs/guides/auth)

### Supabase PostgreSQL

PostgreSQL would hold structured records and their relationships. Database constraints would stop impossible records, such as a negative amount, two favourites for the same customer and vehicle, or two installment numbers for the same account. Indexes would support the searches people use repeatedly. The proposed tables and rules are in [[12 - DATABASE SCHEMA]].

### Supabase Storage

Storage would hold files; PostgreSQL would hold their descriptions, owners, and paths. Public showroom media and private identification, payroll, transaction, and security files would not share one unrestricted bucket. Storage policies would use the same account and role boundaries as the related records. Chat photographs and files and supplier identification would each get their own private area, because a chat attachment is readable by the people in that conversation while a supplier's identification is not. — **REVISIONS LISTS.md**, headings “1. Chat, Notifications, and Reports” and “5. Supplier Registration and Account Management”; [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

### Supabase Realtime

Realtime would be used narrowly for inquiry messages, unread notices, and a small number of status updates. Ordinary catalogue, payroll, finance, and report pages would read current database records when opened. This avoids sending every internal change to every connected client. — [Supabase Realtime overview](https://supabase.com/docs/guides/realtime)

### Work outside the application

Money would still be settled outside the application. The system would keep permitted payment and approval records but would not become a payment gateway. Delivery, meet-ups, acquisition, and vehicle recovery would remain human work supported by assignments and evidence records rather than automatic logistics or live tracking. — **GCE FULL CHAPTER 1 - 3.docx**, pages 16–17; **GCE USERS LEVELS MODULES.md**, headings “Account Manager — 2. Inquiries and Viewing Schedule” and “Confidential Informant”

## Security boundaries that must not be optional

- Every table exposed through Supabase's Data API must have Row Level Security and specific read, add, change, and delete policies. Being signed in is not enough by itself. A policy must also check ownership, assignment, or an approved staff role. — [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Customers must never be able to change their own role, approval result, payroll amount, payment verification, vehicle price approval, or transaction status merely by changing a browser request.
- A supplier account must not be able to sign in or reach any record before GCE approves it. That check belongs in the sign-in path and in the row rules, not only in the screen that shows the approval. — **REVISIONS LISTS.md**, heading “5. Supplier Registration and Account Management”
- Field limits must be enforced on the server and in database constraints as well as in the browser. A browser-only check is a convenience, not a protection. — **REVISIONS LISTS.md**, heading “8. Form Data Validation”
- A chat attachment must be readable only by the people in that conversation and the staff assigned to it. Knowing the file path must not be enough. — **REVISIONS LISTS.md**, heading “1. Chat, Notifications, and Reports”
- The service-role key must remain on a trusted server and must never use a `NEXT_PUBLIC_` name.
- User-editable account metadata must not decide authorization. The proposed design keeps roles in a protected database area instead.
- Private files must use Storage policies and short-lived signed links. Knowing a file path must not be enough to open an identification document, payslip, or security photograph.
- Approval and money-related changes must add an audit event showing who acted, what record changed, and when. That event must not be edited or deleted later.
- Custom Global Car Exchange tables and functions must live in the application's own `public` or `private` schemas. Supabase restricts custom changes inside its managed `auth`, `storage`, and `realtime` schemas. — [Supabase breaking-change notice](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)

## Deliberately not chosen yet

| Decision still open | Why it is not fixed here |
|---|---|
| Hosting provider | Next.js and Supabase can be planned without choosing the final web host. |
| Visual component library and styling system | The supplied material describes behaviour, not a final visual system. |
| Email delivery and phone-verification providers | The documents require checks but do not name providers or message rules. See [[00 - START HERE#Open questions\|Q-08]]. |
| 360-degree media viewer | The documents require the experience but do not name a file format or viewer. |
| Report export format | Reports are required, but PDF, spreadsheet, and print rules are not stated. |
| Backup, retention, and deletion periods | Private identification, payroll, finance, and security records need approved retention rules before implementation. |
| Separate customer and employee applications | The current proposal uses one responsive Next.js application until [[00 - START HERE#Open questions\|Q-06]] is answered. |
| What the downloadable mobile application is | The revision list asks for an in-system download while the chapter document excludes native phone applications. No installable arrangement is chosen here until [[00 - START HERE#Open questions\|Q-24]] is answered. See [[02 - DOCUMENT FINDINGS#Active disagreement\|C-06]]. |
| How inappropriate words are detected | A stored word list, a ready-made filter, or an outside service are all possible. The words, languages, and hide-or-censor choice are missing — [[00 - START HERE#Open questions\|Q-28]]. |
| The field-limit values themselves | The revision list requires limits but supplies none, so no numbers, lengths, or formats are proposed here — [[00 - START HERE#Open questions\|Q-25]]. |

## What this note does not authorize

This note does not create a Supabase project, install supporting files, select versions, write private settings, create migrations, or publish an application. Versions must be checked against the current official documentation and changelog when implementation begins; remembered version numbers must not be treated as current. — [Supabase changelog](https://supabase.com/changelog?types=breaking-change)
