-- Teacher administration queries.

-- name: CreateTeacherProfile :one
INSERT INTO teacher_profiles (
  user_id, teacher_code, full_name, phone, specialization, status
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, teacher_code, full_name, phone, specialization,
  status, created_at, updated_at;

-- name: GetAdminTeacher :one
SELECT
  tp.id, tp.user_id, u.email, u.status AS user_status,
  tp.teacher_code, tp.full_name, tp.phone, tp.specialization,
  tp.status AS teacher_status, tp.created_at, tp.updated_at
FROM teacher_profiles tp
JOIN users u ON u.id = tp.user_id
WHERE tp.id = $1;

-- name: ListAdminTeachers :many
SELECT
  tp.id, tp.user_id, u.email, u.status AS user_status,
  tp.teacher_code, tp.full_name, tp.phone, tp.specialization,
  tp.status AS teacher_status, tp.created_at, tp.updated_at
FROM teacher_profiles tp
JOIN users u ON u.id = tp.user_id
WHERE (
  sqlc.arg(search)::text = ''
  OR tp.teacher_code ILIKE '%' || sqlc.arg(search) || '%'
  OR tp.full_name ILIKE '%' || sqlc.arg(search) || '%'
  OR u.email ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR tp.status::text = sqlc.arg(status)::text
)
AND (
  sqlc.narg(class_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    WHERE ta.teacher_id = tp.id AND ta.class_id = sqlc.narg(class_id)::uuid
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN classes c ON c.id = ta.class_id
    WHERE ta.teacher_id = tp.id AND c.course_id = sqlc.narg(course_id)::uuid
  )
)
AND (
  sqlc.arg(assignment)::text = ''
  OR (sqlc.arg(assignment)::text = 'assigned' AND EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id))
  OR (sqlc.arg(assignment)::text = 'unassigned' AND NOT EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id))
)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'teacher_code' AND sqlc.arg(sort_order)::text = 'asc' THEN tp.teacher_code END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'teacher_code' AND sqlc.arg(sort_order)::text = 'desc' THEN tp.teacher_code END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'full_name' AND sqlc.arg(sort_order)::text = 'asc' THEN tp.full_name END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'full_name' AND sqlc.arg(sort_order)::text = 'desc' THEN tp.full_name END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'asc' THEN tp.created_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'desc' THEN tp.created_at END DESC,
  tp.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountAdminTeachers :one
SELECT COUNT(*)
FROM teacher_profiles tp
JOIN users u ON u.id = tp.user_id
WHERE (
  sqlc.arg(search)::text = ''
  OR tp.teacher_code ILIKE '%' || sqlc.arg(search) || '%'
  OR tp.full_name ILIKE '%' || sqlc.arg(search) || '%'
  OR u.email ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR tp.status::text = sqlc.arg(status)::text
)
AND (
  sqlc.narg(class_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    WHERE ta.teacher_id = tp.id AND ta.class_id = sqlc.narg(class_id)::uuid
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN classes c ON c.id = ta.class_id
    WHERE ta.teacher_id = tp.id AND c.course_id = sqlc.narg(course_id)::uuid
  )
)
AND (
  sqlc.arg(assignment)::text = ''
  OR (sqlc.arg(assignment)::text = 'assigned' AND EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id))
  OR (sqlc.arg(assignment)::text = 'unassigned' AND NOT EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id))
);

-- name: UpdateTeacherProfile :one
UPDATE teacher_profiles
SET
  teacher_code = $2,
  full_name = $3,
  phone = $4,
  specialization = $5,
  status = $6
WHERE id = $1
RETURNING id, user_id, teacher_code, full_name, phone, specialization,
  status, created_at, updated_at;
