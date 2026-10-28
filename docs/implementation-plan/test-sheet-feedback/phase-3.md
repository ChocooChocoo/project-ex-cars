[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)

**Status:** 🔲 Not Started

# Phase 3: Customer changes own email with a code

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

- [ ] `requestEmailChange(formData)` in `src/app/auth/actions.ts`:
  - Customer role only, checked on the server.
  - Validate with `emailSchema` and refuse the current email.
  - Call `supabase.auth.updateUser({ email })`.
  - Map "already registered" and rate-limit errors to plain messages.
- [ ] `confirmEmailChange(formData)`: `supabase.auth.verifyOtp({ email: newEmail, token, type: "email_change" })`, then
  `revalidatePath("/my-profile")`.
- [ ] Profile UI, customers only: a "Change email" button opens a 2-step dialog.
  - Step 1: new email.
  - Step 2: code input (6 digits, `inputMode="numeric"`, `autoComplete="one-time-code"`), "Resend code", inline
    errors.
  - Staff keep the existing "Contact GCE" note.
- [ ] `supabase/config.toml`: `double_confirm_changes = false`.
- [ ] Unit tests: staff call refused, same email refused, wrong code message, success path.

## Done when

- [ ] On the hosted site, a customer changes their email with the code and then signs in with the new email.
- [ ] A wrong or expired code shows a message, and the email stays the same.
- [ ] The staff Profile has no change-email button, and the action refuses a staff call.
- [ ] `npm run test`, `npx tsc --noEmit` and `npm run check` pass on touched files.

## Blockers (owner, hosted Supabase dashboard)

1. Turn off "Secure email change" (Authentication → Providers → Email).
2. The "Change Email Address" template must include `{{ .Token }}` so the email carries the code.
3. Built-in Supabase mail sends only a few emails per hour, and only to project team addresses. Real customers need
   custom SMTP (Authentication → SMTP Settings). Without it, this feature works only for team emails.

---

[← Previous: Phase 2](./phase-2.md) | [Next: Phase 4 →](./phase-4.md)
