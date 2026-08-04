# Two-State Attendance Design

## Goal

Restore the center's fast paper-roll-call workflow: Teacher and Admin attendance screens expose only **Present** and **Absent**, unrecorded students start visually as Absent, and the roster uses explicit columns instead of a multi-button status cluster.

## Scope

- Change the Teacher attendance workspace and Admin attendance-correction workspace.
- Keep the backend `AttendanceStatus` enum and existing database rows unchanged so historical `late` and `excused` records are never deleted or rewritten merely by opening or saving a page.
- New Teacher batches and new Admin corrections created through these workspaces use only `present` or `absent`.
- Do not change attendance locking, ADMIN correction authority, audit/history behavior, roster ownership, the 80% completion rule, or automatic midnight reconciliation.

## Status projection

The UI uses a two-state projection while preserving the original persisted value:

| Persisted value | Two-state display | Legacy marker |
| --- | --- | --- |
| `present` | Present | None |
| `late` | Present | `Legacy data: Late` |
| `absent` | Absent | None |
| `excused` | Absent | `Legacy data: Excused` |
| `null` | Absent | `Unrecorded` |

The comparison used for dirty tracking is projection-aware. Therefore an existing `late` row displayed as Present and an existing `excused` row displayed as Absent are not overwritten unless an operator explicitly selects the opposite two-state value. An unrecorded row is intentionally dirty with default value Absent so a Teacher save persists every unmarked student as Absent.

## Teacher workflow

1. Loading a roster initializes every unrecorded student to Absent.
2. The Teacher clicks Present only for students who attended. Exactly one of Present or Absent is active in each row.
3. Save submits every unrecorded student plus every recorded student whose projected state or note changed.
4. New payload statuses are limited to `present` and `absent`.
5. Bulk actions remain available as `Mark all Present` and `Reset all to Absent`.
6. Filters and counters are reduced to All, Unrecorded, Present, and Absent.

The roster table columns are:

`No. | Student code | Avatar | Student name | Present | Absent | Note | Recorded by`

On narrow screens the semantic table remains horizontally scrollable rather than collapsing status controls into an ambiguous card.

## Admin workflow

The Admin roster uses the same columns and two-state projection. Selecting a different state opens the existing correction confirmation modal. The mandatory reason, optional note, audit log, class-operation history, and ability to correct locked sessions remain unchanged.

For an unrecorded student, Absent is displayed as the default but both state controls remain actionable so Admin can explicitly create either result through the confirmation flow. Existing legacy values show their marker beside the student identity or recorded-state metadata.

## UI and accessibility

- Use a real `<table>` with separate semantic column headers.
- Present and Absent controls are `<button type="button">` elements with `aria-pressed`, visible focus rings, at least a 40-pixel hit target, and text labels; color is not the only state indicator.
- Present uses the existing emerald treatment and Absent uses the existing red treatment.
- Avatar images have explicit dimensions and meaningful `alt`; missing avatars use deterministic initials.
- Counts use tabular numerals. Async success/error messages retain the existing live-region behavior.
- Long student names, codes, notes, and recorder identities wrap or truncate without expanding the whole table unexpectedly.

## Data flow and invariants

- TanStack Query remains the server-state owner. Draft attendance remains local transient form state.
- Teacher saves continue through `teacherApi.recordAttendance` and the existing batch endpoint.
- Admin corrections continue through `adminAttendanceApi.correctAttendance` or `correctStudentAttendance` and the existing ADMIN-only endpoint.
- No migration, SQL query, generated database code, or OpenAPI contract change is required.
- The backend continues accepting legacy statuses for historical compatibility and other trusted callers, but the two modified screens never originate them.

## Error handling

- If a save fails, keep draft selections and show the existing error banner.
- Disable editing when Teacher attendance is not currently editable; Admin correction rules remain server-authoritative.
- The Teacher save action appears whenever unrecorded defaults or explicit changes remain unsaved.
- Empty/search-filtered rosters retain a clear empty message and do not render malformed table rows.

## Tests

Teacher component tests must prove:

- an unrecorded student renders Absent selected by default;
- Present and Absent are the only row status controls and only four filters exist;
- saving without marking an unrecorded student submits `absent`;
- clicking Present submits `present`;
- legacy `late`/`excused` rows are projected without becoming dirty automatically.

Admin component tests must prove:

- the roster exposes the requested separate columns;
- only Present and Absent corrections are offered;
- unrecorded students display Absent by default but can explicitly create either status;
- every Admin correction still requires a reason;
- legacy markers render without silently issuing a correction.

Run focused Vitest tests first, then the complete frontend lint, format, typecheck, test, production build, and browser E2E gates. Update `README.md` and `docs/AI_CONTEXT.md` with the new center policy and legacy-data compatibility rule.
