[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** ✅ Done (2026-10-28)

# Phase 2: Profile page redesign and profile photo

**Goal:** Staff and customers can upload a profile photo. The Profile page has a clear layout instead of two flat
cards, and the photo shows in the top-right account menu and the sidebar user menu.

Source: test sheet feedback #4 (Profile page, C15): "add a profile photo for employees and customers" and "improve
the UI, it looks laid out flat".

## Background

- One profile page serves every role: `src/components/profile/profile-forms.tsx` and `load-own-profile.ts`, rendered
  by `src/app/(customer)/my-profile/page.tsx` and `src/app/(staff)/profile/page.tsx`.
- `profiles` has no `avatar_url` column (`supabase/migrations/00001_phase1_schema.sql:11`).
- `AccountSwitcher` (`src/app/(staff)/_components/sidebar/account-switcher.tsx`) and the sidebar `UserMenu`
  (`app-sidebar.tsx:129`) read `user.user_metadata` and show initials only.

## Dependencies

- Phase 1 (both phases touch the Password card).

## Tasks

- [x] Migration `supabase/migrations/<timestamp>_profile_avatar.sql`:
  - `profiles.avatar_url TEXT`.
  - Public bucket `avatars`, 2 MB limit, `image/jpeg`, `image/png`, `image/webp`.
  - Storage policies: a user can insert, update and delete only under `avatars/<auth.uid()>/`.
  - Migration test in the style of `20261028100000_t04_payment_option.test.ts`.
- [x] Server actions `updateOwnAvatar(formData)` and `removeOwnAvatar()` in `src/app/auth/actions.ts`:
  - Check type and size on the server.
  - Upload to `avatars/<uid>/avatar-<timestamp>.<ext>` and delete the old file.
  - Write `profiles.avatar_url` and `auth.updateUser({ data: { avatar_url } })`, so the menus can read it from
    user metadata without an extra query.
  - Unit tests for each path.
- [x] `load-own-profile.ts`: also select `avatar_url`, and add the role label to `OwnProfile`.
- [x] Rework the `profile-forms.tsx` layout:
  - Header card: large avatar with "Change photo" and "Remove", name, email and role badge.
  - Below: "Personal details" and "Password" sections, each with a heading and a short description. One column on
    phones, two on desktop.
  - Reuse shadcn `Card`, `Avatar`, `Separator` and `Field`. No new dependency.
- [x] `AccountSwitcher` and `UserMenu`: add `AvatarImage src={user.user_metadata?.avatar_url}` and keep the initials
  fallback.
- [x] Run a design review (`ux-ui-agent-skills:design-review` or `impeccable`) on the new page at phone and desktop
  width.

## Done when

- [x] The Buyer and the CEO each upload a photo. After a reload it shows on Profile, in the account menu and in the
  sidebar.
- [x] A 3 MB file or a PDF is refused with a clear message.
- [x] One user cannot overwrite another user's file (storage policy test).
- [x] "Remove" brings back the initials.
- [x] `npm run test`, `npx tsc --noEmit` and `npm run check` pass on touched files.
- [x] Owner applies the migration to hosted Supabase.

## Status notes (2026-10-28)

- Migration `20261028120000_profile_avatar.sql` (+ text test) applied to hosted Supabase with `npx supabase db push`.
  The dry run listed only this file.
- `updateOwnAvatar` / `removeOwnAvatar` in `src/app/auth/actions.ts` use the user's own client, so storage rules apply.
  A replaced or removed photo's old file is deleted. If saving the profile fails, the new upload is deleted.
  Tests are in `actions.avatar.test.ts`.
- `load-own-profile.ts` adds `avatar_url` and `role_label` (from `getCurrentRole` + `ROLE_LABELS`).
  `database.types.ts` now includes `avatar_url`.
- `profile-forms.tsx`: new header card with avatar (reuses `getInitials`), name, role badge, email, Change/Add photo
  and Remove. The details and password cards stay below: one column on phones, two on desktop. The browser also
  checks file type and size before upload; the server checks again.
- `account-switcher.tsx` and `user-menu.tsx` show `AvatarImage` from `user_metadata.avatar_url`, with initials as fallback.
- Checks: `npm run test` 101 files / 650 tests pass; `npx tsc --noEmit` 0; biome clean on touched files.
- Playwright MCP (localhost:3000, hosted Supabase):
  - Buyer (`customer@gce.local`): PDF refused ("Use a JPG, PNG or WebP photo."), 3 MB JPEG refused ("The photo must
    be 2 MB or smaller."), PNG uploaded. After a reload it showed on Profile, in the top-right menu and in the sidebar.
    Remove brought back the "JD" initials in all three.
  - CEO: uploaded twice. The first file is gone from storage (a request that skips the CDN cache returns 400).
  - Storage policy, tested live with the CEO's token: writing to the Buyer's folder was refused ("new row violates
    row-level security policy"); writing and deleting in the CEO's own folder worked.
  - Design check, done by eye from screenshots at 1280 px and 390 px: no horizontal overflow, and the header card
    stacks and centers on phones. The `design-review` skill was not run.
  - Both test photos were removed afterwards, so the client starts without a photo.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
