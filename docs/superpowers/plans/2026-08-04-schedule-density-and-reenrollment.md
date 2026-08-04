# Schedule Density and Re-enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compact the Admin schedule, support multiple sessions per slot without nested scrolling, and safely re-enroll withdrawn students while excluding withdrawal-gap sessions.

**Architecture:** Keep `class_enrollments` as the stable membership and add temporal `class_enrollment_periods`. Extend the existing ADMIN enrollment-status contract with optional `effective_at`; update temporal roster checks. Extract focused React components for the compact filter disclosure and bounded slot event stack.

**Tech Stack:** PostgreSQL 16, Goose, sqlc, Go/Chi/pgx, React/Vite, TanStack Query, Tailwind, Vitest/RTL, Playwright.

## Global Constraints

- Preserve the modular monolith and existing response envelopes/RBAC.
- Never hand-edit `database/generated`; run `sqlc generate`.
- No new frontend or backend dependencies.
- Sessions during a withdrawal gap must not enter the roster or attendance denominator.
- Existing attendance, scores, identifiers, and audit history remain immutable.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Temporal enrollment periods

**Files:**
- Create: `database/migrations/00009_add_enrollment_periods.sql`
- Modify: `database/queries/classes.sql`
- Modify: `database/queries/attendance.sql`
- Modify: `database/queries/schedules.sql`
- Test: `apps/api/internal/classes/phase4_integration_test.go`
- Test: `apps/api/internal/attendance/attendance_integration_test.go`

**Interfaces:**
- Produces sqlc queries `CreateEnrollmentPeriod`, `CloseOpenEnrollmentPeriod`, `GetOpenEnrollmentPeriod`, and temporal roster `EXISTS` predicates.

- [ ] Write integration tests proving a withdrawn interval excludes its sessions and a later open period restores only later sessions.
- [ ] Run the focused tests and confirm they fail because periods do not exist.
- [ ] Add migration 00009 with safe backfill, one-open-period uniqueness, temporal index, and reversible down migration.
- [ ] Add parameterized period queries and replace roster time checks with period containment.
- [ ] Run `sqlc generate`, migrate the test DB, and make the focused tests pass.

### Task 2: Transactional re-enrollment contract

**Files:**
- Modify: `apps/api/internal/classes/handler.go`
- Modify: `apps/api/internal/classes/service.go`
- Modify: `apps/api/internal/classes/phase4_integration_test.go`
- Modify: `apps/api/cmd/api/admin_routes_test.go`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Consumes: enrollment-period queries from Task 1.
- Produces: additive request field `effective_at?: string` on the existing enrollment status endpoint.

- [ ] Write failing tests for `withdrawn -> enrolled`, rejected completed/transferred transitions, out-of-range timestamps, full class, inactive student, and active same-course conflicts.
- [ ] Extend request decoding with bounded RFC3339 validation and keep the route ADMIN-only.
- [ ] Implement the short transaction: lock membership/student, validate rules, create period, update status, and write history/audit.
- [ ] Close the open period transactionally on withdrawal/completion/transfer.
- [ ] Make API integration and route tests pass, then lint the updated OpenAPI contract.

### Task 3: Bounded multi-session week cells

**Files:**
- Modify: `apps/web/src/components/calendar.tsx`
- Modify: `apps/web/src/components/calendar.test.tsx`

**Interfaces:**
- Produces: Week grid behavior that renders two cards plus `+N lớp khác` and opens all items through the existing `onEventClick` callback.

- [ ] Write a failing component test with four sessions in one day/slot and assert two cards plus `+2 lớp khác`.
- [ ] Implement deterministic sorting, bounded rendering, and an accessible overflow modal/list.
- [ ] Verify keyboard activation, long-text truncation, and no nested cell scrollbar.
- [ ] Run focused calendar tests until green.

### Task 4: Compact Admin schedule filters

**Files:**
- Modify: `apps/web/src/components/filters.tsx`
- Modify: `apps/web/src/components/filters.test.tsx`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`

**Interfaces:**
- Produces: `FilterBar` optional `advancedLabel`/advanced content disclosure without changing URL query behavior.

- [ ] Write failing tests for collapsed advanced filters, active-count label, and automatic expansion when an advanced filter is active.
- [ ] Implement a compact primary row and semantic disclosure with visible focus and `aria-expanded`.
- [ ] Move class/teacher/location controls into advanced content while preserving chips, search debounce, and query params.
- [ ] Run focused filter and Admin page tests until green.

### Task 5: Admin re-enrollment UI

**Files:**
- Modify: `apps/web/src/features/admin/adminApi.ts`
- Modify: `apps/web/src/lib/domainTypes.ts`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Test: create or extend the closest Admin class-detail component test.

**Interfaces:**
- Consumes: `effective_at` API contract from Task 2.
- Produces: withdrawn-row `Đưa trở lại lớp` action and confirmation form.

- [ ] Write a failing component/API test asserting the action appears only for withdrawn enrollment and sends status, reason, and RFC3339 effective timestamp.
- [ ] Add the typed API input and build the modal with student summary, datetime-local input, inline errors, and specific submit label.
- [ ] Invalidate class detail, enrollments, class lists, operation history, schedules, and attendance queries after success.
- [ ] Run focused tests until green.

### Task 6: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`
- Modify: `database/schema.dbml`
- Modify: `apps/web/e2e/critical-path.spec.ts` when the seeded workflow can exercise re-enrollment.

- [ ] Document temporal enrollment periods, withdrawal-gap attendance semantics, compact filters, and multi-session overflow.
- [ ] Run `gofmt`, `sqlc generate`, `make db-test-migrate`, and `make api-test-integration`.
- [ ] Run `make check`, OpenAPI lint, `docker compose config`, `git diff --check`, and mojibake/transition scans.
- [ ] Run browser E2E against the local stack and report any environment-only limitation explicitly.

