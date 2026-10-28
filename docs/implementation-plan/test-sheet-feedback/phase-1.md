[Next: Phase 2 →](./phase-2.md)

**Status:** ✅ Done in code (2026-10-28). Hosted Supabase rule still to be set by the owner (last item).

# Phase 1: Strong password rule for new passwords

**Goal:** Every new password (sign-up, walk-in account, change password) needs at least 8 characters with an
uppercase letter, a lowercase letter, a number and a special character. Sign-in stays unchanged, so existing users
with older passwords can still log in.

Source: test sheet feedback #4 (Profile page, C15) and #23 (Create Walk-In, AM4). See
`GCE-CHANGE-REQUESTS-FEEDBACK.md`.

## Background

- One shared `passwordSchema` (`src/lib/validation/forms.ts:9`) is used by sign-up, **sign-in**
  (`src/app/auth/actions.ts:21`), walk-in creation (`actions.ts:206`) and change password
  (`src/lib/validation/profile.ts`). Making it strict would lock out existing users at sign-in, so new passwords get
  their own schema.
- The walk-in form (`src/app/(staff)/staff-records/_components/walk-in-form.tsx:62`) has its own hand-written
  8-character check and a plain `type="password"` input.
- `supabase/config.toml:182-185`: `minimum_password_length = 6`, `password_requirements = ""`.

## Dependencies

- None

## Tasks

- [x] Add `newPasswordSchema` in `src/lib/validation/forms.ts`: `passwordSchema` plus 4 `.regex()` checks, one message
  each ("Add an uppercase letter.", "Add a lowercase letter.", "Add a number.", "Add a special character."). Export the
  rule list so the UI hint reuses the same regexes. Keep `passwordSchema` for sign-in.
- [x] Use `newPasswordSchema` in `src/app/auth/_components/register-form.tsx`, `signUp` (`src/app/auth/actions.ts:82`),
  `createWalkInAccountSchema` (`actions.ts:206`) and `changePasswordSchema` (`src/lib/validation/profile.ts`).
- [x] Walk-in form: replace the hand-written length check with `newPasswordSchema.safeParse` and show the first
  message. Swap its password `Input` for the shared `PasswordInput` (`src/components/password-input.tsx`).
- [x] Add `src/components/password-rules.tsx`: a short list of the length rule and the 4 character rules that ticks as
  the user types. Use it under new-password fields on register, walk-in and profile. Change the profile Password card
  description from "At least 8 characters."
- [x] `supabase/config.toml`: `minimum_password_length = 8`,
  `password_requirements = "lower_upper_letters_digits_symbols"`.
- [x] Tests:
  - `src/lib/validation/forms.test.ts`: one case per missing character type, and one valid password.
  - Update fixtures to strong passwords in `actions.signup.test.ts`, `actions.task33.test.ts`,
    `actions.profile.test.ts` and `walk-in-form.task33.test.tsx`. Add one "weak password refused" case to each.
  - One case that sign-in still accepts an older 8-character password without symbols.

## Done when

- [x] `npm run test` passes, `npx tsc --noEmit` exits 0, and `npm run check` has no findings on touched files.
- [x] Playwright MCP browser: `abcdefgh` is refused on register, walk-in and change password with the matching
  message. `Abcdef1!` is accepted on all three.
- [x] Existing test accounts still sign in.
- [ ] Owner sets the same rule in hosted Supabase: Authentication → Providers → Email → Minimum length 8 and Password
  requirements "Lowercase, uppercase, digits and symbols".

## Status notes (2026-10-28)

- `PASSWORD_RULES` and `newPasswordSchema` are in `src/lib/validation/forms.ts`. The symbol rule uses Supabase Auth's
  symbol set, so a space alone is not counted as a symbol (Supabase would refuse it).
- Files: `forms.ts`, `forms.test.ts` (new), `profile.ts`, `src/app/auth/actions.ts`, `register-form.tsx`,
  `walk-in-form.tsx`, `src/components/password-rules.tsx` (new), `profile-forms.tsx`, `supabase/config.toml`, and the 4
  test files. `src/app/template/**` was left alone.
- Checks: `npm run test` 99 files / 638 tests pass. `npx tsc --noEmit` exits 0. `npm run check` has no findings on
  touched files (the remaining findings are in `scripts/` and `reconditioning-overview.tsx`, which this phase did not touch).
- Playwright MCP (localhost:3000, hosted Supabase):
  - Register: `abcdefgh` refused with "Add an uppercase letter."; `Abcdef1!` ticks all 5 rules with no field error.
    The form was not submitted, so no extra account was created.
  - Walk-in (Account Manager): `abcdefgh` refused with the same toast. `Abcdef1!` created `walkin-pwtest@example.com`,
    which then signed in.
  - Change password (as `walkin-pwtest@example.com`): `abcdefgh` refused; `Abcdef2!` saved ("Password changed.").
    `Abcdef1!` itself could not be reused because the new password must differ from the current one.
  - `account_manager@gce.local` signed in with the existing seed password.
- Test data left in hosted Supabase: customer `walkin-pwtest@example.com` (password `Abcdef2!`).

---

[Next: Phase 2 →](./phase-2.md)
