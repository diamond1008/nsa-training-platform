-- Course, module, and competency administration queries.

-- name: CreateCourse :one
INSERT INTO courses (
  code, name, description, total_sessions, minimum_attendance_pct, status
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, code, name, description, total_sessions,
  minimum_attendance_pct, status, created_at, updated_at;

-- name: GetCourse :one
SELECT id, code, name, description, total_sessions, minimum_attendance_pct,
  status, created_at, updated_at
FROM courses
WHERE id = $1;

-- name: ListCourses :many
SELECT id, code, name, description, total_sessions, minimum_attendance_pct,
  status, created_at, updated_at
FROM courses
WHERE (
  sqlc.arg(search)::text = ''
  OR code ILIKE '%' || sqlc.arg(search) || '%'
  OR name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR status::text = sqlc.arg(status)::text
)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'code' AND sqlc.arg(sort_order)::text = 'asc' THEN code END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'code' AND sqlc.arg(sort_order)::text = 'desc' THEN code END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'name' AND sqlc.arg(sort_order)::text = 'asc' THEN name END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'name' AND sqlc.arg(sort_order)::text = 'desc' THEN name END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'asc' THEN created_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'desc' THEN created_at END DESC,
  id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountCourses :one
SELECT COUNT(*)
FROM courses
WHERE (
  sqlc.arg(search)::text = ''
  OR code ILIKE '%' || sqlc.arg(search) || '%'
  OR name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR status::text = sqlc.arg(status)::text
);

-- name: UpdateCourse :one
UPDATE courses
SET
  code = $2,
  name = $3,
  description = $4,
  total_sessions = $5,
  minimum_attendance_pct = $6,
  status = $7
WHERE id = $1
RETURNING id, code, name, description, total_sessions,
  minimum_attendance_pct, status, created_at, updated_at;

-- name: CreateCourseModule :one
INSERT INTO course_modules (
  course_id, code, name, sequence_no, planned_sessions, description
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, course_id, code, name, sequence_no, planned_sessions,
  description, created_at, updated_at;

-- name: GetCourseModule :one
SELECT id, course_id, code, name, sequence_no, planned_sessions,
  description, created_at, updated_at
FROM course_modules
WHERE id = $1 AND course_id = $2;

-- name: ListCourseModules :many
SELECT id, course_id, code, name, sequence_no, planned_sessions,
  description, created_at, updated_at
FROM course_modules
WHERE course_id = $1
ORDER BY sequence_no, id;

-- name: UpdateCourseModule :one
UPDATE course_modules
SET
  code = $3,
  name = $4,
  sequence_no = $5,
  planned_sessions = $6,
  description = $7
WHERE id = $1 AND course_id = $2
RETURNING id, course_id, code, name, sequence_no, planned_sessions,
  description, created_at, updated_at;

-- name: CreateCompetencyCriterion :one
INSERT INTO competency_criteria (
  course_id, module_id, code, name, description, is_required, sequence_no
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, course_id, module_id, code, name, description, is_required,
  sequence_no, created_at, updated_at;

-- name: GetCompetencyCriterion :one
SELECT id, course_id, module_id, code, name, description, is_required,
  sequence_no, created_at, updated_at
FROM competency_criteria
WHERE id = $1 AND course_id = $2;

-- name: ListCompetencyCriteria :many
SELECT id, course_id, module_id, code, name, description, is_required,
  sequence_no, created_at, updated_at
FROM competency_criteria
WHERE course_id = $1
ORDER BY sequence_no, id;

-- name: UpdateCompetencyCriterion :one
UPDATE competency_criteria
SET
  module_id = $3,
  code = $4,
  name = $5,
  description = $6,
  is_required = $7,
  sequence_no = $8
WHERE id = $1 AND course_id = $2
RETURNING id, course_id, module_id, code, name, description, is_required,
  sequence_no, created_at, updated_at;
