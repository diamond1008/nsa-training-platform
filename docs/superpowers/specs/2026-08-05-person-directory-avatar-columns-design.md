# Person Directory Identity Columns Design

**Date:** 2026-08-05  
**Status:** Approved in conversation; pending implementation  
**Scope:** Admin Student and Teacher directories

## Goal

Make the Student and Teacher management tables begin with the same identity columns used by attendance:

`STT | Mã | Avatar | Tên`

Keep all existing directory filters, actions, business columns, responsive behavior, and the current visual system.

## Data model

- Keep the existing `student_profiles.avatar_url` behavior unchanged.
- Add nullable `avatar_url TEXT` to `teacher_profiles` in a new Goose migration.
- Do not rewrite an applied migration and do not move avatars to `users`.
- Continue storing the project-standard compressed WebP data URL. Object storage is outside this change.

## API and validation

- Add optional `avatar_url` to Admin Teacher create, update, detail, and list contracts.
- Reuse the Student avatar boundary: accept only a structurally valid WebP data URL no larger than 256 KiB.
- Preserve `null` as the no-avatar state.
- Redact image data from audit payloads; never write the full data URL to logs or audit history.
- Update SQL sources first and regenerate sqlc output; generated files are never edited by hand.
- Update the OpenAPI Teacher schemas and requests to match the implementation.

## Frontend behavior

### Shared identity columns

Both Admin directories use this leading order:

1. `STT`
2. `Mã`
3. `Avatar`
4. `Tên`

Existing columns such as Email, Contact, Status, and Actions follow these identity columns without changing their behavior.

### Sequence number

STT is pagination-aware:

`(page - 1) * per_page + row_index + 1`

The first row on page 2 therefore continues after the last row on page 1.

### Avatar rendering

- Render a 36 × 36 circular image with explicit width and height.
- Use the person's initials when no avatar exists.
- Student rows keep using `student.avatar_url`.
- Teacher rows use the new `teacher.avatar_url`.
- Keep table overflow and the existing mobile directory presentation; do not redesign the page shell or visual system.

### Teacher form

- Reuse the Student avatar upload experience in the Teacher create/edit form.
- Accept an image file, compress it to the existing 400 × 400 WebP representation, preview it, and allow removal before save.
- Show inline errors for invalid or oversized input.
- Do not add a second compression or validation implementation when the existing shared helper can be reused.

## Error handling

- API validation errors use the repository's existing JSON error envelope.
- The form keeps the selected image state when an unrelated submission error occurs.
- A failed image conversion shows an actionable inline error and does not submit an invalid payload.
- Existing records with `avatar_url = null` remain valid and render initials.

## Verification

- Migration up/down/up and database integration checks.
- sqlc generation with no unexplained generated diff.
- Teacher API tests for create, update, list/detail, null removal, invalid format, and size limit.
- React tests for pagination-aware STT, shared column order, teacher preview/removal, and initials fallback.
- Frontend lint, typecheck, format, unit tests, and production build.
- OpenAPI lint and full `make check`.
- Browser smoke test for Student and Teacher directories at desktop and mobile widths.

## Out of scope

- No object-storage service or third-party media provider.
- No avatar crop editor.
- No change to authentication profile avatars or navigation avatars.
- No visual redesign outside the requested directory columns and Teacher avatar form.
