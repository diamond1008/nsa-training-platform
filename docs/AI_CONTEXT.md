# AI Context

## Current Phase
- Phase 7 — Skill Assessment and Progress
- Status: completed; user explicitly authorized commit and push

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

## In Progress
- Nothing — Phase 7 is complete.

## Next
- Phase 8 — Frontend Foundation and Authenticated Shell.

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

## Important Commands
- Startup: `make db-up`, `make migrate-up`, `make db-seed`, `make api-run`
- Generate SQL: `sqlc generate`
- Unit/check: `make check`
- Integration: `make db-test-migrate`, then `make api-test-integration`
- Build: `make api-build`; Docker: `docker build -f apps/api/Dockerfile -t nsa-api .`
- Docs: validate with `npx --yes @redocly/cli@latest lint docs/openapi.yaml`

## Key Files
- `apps/api/internal/assessments/{service,handler}.go` — assessment lifecycle and role boundaries.
- `apps/api/internal/progress/{service,handler}.go` — deterministic Student progress.
- `database/queries/{assessments,progress}.sql` — assessment history/integrity and progress inputs.
- `apps/api/internal/assessments/assessments_integration_test.go` — Phase 7 PostgreSQL behavior.
- `apps/api/cmd/api/main.go` — Teacher/Student Phase 7 routes.
- `docs/openapi.yaml` — external API contract, version 0.5.0.

## Known Issues / Deferred Work
- Formal ADMIN course-completion approval/rejection is not exposed in Phase 7; progress reports computed Pending/Eligible status.
- Attendance roster/finalization follows the current `enrolled` relationship; historical transfer/withdrawal policy is deferred.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- React web app starts in Phase 8; CI/Caddy/Playwright are Phase 10.

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

## Git State
- Current branch: `main`.
- Phase 6 commit: b8a580b `feat(api): implement attendance management` (pushed).
- User explicitly authorized committing and pushing Phase 7 after all checks pass.
