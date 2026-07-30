package assessments_test

// Phase 7 integration tests run against nsa_training_test and are skipped when
// NSA_TEST_DATABASE_URL is unset.

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	assessmentmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/assessments"
	progressmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/progress"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type phase7Env struct {
	pool              *pgxpool.Pool
	assessments       *assessmentmodule.Service
	progress          *progressmodule.Service
	prefix            string
	adminUser         string
	teacherUser       string
	assignedOtherUser string
	unassignedUser    string
	studentUserA      string
	studentUserB      string
	studentA          string
	studentB          string
	outsider          string
	classID           string
	assessmentSession string
	criterionA        string
	criterionB        string
	foreignCriterion  string
}

func setupPhase7(t *testing.T) *phase7Env {
	t.Helper()
	url := os.Getenv("NSA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("NSA_TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping test db: %v", err)
	}
	t.Cleanup(pool.Close)

	env := &phase7Env{
		pool: pool, assessments: assessmentmodule.NewService(pool),
		progress: progressmodule.NewService(pool),
		prefix:   fmt.Sprintf("P7%X", time.Now().UnixNano()),
	}
	t.Cleanup(func() { env.cleanup(t) })

	env.adminUser = env.insertUser(t, "admin", "ADMIN")
	env.teacherUser = env.insertUser(t, "teacher-a", "TEACHER")
	env.assignedOtherUser = env.insertUser(t, "teacher-b", "TEACHER")
	env.unassignedUser = env.insertUser(t, "teacher-c", "TEACHER")
	env.studentUserA = env.insertUser(t, "student-a", "STUDENT")
	env.studentUserB = env.insertUser(t, "student-b", "STUDENT")
	outsiderUser := env.insertUser(t, "student-outside", "STUDENT")

	teacherA := env.insertTeacher(t, env.teacherUser, "A")
	teacherB := env.insertTeacher(t, env.assignedOtherUser, "B")
	env.insertTeacher(t, env.unassignedUser, "C")
	env.studentA = env.insertStudent(t, env.studentUserA, "A")
	env.studentB = env.insertStudent(t, env.studentUserB, "B")
	env.outsider = env.insertStudent(t, outsiderUser, "OUT")

	courseID := env.insertCourse(t, "MAIN", 2, 80)
	foreignCourseID := env.insertCourse(t, "FOREIGN", 1, 80)
	env.criterionA = env.insertCriterion(t, courseID, "BRAKE", 1)
	env.criterionB = env.insertCriterion(t, courseID, "ENGINE", 2)
	env.foreignCriterion = env.insertCriterion(t, foreignCourseID, "FOREIGN", 1)

	err = pool.QueryRow(ctx,
		`INSERT INTO classes (
		   course_id, class_code, name, start_date, end_date, maximum_students, status
		 ) VALUES (
		   $1, $2, 'Phase 7 Integration Class',
		   CURRENT_DATE - 30, CURRENT_DATE + 30, 10, 'in_progress'
		 ) RETURNING id`,
		courseID, env.prefix+"-CL",
	).Scan(&env.classID)
	if err != nil {
		t.Fatalf("insert class: %v", err)
	}
	for _, teacherID := range []string{teacherA, teacherB} {
		if _, err := pool.Exec(ctx,
			`INSERT INTO teacher_assignments (class_id, teacher_id, assignment_role, assigned_by)
			 VALUES ($1, $2, 'Instructor', $3)`,
			env.classID, teacherID, env.adminUser,
		); err != nil {
			t.Fatalf("assign teacher: %v", err)
		}
	}
	for _, studentID := range []string{env.studentA, env.studentB} {
		if _, err := pool.Exec(ctx,
			`INSERT INTO class_enrollments (class_id, student_id, created_by)
			 VALUES ($1, $2, $3)`,
			env.classID, studentID, env.adminUser,
		); err != nil {
			t.Fatalf("enroll student: %v", err)
		}
	}

	err = pool.QueryRow(ctx,
		`INSERT INTO class_sessions (
		   class_id, course_id, teacher_id, title, session_type,
		   starts_at, ends_at, status, created_by
		 ) VALUES (
		   $1, $2, $3, 'Practical assessment', 'assessment',
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   'completed', $4
		 ) RETURNING id`,
		env.classID, courseID, teacherA, env.adminUser,
	).Scan(&env.assessmentSession)
	if err != nil {
		t.Fatalf("insert assessment session: %v", err)
	}
	var workshopSession string
	err = pool.QueryRow(ctx,
		`INSERT INTO class_sessions (
		   class_id, course_id, teacher_id, title, session_type,
		   starts_at, ends_at, status, created_by
		 ) VALUES (
		   $1, $2, $3, 'Completed workshop', 'workshop',
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '13:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   'completed', $4
		 ) RETURNING id`,
		env.classID, courseID, teacherA, env.adminUser,
	).Scan(&workshopSession)
	if err != nil {
		t.Fatalf("insert workshop session: %v", err)
	}
	for _, session := range []struct {
		id     string
		status string
	}{
		{env.assessmentSession, "present"},
		{workshopSession, "late"},
	} {
		if _, err := pool.Exec(ctx,
			`INSERT INTO attendance_records (
			   class_session_id, class_id, student_id, status, recorded_by
			 ) VALUES ($1, $2, $3, $4, $5)`,
			session.id, env.classID, env.studentA, session.status, env.teacherUser,
		); err != nil {
			t.Fatalf("insert attendance: %v", err)
		}
	}
	return env
}

func (e *phase7Env) insertUser(t *testing.T, suffix, role string) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, status, must_change_password)
		 VALUES ($1, 'not-used', 'active', FALSE)
		 RETURNING id`,
		strings.ToLower(e.prefix)+"-"+suffix+"@test.local",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert user %s: %v", suffix, err)
	}
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE code = $2`,
		id, role,
	); err != nil {
		t.Fatalf("assign user role: %v", err)
	}
	return id
}

func (e *phase7Env) insertTeacher(t *testing.T, userID, suffix string) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO teacher_profiles (user_id, teacher_code, full_name, status)
		 VALUES ($1, $2, $3, 'active')
		 RETURNING id`,
		userID, e.prefix+"-T-"+suffix, "Phase 7 Teacher "+suffix,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert teacher: %v", err)
	}
	return id
}

func (e *phase7Env) insertStudent(t *testing.T, userID, suffix string) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO student_profiles (user_id, student_code, full_name, status)
		 VALUES ($1, $2, $3, 'active')
		 RETURNING id`,
		userID, e.prefix+"-S-"+suffix, "Phase 7 Student "+suffix,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert student: %v", err)
	}
	return id
}

func (e *phase7Env) insertCourse(t *testing.T, suffix string, sessions int, attendance float64) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO courses (
		   code, name, total_sessions, minimum_attendance_pct, status
		 ) VALUES ($1, $2, $3, $4, 'active')
		 RETURNING id`,
		e.prefix+"-"+suffix, "Phase 7 Course "+suffix, sessions, attendance,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert course: %v", err)
	}
	return id
}

func (e *phase7Env) insertCriterion(t *testing.T, courseID, suffix string, sequence int) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO competency_criteria (
		   course_id, code, name, is_required, sequence_no
		 ) VALUES ($1, $2, $3, TRUE, $4)
		 RETURNING id`,
		courseID, e.prefix+"-"+suffix, "Criterion "+suffix, sequence,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert criterion: %v", err)
	}
	return id
}

func (e *phase7Env) cleanup(t *testing.T) {
	t.Helper()
	emailPattern := strings.ToLower(e.prefix) + "-%@test.local"
	codePattern := e.prefix + "%"
	statements := []struct {
		sql  string
		args []any
	}{
		{`DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM assessment_items WHERE assessment_id IN (
		     SELECT id FROM student_assessments WHERE class_id IN (
		       SELECT id FROM classes WHERE class_code LIKE $1
		     )
		   )`, []any{codePattern}},
		{`DELETE FROM student_assessments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM student_test_attempts WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM course_tests WHERE course_id IN (SELECT id FROM courses WHERE code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM course_completions WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM attendance_records WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM teacher_assignments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM classes WHERE class_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM courses WHERE code LIKE $1`, []any{codePattern}},
		{`DELETE FROM student_profiles WHERE student_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM teacher_profiles WHERE teacher_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM users WHERE email LIKE $1`, []any{emailPattern}},
	}
	for _, statement := range statements {
		if _, err := e.pool.Exec(context.Background(), statement.sql, statement.args...); err != nil {
			t.Errorf("phase 7 cleanup: %v", err)
		}
	}
}

func TestIntegration_AssessmentHistoryAuthorizationAndProgress(t *testing.T) {
	env := setupPhase7(t)
	ctx := context.Background()

	input := assessmentmodule.WriteInput{
		SessionID:      stringPointer(env.assessmentSession),
		OverallComment: stringPointer("Initial practical review"),
		Items: []assessmentmodule.ItemInput{{
			CriterionID: env.criterionA, Rating: db.CompetencyRatingCompetent,
			Comment: stringPointer("Safe brake procedure"),
		}},
	}
	if _, err := env.assessments.Create(ctx, env.unassignedUser, env.classID, env.studentA, input); !errors.Is(err, assessmentmodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher create error = %v", err)
	}
	if _, err := env.assessments.Create(ctx, env.teacherUser, env.classID, env.outsider, input); !errors.Is(err, assessmentmodule.ErrStudentNotEnrolled) {
		t.Fatalf("non-enrolled student error = %v", err)
	}
	mismatch := input
	mismatch.Items = []assessmentmodule.ItemInput{{
		CriterionID: env.foreignCriterion, Rating: db.CompetencyRatingCompetent,
	}}
	if _, err := env.assessments.Create(ctx, env.teacherUser, env.classID, env.studentA, mismatch); !errors.Is(err, assessmentmodule.ErrCriterionMismatch) {
		t.Fatalf("foreign competency error = %v", err)
	}
	assertAssessmentCount(t, env, 0)

	first, err := env.assessments.Create(ctx, env.teacherUser, env.classID, env.studentA, input)
	if err != nil {
		t.Fatalf("create first assessment: %v", err)
	}
	if first.AssessmentNo != 1 || first.Status != "draft" || len(first.Items) != 1 {
		t.Fatalf("first draft = %+v", first)
	}
	if _, err := env.assessments.Submit(ctx, env.teacherUser, first.ID); !errors.Is(err, assessmentmodule.ErrAssessmentIncomplete) {
		t.Fatalf("incomplete submission error = %v", err)
	}
	if _, err := env.assessments.Update(ctx, env.assignedOtherUser, first.ID, input); !errors.Is(err, assessmentmodule.ErrAssessmentOwner) {
		t.Fatalf("non-owner update error = %v", err)
	}

	updatedInput := assessmentmodule.WriteInput{
		SessionID:      stringPointer(env.assessmentSession),
		OverallComment: stringPointer("All required practical skills reviewed"),
		Items: []assessmentmodule.ItemInput{
			{CriterionID: env.criterionA, Rating: db.CompetencyRatingCompetent, Comment: stringPointer("Brake skill competent")},
			{CriterionID: env.criterionB, Rating: db.CompetencyRatingGood, Comment: stringPointer("Engine inspection is good")},
		},
	}
	updated, err := env.assessments.Update(ctx, env.teacherUser, first.ID, updatedInput)
	if err != nil {
		t.Fatalf("update first assessment: %v", err)
	}
	if len(updated.Items) != 2 || updated.OverallComment == nil {
		t.Fatalf("updated assessment = %+v", updated)
	}
	submitted, err := env.assessments.Submit(ctx, env.teacherUser, first.ID)
	if err != nil {
		t.Fatalf("submit first assessment: %v", err)
	}
	if submitted.Status != "submitted" || submitted.SubmittedAt == nil {
		t.Fatalf("submitted assessment = %+v", submitted)
	}
	locked, err := env.assessments.Lock(ctx, env.teacherUser, first.ID)
	if err != nil {
		t.Fatalf("lock first assessment: %v", err)
	}
	if locked.Status != "locked" || locked.LockedAt == nil {
		t.Fatalf("locked assessment = %+v", locked)
	}
	if _, err := env.assessments.Update(ctx, env.teacherUser, first.ID, updatedInput); !errors.Is(err, assessmentmodule.ErrAssessmentState) {
		t.Fatalf("locked update error = %v", err)
	}

	// Phase 17 formal eligibility additionally requires one active final exam
	// with a best score strictly greater than five.
	var courseID, finalTestID string
	if err := env.pool.QueryRow(ctx, `SELECT course_id FROM classes WHERE id=$1`, env.classID).Scan(&courseID); err != nil {
		t.Fatalf("load course for final exam: %v", err)
	}
	if err := env.pool.QueryRow(ctx, `
		INSERT INTO course_tests (course_id,code,title,kind,pass_score,is_required,sequence_no,is_active)
		VALUES ($1,$2,'Final exam','final_exam',5,TRUE,99,TRUE) RETURNING id`,
		courseID, env.prefix+"-FINAL").Scan(&finalTestID); err != nil {
		t.Fatalf("insert final exam: %v", err)
	}
	if _, err := env.pool.Exec(ctx, `
		INSERT INTO student_test_attempts (test_id,course_id,class_id,student_id,attempt_no,score,recorded_by)
		VALUES ($1,$2,$3,$4,1,6,$5)`, finalTestID, courseID, env.classID, env.studentA, env.teacherUser); err != nil {
		t.Fatalf("insert passing final exam attempt: %v", err)
	}

	eligible, err := env.progress.Dashboard(ctx, env.studentUserA, env.classID)
	if err != nil {
		t.Fatalf("eligible progress: %v", err)
	}
	if len(eligible.Items) != 1 {
		t.Fatalf("eligible progress items = %d", len(eligible.Items))
	}
	progressA := eligible.Items[0]
	if progressA.CompletionStatus != "eligible" || progressA.OverallProgressPct != 100 ||
		progressA.Sessions.Percent != 100 || progressA.Attendance.Percent != 100 ||
		progressA.Competencies.Met != 2 || progressA.Assessments.Completed != 1 {
		t.Fatalf("eligible progress = %+v", progressA)
	}

	secondInput := assessmentmodule.WriteInput{
		OverallComment: stringPointer("Follow-up review after additional practice"),
		Items: []assessmentmodule.ItemInput{
			{CriterionID: env.criterionA, Rating: db.CompetencyRatingNeedsImprovement},
			{CriterionID: env.criterionB, Rating: db.CompetencyRatingExcellent},
		},
	}
	second, err := env.assessments.Create(ctx, env.teacherUser, env.classID, env.studentA, secondInput)
	if err != nil {
		t.Fatalf("create second assessment: %v", err)
	}
	if second.AssessmentNo != 2 {
		t.Fatalf("second assessment_no = %d", second.AssessmentNo)
	}
	if _, err := env.assessments.Submit(ctx, env.teacherUser, second.ID); err != nil {
		t.Fatalf("submit second assessment: %v", err)
	}
	if _, err := env.assessments.Lock(ctx, env.teacherUser, second.ID); err != nil {
		t.Fatalf("lock second assessment: %v", err)
	}

	history, err := env.assessments.ListTeacher(ctx, env.assignedOtherUser, env.classID, env.studentA, 1, 20)
	if err != nil {
		t.Fatalf("assigned teacher history: %v", err)
	}
	if history.Meta.Total != 2 || len(history.Items) != 2 ||
		history.Items[0].AssessmentNo != 2 || history.Items[1].AssessmentNo != 1 {
		t.Fatalf("assessment history = %+v", history)
	}
	if _, err := env.assessments.ListTeacher(ctx, env.unassignedUser, env.classID, env.studentA, 1, 20); !errors.Is(err, assessmentmodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher history error = %v", err)
	}

	studentHistory, err := env.assessments.ListStudent(ctx, env.studentUserA, "", 1, 20)
	if err != nil {
		t.Fatalf("student A history: %v", err)
	}
	if studentHistory.Meta.Total != 2 || len(studentHistory.Items) != 2 {
		t.Fatalf("student A history = %+v", studentHistory)
	}
	studentBHistory, err := env.assessments.ListStudent(ctx, env.studentUserB, "", 1, 20)
	if err != nil {
		t.Fatalf("student B history: %v", err)
	}
	if studentBHistory.Meta.Total != 0 || len(studentBHistory.Items) != 0 {
		t.Fatalf("student B saw other assessments = %+v", studentBHistory)
	}
	if _, err := env.assessments.GetStudent(ctx, env.studentUserB, first.ID); !errors.Is(err, assessmentmodule.ErrAssessmentNotFound) {
		t.Fatalf("cross-student detail error = %v", err)
	}

	degraded, err := env.progress.Dashboard(ctx, env.studentUserA, env.classID)
	if err != nil {
		t.Fatalf("degraded progress: %v", err)
	}
	// A later practical rating remains visible but no longer introduces an
	// undocumented formal completion blocker in Phase 17.
	if len(degraded.Items) != 1 || degraded.Items[0].CompletionStatus != "eligible" ||
		degraded.Items[0].Competencies.Met != 1 || degraded.Items[0].Competencies.Percent != 50 ||
		degraded.Items[0].OverallProgressPct != 100 {
		t.Fatalf("degraded progress = %+v", degraded)
	}
	repeated, err := env.progress.Dashboard(ctx, env.studentUserA, env.classID)
	if err != nil {
		t.Fatalf("repeat progress: %v", err)
	}
	if !reflect.DeepEqual(degraded, repeated) {
		t.Fatalf("progress is not deterministic:\nfirst=%+v\nsecond=%+v", degraded, repeated)
	}

	studentBProgress, err := env.progress.Dashboard(ctx, env.studentUserB, "")
	if err != nil {
		t.Fatalf("student B progress: %v", err)
	}
	if len(studentBProgress.Items) != 1 || studentBProgress.Items[0].Competencies.Met != 0 ||
		studentBProgress.Items[0].CompletionStatus != "pending" {
		t.Fatalf("student B progress = %+v", studentBProgress)
	}
}

func assertAssessmentCount(t *testing.T, env *phase7Env, want int) {
	t.Helper()
	var count int
	if err := env.pool.QueryRow(
		context.Background(),
		`SELECT COUNT(*) FROM student_assessments WHERE class_id = $1`,
		env.classID,
	).Scan(&count); err != nil {
		t.Fatalf("count assessments: %v", err)
	}
	if count != want {
		t.Fatalf("assessment count=%d want=%d", count, want)
	}
}

func stringPointer(value string) *string {
	return &value
}
