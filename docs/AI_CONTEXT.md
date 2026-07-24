# AI Context

## Current Phase
- Phase 0 — Repository audit and bootstrap
- Status: completed (pending user review)

## Completed
- Environment installed and verified: Go 1.26.5, GNU Make 4.4.1, Docker Desktop 4.83.0 (Engine 29.6.2, Compose 5.3.1), WSL2 2.7.10, Node v24.18.0/npm 11.16.0
- Monorepo folder skeleton (apps/api, apps/web, database, docs, infra, .github) with .gitkeep placeholders
- Root configs: .gitignore (secrets/artifacts), .editorconfig (LF/UTF-8, tabs for Go+Makefile), .env.example, Makefile (canonical commands)
- README.md (status, stack, structure, setup, commands), docs/AI_CONTEXT.md, .github/pull_request_template.md
- .gitattributes enhanced (LF for .sh/.sql/Makefile, CRLF for .ps1/.bat/.cmd, binary rules)

## In Progress
- Nothing — waiting for user approval to start Phase 1.

## Next
- Phase 1 — Local infrastructure and database: compose.yaml (PostgreSQL 15+ with health check + named volume), install Goose, convert NSA_Training_Portal_PostgreSQL_v1.2.sql into the first Goose migration under database/migrations/ (source file currently at C:\Users\admin\Downloads\NSA_Training_Portal_PostgreSQL_v1.2.sql), generate database/schema.dbml, validate on a clean database, seed roles + demo accounts (USER APPROVED demo seed data), update docs.

## Architecture Decisions
- Modular monolith; vertical slices per business module under apps/api/internal/<module>; shared infra only under internal/platform. No root-level controllers/services/repositories/models folders.
- sqlc generated Go code IS committed to database/generated (build does not require codegen).
- Schema source of truth = versioned Goose migrations; DBML is generated documentation, never hand-maintained.
- Compose file name is compose.yaml (Docker Compose v2 convention); database service name is `postgres`.
- All repo documentation written in English; chat communication is bilingual VI/EN.
- UTC timestamps in DB; Asia/Saigon (UTC+7) display handled at presentation layer.

## Important Commands
- Local startup: `make setup` then (Phase 1+) `make db-up`
- Migration: `make migrate-up` / `make migrate-down` / `make migrate-status` / `make migrate-create name=<snake_case>`
- Code generation (sqlc, Phase 2+): `sqlc generate` from repo root
- Tests: `make api-test` (Go), `make web-test` (Vite), `make check` (all available)
- Lint/build: `make api-vet`, `make api-build`, `make web-build`
- PowerShell equivalents are documented in README.md (make is optional).

## Key Files
- README.md — project entry point, status table, setup and command reference
- docs/AI_CONTEXT.md — this file; update after every meaningful task
- .env.example — annotated environment variable template (never commit .env)
- Makefile — canonical commands for db/migrate/api/web
- Master plan + phase definitions: C:\Users\admin\Downloads\NSA_AI_Coding_Master_Prompt.txt (external file, not committed)
- DB schema baseline v1.2: C:\Users\admin\Downloads\NSA_Training_Portal_PostgreSQL_v1.2.sql (external; becomes migration 00001 in Phase 1)

## Known Issues / Deferred Work
- No application code exists yet (by design — Phase 0 scope).
- compose.yaml, Goose install, migrations, seeds: Phase 1.
- sqlc.yaml, OpenAPI, DBML: not created yet.
- CI workflows, Caddyfile, Playwright: Phase 10.

## Database State
- Latest migration: none (Phase 1 will add 00001 from baseline v1.2 — 20 tables, 13 ENUM types, exclusion constraints for class/teacher/location overlap, capacity triggers, seeded ADMIN/TEACHER/STUDENT roles).
- Seed/demo status: roles seed ships inside the baseline; demo user accounts APPROVED by user for Phase 1 (dev-only passwords).

## API State
- Implemented endpoint groups: none.
- OpenAPI status: docs/openapi.yaml not created yet (Phase 2+).

## Git State
- Current branch: main
- Uncommitted changes: all Phase 0 files listed above (untracked) — review with `git status`
- Last commit: 4eefd77 "Initial commit"
- Explicit statement: "Do not commit without user permission"