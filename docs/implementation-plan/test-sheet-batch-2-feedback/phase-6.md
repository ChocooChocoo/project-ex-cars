[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)

**Status:** 🟡 In progress

> 2026-10-31: Phase 6 implementation started. Auth pages get a Home link, `/auth/v1` redirects to login, the
> Vehicles table links to a car's page, the staff showroom rewrite stops swallowing `showroom/<id>`, and the seed
> scripts mirror the 4th Mechanic and 4th Confidential Informant. Hosted-DB accounts stay blocked pending user
> approval; live QA (Playwright) deferred to the main agent.

# Phase 6: Small fixes (landing link, car page link, 4th accounts)

**Goal:** The client reaches the landing page and a car's staff page without typing addresses. There are 4 Mechanics
and 4 Confidential Informants.

Source: client answers on the batch 2 test sheet:
- Test 1 (Landing page): "pwede po sir bigay niyo nalang po samin yung link". In English: just give us the link.
  The client removed "login" from `/auth/v1/login`. `/auth/v1` has no page, so it is a 404 (`src/app/auth/v1/` holds
  only `login/` and `register/`).
- Test 10 (Interior photos): "lumalabas lang sir 'page not found'". In English: it only shows "page not found".
  The Vehicles list has no link to a car's page (`vehicles-columns.tsx:62-66`, plain `<span>`), so the client had to
  type the address.
  Another possible 404 path: `src/lib/routing/paths.ts:28` maps every `showroom...` path to `/staff-showroom` for
  staff. `src/app/(staff)/staff-showroom/` has no `[id]`, so `/{staff_role}/showroom/<id>` is a 404.
- Test 11 (Mechanic and CI accounts): "pa add po ng tag isa pa po sa mechanic and confidential informant bali
  magiging 4 po yung total nila lahat". In English: add one more of each, so there are 4 in total.

The hosted DB got accounts 2 and 3 through the Create Employee Account form, not the seed scripts
(`client-change-requests-batch-2/phase-6.md:55-61`).

## Dependencies

- None

## Tasks

- [x] `src/app/auth/v1/login/page.tsx:20` and `src/app/auth/v1/register/page.tsx`: wrap `<GceLogo>` in
  `<Link href="/">` and add a "← Home" link above the form. Do the same in `/auth/v2/*` if those pages can be
  reached.
  - `/auth/v2/*` is reachable: `src/proxy.ts:66` skips every `/auth*` path, and the sidebar's Authentication group
    links both v2 screens. The v2 logo lives in `src/app/auth/v2/layout.tsx`, so it is wrapped there; both v2 pages
    get the "← Home" link.
  - Verified: `npx tsc --noEmit` over `src/**` (temp config excluding the stale `.next` types) reports no error in
    these files. Live click-through deferred to the main agent.
- [x] `next.config.mjs` `redirects()`: send `/auth/v1` to `/auth/v1/login`.
  - Verified: `node --input-type=module -e "...config.redirects()..."` printed
    `[{"source":"/auth/v1","destination":"/auth/v1/login","permanent":false}]`.
- [x] `src/app/(staff)/vehicles/_components/vehicles-columns.tsx`:
  - Stock Code cell (:62-66): make it `<Link href={`/dashboard/vehicles/${id}`}>`.
  - Row menu (:163-197): add "View details". Text is "View Details", matching the Inspections and Transactions row
    menus; it uses the same `DropdownMenuItem asChild` + `Eye` icon pattern.
  - Verified: `npx vitest run "src/app/(staff)/vehicles/_components/vehicles-columns.test.tsx"` 5/5 passed; the
    existing test does not assert hrefs, so the live click stays in the QA step below.
- [x] `src/lib/routing/paths.ts:28`: map only the exact `showroom` segment to `/staff-showroom`. `showroom/<id>`
  should resolve to `/showroom/<id>`. Add a test case in the existing paths test.
  - The existing paths test is `src/proxy.test.ts` (it imports `resolveInternalPath`); two new cases cover
    `/marketing_specialist/showroom` → `/staff-showroom` and `/marketing_specialist/showroom/v-1` →
    `/showroom/v-1`. `npx vitest run src/proxy.test.ts`: 9/9 passed.
- [ ] 4th accounts on the hosted DB, only after the user approves. The Account Manager creates them with Staff
  Records → Create Employee Account and the shared seed password:
  - `mechanic4@gce.local`, "Ramon Dela Cruz" (placeholder name)
  - `confidential_informant4@gce.local`, "Joy Bautista" (placeholder name)

  The client can rename both.

  Blocked: needs explicit user approval for hosted DB accounts. Nothing was created or written on the hosted
  database; the seed scripts only mirror the two accounts.
- [x] Mirror the 2 accounts in the seed scripts:
  - `scripts/seed-users.cjs:41-47`
  - `scripts/seed-roles.sql:18-23`
  - `scripts/seed-data.cjs`: `loadUsers` (:177-186), field-case picks (:1128-1133), `seedStaffRecords`
    (:1300-1314)
  - Verified: `node --check` passes on both `.cjs` files, and a PowerShell count confirms each file references
    `mechanic4@gce.local` / `confidential_informant4@gce.local` once, with `users.mechanic4` and
    `users.confidential_informant4` each used twice in `seed-data.cjs` (field cases + staff records).

## Done when

- [ ] On the login and register pages, the logo and "← Home" open the landing page. Live QA deferred to main agent.
- [ ] `/auth/v1` opens the login page. Redirect rule verified in config; live request deferred to main agent.
- [ ] Playwright MCP as the Marketing Specialist: Vehicles → Stock Code opens the car's page, and the interior photo
  steps work without the address bar. Live QA deferred to main agent.
- [ ] `/marketing_specialist/showroom/<id>` renders the car instead of a 404. Rewrite covered by unit tests; live
  render deferred to main agent.
- [ ] Staff Records shows 4 Mechanics and 4 CIs. Both new accounts sign in and get the role schedule. Blocked with
  the hosted-DB accounts above; seed scripts are ready.
- [ ] `npm run check:fix`, `npx tsc --noEmit`, `npm run test` and `npm run build` pass. Not run: the subagent
  contract forbids the full suite, `check:fix` and `build`. Targeted runs passed; plain `npx tsc --noEmit` currently
  fails on the generated `.next/dev/types/validator.ts` (truncated line `fic`) and on
  `transaction-detail.tsx:693 timeZone` (another agent's file); a temp-config `tsc` over `src/**` reports no error
  in this phase's files.

---

## Live QA (2026-10-31, main agent)

- `/auth/v1` redirects to `/auth/v1/login` (200, no 404).
- The login page logo is a link to `/` ("GCE home") and "← Home" sits above the form; both open the landing page. The
  register page also shows the "← Home" link.
- Signed in as `marketing_specialist@gce.local`: the Vehicles table renders the Stock Code as a link
  (`/dashboard/vehicles/<id>`), and that URL renders the car page (for example "Mitsubishi Mirage G4").
- `/marketing_specialist/showroom/48583425-f765-4631-af90-6931d710c73e` renders the car (Suzuki Swift 2019) instead of
  a 404.
- Still blocked: the 4th Mechanic and 4th Confidential Informant on the hosted DB. `mechanic4@gce.local` and
  `confidential_informant4@gce.local` do not exist yet; creating them needs explicit approval because it writes real
  accounts. The seed scripts already carry both.

---

[← Previous: Phase 5](./phase-5.md) | [Next: Phase 7 →](./phase-7.md)
