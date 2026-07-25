// Package classes implements administrator class, enrollment, and teacher
// assignment management.
package classes

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/audit"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/dberror"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/pagination"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

var (
	ErrClassNotFound       = errors.New("class not found")
	ErrCourseNotFound      = errors.New("course not found")
	ErrClassConflict       = errors.New("class code already exists")
	ErrCapacityBelowCount  = errors.New("capacity is below current enrollment")
	ErrClassNotEnrollable  = errors.New("class status does not allow enrollment")
	ErrStudentNotFound     = errors.New("student not found")
	ErrStudentInactive     = errors.New("student is not active")
	ErrEnrollmentNotFound  = errors.New("enrollment not found")
	ErrDuplicateEnrollment = errors.New("student is already enrolled in class")
	ErrClassFull           = errors.New("class is full")
	ErrTeacherNotFound     = errors.New("teacher not found")
	ErrTeacherInactive     = errors.New("teacher is not active")
	ErrAssignmentNotFound  = errors.New("teacher assignment not found")
	ErrDuplicateAssignment = errors.New("teacher already assigned")
	ErrAssignmentInUse     = errors.New("teacher assignment is used by sessions")
)

type View struct {
	ID               string `json:"id"`
	CourseID         string `json:"course_id"`
	CourseCode       string `json:"course_code"`
	CourseName       string `json:"course_name"`
	ClassCode        string `json:"class_code"`
	Name             string `json:"name"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	MaximumStudents  int32  `json:"maximum_students"`
	EnrolledStudents int32  `json:"enrolled_students"`
	Status           string `json:"status"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type EnrollmentView struct {
	ID          string  `json:"id"`
	ClassID     string  `json:"class_id"`
	StudentID   string  `json:"student_id"`
	StudentCode string  `json:"student_code"`
	FullName    string  `json:"full_name"`
	Status      string  `json:"status"`
	EnrolledAt  string  `json:"enrolled_at"`
	EndedAt     *string `json:"ended_at"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type AssignmentView struct {
	ID             string `json:"id"`
	ClassID        string `json:"class_id"`
	TeacherID      string `json:"teacher_id"`
	TeacherCode    string `json:"teacher_code"`
	FullName       string `json:"full_name"`
	AssignmentRole string `json:"assignment_role"`
	AssignedAt     string `json:"assigned_at"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type WriteInput struct {
	CourseID        string
	ClassCode       string
	Name            string
	StartDate       string
	EndDate         string
	MaximumStudents int32
	Status          db.ClassStatus
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, queries: db.New(pool)}
}

func (s *Service) Create(ctx context.Context, actorID string, input WriteInput) (View, error) {
	courseID, startDate, endDate, err := parseClassInput(input)
	if err != nil {
		return View{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create class: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	if _, err := q.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrCourseNotFound
	} else if err != nil {
		return View{}, fmt.Errorf("get class course: %w", err)
	}
	created, err := q.CreateClass(ctx, db.CreateClassParams{
		CourseID: courseID, ClassCode: input.ClassCode, Name: input.Name,
		StartDate: startDate, EndDate: endDate, MaximumStudents: input.MaximumStudents,
		Status: input.Status,
	})
	if err != nil {
		return View{}, mapClassWriteError(err)
	}
	row, err := q.GetAdminClass(ctx, created.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created class: %w", err)
	}
	view := viewFromGet(row)
	if err := audit.Write(ctx, q, actorID, "class.create", "class", created.ID, nil, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create class: %w", err)
	}
	return view, nil
}

func (s *Service) Get(ctx context.Context, id string) (View, error) {
	classID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrClassNotFound
	}
	row, err := s.queries.GetAdminClass(ctx, classID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrClassNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get class: %w", err)
	}
	return viewFromGet(row), nil
}

func (s *Service) List(ctx context.Context, search, status, courseIDValue string, page, perPage int) (pagination.Result[View], error) {
	var courseID pgtype.UUID
	var err error
	if courseIDValue != "" {
		courseID, err = data.UUID(courseIDValue)
		if err != nil {
			return pagination.Result[View]{}, ErrCourseNotFound
		}
	}
	params := db.ListAdminClassesParams{
		Search: strings.TrimSpace(search), Status: status, CourseID: courseID,
		PageOffset: int32((page - 1) * perPage), PageLimit: int32(perPage),
	}
	rows, err := s.queries.ListAdminClasses(ctx, params)
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list classes: %w", err)
	}
	total, err := s.queries.CountAdminClasses(ctx, db.CountAdminClassesParams{
		Search: params.Search, Status: params.Status, CourseID: courseID,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count classes: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromList(row))
	}
	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) Update(ctx context.Context, actorID, id string, input WriteInput) (View, error) {
	classID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrClassNotFound
	}
	courseID, startDate, endDate, err := parseClassInput(input)
	if err != nil {
		return View{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update class: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetAdminClass(ctx, classID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrClassNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get class for update: %w", err)
	}
	if _, err := q.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrCourseNotFound
	} else if err != nil {
		return View{}, fmt.Errorf("get updated class course: %w", err)
	}
	if _, err := q.UpdateClass(ctx, db.UpdateClassParams{
		ID: classID, CourseID: courseID, ClassCode: input.ClassCode, Name: input.Name,
		StartDate: startDate, EndDate: endDate, MaximumStudents: input.MaximumStudents,
		Status: input.Status,
	}); err != nil {
		return View{}, mapClassWriteError(err)
	}
	updated, err := q.GetAdminClass(ctx, classID)
	if err != nil {
		return View{}, fmt.Errorf("read updated class: %w", err)
	}
	view := viewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "class.update", "class", classID, viewFromGet(existing), view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update class: %w", err)
	}
	return view, nil
}

func (s *Service) Enroll(ctx context.Context, actorID, classIDValue, studentIDValue string) (EnrollmentView, error) {
	classID, studentID, err := parsePair(classIDValue, studentIDValue)
	if err != nil {
		return EnrollmentView{}, ErrStudentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("begin enrollment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	classRow, err := q.GetAdminClass(ctx, classID)
	if errors.Is(err, pgx.ErrNoRows) {
		return EnrollmentView{}, ErrClassNotFound
	}
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("get enrollment class: %w", err)
	}
	if !classAllowsRelations(classRow.Status) {
		return EnrollmentView{}, ErrClassNotEnrollable
	}
	student, err := q.GetAdminStudent(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return EnrollmentView{}, ErrStudentNotFound
	}
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("get enrollment student: %w", err)
	}
	if student.StudentStatus != db.StudentStatusActive || student.UserStatus != db.UserStatusActive {
		return EnrollmentView{}, ErrStudentInactive
	}
	if _, err := q.GetEnrollmentByClassStudent(ctx, db.GetEnrollmentByClassStudentParams{
		ClassID: classID, StudentID: studentID,
	}); err == nil {
		return EnrollmentView{}, ErrDuplicateEnrollment
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return EnrollmentView{}, fmt.Errorf("check duplicate enrollment: %w", err)
	}
	actor, _ := data.UUID(actorID)
	enrollment, err := q.CreateClassEnrollment(ctx, db.CreateClassEnrollmentParams{
		ClassID: classID, StudentID: studentID, CreatedBy: actor,
	})
	if err != nil {
		return EnrollmentView{}, mapEnrollmentWriteError(err)
	}
	row, err := q.GetClassEnrollment(ctx, db.GetClassEnrollmentParams{ID: enrollment.ID, ClassID: classID})
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("read enrollment: %w", err)
	}
	view := enrollmentViewFromGet(row)
	if err := audit.Write(ctx, q, actorID, "class_enrollment.create", "class_enrollment", enrollment.ID, nil, view); err != nil {
		return EnrollmentView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return EnrollmentView{}, fmt.Errorf("commit enrollment: %w", err)
	}
	return view, nil
}

func (s *Service) ListEnrollments(ctx context.Context, classIDValue string) ([]EnrollmentView, error) {
	classID, err := data.UUID(classIDValue)
	if err != nil {
		return nil, ErrClassNotFound
	}
	if _, err := s.queries.GetAdminClass(ctx, classID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrClassNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get enrollment class: %w", err)
	}
	rows, err := s.queries.ListClassEnrollments(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("list enrollments: %w", err)
	}
	items := make([]EnrollmentView, 0, len(rows))
	for _, row := range rows {
		items = append(items, enrollmentViewFromList(row))
	}
	return items, nil
}

func (s *Service) UpdateEnrollment(ctx context.Context, actorID, classIDValue, enrollmentIDValue string, status db.EnrollmentStatus) (EnrollmentView, error) {
	classID, enrollmentID, err := parsePair(classIDValue, enrollmentIDValue)
	if err != nil {
		return EnrollmentView{}, ErrEnrollmentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("begin update enrollment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetClassEnrollment(ctx, db.GetClassEnrollmentParams{ID: enrollmentID, ClassID: classID})
	if errors.Is(err, pgx.ErrNoRows) {
		return EnrollmentView{}, ErrEnrollmentNotFound
	}
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("get enrollment for update: %w", err)
	}
	if status == db.EnrollmentStatusEnrolled {
		classRow, err := q.GetAdminClass(ctx, classID)
		if err != nil {
			return EnrollmentView{}, fmt.Errorf("get class for reenrollment: %w", err)
		}
		if !classAllowsRelations(classRow.Status) {
			return EnrollmentView{}, ErrClassNotEnrollable
		}
		student, err := q.GetAdminStudent(ctx, existing.StudentID)
		if err != nil {
			return EnrollmentView{}, fmt.Errorf("get student for reenrollment: %w", err)
		}
		if student.StudentStatus != db.StudentStatusActive || student.UserStatus != db.UserStatusActive {
			return EnrollmentView{}, ErrStudentInactive
		}
	}
	if _, err := q.UpdateClassEnrollmentStatus(ctx, db.UpdateClassEnrollmentStatusParams{
		ID: enrollmentID, ClassID: classID, Status: status,
	}); err != nil {
		return EnrollmentView{}, mapEnrollmentWriteError(err)
	}
	updated, err := q.GetClassEnrollment(ctx, db.GetClassEnrollmentParams{ID: enrollmentID, ClassID: classID})
	if err != nil {
		return EnrollmentView{}, fmt.Errorf("read updated enrollment: %w", err)
	}
	view := enrollmentViewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "class_enrollment.update", "class_enrollment", enrollmentID, enrollmentViewFromGet(existing), view); err != nil {
		return EnrollmentView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return EnrollmentView{}, fmt.Errorf("commit update enrollment: %w", err)
	}
	return view, nil
}

func (s *Service) AssignTeacher(ctx context.Context, actorID, classIDValue, teacherIDValue, role string) (AssignmentView, error) {
	classID, teacherID, err := parsePair(classIDValue, teacherIDValue)
	if err != nil {
		return AssignmentView{}, ErrTeacherNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return AssignmentView{}, fmt.Errorf("begin teacher assignment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	classRow, err := q.GetAdminClass(ctx, classID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssignmentView{}, ErrClassNotFound
	}
	if err != nil {
		return AssignmentView{}, fmt.Errorf("get assignment class: %w", err)
	}
	if !classAllowsRelations(classRow.Status) {
		return AssignmentView{}, ErrClassNotEnrollable
	}
	teacher, err := q.GetAdminTeacher(ctx, teacherID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AssignmentView{}, ErrTeacherNotFound
	}
	if err != nil {
		return AssignmentView{}, fmt.Errorf("get assignment teacher: %w", err)
	}
	if teacher.TeacherStatus != db.TeacherStatusActive || teacher.UserStatus != db.UserStatusActive {
		return AssignmentView{}, ErrTeacherInactive
	}
	actor, _ := data.UUID(actorID)
	assignment, err := q.CreateTeacherAssignment(ctx, db.CreateTeacherAssignmentParams{
		ClassID: classID, TeacherID: teacherID, AssignmentRole: role, AssignedBy: actor,
	})
	if err != nil {
		return AssignmentView{}, mapAssignmentWriteError(err)
	}
	row, err := q.GetTeacherAssignment(ctx, db.GetTeacherAssignmentParams{ID: assignment.ID, ClassID: classID})
	if err != nil {
		return AssignmentView{}, fmt.Errorf("read teacher assignment: %w", err)
	}
	view := assignmentViewFromGet(row)
	if err := audit.Write(ctx, q, actorID, "teacher_assignment.create", "teacher_assignment", assignment.ID, nil, view); err != nil {
		return AssignmentView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AssignmentView{}, fmt.Errorf("commit teacher assignment: %w", err)
	}
	return view, nil
}

func (s *Service) ListAssignments(ctx context.Context, classIDValue string) ([]AssignmentView, error) {
	classID, err := data.UUID(classIDValue)
	if err != nil {
		return nil, ErrClassNotFound
	}
	if _, err := s.queries.GetAdminClass(ctx, classID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrClassNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get assignment class: %w", err)
	}
	rows, err := s.queries.ListTeacherAssignments(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("list teacher assignments: %w", err)
	}
	items := make([]AssignmentView, 0, len(rows))
	for _, row := range rows {
		items = append(items, assignmentViewFromList(row))
	}
	return items, nil
}

func (s *Service) UpdateAssignment(ctx context.Context, actorID, classIDValue, assignmentIDValue, role string) (AssignmentView, error) {
	classID, assignmentID, err := parsePair(classIDValue, assignmentIDValue)
	if err != nil {
		return AssignmentView{}, ErrAssignmentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return AssignmentView{}, fmt.Errorf("begin update assignment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetTeacherAssignment(ctx, db.GetTeacherAssignmentParams{ID: assignmentID, ClassID: classID})
	if errors.Is(err, pgx.ErrNoRows) {
		return AssignmentView{}, ErrAssignmentNotFound
	}
	if err != nil {
		return AssignmentView{}, fmt.Errorf("get assignment for update: %w", err)
	}
	if _, err := q.UpdateTeacherAssignment(ctx, db.UpdateTeacherAssignmentParams{
		ID: assignmentID, ClassID: classID, AssignmentRole: role,
	}); err != nil {
		return AssignmentView{}, fmt.Errorf("update assignment: %w", err)
	}
	updated, err := q.GetTeacherAssignment(ctx, db.GetTeacherAssignmentParams{ID: assignmentID, ClassID: classID})
	if err != nil {
		return AssignmentView{}, fmt.Errorf("read updated assignment: %w", err)
	}
	view := assignmentViewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "teacher_assignment.update", "teacher_assignment", assignmentID, assignmentViewFromGet(existing), view); err != nil {
		return AssignmentView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AssignmentView{}, fmt.Errorf("commit update assignment: %w", err)
	}
	return view, nil
}

func (s *Service) DeleteAssignment(ctx context.Context, actorID, classIDValue, assignmentIDValue string) error {
	classID, assignmentID, err := parsePair(classIDValue, assignmentIDValue)
	if err != nil {
		return ErrAssignmentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin delete assignment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetTeacherAssignment(ctx, db.GetTeacherAssignmentParams{ID: assignmentID, ClassID: classID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrAssignmentNotFound
	}
	if err != nil {
		return fmt.Errorf("get assignment for delete: %w", err)
	}
	affected, err := q.DeleteTeacherAssignment(ctx, db.DeleteTeacherAssignmentParams{ID: assignmentID, ClassID: classID})
	if err != nil {
		return mapAssignmentWriteError(err)
	}
	if affected == 0 {
		return ErrAssignmentNotFound
	}
	if err := audit.Write(ctx, q, actorID, "teacher_assignment.delete", "teacher_assignment", assignmentID, assignmentViewFromGet(existing), nil); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete assignment: %w", err)
	}
	return nil
}

func parseClassInput(input WriteInput) (pgtype.UUID, pgtype.Date, pgtype.Date, error) {
	courseID, err := data.UUID(input.CourseID)
	if err != nil {
		return pgtype.UUID{}, pgtype.Date{}, pgtype.Date{}, ErrCourseNotFound
	}
	startDate, err := data.RequiredDate(input.StartDate)
	if err != nil {
		return pgtype.UUID{}, pgtype.Date{}, pgtype.Date{}, err
	}
	endDate, err := data.RequiredDate(input.EndDate)
	return courseID, startDate, endDate, err
}

func parsePair(first, second string) (pgtype.UUID, pgtype.UUID, error) {
	firstID, err := data.UUID(first)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	secondID, err := data.UUID(second)
	return firstID, secondID, err
}

func classAllowsRelations(status db.ClassStatus) bool {
	return status == db.ClassStatusPlanning || status == db.ClassStatusOpen || status == db.ClassStatusInProgress
}

func mapClassWriteError(err error) error {
	if dberror.IsCapacityViolation(err) {
		return ErrCapacityBelowCount
	}
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrClassConflict
	}
	if dberror.IsCode(err, dberror.ForeignKeyViolation) {
		return ErrCourseNotFound
	}
	return err
}

func mapEnrollmentWriteError(err error) error {
	if dberror.IsCapacityViolation(err) {
		return ErrClassFull
	}
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrDuplicateEnrollment
	}
	return err
}

func mapAssignmentWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrDuplicateAssignment
	}
	if dberror.IsCode(err, dberror.ForeignKeyViolation) {
		return ErrAssignmentInUse
	}
	return err
}

func viewFromGet(row db.GetAdminClassRow) View {
	return View{
		ID: data.UUIDString(row.ID), CourseID: data.UUIDString(row.CourseID),
		CourseCode: row.CourseCode, CourseName: row.CourseName,
		ClassCode: row.ClassCode, Name: row.Name,
		StartDate: row.StartDate.Time.Format("2006-01-02"), EndDate: row.EndDate.Time.Format("2006-01-02"),
		MaximumStudents: row.MaximumStudents, EnrolledStudents: row.EnrolledStudents,
		Status:    string(row.Status),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func viewFromList(row db.ListAdminClassesRow) View {
	return View{
		ID: data.UUIDString(row.ID), CourseID: data.UUIDString(row.CourseID),
		CourseCode: row.CourseCode, CourseName: row.CourseName,
		ClassCode: row.ClassCode, Name: row.Name,
		StartDate: row.StartDate.Time.Format("2006-01-02"), EndDate: row.EndDate.Time.Format("2006-01-02"),
		MaximumStudents: row.MaximumStudents, EnrolledStudents: row.EnrolledStudents,
		Status:    string(row.Status),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func enrollmentViewFromGet(row db.GetClassEnrollmentRow) EnrollmentView {
	return EnrollmentView{
		ID: data.UUIDString(row.ID), ClassID: data.UUIDString(row.ClassID),
		StudentID: data.UUIDString(row.StudentID), StudentCode: row.StudentCode,
		FullName: row.FullName, Status: string(row.Status),
		EnrolledAt: row.EnrolledAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		EndedAt:    data.TimeString(row.EndedAt),
		CreatedAt:  row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:  row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func enrollmentViewFromList(row db.ListClassEnrollmentsRow) EnrollmentView {
	return EnrollmentView{
		ID: data.UUIDString(row.ID), ClassID: data.UUIDString(row.ClassID),
		StudentID: data.UUIDString(row.StudentID), StudentCode: row.StudentCode,
		FullName: row.FullName, Status: string(row.Status),
		EnrolledAt: row.EnrolledAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		EndedAt:    data.TimeString(row.EndedAt),
		CreatedAt:  row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:  row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func assignmentViewFromGet(row db.GetTeacherAssignmentRow) AssignmentView {
	return AssignmentView{
		ID: data.UUIDString(row.ID), ClassID: data.UUIDString(row.ClassID),
		TeacherID: data.UUIDString(row.TeacherID), TeacherCode: row.TeacherCode,
		FullName: row.FullName, AssignmentRole: row.AssignmentRole,
		AssignedAt: row.AssignedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		CreatedAt:  row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:  row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func assignmentViewFromList(row db.ListTeacherAssignmentsRow) AssignmentView {
	return AssignmentView{
		ID: data.UUIDString(row.ID), ClassID: data.UUIDString(row.ClassID),
		TeacherID: data.UUIDString(row.TeacherID), TeacherCode: row.TeacherCode,
		FullName: row.FullName, AssignmentRole: row.AssignmentRole,
		AssignedAt: row.AssignedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		CreatedAt:  row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:  row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}
