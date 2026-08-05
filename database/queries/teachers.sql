-- Teacher administration queries.

-- name: CreateTeacherProfile :one
INSERT INTO teacher_profiles (
  user_id, teacher_code, full_name, avatar_url, phone, specialization, status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, user_id, teacher_code, full_name, avatar_url, phone, specialization,
  status, created_at, updated_at;

-- name: GetAdminTeacher :one
SELECT
  tp.id, tp.user_id, u.email, u.status AS user_status,
  tp.teacher_code, tp.full_name, tp.avatar_url, tp.phone, tp.specialization,
  tp.status AS teacher_status, tp.created_at, tp.updated_at
FROM teacher_profiles tp
JOIN users u ON u.id = tp.user_id
WHERE tp.id = $1;

-- name: GetTeacherProfileMetrics :one
SELECT
  (SELECT COUNT(*) FROM teacher_assignments ta WHERE ta.teacher_id = sqlc.arg(teacher_id)) AS total_classes,
  (SELECT COUNT(*) FROM teacher_assignments ta
    WHERE ta.teacher_id = sqlc.arg(teacher_id)
      AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)
  ) AS current_classes,
  (SELECT COUNT(*) FROM class_sessions cs
    WHERE cs.teacher_id = sqlc.arg(teacher_id) AND cs.ends_at < NOW() AND cs.status <> 'cancelled'
  ) AS completed_sessions,
  (SELECT COUNT(*) FROM class_sessions cs
    WHERE cs.teacher_id = sqlc.arg(teacher_id) AND cs.starts_at >= NOW() AND cs.status <> 'cancelled'
  ) AS upcoming_sessions;

-- name: ListTeacherClassHistory :many
SELECT
  ta.id AS assignment_id, ta.class_id, c.class_code, c.name AS class_name,
  c.course_id, co.code AS course_code, co.name AS course_name,
  ta.assignment_role, ta.assigned_at,
  EXISTS (
    SELECT 1 FROM teacher_assignment_periods current_period
    WHERE current_period.assignment_id = ta.id AND current_period.ended_at IS NULL
  ) AS is_current,
  (COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', tap.id,
      'started_at', tap.started_at,
      'ended_at', tap.ended_at,
      'start_reason', tap.start_reason,
      'end_reason', tap.end_reason
    ) ORDER BY tap.started_at DESC) FILTER (WHERE tap.id IS NOT NULL),
    '[]'::jsonb
  ))::text AS periods_json
FROM teacher_assignments ta
JOIN classes c ON c.id = ta.class_id
JOIN courses co ON co.id = c.course_id
LEFT JOIN teacher_assignment_periods tap ON tap.assignment_id = ta.id
WHERE ta.teacher_id = sqlc.arg(teacher_id)
GROUP BY ta.id, c.id, co.id
ORDER BY MAX(tap.started_at) DESC NULLS LAST, ta.id DESC
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountTeacherClassHistory :one
SELECT COUNT(*) FROM teacher_assignments WHERE teacher_id = $1;

-- name: ListAdminTeachers :many
SELECT
  tp.id, tp.user_id, u.email, u.status AS user_status,
  tp.teacher_code, tp.full_name, tp.avatar_url, tp.phone, tp.specialization,
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
      AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN classes c ON c.id = ta.class_id
    WHERE ta.teacher_id = tp.id AND c.course_id = sqlc.narg(course_id)::uuid
      AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)
  )
)
AND (
  sqlc.arg(assignment)::text = ''
  OR (sqlc.arg(assignment)::text = 'assigned' AND EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)))
  OR (sqlc.arg(assignment)::text = 'unassigned' AND NOT EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)))
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
      AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM teacher_assignments ta
    JOIN classes c ON c.id = ta.class_id
    WHERE ta.teacher_id = tp.id AND c.course_id = sqlc.narg(course_id)::uuid
      AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)
  )
)
AND (
  sqlc.arg(assignment)::text = ''
  OR (sqlc.arg(assignment)::text = 'assigned' AND EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)))
  OR (sqlc.arg(assignment)::text = 'unassigned' AND NOT EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.teacher_id = tp.id AND EXISTS (SELECT 1 FROM teacher_assignment_periods tap WHERE tap.assignment_id = ta.id AND tap.ended_at IS NULL)))
);

-- name: UpdateTeacherProfile :one
UPDATE teacher_profiles
SET
  teacher_code = $2,
  full_name = $3,
  avatar_url = $4,
  phone = $5,
  specialization = $6,
  status = $7
WHERE id = $1
RETURNING id, user_id, teacher_code, full_name, avatar_url, phone, specialization,
  status, created_at, updated_at;

-- name: GetTeacherWorkloadSummary :many
SELECT
  c.id AS class_id,
  c.class_code,
  c.name AS class_name,
  co.name AS course_name,
  COUNT(cs.id)::bigint AS completed_sessions,
  COUNT(cs.id) FILTER (WHERE cs.status = 'completed')::bigint AS recorded_rollcall_sessions
FROM teacher_assignments ta
JOIN teacher_assignment_periods tap ON tap.assignment_id = ta.id
JOIN classes c ON c.id = ta.class_id
JOIN courses co ON co.id = c.course_id
LEFT JOIN class_sessions cs ON cs.class_id = c.id AND cs.status = 'completed'
WHERE ta.teacher_id = $1
GROUP BY c.id, c.class_code, c.name, co.name
ORDER BY c.created_at DESC;
