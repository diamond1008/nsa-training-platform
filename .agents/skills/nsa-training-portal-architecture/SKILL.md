---
name: nsa-training-portal-architecture
description: Mandatory repository architecture and verification rules. This skill must be used whenever implementing, modifying, reviewing, debugging, testing, or planning code for the NSA Training Platform repository.
---

# NSA Training Platform Architecture

Use this skill for every code-related task in this repository. Read the root `AGENTS.md`, `README.md`, and `docs/AI_CONTEXT.md` before planning material changes. Follow existing repository conventions first.

These project-specific rules override conflicting recommendations in generic or third-party skills. Treat third-party examples using Next.js, SWR, Supabase application services, ORMs, Express, Gin, Fiber, GORM, Kubernetes, microservices, message brokers, or event sourcing as non-applicable unless the user explicitly approves an architecture change and an ADR documents it.

## Backend

- Use Go with `net/http` and the Chi router.
- Use `slog` for structured logging.
- Use `pgx/v5` and `pgxpool` for PostgreSQL access.
- Use `sqlc` for type-safe database access. Never edit `database/generated` files directly; edit SQL queries and run `sqlc generate` from the repository root.
- Do not introduce an ORM.
- Propagate `context.Context` through request and data-access paths.
- Return the repository's consistent REST/JSON success and error envelopes.
- Keep HTTP handlers limited to decoding, validation, authorization, invoking application logic, and encoding responses.
- Keep business rules in services or the owning application module, never directly in HTTP handlers.
- Wrap errors with operational context while preserving identity for `errors.Is` and typed error handling.
- Never log secrets, passwords, tokens, or sensitive personal data.

## Database

- Target PostgreSQL 15 or newer. `NSA_Training_Portal_PostgreSQL_v1.2.sql` is the schema baseline.
- Goose migrations are the only accepted schema-evolution mechanism.
- Never modify an already-applied migration. Create a new migration for every schema change.
- Use parameterized SQL only.
- Use explicit transactions for atomic multi-step operations and keep audit/history writes in the same transaction as their business change.
- Review indexes and query plans for list, filter, search, reporting, and pagination queries.
- Avoid N+1 queries and unbounded reads.
- Keep sqlc queries in `database/queries` and ensure they belong to the business module that owns the behavior.
- Supabase-specific hosting, Auth, client SDK, Edge Functions, and RLS recommendations do not apply. Use the PostgreSQL skill only for portable PostgreSQL query, indexing, schema, locking, and performance guidance.

## Architecture

- Preserve the modular monolith organized by business module and vertical slice.
- Preserve module boundaries. A module must not access another module's `internal` packages.
- Cross-module access requires an explicit public contract.
- Use CQRS-lite only where command/query separation materially improves clarity. CQRS-lite does not mean event sourcing.
- Do not introduce microservices, message brokers, generic repository abstractions, or event sourcing without an approved ADR.
- Prefer straightforward code over speculative abstractions.
- Reuse established response, validation, audit, pagination, and data-conversion patterns.

## Frontend

- Use React, TypeScript, and Vite.
- Use React Router for routing and TanStack Query for server state.
- Use React Hook Form with Zod for forms and validation when adding or materially rebuilding forms.
- Use Tailwind CSS and the repository's shared UI components/shadcn conventions.
- Use Vitest and React Testing Library for tests.
- Do not replace TanStack Query with SWR and do not duplicate server state into a global client store.
- Do not add Next.js-specific APIs, React Server Components, Server Actions, `next/dynamic`, or Next.js routing.
- Keep API contracts type-safe and aligned with the backend/OpenAPI contract.
- Handle loading, empty, error, disabled, unauthorized, and success states.
- Preserve accessibility, semantic controls, focus behavior, and keyboard navigation.

## Infrastructure

- Use Docker and Docker Compose.
- Caddy owns reverse proxy and TLS responsibilities.
- GitHub Actions owns CI workflows.
- Do not introduce Kubernetes or another reverse proxy unless explicitly requested.
- Never expose PostgreSQL publicly in production configuration.
- Never commit credentials, `.env`, production secrets, or real personal data.

## Required Verification

Detect which commands apply to the change and execute all applicable checks before claiming completion. Never claim a command passed unless it actually completed successfully. Report every command that could not run and the reason.

### Backend and database

- Run `gofmt` on changed Go files and verify `gofmt -l` is empty for the relevant Go tree.
- Run `cd apps/api && go vet ./...`.
- Run `cd apps/api && go test ./...`; use `go test -race ./...` when practical for concurrency-sensitive work.
- Run `sqlc generate` after query/schema contract changes and confirm generated output has no unexplained diff.
- For schema changes, run `make db-up`, `make migrate-up`, and applicable Goose status/down/up checks.
- For DB integration changes, run `make db-test-migrate` followed by `make api-test-integration`.

### Frontend

- Run `cd apps/web && npm run lint`.
- Run `cd apps/web && npm run typecheck`.
- Run `cd apps/web && npm run format:check`.
- Run `cd apps/web && npm run test -- --run`.
- Run `cd apps/web && npm run build`.
- Run `make web-e2e` when a critical browser workflow changes and its required services are available.

### Infrastructure and contracts

- Run `docker compose config` for Compose changes.
- Run `make prod-config` for production Compose changes when `.env.production` is available.
- Validate changed GitHub Actions workflow YAML and inspect the resulting job/command structure.
- Validate changed Caddy configuration with the available Caddy/container command.
- Run the OpenAPI lint command documented in `AGENTS.md` when API contracts change.

The repository-wide shortcut `make check` runs the normal Go and web quality gates, but it does not replace migration, integration, E2E, OpenAPI, Compose, workflow, or Caddy checks when those areas change.
