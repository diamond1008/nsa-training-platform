-- Deterministic Student progress inputs. Business percentages and eligibility
-- are calculated in Go from these integer/decimal components.

-- name: ListStudentProgressInputs :many
WITH latest_required_ratings AS (
  SELECT DISTINCT ON (sa.class_id, sa.student_id, ai.competency_criterion_id)
    sa.class_id,
    sa.student_id,
    ai.competency_criterion_id,
    ai.rating
  FROM student_assessments sa
  JOIN assessment_items ai ON ai.assessment_id = sa.id
  JOIN competency_criteria cc
    ON cc.id = ai.competency_criterion_id
    AND cc.is_required
  WHERE sa.status IN ('submitted', 'locked')
  ORDER BY
    sa.class_id,
    sa.student_id,
    ai.competency_criterion_id,
    sa.assessment_no DESC,
    sa.id DESC
)
SELECT
  ce.class_id, c.class_code, c.name AS class_name, c.status AS class_status,
  ce.status AS enrollment_status,
  c.course_id, co.code AS course_code, co.name AS course_name,
  co.total_sessions, co.minimum_attendance_pct,
  (
    SELECT COUNT(*)::int
    FROM class_sessions cs
    WHERE cs.class_id = c.id
      AND cs.status IN ('completed', 'locked')
  ) AS completed_sessions,
  (
    SELECT COUNT(*)::int
    FROM attendance_records ar
    JOIN class_sessions attendance_session ON attendance_session.id = ar.class_session_id
    WHERE ar.class_id = c.id
      AND ar.student_id = ce.student_id
      AND attendance_session.status <> 'cancelled'
  ) AS attendance_records,
  (
    SELECT COUNT(*)::int
    FROM attendance_records ar
    JOIN class_sessions attendance_session ON attendance_session.id = ar.class_session_id
    WHERE ar.class_id = c.id
      AND ar.student_id = ce.student_id
      AND ar.status IN ('present', 'late')
      AND attendance_session.status <> 'cancelled'
  ) AS attended_sessions,
  (
    SELECT COUNT(*)::int
    FROM attendance_records ar
    JOIN class_sessions attendance_session ON attendance_session.id = ar.class_session_id
    WHERE ar.class_id = c.id
      AND ar.student_id = ce.student_id
      AND ar.status = 'excused'
      AND attendance_session.status <> 'cancelled'
  ) AS excused_sessions,
  (
    SELECT COUNT(*)::int
    FROM competency_criteria cc
    WHERE cc.course_id = c.course_id
      AND cc.is_required
  ) AS required_competencies,
  (
    SELECT COUNT(*)::int
    FROM latest_required_ratings lrr
    WHERE lrr.class_id = c.id
      AND lrr.student_id = ce.student_id
      AND lrr.rating IN ('competent', 'good', 'excellent')
  ) AS competencies_met,
  (
    SELECT COUNT(*)::int
    FROM class_sessions cs
    WHERE cs.class_id = c.id
      AND cs.session_type = 'assessment'
      AND cs.status <> 'cancelled'
  ) AS required_assessments,
  (
    SELECT COUNT(DISTINCT sa.session_id)::int
    FROM student_assessments sa
    JOIN class_sessions cs ON cs.id = sa.session_id
    WHERE sa.class_id = c.id
      AND sa.student_id = ce.student_id
      AND sa.status IN ('submitted', 'locked')
      AND cs.session_type = 'assessment'
      AND cs.status <> 'cancelled'
  ) AS completed_assessments
FROM class_enrollments ce
JOIN student_profiles sp ON sp.id = ce.student_id
JOIN classes c ON c.id = ce.class_id
JOIN courses co ON co.id = c.course_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR ce.class_id = sqlc.narg(class_id)::uuid
  )
ORDER BY c.start_date DESC, c.id;
