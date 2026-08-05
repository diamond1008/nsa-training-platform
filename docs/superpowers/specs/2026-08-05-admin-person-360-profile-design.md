# Admin Person 360 Profile Design

## Goal

Give ADMIN users a professional, person-centered view of each Student and Teacher without duplicating specialist attendance, score, assessment, or certificate workspaces.

## Scope

Each ADMIN directory links to a dedicated detail route:

- `/admin/hoc-vien/:studentId`
- `/admin/giang-vien/:teacherId`

Each page has three tabs:

1. **Tổng quan** — identity, contact/account status, summary metrics, current classes, and controlled quick actions.
2. **Lớp hiện tại & lịch sử** — every class membership/assignment and every active interval, including withdrawn, transferred, completed, removed, and later reopened periods.
3. **Lịch cá nhân** — the existing fixed-slot week calendar scoped to the selected person, with Today/previous/next navigation.

Formal attendance, score, competency, completion, and certificate records remain in their canonical workspaces. The profile presents summary values and links instead of creating competing editors.

## User Experience

- Student/Teacher codes and names in the ADMIN directories are semantic links to the profile page.
- The header shows avatar/initials, code, full name, role, profile status, and account status.
- Quick actions are limited to editing the profile and navigating to existing class, schedule, attendance, or result workflows. Existing confirmation, reason, authorization, and audit requirements remain authoritative.
- Loading, error, not-found, and empty-history states use existing shared components.
- Desktop uses a compact tabbed page. Mobile stacks identity, metrics, class records, and calendar content without horizontal document overflow.

## Data Model

Student history continues to use stable `class_enrollments` plus `class_enrollment_periods`.

Teacher history gains `teacher_assignment_periods`, mirroring enrollment periods:

- `assignment_id`
- `started_at`, nullable `ended_at`
- `created_by`, nullable `ended_by`
- `start_reason`, nullable `end_reason`
- `created_at`

Periods cannot overlap, and only one open period may exist per stable assignment. Existing assignments are backfilled with one open period. Removing a Teacher ends the open period instead of deleting the stable assignment. Reassigning the same Teacher to the same class opens a new period on that stable assignment.

All current-assignment authorization and operational queries must require an open period. Historical session/assessment foreign keys continue to reference the stable `teacher_assignments` relation.

## API Contract

Add additive ADMIN read endpoints:

- `GET /api/v1/admin/students/{studentID}/profile-summary`
- `GET /api/v1/admin/students/{studentID}/class-history`
- `GET /api/v1/admin/students/{studentID}/schedule?from=&to=&page=&per_page=`
- `GET /api/v1/admin/teachers/{teacherID}/profile-summary`
- `GET /api/v1/admin/teachers/{teacherID}/class-history`

Teacher schedules reuse the existing ADMIN schedule endpoint with `teacher_id`. Student schedules receive an explicit person-scoped ADMIN endpoint because enrollment periods determine whether a session belongs to the Student.

Profile summaries are bounded read models:

- Student: profile, current-class count, total-class count, current classes below the 80% attendance threshold, and upcoming-session count.
- Teacher: profile, current-class count, total-class count, completed-session count, and upcoming-session count.

Class-history endpoints accept bounded `page`/`per_page`, are ordered newest-first, and include class/course identity, aggregate status, relevant role, and an array of periods.

Errors use the existing envelope and module-specific not-found codes. All endpoints remain ADMIN-only through existing router middleware.

## Module Boundaries

- `students` owns Student profile summary and class-history read models.
- `teachers` owns Teacher profile summary and assignment-history read models.
- `schedules` owns the Student-specific ADMIN schedule query because it applies temporal enrollment rules.
- `classes` owns assignment-period mutation rules and audit/class-history writes.
- The React ADMIN feature composes these contracts with TanStack Query; it does not duplicate server state.

## Security and Audit

- ADMIN RBAC remains server-authoritative.
- UUID, date range, pagination, and enum inputs are validated at HTTP boundaries.
- Queries are parameterized and bounded.
- Profile responses never include password hashes, tokens, private audit payloads, or image data in audit events.
- Assignment end/reopen actions retain mandatory reasons and write the period mutation, class history, and audit event in one transaction.

## Testing

- Migration up/down/up and sqlc generation.
- Integration coverage for Student history, Teacher remove/reassign history, current-assignment authorization after removal, and person-scoped schedules.
- Handler validation and not-found tests.
- React tests for directory links, the three tabs, current/history states, week navigation, and edit modal behavior.
- Full `make check`, DB integration suite, OpenAPI lint, and browser E2E/smoke coverage.

## Out of Scope

- A second attendance/score/assessment/certificate editor inside the profile.
- Object storage, advanced avatar cropping, HR/payroll, tuition, or public profile pages.
- Teacher self-service access to another Teacher's profile or Student access to other Students' private profiles.
