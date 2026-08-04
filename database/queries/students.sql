-- Student administration queries.

-- name: CreateStudentProfile :one
INSERT INTO student_profiles (
  user_id, student_code, full_name, avatar_url, phone, date_of_birth, gender, address,
  emergency_contact_name, emergency_contact_phone, status, enrolled_at
)
VALUES (
  sqlc.arg(user_id),
  COALESCE(NULLIF(sqlc.arg(student_code)::text, ''), 'HV' || lpad(nextval('student_code_seq')::text, 8, '0')),
  sqlc.arg(full_name), sqlc.narg(avatar_url), sqlc.narg(phone), sqlc.narg(date_of_birth), sqlc.narg(gender),
  sqlc.narg(address), sqlc.narg(emergency_contact_name), sqlc.narg(emergency_contact_phone),
  sqlc.arg(status), sqlc.narg(enrolled_at)
)
RETURNING id, user_id, student_code, full_name, avatar_url, phone, date_of_birth, gender, address,
  emergency_contact_name, emergency_contact_phone, status, enrolled_at, created_at, updated_at;

-- name: GetAdminStudent :one
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.avatar_url, sp.phone, sp.date_of_birth, sp.gender, sp.address,
  sp.emergency_contact_name, sp.emergency_contact_phone,
  sp.status AS student_status, sp.enrolled_at, sp.created_at, sp.updated_at
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id
WHERE sp.id = $1;

-- name: ListAdminStudents :many
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.avatar_url, sp.phone, sp.date_of_birth, sp.gender, sp.address,
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
AND (
  sqlc.narg(class_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    WHERE ce.student_id = sp.id AND ce.class_id = sqlc.narg(class_id)::uuid
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN classes c ON c.id = ce.class_id
    WHERE ce.student_id = sp.id AND c.course_id = sqlc.narg(course_id)::uuid
  )
)
AND (
  sqlc.arg(attendance_risk)::text = ''
  OR (
    sqlc.arg(attendance_risk)::text = 'at_risk'
    AND EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
  OR (
    sqlc.arg(attendance_risk)::text = 'on_track'
    AND NOT EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
)
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'student_code' AND sqlc.arg(sort_order)::text = 'asc' THEN sp.student_code END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'student_code' AND sqlc.arg(sort_order)::text = 'desc' THEN sp.student_code END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'full_name' AND sqlc.arg(sort_order)::text = 'asc' THEN sp.full_name END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'full_name' AND sqlc.arg(sort_order)::text = 'desc' THEN sp.full_name END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'asc' THEN sp.created_at END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'created_at' AND sqlc.arg(sort_order)::text = 'desc' THEN sp.created_at END DESC,
  sp.id
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
)
AND (
  sqlc.narg(class_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    WHERE ce.student_id = sp.id AND ce.class_id = sqlc.narg(class_id)::uuid
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN classes c ON c.id = ce.class_id
    WHERE ce.student_id = sp.id AND c.course_id = sqlc.narg(course_id)::uuid
  )
)
AND (
  sqlc.arg(attendance_risk)::text = ''
  OR (
    sqlc.arg(attendance_risk)::text = 'at_risk'
    AND EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
  OR (
    sqlc.arg(attendance_risk)::text = 'on_track'
    AND NOT EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
);

-- name: ExportAdminStudents :many
SELECT
  sp.id, sp.user_id, u.email, u.status AS user_status,
  sp.student_code, sp.full_name, sp.avatar_url, sp.phone, sp.date_of_birth, sp.gender, sp.address,
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
AND (
  sqlc.narg(class_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    WHERE ce.student_id = sp.id AND ce.class_id = sqlc.narg(class_id)::uuid
  )
)
AND (
  sqlc.narg(course_id)::uuid IS NULL
  OR EXISTS (
    SELECT 1 FROM class_enrollments ce
    JOIN classes c ON c.id = ce.class_id
    WHERE ce.student_id = sp.id AND c.course_id = sqlc.narg(course_id)::uuid
  )
)
AND (
  sqlc.arg(attendance_risk)::text = ''
  OR (
    sqlc.arg(attendance_risk)::text = 'at_risk'
    AND EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
  OR (
    sqlc.arg(attendance_risk)::text = 'on_track'
    AND NOT EXISTS (
      SELECT 1
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN courses co ON co.id = c.course_id
      JOIN class_sessions cs ON cs.class_id = ce.class_id AND cs.status <> 'cancelled'
      JOIN attendance_records ar
        ON ar.class_session_id = cs.id AND ar.student_id = sp.id
      WHERE ce.student_id = sp.id
        AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id = sqlc.narg(class_id)::uuid)
        AND (sqlc.narg(course_id)::uuid IS NULL OR c.course_id = sqlc.narg(course_id)::uuid)
      GROUP BY ce.class_id, co.minimum_attendance_pct
      HAVING COUNT(*) FILTER (WHERE ar.status <> 'excused') > 0
        AND 100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
          / COUNT(*) FILTER (WHERE ar.status <> 'excused') < co.minimum_attendance_pct
    )
  )
)
ORDER BY sp.student_code, sp.id;

-- name: UpdateStudentProfile :one
UPDATE student_profiles
SET
  full_name = sqlc.arg(full_name),
  avatar_url = sqlc.narg(avatar_url),
  phone = sqlc.narg(phone),
  date_of_birth = sqlc.narg(date_of_birth),
  gender = sqlc.narg(gender),
  address = sqlc.narg(address),
  emergency_contact_name = sqlc.narg(emergency_contact_name),
  emergency_contact_phone = sqlc.narg(emergency_contact_phone),
  status = sqlc.arg(status),
  enrolled_at = sqlc.narg(enrolled_at)
WHERE id = sqlc.arg(id)
RETURNING id, user_id, student_code, full_name, avatar_url, phone, date_of_birth, gender, address,
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
