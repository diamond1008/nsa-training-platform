# NSA Training Platform Agent Rules

## Mandatory project skill

- For every implementation, modification, review, debugging, testing, or planning task, load and follow `.agents/skills/nsa-training-portal-architecture/SKILL.md` first.
- Use the relevant project skills when applicable: `security-and-hardening`, `api-and-interface-design`, `vercel-react-best-practices`, `web-design-guidelines`, `supabase-postgres-best-practices`, and `code-review-and-quality`.
- Project-specific architecture rules override conflicting generic recommendations. In particular, this repository is Go/Chi/pgx/sqlc plus React/Vite/TanStack Query—not Next.js, SWR, Supabase backend, an ORM, Gin, Fiber, GORM, Kubernetes, microservices, or event sourcing.
- Do not execute scripts from third-party skills until the script has been reviewed for the current task.

## Repository conventions

- Read `README.md` and `docs/AI_CONTEXT.md` before material changes.
- Preserve the modular monolith and business-module boundaries.
- Edit SQL sources and run `sqlc generate`; never hand-edit `database/generated`.
- Every schema change needs a new Goose migration; never rewrite an applied migration.
- Keep secrets and real personal data out of source, logs, fixtures, prompts, commits, and documentation.
- Do not commit or push unless the user explicitly requests it.

## Canonical commands

- Full normal gate: `make check`
- Format Go: `gofmt -w <changed-go-files>`; CI verifies `gofmt -l apps/api database/generated`
- Backend: `cd apps/api && go vet ./... && go test ./...`
- Generate database code: `sqlc generate`
- Local DB/migrations: `make db-up`, `make migrate-up`, `make migrate-status`, `make migrate-down`
- DB integration: `make db-test-migrate`, then `make api-test-integration`
- Frontend: `cd apps/web && npm run lint && npm run typecheck && npm run format:check && npm run test -- --run && npm run build`
- Browser E2E: `make web-e2e`
- Compose validation: `docker compose config`
- Production Compose validation: `make prod-config`
- OpenAPI lint: `npx --yes @redocly/cli@latest lint docs/openapi.yaml`
- Production images: `make docker-build-prod`

Run all checks applicable to the files and behavior changed. Never report a check as passing unless it was executed successfully; clearly list anything not run and why.
