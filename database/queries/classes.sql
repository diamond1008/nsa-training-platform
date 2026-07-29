-- Class, enrollment, and teacher-assignment administration queries.

-- name: CreateClass :one
INSERT INTO classes (
  course_id, class_code, name, start_date, end_date, maximum_students, status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, course_id, class_code, name, start_date, end_date,
  maximum_students, status, created_at, updated_at;

-- name: GetAdminClass :one
SELECT
  c.id, c.course_id, co.code AS course_code, co.name AS course_name,
  c.class_code, c.name, c.start_date, c.end_date, c.maximum_students, c.status,
  COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled')::int AS enrolled_students,
  c.created_at, c.updated_at
FROM classes c
JOIN courses co ON co.id = c.course_id
LEFT JOIN class_enrollments ce ON ce.class_id = c.id
WHERE c.id = $1
GROUP BY c.id, co.code, co.name;

-- name: ListAdminClasses :many
SELECT
  c.id, c.course_id, co.code AS course_code, co.name AS course_name,
  c.class_code, c.name, c.start_date, c.end_date, c.maximum_students, c.status,
  COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled')::int AS enrolled_students,
  c.created_at, c.updated_at
FROM classes c
JOIN courses co ON co.id = c.course_id
LEFT JOIN class_enrollments ce ON ce.class_id = c.id
WHERE (
  sqlc.arg(search)::text = ''
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
  OR c.name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR c.status::text = sqlc.arg(status)::text
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR c.course_id = sqlc.narg(course_id)::uuid
)
GROUP BY c.id, co.code, co.name
ORDER BY c.created_at DESC, c.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountAdminClasses :one
SELECT COUNT(*)
FROM classes c
WHERE (
  sqlc.arg(search)::text = ''
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
  OR c.name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR c.status::text = sqlc.arg(status)::text
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR c.course_id = sqlc.narg(course_id)::uuid
);

-- name: ListTeacherClasses :many
SELECT
  c.id, c.course_id, co.code AS course_code, co.name AS course_name,
  c.class_code, c.name, c.start_date, c.end_date, c.maximum_students, c.status,
  COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled')::int AS enrolled_students,
  c.created_at, c.updated_at
FROM classes c
JOIN courses co ON co.id = c.course_id
JOIN teacher_assignments ta ON ta.class_id = c.id
JOIN teacher_profiles tp ON tp.id = ta.teacher_id
LEFT JOIN class_enrollments ce ON ce.class_id = c.id
WHERE tp.user_id = $1
GROUP BY c.id, co.code, co.name
ORDER BY c.start_date DESC, c.class_code;

-- name: UpdateClass :one
UPDATE classes
SET
  course_id = $2,
  class_code = $3,
  name = $4,
  start_date = $5,
  end_date = $6,
  maximum_students = $7,
  status = $8
WHERE id = $1
RETURNING id, course_id, class_code, name, start_date, end_date,
  maximum_students, status, created_at, updated_at;

-- name: CreateClassEnrollment :one
INSERT INTO class_enrollments (class_id, student_id, created_by)
VALUES ($1, $2, $3)
RETURNING id, class_id, student_id, status, enrolled_at, ended_at,
  created_by, created_at, updated_at;

-- name: GetEnrollmentByClassStudent :one
SELECT id
FROM class_enrollments
WHERE class_id = $1 AND student_id = $2;

-- name: GetClassEnrollment :one
SELECT
  ce.id, ce.class_id, ce.student_id, sp.student_code, sp.full_name,
  ce.status, ce.enrolled_at, ce.ended_at, ce.created_by,
  ce.created_at, ce.updated_at
FROM class_enrollments ce
JOIN student_profiles sp ON sp.id = ce.student_id
WHERE ce.id = $1 AND ce.class_id = $2;

-- name: GetClassEnrollmentForUpdate :one
SELECT
  ce.id, ce.class_id, ce.student_id, sp.student_code, sp.full_name,
  ce.status, ce.enrolled_at, ce.ended_at, ce.created_by,
  ce.created_at, ce.updated_at
FROM class_enrollments ce
JOIN student_profiles sp ON sp.id = ce.student_id
WHERE ce.id = $1 AND ce.class_id = $2
FOR UPDATE OF ce;

-- name: ListClassEnrollments :many
SELECT
  ce.id, ce.class_id, ce.student_id, sp.student_code, sp.full_name,
  ce.status, ce.enrolled_at, ce.ended_at, ce.created_by,
  ce.created_at, ce.updated_at
FROM class_enrollments ce
JOIN student_profiles sp ON sp.id = ce.student_id
WHERE ce.class_id = $1
ORDER BY ce.enrolled_at DESC, ce.id;

-- name: UpdateClassEnrollmentStatus :one
UPDATE class_enrollments
SET
  status = $3,
  ended_at = CASE WHEN $3 = 'enrolled'::enrollment_status THEN NULL ELSE NOW() END
WHERE id = $1 AND class_id = $2
RETURNING id, class_id, student_id, status, enrolled_at, ended_at,
  created_by, created_at, updated_at;

-- name: CreateTeacherAssignment :one
INSERT INTO teacher_assignments (
  class_id, teacher_id, assignment_role, assigned_by
)
VALUES ($1, $2, $3, $4)
RETURNING id, class_id, teacher_id, assignment_role, assigned_at,
  assigned_by, created_at, updated_at;

-- name: GetTeacherAssignment :one
SELECT
  ta.id, ta.class_id, ta.teacher_id, tp.teacher_code, tp.full_name,
  ta.assignment_role, ta.assigned_at, ta.assigned_by,
  ta.created_at, ta.updated_at
FROM teacher_assignments ta
JOIN teacher_profiles tp ON tp.id = ta.teacher_id
WHERE ta.id = $1 AND ta.class_id = $2;

-- name: ListTeacherAssignments :many
SELECT
  ta.id, ta.class_id, ta.teacher_id, tp.teacher_code, tp.full_name,
  ta.assignment_role, ta.assigned_at, ta.assigned_by,
  ta.created_at, ta.updated_at
FROM teacher_assignments ta
JOIN teacher_profiles tp ON tp.id = ta.teacher_id
WHERE ta.class_id = $1
ORDER BY ta.assigned_at, ta.id;

-- name: UpdateTeacherAssignment :one
UPDATE teacher_assignments
SET assignment_role = $3
WHERE id = $1 AND class_id = $2
RETURNING id, class_id, teacher_id, assignment_role, assigned_at,
  assigned_by, created_at, updated_at;

-- name: DeleteTeacherAssignment :execrows
DELETE FROM teacher_assignments
WHERE id = $1 AND class_id = $2;

-- name: CreateClassOperationEvent :one
INSERT INTO class_operation_history (
  class_id, event_type, entity_type, entity_id, reason, details, actor_user_id
)
VALUES (
  sqlc.arg(class_id), sqlc.arg(event_type), sqlc.arg(entity_type), sqlc.narg(entity_id),
  sqlc.narg(reason), sqlc.arg(details), sqlc.narg(actor_user_id)
)
RETURNING id, class_id, event_type, entity_type, entity_id, reason,
  details, actor_user_id, occurred_at;

-- name: ListClassOperationHistory :many
SELECT
  coh.id, coh.class_id, coh.event_type, coh.entity_type, coh.entity_id,
  coh.reason, coh.details, coh.actor_user_id, u.email AS actor_email,
  coh.occurred_at
FROM class_operation_history coh
LEFT JOIN users u ON u.id = coh.actor_user_id
WHERE coh.class_id = $1
ORDER BY coh.occurred_at DESC, coh.id DESC;
