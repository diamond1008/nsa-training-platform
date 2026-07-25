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
ORDER BY tp.created_at DESC, tp.id
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
