package attendance_test

// Phase 6 integration tests run against nsa_training_test and are skipped when
// NSA_TEST_DATABASE_URL is unset.

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	attendancemodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/attendance"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type attendanceEnv struct {
	pool         *pgxpool.Pool
	service      *attendancemodule.Service
	prefix       string
	adminUserID  string
	teacherUser  string
	otherTeacher string
	studentUserA string
	studentUserB string
	outsiderUser string
	studentA     string
	studentB     string
	outsider     string
	sessionID    string
}

func setupAttendance(t *testing.T) *attendanceEnv {
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

	env := &attendanceEnv{
		pool: pool, service: attendancemodule.NewService(pool),
		prefix: fmt.Sprintf("P6%X", time.Now().UnixNano()),
	}
	t.Cleanup(func() { env.cleanup(t) })

	env.adminUserID = env.insertUser(t, "admin", "ADMIN")
	env.teacherUser = env.insertUser(t, "teacher-a", "TEACHER")
	env.otherTeacher = env.insertUser(t, "teacher-b", "TEACHER")
	env.studentUserA = env.insertUser(t, "student-a", "STUDENT")
	env.studentUserB = env.insertUser(t, "student-b", "STUDENT")
	env.outsiderUser = env.insertUser(t, "student-outside", "STUDENT")

	teacherID := env.insertTeacher(t, env.teacherUser, "A")
	env.insertTeacher(t, env.otherTeacher, "B")
	env.studentA = env.insertStudent(t, env.studentUserA, "A")
	env.studentB = env.insertStudent(t, env.studentUserB, "B")
	env.outsider = env.insertStudent(t, env.outsiderUser, "OUT")

	var courseID string
	err = pool.QueryRow(ctx,
		`INSERT INTO courses (
		   code, name, total_sessions, minimum_attendance_pct, status
		 ) VALUES ($1, 'Attendance Integration Course', 10, 80, 'active')
		 RETURNING id`,
		env.prefix+"-C",
	).Scan(&courseID)
	if err != nil {
		t.Fatalf("insert course: %v", err)
	}
	var classID string
	err = pool.QueryRow(ctx,
		`INSERT INTO classes (
		   course_id, class_code, name, start_date, end_date, maximum_students, status
		 ) VALUES ($1, $2, 'Attendance Integration Class',
		   CURRENT_DATE - 30, CURRENT_DATE + 30, 10, 'in_progress')
		 RETURNING id`,
		courseID, env.prefix+"-CL",
	).Scan(&classID)
	if err != nil {
		t.Fatalf("insert class: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO teacher_assignments (class_id, teacher_id, assignment_role, assigned_by)
		 VALUES ($1, $2, 'Instructor', $3)`,
		classID, teacherID, env.adminUserID,
	); err != nil {
		t.Fatalf("assign teacher: %v", err)
	}
	for _, studentID := range []string{env.studentA, env.studentB} {
		if _, err := pool.Exec(ctx,
			`INSERT INTO class_enrollments (class_id, student_id, created_by, enrolled_at)
			 VALUES ($1, $2, $3, NOW() - INTERVAL '30 days')`,
			classID, studentID, env.adminUserID,
		); err != nil {
			t.Fatalf("enroll student: %v", err)
		}
	}
	err = pool.QueryRow(ctx,
		`INSERT INTO class_sessions (
		   class_id, course_id, teacher_id, title, session_type,
		   starts_at, ends_at, status, created_by
		 ) VALUES (
		   $1, $2, $3, 'Past attendance session', 'theory',
		   (((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   (((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   'completed', $4
		 ) RETURNING id`,
		classID, courseID, teacherID, env.adminUserID,
	).Scan(&env.sessionID)
	if err != nil {
		t.Fatalf("insert class session: %v", err)
	}
	return env
}

func (e *attendanceEnv) insertUser(t *testing.T, suffix, role string) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := e.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, status, must_change_password)
		 VALUES ($1, 'not-used', 'active', FALSE)
		 RETURNING id`,
		strings.ToLower(e.prefix)+"-"+suffix+"@test.local",
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert %s user: %v", suffix, err)
	}
	if _, err := e.pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE code = $2`,
		id, role,
	); err != nil {
		t.Fatalf("assign %s role: %v", role, err)
	}
	return id
}

func (e *attendanceEnv) insertTeacher(t *testing.T, userID, suffix string) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO teacher_profiles (user_id, teacher_code, full_name, status)
		 VALUES ($1, $2, $3, 'active')
		 RETURNING id`,
		userID, e.prefix+"-T-"+suffix, "Attendance Teacher "+suffix,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert teacher %s: %v", suffix, err)
	}
	return id
}

func (e *attendanceEnv) insertStudent(t *testing.T, userID, suffix string) string {
	t.Helper()
	var id string
	err := e.pool.QueryRow(context.Background(),
		`INSERT INTO student_profiles (user_id, student_code, full_name, status)
		 VALUES ($1, $2, $3, 'active')
		 RETURNING id`,
		userID, e.prefix+"-S-"+suffix, "Attendance Student "+suffix,
	).Scan(&id)
	if err != nil {
		t.Fatalf("insert student %s: %v", suffix, err)
	}
	return id
}

func (e *attendanceEnv) cleanup(t *testing.T) {
	t.Helper()
	emailPattern := strings.ToLower(e.prefix) + "-%@test.local"
	codePattern := e.prefix + "%"
	statements := []struct {
		sql  string
		args []any
	}{
		{`DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
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
			t.Errorf("attendance cleanup: %v", err)
		}
	}
}

func TestIntegration_AdminRecordsMissingAttendanceWithRosterIdentity(t *testing.T) {
	env := setupAttendance(t)
	ctx := context.Background()

	recorded, err := env.service.AdminCorrectStudent(
		ctx,
		env.adminUserID,
		env.sessionID,
		env.studentB,
		attendancemodule.CorrectionInput{
			Status: db.AttendanceStatusExcused,
			Reason: "Approved absence request",
		},
	)
	if err != nil {
		t.Fatalf("admin record missing attendance: %v", err)
	}
	if recorded.StudentID != env.studentB || recorded.StudentCode == "" || recorded.FullName == "" || recorded.Status != "excused" {
		t.Fatalf("recorded attendance identity/status = %+v", recorded)
	}

	var beforeWasNull bool
	if err := env.pool.QueryRow(ctx,
		`SELECT old_values IS NULL OR old_values = 'null'::jsonb
		 FROM audit_logs
		 WHERE action = 'attendance.correct' AND entity_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		recorded.ID,
	).Scan(&beforeWasNull); err != nil || !beforeWasNull {
		t.Fatalf("missing-attendance audit old_values null=%v err=%v", beforeWasNull, err)
	}
}

func TestIntegration_WithdrawalBoundaryAndGapAreExcludedFromAttendanceRoster(t *testing.T) {
	env := setupAttendance(t)
	ctx := context.Background()

	var enrollmentID string
	if err := env.pool.QueryRow(ctx,
		`SELECT id FROM class_enrollments WHERE student_id = $1`, env.studentB,
	).Scan(&enrollmentID); err != nil {
		t.Fatalf("find enrollment: %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`UPDATE class_enrollment_periods
		 SET ended_at = NOW() - INTERVAL '36 hours', end_reason = 'Temporary withdrawal'
		 WHERE enrollment_id = $1 AND ended_at IS NULL`, enrollmentID,
	); err != nil {
		t.Fatalf("close first enrollment period: %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`UPDATE class_enrollments
		 SET status = 'enrolled', ended_at = NULL
		 WHERE id = $1`, enrollmentID,
	); err != nil {
		t.Fatalf("prepare aggregate enrollment: %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`INSERT INTO class_enrollment_periods (
		   enrollment_id, started_at, created_by, start_reason
		 ) VALUES ($1, NOW() - INTERVAL '12 hours', $2, 'Returned to class')`,
		enrollmentID, env.adminUserID,
	); err != nil {
		t.Fatalf("create return period: %v", err)
	}

	var gapSessionID, returnSessionID string
	if err := env.pool.QueryRow(ctx,
		`INSERT INTO class_sessions (
		   class_id, course_id, teacher_id, title, session_type,
		   starts_at, ends_at, status, created_by
		 )
		 SELECT class_id, course_id, teacher_id, 'Withdrawal gap', 'theory',
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '13:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1) + TIME '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   'completed', created_by
		 FROM class_sessions WHERE id = $1
		 RETURNING id`, env.sessionID,
	).Scan(&gapSessionID); err != nil {
		t.Fatalf("insert gap session: %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`UPDATE class_enrollment_periods
		 SET ended_at = (SELECT starts_at FROM class_sessions WHERE id = $2)
		 WHERE enrollment_id = $1 AND ended_at IS NOT NULL`,
		enrollmentID, gapSessionID,
	); err != nil {
		t.Fatalf("align withdrawal with session boundary: %v", err)
	}
	if err := env.pool.QueryRow(ctx,
		`INSERT INTO class_sessions (
		   class_id, course_id, teacher_id, title, session_type,
		   starts_at, ends_at, status, created_by
		 )
		 SELECT class_id, course_id, teacher_id, 'After return', 'theory',
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1) + TIME '18:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1) + TIME '21:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		   'scheduled', created_by
		 FROM class_sessions WHERE id = $1
		 RETURNING id`, env.sessionID,
	).Scan(&returnSessionID); err != nil {
		t.Fatalf("insert return session: %v", err)
	}

	gap, err := env.service.GetAdminSession(ctx, gapSessionID)
	if err != nil {
		t.Fatalf("get gap roster: %v", err)
	}
	returned, err := env.service.GetAdminSession(ctx, returnSessionID)
	if err != nil {
		t.Fatalf("get returned roster: %v", err)
	}
	if rosterHasStudent(gap.Items, env.studentB) {
		t.Fatalf("withdrawn student unexpectedly appears in gap roster: %+v", gap.Items)
	}
	if !rosterHasStudent(returned.Items, env.studentB) {
		t.Fatalf("returned student missing from later roster: %+v", returned.Items)
	}
}

func rosterHasStudent(items []attendancemodule.RosterItemView, studentID string) bool {
	for _, item := range items {
		if item.StudentID == studentID {
			return true
		}
	}
	return false
}

func TestIntegration_AttendanceLifecycleAndOwnership(t *testing.T) {
	env := setupAttendance(t)
	ctx := context.Background()

	if _, err := env.service.GetTeacherSession(ctx, env.otherTeacher, env.sessionID); !errors.Is(err, attendancemodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher view error = %v", err)
	}
	if _, err := env.service.RecordBatch(ctx, env.otherTeacher, env.sessionID, []attendancemodule.BatchItemInput{{
		StudentID: env.studentA, Status: db.AttendanceStatusPresent,
	}}); !errors.Is(err, attendancemodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher record error = %v", err)
	}

	_, err := env.service.RecordBatch(ctx, env.teacherUser, env.sessionID, []attendancemodule.BatchItemInput{
		{StudentID: env.studentA, Status: db.AttendanceStatusPresent},
		{StudentID: env.outsider, Status: db.AttendanceStatusAbsent},
	})
	if !errors.Is(err, attendancemodule.ErrStudentNotEnrolled) {
		t.Fatalf("non-enrolled batch error = %v", err)
	}
	assertAttendanceCount(t, env, 0, "invalid batch must roll back")

	_, err = env.service.RecordBatch(ctx, env.teacherUser, env.sessionID, []attendancemodule.BatchItemInput{
		{StudentID: env.studentA, Status: db.AttendanceStatusPresent},
		{StudentID: env.studentA, Status: db.AttendanceStatusLate},
	})
	if !errors.Is(err, attendancemodule.ErrDuplicateStudent) {
		t.Fatalf("duplicate payload error = %v", err)
	}
	assertAttendanceCount(t, env, 0, "duplicate payload must roll back")

	recordsA, err := env.service.RecordBatch(ctx, env.teacherUser, env.sessionID, []attendancemodule.BatchItemInput{{
		StudentID: env.studentA, Status: db.AttendanceStatusPresent,
	}})
	if err != nil {
		t.Fatalf("record student A: %v", err)
	}
	if len(recordsA) != 1 {
		t.Fatalf("recorded A count = %d", len(recordsA))
	}
	updatedA, err := env.service.RecordBatch(ctx, env.teacherUser, env.sessionID, []attendancemodule.BatchItemInput{{
		StudentID: env.studentA, Status: db.AttendanceStatusAbsent,
	}})
	if err != nil || len(updatedA) != 1 || updatedA[0].Status != "absent" || updatedA[0].ID != recordsA[0].ID {
		t.Fatalf("same-day attendance update = %+v, err=%v", updatedA, err)
	}

	view, err := env.service.GetTeacherSession(ctx, env.teacherUser, env.sessionID)
	if err != nil {
		t.Fatalf("teacher attendance view: %v", err)
	}
	if view.Summary.Total != 2 || view.Summary.Recorded != 1 || view.Summary.Unrecorded != 1 {
		t.Fatalf("partial summary = %+v", view.Summary)
	}
	studentView, err := env.service.GetStudentSession(ctx, env.studentUserA, env.sessionID)
	if err != nil || len(studentView.Items) != 2 || studentView.Items[0].AttendanceID != nil || studentView.Items[0].Note != nil {
		t.Fatalf("student class attendance view = %+v, err=%v", studentView, err)
	}
	if _, err := env.service.GetStudentSession(ctx, env.outsiderUser, env.sessionID); !errors.Is(err, attendancemodule.ErrStudentNotInClass) {
		t.Fatalf("outsider student view error = %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`UPDATE class_sessions
		 SET starts_at = ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 2) + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
		     ends_at = ((((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 2) + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh')
		 WHERE id = $1`, env.sessionID); err != nil {
		t.Fatalf("expire attendance session: %v", err)
	}
	filled, locked, err := env.service.ReconcileExpiredAttendance(ctx)
	if err != nil || filled < 1 || locked < 1 {
		t.Fatalf("automatic attendance lock filled=%d locked=%d err=%v", filled, locked, err)
	}
	if _, err := env.service.RecordBatch(ctx, env.teacherUser, env.sessionID, []attendancemodule.BatchItemInput{{
		StudentID: env.studentB, Status: db.AttendanceStatusPresent,
	}}); !errors.Is(err, attendancemodule.ErrSessionLocked) {
		t.Fatalf("record after lock error = %v", err)
	}
	if _, err := env.pool.Exec(ctx,
		`UPDATE class_enrollments
		 SET status = 'transferred', ended_at = NOW()
		 WHERE student_id = $1`, env.studentB); err != nil {
		t.Fatalf("transfer student after historical session: %v", err)
	}
	historicalView, err := env.service.GetStudentSession(ctx, env.studentUserB, env.sessionID)
	if err != nil || len(historicalView.Items) != 2 {
		t.Fatalf("transferred student historical roster = %+v, err=%v", historicalView, err)
	}

	corrected, err := env.service.Correct(ctx, env.adminUserID, recordsA[0].ID, attendancemodule.CorrectionInput{
		Status: db.AttendanceStatusAbsent, Reason: "Verified against the signed paper register",
	})
	if err != nil {
		t.Fatalf("admin correction: %v", err)
	}
	if corrected.Status != "absent" || corrected.StudentID != env.studentA {
		t.Fatalf("corrected record = %+v", corrected)
	}
	var reason string
	err = env.pool.QueryRow(ctx,
		`SELECT reason
		 FROM audit_logs
		 WHERE action = 'attendance.correct' AND entity_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		recordsA[0].ID,
	).Scan(&reason)
	if err != nil || reason != "Verified against the signed paper register" {
		t.Fatalf("correction audit reason=%q err=%v", reason, err)
	}
	var correctionEvents int
	if err := env.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM class_operation_history
		 WHERE event_type = 'attendance_corrected' AND entity_id = $1`,
		recordsA[0].ID,
	).Scan(&correctionEvents); err != nil || correctionEvents != 1 {
		t.Fatalf("attendance correction history count=%d err=%v", correctionEvents, err)
	}

	historyA, err := env.service.StudentHistory(ctx, env.studentUserA, "", 1, 20)
	if err != nil {
		t.Fatalf("student A history: %v", err)
	}
	if historyA.Meta.Total != 1 || len(historyA.Items) != 1 ||
		historyA.Items[0].ID != recordsA[0].ID || historyA.Items[0].Status != "absent" {
		t.Fatalf("student A history = %+v", historyA)
	}
	historyB, err := env.service.StudentHistory(ctx, env.studentUserB, "", 1, 20)
	if err != nil {
		t.Fatalf("student B history: %v", err)
	}
	if historyB.Meta.Total != 1 || len(historyB.Items) != 1 || historyB.Items[0].Status != "absent" {
		t.Fatalf("student B history = %+v", historyB)
	}
	summaryB, err := env.service.StudentSummary(ctx, env.studentUserB, "")
	if err != nil {
		t.Fatalf("student B summary: %v", err)
	}
	if len(summaryB) != 1 || summaryB[0].AttendancePct != 0 ||
		summaryB[0].MinimumAttendancePct != 80 || !summaryB[0].IsAtRisk ||
		summaryB[0].AbsentSessions != 1 || summaryB[0].PresentSessions != 0 {
		t.Fatalf("student B summary = %+v", summaryB)
	}

	adminView, err := env.service.GetAdminSession(ctx, env.sessionID)
	if err != nil {
		t.Fatalf("admin attendance view: %v", err)
	}
	if adminView.Summary.Absent != 2 || adminView.Summary.Late != 0 || adminView.Summary.Unrecorded != 0 || adminView.Session.AttendanceLockedAt == nil {
		t.Fatalf("admin summary after correction = %+v", adminView.Summary)
	}
}

func assertAttendanceCount(t *testing.T, env *attendanceEnv, want int, message string) {
	t.Helper()
	var count int
	if err := env.pool.QueryRow(
		context.Background(),
		`SELECT COUNT(*) FROM attendance_records WHERE class_session_id = $1`,
		env.sessionID,
	).Scan(&count); err != nil {
		t.Fatalf("count attendance: %v", err)
	}
	if count != want {
		t.Fatalf("%s: count=%d want=%d", message, count, want)
	}
}
