-- Practical skill assessment lifecycle and role-scoped history.

-- name: GetAssessmentStudentUserID :one
SELECT user_id FROM student_profiles WHERE id=$1;

-- name: GetAssessmentEnrollmentForUpdate :one
SELECT
  ce.class_id, c.course_id, c.class_code, c.name AS class_name,
  co.code AS course_code, co.name AS course_name,
  ce.student_id, sp.student_code, sp.full_name,
  ce.status AS enrollment_status
FROM class_enrollments ce
JOIN classes c ON c.id = ce.class_id
JOIN courses co ON co.id = c.course_id
JOIN student_profiles sp ON sp.id = ce.student_id
WHERE ce.class_id = $1 AND ce.student_id = $2
FOR UPDATE OF ce;

-- name: GetAssignedAssessmentTeacher :one
SELECT tp.id, tp.teacher_code, tp.full_name
FROM teacher_assignments ta
JOIN teacher_profiles tp ON tp.id = ta.teacher_id
JOIN users u ON u.id = tp.user_id
WHERE ta.class_id = $1
  AND tp.user_id = $2
  AND tp.status = 'active'
  AND u.status = 'active';

-- name: CheckAssessmentSession :one
SELECT EXISTS(
  SELECT 1
  FROM class_sessions
  WHERE id = $1
    AND class_id = $2
    AND course_id = $3
    AND status <> 'cancelled'
);

-- name: GetNextAssessmentNumber :one
SELECT COALESCE(MAX(assessment_no), 0)::int + 1
FROM student_assessments
WHERE class_id = $1 AND student_id = $2;

-- name: CreateStudentAssessment :one
INSERT INTO student_assessments (
  class_id, course_id, student_id, assessed_by, session_id,
  assessment_no, status, overall_comment, evidence_url
)
VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
RETURNING id, class_id, course_id, student_id, assessed_by, session_id,
  assessment_no, status, overall_comment, evidence_url, submitted_at, locked_at,
  created_at, updated_at;

-- name: GetAssessmentHeader :one
SELECT
  sa.id, sa.class_id, c.class_code, c.name AS class_name,
  sa.course_id, co.code AS course_code, co.name AS course_name,
  sa.student_id, sp.student_code, sp.full_name AS student_name,
  sa.assessed_by, tp.teacher_code, tp.full_name AS teacher_name,
  sa.session_id, cs.title AS session_title,
  sa.assessment_no, sa.status, sa.overall_comment, sa.evidence_url,
  sa.submitted_at, sa.locked_at, sa.created_at, sa.updated_at
FROM student_assessments sa
JOIN classes c ON c.id = sa.class_id
JOIN courses co ON co.id = sa.course_id
JOIN student_profiles sp ON sp.id = sa.student_id
JOIN teacher_profiles tp ON tp.id = sa.assessed_by
LEFT JOIN class_sessions cs ON cs.id = sa.session_id
WHERE sa.id = $1;

-- name: GetAssessmentHeaderForUpdate :one
SELECT
  sa.id, sa.class_id, c.class_code, c.name AS class_name,
  sa.course_id, co.code AS course_code, co.name AS course_name,
  sa.student_id, sp.student_code, sp.full_name AS student_name,
  sa.assessed_by, tp.teacher_code, tp.full_name AS teacher_name,
  sa.session_id, cs.title AS session_title,
  sa.assessment_no, sa.status, sa.overall_comment, sa.evidence_url,
  sa.submitted_at, sa.locked_at, sa.created_at, sa.updated_at
FROM student_assessments sa
JOIN classes c ON c.id = sa.class_id
JOIN courses co ON co.id = sa.course_id
JOIN student_profiles sp ON sp.id = sa.student_id
JOIN teacher_profiles tp ON tp.id = sa.assessed_by
LEFT JOIN class_sessions cs ON cs.id = sa.session_id
WHERE sa.id = $1
FOR UPDATE OF sa;

-- name: ListAssessmentItems :many
SELECT
  ai.id, ai.assessment_id, ai.course_id, ai.competency_criterion_id,
  cc.code AS criterion_code, cc.name AS criterion_name,
  cc.is_required, cc.sequence_no,
  ai.rating, ai.comment, ai.assessed_at, ai.created_at, ai.updated_at
FROM assessment_items ai
JOIN competency_criteria cc ON cc.id = ai.competency_criterion_id
WHERE ai.assessment_id = $1
ORDER BY cc.sequence_no, ai.id;

-- name: CreateAssessmentItem :one
INSERT INTO assessment_items (
  assessment_id, course_id, competency_criterion_id, rating, comment, assessed_at
)
VALUES (
  $1, $2, $3, $4, $5,
  CASE WHEN $4 = 'not_assessed'::competency_rating THEN NULL ELSE NOW() END
)
RETURNING id, assessment_id, course_id, competency_criterion_id,
  rating, comment, assessed_at, created_at, updated_at;

-- name: DeleteAssessmentItems :exec
DELETE FROM assessment_items
WHERE assessment_id = $1;

-- name: UpdateDraftAssessment :one
UPDATE student_assessments
SET session_id = $2, overall_comment = $3, evidence_url = $4
WHERE id = $1 AND status = 'draft'
RETURNING id, class_id, course_id, student_id, assessed_by, session_id,
  assessment_no, status, overall_comment, evidence_url, submitted_at, locked_at,
  created_at, updated_at;

-- name: CountMissingRequiredAssessmentItems :one
SELECT COUNT(*)
FROM competency_criteria cc
WHERE cc.course_id = $1
  AND cc.is_required
  AND NOT EXISTS (
    SELECT 1
    FROM assessment_items ai
    WHERE ai.assessment_id = $2
      AND ai.competency_criterion_id = cc.id
      AND ai.rating <> 'not_assessed'
  );

-- name: SubmitAssessment :one
UPDATE student_assessments
SET status = 'submitted', submitted_at = NOW()
WHERE id = $1 AND status = 'draft'
RETURNING id, class_id, course_id, student_id, assessed_by, session_id,
  assessment_no, status, overall_comment, evidence_url, submitted_at, locked_at,
  created_at, updated_at;

-- name: LockAssessment :one
UPDATE student_assessments
SET status = 'locked', locked_at = NOW()
WHERE id = $1 AND status = 'submitted'
RETURNING id, class_id, course_id, student_id, assessed_by, session_id,
  assessment_no, status, overall_comment, evidence_url, submitted_at, locked_at,
  created_at, updated_at;

-- name: ListTeacherAssessmentHistory :many
SELECT
  sa.id, sa.class_id, c.class_code, c.name AS class_name,
  sa.course_id, co.code AS course_code, co.name AS course_name,
  sa.student_id, sp.student_code, sp.full_name AS student_name,
  sa.assessed_by, tp.teacher_code, tp.full_name AS teacher_name,
  sa.session_id, cs.title AS session_title,
  sa.assessment_no, sa.status, sa.overall_comment, sa.evidence_url,
  sa.submitted_at, sa.locked_at, sa.created_at, sa.updated_at
FROM student_assessments sa
JOIN classes c ON c.id = sa.class_id
JOIN courses co ON co.id = sa.course_id
JOIN student_profiles sp ON sp.id = sa.student_id
JOIN teacher_profiles tp ON tp.id = sa.assessed_by
LEFT JOIN class_sessions cs ON cs.id = sa.session_id
WHERE sa.class_id = $1 AND sa.student_id = $2
ORDER BY sa.assessment_no DESC, sa.id DESC
LIMIT $4 OFFSET $3;

-- name: CountTeacherAssessmentHistory :one
SELECT COUNT(*)
FROM student_assessments
WHERE class_id = $1 AND student_id = $2;

-- name: ListStudentAssessmentHistory :many
SELECT
  sa.id, sa.class_id, c.class_code, c.name AS class_name,
  sa.course_id, co.code AS course_code, co.name AS course_name,
  sa.student_id, sp.student_code, sp.full_name AS student_name,
  sa.assessed_by, tp.teacher_code, tp.full_name AS teacher_name,
  sa.session_id, cs.title AS session_title,
  sa.assessment_no, sa.status, sa.overall_comment, sa.evidence_url,
  sa.submitted_at, sa.locked_at, sa.created_at, sa.updated_at
FROM student_assessments sa
JOIN classes c ON c.id = sa.class_id
JOIN courses co ON co.id = sa.course_id
JOIN student_profiles sp ON sp.id = sa.student_id
JOIN teacher_profiles tp ON tp.id = sa.assessed_by
LEFT JOIN class_sessions cs ON cs.id = sa.session_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND sa.status IN ('submitted', 'locked')
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR sa.class_id = sqlc.narg(class_id)::uuid
  )
ORDER BY sa.created_at DESC, sa.id DESC
LIMIT sqlc.arg(page_limit) OFFSET sqlc.arg(page_offset);

-- name: CountStudentAssessmentHistory :one
SELECT COUNT(*)
FROM student_assessments sa
JOIN student_profiles sp ON sp.id = sa.student_id
WHERE sp.user_id = sqlc.arg(user_id)
  AND sa.status IN ('submitted', 'locked')
  AND (
    sqlc.narg(class_id)::uuid IS NULL
    OR sa.class_id = sqlc.narg(class_id)::uuid
  );

-- name: GetStudentAssessmentHeader :one
SELECT
  sa.id, sa.class_id, c.class_code, c.name AS class_name,
  sa.course_id, co.code AS course_code, co.name AS course_name,
  sa.student_id, sp.student_code, sp.full_name AS student_name,
  sa.assessed_by, tp.teacher_code, tp.full_name AS teacher_name,
  sa.session_id, cs.title AS session_title,
  sa.assessment_no, sa.status, sa.overall_comment, sa.evidence_url,
  sa.submitted_at, sa.locked_at, sa.created_at, sa.updated_at
FROM student_assessments sa
JOIN classes c ON c.id = sa.class_id
JOIN courses co ON co.id = sa.course_id
JOIN student_profiles sp ON sp.id = sa.student_id
JOIN teacher_profiles tp ON tp.id = sa.assessed_by
LEFT JOIN class_sessions cs ON cs.id = sa.session_id
WHERE sa.id = $1
  AND sp.user_id = $2
  AND sa.status IN ('submitted', 'locked');
