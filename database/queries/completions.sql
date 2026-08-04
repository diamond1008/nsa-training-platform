-- Course-completion approval, immutable decisions, and certificates.

-- name: ListCompletionCandidates :many
WITH candidate_enrollments AS (
  SELECT DISTINCT ON (ce.student_id,c.course_id)
    ce.class_id,ce.student_id,ce.status AS enrollment_status,ce.enrolled_at,
    c.course_id,c.class_code,c.name AS class_name,c.status AS class_status,
    co.code AS course_code,co.name AS course_name,co.total_sessions,co.minimum_attendance_pct
  FROM class_enrollments ce JOIN classes c ON c.id=ce.class_id JOIN courses co ON co.id=c.course_id
  WHERE ce.status IN ('enrolled','completed')
  ORDER BY ce.student_id,c.course_id,CASE WHEN ce.status='enrolled' THEN 0 ELSE 1 END,ce.enrolled_at DESC
), latest_ratings AS (
  SELECT DISTINCT ON (sa.student_id,sa.course_id,ai.competency_criterion_id)
    sa.student_id,sa.course_id,ai.competency_criterion_id,ai.rating
  FROM student_assessments sa JOIN assessment_items ai ON ai.assessment_id=sa.id
  WHERE sa.status IN ('submitted','locked')
  ORDER BY sa.student_id,sa.course_id,ai.competency_criterion_id,sa.updated_at DESC,sa.id DESC
), metrics AS (
  SELECT
    ce.class_id, ce.class_code, ce.class_name, ce.class_status,
    ce.student_id, sp.student_code, sp.full_name AS student_name, sp.user_id AS student_user_id,
    ce.course_id,ce.course_code,ce.course_name,ce.total_sessions,ce.minimum_attendance_pct,
    (SELECT COUNT(DISTINCT cs.id)::int FROM class_sessions cs JOIN classes c2 ON c2.id=cs.class_id JOIN class_enrollments ce2 ON ce2.class_id=c2.id AND ce2.student_id=ce.student_id WHERE c2.course_id=ce.course_id AND cs.status IN ('completed','locked')) AS completed_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND cs.status<>'cancelled') AS attendance_records,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status IN ('present','late') AND cs.status<>'cancelled') AS attended_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status='excused' AND cs.status<>'cancelled') AS excused_sessions,
    (SELECT COUNT(*)::int FROM competency_criteria cr WHERE cr.course_id=ce.course_id AND cr.is_required) AS required_competencies_total,
    (SELECT COUNT(*)::int FROM latest_ratings lr JOIN competency_criteria cr ON cr.id=lr.competency_criterion_id AND cr.is_required WHERE lr.course_id=ce.course_id AND lr.student_id=ce.student_id AND lr.rating IN ('competent','good','excellent')) AS required_competencies_met,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active) AS required_tests_total,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active AND EXISTS (SELECT 1 FROM student_test_attempts sta WHERE sta.test_id=ct.id AND sta.student_id=ce.student_id AND sta.score>=ct.pass_score)) AS required_tests_passed,
    (SELECT MAX(sta.score)::numeric(4,2) FROM student_test_attempts sta JOIN course_tests ct ON ct.id=sta.test_id WHERE sta.course_id=ce.course_id AND sta.student_id=ce.student_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_score,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_count,
    (SELECT COUNT(*)::int FROM class_sessions cs JOIN classes c2 ON c2.id=cs.class_id WHERE c2.course_id=ce.course_id AND cs.session_type='assessment' AND cs.status<>'cancelled') AS required_assessments,
    (SELECT COUNT(DISTINCT sa.session_id)::int FROM student_assessments sa JOIN class_sessions cs ON cs.id=sa.session_id WHERE sa.course_id=ce.course_id AND sa.student_id=ce.student_id AND sa.status IN ('submitted','locked') AND cs.session_type='assessment' AND cs.status<>'cancelled') AS completed_assessments,
    cp.id AS completion_id,cp.status AS persisted_status,cp.reviewed_by,cp.reviewed_at,cp.review_note,
    (SELECT cert.id FROM certificates cert WHERE cert.completion_id=cp.id AND cert.is_current) AS current_certificate_id,
    COALESCE((SELECT cert.certificate_number FROM certificates cert WHERE cert.completion_id=cp.id AND cert.is_current),'')::text AS current_certificate_number
  FROM candidate_enrollments ce
  JOIN student_profiles sp ON sp.id = ce.student_id
  LEFT JOIN course_completions cp ON cp.course_id=ce.course_id AND cp.student_id=ce.student_id
)
SELECT *,
  CASE WHEN attendance_records - excused_sessions <= 0 THEN 0::numeric(5,2)
       ELSE ROUND(100.0 * attended_sessions / (attendance_records - excused_sessions), 2)::numeric(5,2) END AS attendance_pct,
  COALESCE(((CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
             ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
   AND required_tests_passed >= required_tests_total
   AND final_exam_count=1 AND final_exam_score>5), FALSE)::boolean AS is_eligible
FROM metrics
WHERE (sqlc.arg(search)::text = '' OR student_code ILIKE '%' || sqlc.arg(search) || '%' OR student_name ILIKE '%' || sqlc.arg(search) || '%' OR class_code ILIKE '%' || sqlc.arg(search) || '%')
  AND (sqlc.narg(course_id)::uuid IS NULL OR course_id = sqlc.narg(course_id)::uuid)
  AND (sqlc.narg(class_id)::uuid IS NULL OR class_id = sqlc.narg(class_id)::uuid)
  AND (
    sqlc.arg(eligibility)::text = ''
    OR (
      sqlc.arg(eligibility)::text = 'eligible'
      AND COALESCE(((CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
                ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
      AND required_tests_passed >= required_tests_total
      AND final_exam_count = 1 AND final_exam_score > 5), FALSE)
    )
    OR (
      sqlc.arg(eligibility)::text = 'ineligible'
      AND NOT COALESCE((
        (CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
              ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
        AND required_tests_passed >= required_tests_total
        AND final_exam_count = 1 AND final_exam_score > 5
      ), FALSE)
    )
  )
ORDER BY
  CASE WHEN sqlc.arg(sort_by)::text = 'class_code' AND sqlc.arg(sort_order)::text = 'asc' THEN class_code END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'class_code' AND sqlc.arg(sort_order)::text = 'desc' THEN class_code END DESC,
  CASE WHEN sqlc.arg(sort_by)::text = 'student_code' AND sqlc.arg(sort_order)::text = 'asc' THEN student_code END ASC,
  CASE WHEN sqlc.arg(sort_by)::text = 'student_code' AND sqlc.arg(sort_order)::text = 'desc' THEN student_code END DESC,
  class_id, student_id
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountCompletionCandidates :one
WITH candidate_enrollments AS (
  SELECT DISTINCT ON (ce.student_id,c.course_id)
    ce.class_id, ce.student_id, c.course_id, c.class_code,
    co.minimum_attendance_pct
  FROM class_enrollments ce
  JOIN classes c ON c.id=ce.class_id
  JOIN courses co ON co.id=c.course_id
  WHERE ce.status IN ('enrolled','completed')
  ORDER BY ce.student_id,c.course_id,CASE WHEN ce.status='enrolled' THEN 0 ELSE 1 END,ce.enrolled_at DESC
), metrics AS (
  SELECT
    ce.class_id, ce.class_code, ce.student_id, sp.student_code, sp.full_name AS student_name,
    ce.course_id, ce.minimum_attendance_pct,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND cs.status<>'cancelled') AS attendance_records,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status IN ('present','late') AND cs.status<>'cancelled') AS attended_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=ce.course_id AND ar.student_id=ce.student_id AND ar.status='excused' AND cs.status<>'cancelled') AS excused_sessions,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active) AS required_tests_total,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active AND EXISTS (SELECT 1 FROM student_test_attempts sta WHERE sta.test_id=ct.id AND sta.student_id=ce.student_id AND sta.score>=ct.pass_score)) AS required_tests_passed,
    (SELECT MAX(sta.score)::numeric(4,2) FROM student_test_attempts sta JOIN course_tests ct ON ct.id=sta.test_id WHERE sta.course_id=ce.course_id AND sta.student_id=ce.student_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_score,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=ce.course_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_count
  FROM candidate_enrollments ce
  JOIN student_profiles sp ON sp.id=ce.student_id
)
SELECT COUNT(*)
FROM metrics
WHERE (sqlc.arg(search)::text = '' OR student_code ILIKE '%' || sqlc.arg(search) || '%' OR student_name ILIKE '%' || sqlc.arg(search) || '%' OR class_code ILIKE '%' || sqlc.arg(search) || '%')
  AND (sqlc.narg(course_id)::uuid IS NULL OR course_id = sqlc.narg(course_id)::uuid)
  AND (sqlc.narg(class_id)::uuid IS NULL OR class_id = sqlc.narg(class_id)::uuid)
  AND (
    sqlc.arg(eligibility)::text = ''
    OR (
      sqlc.arg(eligibility)::text = 'eligible'
      AND COALESCE(((CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
                ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
      AND required_tests_passed >= required_tests_total
      AND final_exam_count = 1 AND final_exam_score > 5), FALSE)
    )
    OR (
      sqlc.arg(eligibility)::text = 'ineligible'
      AND NOT COALESCE((
        (CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
              ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
        AND required_tests_passed >= required_tests_total
        AND final_exam_count = 1 AND final_exam_score > 5
      ), FALSE)
    )
  );

-- name: GetCompletionCandidate :one
WITH latest_ratings AS (
  SELECT DISTINCT ON (sa.student_id,sa.course_id,ai.competency_criterion_id)
    sa.student_id,sa.course_id,ai.competency_criterion_id,ai.rating
  FROM student_assessments sa JOIN assessment_items ai ON ai.assessment_id=sa.id
  WHERE sa.status IN ('submitted', 'locked')
  ORDER BY sa.student_id,sa.course_id,ai.competency_criterion_id,sa.updated_at DESC,sa.id DESC
), metrics AS (
  SELECT ce.class_id, c.class_code, c.name AS class_name, c.status AS class_status,
    ce.student_id, sp.student_code, sp.full_name AS student_name, sp.user_id AS student_user_id,
    c.course_id, co.code AS course_code, co.name AS course_name, co.total_sessions, co.minimum_attendance_pct,
    (SELECT COUNT(DISTINCT cs.id)::int FROM class_sessions cs JOIN classes c2 ON c2.id=cs.class_id JOIN class_enrollments ce2 ON ce2.class_id=c2.id AND ce2.student_id=ce.student_id WHERE c2.course_id=c.course_id AND cs.status IN ('completed','locked')) AS completed_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=c.course_id AND ar.student_id=ce.student_id AND cs.status<>'cancelled') AS attendance_records,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=c.course_id AND ar.student_id=ce.student_id AND ar.status IN ('present','late') AND cs.status<>'cancelled') AS attended_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id JOIN classes c2 ON c2.id=ar.class_id WHERE c2.course_id=c.course_id AND ar.student_id=ce.student_id AND ar.status='excused' AND cs.status<>'cancelled') AS excused_sessions,
    (SELECT COUNT(*)::int FROM competency_criteria cr WHERE cr.course_id=c.course_id AND cr.is_required) AS required_competencies_total,
    (SELECT COUNT(*)::int FROM latest_ratings lr JOIN competency_criteria cr ON cr.id=lr.competency_criterion_id AND cr.is_required WHERE lr.course_id=c.course_id AND lr.student_id=ce.student_id AND lr.rating IN ('competent','good','excellent')) AS required_competencies_met,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=c.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active) AS required_tests_total,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=c.course_id AND ct.kind='class_test' AND ct.is_required AND ct.is_active AND EXISTS (SELECT 1 FROM student_test_attempts sta WHERE sta.test_id=ct.id AND sta.student_id=ce.student_id AND sta.score>=ct.pass_score)) AS required_tests_passed,
    (SELECT MAX(sta.score)::numeric(4,2) FROM student_test_attempts sta JOIN course_tests ct ON ct.id=sta.test_id WHERE sta.course_id=c.course_id AND sta.student_id=ce.student_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_score,
    (SELECT COUNT(*)::int FROM course_tests ct WHERE ct.course_id=c.course_id AND ct.kind='final_exam' AND ct.is_active) AS final_exam_count,
    (SELECT COUNT(*)::int FROM class_sessions cs WHERE cs.class_id=c.id AND cs.session_type='assessment' AND cs.status<>'cancelled') AS required_assessments,
    (SELECT COUNT(DISTINCT sa.session_id)::int FROM student_assessments sa JOIN class_sessions cs ON cs.id=sa.session_id WHERE sa.class_id=c.id AND sa.student_id=ce.student_id AND sa.status IN ('submitted','locked') AND cs.session_type='assessment' AND cs.status<>'cancelled') AS completed_assessments,
    cp.id AS completion_id, cp.status AS persisted_status, cp.reviewed_by, cp.reviewed_at, cp.review_note,
    (SELECT cert.id FROM certificates cert WHERE cert.completion_id=cp.id AND cert.is_current) AS current_certificate_id,
    COALESCE((SELECT cert.certificate_number FROM certificates cert WHERE cert.completion_id=cp.id AND cert.is_current),'')::text AS current_certificate_number
  FROM class_enrollments ce JOIN classes c ON c.id=ce.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=ce.student_id
  LEFT JOIN course_completions cp ON cp.course_id=c.course_id AND cp.student_id=ce.student_id
  WHERE ce.class_id=$1 AND ce.student_id=$2 AND ce.status IN ('enrolled','completed')
)
SELECT *,
  CASE WHEN attendance_records-excused_sessions<=0 THEN 0::numeric(5,2) ELSE ROUND(100.0*attended_sessions/(attendance_records-excused_sessions),2)::numeric(5,2) END AS attendance_pct,
  COALESCE(((CASE WHEN attendance_records-excused_sessions<=0 THEN 0
             ELSE 100.0*attended_sessions/(attendance_records-excused_sessions) END)>=minimum_attendance_pct
   AND required_tests_passed>=required_tests_total
   AND final_exam_count=1 AND final_exam_score>5), FALSE)::boolean AS is_eligible
FROM metrics;

-- name: UpsertCourseCompletionDecision :one
INSERT INTO course_completions (class_id,course_id,student_id,attendance_pct,required_competencies_met,required_competencies_total,required_tests_passed,required_tests_total,final_exam_score,status,reviewed_by,reviewed_at,review_note)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)
ON CONFLICT (student_id,course_id) DO UPDATE SET
  class_id=EXCLUDED.class_id,
  attendance_pct=EXCLUDED.attendance_pct, required_competencies_met=EXCLUDED.required_competencies_met,
  required_competencies_total=EXCLUDED.required_competencies_total,
  required_tests_passed=EXCLUDED.required_tests_passed,required_tests_total=EXCLUDED.required_tests_total,final_exam_score=EXCLUDED.final_exam_score,status=EXCLUDED.status,
  reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at, review_note=EXCLUDED.review_note
RETURNING *;

-- name: CreateCompletionDecisionHistory :one
INSERT INTO completion_decision_history (completion_id,status,attendance_pct,required_competencies_met,required_competencies_total,required_tests_passed,required_tests_total,final_exam_score,note,decided_by)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *;

-- name: CreateCertificate :one
INSERT INTO certificates (completion_id, issued_by) VALUES ($1,$2) RETURNING *;

-- name: GetCurrentCertificateByCompletion :one
SELECT * FROM certificates WHERE completion_id=$1 AND is_current;

-- name: RevokeCurrentCertificate :one
UPDATE certificates SET is_current=FALSE, revoked_at=NOW(), revoked_by=$2, revoke_reason=$3
WHERE completion_id=$1 AND is_current RETURNING *;

-- name: GetCertificateDetail :one
SELECT cert.*, cp.class_id, cp.student_id, c.class_code, c.name AS class_name,
  co.code AS course_code, co.name AS course_name, sp.student_code, sp.full_name AS student_name
FROM certificates cert JOIN course_completions cp ON cp.id=cert.completion_id
JOIN classes c ON c.id=cp.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=cp.student_id
WHERE cert.id=$1;

-- name: GetCertificateByVerificationCode :one
SELECT cert.*, cp.class_id, cp.student_id, c.class_code, c.name AS class_name,
  co.code AS course_code, co.name AS course_name, sp.student_code, sp.full_name AS student_name
FROM certificates cert JOIN course_completions cp ON cp.id=cert.completion_id
JOIN classes c ON c.id=cp.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=cp.student_id
WHERE cert.verification_code=$1;

-- name: ListStudentCertificates :many
SELECT cert.*, cp.class_id, cp.student_id, c.class_code, c.name AS class_name,
  co.code AS course_code, co.name AS course_name, sp.student_code, sp.full_name AS student_name
FROM certificates cert JOIN course_completions cp ON cp.id=cert.completion_id
JOIN classes c ON c.id=cp.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=cp.student_id
WHERE sp.user_id=$1 ORDER BY cert.issued_at DESC;

-- name: GetStudentCertificate :one
SELECT cert.*, cp.class_id, cp.student_id, c.class_code, c.name AS class_name,
  co.code AS course_code, co.name AS course_name, sp.student_code, sp.full_name AS student_name
FROM certificates cert JOIN course_completions cp ON cp.id=cert.completion_id
JOIN classes c ON c.id=cp.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=cp.student_id
WHERE cert.id=$1 AND sp.user_id=$2;

-- name: ListCompletionDecisionHistory :many
SELECT cdh.*, u.email AS decided_by_email
FROM completion_decision_history cdh
JOIN course_completions cp ON cp.id=cdh.completion_id
JOIN users u ON u.id=cdh.decided_by
WHERE cp.class_id=$1 AND cp.student_id=$2
ORDER BY cdh.decided_at DESC, cdh.id DESC;
