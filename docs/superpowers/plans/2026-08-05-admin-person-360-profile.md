# Admin Person 360 Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add professional ADMIN Student/Teacher 360° profile pages with current and historical classes, person-scoped fixed-slot schedules, summary metrics, and controlled profile editing.

**Architecture:** Extend the existing modular monolith with bounded read models in `students` and `teachers`, temporal Teacher assignment periods owned by `classes`, and one Student-scoped ADMIN schedule query owned by `schedules`. React composes these additive contracts with TanStack Query and reuses the existing calendar, status, modal, avatar, and profile form patterns.

**Tech Stack:** PostgreSQL 16, Goose, sqlc, Go/Chi/pgx, React/Vite/TypeScript, TanStack Query, React Router, Tailwind, Vitest/RTL.

## Global Constraints

- Preserve existing attendance, score, assessment, completion, and certificate workspaces; profile pages link to them instead of duplicating editors.
- All Student/Teacher history is retained; removing a Teacher assignment closes a period instead of deleting its stable relation.
- Current Teacher authorization requires an open assignment period.
- No new runtime dependency.
- Do not hand-edit `database/generated`; edit SQL and run `sqlc generate`.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Temporal Teacher Assignment History

**Files:**
- Create: `database/migrations/00011_add_teacher_assignment_periods.sql`
- Modify: `database/queries/classes.sql`
- Modify: every query returned by `rg -l "teacher_assignments" database/queries`
- Modify: `apps/api/internal/classes/service.go`
- Modify: `apps/api/internal/classes/phase4_integration_test.go`
- Modify: `database/schema.dbml`

**Interfaces:**
- Produces `TeacherAssignmentPeriodView` and stable assignment remove/reopen behavior.
- Current assignment means an `EXISTS` open `teacher_assignment_periods` row.

- [ ] Write an integration test that assigns, removes, reassigns, and verifies two non-overlapping periods while the stable assignment ID is retained.
- [ ] Run the focused class integration test and confirm the old delete behavior fails the new expectations.
- [ ] Add migration 00011 with exclusion constraint, one-open-period partial index, backfill, and insert trigger.
- [ ] Add sqlc queries `GetTeacherAssignmentByPair`, `CreateTeacherAssignmentPeriod`, `EndTeacherAssignmentPeriod`, and `ListTeacherAssignmentPeriods`.
- [ ] Change `AssignTeacherWithReason` to reopen an inactive stable assignment and `DeleteAssignmentWithReason` to end its open period transactionally.
- [ ] Add open-period predicates to authorization, schedule, assessment, notification, and management filter queries that mean “currently assigned”.
- [ ] Run `sqlc generate`, focused tests, and migration up/down/up.

### Task 2: Student and Teacher Profile Read Models

**Files:**
- Modify: `database/queries/students.sql`
- Modify: `database/queries/teachers.sql`
- Modify: `apps/api/internal/students/service.go`
- Modify: `apps/api/internal/students/handler.go`
- Create: `apps/api/internal/students/profile_integration_test.go`
- Modify: `apps/api/internal/teachers/service.go`
- Modify: `apps/api/internal/teachers/handler.go`
- Create: `apps/api/internal/teachers/profile_integration_test.go`
- Modify: `apps/api/cmd/api/main.go`
- Modify: `apps/api/cmd/api/admin_routes_test.go`

**Interfaces:**
- Produces `GET /admin/students/{studentID}/profile-summary` and paginated `/class-history`.
- Produces `GET /admin/teachers/{teacherID}/profile-summary` and paginated `/class-history`.
- Summary responses contain `profile` plus integer metrics; history responses use the repository pagination envelope.

- [ ] Write failing service/integration tests for current/total class counts, Student attendance-risk class count, Teacher completed/upcoming session counts, and newest-first period history.
- [ ] Add bounded SQL read models and supporting indexes only if query predicates are not covered by existing indexes.
- [ ] Add typed Go views/services and handlers with UUID/page validation and existing not-found envelopes.
- [ ] Register ADMIN-only routes and extend route coverage tests.
- [ ] Run focused packages, `go vet`, and the full integration suite.

### Task 3: ADMIN Student-Specific Schedule

**Files:**
- Modify: `database/queries/schedules.sql`
- Modify: `apps/api/internal/schedules/service.go`
- Modify: `apps/api/internal/schedules/handler.go`
- Modify: `apps/api/internal/schedules/schedules_integration_test.go`
- Modify: `apps/api/cmd/api/main.go`

**Interfaces:**
- Produces `GET /admin/students/{studentID}/schedule?from=&to=&page=&per_page=` returning `pagination.Result[SessionView]`.
- Reuses temporal membership rule `started_at <= session.starts_at AND (ended_at IS NULL OR session.starts_at < ended_at)`.

- [ ] Write a failing integration test proving the ADMIN-selected Student sees sessions inside enrollment periods and not sessions in withdrawal gaps.
- [ ] Add list/count sqlc queries ordered by `starts_at, id` with bounded pagination/date filters.
- [ ] Add `ListAdminStudent(ctx, studentID, filter)` and handler validation using existing schedule filter parsing.
- [ ] Register the nested ADMIN route and run focused/integration tests.

### Task 4: React 360° Profile Pages

**Files:**
- Create: `apps/web/src/features/admin/personProfileTypes.ts`
- Create: `apps/web/src/features/admin/PersonProfilePage.tsx`
- Create: `apps/web/src/features/admin/PersonProfilePage.test.tsx`
- Create: `apps/web/src/features/admin/PersonForm.tsx`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Modify: `apps/web/src/features/admin/adminApi.ts`
- Modify: `apps/web/src/lib/domainTypes.ts`
- Modify: `apps/web/src/routes/router.tsx`

**Interfaces:**
- Produces `StudentProfilePage` and `TeacherProfilePage` route components.
- `PersonProfilePage` consumes `{ kind: "student" | "teacher" }` and route `studentId`/`teacherId`.
- `PersonForm` is shared by directory and profile edit modals and preserves current Student/Teacher payloads including avatar.

- [ ] Write failing RTL tests for route loading, header identity, three tabs, current/history periods, directory links, week navigation, and controlled edit mutation.
- [ ] Extract the existing form without changing its visual behavior or request payloads.
- [ ] Add typed API calls and domain types for summaries/history.
- [ ] Build the profile header, four metric cards, current class cards, paginated history timeline/table, and existing fixed-slot `WeekCalendar` tab.
- [ ] Link directory code/name cells and register both protected routes.
- [ ] Run focused tests, lint, formatting, typecheck, and production build.

### Task 5: Contract, Documentation, and End-to-End Verification

**Files:**
- Modify: `docs/openapi.yaml`
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`
- Modify: `apps/web/e2e/critical-path.spec.ts`

**Interfaces:**
- Documents every additive profile/history/schedule response and migration 00011.

- [ ] Add OpenAPI paths/schemas and lint the contract.
- [ ] Update README/AI_CONTEXT with feature, temporal Teacher assignment policy, routes, and verification evidence.
- [ ] Extend ADMIN E2E to open a Student and Teacher profile and verify identity/class/schedule tabs.
- [ ] Run `sqlc generate`, Goose up/down/up, `make api-test-integration`, `make check`, and `make web-e2e`.
- [ ] Review the final diff across correctness, architecture, security, accessibility, and performance; resolve every required finding.
