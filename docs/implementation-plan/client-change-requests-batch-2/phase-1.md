[Next: Phase 2 →](./phase-2.md)

**Status:** ✅ Done (2026-10-28). Committed on branch `fix/auth-batch2-phase-1`, pushed and open as PR #4; not yet merged or
deployed. Phases 2–10 are committed on the same branch.

> 2026-10-27: Work started (A1, A2, A3, X1 code and tests).
>
> 2026-10-27: All code tasks are done and verified locally. Two Done-when checks waited on owner changes in the hosted
> Supabase dashboard: Google provider credentials and Site URL / Redirect URLs.
>
> 2026-10-28: **A2 dropped by the client.** "Continue with Google" is removed completely: the button file, its use
> on the v1/v2 login and register pages (with the "Or continue with" divider), the `[auth.external.google]` block in
> `supabase/config.toml`, and the Google vars in `.env.example`. The `?error=auth_callback_failed` alert stays, because
> the email verification link also goes through `/auth/callback`. `src/app/template/**` keeps its own copy (upstream
> design preview, not product). The A2 tasks below are kept for history and marked ~~struck~~.
>
> 2026-10-28: Committed on local branch `fix/auth-batch2-phase-1` (not pushed, not merged): `f4381d9` (phase work)
> and `2a90337` (Google removal). Re-tested the committed code in the Playwright MCP browser on localhost: all pass
> (see Test results). Only blocker left: the hosted Supabase Site URL (Blocker 1).
>
> 2026-10-28: The owner fixed the Site URL and Redirect URLs (Blocker 1 resolved), then registered with a real email
> and verified through the link. Every Done-when item is checked. Phase set to Done.

# Phase 1: Auth fixes and policy checkboxes

**Goal:** The show-password toggle works every time (A1), "Continue with Google" signs the user in (A2), registration
and account verification finish without errors (A3), and registration requires Terms and Conditions and Company
Policy checkboxes (X1).

Source: `docs/tasks/T04.md`.

## Dependencies

- None
- ~~Google OAuth client ID and secret~~ (no longer needed: A2 dropped 2026-10-28)

## Tasks

- [x] **A1:** Add a shared `src/components/password-input.tsx`. It wraps `Input` and uses `useState` for visibility,
  with a `type="button"` eye/eye-off icon button that has an `aria-label`. Today no toggle exists in the code. The
  intermittent one users see is Edge's native `::-ms-reveal`.
  - Done: `PasswordInput` (lucide `Eye`/`EyeOff`, `aria-label` Show/Hide password, `aria-pressed`, focus ring,
    disabled with the input). Test: `src/components/password-input.test.tsx` (2 pass).
- [x] **A1:** Use `PasswordInput` in `src/app/auth/_components/login-form.tsx:80` and `register-form.tsx:105,123`.
  Hide the native reveal in `src/app/globals.css` (`input::-ms-reveal { display: none; }`).
  - Done: all three password fields swapped; rule added in `@layer base` of `globals.css`.
- [x] ~~**A2:**~~ (removed 2026-10-28) In `src/app/auth/_components/social-auth/google-button.tsx`, add an `onClick` that calls
  `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/auth/callback" } })`.
  - Done: client component, uses `createClient()` from `src/lib/supabase/client.ts`, `type="button"`, disables
    while redirecting, shows `toast.error` on failure. Verified in the browser: click goes to
    `<supabase>/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback`.
- [x] ~~**A2:**~~ (removed 2026-10-28) Add `[auth.external.google]` (with `env(...)` secrets) to `supabase/config.toml`. Fill in
  `NEXT_PUBLIC_SITE_URL` and the Google variables in `.env.example`.
  - Done: provider block with `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`, `skip_nonce_check = true`
    (local only); `http://127.0.0.1:3000/auth/callback` added to `additional_redirect_urls`. `.env.example`
    documents both Google vars and the wider use of `NEXT_PUBLIC_SITE_URL`.
- [x] **A2:** Show `?error=auth_callback_failed` as an alert on the login page. Today
  `src/app/auth/callback/route.ts:40` sets it but nothing displays it.
  - Done: `src/app/auth/v1/login/page.tsx` reads `searchParams` and shows a destructive `Alert` ("Sign-in could not
    be completed. Please try again."). Verified in the browser.
- [x] **A3:** Reproduce the registration error on the hosted project (systematic-debugging) and record the exact error.
  - Reproduced on https://global-exchange-car.vercel.app/auth/v1/register (clean browser):
    1. The hosted project has email confirmation **on**. `signUp` returns no session, but the old code still set
       `gce-role=customer` and redirected to `/customer/showroom`. The visitor sees a blank showroom, then is bounced
       to `/auth/v1/login` with no message. Logging in gives the toast **"Email not confirmed"**.
    2. Root cause of the failing verification: the hosted Supabase **Site URL is `http://localhost:3000`**, and the
       Vercel callback is not in the Redirect URLs allow list. Checked with `auth.admin.generateLink`: the link's
       `redirect_to` is `http://localhost:3000` even when `https://global-exchange-car.vercel.app/auth/callback` is
       requested. Every verification email therefore sends the user to localhost. This is a dashboard setting, not
       code (see Blockers).
- [x] **A3:** In `signUp` (`src/app/auth/actions.ts:74-110`):
  - Pass `emailRedirectTo` pointing to `/auth/callback`.
  - When `data.session` is null, return a "Check your email to verify your account" state. Don't set `gce-role` or
    redirect.
  - Treat an empty `data.user.identities` as "email already registered".
  - Remove the redundant admin profile write; the `handle_new_user` trigger already creates the profile.
  - Done: origin comes from the request `Origin` header, falling back to `NEXT_PUBLIC_SITE_URL`. Returns
    `{ notice }`; `register-form.tsx` replaces the form with a `role="status"` alert. Verified in the browser
    (no `gce-role` cookie set). The trigger set `full_name` on the hosted test user without the admin write.
- [x] **A3:** If the hosted email template uses `token_hash` links, add `src/app/auth/confirm/route.ts` calling
  `verifyOtp({ type, token_hash })`, then reuse the callback's role-cookie logic.
  - Not needed: the generated hosted link is the default `{{ .ConfirmationURL }}` form (`/auth/v1/verify?...`),
    which redirects with `?code=` to `/auth/callback`, and the existing callback exchanges it. Assumption: the
    owner has not customised the template. Limit: with PKCE, the link must be opened in the same browser that
    registered. Add `/auth/confirm` + a `token_hash` template if users verify on another device.
- [x] **X1:** Add two required checkboxes to `register-form.tsx`: "I agree to the Terms and Conditions" and "I agree to
  the Company Policy". Add a zod refine in the form schema and the same check in `signUp`. Store `terms_accepted_at`
  in `options.data` (user metadata).
  - Done. Verified on the hosted project: the test user's metadata has `terms_accepted_at`. Assumption: the labels
    are plain text because no Terms or Policy pages exist yet. Link them when the client sends the documents.
- [x] Tests: a `password-input.test.tsx` (toggle flips `type`, button doesn't submit), plus `signUp` cases (no session,
  duplicate email, unchecked policies) in `src/app/auth/actions.*.test.ts`.
  - Done: `src/app/auth/actions.signup.test.ts` (6 cases, including emailRedirectTo/terms metadata and the
    confirmations-off sign-in). Written first and seen failing, then passing.

## Done when

- [x] `npm run test` passes, including the new password and `signUp` cases.
  - 605/606 in the full run. The one failure is a 5 s timeout in `sell-vehicle-form.test.tsx` (not touched; a
    different test timed out on the first run). That file passes alone (26/26). All auth tests pass (21/21).
- [x] In the Playwright MCP browser, the eye button reveals and hides the password on login and register, over 5
  toggles.
  - Login password, register password, and confirm password: `text,password` × 5 each. The value is kept and the
    page does not submit.
- [x] Registration with both boxes checked shows the "check your email" message (or signs in when confirmations are
  off). With either box unchecked, registration is refused.
  - Only Terms checked: the form shows "You must agree to the Company Policy." Both checked: the
    "Check your email to verify your account." alert shows. The server-side refusal is covered by unit tests.
- [x] ~~Clicking "Continue with Google" reaches Google's consent page. After consent, the user lands on
  `/customer/showroom` with `gce-role=customer` set.~~ Dropped 2026-10-28: the client removed Google sign-in.
  Verified after removal: no "Continue with Google" or "Or continue with" left under `src/app/auth`; tsc exit 0;
  biome clean on `src/app/auth`; auth tests 21/21.
- [x] `npx tsc --noEmit` exits 0 and `npm run check` has no findings on the touched files.
  - tsc exit 0. `npx biome check` on touched files: no findings. Full `npm run check` only reports existing
    findings in `.opencode/skills/**` (not part of this phase).

## Test results

Playwright MCP browser, `http://localhost:3000`, 2026-10-28, branch `fix/auth-batch2-phase-1` at `2a90337`:

| Check | Result |
| --- | --- |
| `/auth/v1/login`, `/auth/v1/register`, `/auth/v2/login`, `/auth/v2/register` load | ✅ HTTP 200 each |
| No "Continue with Google" or "Or continue with" on those 4 pages | ✅ none found |
| Eye buttons: 1 on each login page, 2 on each register page | ✅ |
| Login password toggle, 5 rounds | ✅ `text,password` × 5 |
| Both policy checkboxes on both register pages | ✅ |
| Empty register submit | ✅ 5 errors, including "You must agree to the Terms and Conditions." and "You must agree to the Company Policy." |
| `?error=auth_callback_failed` alert | ✅ "Sign-in could not be completed. Please try again." |

Playwright MCP browser, `http://localhost:3000`, 2026-10-27 (before the Google removal, same sign-up code):

| Check | Result |
| --- | --- |
| Register password and confirm toggle, 5 rounds each | ✅ value kept, no submit |
| Only Terms checked | ✅ refused: "You must agree to the Company Policy." |
| Both boxes checked | ✅ "Check your email to verify your account." shown; no `gce-role` cookie; `terms_accepted_at` in user metadata |

End-to-end email verification, 2026-10-28 (owner, real inbox, after Blocker 1 was fixed):

| Check | Result |
| --- | --- |
| Register, open the email link, land signed in | ✅ Reported working by the owner. Supabase shows account `ab9d0295-…` confirmed at 16:16:54Z and signed in at 16:16:54Z, with `terms_accepted_at` set and its profile row created by the trigger. |
| Second attempt `ac1b8308-…` | ⚠️ Email confirmed but no sign-in recorded. This fits the known PKCE limit: the link must be opened in the same browser that registered. That user can log in normally. |

Not tested in a browser yet:

- Registering an already-taken email: covered by unit tests only.
- The live Vercel site: the branch is not pushed or deployed.

## Blockers (owner, hosted Supabase dashboard)

1. ~~**Authentication → URL Configuration:** set Site URL to `https://global-exchange-car.vercel.app` and add
   `https://global-exchange-car.vercel.app/**` and `http://localhost:3000/**` to Redirect URLs.~~ **Resolved
   2026-10-28** by the owner. Checked with `auth.admin.generateLink`: the default `redirect_to` is now
   `https://global-exchange-car.vercel.app`, and both `https://global-exchange-car.vercel.app/auth/callback` and
   `http://localhost:3000/auth/callback` are accepted.
2. ~~Google provider~~: no longer needed (A2 dropped).
3. **Cleanup:** delete the three QA users created on the hosted project during this phase (the automated delete was
   not permitted): `3732e353-d5a0-49bb-9faf-527c46bae106` (gce.qa.a3.20261027@gmail.com),
   `cf1e0c75-0036-4d4e-9b46-69f4f33f3cc4` (gce.qa.a3b.20261027@gmail.com),
   `03d0ce08-a64e-4d98-815c-1c98f4c91cd6` (gce.qa.x1.20261027@gmail.com).

After the branch is merged and deployed, run a short smoke test on the Vercel site: register, open the email link, and
try an already-taken email. Until then, the live site still runs the old sign-up code.

## Files changed

`src/components/password-input.tsx` (new), `src/components/password-input.test.tsx` (new),
`src/app/auth/actions.signup.test.ts` (new), `src/app/auth/actions.ts`, `src/app/auth/_components/login-form.tsx`,
`src/app/auth/_components/register-form.tsx`, `src/app/auth/_components/social-auth/google-button.tsx` (deleted),
`src/app/auth/v1/login/page.tsx`, `src/app/auth/v1/register/page.tsx`, `src/app/auth/v2/login/page.tsx`,
`src/app/auth/v2/register/page.tsx`, `src/app/globals.css`, `supabase/config.toml`, `.env.example`.

---

[Next: Phase 2 →](./phase-2.md)
