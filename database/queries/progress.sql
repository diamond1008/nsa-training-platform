-- Phase 17 Student progress aggregated across every class enrollment in the same course.

-- name: ListStudentProgressInputs :many
WITH candidate_enrollments AS (
  SELECT DISTINCT ON (ce.student_id,c.course_id)
    ce.class_id,ce.student_id,ce.status AS enrollment_status,ce.enrolled_at,
    c.course_id,c.class_code,c.name AS class_name,c.status AS class_status,
    co.code AS course_code,co.name AS course_name,co.total_sessions,co.minimum_attendance_pct
  FROM student_profiles sp
  JOIN class_enrollments ce ON ce.student_id=sp.id
  JOIN classes c ON c.id=ce.class_id
  JOIN courses co ON co.id=c.course_id
  WHERE sp.user_id=sqlc.arg(user_id)
    AND (sqlc.narg(class_id)::uuid IS NULL OR ce.class_id=sqlc.narg(class_id)::uuid)
  ORDER BY ce.student_id,c.course_id,CASE WHEN ce.status='enrolled' THEN 0 ELSE 1 END,ce.enrolled_at DESC
), latest_required_ratings AS (
  SELECT DISTINCT ON (sa.student_id,sa.course_id,ai.competency_criterion_id)
    sa.student_id,sa.course_id,ai.competency_criterion_id,ai.rating
  FROM student_assessments sa
  JOIN assessment_items ai ON ai.assessment_id=sa.id
  JOIN competency_criteria cc ON cc.id=ai.competency_criterion_id AND cc.is_required
  WHERE sa.status IN ('submitted','locked')
  ORDER BY sa.student_id,sa.course_id,ai.competency_criterion_id,sa.updated_at DESC,sa.id DESC
)
SELECT
  ce.class_id,ce.class_code,ce.class_name,ce.class_status,ce.enrollment_status,
  ce.course_id,ce.course_code,ce.course_name,ce.total_sessions,ce.minimum_attendance_pct,
  (SELECT COUNT(DISTINCT cs.id)::int FROM class_sessions cs JOIN classes c2 ON c2.id=cs.class_id JOIN class_enrollments ce2 ON ce2.class_id=c2.id AND ce2.student_id=ce.student_id WHERE c2.course_id=ce.course_id AND cs.status IN ('completed','locked')) AS completed_sessions,
  (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND cs.status<>'cancelled') AS attendance_records,
  (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status IN ('present','late') AND cs.status<>'cancelled') AS attended_sessions,
  (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status='excused' AND cs.status<>'cancelled') AS excused_sessions,
  (SELECT COUNT(*)::int FROM competency_criteria cc WHERE cc.course_id=ce.course_id AND cc.is_required) AS required_competencies,
  (SELECT COUNT(*)::int FROM latest_required_ratings lrr WHERE lrr.course_id=ce.course_id AND lrr.student_id=ce.student_id AND lrr.rating IN ('competent','good','excellent')) AS competencies_met,
  (SELECT COUNT(*)::int FROM class_sessions cs JOIN classes c2 ON c2.id=cs.class_id WHERE c2.course_id=ce.course_id AND cs.session_type='assessment' AND cs.status<>'cancelled') AS required_assessments,
  (SELECT COUNT(DISTINCT sa.session_id)::int FROM student_assessments sa JOIN class_sessions cs ON cs.id=sa.session_id WHERE sa.course_id=ce.course_id AND sa.student_id=ce.student_id AND sa.status IN ('submitted','locked') AND cs.session_type='assessment' AND cs.status<>'cancelled') AS completed_assessments,
  (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active) AS required_tests,
  (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active AND EXISTS (SELECT 1 FROM student_test_attempts sta WHERE sta.test_id=ct.id AND sta.student_id=ce.student_id AND sta.score>=ct.pass_score)) AS tests_passed,
  (SELECT MAX(sta.score)::numeric(4,2) FROM student_test_attempts sta JOIN course_tests ct ON ct.id=sta.test_id WHERE sta.course_id=ce.course_id AND sta.student_id=ce.student_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_score,
  (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_count,
  cp.status AS persisted_completion_status
FROM candidate_enrollments ce
LEFT JOIN course_completions cp ON cp.course_id=ce.course_id AND cp.student_id=ce.student_id
ORDER BY ce.enrolled_at DESC,ce.course_id;
