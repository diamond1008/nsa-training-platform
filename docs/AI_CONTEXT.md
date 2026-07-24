# AI Context

## Current Phase
- Phase 2 — Go API foundation
- Status: completed (pending user review)

## Completed
- Phase 0 (28f4d25, pushed): repo structure, root configs, docs
- Phase 1 (e7f8505, pushed): PostgreSQL 16 compose, Goose baseline migration 00001 (v1.2, reversible), dev seeds, swagger-ui container, schema.dbml, openapi.yaml skeleton
- Phase 2: Go module `github.com/diamond1008/nsa-training-platform/apps/api`
  - platform/config (env + godotenv; DATABASE_URL required; APP_ENV validated)
  - platform/logging (slog: text dev / JSON prod)
  - platform/response (success/error envelopes; InternalError never leaks internals)
  - platform/database (pgxpool: MaxConns 10, lifetimes, health checks, bounded ping)
  - platform/middleware (slog RequestLog; chi RequestID/RealIP/Recoverer/Timeout; go-chi/cors)
  - platform/health (GET /health liveness; GET /ready readiness with Pinger interface for stub tests)
  - platform/docs (GET /docs Swagger UI via CDN; GET /openapi.yaml serves docs/openapi.yaml from OPENAPI_PATH)
  - cmd/api/main.go (wiring, timeouts, graceful shutdown on SIGINT/SIGTERM)
  - Unit tests: config (4), response (3), health (3) — all pass; go vet clean; go build OK
  - apps/api/Dockerfile (multi-stage golang:1.26-alpine → alpine:3.21, non-root user, HEALTHCHECK) + root .dockerignore
  - Validated in container: /health 200, /ready 200 (DB via docker network), /docs 200, /openapi.yaml 200, graceful shutdown logged ("server stopped gracefully")
- Dependencies added: go-chi/chi/v5 v5.3.1, go-chi/cors v1.2.2, jackc/pgx/v5 v5.10.0, joho/godotenv v1.5.1

## In Progress
- Nothing — waiting for user approval to start Phase 3.

## Next
- Phase 3 — Authentication and RBAC: user repository + sqlc (create sqlc.yaml + first queries in database/queries), bcrypt password hashing, login/refresh/logout/change-password/me endpoints under /api/v1/auth, access+refresh tokens (refresh in HttpOnly cookie, hashed in DB, rotated), RBAC middleware, ownership/assignment helpers, tests, OpenAPI update.

## Architecture Decisions
- Modular monolith; vertical slices per business module under apps/api/internal/<module>; shared infra only under internal/platform. No root-level controllers/services/repositories/models folders.
- Operational endpoints are UNVERSIONED (/health, /ready, /docs, /openapi.yaml); business API mounts under /api/v1 (Phase 3+).
- sqlc generated Go code IS committed to database/generated; sqlc.yaml arrives with first real queries (Phase 3).
- Schema source of truth = versioned Goose migrations; database/schema.dbml updated on schema change.
- docs/openapi.yaml is the API contract source of truth; API serves it at /openapi.yaml (OPENAPI_PATH env; container copies to /app/docs/openapi.yaml). Swagger UI page uses CDN assets; containerized swagger-ui (port 8081) is the offline alternative.
- godotenv added for DX (plain `go run` reads .env); make api-run also exports .env. Real env vars always win.
- Demo seed data lives OUTSIDE migrations (database/seeds/dev.sql); roles seed ships inside baseline migration.
- All repo docs in English; chat bilingual VI/EN. UTC in DB; Asia/Saigon at presentation layer.

## Important Commands
- Local startup: `make setup` (once), `make db-up`, `make migrate-up`, `make db-seed` (optional), `make api-run`
- Docs: API Swagger UI http://localhost:8080/docs (or `make swagger` → :8081)
- Migration: `make migrate-up|down|status|create name=<snake_case>`; DB shell: `make db-psql`; reset: `make db-reset`
- Tests/checks: `make api-test`, `make api-vet`, `make check`
- Build: `make api-build`; image: `docker build -f apps/api/Dockerfile -t nsa-api .` (from repo root)

## Key Files
- apps/api/cmd/api/main.go — entrypoint, middleware chain, graceful shutdown
- apps/api/internal/platform/{config,logging,response,database,middleware,health,docs}/ — foundation packages
- apps/api/Dockerfile — multi-stage API image (build context = repo root)
- compose.yaml — postgres + swagger-ui; database/migrations/00001_baseline_schema.sql — baseline v1.2
- database/seeds/dev.sql — DEV-ONLY demo accounts; database/schema.dbml — ERD; docs/openapi.yaml — API contract
- Makefile — canonical commands; .env (untracked) holds real local secrets

## Known Issues / Deferred Work
- Swagger UI page needs internet (CDN assets); offline → `make swagger` container instead.
- sqlc.yaml not created (Phase 3); no auth/business endpoints yet; web app Phase 8; CI/Caddy/Playwright Phase 10.
- api-run via make requires .env present (documented in README).

## Database State
- Latest migration: 00001_baseline_schema.sql (applied, reversible)
- Seed/demo: roles via migration; demo admin/teacher/student@nsa.local (pw NsaDemo@123) via `make db-seed` (loaded locally)
- Local DB: nsa_training @ localhost:5432 (container nsa-postgres, healthy, volume nsa_pgdata)

## API State
- Implemented: GET /health (200), GET /ready (200/503), GET /docs (Swagger UI), GET /openapi.yaml
- Business endpoint groups: none (Phase 3: /api/v1/auth)
- OpenAPI status: skeleton current for Phase 2 contract; update required per phase

## Git State
- Current branch: main (origin/main up to date at e7f8505)
- Uncommitted changes: Phase 2 files — apps/api/** (go.mod, go.sum, cmd, internal, Dockerfile), .dockerignore, docs/openapi.yaml (edited), README.md, docs/AI_CONTEXT.md; deleted several .gitkeep under apps/api
- Last commit: e7f8505 "chore(infra): configure local PostgreSQL environment" (PUSHED)
- Explicit statement: "Do not commit without user permission"