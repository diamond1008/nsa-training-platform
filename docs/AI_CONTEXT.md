# AI Context

## Current Phase

- Phase 16 — Vocational-training operations complete
- Status: Phases 12–16 are complete and validated locally; maintenance is next

## Completed

- Phase 0 (`28f4d25`): repository bootstrap, configs, and continuity docs.
- Phase 1 (`e7f8505`): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (`bc20225`): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (`c5b553a`): authentication, refresh rotation, RBAC, ownership helpers, sqlc, and tests.
- Phase 4 (`d164a05`): academic core administration, safe enrollment, teacher assignments, audits, and OpenAPI.
- Phase 5 (`346ea36`): locations, session scheduling, overlap protection, and role-scoped schedules.
- Phase 6 (`b8a580b`): batch attendance, locking, corrections, Student history/summary, and OpenAPI 0.4.0. The current policy supersedes manual teacher locking: teachers upsert during the session day and the API auto-fills missing records as Absent and locks at the next Vietnam midnight.
- Phase 7 (`fb4813f`): skill assessment lifecycle, Student history, and deterministic progress.
- Phase 8 (`47d26a5`): React/Vite foundation, authenticated shell, role guards, tests, and web container.
- Phase 9 (`8982788`) implementation:
  - Admin directories for students, teachers, courses, and classes with filtering, pagination, create/update forms, status feedback, enrollment, and teacher assignment.
  - Admin schedule management with class, teacher, and location selectors.
  - Teacher dashboard, assigned classes, class roster/detail, weekly teaching calendar with direct attendance navigation, same-day editable attendance, and skill assessment workflows.
  - Student dashboard, enrolled courses, weekly class calendar with personal and enrolled-class attendance status/details, attendance history, assessment history, and progress screens.
  - Reusable weekly calendar, tables, pagination, status badges, stat cards, modal, select, textarea, and progress components.
  - Typed role API modules and shared domain models.
  - Assignment-scoped `GET /api/v1/teacher/classes` and `GET /api/v1/teacher/classes/{classID}` support endpoints.
  - OpenAPI 0.6.0 and integration/RBAC/unit coverage for the new endpoints and UI helpers.
- Phase 10 + UI/UX polish (`27f8630`): CI/deployment hardening, attendance governance refinements, role dashboards, responsive application shell, mobile table cards, and week/month/agenda calendars.
- Phase 11 implementation:
  - Migrations `00002_student_profiles_lifecycle.sql` and `00003_expand_student_code_format.sql` add a PostgreSQL sequence-backed immutable `HV********` code, expanded contact fields, and immutable status history.
  - Public create/update contracts no longer accept a manually editable student code; existing internal test-fixture codes remain supported by the service boundary.
  - Student status transitions require a reason and record old/new state, actor, and timestamp in the same transaction as the profile/audit update.
  - ADMIN can view lifecycle history and import/export UTF-8 CSV with strict validation and per-row outcomes.
  - Concurrent integration coverage verifies generated code uniqueness and status-history behavior.
- Phase 12 implementation:
  - Migration `00004_class_operations_history.sql` adds an immutable per-class operational timeline with actor, reason, timestamp, entity, and JSON details.
  - ADMIN can atomically transfer an active enrollment to another class of the same course, or mark it completed/withdrawn with a required reason while retaining source history.
  - Class edits, enrollment changes, teacher assignment changes, session creation, rescheduling, and cancellation are written to operation history inside the same database transaction.
  - The Admin class screen exposes transfer/completion/withdrawal actions, reason prompts, assignment removal reasons, and the full operation timeline.
  - The Admin calendar exposes session details, attendance inspection, reasoned rescheduling/cancellation, and inline room/workshop create/update management.
  - Existing PostgreSQL exclusion constraints continue to prevent non-cancelled overlap by class, assigned teacher, and training location.
  - OpenAPI 0.8.0, DBML, frontend contracts, and integration coverage document and verify the workflows.
- Phase 13 implementation:
  - Attendance rosters use temporal enrollment membership (`enrolled_at`/`ended_at`) so transfers, withdrawals, and completions preserve past sessions without leaking future or earlier sessions.
  - Automatic reconciliation fills missing historical-roster members as Absent and locks only sessions whose end time is before the current Vietnam-day boundary.
  - Assigned Teachers can save or revise attendance only after the session starts and during the same `Asia/Ho_Chi_Minh` calendar day; the UI mirrors the server state with clear read-only labels.
  - ADMIN can inspect every session and correct individual results through the calendar; every correction requires a reason and writes audit plus class-operation history transactionally.
  - Student summaries now include the configured minimum attendance percentage and a deterministic absence-risk flag; the Student screen shows per-class warnings.
  - Integration coverage verifies auto-fill/lock, role ownership, audited correction, historical access after transfer, and risk calculation.
  - OpenAPI 0.9.0 and frontend domain contracts document the enhanced attendance summary.
- Phase 14 implementation:
  - Practical assessment drafts accept an optional validated HTTP(S) evidence URL; Teacher and Student screens expose the evidence safely.
  - Submitted/locked assessment changes create Student notifications and immutable class-operation events.
- Phase 15 implementation:
  - ADMIN completion candidates combine session, attendance, required competency, and assessment requirements before approval.
  - Approval/rejection history is immutable; approval completes enrollment and issues a sequence-backed `CC########` certificate.
  - Current certificates download as Unicode PDF, have a public verification UUID, and support audited revocation/reissue.
- Phase 16 implementation:
  - Authenticated in-app notifications cover schedule changes, assessment results, attendance risk, and completion decisions.
  - ADMIN operational metrics and UTF-8 CSV exports cover attendance, competencies, classes, and completions with formula-injection protection.
  - Responsive Admin operations UI, Student certificate downloads, OpenAPI 1.0.0, DBML, and focused PDF/CSV/RBAC tests complete the scoped center-management MVP.

## In Progress

- Nothing. Phases 12–16 passed the full local quality gate and are committed on the current branch.

## Next

- Maintenance, acceptance testing with real center data, and deployment preparation only.
- Payments, tuition, debt tracking, third-party payment integrations, and category-based student-code prefixes remain explicitly out of scope.

## Architecture Decisions

- Backend RBAC and ownership checks remain authoritative; frontend route guards are only a UX boundary.
- Teacher class screens use dedicated assignment-scoped read endpoints instead of composing ADMIN APIs or exposing all classes.
- A Teacher class detail response intentionally combines the class, roster, and course competencies needed by attendance/assessment screens.
- TanStack Query owns server state and invalidation; forms keep only transient local input state.
- Shared API errors retain backend codes/messages and surface predictable loading, error, and empty states.
- Browser access tokens remain memory-only; the secure HttpOnly refresh cookie restores sessions after reload.
- sqlc generated output remains committed under `database/generated`.
- No Phase 9 schema migration is required.
- Phase 12 intentionally keeps the existing `HV********` student-code policy; training-category prefixes are not part of this phase.
- Production uses same-origin Caddy routing; only Caddy publishes ports and the migration container must finish before API startup.
- Production startup rejects placeholder JWT secrets and wildcard/non-HTTPS CORS origins.
- React Router 6 remains pinned until its Router 7 migration is tested; current moderate advisories are documented in `docs/SECURITY_REVIEW.md`.

## Important Commands

- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`, `make web-dev`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Web: `make web-lint`, `make web-format-check`, `make web-test`, `make web-build`, `make web-e2e`
- Production: `make prod-config`, `make docker-build-prod`; see `docs/DEPLOYMENT.md`
- Load smoke: set `LOADTEST_EMAIL` / `LOADTEST_PASSWORD`, then `make load-test`
- Docs: `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files

- `apps/web/src/features/admin/{adminApi,AdminPages}.tsx` — Admin feature workflows.
- `apps/web/src/features/teacher/{teacherApi,TeacherPages}.tsx` — Teacher workspaces and write workflows.
- `apps/web/src/features/student/{studentApi,StudentPages}.tsx` — Student self-service screens.
- `apps/web/src/components/{ui,data}.tsx` — shared UI and server-state presentation.
- `apps/web/src/lib/{apiClient,domainTypes,format}.ts` — transport, contracts, and display helpers.
- `apps/web/src/routes/router.tsx` — role-protected Phase 9 route tree.
- `apps/api/internal/classes/{service,handler}.go` — Admin class workflows and Teacher assignment-scoped reads.
- `apps/api/internal/students/{service,handler}.go` — generated codes, lifecycle transitions, profile fields, and CSV exchange.
- `database/migrations/00002_student_profiles_lifecycle.sql` — Phase 11 schema and sequence.
- `database/migrations/00004_class_operations_history.sql` — Phase 12 immutable operational timeline.
- `database/queries/classes.sql` — Admin and Teacher class queries.
- `database/migrations/00005_completion_certificates_and_evidence.sql` — assessment evidence, immutable completion decisions, and certificates.
- `apps/api/internal/{completions,notifications,reports}` — Phase 15–16 business modules.
- `docs/openapi.yaml` — external API contract, version 1.0.0.
- `.github/workflows/ci.yml` — API, web, migration, E2E, and image-build gates.
- `compose.production.yaml` and `infra/caddy/Caddyfile` — production topology and TLS edge.
- `apps/web/e2e/critical-path.spec.ts` and `database/seeds/e2e.sql` — deterministic role journeys.
- `docs/{DEPLOYMENT,OPERATIONS,SECURITY_REVIEW}.md` — production runbooks and review.

## Known Issues / Deferred Work

- Completion eligibility is deterministic; only ADMIN records approval/rejection, and rejected re-reviews revoke any current certificate.
- Attendance rates intentionally count Present and Late, exclude Excused from the denominator, and flag risk only after at least one recorded session.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- First GitHub-hosted CI run is pending because Phase 10 has not been pushed.
- `npm audit --omit=dev` reports two moderate React Router 6 advisories; applicability and upgrade decision are documented.

## Database and API State

- Latest migration: `00005_completion_certificates_and_evidence.sql`.
- Teacher class reads are assignment scoped by authenticated Teacher user ID.
- Teacher assessments remain under `/api/v1/teacher/classes/{classID}/students/{studentID}/assessments`.
- Student self-service APIs include `/api/v1/student/{schedule,attendance,assessments,progress,certificates}`; public certificate verification is `/api/v1/certificates/{verificationCode}`.
- OpenAPI version: 1.0.0.

## Web State

- Routes: `/login`, `/doi-mat-khau`, `/admin/*`, `/teacher/*`, `/student/*`, `/403`, and fallback 404.
- All sidebar routes render connected feature screens rather than placeholders.
- Role-specific dashboards, responsive navigation, mobile card tables, improved forms/modals/feedback, and week/month calendars with mobile agendas are implemented.
- Validation: Go vet/tests, ESLint/typecheck/Prettier, 20/20 Vitest tests, web build, Goose up/down/up, API/web/migrate image builds, Caddy validation, 3/3 Playwright paths, and 200-request load smoke pass.

## Git State

- Current branch: `main`.
- Phase 10/UI baseline commit: `27f8630 feat(platform): harden delivery and polish role experiences`.
- Phases 12–16 are included in the latest local feature commit; do not push without explicit permission.

## Phase 10 Handoff (2026-07-28)

- CI: `.github/workflows/ci.yml` gates Go format/vet/test/build, web typecheck/format/test/build/audit, Goose up/down/up, production image builds, and Playwright E2E.
- E2E: `apps/web/e2e/critical-path.spec.ts` validates login/RBAC plus teacher and student calendar journeys using fake seed `database/seeds/e2e.sql`.
- Production: `compose.production.yaml` exposes only Caddy; migration is a one-shot dependency before API startup. `infra/caddy/Caddyfile` owns automatic TLS and same-origin routing.
- Operations/security: see `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, and `docs/SECURITY_REVIEW.md`.
- API refuses placeholder JWT secrets and insecure CORS origins when `APP_ENV=production`; API/Caddy set defense-in-depth headers.
- Load smoke: `apps/api/cmd/loadtest` exercises authenticated student schedule/progress reads and takes credentials only from environment variables.
