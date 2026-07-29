-- Course-completion approval, immutable decisions, and certificates.

-- name: ListCompletionCandidates :many
WITH latest_ratings AS (
  SELECT DISTINCT ON (sa.class_id, sa.student_id, ai.competency_criterion_id)
    sa.class_id, sa.student_id, ai.competency_criterion_id, ai.rating
  FROM student_assessments sa
  JOIN assessment_items ai ON ai.assessment_id = sa.id
  WHERE sa.status IN ('submitted', 'locked')
  ORDER BY sa.class_id, sa.student_id, ai.competency_criterion_id, sa.assessment_no DESC, sa.id DESC
), metrics AS (
  SELECT
    ce.class_id, c.class_code, c.name AS class_name, c.status AS class_status,
    ce.student_id, sp.student_code, sp.full_name AS student_name, sp.user_id AS student_user_id,
    c.course_id, co.code AS course_code, co.name AS course_name,
    co.total_sessions, co.minimum_attendance_pct,
    (SELECT COUNT(*)::int FROM class_sessions cs WHERE cs.class_id = c.id AND cs.status IN ('completed', 'locked')) AS completed_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.class_session_id WHERE ar.class_id = c.id AND ar.student_id = ce.student_id AND cs.status <> 'cancelled') AS attendance_records,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.class_session_id WHERE ar.class_id = c.id AND ar.student_id = ce.student_id AND ar.status IN ('present', 'late') AND cs.status <> 'cancelled') AS attended_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.class_session_id WHERE ar.class_id = c.id AND ar.student_id = ce.student_id AND ar.status = 'excused' AND cs.status <> 'cancelled') AS excused_sessions,
    (SELECT COUNT(*)::int FROM competency_criteria cr WHERE cr.course_id = c.course_id AND cr.is_required) AS required_competencies_total,
    (SELECT COUNT(*)::int FROM latest_ratings lr JOIN competency_criteria cr ON cr.id = lr.competency_criterion_id AND cr.is_required WHERE lr.class_id = c.id AND lr.student_id = ce.student_id AND lr.rating IN ('competent', 'good', 'excellent')) AS required_competencies_met,
    (SELECT COUNT(*)::int FROM class_sessions cs WHERE cs.class_id = c.id AND cs.session_type = 'assessment' AND cs.status <> 'cancelled') AS required_assessments,
    (SELECT COUNT(DISTINCT sa.session_id)::int FROM student_assessments sa JOIN class_sessions cs ON cs.id = sa.session_id WHERE sa.class_id = c.id AND sa.student_id = ce.student_id AND sa.status IN ('submitted', 'locked') AND cs.session_type = 'assessment' AND cs.status <> 'cancelled') AS completed_assessments,
    cp.id AS completion_id, cp.status AS persisted_status, cp.reviewed_by, cp.reviewed_at, cp.review_note
  FROM class_enrollments ce
  JOIN classes c ON c.id = ce.class_id
  JOIN courses co ON co.id = c.course_id
  JOIN student_profiles sp ON sp.id = ce.student_id
  LEFT JOIN course_completions cp ON cp.class_id = ce.class_id AND cp.student_id = ce.student_id
  WHERE ce.status IN ('enrolled','completed')
)
SELECT *,
  CASE WHEN attendance_records - excused_sessions <= 0 THEN 0::numeric(5,2)
       ELSE ROUND(100.0 * attended_sessions / (attendance_records - excused_sessions), 2)::numeric(5,2) END AS attendance_pct,
  (completed_sessions >= total_sessions
   AND (CASE WHEN attendance_records - excused_sessions <= 0 THEN 0
             ELSE 100.0 * attended_sessions / (attendance_records - excused_sessions) END) >= minimum_attendance_pct
   AND required_competencies_met >= required_competencies_total
   AND completed_assessments >= required_assessments) AS is_eligible
FROM metrics
WHERE (sqlc.arg(search)::text = '' OR student_code ILIKE '%' || sqlc.arg(search) || '%' OR student_name ILIKE '%' || sqlc.arg(search) || '%' OR class_code ILIKE '%' || sqlc.arg(search) || '%')
ORDER BY class_code, student_code
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountCompletionCandidates :one
SELECT COUNT(*)
FROM class_enrollments ce
JOIN classes c ON c.id = ce.class_id
JOIN student_profiles sp ON sp.id = ce.student_id
LEFT JOIN course_completions cp ON cp.class_id = ce.class_id AND cp.student_id = ce.student_id
WHERE ce.status IN ('enrolled','completed')
  AND (sqlc.arg(search)::text = '' OR sp.student_code ILIKE '%' || sqlc.arg(search) || '%' OR sp.full_name ILIKE '%' || sqlc.arg(search) || '%' OR c.class_code ILIKE '%' || sqlc.arg(search) || '%')
;

-- name: GetCompletionCandidate :one
WITH latest_ratings AS (
  SELECT DISTINCT ON (sa.class_id, sa.student_id, ai.competency_criterion_id)
    sa.class_id, sa.student_id, ai.competency_criterion_id, ai.rating
  FROM student_assessments sa JOIN assessment_items ai ON ai.assessment_id = sa.id
  WHERE sa.status IN ('submitted', 'locked')
  ORDER BY sa.class_id, sa.student_id, ai.competency_criterion_id, sa.assessment_no DESC, sa.id DESC
), metrics AS (
  SELECT ce.class_id, c.class_code, c.name AS class_name, c.status AS class_status,
    ce.student_id, sp.student_code, sp.full_name AS student_name, sp.user_id AS student_user_id,
    c.course_id, co.code AS course_code, co.name AS course_name, co.total_sessions, co.minimum_attendance_pct,
    (SELECT COUNT(*)::int FROM class_sessions cs WHERE cs.class_id=c.id AND cs.status IN ('completed','locked')) AS completed_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id WHERE ar.class_id=c.id AND ar.student_id=ce.student_id AND cs.status<>'cancelled') AS attendance_records,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id WHERE ar.class_id=c.id AND ar.student_id=ce.student_id AND ar.status IN ('present','late') AND cs.status<>'cancelled') AS attended_sessions,
    (SELECT COUNT(*)::int FROM attendance_records ar JOIN class_sessions cs ON cs.id=ar.class_session_id WHERE ar.class_id=c.id AND ar.student_id=ce.student_id AND ar.status='excused' AND cs.status<>'cancelled') AS excused_sessions,
    (SELECT COUNT(*)::int FROM competency_criteria cr WHERE cr.course_id=c.course_id AND cr.is_required) AS required_competencies_total,
    (SELECT COUNT(*)::int FROM latest_ratings lr JOIN competency_criteria cr ON cr.id=lr.competency_criterion_id AND cr.is_required WHERE lr.class_id=c.id AND lr.student_id=ce.student_id AND lr.rating IN ('competent','good','excellent')) AS required_competencies_met,
    (SELECT COUNT(*)::int FROM class_sessions cs WHERE cs.class_id=c.id AND cs.session_type='assessment' AND cs.status<>'cancelled') AS required_assessments,
    (SELECT COUNT(DISTINCT sa.session_id)::int FROM student_assessments sa JOIN class_sessions cs ON cs.id=sa.session_id WHERE sa.class_id=c.id AND sa.student_id=ce.student_id AND sa.status IN ('submitted','locked') AND cs.session_type='assessment' AND cs.status<>'cancelled') AS completed_assessments,
    cp.id AS completion_id, cp.status AS persisted_status, cp.reviewed_by, cp.reviewed_at, cp.review_note
  FROM class_enrollments ce JOIN classes c ON c.id=ce.class_id JOIN courses co ON co.id=c.course_id JOIN student_profiles sp ON sp.id=ce.student_id
  LEFT JOIN course_completions cp ON cp.class_id=ce.class_id AND cp.student_id=ce.student_id
  WHERE ce.class_id=$1 AND ce.student_id=$2 AND ce.status IN ('enrolled','completed')
)
SELECT *,
  CASE WHEN attendance_records-excused_sessions<=0 THEN 0::numeric(5,2) ELSE ROUND(100.0*attended_sessions/(attendance_records-excused_sessions),2)::numeric(5,2) END AS attendance_pct,
  (completed_sessions>=total_sessions
   AND (CASE WHEN attendance_records-excused_sessions<=0 THEN 0
             ELSE 100.0*attended_sessions/(attendance_records-excused_sessions) END)>=minimum_attendance_pct
   AND required_competencies_met>=required_competencies_total AND completed_assessments>=required_assessments) AS is_eligible
FROM metrics;

-- name: UpsertCourseCompletionDecision :one
INSERT INTO course_completions (class_id, student_id, attendance_pct, required_competencies_met, required_competencies_total, status, reviewed_by, reviewed_at, review_note)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
ON CONFLICT (class_id, student_id) DO UPDATE SET
  attendance_pct=EXCLUDED.attendance_pct, required_competencies_met=EXCLUDED.required_competencies_met,
  required_competencies_total=EXCLUDED.required_competencies_total, status=EXCLUDED.status,
  reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at, review_note=EXCLUDED.review_note
RETURNING *;

-- name: CreateCompletionDecisionHistory :one
INSERT INTO completion_decision_history (completion_id, status, attendance_pct, required_competencies_met, required_competencies_total, note, decided_by)
VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;

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
