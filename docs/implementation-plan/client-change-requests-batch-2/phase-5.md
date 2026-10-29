[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)

**Status:** ✅ Done (2026-10-28). Committed as `1cf67e6` on local branch `fix/auth-batch2-phase-1` (not pushed).

> 2026-10-28: Started and finished. Found during the work: signed out, the landing page showed no cars or content.
> The anon role cannot read `vehicles` or `content_items` ("permission denied for table user_roles", code 42501):
> their staff SELECT policies read `private.user_roles`, which anon may not touch. Fixed without a migration: the
> landing page reads with the admin client, limited to published content and available cars, public columns only.
> The page revalidates every 60 s (the admin client reads no cookies, so it would otherwise be frozen at build time).
>
> 2026-10-28 (later): Landing redesigned on user request ("too simple"), then rebuilt on the app's own shadcn design
> system at the user's request (no custom CSS, fonts or colour tokens; `globals.css` unchanged). Sections: hero with a
> stock photo, Marketing promotions strip, showroom grid (shadcn Card + Badge; real photos or a car icon, never another
> car's photo), "Three ways to get your car", and a financing estimator (Card, NativeSelect, ToggleGroup) using
> `financedTotal()`. Animations use `motion` (hero entrance, scroll reveals, promo strip), static under reduced
> motion. Added `motion` and `images.remotePatterns` (Supabase storage, Unsplash); `PRODUCT.md` written. Checks:
> `npm run test` 663 passed, `npx tsc --noEmit` clean, `npm run build` passes (`/` ISR 1m), landing e2e 3 passed,
> impeccable detector no findings. Playwright MCP at 1280 px (light and dark) and 375 px: no horizontal overflow, no
> console errors. Stock photos to replace: Unsplash `photo-1519641471654-76ce0107ad1b` (hero) and
> `photo-1533473359331-0135ef1b58bf` (routes).

# Phase 5: Landing page

**Goal:** Signed-out visitors to `/` see a public landing page with a "Log in" button that opens the existing login
page (L1, L2).

Decision: no separate customer login page. "Log in" goes to `/auth/v1/login`.

## Dependencies

- None inside this plan

## Tasks

- [x] Delete `src/app/page.tsx`. It redirects and conflicts with `src/app/(external)/page.tsx` on `/`.
- [x] In `src/proxy.ts:93-102`, serve `/` to signed-out visitors instead of redirecting to `/auth/v1/login`. Signed-in
  users still go to `landingPath(role)`.
  > 2026-10-28: Done; `src/proxy.test.ts` has 2 new tests (visitor gets `/`, customer redirected to
  > `/customer/showroom`). The visitor test failed before the change ("expected 'https://app.test/auth/v1/login' to be
  > null") and passes after.
- [x] **L1:** Review `src/app/(external)/page.tsx` (hero, promotions, featured vehicles). Make sure it uses real
  showroom data or static copy, with no template placeholders.
  > 2026-10-28: Rewritten. Hero from published `hero` content (static fallback copy), "In the showroom" lists up to 6
  > available cars (real data), plus Marketing's featured, promotion and announcement content. Car links go to
  > `/customer/showroom/<id>` (signed-out visitors are sent to log in). The signed-in branches were removed: the proxy
  > never shows `/` to a signed-in user. Note: the hosted DB has "GCE Test Artifact" cars listed as available, so they
  > show on the page; that is test data, not page code.
- [x] **L2:** Add "Log in" (→ `/auth/v1/login`) and "Register" (→ `/auth/v1/register`) buttons to the landing page header
  and hero.
  > 2026-10-28: Header nav "Account" has Register and Log in; hero has Log in and Create an account.
- [x] Add a landing spec to `src/tests/e2e/` (signed-out visit, Log in click).
  > 2026-10-28: `src/tests/e2e/landing.spec.ts` (2 tests; the signed-in one needs `SEED_USER_PASSWORD`).

## Done when

- [x] `npm run build` succeeds, with no duplicate `/` route.
  > 2026-10-28: Build passes; one `/` route, ISR 1m.
- [x] Signed out, `/` shows the landing page, and "Log in" opens `/auth/v1/login`.
  > 2026-10-28: Playwright MCP: signed out, `/` stays on `/` with header, hero, 6 cars, featured and promotions;
  > header Log in opens `/auth/v1/login`, Register opens `/auth/v1/register`. Checked at 1280 px and 375 px.
- [x] Signed in as the customer, `/` redirects to `/customer/showroom`.
  > 2026-10-28: Playwright MCP and the e2e spec: `customer@gce.local` at `/` lands on `/customer/showroom`.
- [x] The new e2e spec passes.
  > 2026-10-28: `npx playwright test src/tests/e2e/landing.spec.ts`: 2 passed. Also `npm run test` 663 passed,
  > `npx tsc --noEmit` clean, biome clean on the changed files.

---

[← Previous: Phase 4](./phase-4.md) | [Next: Phase 6 →](./phase-6.md)
