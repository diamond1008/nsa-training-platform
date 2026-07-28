# AI Context

## Current Phase

- Phase 9 — Feature Screens
- Status: completed and validated; awaiting explicit commit permission

## Completed

- Phase 0 (`28f4d25`): repository bootstrap, configs, and continuity docs.
- Phase 1 (`e7f8505`): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (`bc20225`): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (`c5b553a`): authentication, refresh rotation, RBAC, ownership helpers, sqlc, and tests.
- Phase 4 (`d164a05`): academic core administration, safe enrollment, teacher assignments, audits, and OpenAPI.
- Phase 5 (`346ea36`): locations, session scheduling, overlap protection, and role-scoped schedules.
- Phase 6 (`b8a580b`): batch attendance, locking, corrections, Student history/summary, and OpenAPI 0.4.0.
- Phase 7 (`fb4813f`): skill assessment lifecycle, Student history, and deterministic progress.
- Phase 8 (`47d26a5`): React/Vite foundation, authenticated shell, role guards, tests, and web container.
- Phase 9 implementation:
  - Admin directories for students, teachers, courses, and classes with filtering, pagination, create/update forms, status feedback, enrollment, and teacher assignment.
  - Admin schedule management with class, teacher, and location selectors.
  - Teacher dashboard, assigned classes, class roster/detail, weekly teaching calendar with direct attendance navigation, batch attendance, and skill assessment workflows.
  - Student dashboard, enrolled courses, weekly class calendar with personal attendance status/details, attendance history, assessment history, and progress screens.
  - Reusable weekly calendar, tables, pagination, status badges, stat cards, modal, select, textarea, and progress components.
  - Typed role API modules and shared domain models.
  - Assignment-scoped `GET /api/v1/teacher/classes` and `GET /api/v1/teacher/classes/{classID}` support endpoints.
  - OpenAPI 0.6.0 and integration/RBAC/unit coverage for the new endpoints and UI helpers.

## In Progress

- Nothing — Phase 9 implementation and validation are complete.

## Next

- Phase 10 — Quality, CI, deployment readiness: end-to-end browser tests, accessibility/responsive polish, CI, production reverse proxy/environment strategy, and deployment documentation.

## Architecture Decisions

- Backend RBAC and ownership checks remain authoritative; frontend route guards are only a UX boundary.
- Teacher class screens use dedicated assignment-scoped read endpoints instead of composing ADMIN APIs or exposing all classes.
- A Teacher class detail response intentionally combines the class, roster, and course competencies needed by attendance/assessment screens.
- TanStack Query owns server state and invalidation; forms keep only transient local input state.
- Shared API errors retain backend codes/messages and surface predictable loading, error, and empty states.
- Browser access tokens remain memory-only; the secure HttpOnly refresh cookie restores sessions after reload.
- sqlc generated output remains committed under `database/generated`.
- No Phase 9 schema migration is required.

## Important Commands

- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`, `make web-dev`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Web: `make web-test`, `make web-build`
- Containers: `docker build -f apps/api/Dockerfile -t nsa-api .`; `docker build -f apps/web/Dockerfile -t nsa-web .`
- Docs: `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files

- `apps/web/src/features/admin/{adminApi,AdminPages}.tsx` — Admin feature workflows.
- `apps/web/src/features/teacher/{teacherApi,TeacherPages}.tsx` — Teacher workspaces and write workflows.
- `apps/web/src/features/student/{studentApi,StudentPages}.tsx` — Student self-service screens.
- `apps/web/src/components/{ui,data}.tsx` — shared UI and server-state presentation.
- `apps/web/src/lib/{apiClient,domainTypes,format}.ts` — transport, contracts, and display helpers.
- `apps/web/src/routes/router.tsx` — role-protected Phase 9 route tree.
- `apps/api/internal/classes/{service,handler}.go` — Admin class workflows and Teacher assignment-scoped reads.
- `database/queries/classes.sql` — Admin and Teacher class queries.
- `docs/openapi.yaml` — external API contract, version 0.6.0.

## Known Issues / Deferred Work

- Formal ADMIN course-completion approval/rejection is not exposed; progress reports computed Pending/Eligible status.
- Attendance roster/finalization follows the current `enrolled` relationship; historical transfer/withdrawal policy is deferred.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- Playwright end-to-end coverage, CI, and production deployment hardening belong to Phase 10.

## Database and API State

- Latest migration: `00001_baseline_schema.sql` (unchanged in Phase 9).
- Teacher class reads are assignment scoped by authenticated Teacher user ID.
- Teacher assessments remain under `/api/v1/teacher/classes/{classID}/students/{studentID}/assessments`.
- Student self-service APIs remain `/api/v1/student/{schedule,attendance,assessments,progress}`.
- OpenAPI version: 0.6.0.

## Web State

- Routes: `/login`, `/doi-mat-khau`, `/admin/*`, `/teacher/*`, `/student/*`, `/403`, and fallback 404.
- All Phase 9 sidebar routes now render connected feature screens rather than placeholders.
- Validation: `make check`, 14/14 web tests, PostgreSQL integration tests, OpenAPI validation, both Docker builds, SPA deep-route smoke checks, and authenticated Teacher API smoke checks pass.

## Git State

- Current branch: `main`.
- Last commit: `47d26a5 feat(web): add authenticated frontend foundation` (pushed).
- Phase 9 changes are uncommitted. Do not commit or push without explicit permission.
