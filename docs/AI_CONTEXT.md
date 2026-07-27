# AI Context

## Current Phase
- Phase 8 — Frontend Foundation and Authenticated Shell
- Status: completed and validated; awaiting explicit commit permission

## Completed
- Phase 0 (28f4d25): repository bootstrap, configs, and continuity docs.
- Phase 1 (e7f8505): PostgreSQL 16, Goose baseline, dev seeds, Swagger UI, and DBML.
- Phase 2 (bc20225): Go API foundation, pgxpool, middleware, probes, logging, and Dockerfile.
- Phase 3 (c5b553a): authentication, refresh rotation, RBAC, ownership helpers, sqlc, and tests.
- Phase 4 (d164a05): academic core administration, safe enrollment, teacher assignments, audits, and OpenAPI.
- Phase 5 (346ea36): locations, session scheduling, overlap protection, and role-scoped schedules.
- Phase 6 (b8a580b, pushed): batch attendance, locking, corrections, Student history/summary, and OpenAPI 0.4.0.
- Phase 7:
  - Teacher assessment creation/update with transactional per-student assessment numbering.
  - Draft → Submitted → Locked lifecycle; only drafts are editable and locked history is immutable.
  - Overall and per-competency teacher comments.
  - Active enrollment, assigned/owning teacher, optional session, and competency-course validation.
  - Submission requires every required course competency to have a non-`not_assessed` rating.
  - Teacher class/student history and Student self-only submitted/locked history/detail.
  - Deterministic Student progress from sessions, attendance, required competencies, and assessment sessions.
  - OpenAPI 0.5.0 documents the Phase 7 contracts.
  - Integration tests cover authorization, rollback, lifecycle, history, ownership, course consistency, latest-rating behavior, and deterministic progress.
- Phase 8:
  - React 18 + TypeScript + Vite SPA with Tailwind design tokens and shared UI primitives.
  - React Router route groups and responsive authenticated shells for Admin, Teacher, and Student.
  - Typed API client with standard envelope parsing, in-memory access token, HttpOnly refresh cookie, deduplicated refresh, and one-time 401 retry.
  - Login, silent session restoration, logout, forced/voluntary password change, role guards, 403/404 pages, and loading/error/empty patterns.
  - Phase 9 feature routes are present as role-protected placeholders.
  - Vitest/Testing Library coverage for login validation/errors and API refresh behavior.
  - Multi-stage web Dockerfile and Caddy SPA hosting with route fallback, security headers, and health check.

## In Progress
- Nothing — Phase 8 implementation and validation are complete.

## Next
- Phase 9 — Feature Screens, starting with the Admin management screens or one complete role workflow at a time.

## Architecture Decisions
- Assessments and progress are separate vertical slices under `internal/assessments` and `internal/progress`.
- No migration was required. Existing composite FKs and uniqueness enforce enrollment, assignment, session/class/course, criterion/course, and assessment-number integrity.
- The class-enrollment row is locked while allocating `assessment_no`, serializing concurrent assessment creation for one class/student.
- Any currently assigned teacher may view a student's class assessment history. Only the active teacher recorded in `assessed_by` may update or transition that assessment.
- Students never supply a student ID. JWT user identity scopes assessment history/detail and progress.
- Drafts are hidden from Students. Submitted and Locked assessments remain visible history.
- Configurable completion inputs are existing data: `courses.total_sessions`, `courses.minimum_attendance_pct`, `competency_criteria.is_required`, and non-cancelled class sessions with `session_type = assessment`.
- Required competency progress uses the latest submitted/locked rating by `assessment_no`; Competent, Good, and Excellent satisfy a required criterion.
- Attendance percentage counts Present and Late as attended and excludes Excused from the denominator.
- Overall progress averages the session component, attendance-threshold component, and only applicable competency/assessment components. Values are capped and rounded to two decimals.
- Completion status is derived as Pending or Eligible. Formal ADMIN approval/rejection remains deferred.
- sqlc generated output remains a committed standalone module under `database/generated`.
- Browser access tokens remain memory-only; the secure HttpOnly refresh cookie restores sessions after reload.
- Concurrent 401 responses share one refresh request and retry their original request once.
- Frontend route guards improve UX only; backend RBAC and ownership checks remain authoritative.
- Phase 8 dashboards intentionally contain placeholders rather than duplicating Phase 9 feature work.

## Important Commands
- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Web: `make web-dev`, `make web-test`, `make web-build`
- Build: `make api-build`; Docker API: `docker build -f apps/api/Dockerfile -t nsa-api .`; Docker web: `docker build -f apps/web/Dockerfile -t nsa-web .`
- Docs: validate with `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files
- `apps/api/internal/assessments/{service,handler}.go` — assessment lifecycle and role boundaries.
- `apps/api/internal/progress/{service,handler}.go` — deterministic Student progress.
- `database/queries/{assessments,progress}.sql` — assessment history/integrity and progress inputs.
- `apps/api/internal/assessments/assessments_integration_test.go` — Phase 7 PostgreSQL behavior.
- `apps/api/cmd/api/main.go` — Teacher/Student Phase 7 routes.
- `docs/openapi.yaml` — external API contract, version 0.5.0.
- `apps/web/src/lib/apiClient.ts` — typed API envelopes, access token, refresh deduplication, and 401 retry.
- `apps/web/src/features/auth/AuthContext.tsx` — centralized session lifecycle and role home selection.
- `apps/web/src/routes/router.tsx` — authenticated and role-protected route tree.
- `apps/web/src/app/AppLayout.tsx` — responsive role-aware application shell.
- `apps/web/src/features/auth/{LoginPage,ChangePasswordPage}.tsx` — Phase 8 authentication screens.
- `apps/web/{Dockerfile,Caddyfile}` — production SPA image and static routing.

## Known Issues / Deferred Work
- Formal ADMIN course-completion approval/rejection is not exposed in Phase 7; progress reports computed Pending/Eligible status.
- Attendance roster/finalization follows the current `enrolled` relationship; historical transfer/withdrawal policy is deferred.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- Admin, Teacher, and Student feature pages are placeholders until Phase 9.
- Playwright end-to-end coverage and CI remain Phase 10 work.

## Database State
- Latest migration: `00001_baseline_schema.sql` (unchanged in Phase 7).
- Assessment integrity uses the baseline composite FKs and unique `(class_id, student_id, assessment_no)`.
- Test DB: `nsa_training_test`; Phase 3–7 integration suites pass.

## API State
- Teacher assessments:
  - `GET|POST /api/v1/teacher/classes/{classID}/students/{studentID}/assessments`
  - `GET|PUT /api/v1/teacher/assessments/{assessmentID}`
  - `POST /api/v1/teacher/assessments/{assessmentID}/{submit|lock}`
- Student assessments: `GET /api/v1/student/assessments[/{assessmentID}]`.
- Student progress: `GET /api/v1/student/progress`.
- OpenAPI: version 0.5.0.

## Web State
- Routes: `/login`, `/doi-mat-khau`, `/admin/*`, `/teacher/*`, `/student/*`, `/403`, and fallback 404.
- Auth shell is connected to `/api/v1/auth/*`; Phase 9 feature routes are guarded placeholders.
- Validation: 9/9 web unit tests pass; TypeScript/Vite production build passes.
- Docker: `nsa-web:phase8` builds successfully; Caddy returns 200 for `/`, `/login`, and deep SPA routes.

## Git State
- Current branch: `main`.
- Last commit: fb4813f `feat(api): add skill assessments and progress` (pushed).
- Phase 8 files and documentation are uncommitted. Do not commit without user permission.
