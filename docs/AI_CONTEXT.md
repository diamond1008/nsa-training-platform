# AI Context

## Current Phase
- Phase 6 — Attendance
- Status: completed (pending user review; uncommitted)

## Completed
- Phase 0 (28f4d25): repository bootstrap, configs, and continuity docs.
- Phase 1 (e7f8505): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (bc20225): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (c5b553a): authentication, refresh rotation, RBAC, ownership helpers, sqlc, and tests.
- Phase 4 (d164a05): academic core administration, capacity-safe enrollment, teacher assignments, audit logs, and OpenAPI 0.2.0.
- Phase 5 (346ea36, pushed): training locations, class-session scheduling, PostgreSQL overlap protection, and role-scoped schedules.
- Phase 6:
  - Teacher/Admin session attendance roster views with recorded/unrecorded and per-status counts.
  - Transactional Teacher batch recording for Present, Absent, Late, and Excused.
  - JWT-derived teacher identity plus class-assignment authorization.
  - Active-enrollment validation, duplicate request detection, and PostgreSQL FK/unique enforcement.
  - Session-row locking serializes attendance writes with finalization.
  - Teachers may lock attendance only after the session starts and every active student has one record.
  - ADMIN correction after locking with required reason and transactional old/new audit log.
  - Student self-only paginated attendance history and per-class summary.
  - OpenAPI 0.4.0 documents the Phase 6 contracts.
  - Integration tests cover authorization, transactional rollback, duplicate prevention, completeness, locking, correction audit, ownership, and summary calculation.

## In Progress
- Nothing — waiting for user review and approval for Phase 7.

## Next
- Phase 7 — Skill Assessment and Progress: competency ratings, assessment lifecycle, comments, completion rules, and Student progress endpoints.

## Architecture Decisions
- Attendance is the `internal/attendance` vertical slice; no migration was required because the baseline already contains `attendance_records`, the status enum, session locking column, FK constraints, uniqueness, indexes, and triggers.
- Teacher attendance routes are role-protected and derive the user ID only from JWT claims. Service authorization verifies that user's teacher profile is assigned to the session class.
- Initial attendance is append-only per session/student. A duplicate is a `409`; corrections use the separate ADMIN-only endpoint and require an audit reason.
- Batch recording and finalization lock the class-session row in one database transaction. This prevents a batch from racing with attendance locking.
- A Teacher cannot finalize before the session starts or until every currently `enrolled` student has exactly one attendance record.
- Finalization sets both session status `locked` and `attendance_locked_at`; later Teacher writes fail while ADMIN correction remains available.
- Student endpoints contain no student path parameter. History and summaries are selected from the authenticated user's profile.
- Informational attendance percentage counts Present and Late as attended and excludes Excused from the denominator. Phase 7 owns completion eligibility.
- sqlc generated output remains a committed standalone module under `database/generated`.

## Important Commands
- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Build: `make api-build`; Docker: `docker build -f apps/api/Dockerfile -t nsa-api .`
- Docs: `make swagger`; validate with `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files
- `apps/api/internal/attendance/{service,handler}.go` — Phase 6 use cases and HTTP transport.
- `database/queries/attendance.sql` — roster, recording, locking, correction, history, and summary queries.
- `apps/api/internal/attendance/attendance_integration_test.go` — PostgreSQL-backed Phase 6 behavior.
- `apps/api/cmd/api/main.go` — ADMIN, TEACHER, and STUDENT attendance route boundaries.
- `docs/openapi.yaml` — external API contract, version 0.4.0.

## Known Issues / Deferred Work
- Attendance roster/finalization follows the current `enrolled` relationship; a historical transfer/withdrawal policy is deferred.
- Phase 6 percentages are informational only. Phase 7 defines configurable completion/progress rules.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- React web app starts in Phase 8; CI/Caddy/Playwright are Phase 10.

## Database State
- Latest migration: `00001_baseline_schema.sql` (unchanged in Phase 6).
- Attendance integrity: `(class_session_id, class_id)` and `(class_id, student_id)` FKs plus unique `(class_session_id, student_id)`.
- Local demo: admin/teacher/student accounts from `database/seeds/dev.sql`.
- Test DB: `nsa_training_test`; Phase 3–6 integration suites pass.

## API State
- Implemented: system probes/docs, `/api/v1/auth/*`, Admin academic core, locations, sessions, and role schedules.
- Teacher attendance: `GET|POST /api/v1/teacher/sessions/{sessionID}/attendance` and `POST .../attendance/lock`.
- Admin attendance: `GET /api/v1/admin/sessions/{sessionID}/attendance` and `PUT /api/v1/admin/attendance/{attendanceID}`.
- Student attendance: `GET /api/v1/student/attendance` and `/attendance/summary`.
- OpenAPI: version 0.4.0.

## Git State
- Current branch: `main`, synchronized with `origin/main` at Phase 6 start.
- Last commit: 346ea36 `feat(api): implement scheduling management` (pushed).
- Phase 6 changes are uncommitted.
- Do not commit or push without explicit user permission.
