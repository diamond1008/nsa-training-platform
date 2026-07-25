# AI Context

## Current Phase
- Phase 5 — Scheduling
- Status: completed (pending user review; uncommitted)

## Completed
- Phase 0 (28f4d25): repository bootstrap, configs, and continuity docs.
- Phase 1 (e7f8505): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (bc20225): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (c5b553a): authentication, refresh rotation, RBAC, ownership helpers, sqlc, and tests.
- Phase 4 (d164a05, pushed): academic core administration, capacity-safe enrollment, teacher assignments, audit logs, and OpenAPI 0.2.0.
- Phase 5:
  - ADMIN management for training locations and class sessions.
  - Optional course module, assigned teacher, and active training location per session.
  - Class date validation in Asia/Ho_Chi_Minh; RFC3339 input normalized to UTC.
  - PostgreSQL-enforced non-overlap for class, teacher, and location with distinct API errors.
  - Teacher schedule derived from the authenticated teacher profile; Student schedule derived from active enrollment.
  - Bounded pagination and optional `[from,to)` overlap filters for all schedule lists.
  - Important location/session writes audited transactionally.
  - OpenAPI 0.3.0 documents the Phase 5 contracts.
  - Integration tests cover conflict types, cancellation behavior, role-scoped visibility, UTC conversion, locked sessions, class dates, assignments, and inactive locations.

## In Progress
- Nothing — waiting for user review and approval for Phase 6.

## Next
- Phase 6 — Attendance: authorized batch recording, enrollment validation, correction/audit flow, and Student attendance history/summary.

## Architecture Decisions
- Scheduling is the `internal/schedules` vertical slice; no new migration was required because the reviewed baseline already contains locations, sessions, constraints, and indexes.
- Admin scheduling remains under `/api/v1/admin`; Teacher and Student use separate role-protected `/schedule` routes with identity taken only from JWT claims.
- Teacher schedule contains sessions explicitly assigned to that teacher. Student schedule contains sessions for current `enrolled` relations.
- Exclusion constraints are the concurrency-safe final boundary for class/teacher/location conflicts; Go maps constraint names to stable API error codes.
- Session timestamps are stored and returned in UTC. Class date membership is checked using Asia/Ho_Chi_Minh.
- Cancelled sessions do not reserve class, teacher, or location time. Locked/attendance-locked sessions cannot be edited.
- sqlc generated output remains a committed standalone module under `database/generated`.

## Important Commands
- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Build: `make api-build`; Docker: `docker build -f apps/api/Dockerfile -t nsa-api .`
- Docs: `make swagger`; validate with `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files
- `apps/api/internal/schedules/{service,handler}.go` — Phase 5 scheduling use cases and HTTP transport.
- `database/queries/schedules.sql` — locations, sessions, Admin lists, and role-scoped schedule queries.
- `apps/api/internal/schedules/schedules_integration_test.go` — PostgreSQL scheduling behavior.
- `apps/api/cmd/api/main.go` — Admin, Teacher, and Student scheduling route boundaries.
- `docs/openapi.yaml` — external API contract, version 0.3.0.

## Known Issues / Deferred Work
- Attendance recording and session attendance locking are Phase 6.
- Student schedule currently follows active `enrolled` relations; historical withdrawn/transferred schedule policy is deferred.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- React web app starts in Phase 8; CI/Caddy/Playwright are Phase 10.

## Database State
- Latest migration: `00001_baseline_schema.sql` (unchanged in Phase 5).
- Session exclusion constraints: class, teacher, and location overlap.
- Local demo: admin/teacher/student accounts from `database/seeds/dev.sql`.
- Test DB: `nsa_training_test`; Phase 3–5 integration suites pass.

## API State
- Implemented: system probes/docs, `/api/v1/auth/*`, and Phase 4 Admin academic core.
- Implemented Phase 5: `/api/v1/admin/{locations,sessions}`, `/api/v1/teacher/schedule`, `/api/v1/student/schedule`.
- OpenAPI: version 0.3.0, valid with Redocly (five pre-existing recommended-rule warnings).

## Git State
- Current branch: `main`, synchronized with `origin/main` at Phase 5 start.
- Last commit: d164a05 `feat(api): implement academic core management` (pushed).
- Phase 5 changes are uncommitted.
- Do not commit or push without explicit user permission.
