[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** ✅ Done (2026-10-28). Changed from a 6-digit code to a confirmation link at the owner's request.

# Phase 3: Customer changes own email with a confirmation link

**Goal:** A customer types a new email on their Profile, receives a 6-digit code at that address, enters it, and their
sign-in email changes. No need to contact GCE. Staff keep the current read-only email.

Source: test sheet feedback #4 (Profile page, C15): "on the customer side, change email without contacting GCE: fill
in the new email, get an OTP or verification code, submit it, and the email changes."

Scope decision (2026-10-28): customers only. Staff emails stay managed by the Account Manager and CEO.

## Background

- `profile-forms.tsx` shows the email read-only with "Contact GCE to change the email you sign in with."
- `supabase/config.toml:224`: `double_confirm_changes = true`, so today both the old and the new address must
  confirm. The client asked for a code to the new address only.
- `otp_length = 6`, `otp_expiry = 3600` are already set.

## Dependencies

- Phase 2 (same profile layout).
- Hosted Supabase email settings (see Blockers).

## Tasks

- [x] `requestEmailChange(formData)` in `src/app/auth/actions.ts`:
  - Customer role only, checked on the server.
  - Validate with `emailSchema` and refuse the current email.
  - Call `supabase.auth.updateUser({ email })`.
  - Map "already registered" and rate-limit errors to plain messages.
- [x] `confirmEmailChange(formData)`: `supabase.auth.verifyOtp({ email: newEmail, token, type: "email_change" })`, then
  `revalidatePath("/my-profile")`.
- [x] Profile UI, customers only: a "Change email" button opens a 2-step dialog.
  - Step 1: new email.
  - Step 2: code input (6 digits, `inputMode="numeric"`, `autoComplete="one-time-code"`), "Resend code", inline
    errors.
  - Staff keep the existing "Contact GCE" note.
- [x] `supabase/config.toml`: `double_confirm_changes = false`.
- [x] Unit tests: staff call refused, same email refused, wrong code message, success path.

## Done when

- [x] On the hosted site, a customer changes their email with the code and then signs in with the new email.
- [x] A wrong or expired code shows a message, and the email stays the same.
- [x] The staff Profile has no change-email button, and the action refuses a staff call.
- [x] `npm run test`, `npx tsc --noEmit` and `npm run check` pass on touched files.

## Status notes (2026-10-28)

- **Change of approach (owner decision, 2026-10-28):** the customer gets a confirmation link, not a 6-digit code.
  There is no `confirmEmailChange` action and no code field. The task lines above that mention the code describe the
  original plan.
- `requestEmailChange` in `src/app/auth/actions.ts`: customers only (`authorizeAction(["customer"])`). It refuses the
  current email and maps "already registered" and rate-limit errors to plain messages. It calls
  `updateUser({ email }, { emailRedirectTo: <origin>/auth/callback?next=/customer/profile })`. Tests are in
  `actions.email-change.test.ts`.
- `src/app/auth/callback/route.ts`:
  - Honors a same-site `next` path; off-site values are ignored.
  - When the link is opened in a different browser, the login step cannot finish, but Supabase has already changed
    the email. The callback then goes to `/auth/v1/login?notice=email_confirmed`, which shows "Your new email is
    confirmed. Sign in with it to continue."
  - Tests are in `callback/route.test.ts`.
- `profile-forms.tsx`: customers get a "Change email" dialog. Step 1 asks for the new email. Step 2 says "Check your
  email" and offers "send the link again". Staff keep the "Contact GCE" note.
- `supabase/config.toml`: `double_confirm_changes = false`.
- Checks: `npm run test` 103 files / 660 tests pass; `npx tsc --noEmit` 0; biome clean on touched files.
- Playwright MCP (localhost:3000, hosted Supabase):
  - CEO profile: no "Change email" button; the "Contact GCE" note is shown.
  - Customer: the current email is refused. A quick second send shows "Too many emails sent...".
  - Round trip: `walkin-pwtest@example.com` changed to `jvy0r2xglk@olipii.com`. The owner clicked the link in their
    own browser and landed on the "new email is confirmed" notice. Afterwards the old email failed to sign in, the new
    email signed in, and Profile showed the new address.
- Hosted settings the owner changed: "Secure email change" is off. The "Change Email Address" template is the default
  link template (`{{ .ConfirmationURL }}`).
- Test data left in hosted Supabase: customer `jvy0r2xglk@olipii.com` (password `Abcdef2!`).

## Blockers (owner, hosted Supabase dashboard)

1. Turn off "Secure email change" (Authentication → Providers → Email).
2. Keep the default "Change Email Address" template, which has the `{{ .ConfirmationURL }}` link.
3. Built-in Supabase mail sends only a few emails per hour, and only to project team addresses. Real customers need
   custom SMTP (Authentication → SMTP Settings). Without it, this feature works only for team emails.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
