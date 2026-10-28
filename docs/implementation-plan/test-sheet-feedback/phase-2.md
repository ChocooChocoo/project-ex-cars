[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)

**Status:** 🔲 Not Started

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

- [ ] Migration `supabase/migrations/<timestamp>_profile_avatar.sql`:
  - `profiles.avatar_url TEXT`.
  - Public bucket `avatars`, 2 MB limit, `image/jpeg`, `image/png`, `image/webp`.
  - Storage policies: a user can insert, update and delete only under `avatars/<auth.uid()>/`.
  - Migration test in the style of `20261028100000_t04_payment_option.test.ts`.
- [ ] Server actions `updateOwnAvatar(formData)` and `removeOwnAvatar()` in `src/app/auth/actions.ts`:
  - Check type and size on the server.
  - Upload to `avatars/<uid>/avatar-<timestamp>.<ext>` and delete the old file.
  - Write `profiles.avatar_url` and `auth.updateUser({ data: { avatar_url } })`, so the menus can read it from
    user metadata without an extra query.
  - Unit tests for each path.
- [ ] `load-own-profile.ts`: also select `avatar_url`, and add the role label to `OwnProfile`.
- [ ] Rework the `profile-forms.tsx` layout:
  - Header card: large avatar with "Change photo" and "Remove", name, email and role badge.
  - Below: "Personal details" and "Password" sections, each with a heading and a short description. One column on
    phones, two on desktop.
  - Reuse shadcn `Card`, `Avatar`, `Separator` and `Field`. No new dependency.
- [ ] `AccountSwitcher` and `UserMenu`: add `AvatarImage src={user.user_metadata?.avatar_url}` and keep the initials
  fallback.
- [ ] Run a design review (`ux-ui-agent-skills:design-review` or `impeccable`) on the new page at phone and desktop
  width.

## Done when

- [ ] The Buyer and the CEO each upload a photo. After a reload it shows on Profile, in the account menu and in the
  sidebar.
- [ ] A 3 MB file or a PDF is refused with a clear message.
- [ ] One user cannot overwrite another user's file (storage policy test).
- [ ] "Remove" brings back the initials.
- [ ] `npm run test`, `npx tsc --noEmit` and `npm run check` pass on touched files.
- [ ] Owner applies the migration to hosted Supabase.

---

[← Previous: Phase 1](./phase-1.md) | [Next: Phase 3 →](./phase-3.md)
