# NSA Training Platform

Training management platform for an automotive vocational training center. It manages the post-admission lifecycle: student accounts, class assignment, schedules, attendance, practical skill assessment, progress tracking, and course completion.

**Repository model:** monorepo — Go API (`apps/api`) + React SPA (`apps/web`) + one PostgreSQL database.

## Project Status

**Current phase: Phase 4 — Academic Core Management (completed, pending review)**

| Phase | Name | Status |
| ----- | ---- | ------ |
| 0 | Repository audit and bootstrap | ✅ Completed (commit 28f4d25) |
| 1 | Local infrastructure and database | ✅ Completed (commit e7f8505) |
| 2 | Go API foundation | ✅ Completed (commit bc20225) |
| 3 | Authentication and RBAC | ✅ Completed (commit c5b553a) |
| 4 | Academic core management | ✅ Completed (pending review) |
| 5 | Scheduling | ⬜ Not started |
| 6 | Attendance | ⬜ Not started |
| 7 | Skill assessment and progress | ⬜ Not started |
| 8 | Frontend foundation and auth shell | ⬜ Not started |
| 9 | Feature screens | ⬜ Not started |
| 10 | Quality, CI, deployment readiness | ⬜ Not started |

See `docs/AI_CONTEXT.md` for the detailed, always-current implementation state.

## Quick Start (Run Locally)

**Every time you start working** (in the repo root):

```powershell
make db-up        # 1. Start PostgreSQL 16 (Docker container)
make migrate-up   # 2. Apply the schema (needed on first run / after new migrations)
make db-seed      # 3. Load demo accounts (dev only, safe to re-run)
make api-run      # 4. Start the API at http://localhost:8080
```

Stop: `Ctrl+C` in the API terminal, then `make db-down` to stop the database.

**First-time on a new machine:** `make setup` (creates `.env` from `.env.example`).

## Open Swagger UI (API Documentation)

- **Option A — built into the API:** run `make api-run`, then open **http://localhost:8080/docs**
- **Option B — standalone container:** run `make swagger`, then open **http://localhost:8081**

## Demo Accounts (DEV ONLY)

| Email | Password | Role |
| ----- | -------- | ---- |
| `admin@nsa.local` | `NsaDemo@123` | ADMIN |
| `teacher@nsa.local` | `NsaDemo@123` | TEACHER |
| `student@nsa.local` | `NsaDemo@123` | STUDENT |

**Log in via Swagger UI:**

1. Open http://localhost:8080/docs
2. Expand `POST /api/v1/auth/login` → click **Try it out**
3. Body: `{"email": "admin@nsa.local", "password": "NsaDemo@123"}` → **Execute**
4. Copy the `access_token` value from the response body
5. Click **Authorize** (top of page) → paste the token → **Authorize** → Close
6. Call `GET /api/v1/auth/me` → it returns your profile and roles

**Log in via curl (PowerShell):**

```powershell
curl.exe -s -X POST http://localhost:8080/api/v1/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@nsa.local\",\"password\":\"NsaDemo@123\"}'
```

The response contains `data.access_token` — send it as `Authorization: Bearer <token>` on protected endpoints. The refresh token arrives automatically as an HttpOnly cookie (`nsa_refresh`).

## View the Database with pgAdmin 4

pgAdmin 4 is installed on this machine (via winget). Connect it to the local Docker database:

1. Start the database first: `make db-up`
2. Open **pgAdmin 4** (Start Menu). On first launch it asks for a **master password** — this protects pgAdmin itself; pick anything memorable (it is NOT the database password).
3. Right-click **Servers** → **Create** → **Server…**
4. **General** tab: Name = `NSA Local`
5. **Connection** tab:
   - Host name/address: `localhost`
   - Port: `5432`
   - Maintenance database: `nsa_training`
   - Username: `nsa`
   - Password: `change-me-local-only` (value of `POSTGRES_PASSWORD` in `.env`)
   - Enable **Save password** (dev convenience)
6. **Save**, then browse: `Servers → NSA Local → Databases → nsa_training → Schemas → public → Tables`
7. To see rows: right-click a table (e.g. `users`, `roles`, `student_profiles`) → **View/Edit Data → All Rows**

## Implemented Features

- **Local infrastructure:** PostgreSQL 16 via Docker Compose with health check and persistent named volume (`make db-up`)
- **Migrations:** Goose v3 with baseline schema v1.2 as `00001_baseline_schema.sql` — 20 tables, 13 enum types, exclusion constraints (no overlapping sessions per class/teacher/location), concurrency-safe capacity triggers; up/down verified on a clean database
- **Seeds:** roles (ADMIN/TEACHER/STUDENT) ship in the baseline; DEV-ONLY demo accounts via `make db-seed`
- **API docs:** OpenAPI 3.1 at `docs/openapi.yaml` — served by the API at `/docs` + `/openapi.yaml`, or via container (`make swagger` → http://localhost:8081)
- **ERD:** `database/schema.dbml` for dbdiagram.io
- **Go API foundation (`apps/api`):** Chi router, env config (godotenv), pgxpool (pool tuning + ping), slog structured logging, middleware (RequestID, RealIP, request logging, recovery, timeout, CORS), standard success/error envelopes
- **Operational endpoints:** `GET /health` (liveness), `GET /ready` (readiness incl. DB), graceful shutdown on SIGINT/SIGTERM (verified in container)
- **API Docker image:** multi-stage `apps/api/Dockerfile` → `nsa-api` (build from repo root)
- **Authentication (`POST /api/v1/auth/*`):** login, refresh (rotation + reuse detection), logout, change-password (revokes all sessions), me — JWT access tokens (HS256) + opaque refresh tokens (SHA-256 hashed in DB, HttpOnly cookie)
- **Security:** bcrypt passwords, generic 401 on bad credentials (no user enumeration), per-IP rate limiting on login/refresh, request body limits, RBAC middleware (`Authenticate`, `RequireRole`), ownership/assignment helpers
- **Academic core administration (`/api/v1/admin/*`):** create/list/detail/update students and teachers (account + role + profile transaction), courses, ordered modules, competency criteria, and classes
- **Class relationships:** capacity-safe student enrollment with lifecycle status, active-account checks and duplicate prevention; teacher assignment with role update/removal and relationship validation
- **Administration safeguards:** every Phase 4 route requires `ADMIN`; list endpoints use search/status filters and bounded pagination; important writes create audit logs in the same transaction
- **sqlc:** type-safe queries generated from `database/queries/*.sql` into `database/generated` (committed; own Go module linked via `replace`)
- Teacher and student self-service business endpoints: not started (Phase 5+)

## Technology Stack

- **Backend:** Go, net/http, Chi router, slog, pgx/pgxpool, sqlc, Goose migrations, REST/JSON
- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, shadcn/ui, Vitest
- **Database:** PostgreSQL 15+ (schema baseline: `NSA_Training_Portal_PostgreSQL_v1.2.sql`, applied via Goose migrations in Phase 1)
- **Infrastructure:** Docker, Docker Compose, Caddy (deployment, later), GitHub Actions (Phase 10)
- **Architecture:** modular monolith, vertical slices by business module, CQRS-lite

## Repository Structure

```
nsa-training-platform/
├── apps/
│   ├── api/                  # Go backend (Phase 2+)
│   │   ├── cmd/api/          # entrypoint
│   │   └── internal/         # business modules (auth, users, students, ...)
│   │       └── platform/     # shared infra (database, middleware, security, ...)
│   └── web/                  # React frontend (Phase 8+)
│       └── src/
│           ├── app/          # app-level setup
│           ├── components/   # shared UI components
│           ├── features/     # feature modules (auth, students, ...)
│           ├── lib/          # utilities, typed API client
│           └── routes/       # route definitions
├── database/
│   ├── migrations/           # Goose SQL migrations (Phase 1+)
│   ├── queries/              # sqlc query files
│   └── generated/            # sqlc generated Go code (committed)
├── docs/
│   ├── AI_CONTEXT.md         # current state for AI agents — READ FIRST
│   ├── adr/                  # architecture decision records
│   └── diagrams/             # architecture/ER diagrams
├── infra/
│   └── caddy/                # reverse proxy config (Phase 10)
├── .github/
│   ├── workflows/            # CI (Phase 10)
│   └── pull_request_template.md
├── .env.example              # environment variable template
├── compose.yaml              # local infrastructure (Phase 1)
├── Makefile                  # canonical command set
└── README.md
```

## Local Development Setup

**Prerequisites** (already verified on the lead dev machine):

- Go 1.22+ (`go version`)
- Node.js 20+ and npm (`node --version`)
- Docker Desktop with Compose (`docker version`, `docker compose version`)
- GNU Make 4.4+ (`make --version`) — optional but recommended; all commands below have plain-CLI equivalents
- Goose v3 (Phase 1): `go install github.com/pressly/goose/v3/cmd/goose@latest`

**First-time setup:**

```sh
make setup        # copies .env.example to .env — then edit secrets in .env
```

Without make (PowerShell): `Copy-Item .env.example .env`

## Required Environment Variables

See `.env.example` for the full annotated list. Key groups:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` — local database container
- `DATABASE_URL` — full connection string used by the API and Goose
- `API_PORT`, `APP_ENV`, `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS` — API runtime
- `JWT_ACCESS_SECRET`, token TTLs, `BCRYPT_COST` — authentication (refresh tokens are opaque; no refresh secret needed)
- `VITE_API_BASE_URL` — web app → API base URL (Phase 8)

**Never commit `.env` or any real secrets.**

## Database Commands

PostgreSQL 16 runs via Docker Compose; migrations run via Goose v3.

| Task | Make | Plain CLI equivalent |
| ---- | ---- | -------------------- |
| Start PostgreSQL | `make db-up` | `docker compose up -d postgres` |
| Stop containers | `make db-down` | `docker compose down` |
| DB logs | `make db-logs` | `docker compose logs -f postgres` |
| psql shell | `make db-psql` | `docker compose exec postgres psql -U nsa -d nsa_training` |
| Reset database (destructive) | `make db-reset` | `docker compose down -v; docker compose up -d postgres` |
| Apply migrations | `make migrate-up` | `goose -dir database/migrations postgres "$DATABASE_URL" up` |
| Roll back one migration | `make migrate-down` | `goose -dir database/migrations postgres "$DATABASE_URL" down` |
| Migration status | `make migrate-status` | `goose -dir database/migrations postgres "$DATABASE_URL" status` |
| New migration | `make migrate-create name=add_x` | `goose -dir database/migrations create add_x sql` |
| Load DEV demo data | `make db-seed` | `docker compose exec -T postgres psql -U nsa -d nsa_training < database/seeds/dev.sql` |
| Swagger UI (API docs) | `make swagger` | `docker compose up -d swagger-ui` → http://localhost:8081 |

**Demo accounts (DEV ONLY, password `NsaDemo@123`):** `admin@nsa.local` (ADMIN), `teacher@nsa.local` (TEACHER), `student@nsa.local` (STUDENT). Never use these in any shared environment.

## API Commands

| Task | Make | Plain CLI |
| ---- | ---- | --------- |
| Run API (needs `.env` + database up) | `make api-run` | `cd apps/api; go run ./cmd/api` |
| API tests | `make api-test` | `cd apps/api; go test ./...` |
| Vet | `make api-vet` | `cd apps/api; go vet ./...` |
| Build binary | `make api-build` | `cd apps/api; go build -o bin/api.exe ./cmd/api` |
| Build Docker image | — | `docker build -f apps/api/Dockerfile -t nsa-api .` |

Local URLs when running: API `http://localhost:8080` — Swagger UI `http://localhost:8080/docs` — probes `/health`, `/ready` — auth `/api/v1/auth/*` — academic administration `/api/v1/admin/*`.

Try it: `POST /api/v1/auth/login` with `{"email":"admin@nsa.local","password":"NsaDemo@123"}` (after `make db-seed`) → use the returned `access_token` as `Authorization: Bearer <token>` for `GET /api/v1/auth/me`.

## Testing Commands

| Scope | Make | Plain CLI |
| ----- | ---- | --------- |
| API unit tests | `make api-test` | `cd apps/api; go test ./...` |
| API + DB integration tests | `make api-test-integration` | needs `make db-test-migrate` first |
| Web tests (Phase 8+) | `make web-test` | `cd apps/web; npm run test` |
| All checks for current phase | `make check` | — |

## Current Limitations

- No schedule, attendance, assessment, progress, or teacher/student self-service endpoints yet (Phases 5–7); rate limiting is in-memory per instance (fine for single-instance MVP).
- Swagger UI page loads its assets from a CDN; use `make swagger` (container) for fully offline docs.
- Web app starts in Phase 8; CI/CD, Caddy deployment config, and E2E tests arrive in Phase 10.
- Out of MVP scope (by design): admission/enrollment pipeline (handled by the existing public website), payments, real-time chat, mobile apps, microservices, Redis/Kafka, AI features.

## Documentation

- `docs/AI_CONTEXT.md` — **read first**: current phase, decisions, commands, git state (for developers and AI agents)
- `docs/openapi.yaml` — API contract source of truth (view with `make swagger`)
- `database/schema.dbml` — ERD for dbdiagram.io (regenerate when schema changes)
- `docs/adr/` — architecture decision records (created when a significant decision is made)

## Git Rules for Contributors and AI Agents

- No commits without explicit user permission. Conventional Commits when permitted.
- No push/merge/rebase/tag/PR without explicit separate permission.
