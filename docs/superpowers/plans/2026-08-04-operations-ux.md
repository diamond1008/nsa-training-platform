# Operations UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable server-backed filters and a unified four-state attendance workspace across the vocational-training portal.

**Architecture:** Extend existing REST list contracts additively, validate every query parameter at Go handler boundaries, and keep sqlc queries parameterized. React Router stores list state in the URL, TanStack Query fetches remote data, and focused shared primitives provide debounced search, filter chips, sortable headers, and accessible selection.

**Tech Stack:** Go/Chi/pgx/sqlc/PostgreSQL/Goose, React 18/Vite/React Router/TanStack Query/Tailwind, Vitest/RTL/Playwright.

## Global Constraints

- Preserve the modular monolith and current RBAC/ownership boundaries.
- Preserve attendance auto-fill and Vietnam-midnight locking policy.
- Preserve the four attendance values: `present`, `late`, `excused`, `absent`.
- Do not add tuition, payments, departments, semesters, or online testing.
- Do not add an ORM, new state store, data-grid framework, or search service.
- Do not hand-edit `database/generated`; edit SQL and run `sqlc generate`.
- Do not commit or push without explicit user permission.

---

### Task 1: Query-state and filter primitives

**Files:**
- Create: `apps/web/src/lib/listQuery.ts`
- Create: `apps/web/src/lib/listQuery.test.ts`
- Create: `apps/web/src/components/filters.tsx`
- Create: `apps/web/src/components/filters.test.tsx`
- Modify: `apps/web/src/components/data.tsx`
- Modify: `apps/web/src/components/ui.tsx`

**Interfaces:**
- Produces `readListQuery`, `writeListQuery`, `useDebouncedValue`, `FilterBar`, `FilterChip`, and sortable `Column<T>` metadata.
- Empty/default parameters are omitted and any filter change sets `page=1`.

- [ ] Write failing tests for URL decoding/encoding, 300 ms debounce, chip removal, clear-all, and sortable-header callbacks.
- [ ] Run the focused Vitest files and confirm expected failures.
- [ ] Implement the minimal query helpers and components without adding a dependency.
- [ ] Re-run focused tests, then lint/typecheck the touched frontend.

### Task 2: Additive backend list filters and stable sorting

**Files:**
- Modify: `apps/api/internal/students/{handler,service}*.go`
- Modify: `apps/api/internal/teachers/{handler,service}*.go`
- Modify: `apps/api/internal/courses/{handler,service}*.go`
- Modify: `apps/api/internal/classes/{handler,service}*.go`
- Modify: `apps/api/internal/schedules/{handler,service}*.go`
- Modify: `apps/api/internal/completions/{handler,service}*.go`
- Modify: `database/queries/{students,teachers,courses,classes,schedules,completions}.sql`
- Create: `database/migrations/00009_operations_filter_indexes.sql`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Consumes existing pagination and response envelopes.
- Produces validated `sort_by`, `sort_order`, and feature-specific filter parameters while preserving previous defaults.

- [ ] Write failing handler/service tests for allowed/default/rejected sort values and combined filters.
- [ ] Run focused Go tests and confirm failures are due to missing contracts.
- [ ] Add boundary parsers and typed service filter structs.
- [ ] Add parameterized sqlc predicates and stable CASE ordering.
- [ ] Add only the indexes matching the implemented predicates; run `sqlc generate`.
- [ ] Run focused Go tests and DB integration tests.

### Task 3: Upgrade management directories

**Files:**
- Create: `apps/web/src/features/admin/directoryFilters.tsx`
- Create: `apps/web/src/features/admin/directoryFilters.test.tsx`
- Modify: `apps/web/src/features/admin/adminApi.ts`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`

**Interfaces:**
- Consumes Task 1 query/filter primitives and Task 2 API parameters.
- Produces URL-backed Students, Teachers, Courses, Classes, and completion directories with result counts and stable sorting.

- [ ] Write failing tests for search debounce, URL restoration, page reset, course/class filters, result count, and filtered-empty copy.
- [ ] Confirm focused tests fail for missing behavior.
- [ ] Wire URL query state and typed API parameters into each directory.
- [ ] Add high-value visible filters plus advanced filters/chips; add sortable headers.
- [ ] Re-run focused tests and frontend gates.

### Task 4: Searchable schedule filters and bounded selectors

**Files:**
- Create: `apps/web/src/components/SearchCombobox.tsx`
- Create: `apps/web/src/components/SearchCombobox.test.tsx`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Modify: `apps/web/src/features/teacher/TeacherPages.tsx`
- Modify: role API modules as needed.

**Interfaces:**
- Produces an accessible async combobox with bounded results and explicit empty/loading/error states.
- Schedule pages consume class, teacher, location, status, type, lock, and date URL filters.

- [ ] Write failing keyboard/selection/loading tests for the combobox and URL-filter tests for the schedule page.
- [ ] Confirm tests fail for the missing components.
- [ ] Implement the combobox and replace first-100 selector assumptions.
- [ ] Wire supported schedule filters into Admin and Teacher calendar queries.
- [ ] Re-run focused tests and frontend gates.

### Task 5: Unified Admin attendance workspace

**Files:**
- Modify: `apps/web/src/features/admin/AdminAttendancePage.tsx`
- Modify: `apps/web/src/features/admin/adminAttendanceApi.ts`
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Create/modify: focused attendance tests under `apps/web/src/features/admin`.

**Interfaces:**
- Consumes bounded session search and the existing Admin correction endpoints.
- Produces one canonical Admin correction workspace with six roster filters, student search, four statuses, before/after confirmation, and URL session state.

- [ ] Write failing tests for all status filters, four correction states, no-op prevention, required reason, and unrecorded correction.
- [ ] Confirm failures.
- [ ] Implement the workspace and make the calendar link to it instead of owning a second correction form.
- [ ] Re-run focused tests and frontend gates.

### Task 6: Teacher attendance workspace

**Files:**
- Create: `apps/web/src/features/teacher/TeacherAttendancePage.tsx`
- Create: `apps/web/src/features/teacher/TeacherAttendancePage.test.tsx`
- Modify: `apps/web/src/features/teacher/TeacherPages.tsx`
- Modify: `apps/web/src/routes/router.tsx`

**Interfaces:**
- Consumes existing assignment-scoped schedule/roster and batch-save APIs.
- Produces four-state editing, roster filters, dirty count, safe bulk actions, one batch save, and locked read-only display.

- [ ] Write failing tests for four statuses, dirty tracking, bulk Present, confirmed bulk Absent, save payload, and locked behavior.
- [ ] Confirm failures.
- [ ] Extract and implement the focused page.
- [ ] Re-run focused tests and frontend gates.

### Task 7: Accessibility, documentation, and full verification

**Files:**
- Modify: `apps/web/src/components/{ui,data}.tsx`
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`
- Modify: `apps/web/e2e/critical-path.spec.ts`

**Interfaces:**
- Finalizes focus management, live feedback, reduced motion, explicit error associations, and handoff documentation.

- [ ] Write/extend accessibility-focused RTL and critical-path E2E assertions.
- [ ] Confirm new assertions fail before final polish.
- [ ] Implement focus restoration/trapping, semantic async states, filtered empty actions, and explicit transitions.
- [ ] Run `gofmt`, `sqlc generate`, migration checks, API integration, OpenAPI lint, frontend lint/typecheck/format/test/build, `make check`, and `make web-e2e`.
- [ ] Review the complete diff across correctness, readability, architecture, security, and performance; fix all required findings.

