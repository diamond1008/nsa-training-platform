-- Phase 5 scheduling and training-location queries.

-- name: CreateTrainingLocation :one
INSERT INTO training_locations (code, name, location_type, capacity, is_active)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, code, name, location_type, capacity, is_active, created_at, updated_at;

-- name: GetTrainingLocation :one
SELECT id, code, name, location_type, capacity, is_active, created_at, updated_at
FROM training_locations
WHERE id = $1;

-- name: ListTrainingLocations :many
SELECT id, code, name, location_type, capacity, is_active, created_at, updated_at
FROM training_locations
WHERE (
  sqlc.arg(search)::text = ''
  OR code ILIKE '%' || sqlc.arg(search) || '%'
  OR name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.narg(is_active)::boolean IS NULL
  OR is_active = sqlc.narg(is_active)::boolean
)
ORDER BY created_at DESC, id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountTrainingLocations :one
SELECT COUNT(*)
FROM training_locations
WHERE (
  sqlc.arg(search)::text = ''
  OR code ILIKE '%' || sqlc.arg(search) || '%'
  OR name ILIKE '%' || sqlc.arg(search) || '%'
)
AND (
  sqlc.narg(is_active)::boolean IS NULL
  OR is_active = sqlc.narg(is_active)::boolean
);

-- name: UpdateTrainingLocation :one
UPDATE training_locations
SET code = $2, name = $3, location_type = $4, capacity = $5, is_active = $6
WHERE id = $1
RETURNING id, code, name, location_type, capacity, is_active, created_at, updated_at;

-- name: CheckTeacherProfileAssignedToClass :one
SELECT EXISTS(
  SELECT 1
  FROM teacher_assignments
  WHERE class_id = $1 AND teacher_id = $2
);

-- name: CreateClassSession :one
INSERT INTO class_sessions (
  class_id, course_id, module_id, teacher_id, location_id,
  title, session_type, starts_at, ends_at, status, created_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, class_id, course_id, module_id, teacher_id, location_id,
  title, session_type, starts_at, ends_at, status, attendance_locked_at,
  created_by, created_at, updated_at;

-- name: GetClassSession :one
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.module_id, cm.code AS module_code, cm.name AS module_name,
  cs.teacher_id, tp.teacher_code, tp.full_name AS teacher_name,
  cs.location_id, tl.code AS location_code, tl.name AS location_name,
  tl.location_type,
  cs.title, cs.session_type, cs.starts_at, cs.ends_at, cs.status,
  cs.attendance_locked_at, cs.created_at, cs.updated_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
LEFT JOIN course_modules cm ON cm.id = cs.module_id
LEFT JOIN teacher_profiles tp ON tp.id = cs.teacher_id
LEFT JOIN training_locations tl ON tl.id = cs.location_id
WHERE cs.id = $1;

-- name: ListAdminSessions :many
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.module_id, cm.code AS module_code, cm.name AS module_name,
  cs.teacher_id, tp.teacher_code, tp.full_name AS teacher_name,
  cs.location_id, tl.code AS location_code, tl.name AS location_name,
  tl.location_type,
  cs.title, cs.session_type, cs.starts_at, cs.ends_at, cs.status,
  cs.attendance_locked_at, cs.created_at, cs.updated_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
LEFT JOIN course_modules cm ON cm.id = cs.module_id
LEFT JOIN teacher_profiles tp ON tp.id = cs.teacher_id
LEFT JOIN training_locations tl ON tl.id = cs.location_id
WHERE (
  sqlc.arg(search)::text = ''
  OR cs.title ILIKE '%' || sqlc.arg(search) || '%'
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
)
AND (sqlc.arg(status)::text = '' OR cs.status::text = sqlc.arg(status)::text)
AND (sqlc.arg(session_type)::text = '' OR cs.session_type::text = sqlc.arg(session_type)::text)
AND (
  sqlc.arg(attendance_state)::text = ''
  OR (sqlc.arg(attendance_state)::text = 'locked' AND (cs.attendance_locked_at IS NOT NULL OR cs.status = 'locked'))
  OR (sqlc.arg(attendance_state)::text = 'unlocked' AND cs.attendance_locked_at IS NULL AND cs.status <> 'locked')
)
AND (sqlc.narg(class_id)::uuid IS NULL OR cs.class_id = sqlc.narg(class_id)::uuid)
AND (sqlc.narg(teacher_id)::uuid IS NULL OR cs.teacher_id = sqlc.narg(teacher_id)::uuid)
AND (sqlc.narg(location_id)::uuid IS NULL OR cs.location_id = sqlc.narg(location_id)::uuid)
AND (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'starts_at' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.starts_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'starts_at' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.starts_at END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'title' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.title END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'title' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.title END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.created_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.created_at END DESC,
  cs.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountAdminSessions :one
SELECT COUNT(*)
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE (
  sqlc.arg(search)::text = ''
  OR cs.title ILIKE '%' || sqlc.arg(search) || '%'
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
)
AND (sqlc.arg(status)::text = '' OR cs.status::text = sqlc.arg(status)::text)
AND (sqlc.arg(session_type)::text = '' OR cs.session_type::text = sqlc.arg(session_type)::text)
AND (
  sqlc.arg(attendance_state)::text = ''
  OR (sqlc.arg(attendance_state)::text = 'locked' AND (cs.attendance_locked_at IS NOT NULL OR cs.status = 'locked'))
  OR (sqlc.arg(attendance_state)::text = 'unlocked' AND cs.attendance_locked_at IS NULL AND cs.status <> 'locked')
)
AND (sqlc.narg(class_id)::uuid IS NULL OR cs.class_id = sqlc.narg(class_id)::uuid)
AND (sqlc.narg(teacher_id)::uuid IS NULL OR cs.teacher_id = sqlc.narg(teacher_id)::uuid)
AND (sqlc.narg(location_id)::uuid IS NULL OR cs.location_id = sqlc.narg(location_id)::uuid)
AND (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz);

-- name: ListTeacherSchedule :many
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.module_id, cm.code AS module_code, cm.name AS module_name,
  cs.teacher_id, tp.teacher_code, tp.full_name AS teacher_name,
  cs.location_id, tl.code AS location_code, tl.name AS location_name,
  tl.location_type,
  cs.title, cs.session_type, cs.starts_at, cs.ends_at, cs.status,
  cs.attendance_locked_at, cs.created_at, cs.updated_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
JOIN teacher_profiles tp ON tp.id = cs.teacher_id AND tp.user_id = sqlc.arg(user_id)
LEFT JOIN course_modules cm ON cm.id = cs.module_id
LEFT JOIN training_locations tl ON tl.id = cs.location_id
WHERE (
  sqlc.arg(search)::text = ''
  OR cs.title ILIKE '%' || sqlc.arg(search) || '%'
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
  OR c.name ILIKE '%' || sqlc.arg(search) || '%'
  OR COALESCE(tl.name, '') ILIKE '%' || sqlc.arg(search) || '%'
)
AND (sqlc.arg(status)::text = '' OR cs.status::text = sqlc.arg(status)::text)
AND (sqlc.arg(session_type)::text = '' OR cs.session_type::text = sqlc.arg(session_type)::text)
AND (
  sqlc.arg(attendance_state)::text = ''
  OR (sqlc.arg(attendance_state)::text = 'locked' AND (cs.attendance_locked_at IS NOT NULL OR cs.status = 'locked'))
  OR (sqlc.arg(attendance_state)::text = 'unlocked' AND cs.attendance_locked_at IS NULL AND cs.status <> 'locked')
)
AND (sqlc.narg(class_id)::uuid IS NULL OR cs.class_id = sqlc.narg(class_id)::uuid)
AND (sqlc.narg(location_id)::uuid IS NULL OR cs.location_id = sqlc.narg(location_id)::uuid)
AND (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'starts_at' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.starts_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'starts_at' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.starts_at END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'title' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.title END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'title' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.title END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'asc' THEN cs.created_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'desc' THEN cs.created_at END DESC,
  cs.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountTeacherSchedule :one
SELECT COUNT(*)
FROM class_sessions cs
JOIN teacher_profiles tp ON tp.id = cs.teacher_id AND tp.user_id = sqlc.arg(user_id)
JOIN classes c ON c.id = cs.class_id
LEFT JOIN training_locations tl ON tl.id = cs.location_id
WHERE (
  sqlc.arg(search)::text = ''
  OR cs.title ILIKE '%' || sqlc.arg(search) || '%'
  OR c.class_code ILIKE '%' || sqlc.arg(search) || '%'
  OR c.name ILIKE '%' || sqlc.arg(search) || '%'
  OR COALESCE(tl.name, '') ILIKE '%' || sqlc.arg(search) || '%'
)
AND (sqlc.arg(status)::text = '' OR cs.status::text = sqlc.arg(status)::text)
AND (sqlc.arg(session_type)::text = '' OR cs.session_type::text = sqlc.arg(session_type)::text)
AND (
  sqlc.arg(attendance_state)::text = ''
  OR (sqlc.arg(attendance_state)::text = 'locked' AND (cs.attendance_locked_at IS NOT NULL OR cs.status = 'locked'))
  OR (sqlc.arg(attendance_state)::text = 'unlocked' AND cs.attendance_locked_at IS NULL AND cs.status <> 'locked')
)
AND (sqlc.narg(class_id)::uuid IS NULL OR cs.class_id = sqlc.narg(class_id)::uuid)
AND (sqlc.narg(location_id)::uuid IS NULL OR cs.location_id = sqlc.narg(location_id)::uuid)
AND (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz);

-- name: ListStudentSchedule :many
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.module_id, cm.code AS module_code, cm.name AS module_name,
  cs.teacher_id, tp.teacher_code, tp.full_name AS teacher_name,
  cs.location_id, tl.code AS location_code, tl.name AS location_name,
  tl.location_type,
  cs.title, cs.session_type, cs.starts_at, cs.ends_at, cs.status,
  cs.attendance_locked_at, cs.created_at, cs.updated_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
JOIN class_enrollments ce ON ce.class_id = cs.class_id
  AND EXISTS (
    SELECT 1 FROM class_enrollment_periods cep
    WHERE cep.enrollment_id = ce.id
      AND cep.started_at <= cs.starts_at
      AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
  )
JOIN student_profiles sp ON sp.id = ce.student_id AND sp.user_id = sqlc.arg(user_id)
LEFT JOIN course_modules cm ON cm.id = cs.module_id
LEFT JOIN teacher_profiles tp ON tp.id = cs.teacher_id
LEFT JOIN training_locations tl ON tl.id = cs.location_id
WHERE (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz)
ORDER BY cs.starts_at, cs.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountStudentSchedule :one
SELECT COUNT(*)
FROM class_sessions cs
JOIN class_enrollments ce ON ce.class_id = cs.class_id
  AND EXISTS (
    SELECT 1 FROM class_enrollment_periods cep
    WHERE cep.enrollment_id = ce.id
      AND cep.started_at <= cs.starts_at
      AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
  )
JOIN student_profiles sp ON sp.id = ce.student_id AND sp.user_id = sqlc.arg(user_id)
WHERE (sqlc.narg(from_time)::timestamptz IS NULL OR cs.ends_at > sqlc.narg(from_time)::timestamptz)
AND (sqlc.narg(to_time)::timestamptz IS NULL OR cs.starts_at < sqlc.narg(to_time)::timestamptz);

-- name: UpdateClassSession :one
UPDATE class_sessions
SET
  class_id = $2,
  course_id = $3,
  module_id = $4,
  teacher_id = $5,
  location_id = $6,
  title = $7,
  session_type = $8,
  starts_at = $9,
  ends_at = $10,
  status = $11
WHERE id = $1
RETURNING id, class_id, course_id, module_id, teacher_id, location_id,
  title, session_type, starts_at, ends_at, status, attendance_locked_at,
  created_by, created_at, updated_at;
