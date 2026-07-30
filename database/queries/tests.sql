-- Phase 17: configured tests, score attempts, corrections, and role-scoped reads.

-- name: CreateCourseTest :one
INSERT INTO course_tests (course_id,code,title,kind,pass_score,is_required,sequence_no,is_active)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;

-- name: GetCourseTest :one
SELECT * FROM course_tests WHERE id=$1 AND course_id=$2;

-- name: GetCourseTestForUpdate :one
SELECT * FROM course_tests WHERE id=$1 AND course_id=$2 FOR UPDATE;

-- name: ListCourseTests :many
SELECT * FROM course_tests WHERE course_id=$1 ORDER BY sequence_no,id;

-- name: UpdateCourseTest :one
UPDATE course_tests SET code=$3,title=$4,kind=$5,pass_score=$6,is_required=$7,sequence_no=$8,is_active=$9
WHERE id=$1 AND course_id=$2 RETURNING *;

-- name: GetTestScoreContext :one
SELECT c.id AS class_id,c.course_id,co.code AS course_code,co.name AS course_name,
  c.class_code,c.name AS class_name,
  sp.id AS student_id,sp.user_id AS student_user_id,sp.student_code,sp.full_name,
  ce.status AS enrollment_status
FROM classes c
JOIN courses co ON co.id=c.course_id
JOIN class_enrollments ce ON ce.class_id=c.id
JOIN student_profiles sp ON sp.id=ce.student_id
WHERE c.id=$1 AND sp.id=$2;

-- name: NextStudentTestAttemptNo :one
SELECT COALESCE(MAX(attempt_no),0)::int+1
FROM student_test_attempts WHERE test_id=$1 AND student_id=$2;

-- name: CreateStudentTestAttempt :one
INSERT INTO student_test_attempts (test_id,course_id,class_id,student_id,attempt_no,score,note,recorded_by,taken_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;

-- name: GetStudentTestAttemptForUpdate :one
SELECT sta.*,ct.kind,ct.pass_score,ct.title,ct.code AS test_code
FROM student_test_attempts sta JOIN course_tests ct ON ct.id=sta.test_id
WHERE sta.id=$1 FOR UPDATE OF sta;

-- name: GetTestAttemptStudentUserID :one
SELECT sp.user_id
FROM student_test_attempts sta
JOIN student_profiles sp ON sp.id=sta.student_id
WHERE sta.id=$1;

-- name: GetTestAttemptClassID :one
SELECT class_id FROM student_test_attempts WHERE id=$1;

-- name: UpdateStudentTestAttempt :one
UPDATE student_test_attempts SET score=$2,note=$3 WHERE id=$1 RETURNING *;

-- name: CreateTestAttemptHistory :one
INSERT INTO test_attempt_history (attempt_id,old_score,new_score,old_note,new_note,reason,changed_by)
VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;

-- name: ListStudentTestAttempts :many
SELECT sta.*,ct.code AS test_code,ct.title AS test_title,ct.kind,ct.pass_score,ct.is_required,
  c.class_code,u.email AS recorded_by_email
FROM student_test_attempts sta
JOIN course_tests ct ON ct.id=sta.test_id
JOIN classes c ON c.id=sta.class_id
JOIN users u ON u.id=sta.recorded_by
WHERE sta.course_id=$1 AND sta.student_id=$2
ORDER BY ct.sequence_no,sta.attempt_no DESC,sta.id DESC;

-- name: ListTestAttemptHistory :many
SELECT tah.*,u.email AS changed_by_email
FROM test_attempt_history tah JOIN users u ON u.id=tah.changed_by
WHERE tah.attempt_id=$1 ORDER BY tah.changed_at DESC,tah.id DESC;

-- name: ListStudentTestCourses :many
SELECT DISTINCT co.id,co.code,co.name
FROM student_profiles sp
JOIN class_enrollments ce ON ce.student_id=sp.id
JOIN classes c ON c.id=ce.class_id
JOIN courses co ON co.id=c.course_id
WHERE sp.user_id=$1
ORDER BY co.name,co.code;

-- name: GetStudentIDByUser :one
SELECT id FROM student_profiles WHERE user_id=$1;
