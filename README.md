# NSA Training Platform

Training management platform for an automotive vocational training center. It manages the post-admission lifecycle: student accounts, class assignment, schedules, attendance, practical skill assessment, progress tracking, and course completion.

**Repository model:** monorepo — Go API (`apps/api`) + React SPA (`apps/web`) + one PostgreSQL database.

## Project Status

**Current phase: Phase 1 — Local infrastructure and database (completed, pending review)**

| Phase | Name | Status |
| ----- | ---- | ------ |
| 0 | Repository audit and bootstrap | ✅ Completed (commit 28f4d25) |
| 1 | Local infrastructure and database | ✅ Completed (pending review) |
| 2 | Go API foundation | ⬜ Not started |
| 3 | Authentication and RBAC | ⬜ Not started |
| 4 | Academic core management | ⬜ Not started |
| 5 | Scheduling | ⬜ Not started |
| 6 | Attendance | ⬜ Not started |
| 7 | Skill assessment and progress | ⬜ Not started |
| 8 | Frontend foundation and auth shell | ⬜ Not started |
| 9 | Feature screens | ⬜ Not started |
| 10 | Quality, CI, deployment readiness | ⬜ Not started |

See `docs/AI_CONTEXT.md` for the detailed, always-current implementation state.

## Implemented Features

- **Local infrastructure:** PostgreSQL 16 via Docker Compose with health check and persistent named volume (`make db-up`)
- **Migrations:** Goose v3 with baseline schema v1.2 as `00001_baseline_schema.sql` — 20 tables, 13 enum types, exclusion constraints (no overlapping sessions per class/teacher/location), concurrency-safe capacity triggers; up/down verified on a clean database
- **Seeds:** roles (ADMIN/TEACHER/STUDENT) ship in the baseline; DEV-ONLY demo accounts via `make db-seed`
- **API docs:** OpenAPI 3.1 skeleton at `docs/openapi.yaml` viewable through Swagger UI (`make swagger` → http://localhost:8081)
- **ERD:** `database/schema.dbml` for dbdiagram.io
- Application code: not started (Phase 2+)

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
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, token TTLs, `BCRYPT_COST` — authentication (Phase 3)
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

## Testing Commands

| Scope | Make | Plain CLI |
| ----- | ---- | --------- |
| API tests (Phase 2+) | `make api-test` | `cd apps/api; go test ./...` |
| Web tests (Phase 8+) | `make web-test` | `cd apps/web; npm run test` |
| All checks for current phase | `make check` | — |

## Current Limitations

- No application code yet (API arrives in Phase 2, web in Phase 8).
- Swagger UI currently reads the static `docs/openapi.yaml`; the API will serve its own docs from Phase 2.
- CI/CD, Caddy deployment config, and E2E tests arrive in Phase 10.
- Out of MVP scope (by design): admission/enrollment pipeline (handled by the existing public website), payments, real-time chat, mobile apps, microservices, Redis/Kafka, AI features.

## Documentation

- `docs/AI_CONTEXT.md` — **read first**: current phase, decisions, commands, git state (for developers and AI agents)
- `docs/openapi.yaml` — API contract source of truth (view with `make swagger`)
- `database/schema.dbml` — ERD for dbdiagram.io (regenerate when schema changes)
- `docs/adr/` — architecture decision records (created when a significant decision is made)

## Git Rules for Contributors and AI Agents

- No commits without explicit user permission. Conventional Commits when permitted.
- No push/merge/rebase/tag/PR without explicit separate permission.