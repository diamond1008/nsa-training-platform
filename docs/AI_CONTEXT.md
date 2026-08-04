# AI Context

## Current Phase

- Phase 22 — Dense scheduling and withdrawal-safe temporal re-enrollment
- Status: implementation and full local validation complete in the working tree

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
- Phase 17 implementation:
  - Migration `00006_tests_scores_and_completion_rules.sql` fixes every course attendance threshold at 80%, adds configured course tests, repeat score attempts, immutable correction history, and course-scoped completion snapshots.
  - ADMIN configures mandatory in-class tests and one active final exam. The final exam has a fixed threshold of 5 and passes only when the best score is strictly greater than 5.
  - Assigned Teachers record repeat attempts and may correct scores only with a reason. ADMIN can correct any score. Corrections are audited, retained in class history, and notify the Student.
  - Student progress and completion candidates aggregate attendance and score attempts by student/course across every same-course enrollment; class transfers therefore preserve earlier results and still lead to one course completion/certificate.
  - Formal eligibility is exactly attendance `>= 80%`, every active mandatory in-class test passed, and one active final exam with best score `> 5.0`. Session, competency, and assessment metrics remain informational.
  - Admin, Teacher, and Student screens expose course-test configuration, score entry/correction, own results, exact missing completion conditions, and completion-report score columns.
  - Ended classes, returning-student profiles/codes, historical attempts, decisions, and revoked certificates are retained. Wrong certificate information is corrected at the source, followed by reasoned revoke/reissue rather than in-place document edits.
- Phase 18 implementation:
  - Migration `00007_fixed_training_slots.sql` detaches optional assessment links, deletes every existing off-slot class session (and its cascading attendance rows), then enforces exactly three `Asia/Ho_Chi_Minh` slots: `08:00–12:00`, `13:30–17:30`, and `18:30–21:30`.
  - The Go scheduling service performs the same slot validation before writes and exposes `SESSION_TIME_SLOT_INVALID`; RFC3339 request/UTC response compatibility is unchanged.
  - The Admin form now accepts a date plus Morning/Afternoon/Evening rather than free-form datetimes.
  - The shared desktop week calendar is a compact seven-day by three-slot grid. Month and mobile agenda modes remain, and Admin/Teacher/Student pages provide role-specific summary counters for the loaded range.
  - Course tests and final exams are explicitly paper-only. ADMIN owns test configuration, assigned TEACHER users enter marked scores and reasoned corrections, and STUDENT users have result-only access. No online testing subsystem exists.
- Phase 19 implementation (Student Avatar Persistence & Attendance UX Polish):
  - Migration `00008_add_student_avatar_url.sql` adds `avatar_url TEXT` column to the PostgreSQL `student_profiles` table with full `sqlc` type-safe query integration.
  - Go API service and HTTP handlers for `students` and `attendance` packages support `avatar_url` persistence in DB and payload JSON contracts.
  - Client-side WebP compression utility `compressImageToWebP` converts uploaded avatar images to lightweight WebP data URLs before saving.
  - The API accepts only structurally valid WebP data URLs up to 256 KiB; original browser uploads are capped at 10 MiB, and audit payloads replace image data with a redacted marker.
  - Admin Student Management features an Avatar table column and Avatar file picker with preview and WebP compression badge.
  - Teacher Attendance Page redesigned into a structured table layout with quick action toggle buttons (Có mặt / Vắng) and backend default alignment.
- Phase 20 implementation:
  - ADMIN has a dedicated attendance route and may record a missing result or correct an existing result, including after lock, only with a mandatory reason.
  - Every correction retains before/after values in the audit and class-operation histories; calendar selection links into the focused attendance workspace instead of duplicating the correction form.
- Phase 21 implementation:
  - Admin students, teachers, courses, classes, schedules, and completion candidates use URL-backed search/filter/sort/pagination with allow-listed server-side query contracts.
  - Student attendance-risk filtering is course-aware and class-aware; filtered CSV export uses the same operational scope as the directory.
  - ADMIN completion filters expose eligible/ineligible, course, class, stable sorting, and accurate filtered totals.
  - ADMIN and assigned TEACHER schedule endpoints support bounded search, domain filters, attendance lock state, and stable sorting.
  - The Teacher attendance workspace supports session and roster search, recorded/unrecorded filters, dirty-row tracking, confirmed bulk absence, and the canonical four backend statuses.
  - The Admin attendance workspace supports bounded session lookup, roster search/status filters, reasoned before/after confirmation, corrections for both missing and recorded rows, and the immutable correction timeline.
  - Shared frontend primitives provide URL query normalization, filter chips, bounded searchable selectors, accessible sorting, focus-managed modals, a skip link, and reduced-motion-safe transitions.
  - `docs/openapi.yaml` documents the expanded list/filter contracts; SQL remains source-controlled under `database/queries` and generated code is refreshed with `sqlc generate`.
- Phase 22 implementation:
  - Migration `00009_add_enrollment_periods.sql` backfills and maintains non-overlapping active intervals beneath each stable `class_enrollments` membership.
  - Attendance and Student schedule queries resolve membership from the half-open period `[started_at, ended_at)` containing the session start; the exact withdrawal boundary and later gap do not enter rosters or absence calculations.
  - ADMIN can reopen only `withdrawn -> enrolled`, with a mandatory reason and optional RFC3339 `effective_at`; capacity, class/student status, class dates, prior period end, and another active same-course enrollment are checked transactionally.
  - Withdrawal, completion, and transfer close the open period atomically with aggregate enrollment state, audit, and class-operation history.
  - The Admin schedule keeps common filters compact, moves class/teacher/location into an advanced disclosure, and renders at most two session cards per week slot with an accessible `+N lớp khác` modal.
  - The class detail page exposes `Đưa trở lại lớp` only for withdrawn memberships and records the effective Vietnam date/time plus reason.
- Phase 23 implementation (Two-State Roll Call UX):
  - Teacher and Admin attendance workspaces intentionally expose only `Có mặt` and `Vắng`; the API, PostgreSQL enum, OpenAPI contract, reports, and historical calculations continue to support `present`, `late`, `excused`, and `absent`.
  - Frontend projection maps `present/late → Có mặt` and `absent/excused/null → Vắng`. Existing `late` and `excused` values show a legacy-data badge and are not silently rewritten when their projected selection is unchanged.
  - Every unrecorded Teacher roster row initializes as an unsaved `Vắng` draft. The teacher marks attendees `Có mặt`, may add notes, and saves the pending batch during the editable Vietnam calendar day.
  - Teacher and Admin use the same horizontally responsive table columns: STT, student code, avatar, learner name, Có mặt, Vắng, note, and recorder. The Admin must still confirm every creation/correction with a mandatory reason so the audit and class-operation histories remain authoritative.

## In Progress

- Operator acceptance with realistic center data; no additional product feature phase is currently approved.

## Next

- Real center-data rehearsal and operator acceptance for ADMIN attendance correction, re-enrollment, dense multi-class slots, TEACHER same-day attendance, filtered directories, and completion review.
- After acceptance: maintenance, backups/restore rehearsal, monitoring, and deployment preparation only.
- Payments, tuition, debt tracking, third-party payment integrations, and category-based student-code prefixes remain explicitly out of scope.

## Architecture Decisions

- Backend RBAC and ownership checks remain authoritative; frontend route guards are only a UX boundary.
- Teacher class screens use dedicated assignment-scoped read endpoints instead of composing ADMIN APIs or exposing all classes.
- A Teacher class detail response intentionally combines the class, roster, and course competencies needed by attendance/assessment screens.
- TanStack Query owns server state and invalidation; forms keep only transient local input state.
- Operational list state is canonical in the URL; backend validation and RBAC remain authoritative for every filter and mutation.
- Schedule calendars link to the dedicated attendance workspaces; do not reintroduce independent attendance editors inside calendar pages.
- Teacher batch attendance treats every unrecorded row as a pending Absent draft, never as Present. Saving persists those pending defaults plus explicit Có mặt selections; reconciliation remains the safety net that marks any still-missing records Absent at the next Vietnam midnight.
- Shared API errors retain backend codes/messages and surface predictable loading, error, and empty states.
- Browser access tokens remain memory-only; the secure HttpOnly refresh cookie restores sessions after reload.
- sqlc generated output remains committed under `database/generated`.
- No Phase 9 schema migration is required.
- Formal completion policy is intentionally fixed: attendance 80%, all mandatory in-class tests, final exam strictly above 5. ADMIN cannot override an ineligible approval.
- Completion uniqueness and calculation are per student/course, not student/class; same-course transfer history remains counted.
- Classes and education records are retained rather than hard-deleted. Returning Students keep their existing profile and generated code and receive a new enrollment.
- The fixed-slot migration is an explicit exception to normal historical session retention: the user authorized deleting all pre-Phase-18 sessions that do not match one of the three center-wide slots. Assessment results survive with a null optional session link; attendance rows tied to deleted sessions do not.
- Tests and final exams are physical paper workflows. The platform stores test definitions, attempts, scores, corrections, and completion effects only; it must not add online questions, answers, submissions, timers, or browser proctoring without a newly approved scope.
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
- `apps/web/src/components/calendar.tsx` — shared compact three-slot week calendar, month view, mobile agenda, and role counters.
- `apps/web/src/components/{ui,data}.tsx` — shared UI and server-state presentation.
- `apps/web/src/components/{filters,SearchCombobox}.tsx` — URL-filter presentation and bounded searchable selectors.
- `apps/web/src/lib/listQuery.ts` — normalized query-string parsing and patching for management screens.
- `apps/web/src/features/{admin,teacher}/*AttendancePage.tsx` — canonical role-scoped attendance workspaces.
- `apps/web/src/lib/{apiClient,domainTypes,format}.ts` — transport, contracts, and display helpers.
- `apps/web/src/routes/router.tsx` — role-protected Phase 9 route tree.
- `apps/api/internal/classes/{service,handler}.go` — Admin class workflows and Teacher assignment-scoped reads.
- `apps/api/internal/students/{service,handler}.go` — generated codes, lifecycle transitions, profile fields, and CSV exchange.
- `database/migrations/00002_student_profiles_lifecycle.sql` — Phase 11 schema and sequence.
- `database/migrations/00004_class_operations_history.sql` — Phase 12 immutable operational timeline.
- `database/queries/classes.sql` — Admin and Teacher class queries.
- `database/migrations/00005_completion_certificates_and_evidence.sql` — assessment evidence, immutable completion decisions, and certificates.
- `database/migrations/00006_tests_scores_and_completion_rules.sql` — tests, attempts, corrections, fixed attendance, and course-scoped completion.
- `database/migrations/00007_fixed_training_slots.sql` — destructive cleanup of off-slot sessions and database enforcement of the three center-wide slots.
- `database/queries/{tests,completions,progress}.sql` — score workflows and transfer-safe formal eligibility.
- `apps/api/internal/testscores` — ADMIN/Teacher/Student score configuration and attempt workflows.
- `apps/api/internal/{completions,notifications,reports}` — Phase 15–16 business modules.
- `docs/openapi.yaml` — external API contract, version 1.2.0.
- `.github/workflows/ci.yml` — API, web, migration, E2E, and image-build gates.
- `compose.production.yaml` and `infra/caddy/Caddyfile` — production topology and TLS edge.
- `apps/web/e2e/critical-path.spec.ts` and `database/seeds/e2e.sql` — deterministic role journeys.
- `docs/{DEPLOYMENT,OPERATIONS,SECURITY_REVIEW}.md` — production runbooks and review.

## Known Issues / Deferred Work

- Completion eligibility is deterministic from attendance >=80%, all required tests, and final exam >5; only ADMIN records approval/rejection, and rejected re-reviews revoke any current certificate.
- Attendance rates intentionally count Present and Late, exclude Excused from the denominator, and flag risk only after at least one recorded session.
- Rate limiting is in-memory; Testcontainers remains deferred in favor of `nsa_training_test`.
- Check the GitHub-hosted CI result after each pushed delivery branch.
- `npm audit --omit=dev` reports two moderate React Router 6 advisories; applicability and upgrade decision are documented.

## Database and API State

- Latest migration: `00008_add_student_avatar_url.sql`; the test database migrates through version 8 and retains the fixed-slot constraint from migration 00007.
- Teacher class reads are assignment scoped by authenticated Teacher user ID.
- Teacher assessments remain under `/api/v1/teacher/classes/{classID}/students/{studentID}/assessments`; test results/attempts use the adjacent `/test-results` and `/tests/{testID}/attempts` routes.
- Student self-service APIs include `/api/v1/student/{schedule,attendance,assessments,test-results,progress,certificates}`; public certificate verification is `/api/v1/certificates/{verificationCode}`.
- OpenAPI version: 1.2.0, including Phase 17–18 training contracts plus Phase 20–21 attendance and operational-filter routes.

## Web State

- Routes: `/login`, `/doi-mat-khau`, `/admin/*`, `/teacher/*`, `/student/*`, `/403`, and fallback 404.
- All sidebar routes render connected feature screens rather than placeholders.
- Role-specific dashboards, responsive navigation, mobile card tables, improved forms/modals/feedback, compact three-slot week calendars, month views, mobile agendas, and role-specific calendar counters are implemented.
- Phase 18 validation: sqlc generation, Go format/vet/unit tests, Goose up/down/up, the complete DB integration suite, ESLint, Prettier, 23/23 Vitest tests, TypeScript, Vite production build, OpenAPI lint, and 3/3 Playwright role journeys pass. A 1440x900 browser smoke test confirmed that the schedule page has no document overflow.
- Phase 21 validation: `make check`, sqlc generation, test-database migration through version 8, the complete DB integration suite, 41/41 Vitest tests, TypeScript/Vite production build, OpenAPI lint, local and production Compose configuration, and 3/3 Playwright role journeys pass. Production Compose used `.env.production.example` because no secret-bearing `.env.production` file is stored in the workspace.

## Phase 19 & 20 Handoff (2026-07-30)

- **Student Avatar Persistence & WebP Compression (Phase 19)**:
  - Goose migration `00008_add_student_avatar_url.sql` added `avatar_url TEXT` column to `student_profiles`.
  - Client-side WebP 400x400 compression (`compressImageToWebP`) added to Student Management admin UI.
- **Stationary 34px Axis Sidebar Navigation**:
  - Unified single DOM tree architecture for `AppLayout.tsx` locking all icons (N logo, nav items, student profile avatar, logout button) to a fixed `X = 34px` axis across expand/collapse width transitions.
  - Hover transition on collapsed top logo smoothly swaps N badge with expand icon without shifting layout coordinates.
- **Admin Attendance Management & Audit Corrections (Phase 20)**:
  - Added Admin Attendance Page (`/admin/diem-danh`) and API endpoint `POST /api/v1/admin/sessions/{sessionID}/students/{studentID}/attendance`.
  - Administrative attendance modifications mandatorily require a non-empty `reason` field in the confirmation modal before saving.
  - All admin corrections are saved to PostgreSQL audit log (`audit.WriteWithReason`) and class history log (`classhistory.Write`) with before/after state diffs.

## Git State

- Current branch: `codex/fixed-training-slots`.
- Phase 10/UI baseline commit: `27f8630 feat(platform): harden delivery and polish role experiences`.
- Phase 18 includes the fixed-slot work plus the concurrently prepared application-shell and icon polish in `AppLayout.tsx` and `icons.tsx`.

## Phase 10 Handoff (2026-07-28)

- CI: `.github/workflows/ci.yml` gates Go format/vet/test/build, web typecheck/format/test/build/audit, Goose up/down/up, production image builds, and Playwright E2E.
- E2E: `apps/web/e2e/critical-path.spec.ts` validates login/RBAC plus teacher and student calendar journeys using fake seed `database/seeds/e2e.sql`.
- Production: `compose.production.yaml` exposes only Caddy; migration is a one-shot dependency before API startup. `infra/caddy/Caddyfile` owns automatic TLS and same-origin routing.
- Operations/security: see `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, and `docs/SECURITY_REVIEW.md`.
- API refuses placeholder JWT secrets and insecure CORS origins when `APP_ENV=production`; API/Caddy set defense-in-depth headers.
- Load smoke: `apps/api/cmd/loadtest` exercises authenticated student schedule/progress reads and takes credentials only from environment variables.
