# Task 33 Corrective Implementation Plan

**Goal:** Fix private transaction image rendering, workflow authorization/RLS, Field Case modal usability, and Account Manager-only walk-in creation.

**Constraints:** No worktree. No commits. No new dependencies. Do not edit generated `src/components/ui/**`. Preserve unrelated user changes. Use TDD and root-cause fixes.

### Task 1: Secure transaction media rendering
Generate authenticated one-hour signed URLs in customer/staff transaction detail pages. Render image previews and PDF links in document lists; render sell images in Vehicle Photos & Condition; never expose raw private paths. Add focused tests.

### Task 2: Workflow permissions and approval consistency
Add migration 00045 dropping viewing_arrangements.inquiry_id NOT NULL, scoped customer transaction-linked INSERT/SELECT policies, and Head Accountant narrow document INSERT policies. Validate ownership/uploads. Recompute aggregate document state after either prerequisite kind. Keep CEO-only 2+1 approval recount. Add focused tests.

### Task 3: Create Field Case modal
Enrich transaction labels, group/sort transaction and vehicle options, cap list heights, bound dialog height, and prevent portalled select interaction from dismissing the dialog. Preserve explicit close paths. Add unit and real-browser tests.

### Task 4: Account Manager walk-in
Add an Account Manager-only Create Walk-In deep-link to Staff Records, auto-open the reused form, remove CEO permission, validate server input, derive actor UUID from authorization, handle/rollback partial admin failures, and add tests.

### Task 5: Final verification
Run task reviews, final broad review, focused browser inspection, relevant tests, full unit suite, build, and scoped/static checks. Report unrelated baseline check failures separately.
