// Package students implements administrator student-account management.
package students

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
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
)

// View is the public administrator representation of a student and account.
type View struct {
	ID            string  `json:"id"`
	UserID        string  `json:"user_id"`
	Email         string  `json:"email"`
	AccountStatus string  `json:"account_status"`
	StudentCode   string  `json:"student_code"`
	FullName      string  `json:"full_name"`
	Phone         *string `json:"phone"`
	DateOfBirth   *string `json:"date_of_birth"`
	Status        string  `json:"status"`
	EnrolledAt    *string `json:"enrolled_at"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

// WriteInput contains normalized, validated fields shared by create/update.
type WriteInput struct {
	Email         string
	Password      string
	AccountStatus db.UserStatus
	StudentCode   string
	FullName      string
	Phone         *string
	DateOfBirth   *string
	Status        db.StudentStatus
	EnrolledAt    *string
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
		UserID:      user.ID,
		StudentCode: input.StudentCode,
		FullName:    input.FullName,
		Phone:       data.Text(input.Phone),
		DateOfBirth: dateOfBirth,
		Status:      input.Status,
		EnrolledAt:  enrolledAt,
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	created, err := q.GetAdminStudent(ctx, profile.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created student: %w", err)
	}
	view := viewFromGet(created)
	if err := audit.Write(ctx, q, actorID, "student.create", "student_profile", profile.ID, nil, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create student: %w", err)
	}
	return view, nil
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
func (s *Service) List(ctx context.Context, search, status string, page, perPage int) (pagination.Result[View], error) {
	params := db.ListAdminStudentsParams{
		Search: strings.TrimSpace(search), Status: status,
		PageOffset: int32((page - 1) * perPage), PageLimit: int32(perPage),
	}
	rows, err := s.queries.ListAdminStudents(ctx, params)
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list students: %w", err)
	}
	total, err := s.queries.CountAdminStudents(ctx, db.CountAdminStudentsParams{
		Search: params.Search, Status: params.Status,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count students: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromList(row))
	}
	return pagination.New(items, page, perPage, total), nil
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
	if _, err := q.UpdateManagedUser(ctx, db.UpdateManagedUserParams{
		ID: existing.UserID, Email: input.Email, Status: input.AccountStatus,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	if _, err := q.UpdateStudentProfile(ctx, db.UpdateStudentProfileParams{
		ID:          studentID,
		StudentCode: input.StudentCode,
		FullName:    input.FullName,
		Phone:       data.Text(input.Phone),
		DateOfBirth: dateOfBirth,
		Status:      input.Status,
		EnrolledAt:  enrolledAt,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	updated, err := q.GetAdminStudent(ctx, studentID)
	if err != nil {
		return View{}, fmt.Errorf("read updated student: %w", err)
	}
	view := viewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "student.update", "student_profile", studentID, oldView, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update student: %w", err)
	}
	return view, nil
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
		StudentCode: row.StudentCode, FullName: row.FullName,
		Phone: data.TextPointer(row.Phone), DateOfBirth: data.DateString(row.DateOfBirth),
		Status: string(row.StudentStatus), EnrolledAt: data.DateString(row.EnrolledAt),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func viewFromList(row db.ListAdminStudentsRow) View {
	return View{
		ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
		Email: row.Email, AccountStatus: string(row.UserStatus),
		StudentCode: row.StudentCode, FullName: row.FullName,
		Phone: data.TextPointer(row.Phone), DateOfBirth: data.DateString(row.DateOfBirth),
		Status: string(row.StudentStatus), EnrolledAt: data.DateString(row.EnrolledAt),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}
