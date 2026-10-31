[← Previous: Phase 6](./phase-6.md)

**Status:** 🔴 Blocked

> 2026-10-31: Blocked on the test sheet itself. Artifact `c04b0c2d-579f-4317-94eb-efad451fb527` is not in this repo and
> no tool here can edit it, so the `devNote` fields and the Claude QA `dev_answers` cannot be written. Phases 1 to 6
> are implemented and migrated, but the code is not deployed yet, so dev-mode QA on live would run against the old
> build. Needs the sheet export or a link plus a deploy before this phase can start.
>
> 2026-10-31 (later): Opened the artifact in the user's Brave over CDP. All 15 client answers and comments were read.
> The artifact renders read-only steps: the browser exposes only Dev mode and the answer buttons, so the steps cannot
> be rewritten in place. Replacement copy for tests 1, 7 and 9 is in [sheet-updates.md](./sheet-updates.md).
> Decision (user, 2026-10-31): keep the PayMongo model (option A), so test 7 is reworded and the manual Bank Transfer
> recording stays removed. The artifact still has to be regenerated with that copy before its dev answers are saved.
>
> 2026-10-31 (final): Dev answers were written in Dev mode as **Claude QA** for tests 1, 4, 5, 7, 9, 10, 11 and 13.
> Dev mode stores them in the separate `dev_answers` collection (`collectionName = () => devMode ? "dev_answers" :
> "answers"`), and turning Dev mode off confirms the client's Oct 30 answers are untouched. Recorded results:
> 4, 7, 9, 10, 13 Works; 1 Needs fixing (wording, `/auth/v1` is the login area by design); 5 Not sure (financing never
> re-tested); 11 Needs fixing (4th Mechanic and 4th CI accounts still not created). Regenerating the sheet with the
> corrected prose is still outstanding.

# Phase 7: Retest sheet and client handoff

**Goal:** The client retests every changed item on the batch 2 test sheet. The developer QA answers are saved in dev
mode first.

Source: artifact `c04b0c2d-579f-4317-94eb-efad451fb527` ("GCE Change Requests Test Sheet - Batch 2"). Client answers
are in the `answers` collection; developer QA answers are in `dev_answers`.

## Dependencies

- Phases 1 to 6 done and deployed.

## Tasks

- [ ] Update the test sheet. Add a `devNote` and new steps to these tests:
  - 1, Landing page: link to the main address `https://global-exchange-car.vercel.app/`, and point to the new Home
    link.
  - 4, Payment Option: Cash and Bank Transfer (via PayMongo) only.
  - 5, Financing: retest now that the schedule picker is fixed.
  - 7, Bank Transfer downpayment: the buyer pays the downpayment online through PayMongo; it is no longer recorded by
    staff.
  - 9, A bought car goes to posting: ask the client which step stopped them (their answer was Not sure, no comment).
  - 10, Interior photos: open the car from the Vehicles list's Stock Code link.
  - 11, Mechanic and CI accounts: 4 of each, with the mechanic4 and confidential_informant4 accounts added to the
    accounts list.
  - 13, Clock in and leave: split into separate tests:
    - clock-in time window
    - GCE building location
    - leave reason and proof files
    - overtime by date and hours
- [ ] Run dev-mode QA on live for every updated or new test, and save the results in `dev_answers` as Claude QA.
- [ ] Leave the client's `answers` untouched. Keep their old answers visible until they retest.

## Done when

- [ ] Every updated or new test has a Claude QA answer in dev mode.
- [ ] The client's answers are unchanged.
- [ ] The sheet's start screen lists what changed since Oct 29.

---

[← Previous: Phase 6](./phase-6.md)
