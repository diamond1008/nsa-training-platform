# Two-State Attendance Implementation Plan

> **For NSA Training Platform agents:** Execute this plan in the current `codex/fixed-training-slots` worktree because the attendance/UI changes it depends on are currently uncommitted there. Follow the repository architecture skill and verify each task before moving on.

**Goal:** Present teachers and administrators with only `Có mặt` and `Vắng`, default every unrecorded learner to `Vắng`, and restore a clear column-based attendance table without discarding legacy attendance history.

**Architecture:** Keep the four-value backend/database contract unchanged. Add a small frontend projection layer that maps `present/late` to `Có mặt` and `absent/excused/null` to `Vắng`; legacy values remain visible as history badges and are only replaced after an explicit user action.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Lock the two-state behavior with tests

**Files:**
- Modify: `apps/web/src/features/teacher/TeacherAttendancePage.test.tsx`
- Modify: `apps/web/src/features/admin/AdminAttendancePage.test.tsx`

1. Assert that both pages render only `Có mặt` and `Vắng` controls.
2. Assert that an unrecorded learner is visually `Vắng` by default.
3. Assert that teacher save persists unrecorded learners as `absent` and a clicked learner as `present`.
4. Assert that admin correction still requires a reason and creates an audited `present/absent` record.
5. Run both focused tests and confirm they fail before implementation.

### Task 2: Add shared projection and rebuild teacher attendance table

**Files:**
- Create: `apps/web/src/features/attendance/twoStateAttendance.ts`
- Modify: `apps/web/src/features/teacher/TeacherAttendancePage.tsx`

1. Add typed projection helpers for two-state display and legacy labels.
2. Initialize every teacher draft to `present` or `absent`; treat unrecorded defaults as unsaved changes.
3. Preserve unchanged legacy records without silently rewriting them.
4. Replace four controls with dedicated `Có mặt` and `Vắng` columns.
5. Add STT, code, avatar/initials, learner name, note, and recorder columns with responsive horizontal scrolling.
6. Reduce filters and summary cards to All, Unrecorded, Present, and Absent.
7. Run the focused teacher test.

### Task 3: Rebuild admin attendance correction table

**Files:**
- Modify: `apps/web/src/features/admin/AdminAttendancePage.tsx`

1. Use the same two-state projection and filters.
2. Render the same explicit table columns as the teacher page.
3. Keep the mandatory correction-reason modal and audit-log behavior.
4. Prevent no-op rewrites of legacy values while allowing an unrecorded default `Vắng` to be explicitly saved.
5. Run the focused admin test.

### Task 4: Document and verify

**Files:**
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`

1. Document the two-state UI, default-absent save policy, and legacy four-state compatibility.
2. Run frontend lint, typecheck, format check, focused/full tests, and build.
3. Run the repository gate applicable to the change and inspect the UI at desktop/mobile widths.
4. Review the final diff for accessibility, encoding, accidental API/schema changes, and unrelated edits.
