package classes_test

// Phase 4 integration tests run against nsa_training_test and are skipped when
// NSA_TEST_DATABASE_URL is unset.
//
// Setup: make db-test-migrate
// Run:   make api-test-integration

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	classmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/classes"
	coursemodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/courses"
	studentmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/students"
	teachermodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/teachers"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type phase4Env struct {
	pool     *pgxpool.Pool
	actorID  string
	prefix   string
	students *studentmodule.Service
	teachers *teachermodule.Service
	courses  *coursemodule.Service
	classes  *classmodule.Service
}

func setupPhase4(t *testing.T) *phase4Env {
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

	prefix := fmt.Sprintf("P4%X", time.Now().UnixNano())
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

	env := &phase4Env{
		pool: pool, actorID: actorID, prefix: prefix,
		students: studentmodule.NewService(pool, 10),
		teachers: teachermodule.NewService(pool, 10),
		courses:  coursemodule.NewService(pool),
		classes:  classmodule.NewService(pool),
	}
	t.Cleanup(func() { env.cleanup(t) })
	return env
}

func (e *phase4Env) cleanup(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	emailPattern := strings.ToLower(e.prefix) + "-%@test.local"
	codePattern := e.prefix + "%"
	statements := []struct {
		sql  string
		args []any
	}{
		{`DELETE FROM audit_logs
		   WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE $1)
		      OR entity_id IN (SELECT id FROM classes WHERE class_code LIKE $2)
		      OR entity_id IN (SELECT id FROM courses WHERE code LIKE $2)
		      OR entity_id IN (SELECT id FROM student_profiles WHERE student_code LIKE $2)
		      OR entity_id IN (SELECT id FROM teacher_profiles WHERE teacher_code LIKE $2)`, []any{emailPattern, codePattern}},
		{`DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM teacher_assignments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM competency_criteria WHERE course_id IN (SELECT id FROM courses WHERE code LIKE $1)`, []any{codePattern}},
		{`DELETE FROM course_modules WHERE course_id IN (SELECT id FROM courses WHERE code LIKE $1)`, []any{codePattern}},
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
			t.Errorf("phase 4 cleanup: %v", err)
		}
	}
}

func (e *phase4Env) createStudent(t *testing.T, suffix string) studentmodule.View {
	t.Helper()
	value, err := e.students.Create(context.Background(), e.actorID, studentmodule.WriteInput{
		Email:         strings.ToLower(e.prefix) + "-" + strings.ToLower(suffix) + "@test.local",
		Password:      "Passw0rd!123",
		AccountStatus: db.UserStatusActive,
		StudentCode:   e.prefix + "-S-" + suffix,
		FullName:      "Integration Student " + suffix,
		Status:        db.StudentStatusActive,
	})
	if err != nil {
		t.Fatalf("create student %s: %v", suffix, err)
	}
	return value
}

func (e *phase4Env) createTeacher(t *testing.T, suffix string) teachermodule.View {
	t.Helper()
	value, err := e.teachers.Create(context.Background(), e.actorID, teachermodule.WriteInput{
		Email:          strings.ToLower(e.prefix) + "-teacher-" + strings.ToLower(suffix) + "@test.local",
		Password:       "Passw0rd!123",
		AccountStatus:  db.UserStatusActive,
		TeacherCode:    e.prefix + "-T-" + suffix,
		FullName:       "Integration Teacher " + suffix,
		Specialization: pointer("Automotive"),
		Status:         db.TeacherStatusActive,
	})
	if err != nil {
		t.Fatalf("create teacher %s: %v", suffix, err)
	}
	return value
}

func (e *phase4Env) createCourse(t *testing.T, suffix string) coursemodule.CourseView {
	t.Helper()
	value, err := e.courses.Create(context.Background(), e.actorID, coursemodule.CourseInput{
		Code: e.prefix + "-C-" + suffix, Name: "Integration Course " + suffix,
		TotalSessions: 20, MinimumAttendancePct: 80, Status: db.CourseStatusActive,
	})
	if err != nil {
		t.Fatalf("create course %s: %v", suffix, err)
	}
	return value
}

func (e *phase4Env) createClass(t *testing.T, courseID, suffix string, capacity int32) classmodule.View {
	t.Helper()
	value, err := e.classes.Create(context.Background(), e.actorID, classmodule.WriteInput{
		CourseID: courseID, ClassCode: e.prefix + "-CL-" + suffix,
		Name: "Integration Class " + suffix, StartDate: "2026-08-01",
		EndDate: "2026-12-01", MaximumStudents: capacity, Status: db.ClassStatusOpen,
	})
	if err != nil {
		t.Fatalf("create class %s: %v", suffix, err)
	}
	return value
}

func TestIntegration_AcademicCoreLifecycle(t *testing.T) {
	env := setupPhase4(t)
	ctx := context.Background()

	student := env.createStudent(t, "A")
	teacher := env.createTeacher(t, "A")
	course := env.createCourse(t, "A")

	var studentRole string
	if err := env.pool.QueryRow(ctx,
		`SELECT r.code
		   FROM user_roles ur JOIN roles r ON r.id = ur.role_id
		  WHERE ur.user_id = $1`, student.UserID,
	).Scan(&studentRole); err != nil || studentRole != "STUDENT" {
		t.Fatalf("student role = %q, err=%v", studentRole, err)
	}
	_, err := env.students.Create(ctx, env.actorID, studentmodule.WriteInput{
		Email: student.Email, Password: "Passw0rd!123", AccountStatus: db.UserStatusActive,
		StudentCode: env.prefix + "-S-DUP", FullName: "Duplicate", Status: db.StudentStatusActive,
	})
	if !errors.Is(err, studentmodule.ErrEmailConflict) {
		t.Fatalf("duplicate email error = %v", err)
	}
	student, err = env.students.Update(ctx, env.actorID, student.ID, studentmodule.WriteInput{
		Email: student.Email, AccountStatus: db.UserStatusActive,
		StudentCode: student.StudentCode, FullName: "Updated Student",
		Status: db.StudentStatusActive,
	})
	if err != nil || student.FullName != "Updated Student" {
		t.Fatalf("update student: view=%+v err=%v", student, err)
	}
	teacher, err = env.teachers.Update(ctx, env.actorID, teacher.ID, teachermodule.WriteInput{
		Email: teacher.Email, AccountStatus: db.UserStatusActive,
		TeacherCode: teacher.TeacherCode, FullName: "Updated Teacher",
		Specialization: pointer("Diagnostics"), Status: db.TeacherStatusActive,
	})
	if err != nil || teacher.FullName != "Updated Teacher" {
		t.Fatalf("update teacher: view=%+v err=%v", teacher, err)
	}
	course, err = env.courses.Update(ctx, env.actorID, course.ID, coursemodule.CourseInput{
		Code: course.Code, Name: "Updated Course", TotalSessions: 24,
		MinimumAttendancePct: 85, Status: db.CourseStatusActive,
	})
	if err != nil || course.TotalSessions != 24 {
		t.Fatalf("update course: view=%+v err=%v", course, err)
	}

	module, err := env.courses.CreateModule(ctx, env.actorID, course.ID, coursemodule.ModuleInput{
		Code: "M01", Name: "Engine Fundamentals", SequenceNo: 1, PlannedSessions: 5,
	})
	if err != nil {
		t.Fatalf("create module: %v", err)
	}
	module, err = env.courses.UpdateModule(ctx, env.actorID, course.ID, module.ID, coursemodule.ModuleInput{
		Code: module.Code, Name: "Updated Module", SequenceNo: 1, PlannedSessions: 6,
	})
	if err != nil || module.PlannedSessions != 6 {
		t.Fatalf("update module: view=%+v err=%v", module, err)
	}
	criterion, err := env.courses.CreateCriterion(ctx, env.actorID, course.ID, coursemodule.CriterionInput{
		ModuleID: pointer(module.ID), Code: "COMP01", Name: "Inspect engine",
		IsRequired: true, SequenceNo: 1,
	})
	if err != nil {
		t.Fatalf("create criterion: %v", err)
	}
	criterion, err = env.courses.UpdateCriterion(ctx, env.actorID, course.ID, criterion.ID, coursemodule.CriterionInput{
		ModuleID: pointer(module.ID), Code: criterion.Code, Name: "Updated Competency",
		IsRequired: true, SequenceNo: 1,
	})
	if err != nil || criterion.Name != "Updated Competency" {
		t.Fatalf("update criterion: view=%+v err=%v", criterion, err)
	}

	class := env.createClass(t, course.ID, "A", 1)
	enrollment, err := env.classes.Enroll(ctx, env.actorID, class.ID, student.ID)
	if err != nil {
		t.Fatalf("enroll student: %v", err)
	}
	if _, err := env.classes.Enroll(ctx, env.actorID, class.ID, student.ID); !errors.Is(err, classmodule.ErrDuplicateEnrollment) {
		t.Fatalf("duplicate enrollment error = %v", err)
	}

	second := env.createStudent(t, "B")
	if _, err := env.classes.Enroll(ctx, env.actorID, class.ID, second.ID); !errors.Is(err, classmodule.ErrClassFull) {
		t.Fatalf("full class error = %v", err)
	}

	assignment, err := env.classes.AssignTeacher(ctx, env.actorID, class.ID, teacher.ID, "Lead Instructor")
	if err != nil {
		t.Fatalf("assign teacher: %v", err)
	}
	if _, err := env.classes.AssignTeacher(ctx, env.actorID, class.ID, teacher.ID, "Instructor"); !errors.Is(err, classmodule.ErrDuplicateAssignment) {
		t.Fatalf("duplicate assignment error = %v", err)
	}
	if _, err := env.classes.UpdateAssignment(ctx, env.actorID, class.ID, assignment.ID, "Practical Instructor"); err != nil {
		t.Fatalf("update assignment: %v", err)
	}

	if _, err := env.classes.UpdateEnrollment(ctx, env.actorID, class.ID, enrollment.ID, db.EnrollmentStatusWithdrawn); err != nil {
		t.Fatalf("withdraw enrollment: %v", err)
	}
	if _, err := env.classes.Enroll(ctx, env.actorID, class.ID, second.ID); err != nil {
		t.Fatalf("enroll after capacity released: %v", err)
	}

	teacherClasses, err := env.classes.ListTeacher(ctx, teacher.UserID)
	if err != nil || len(teacherClasses) != 1 || teacherClasses[0].ID != class.ID {
		t.Fatalf("list assigned teacher classes: classes=%+v err=%v", teacherClasses, err)
	}
	teacherClass, err := env.classes.GetTeacherClass(ctx, teacher.UserID, class.ID)
	if err != nil || teacherClass.Class.ID != class.ID || len(teacherClass.Students) != 2 || len(teacherClass.Competencies) != 1 {
		t.Fatalf("get assigned teacher class: class=%+v err=%v", teacherClass, err)
	}
	unassignedTeacher := env.createTeacher(t, "U")
	if _, err := env.classes.GetTeacherClass(ctx, unassignedTeacher.UserID, class.ID); !errors.Is(err, classmodule.ErrTeacherNotAssigned) {
		t.Fatalf("unassigned teacher class error = %v", err)
	}

	class, err = env.classes.Update(ctx, env.actorID, class.ID, classmodule.WriteInput{
		CourseID: class.CourseID, ClassCode: class.ClassCode, Name: "Updated Class",
		StartDate: class.StartDate, EndDate: class.EndDate,
		MaximumStudents: 2, Status: db.ClassStatus(class.Status),
	})
	if err != nil || class.MaximumStudents != 2 {
		t.Fatalf("update class: view=%+v err=%v", class, err)
	}
	studentPage, err := env.students.List(ctx, env.prefix, string(db.StudentStatusActive), 1, 1)
	if err != nil || len(studentPage.Items) != 1 || studentPage.Meta.Total < 2 {
		t.Fatalf("paginated student list: result=%+v err=%v", studentPage, err)
	}

	if _, err := env.classes.Update(ctx, env.actorID, class.ID, classmodule.WriteInput{
		CourseID: class.CourseID, ClassCode: class.ClassCode, Name: class.Name,
		StartDate: class.StartDate, EndDate: class.EndDate,
		MaximumStudents: 0, Status: db.ClassStatus(class.Status),
	}); !errors.Is(err, classmodule.ErrCapacityBelowCount) {
		t.Fatalf("capacity reduction error = %v", err)
	}

	var auditCount int
	if err := env.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM audit_logs WHERE actor_user_id = $1`, env.actorID,
	).Scan(&auditCount); err != nil {
		t.Fatalf("count audit logs: %v", err)
	}
	if auditCount < 16 {
		t.Errorf("audit logs = %d, want at least 16", auditCount)
	}
}

func TestIntegration_EnrollmentCapacityIsConcurrentSafe(t *testing.T) {
	env := setupPhase4(t)
	course := env.createCourse(t, "CON")
	class := env.createClass(t, course.ID, "CON", 1)
	first := env.createStudent(t, "CON1")
	second := env.createStudent(t, "CON2")

	start := make(chan struct{})
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for _, studentID := range []string{first.ID, second.ID} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			<-start
			_, err := env.classes.Enroll(context.Background(), env.actorID, class.ID, id)
			errs <- err
		}(studentID)
	}
	close(start)
	wg.Wait()
	close(errs)

	successes, full := 0, 0
	for err := range errs {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, classmodule.ErrClassFull):
			full++
		default:
			t.Fatalf("unexpected concurrent enrollment error: %v", err)
		}
	}
	if successes != 1 || full != 1 {
		t.Fatalf("successes=%d full=%d, want 1/1", successes, full)
	}
}

func TestIntegration_CompetencyRejectsModuleFromAnotherCourse(t *testing.T) {
	env := setupPhase4(t)
	ctx := context.Background()
	first := env.createCourse(t, "M1")
	second := env.createCourse(t, "M2")
	module, err := env.courses.CreateModule(ctx, env.actorID, first.ID, coursemodule.ModuleInput{
		Code: "M01", Name: "Course One Module", SequenceNo: 1, PlannedSessions: 1,
	})
	if err != nil {
		t.Fatalf("create module: %v", err)
	}
	_, err = env.courses.CreateCriterion(ctx, env.actorID, second.ID, coursemodule.CriterionInput{
		ModuleID: pointer(module.ID), Code: "C01", Name: "Mismatch",
		IsRequired: true, SequenceNo: 1,
	})
	if !errors.Is(err, coursemodule.ErrModuleCourse) {
		t.Fatalf("module/course mismatch error = %v", err)
	}
}

func pointer(value string) *string {
	return &value
}
