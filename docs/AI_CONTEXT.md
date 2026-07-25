# AI Context

## Current Phase
- Phase 3 — Authentication and RBAC
- Status: completed (pending user review)

## Completed
- Phase 0 (28f4d25, pushed): repo structure, configs, docs
- Phase 1 (e7f8505, pushed): PostgreSQL 16 compose, Goose baseline 00001, dev seeds, swagger-ui, schema.dbml
- Phase 2 (bc20225, pushed): Go API foundation (Chi, config, pgxpool, slog, middleware, health/ready, docs, Dockerfile)
- Phase 3 — Authentication & RBAC:
  - sqlc v1.31.1: sqlc.yaml (schema=database/migrations works with goose files), queries in database/queries/{auth,authorization}.sql, output database/generated (own go.mod; apps/api links via `replace`)
  - auth module (apps/api/internal/auth): password.go (bcrypt), tokens.go (JWT HS256 access tokens, secret min 32B), refresh.go (opaque 256-bit tokens, SHA-256 hash storage), service.go (Login/Refresh/Logout/ChangePassword/Me use cases + sentinel domain errors), middleware.go (Authenticate, RequireRole, ClaimsFrom/UserIDFrom), handler.go (thin handlers, 1MB body limit, HttpOnly nsa_refresh cookie path=/api/v1/auth, Secure outside dev, SameSite=Lax), authorize.go (RoleAdmin/Teacher/Student, IsSelf, OwnsStudentProfile, IsAssignedTeacher)
  - Refresh token ROTATION on every use; reuse of a revoked token revokes the whole family (theft detection)
  - Rate limiting: httprate in-memory per-IP — 10/min login, 20/min refresh
  - Config: JWT_ACCESS_SECRET (required, ≥32 chars), ACCESS_TOKEN_TTL_MINUTES (15), REFRESH_TOKEN_TTL_DAYS (30), BCRYPT_COST (10)
  - Routes: POST /api/v1/auth/{login,refresh,logout} public; POST change-password + GET me behind Authenticate
  - Tests: unit (password/tokens/refresh/middleware — 15 tests) + integration (6 tests vs real nsa_training_test DB: login, generic 401 no-enumeration, rotation+reuse family revoke, logout revoke, change-password flow, me); ALL PASS
  - Makefile: db-test-create/db-test-migrate (idempotent via psql \gexec stdin), api-test-integration (target-specific env export)
  - Dockerfile updated for the replace layout (copies database/generated); docker build verified
  - Manual verification with demo accounts: login admin@nsa.local OK (roles=ADMIN), /me OK, wrong password → 401 INVALID_CREDENTIALS, cookie flags HttpOnly+SameSite=Lax OK
- Dependencies added: golang-jwt/jwt/v5 v5.3.1, go-chi/httprate v0.16.0, golang.org/x/crypto v0.54.0, sqlc-dev/sqlc v1.31.1 (CLI tool)

## In Progress
- Nothing — waiting for user approval to start Phase 4.

## Next
- Phase 4 — Academic core management (Admin): students, teachers, courses, course modules, competency criteria, classes, student enrollment (capacity-safe), teacher assignment; command/query use cases with pagination; audit logs; integration tests; OpenAPI update.

## Architecture Decisions
- Modular monolith; vertical slices under apps/api/internal/<module>; shared infra in internal/platform.
- Operational endpoints UNVERSIONED (/health,/ready,/docs,/openapi.yaml); business API under /api/v1.
- sqlc generated code committed in database/generated as its OWN Go module; apps/api uses `replace ../../database/generated` (Dockerfile copies both paths).
- Refresh tokens are OPAQUE (not JWT): only SHA-256 hash stored; rotation per use; reuse revokes family. Access tokens are JWT HS256 with roles claim.
- Generic 401 INVALID_CREDENTIALS for all login failures (no user enumeration).
- Integration tests use a dedicated DB (nsa_training_test) in the same postgres container, gated by NSA_TEST_DATABASE_URL (skipped when unset). Testcontainers deferred to Phase 10 (documented decision: current approach is sufficient and simpler).
- Rate limiting in-memory per instance (no Redis, per MVP scope).
- Schema source of truth = Goose migrations; DBML updated on schema change. No schema change in Phase 3.
- UTC in DB; Asia/Saigon at presentation layer. Repo docs in English; chat bilingual VI/EN.

## Important Commands
- Local startup: `make setup` (once), `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Code generation: `sqlc generate` (repo root) after editing database/queries/*.sql
- Tests: `make api-test` (unit), `make db-test-migrate` then `make api-test-integration` (all incl. DB)
- Docs: API Swagger UI http://localhost:8080/docs (or `make swagger` → :8081)
- Migration: `make migrate-up|down|status|create name=<snake_case>`; `make db-psql`; `make db-reset`
- Build: `make api-build`; image: `docker build -f apps/api/Dockerfile -t nsa-api .`

## Key Files
- apps/api/internal/auth/{password,tokens,refresh,service,middleware,handler,authorize}.go — auth module
- apps/api/internal/auth/*_test.go — unit + integration tests
- database/queries/{auth,authorization}.sql — sqlc queries; database/generated/ — committed generated code (+go.mod)
- sqlc.yaml — sqlc config; apps/api/cmd/api/main.go — wiring (auth routes, rate limits)
- apps/api/internal/platform/config/config.go — JWT/bcrypt config; Makefile — db-test-* + api-test-integration
- docs/openapi.yaml — contract (auth group documented)

## Known Issues / Deferred Work
- Rate limiting in-memory (single-instance only; distributed limiter would need Redis — out of MVP scope).
- Testcontainers deferred to Phase 10 (dedicated test DB approach used instead).
- Web app Phase 8; CI/Caddy/Playwright Phase 10. Audit log table exists but no audit writes yet (Phase 4).

## Database State
- Latest migration: 00001_baseline_schema.sql (unchanged this phase)
- Seed/demo: roles via migration; demo admin/teacher/student@nsa.local (pw NsaDemo@123) via `make db-seed` (loaded locally)
- Test DB: nsa_training_test (migrated, used by api-test-integration)
- Local DB: nsa_training @ localhost:5432 (container nsa-postgres, healthy)

## API State
- Implemented: /health, /ready, /docs, /openapi.yaml; POST /api/v1/auth/{login,refresh,logout}, POST /api/v1/auth/change-password, GET /api/v1/auth/me
- OpenAPI status: current for Phase 3 (auth group + schemas documented)

## Git State
- Current branch: main (origin/main at bc20225)
- Uncommitted changes: Phase 3 files — apps/api/internal/auth/**, database/queries/**, database/generated/** (+go.mod), sqlc.yaml, Makefile, .env.example, apps/api/Dockerfile, apps/api/cmd/api/main.go, config (+test), docs/openapi.yaml, README.md, docs/AI_CONTEXT.md
- Last commit: bc20225 "feat(api): add production-oriented service foundation" (PUSHED)
- Explicit statement: "Do not commit without user permission"