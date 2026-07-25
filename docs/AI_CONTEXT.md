# AI Context

## Current Phase
- Phase 4 — Academic Core Management
- Status: completed (pending user review; uncommitted)

## Completed
- Phase 0 (28f4d25): repository bootstrap, configs, and continuity docs.
- Phase 1 (e7f8505): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (bc20225): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (c5b553a): JWT/opaque refresh authentication, RBAC, password/session flows, sqlc, and tests.
- Phase 4:
  - ADMIN-only student and teacher management; account, role, and profile writes are transactional.
  - Course, course module, competency criterion, and class management.
  - Capacity-safe enrollments and teacher assignments with status/relationship checks.
  - Search/status filters and bounded pagination on main list endpoints.
  - Audit logs written in the same transaction as important administrative changes.
  - OpenAPI 0.2.0 documents all Phase 4 endpoints and schemas.
  - PostgreSQL integration coverage includes lifecycle, duplicate relations, module/course mismatch, audit writes, capacity reduction, and concurrent enrollment.

## In Progress
- Nothing — waiting for user review and explicit approval for the next phase.

## Next
- Phase 5 — Scheduling: class-session administration, teacher/location conflict handling, and Admin/Teacher/Student schedule queries.

## Architecture Decisions
- Modular monolith with business slices in `internal/students`, `teachers`, `courses`, and `classes`.
- All Phase 4 routes are grouped under `/api/v1/admin` behind `Authenticate` + `RequireRole(ADMIN)`.
- Student/teacher creation atomically creates the user, role, profile, and audit log; temporary passwords are bcrypt-hashed and force password change.
- PUT replaces mutable resource fields; account password changes remain in the authenticated password flow.
- Enrollment capacity remains enforced by the PostgreSQL locking trigger; the use case adds friendly state, duplicate, and active-account checks.
- Schema source of truth remains Goose migrations; Phase 4 changes queries only, so migration and DBML are unchanged.
- sqlc output remains a committed standalone module at `database/generated`, linked from `apps/api`.
- UTC in the database; Asia/Saigon is a presentation concern. Documentation is English; chat may be Vietnamese.

## Important Commands
- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Build: `make api-build`; Docker: `docker build -f apps/api/Dockerfile -t nsa-api .`
- Docs: `make swagger` or API `/docs`; validate with `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files
- `apps/api/internal/{students,teachers,courses,classes}` — Phase 4 handlers and use cases.
- `database/queries/{admin_users,students,teachers,courses,classes}.sql` — Phase 4 sqlc queries.
- `apps/api/cmd/api/main.go` — ADMIN route boundary and service wiring.
- `apps/api/internal/classes/phase4_integration_test.go` — Phase 4 database integration scenarios.
- `docs/openapi.yaml` — external API contract, version 0.2.0.

## Known Issues / Deferred Work
- No scheduling, attendance, assessment, progress, or teacher/student self-service endpoints yet.
- Rate limiting is in-memory and suitable only for the single-instance MVP.
- Testcontainers remains deferred; integration tests use dedicated `nsa_training_test`.
- React web app starts in Phase 8; CI/Caddy/Playwright are Phase 10.

## Database State
- Latest migration: `00001_baseline_schema.sql` (unchanged in Phase 4).
- Local demo: admin/teacher/student accounts from `database/seeds/dev.sql`.
- Test DB: `nsa_training_test`; migrations and Phase 3/4 integration tests pass.
- Audit logging is active for Phase 4 administrative writes.

## API State
- Implemented: `/health`, `/ready`, `/docs`, `/openapi.yaml`, `/api/v1/auth/*`.
- Implemented ADMIN groups: students, teachers, courses/modules/competencies, classes/enrollments/teacher-assignments.
- OpenAPI: version 0.2.0, valid with Redocly (pre-existing recommended-rule warnings only).

## Git State
- Current branch: `main`; synchronized with `origin/main` before Phase 4 work began.
- Phase 4 changes are uncommitted.
- Do not commit or push without explicit user permission.
