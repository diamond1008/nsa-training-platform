-- Student administration queries.

-- name: CreateStudentProfile :one
INSERT INTO student_profiles (
  user_id, student_code, full_name, phone, date_of_birth, status, enrolled_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, user_id, student_code, full_name, phone, date_of_birth,
  status, enrolled_at, created_at, updated_at;

-- name: GetAdminStudent :one
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.phone, sp.date_of_birth,
  sp.status AS student_status, sp.enrolled_at, sp.created_at, sp.updated_at
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE sp.id = $1;

-- name: ListAdminStudents :many
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.phone, sp.date_of_birth,
  sp.status AS student_status, sp.enrolled_at, sp.created_at, sp.updated_at
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE (
  sqlc.arg(search)::text = ''
  OR sp.student_code ILIKE '%' || sqlc.arg(search) || '%'
  OR sp.full_name ILIKE '%' || sqlc.arg(search) || '%'
  OR u.email ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR sp.status::text = sqlc.arg(status)::text
)
ORDER BY sp.created_at DESC, sp.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountAdminStudents :one
SELECT COUNT(*)
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE (
  sqlc.arg(search)::text = ''
  OR sp.student_code ILIKE '%' || sqlc.arg(search) || '%'
  OR sp.full_name ILIKE '%' || sqlc.arg(search) || '%'
  OR u.email ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.arg(status)::text = ''
  OR sp.status::text = sqlc.arg(status)::text
);

-- name: UpdateStudentProfile :one
UPDATE student_profiles
SET
  student_code = $2,
  full_name = $3,
  phone = $4,
  date_of_birth = $5,
  status = $6,
  enrolled_at = $7
WHERE id = $1
RETURNING id, user_id, student_code, full_name, phone, date_of_birth,
  status, enrolled_at, created_at, updated_at;
