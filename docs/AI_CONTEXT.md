# AI Context

## Current Phase
- Phase 1 — Local infrastructure and database
- Status: completed (pending user review)

## Completed
- Phase 0 (committed 28f4d25): repo structure, root configs, README, AI_CONTEXT, PR template, .gitattributes
- Dev environment: Go 1.26.5, GNU Make 4.4.1, Docker Desktop 4.83.0 (Engine 29.6.2, Compose 5.3.1), WSL2 2.7.10, Node v24.18.0, Goose v3.27.3 (go\bin already in user PATH)
- compose.yaml: PostgreSQL 16-alpine (healthcheck, named volume nsa_pgdata, UTC) + swagger-ui v5.17.14 service (port 8081, mounts docs/openapi.yaml)
- database/migrations/00001_baseline_schema.sql: full v1.2 baseline (20 tables, 13 enums, 3 exclusion constraints, 18 triggers, roles seed) with complete down migration
- database/seeds/dev.sql: DEV-ONLY demo accounts admin/teacher/student@nsa.local (password NsaDemo@123, bcrypt cost 10) + demo student/teacher profiles; idempotent via fixed UUIDs + ON CONFLICT
- database/schema.dbml: ERD for dbdiagram.io (all 20 tables + 13 enums)
- docs/openapi.yaml: OpenAPI 3.1 skeleton (health/ready contract, response envelopes, bearerAuth placeholder)
- Makefile: added db-seed, swagger targets; migrate-* targets verified working
- Validated on clean DB: migrate up/down/up reversible; smoke tests PASS (21 tables incl. goose_db_version, 13 enums, 3 roles, 3 exclusion constraints, 18 triggers; duplicate email rejected; total_sessions=0 rejected)
- Swagger UI verified: HTTP 200 at localhost:8081, serves openapi.yaml

## In Progress
- Nothing — waiting for user approval to start Phase 2.

## Next
- Phase 2 — Go API foundation: go module in apps/api (Chi router, config loading from env, pgxpool, slog, middleware: request-id/recovery/timeout/logging, standard response envelopes per docs/openapi.yaml, GET /health + GET /ready, graceful shutdown, unit tests, API Dockerfile). Also serve Swagger UI from the API (user requirement) and embed/mount docs/openapi.yaml.

## Architecture Decisions
- Modular monolith; vertical slices per business module under apps/api/internal/<module>; shared infra only under internal/platform. No root-level controllers/services/repositories/models folders.
- sqlc generated Go code IS committed to database/generated (build does not require codegen).
- Schema source of truth = versioned Goose migrations; database/schema.dbml is generated documentation, updated whenever schema changes.
- Compose file name is compose.yaml (Docker Compose v2); database service name is `postgres`; compose project name nsa-training-platform.
- Demo seed data lives OUTSIDE migrations in database/seeds/dev.sql (migrations stay production-safe); roles seed ships inside baseline migration as reference data.
- All repo documentation written in English; chat communication is bilingual VI/EN.
- UTC timestamps in DB; Asia/Saigon (UTC+7) display handled at presentation layer.
- Swagger/OpenAPI: docs/openapi.yaml is the contract source of truth; swagger-ui container for local browsing (user requirement); API serves its own docs from Phase 2.

## Important Commands
- Local startup: `make setup` (once), `make db-up`, `make migrate-up`, `make db-seed` (optional demo data)
- Docs UI: `make swagger` → http://localhost:8081
- Migration: `make migrate-up` / `make migrate-down` / `make migrate-status` / `make migrate-create name=<snake_case>`
- DB shell: `make db-psql`; reset (destructive): `make db-reset`
- Code generation (sqlc, Phase 2+): `sqlc generate` from repo root
- Tests: `make api-test` (Go, Phase 2+), `make web-test` (Phase 8+), `make check`
- Lint/build: `make api-vet`, `make api-build`, `make web-build`

## Key Files
- compose.yaml — postgres + swagger-ui services
- database/migrations/00001_baseline_schema.sql — baseline v1.2 (goose, with down migration)
- database/seeds/dev.sql — DEV-ONLY demo accounts (never production)
- database/schema.dbml — ERD source for dbdiagram.io
- docs/openapi.yaml — API contract source of truth
- Makefile — canonical commands (Windows cmd.exe shell handled)
- .env (local, untracked) — actual secrets; .env.example is the committed template

## Known Issues / Deferred Work
- Swagger UI reads static docs/openapi.yaml; API-served docs deferred to Phase 2.
- sqlc.yaml not created yet (Phase 2); no application code yet.
- CI workflows, Caddyfile, Playwright: Phase 10.
- swagger-ui image pinned to v5.17.14; bump deliberately when updating.

## Database State
- Latest migration: 00001_baseline_schema.sql (APPLIED + verified reversible on clean DB)
- Seed/demo status: roles seeded via migration; demo users/profiles loaded via `make db-seed` (verified: 3 users, 3 role assignments, 2 profiles)
- Local DB: nsa_training @ localhost:5432 (container nsa-postgres, healthy, volume nsa_pgdata)

## API State
- Implemented endpoint groups: none (Phase 2 starts the API)
- OpenAPI status: docs/openapi.yaml skeleton created (health/ready contract fixed); swagger-ui at :8081

## Git State
- Current branch: main
- Uncommitted changes: Phase 1 files — compose.yaml, database/migrations/00001_baseline_schema.sql, database/schema.dbml, database/seeds/dev.sql, docs/openapi.yaml, Makefile (modified), deleted database/migrations/.gitkeep; README.md + AI_CONTEXT.md updates
- Last commit: 28f4d25 "chore(repo): bootstrap monorepo structure" (local only, NOT pushed; origin/main still at 4eefd77)
- Explicit statement: "Do not commit without user permission"