// Package students implements administrator student-account management.
package students

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/audit"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/dberror"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/pagination"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

var (
	ErrNotFound      = errors.New("student not found")
	ErrEmailConflict = errors.New("email already exists")
	ErrCodeConflict  = errors.New("student code already exists")
	ErrStatusReason  = errors.New("status change reason is required")
)

type ListFilter struct {
	Search         string
	Status         string
	ClassID        string
	CourseID       string
	AttendanceRisk string
	SortBy         string
	SortOrder      string
	Page           int
	PerPage        int
}

// View is the public administrator representation of a student and account.
type View struct {
	ID                    string  `json:"id"`
	UserID                string  `json:"user_id"`
	Email                 string  `json:"email"`
	AccountStatus         string  `json:"account_status"`
	StudentCode           string  `json:"student_code"`
	FullName              string  `json:"full_name"`
	AvatarURL             *string `json:"avatar_url"`
	Phone                 *string `json:"phone"`
	DateOfBirth           *string `json:"date_of_birth"`
	Gender                *string `json:"gender"`
	Address               *string `json:"address"`
	EmergencyContactName  *string `json:"emergency_contact_name"`
	EmergencyContactPhone *string `json:"emergency_contact_phone"`
	Status                string  `json:"status"`
	EnrolledAt            *string `json:"enrolled_at"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

// WriteInput contains normalized, validated fields shared by create/update.
type WriteInput struct {
	Email                 string
	Password              string
	AccountStatus         db.UserStatus
	StudentCode           string
	FullName              string
	AvatarURL             *string
	Phone                 *string
	DateOfBirth           *string
	Gender                *string
	Address               *string
	EmergencyContactName  *string
	EmergencyContactPhone *string
	Status                db.StudentStatus
	EnrolledAt            *string
	StatusChangeReason    *string
}

// StatusHistoryView is an immutable student lifecycle transition.
type StatusHistoryView struct {
	ID             string  `json:"id"`
	StudentID      string  `json:"student_id"`
	FromStatus     *string `json:"from_status"`
	ToStatus       string  `json:"to_status"`
	Reason         string  `json:"reason"`
	ChangedBy      *string `json:"changed_by"`
	ChangedByEmail *string `json:"changed_by_email"`
	ChangedAt      string  `json:"changed_at"`
}

// Service implements student management use cases.
type Service struct {
	pool       *pgxpool.Pool
	queries    *db.Queries
	bcryptCost int
}

func NewService(pool *pgxpool.Pool, bcryptCost int) *Service {
	return &Service{pool: pool, queries: db.New(pool), bcryptCost: bcryptCost}
}

// Create atomically creates the account, STUDENT role, profile, and audit log.
func (s *Service) Create(ctx context.Context, actorID string, input WriteInput) (View, error) {
	passwordHash, err := auth.HashPassword(input.Password, s.bcryptCost)
	if err != nil {
		return View{}, fmt.Errorf("hash temporary password: %w", err)
	}
	dateOfBirth, err := data.Date(input.DateOfBirth)
	if err != nil {
		return View{}, err
	}
	enrolledAt, err := data.Date(input.EnrolledAt)
	if err != nil {
		return View{}, err
	}
	actor, err := data.UUID(actorID)
	if err != nil {
		return View{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create student: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	user, err := q.CreateManagedUser(ctx, db.CreateManagedUserParams{
		Email:        input.Email,
		PasswordHash: passwordHash,
		Status:       input.AccountStatus,
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	if err := q.AssignManagedUserRole(ctx, db.AssignManagedUserRoleParams{
		UserID: user.ID, Code: auth.RoleStudent, AssignedBy: actor,
	}); err != nil {
		return View{}, fmt.Errorf("assign student role: %w", err)
	}
	profile, err := q.CreateStudentProfile(ctx, db.CreateStudentProfileParams{
		UserID:                user.ID,
		StudentCode:           input.StudentCode,
		FullName:              input.FullName,
		AvatarUrl:             data.Text(input.AvatarURL),
		Phone:                 data.Text(input.Phone),
		DateOfBirth:           dateOfBirth,
		Gender:                data.Text(input.Gender),
		Address:               data.Text(input.Address),
		EmergencyContactName:  data.Text(input.EmergencyContactName),
		EmergencyContactPhone: data.Text(input.EmergencyContactPhone),
		Status:                input.Status,
		EnrolledAt:            enrolledAt,
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	if _, err := q.CreateStudentStatusHistory(ctx, db.CreateStudentStatusHistoryParams{
		StudentID: profile.ID,
		ToStatus:  input.Status,
		Reason:    "Khởi tạo hồ sơ",
		ChangedBy: actor,
	}); err != nil {
		return View{}, fmt.Errorf("create initial student status history: %w", err)
	}
	created, err := q.GetAdminStudent(ctx, profile.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created student: %w", err)
	}
	view := viewFromGet(created)
	if err := audit.Write(ctx, q, actorID, "student.create", "student_profile", profile.ID, nil, auditStudentView(view)); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create student: %w", err)
	}
	return view, nil
}

// StatusHistory returns the newest-first immutable lifecycle history.
func (s *Service) StatusHistory(ctx context.Context, id string) ([]StatusHistoryView, error) {
	studentID, err := data.UUID(id)
	if err != nil {
		return nil, ErrNotFound
	}
	if _, err := s.queries.GetAdminStudent(ctx, studentID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get student for status history: %w", err)
	}
	rows, err := s.queries.ListStudentStatusHistory(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("list student status history: %w", err)
	}
	items := make([]StatusHistoryView, 0, len(rows))
	for _, row := range rows {
		var fromStatus *string
		if row.FromStatus.Valid {
			value := string(row.FromStatus.StudentStatus)
			fromStatus = &value
		}
		items = append(items, StatusHistoryView{
			ID: data.UUIDString(row.ID), StudentID: data.UUIDString(row.StudentID),
			FromStatus: fromStatus, ToStatus: string(row.ToStatus), Reason: row.Reason,
			ChangedBy: data.UUIDPointer(row.ChangedBy), ChangedByEmail: data.TextPointer(row.ChangedByEmail),
			ChangedAt: row.ChangedAt.Time.UTC().Format(time.RFC3339Nano),
		})
	}
	return items, nil
}

// Get returns one student by profile ID.
func (s *Service) Get(ctx context.Context, id string) (View, error) {
	studentID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrNotFound
	}
	row, err := s.queries.GetAdminStudent(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get student: %w", err)
	}
	return viewFromGet(row), nil
}

// List returns a filtered page of students.
func (s *Service) List(ctx context.Context, filter ListFilter) (pagination.Result[View], error) {
	classID, err := optionalListUUID(filter.ClassID)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	courseID, err := optionalListUUID(filter.CourseID)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	params := db.ListAdminStudentsParams{
		Search: strings.TrimSpace(filter.Search), Status: filter.Status,
		ClassID: classID, CourseID: courseID, AttendanceRisk: filter.AttendanceRisk,
		SortBy: filter.SortBy, SortOrder: filter.SortOrder,
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListAdminStudents(ctx, params)
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list students: %w", err)
	}
	total, err := s.queries.CountAdminStudents(ctx, db.CountAdminStudentsParams{
		Search: params.Search, Status: params.Status, ClassID: classID, CourseID: courseID,
		AttendanceRisk: filter.AttendanceRisk,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count students: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromList(row))
	}
	return pagination.New(items, filter.Page, filter.PerPage, total), nil
}

func optionalListUUID(value string) (pgtype.UUID, error) {
	if strings.TrimSpace(value) == "" {
		return pgtype.UUID{}, nil
	}
	return data.UUID(value)
}

// Export returns all students matching the administrator filters in a stable order.
func (s *Service) Export(ctx context.Context, filter ListFilter) ([]View, error) {
	classID, err := optionalListUUID(filter.ClassID)
	if err != nil {
		return nil, err
	}
	courseID, err := optionalListUUID(filter.CourseID)
	if err != nil {
		return nil, err
	}
	rows, err := s.queries.ExportAdminStudents(ctx, db.ExportAdminStudentsParams{
		Search: strings.TrimSpace(filter.Search), Status: filter.Status,
		ClassID: classID, CourseID: courseID, AttendanceRisk: filter.AttendanceRisk,
	})
	if err != nil {
		return nil, fmt.Errorf("export students: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, View{
			ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
			Email: row.Email, AccountStatus: string(row.UserStatus),
			StudentCode: row.StudentCode, FullName: row.FullName, AvatarURL: data.TextPointer(row.AvatarUrl),
			Phone: data.TextPointer(row.Phone), DateOfBirth: data.DateString(row.DateOfBirth),
			Gender: data.TextPointer(row.Gender), Address: data.TextPointer(row.Address),
			EmergencyContactName:  data.TextPointer(row.EmergencyContactName),
			EmergencyContactPhone: data.TextPointer(row.EmergencyContactPhone),
			Status:                string(row.StudentStatus), EnrolledAt: data.DateString(row.EnrolledAt),
			CreatedAt: row.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
			UpdatedAt: row.UpdatedAt.Time.UTC().Format(time.RFC3339Nano),
		})
	}
	return items, nil
}

// Update atomically updates the account, profile, and audit log.
func (s *Service) Update(ctx context.Context, actorID, id string, input WriteInput) (View, error) {
	studentID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrNotFound
	}
	dateOfBirth, err := data.Date(input.DateOfBirth)
	if err != nil {
		return View{}, err
	}
	enrolledAt, err := data.Date(input.EnrolledAt)
	if err != nil {
		return View{}, err
	}
	actor, err := data.UUID(actorID)
	if err != nil {
		return View{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update student: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	existing, err := q.GetAdminStudent(ctx, studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get student for update: %w", err)
	}
	oldView := viewFromGet(existing)
	statusChanged := existing.StudentStatus != input.Status
	statusReason := ""
	if input.StatusChangeReason != nil {
		statusReason = strings.TrimSpace(*input.StatusChangeReason)
	}
	if statusChanged && statusReason == "" {
		return View{}, ErrStatusReason
	}
	if _, err := q.UpdateManagedUser(ctx, db.UpdateManagedUserParams{
		ID: existing.UserID, Email: input.Email, Status: input.AccountStatus,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	if _, err := q.UpdateStudentProfile(ctx, db.UpdateStudentProfileParams{
		ID:                    studentID,
		FullName:              input.FullName,
		AvatarUrl:             data.Text(input.AvatarURL),
		Phone:                 data.Text(input.Phone),
		DateOfBirth:           dateOfBirth,
		Gender:                data.Text(input.Gender),
		Address:               data.Text(input.Address),
		EmergencyContactName:  data.Text(input.EmergencyContactName),
		EmergencyContactPhone: data.Text(input.EmergencyContactPhone),
		Status:                input.Status,
		EnrolledAt:            enrolledAt,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	if statusChanged {
		if _, err := q.CreateStudentStatusHistory(ctx, db.CreateStudentStatusHistoryParams{
			StudentID:  studentID,
			FromStatus: db.NullStudentStatus{StudentStatus: existing.StudentStatus, Valid: true},
			ToStatus:   input.Status,
			Reason:     statusReason,
			ChangedBy:  actor,
		}); err != nil {
			return View{}, fmt.Errorf("create student status history: %w", err)
		}
	}
	updated, err := q.GetAdminStudent(ctx, studentID)
	if err != nil {
		return View{}, fmt.Errorf("read updated student: %w", err)
	}
	view := viewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "student.update", "student_profile", studentID, auditStudentView(oldView), auditStudentView(view)); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update student: %w", err)
	}
	return view, nil
}

func auditStudentView(view View) View {
	if view.AvatarURL == nil {
		return view
	}
	redacted := "[stored WebP image]"
	view.AvatarURL = &redacted
	return view
}

func mapWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		switch dberror.Constraint(err) {
		case "users_email_key":
			return ErrEmailConflict
		case "student_profiles_student_code_key":
			return ErrCodeConflict
		}
	}
	return err
}

func viewFromGet(row db.GetAdminStudentRow) View {
	return View{
		ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
		Email: row.Email, AccountStatus: string(row.UserStatus),
		StudentCode: row.StudentCode, FullName: row.FullName, AvatarURL: data.TextPointer(row.AvatarUrl),
		Phone: data.TextPointer(row.Phone), DateOfBirth: data.DateString(row.DateOfBirth),
		Gender: data.TextPointer(row.Gender), Address: data.TextPointer(row.Address),
		EmergencyContactName:  data.TextPointer(row.EmergencyContactName),
		EmergencyContactPhone: data.TextPointer(row.EmergencyContactPhone),
		Status:                string(row.StudentStatus), EnrolledAt: data.DateString(row.EnrolledAt),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func viewFromList(row db.ListAdminStudentsRow) View {
	return View{
		ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
		Email: row.Email, AccountStatus: string(row.UserStatus),
		StudentCode: row.StudentCode, FullName: row.FullName, AvatarURL: data.TextPointer(row.AvatarUrl),
		Phone: data.TextPointer(row.Phone), DateOfBirth: data.DateString(row.DateOfBirth),
		Gender: data.TextPointer(row.Gender), Address: data.TextPointer(row.Address),
		EmergencyContactName:  data.TextPointer(row.EmergencyContactName),
		EmergencyContactPhone: data.TextPointer(row.EmergencyContactPhone),
		Status:                string(row.StudentStatus), EnrolledAt: data.DateString(row.EnrolledAt),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}
