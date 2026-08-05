# Person Directory Avatar Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Admin Student and Teacher directories the shared leading columns `STT | Mã | Avatar | Tên` and persist validated Teacher avatars with the existing Student WebP behavior.

**Architecture:** Add an optional Teacher profile field through a new Goose migration, sqlc queries, the Teacher service/handler, and the additive REST contract. Extract the WebP boundary rules into a small platform helper used by both Student and Teacher modules, then reuse the existing browser compression helper and add pagination-aware row indices to the shared table cell contract.

**Tech Stack:** PostgreSQL 16, Goose, sqlc, Go 1.22/Chi/pgx, React 18/Vite, TanStack Query, Tailwind, Vitest/RTL, Playwright.

## Global Constraints

- Preserve the current visual system and existing directory filters/actions.
- Accept only a structurally valid WebP data URL whose decoded body is at most 256 KiB.
- Redact stored image data from audit payloads and logs.
- Keep `avatar_url` optional and backward compatible.
- Edit SQL sources and run `sqlc generate`; never hand-edit `database/generated`.
- Add migration `00010`; never rewrite an applied migration.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Shared avatar boundary and Teacher schema

**Files:**
- Create: `apps/api/internal/platform/avatar/avatar.go`
- Create: `apps/api/internal/platform/avatar/avatar_test.go`
- Create: `database/migrations/00010_add_teacher_avatar_url.sql`
- Modify: `database/queries/teachers.sql`
- Modify: `apps/api/internal/students/handler.go`
- Regenerate: `database/generated/*`

**Interfaces:**
- Produces: `avatar.NormalizeWebPDataURL(value *string) (*string, bool)` and `avatar.Redact(value *string) *string`.
- Produces: nullable `teacher_profiles.avatar_url` in create/get/list/update sqlc rows.

- [ ] Write table-driven tests proving nil/blank normalization, valid RIFF/WEBP acceptance, SVG rejection, malformed Base64 rejection, decoded payload limit enforcement, and non-mutating redaction.
- [ ] Run `cd apps/api && go test ./internal/platform/avatar` and verify RED because the package does not exist.
- [ ] Implement the helper with `base64.StdEncoding.DecodeString`, RIFF/WEBP magic checks, and a 256 KiB decoded cap.
- [ ] Replace Student's local avatar validation/redaction constants with the shared helper while keeping its existing error message.
- [ ] Add Goose migration:

```sql
-- +goose Up
ALTER TABLE teacher_profiles ADD COLUMN avatar_url TEXT;
-- +goose Down
ALTER TABLE teacher_profiles DROP COLUMN IF EXISTS avatar_url;
```

- [ ] Add `avatar_url` to Teacher insert/returning/get/list/update SQL projections and parameters.
- [ ] Run `sqlc generate`, `gofmt` the Go changes, and rerun the avatar and Student handler tests.

### Task 2: Teacher API validation, persistence, and audit redaction

**Files:**
- Modify: `apps/api/internal/teachers/handler.go`
- Modify: `apps/api/internal/teachers/handler_test.go`
- Modify: `apps/api/internal/teachers/service.go`
- Create: `apps/api/internal/teachers/teachers_integration_test.go`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Teacher `View` and write request gain `avatar_url?: string | null`.
- Create/update accept `null` to clear the avatar and return the stored value on create/get/list/update.

- [ ] Add failing handler tests for valid WebP acceptance, non-WebP rejection, oversize rejection, blank-to-null normalization, and audit redaction that leaves the response view unchanged.
- [ ] Run `cd apps/api && go test ./internal/teachers` and verify RED because Teacher requests do not carry avatars.
- [ ] Add `AvatarURL *string` through handler request, `WriteInput`, `View`, create/update sqlc params, and row-to-view mappings.
- [ ] Call the shared avatar boundary from `validateWrite`; return the established `avatar_url must be a WebP data URL no larger than 256 KiB` message.
- [ ] Redact both before/after Teacher audit snapshots using `auditTeacherView`.
- [ ] Add a DB integration test that creates a Teacher with an avatar, verifies get/list, clears it on update, and confirms the DB result is null.
- [ ] Extend OpenAPI Teacher schemas and create/update requests with nullable `avatar_url` plus the WebP/256 KiB description.
- [ ] Run Teacher unit tests and OpenAPI lint.

### Task 3: Pagination-aware STT and shared directory identity rendering

**Files:**
- Modify: `apps/web/src/components/data.tsx`
- Modify: `apps/web/src/components/data.test.tsx`
- Create: `apps/web/src/features/admin/PersonDirectoryIdentity.tsx`
- Create: `apps/web/src/features/admin/PersonDirectoryIdentity.test.tsx`
- Modify: `apps/web/src/lib/domainTypes.ts`

**Interfaces:**
- `DataTable` column cells receive `(item, rowIndex)`; existing one-argument cells remain source compatible.
- `Teacher.avatar_url?: string | null`.
- Produces `PersonAvatar` with explicit 36 × 36 dimensions and initials fallback.
- Produces `directoryRowNumber(page, perPage, rowIndex): number`.

- [ ] Add a failing DataTable test whose cell renders `rowIndex + 1` and assert the second row renders `2` in desktop/mobile semantics.
- [ ] Add failing identity tests for page 2/per-page 20/index 0 returning 21, real avatar rendering with width/height, and initials fallback.
- [ ] Run focused Vitest files and verify RED.
- [ ] Pass the item index from both DataTable render paths.
- [ ] Implement the small identity helper/component using semantic image alt text and no new dependency.
- [ ] Add optional Teacher `avatar_url` to the frontend contract and rerun focused tests.

### Task 4: Student/Teacher directory columns and Teacher upload form

**Files:**
- Modify: `apps/web/src/features/admin/AdminPages.tsx`
- Create: `apps/web/src/features/admin/PersonDirectory.test.tsx`

**Interfaces:**
- Both directory tables start with `STT`, `Mã`, `Avatar`, `Tên`.
- Teacher form sends `avatar_url`, reusing `compressImageToWebP(file, 400, 400, 0.82)`.

- [ ] Add failing directory tests for exact leading column order, pagination-aware STT, Student avatar rendering, Teacher initials fallback, Teacher image preview/removal, and Teacher submit payload.
- [ ] Run `npm run test -- --run src/features/admin/PersonDirectory.test.tsx` and verify RED.
- [ ] Replace the Student-only Avatar column with the four shared identity columns in the approved order.
- [ ] Initialize form avatar state from either Student or Teacher, include `avatar_url` in both submit payloads, and show the existing upload/preview/remove block for both roles with role-specific Vietnamese copy.
- [ ] Preserve all remaining columns, sorting, actions, filters, pagination, and mobile DataTable behavior.
- [ ] Rerun the focused frontend tests until GREEN.

### Task 5: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/AI_CONTEXT.md`
- Modify: `database/schema.dbml`

- [ ] Document the shared directory identity columns, Teacher avatar storage/validation, and migration 00010.
- [ ] Update DBML `teacher_profiles` with nullable `avatar_url`.
- [ ] Run `sqlc generate` and confirm no unexplained generated changes.
- [ ] Run `make db-test-migrate` then `make api-test-integration`.
- [ ] Run `make check`.
- [ ] Run `npx --yes @redocly/cli@latest lint docs/openapi.yaml`.
- [ ] Run migration up/down/up on the local DB and confirm `avatar_url` survives the final up.
- [ ] Smoke-test `/admin/hoc-vien` and `/admin/giang-vien` at desktop and 390 px mobile widths, checking column order, avatar preview, fallback initials, and no page-level horizontal overflow.
- [ ] Run `git diff --check` and review the final diff without committing or pushing.
