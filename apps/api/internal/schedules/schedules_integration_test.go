package schedules_test

// Phase 5 integration tests run against nsa_training_test and are skipped when
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

	classmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/classes"
	coursemodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/courses"
	schedulemodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/schedules"
	studentmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/students"
	teachermodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/teachers"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type scheduleEnv struct {
	pool      *pgxpool.Pool
	actorID   string
	prefix    string
	students  *studentmodule.Service
	teachers  *teachermodule.Service
	courses   *coursemodule.Service
	classes   *classmodule.Service
	schedules *schedulemodule.Service
}

func setupSchedules(t *testing.T) *scheduleEnv {
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

	prefix := fmt.Sprintf("P5%X", time.Now().UnixNano())
	var actorID string
	err = pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, status, must_change_password)
		 VALUES ($1, 'not-used', 'active', FALSE) RETURNING id`,
		strings.ToLower(prefix)+"-admin@test.local",
	).Scan(&actorID)
	if err != nil {
		t.Fatalf("insert admin actor: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE code = 'ADMIN'`, actorID,
	); err != nil {
		t.Fatalf("assign admin role: %v", err)
	}

	env := &scheduleEnv{
		pool: pool, actorID: actorID, prefix: prefix,
		students:  studentmodule.NewService(pool, 10),
		teachers:  teachermodule.NewService(pool, 10),
		courses:   coursemodule.NewService(pool),
		classes:   classmodule.NewService(pool),
		schedules: schedulemodule.NewService(pool),
	}
	t.Cleanup(func() { env.cleanup(t) })
	return env
}

func (e *scheduleEnv) cleanup(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	emailPattern := strings.ToLower(e.prefix) + "-%@test.local"
	codePattern := e.prefix + "%"
	statements := []struct {
		sql  string
		args []any
	}{
		{`DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM teacher_assignments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM training_locations WHERE code LIKE $1`, []any{codePattern}},
		{`DELETE FROM classes WHERE class_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM courses WHERE code LIKE $1`, []any{codePattern}},
		{`DELETE FROM student_profiles WHERE student_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM teacher_profiles WHERE teacher_code LIKE $1`, []any{codePattern}},
		{`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, []any{emailPattern}},
		{`DELETE FROM users WHERE email LIKE $1`, []any{emailPattern}},
	}
	for _, statement := range statements {
		if _, err := e.pool.Exec(ctx, statement.sql, statement.args...); err != nil {
			t.Errorf("schedule cleanup: %v", err)
		}
	}
}

func (e *scheduleEnv) createStudent(t *testing.T, suffix string) studentmodule.View {
	t.Helper()
	view, err := e.students.Create(context.Background(), e.actorID, studentmodule.WriteInput{
		Email:    strings.ToLower(e.prefix) + "-student-" + strings.ToLower(suffix) + "@test.local",
		Password: "Passw0rd!123", AccountStatus: db.UserStatusActive,
		StudentCode: e.prefix + "-S-" + suffix, FullName: "Schedule Student " + suffix,
		Status: db.StudentStatusActive,
	})
	if err != nil {
		t.Fatalf("create student %s: %v", suffix, err)
	}
	return view
}

func (e *scheduleEnv) createTeacher(t *testing.T, suffix string) teachermodule.View {
	t.Helper()
	view, err := e.teachers.Create(context.Background(), e.actorID, teachermodule.WriteInput{
		Email:    strings.ToLower(e.prefix) + "-teacher-" + strings.ToLower(suffix) + "@test.local",
		Password: "Passw0rd!123", AccountStatus: db.UserStatusActive,
		TeacherCode: e.prefix + "-T-" + suffix, FullName: "Schedule Teacher " + suffix,
		Status: db.TeacherStatusActive,
	})
	if err != nil {
		t.Fatalf("create teacher %s: %v", suffix, err)
	}
	return view
}

func (e *scheduleEnv) createClass(t *testing.T, courseID, suffix string) classmodule.View {
	t.Helper()
	view, err := e.classes.Create(context.Background(), e.actorID, classmodule.WriteInput{
		CourseID: courseID, ClassCode: e.prefix + "-CL-" + suffix,
		Name: "Schedule Class " + suffix, StartDate: "2026-08-01",
		EndDate: "2026-12-31", MaximumStudents: 10, Status: db.ClassStatusOpen,
	})
	if err != nil {
		t.Fatalf("create class %s: %v", suffix, err)
	}
	return view
}

func TestIntegration_SchedulingConflictsAndRoleViews(t *testing.T) {
	env := setupSchedules(t)
	ctx := context.Background()
	course, err := env.courses.Create(ctx, env.actorID, coursemodule.CourseInput{
		Code: env.prefix + "-C", Name: "Scheduling Course",
		TotalSessions: 20, MinimumAttendancePct: 80, Status: db.CourseStatusActive,
	})
	if err != nil {
		t.Fatalf("create course: %v", err)
	}
	classA := env.createClass(t, course.ID, "A")
	classB := env.createClass(t, course.ID, "B")
	classC := env.createClass(t, course.ID, "C")
	teacherA := env.createTeacher(t, "A")
	teacherB := env.createTeacher(t, "B")
	studentA := env.createStudent(t, "A")
	studentOther := env.createStudent(t, "OTHER")

	for _, pair := range []struct {
		classID   string
		teacherID string
	}{
		{classA.ID, teacherA.ID},
		{classB.ID, teacherA.ID},
		{classC.ID, teacherB.ID},
	} {
		if _, err := env.classes.AssignTeacher(ctx, env.actorID, pair.classID, pair.teacherID, "Instructor"); err != nil {
			t.Fatalf("assign teacher: %v", err)
		}
	}
	if _, err := env.classes.Enroll(ctx, env.actorID, classA.ID, studentA.ID); err != nil {
		t.Fatalf("enroll schedule student: %v", err)
	}

	locationA, err := env.schedules.CreateLocation(ctx, env.actorID, schedulemodule.LocationInput{
		Code: env.prefix + "-L-A", Name: "Workshop A", LocationType: "workshop",
		Capacity: int32Pointer(20), IsActive: true,
	})
	if err != nil {
		t.Fatalf("create location A: %v", err)
	}
	locationB, err := env.schedules.CreateLocation(ctx, env.actorID, schedulemodule.LocationInput{
		Code: env.prefix + "-L-B", Name: "Workshop B", LocationType: "workshop",
		Capacity: int32Pointer(20), IsActive: true,
	})
	if err != nil {
		t.Fatalf("create location B: %v", err)
	}

	starts := mustTime(t, "2026-09-01T08:00:00+07:00")
	ends := mustTime(t, "2026-09-01T12:00:00+07:00")
	first, err := env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classA.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationA.ID),
		Title: "Engine workshop", SessionType: db.SessionTypeWorkshop,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if err != nil {
		t.Fatalf("create first session: %v", err)
	}
	if first.StartsAt != "2026-09-01T01:00:00Z" {
		t.Errorf("UTC starts_at = %s, want 2026-09-01T01:00:00Z", first.StartsAt)
	}
	first, err = env.schedules.UpdateSession(ctx, env.actorID, first.ID, schedulemodule.SessionInput{
		ClassID: classA.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationA.ID),
		Title: "Engine workshop - adjusted", SessionType: db.SessionTypeWorkshop,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
		ChangeReason: "Cập nhật nội dung buổi thực hành",
	})
	if err != nil {
		t.Fatalf("update first session: %v", err)
	}
	history, err := env.classes.OperationHistory(ctx, classA.ID)
	if err != nil {
		t.Fatalf("list class operation history: %v", err)
	}
	if !containsOperationEvent(history, "session_updated") {
		t.Fatal("class operation history does not contain session_updated")
	}

	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classA.ID, Title: "Same class overlap", SessionType: db.SessionTypeTheory,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrClassConflict) {
		t.Fatalf("class conflict error = %v", err)
	}

	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classB.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationB.ID),
		Title: "Same teacher overlap", SessionType: db.SessionTypeTheory,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrTeacherConflict) {
		t.Fatalf("teacher conflict error = %v", err)
	}

	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classC.ID, TeacherID: stringPointer(teacherB.ID), LocationID: stringPointer(locationA.ID),
		Title: "Same location overlap", SessionType: db.SessionTypeTheory,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrLocationConflict) {
		t.Fatalf("location conflict error = %v", err)
	}

	cancelled, err := env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classA.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationA.ID),
		Title: "Cancelled overlap", SessionType: db.SessionTypeTheory,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusCancelled,
	})
	if err != nil {
		t.Fatalf("cancelled overlap should be allowed: %v", err)
	}
	_, err = env.schedules.UpdateSession(ctx, env.actorID, cancelled.ID, schedulemodule.SessionInput{
		ClassID: classA.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationA.ID),
		Title: cancelled.Title, SessionType: db.SessionTypeTheory,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrClassConflict) {
		t.Fatalf("activating overlapping cancelled session error = %v", err)
	}

	from, to := starts.Add(-time.Hour), ends.Add(time.Hour)
	teacherSchedule, err := env.schedules.ListTeacher(ctx, teacherA.UserID, schedulemodule.ListFilter{
		From: &from, To: &to, Page: 1, PerPage: 20,
	})
	if err != nil || teacherSchedule.Meta.Total != 2 {
		t.Fatalf("teacher schedule: result=%+v err=%v", teacherSchedule, err)
	}
	studentSchedule, err := env.schedules.ListStudent(ctx, studentA.UserID, schedulemodule.ListFilter{
		From: &from, To: &to, Page: 1, PerPage: 20,
	})
	if err != nil || studentSchedule.Meta.Total != 2 {
		t.Fatalf("student schedule: result=%+v err=%v", studentSchedule, err)
	}
	otherSchedule, err := env.schedules.ListStudent(ctx, studentOther.UserID, schedulemodule.ListFilter{
		From: &from, To: &to, Page: 1, PerPage: 20,
	})
	if err != nil || otherSchedule.Meta.Total != 0 {
		t.Fatalf("unrelated student schedule: result=%+v err=%v", otherSchedule, err)
	}
	adminSchedule, err := env.schedules.ListAdmin(ctx, schedulemodule.ListFilter{
		ClassID: classA.ID, From: &from, To: &to, Page: 1, PerPage: 20,
	})
	if err != nil || adminSchedule.Meta.Total != 2 {
		t.Fatalf("admin filtered schedule: result=%+v err=%v", adminSchedule, err)
	}
	workshopSchedule, err := env.schedules.ListAdmin(ctx, schedulemodule.ListFilter{
		ClassID: classA.ID, SessionType: "workshop", AttendanceState: "unlocked",
		From: &from, To: &to, SortBy: "starts_at", SortOrder: "desc", Page: 1, PerPage: 20,
	})
	if err != nil || workshopSchedule.Meta.Total != 1 || workshopSchedule.Items[0].ID != first.ID {
		t.Fatalf("admin session type/lock filters: result=%+v err=%v", workshopSchedule, err)
	}
	active := true
	locationPage, err := env.schedules.ListLocations(ctx, env.prefix, &active, 1, 20)
	if err != nil || locationPage.Meta.Total != 2 {
		t.Fatalf("active location list: result=%+v err=%v", locationPage, err)
	}
	first, err = env.schedules.UpdateSession(ctx, env.actorID, first.ID, schedulemodule.SessionInput{
		ClassID: classA.ID, TeacherID: stringPointer(teacherA.ID), LocationID: stringPointer(locationA.ID),
		Title: "Updated engine workshop", SessionType: db.SessionTypeWorkshop,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if err != nil || first.Title != "Updated engine workshop" {
		t.Fatalf("update session: view=%+v err=%v", first, err)
	}

	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classB.ID, Title: "Outside class dates", SessionType: db.SessionTypeTheory,
		StartsAt: mustTime(t, "2027-01-01T08:00:00+07:00"),
		EndsAt:   mustTime(t, "2027-01-01T12:00:00+07:00"), Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrSessionOutsideClass) {
		t.Fatalf("outside class date error = %v", err)
	}
	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classB.ID, TeacherID: stringPointer(teacherB.ID),
		Title: "Unassigned teacher", SessionType: db.SessionTypeTheory,
		StartsAt: starts.Add(48 * time.Hour), EndsAt: ends.Add(48 * time.Hour), Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher error = %v", err)
	}

	locationA.IsActive = false
	if _, err := env.schedules.UpdateLocation(ctx, env.actorID, locationA.ID, schedulemodule.LocationInput{
		Code: locationA.Code, Name: locationA.Name, LocationType: locationA.LocationType,
		Capacity: locationA.Capacity, IsActive: false,
	}); err != nil {
		t.Fatalf("deactivate location: %v", err)
	}
	_, err = env.schedules.CreateSession(ctx, env.actorID, schedulemodule.SessionInput{
		ClassID: classC.ID, TeacherID: stringPointer(teacherB.ID), LocationID: stringPointer(locationA.ID),
		Title: "Inactive location", SessionType: db.SessionTypeTheory,
		StartsAt: starts.Add(24 * time.Hour), EndsAt: ends.Add(24 * time.Hour), Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrLocationInactive) {
		t.Fatalf("inactive location error = %v", err)
	}

	if _, err := env.pool.Exec(ctx,
		`UPDATE class_sessions SET status = 'locked' WHERE id = $1`, first.ID,
	); err != nil {
		t.Fatalf("lock session for test: %v", err)
	}
	_, err = env.schedules.UpdateSession(ctx, env.actorID, first.ID, schedulemodule.SessionInput{
		ClassID: classA.ID, Title: first.Title, SessionType: db.SessionTypeWorkshop,
		StartsAt: starts, EndsAt: ends, Status: db.SessionStatusScheduled,
	})
	if !errors.Is(err, schedulemodule.ErrSessionLocked) {
		t.Fatalf("locked session update error = %v", err)
	}
}

func containsOperationEvent(items []classmodule.OperationHistoryView, eventType string) bool {
	for _, item := range items {
		if item.EventType == eventType {
			return true
		}
	}
	return false
}

func mustTime(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func stringPointer(value string) *string {
	return &value
}

func int32Pointer(value int32) *int32 {
	return &value
}
