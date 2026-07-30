# Fixed Training Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hourly schedule with three fixed Vietnam-time slots, add role-specific calendar summaries, and make the paper-test workflow explicit.

**Architecture:** Keep the current `starts_at`/`ends_at` REST shape while deriving timestamps from date + slot in the Admin UI. Enforce slot validity in Go and PostgreSQL, then render the shared week calendar as a compact slot matrix.

**Tech Stack:** Go 1.25, Chi, pgx/sqlc, PostgreSQL/Goose, React 18, TypeScript, Vite, TanStack Query, Tailwind, Vitest/RTL.

## Global Constraints

- Slots are exactly morning 08:00–12:00, afternoon 13:30–17:30, and evening 18:30–21:30 in `Asia/Ho_Chi_Minh`.
- Existing off-slot sessions are deleted; linked assessment history is retained by clearing only its optional session link.
- Preserve the REST timestamps and existing overlap, authorization, attendance-lock, and audit behavior.
- Tests are on paper; no online question, answer, submission, timer, or anti-cheat subsystem is added.
- Do not commit or push without explicit user instruction.

---

### Task 1: Database slot invariant and cleanup

**Files:**
- Create: `database/migrations/00007_fixed_training_slots.sql`
- Modify: `database/schema.dbml`
- Test: `apps/api/internal/schedules/schedules_integration_test.go`

**Interfaces:** PostgreSQL accepts a session only when its local start/end pair matches one fixed slot.

- [ ] Add an integration assertion that an off-slot insert/write is rejected.
- [ ] Run the focused integration test and confirm it fails before migration 00007.
- [ ] Add a Goose migration that detaches `student_assessments.session_id` for off-slot sessions, deletes those sessions, and adds `class_sessions_training_slot_check`.
- [ ] Document the constraint in DBML and apply test migrations.
- [ ] Run the integration test and migration up/down/up checks.

### Task 2: Go boundary validation

**Files:**
- Create: `apps/api/internal/schedules/service_test.go`
- Modify: `apps/api/internal/schedules/service.go`
- Modify: `apps/api/internal/schedules/handler.go`
- Modify: `docs/openapi.yaml`

**Interfaces:** `validTrainingSlot(startsAt, endsAt time.Time) bool`; invalid input maps to `SESSION_TIME_SLOT_INVALID`.

- [ ] Write table-driven failing tests for the three slots, equivalent RFC3339 offsets, wrong minutes, wrong end, and cross-day ranges.
- [ ] Run the focused Go test and confirm the missing validation fails.
- [ ] Implement the Vietnam-time slot validator and call it before database work.
- [ ] Map the new domain error consistently and document it in OpenAPI.
- [ ] Run focused tests, `gofmt`, `go vet ./...`, and `go test ./...`.

### Task 3: Slot calendar and summary component

**Files:**
- Modify: `apps/web/src/components/calendar.tsx`
- Modify: `apps/web/src/components/calendar.test.tsx`

**Interfaces:** Export fixed slot metadata/inference helpers; add optional `stats` items containing `label`, `value`, and `tone` to `WeekCalendar`.

- [ ] Write failing RTL tests proving three slot rows, correct event placement, summary text, and event click behavior.
- [ ] Run the focused Vitest file and confirm the new assertions fail.
- [ ] Replace the desktop hourly grid with the compact three-row matrix while retaining month/mobile views.
- [ ] Add an accessible compact summary strip and slot labels/time ranges.
- [ ] Run focused tests until green and format the changed files.

### Task 4: Admin date/slot form and role statistics

**Files:**
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Modify: `apps/web/src/features/teacher/TeacherPages.tsx`
- Modify: `apps/web/src/features/student/StudentPages.tsx`
- Test: relevant existing page/component tests or a focused new test beside the feature.

**Interfaces:** Admin date + slot selection emits the existing `starts_at`/`ends_at` fields; each role computes summary values only from its loaded schedule/attendance range.

- [ ] Write failing tests for timestamp construction and the three role summary calculations.
- [ ] Confirm the focused tests fail for the missing helpers/UI.
- [ ] Replace free datetime inputs with date and slot controls, including edit-state inference.
- [ ] Pass role-specific summary items to `WeekCalendar` and preserve existing click flows.
- [ ] Add paper-test explanatory copy to Admin, Teacher, and Student result screens.
- [ ] Run focused and full frontend checks.

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`
- Modify: `docs/OPERATIONS.md` when migration cleanup needs an operator warning.

- [ ] Document fixed slot definitions, destructive off-slot cleanup, paper-only tests, role statistics, and AI implementation constraints.
- [ ] Search for contradictory claims about free-form scheduling or online tests and correct them.
- [ ] Run `sqlc generate` and confirm no unexplained generated diff.
- [ ] Run `make check`, DB migration/integration checks, OpenAPI lint, and `make web-e2e` when its services are available.
- [ ] Review the final diff for unintended data, dependency, generated-code, or architecture changes; do not commit or push unless requested.
