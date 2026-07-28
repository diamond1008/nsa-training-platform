-- Student administration queries.

-- name: CreateStudentProfile :one
INSERT INTO student_profiles (
  user_id, student_code, full_name, phone, date_of_birth, gender, address,
  emergency_contact_name, emergency_contact_phone, status, enrolled_at
)
VALUES (
  sqlc.arg(user_id),
  COALESCE(NULLIF(sqlc.arg(student_code)::text, ''), 'HV' || lpad(nextval('student_code_seq')::text, 5, '0')),
  sqlc.arg(full_name), sqlc.narg(phone), sqlc.narg(date_of_birth), sqlc.narg(gender),
  sqlc.narg(address), sqlc.narg(emergency_contact_name), sqlc.narg(emergency_contact_phone),
  sqlc.arg(status), sqlc.narg(enrolled_at)
)
RETURNING id, user_id, student_code, full_name, phone, date_of_birth, gender, address,
  emergency_contact_name, emergency_contact_phone, status, enrolled_at, created_at, updated_at;

-- name: GetAdminStudent :one
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.phone, sp.date_of_birth, sp.gender, sp.address,
  sp.emergency_contact_name, sp.emergency_contact_phone,
  sp.status AS student_status, sp.enrolled_at, sp.created_at, sp.updated_at
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE sp.id = $1;

-- name: ListAdminStudents :many
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.phone, sp.date_of_birth, sp.gender, sp.address,
  sp.emergency_contact_name, sp.emergency_contact_phone,
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

-- name: ExportAdminStudents :many
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.phone, sp.date_of_birth, sp.gender, sp.address,
  sp.emergency_contact_name, sp.emergency_contact_phone,
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
ORDER BY sp.student_code, sp.id;

-- name: UpdateStudentProfile :one
UPDATE student_profiles
SET
  full_name = sqlc.arg(full_name),
  phone = sqlc.narg(phone),
  date_of_birth = sqlc.narg(date_of_birth),
  gender = sqlc.narg(gender),
  address = sqlc.narg(address),
  emergency_contact_name = sqlc.narg(emergency_contact_name),
  emergency_contact_phone = sqlc.narg(emergency_contact_phone),
  status = sqlc.arg(status),
  enrolled_at = sqlc.narg(enrolled_at)
WHERE id = sqlc.arg(id)
RETURNING id, user_id, student_code, full_name, phone, date_of_birth, gender, address,
  emergency_contact_name, emergency_contact_phone, status, enrolled_at, created_at, updated_at;

-- name: CreateStudentStatusHistory :one
INSERT INTO student_status_history (
  student_id, from_status, to_status, reason, changed_by
)
VALUES (
  sqlc.arg(student_id), sqlc.narg(from_status), sqlc.arg(to_status),
  sqlc.arg(reason), sqlc.narg(changed_by)
)
RETURNING id, student_id, from_status, to_status, reason, changed_by, changed_at;

-- name: ListStudentStatusHistory :many
SELECT
  ssh.id, ssh.student_id, ssh.from_status, ssh.to_status, ssh.reason,
  ssh.changed_by, u.email AS changed_by_email, ssh.changed_at
FROM student_status_history ssh
LEFT JOIN users u ON u.id = ssh.changed_by
WHERE ssh.student_id = $1
ORDER BY ssh.changed_at DESC, ssh.id DESC;
