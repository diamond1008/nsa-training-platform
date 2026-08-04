-- Attendance recording, correction, locking, and Student self-service queries.

-- name: GetAttendanceSession :one
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.title, cs.starts_at, cs.ends_at, cs.status, cs.attendance_locked_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
WHERE cs.id = $1;

-- name: GetAttendanceSessionForUpdate :one
SELECT
  cs.id, cs.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.title, cs.starts_at, cs.ends_at, cs.status, cs.attendance_locked_at
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN courses co ON co.id = cs.course_id
WHERE cs.id = $1
FOR UPDATE OF cs;

-- name: ListSessionAttendanceRoster :many
SELECT
  ce.student_id, sp.student_code, sp.full_name, sp.avatar_url,
  ce.status AS enrollment_status,
  ar.id AS attendance_id, ar.status AS attendance_status, ar.note,
  ar.recorded_by, recorder.email AS recorded_by_email,
  ar.recorded_at, ar.updated_at
FROM class_sessions cs
JOIN class_enrollments ce
  ON ce.class_id = cs.class_id
  AND EXISTS (
    SELECT 1 FROM class_enrollment_periods cep
    WHERE cep.enrollment_id = ce.id
      AND cep.started_at <= cs.starts_at
      AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
  )
JOIN student_profiles sp ON sp.id = ce.student_id
LEFT JOIN attendance_records ar
  ON ar.class_session_id = cs.id
  AND ar.student_id = ce.student_id
LEFT JOIN users recorder ON recorder.id = ar.recorded_by
WHERE cs.id = $1
ORDER BY sp.student_code, ce.student_id;

-- name: CheckEnrollmentForSession :one
SELECT EXISTS(
  SELECT 1
  FROM class_sessions cs
  JOIN class_enrollments ce
    ON ce.class_id = cs.class_id
    AND ce.student_id = sqlc.arg(student_id)
    AND EXISTS (
      SELECT 1 FROM class_enrollment_periods cep
      WHERE cep.enrollment_id = ce.id
        AND cep.started_at <= cs.starts_at
        AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
    )
  WHERE cs.id = sqlc.arg(session_id)
);

-- name: UpsertAttendanceRecord :one
INSERT INTO attendance_records (
  class_session_id, class_id, student_id, status, note, recorded_by
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (class_session_id, student_id) DO UPDATE
SET status = EXCLUDED.status,
    note = EXCLUDED.note,
    recorded_by = EXCLUDED.recorded_by,
    updated_at = NOW()
RETURNING id, class_session_id, class_id, student_id, status, note,
  recorded_by, recorded_at, updated_at;

-- name: CheckStudentEnrolledInSession :one
SELECT EXISTS(
  SELECT 1
  FROM class_sessions cs
  JOIN class_enrollments ce
    ON ce.class_id = cs.class_id
    AND EXISTS (
      SELECT 1 FROM class_enrollment_periods cep
      WHERE cep.enrollment_id = ce.id
        AND cep.started_at <= cs.starts_at
        AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
    )
  JOIN student_profiles sp ON sp.id = ce.student_id
  WHERE cs.id = sqlc.arg(session_id)
    AND sp.user_id = sqlc.arg(user_id)
);

-- Missing students become absent when the Vietnamese calendar day ends.
-- The assigned teacher is the recorder; created_by/admin is the fallback.
-- name: AutoFillExpiredAttendance :execrows
INSERT INTO attendance_records (
  class_session_id, class_id, student_id, status, note, recorded_by
)
SELECT
  cs.id,
  cs.class_id,
  ce.student_id,
  'absent',
  'Tự động ghi vắng khi hết ngày điểm danh',
  COALESCE(
    tp.user_id,
    cs.created_by,
    (
      SELECT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.code = 'ADMIN'
      WHERE u.status = 'active'
      ORDER BY u.created_at, u.id
      LIMIT 1
    )
  )
FROM class_sessions cs
JOIN class_enrollments ce
  ON ce.class_id = cs.class_id
  AND EXISTS (
    SELECT 1 FROM class_enrollment_periods cep
    WHERE cep.enrollment_id = ce.id
      AND cep.started_at <= cs.starts_at
      AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
  )
LEFT JOIN teacher_profiles tp ON tp.id = cs.teacher_id
WHERE cs.ends_at < sqlc.arg(cutoff)
  AND cs.status IN ('scheduled', 'completed')
  AND cs.attendance_locked_at IS NULL
  AND COALESCE(
    tp.user_id,
    cs.created_by,
    (
      SELECT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.code = 'ADMIN'
      WHERE u.status = 'active'
      ORDER BY u.created_at, u.id
      LIMIT 1
    )
  ) IS NOT NULL
ON CONFLICT (class_session_id, student_id) DO NOTHING;

-- name: AutoLockExpiredAttendanceSessions :execrows
UPDATE class_sessions cs
SET status = 'locked', attendance_locked_at = sqlc.arg(cutoff)
WHERE cs.ends_at < sqlc.arg(cutoff)
  AND cs.status IN ('scheduled', 'completed')
  AND cs.attendance_locked_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM class_enrollments ce
    LEFT JOIN attendance_records ar
      ON ar.class_session_id = cs.id
      AND ar.student_id = ce.student_id
    WHERE ce.class_id = cs.class_id
      AND EXISTS (
        SELECT 1 FROM class_enrollment_periods cep
        WHERE cep.enrollment_id = ce.id
          AND cep.started_at <= cs.starts_at
          AND (cep.ended_at IS NULL OR cep.ended_at > cs.starts_at)
      )
      AND ar.id IS NULL
  );

-- name: GetAttendanceRecordForUpdate :one
SELECT
  ar.id, ar.class_session_id, ar.class_id, ar.student_id,
  sp.student_code, sp.full_name, ar.status, ar.note,
  ar.recorded_by, ar.recorded_at, ar.updated_at
FROM attendance_records ar
JOIN student_profiles sp ON sp.id = ar.student_id
WHERE ar.id = $1
FOR UPDATE OF ar;

-- name: CorrectAttendanceRecord :one
UPDATE attendance_records
SET status = $2, note = $3
WHERE id = $1
RETURNING id, class_session_id, class_id, student_id, status, note,
  recorded_by, recorded_at, updated_at;

-- name: ListStudentAttendance :many
SELECT
  ar.id, ar.class_session_id, ar.class_id,
  c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  cs.title AS session_title, cs.starts_at, cs.ends_at,
  ar.status, ar.note, ar.recorded_at, ar.updated_at
FROM attendance_records ar
JOIN student_profiles sp ON sp.id = ar.student_id
JOIN class_sessions cs ON cs.id = ar.class_session_id
JOIN classes c ON c.id = ar.class_id
JOIN courses co ON co.id = cs.course_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR ar.class_id = sqlc.narg(class_id)::uuid
  )
ORDER BY cs.starts_at DESC, ar.id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountStudentAttendance :one
SELECT COUNT(*)
FROM attendance_records ar
JOIN student_profiles sp ON sp.id = ar.student_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR ar.class_id = sqlc.narg(class_id)::uuid
  );

-- name: ListStudentAttendanceSummaries :many
SELECT
  ar.class_id, c.class_code, c.name AS class_name,
  cs.course_id, co.code AS course_code, co.name AS course_name,
  co.minimum_attendance_pct,
  COUNT(*)::int AS recorded_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'late')::int AS late_sessions,
  COUNT(*) FILTER (WHERE ar.status = 'excused')::int AS excused_sessions,
  (
    CASE
      WHEN COUNT(*) FILTER (WHERE ar.status <> 'excused') = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))
        / COUNT(*) FILTER (WHERE ar.status <> 'excused'),
        2
      )
    END
  )::numeric(5,2) AS attendance_pct
FROM attendance_records ar
JOIN student_profiles sp ON sp.id = ar.student_id
JOIN class_sessions cs ON cs.id = ar.class_session_id
JOIN classes c ON c.id = ar.class_id
JOIN courses co ON co.id = cs.course_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR ar.class_id = sqlc.narg(class_id)::uuid
  )
GROUP BY ar.class_id, c.class_code, c.name, cs.course_id, co.code, co.name, co.minimum_attendance_pct
ORDER BY c.class_code, ar.class_id;
