# Operations UX and Attendance Workspace

## Goal

Turn the existing vocational-training portal into a fast, predictable operations workspace without changing its approved academic, attendance-locking, completion, or payment scope.

## Decisions

- List state is shareable and recoverable. Search, filters, sorting, and pagination live in URL query parameters.
- Free-text search is debounced by 300 ms. A filter change resets pagination to page 1.
- Every list uses stable, server-side sorting from an allowlist. Unknown sort values return a validation error instead of becoming SQL fragments.
- Frequently used filters stay visible; secondary filters live in an expandable advanced-filter panel. Active filters are also shown as removable chips with a clear-all action.
- Selectors that can exceed 100 records use bounded server search rather than assuming the first 100 rows are complete.
- Admin attendance is owned by the dedicated `/admin/diem-danh` workspace. The calendar links into that workspace by session ID instead of maintaining a second correction implementation.
- Teacher and Admin attendance both expose Present, Late, Excused, and Absent. Teacher changes remain a same-day batch save; Admin corrections remain immediate, reasoned, audited writes.
- No new UI framework, data grid, state store, search service, or server process is introduced.

## List and Filter Contract

The existing snake_case API style is preserved. List endpoints add optional `sort_by` and `sort_order` parameters. Supported values are feature-owned allowlists; defaults preserve existing ordering.

Frontend URLs use concise parameters:

```text
?q=&status=&course_id=&class_id=&teacher_id=&location_id=&from=&to=&sort=&order=&page=
```

Empty/default values are omitted. The browser back button restores the previous directory state. Search input keeps an immediate local value while the URL/server query receives the debounced value.

### Directory filters

- Students: text, lifecycle status, class, course, attendance-risk state, sort.
- Teachers: text, account status, assignment state, class, course, sort.
- Courses: text, status, sort.
- Classes: text, status, course, teacher, capacity state, date range, sort.
- Sessions: text, date range, class, teacher, location, session status, session type, attendance lock state.
- Completion candidates: text, eligibility state, course, class, sort.

The implementation may expose only filters supported by current business data; it must not invent departments, tuition, semesters, or university-only concepts.

## Attendance Workspace

The session selector is date-bounded and searchable by class code/title. Selecting a session writes `session` to the URL. The workspace header shows class, date, fixed slot, teacher, room, and lock state.

Summary cards are interactive roster filters:

- All
- Unrecorded
- Present
- Late
- Excused
- Absent

The roster supports student-code/name search and places unrecorded students first by default. Color supplements text and icons but never replaces them.

Teacher workflow:

1. Load an assigned session.
2. Edit any of four statuses and optional notes.
3. See a dirty-change count.
4. Optionally mark all students Present; bulk Absent requires confirmation.
5. Save one batch.
6. Continue editing until Vietnam midnight; after locking, the same view is read-only.

Admin workflow:

1. Load any session.
2. Filter/search the roster.
3. Pick a new status for an individual student.
4. Review before/after state and enter a mandatory reason.
5. Save an audited correction, including creation of a previously unrecorded attendance row.
6. Inspect the class operation timeline for correction history.

## Architecture

- Go handlers parse and validate filters, sort keys, and UUID/date values.
- Services own filter normalization and business policy.
- sqlc queries remain parameterized and use explicit CASE-based allowlisted ordering where dynamic SQL is unnecessary.
- React Router owns URL state; TanStack Query owns remote data and cache invalidation.
- Shared filter primitives live in focused component/hooks files. Feature pages define their own filter schema and labels.
- The existing large Admin and Teacher page modules stop receiving new attendance/filter infrastructure; new focused modules are extracted where touched.

## Performance

- All endpoints stay bounded to `per_page <= 100`.
- Search selectors request at most 20–50 matching options.
- Existing equality/range indexes are reused. A new Goose migration adds only indexes justified by the actual filter predicates; trigram indexes are limited to the text-search columns used by directories and schedules.
- Roster filtering stays client-side because vocational classes are capacity-bounded; session and directory searching stays server-side.

## Security and Abuse Cases

- Trust boundaries: URL query parameters, form fields, attendance corrections, and imported API payloads.
- Assets: student PII, attendance integrity, Admin auditability, and role-scoped class visibility.
- Spoofing/elevation: existing authentication, ADMIN RBAC, and teacher-assignment checks remain authoritative.
- Tampering/repudiation: correction reasons and before/after values are written in the same transaction as the attendance change.
- Information disclosure: Teacher/Admin APIs keep their current scopes; Student visibility is not expanded. Selector endpoints reuse the same role scope as their owning list endpoints.
- Denial of service: page sizes, search lengths, date ranges, and request bodies remain bounded; no unbounded typeahead endpoint is added.
- Injection: sort keys are allowlisted and SQL remains parameterized.

## Accessibility and Interaction

- Form controls have associated labels, names, visible focus, and actionable error messages.
- Custom select behavior uses a semantic combobox/listbox contract with keyboard navigation or falls back to native select where search is unnecessary.
- Modal focus moves inside on open, returns to its trigger on close, and is trapped while open.
- Async success/error states use status/alert semantics.
- `transition-all` is replaced in touched components with explicit properties, and reduced-motion preferences are respected.
- Empty-state copy distinguishes an empty system from zero filtered results and offers a clear-filter action where applicable.

## Verification

- Go unit/handler tests cover every sort allowlist and filter validation path.
- DB integration tests cover combined filters, stable ordering, and attendance correction of an unrecorded student.
- React tests cover URL round-tripping, debounce, page reset, filter chips, four-state attendance, dirty tracking, and locked read-only behavior.
- Browser E2E covers Admin directory filtering and Teacher attendance save/navigation.
- Run sqlc generation, migration up/down/up, API integration, OpenAPI lint, full frontend gates, `make check`, and the relevant browser E2E suite.

