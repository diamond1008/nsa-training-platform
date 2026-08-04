// Package teachers implements administrator teacher-account management.
package teachers

import (
	"context"
	"errors"
	"fmt"
	"strings"

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
	ErrNotFound      = errors.New("teacher not found")
	ErrEmailConflict = errors.New("email already exists")
	ErrCodeConflict  = errors.New("teacher code already exists")
)

type ListFilter struct {
	Search     string
	Status     string
	ClassID    string
	CourseID   string
	Assignment string
	SortBy     string
	SortOrder  string
	Page       int
	PerPage    int
}

type View struct {
	ID             string  `json:"id"`
	UserID         string  `json:"user_id"`
	Email          string  `json:"email"`
	AccountStatus  string  `json:"account_status"`
	TeacherCode    string  `json:"teacher_code"`
	FullName       string  `json:"full_name"`
	Phone          *string `json:"phone"`
	Specialization *string `json:"specialization"`
	Status         string  `json:"status"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type WriteInput struct {
	Email          string
	Password       string
	AccountStatus  db.UserStatus
	TeacherCode    string
	FullName       string
	Phone          *string
	Specialization *string
	Status         db.TeacherStatus
}

type Service struct {
	pool       *pgxpool.Pool
	queries    *db.Queries
	bcryptCost int
}

func NewService(pool *pgxpool.Pool, bcryptCost int) *Service {
	return &Service{pool: pool, queries: db.New(pool), bcryptCost: bcryptCost}
}

func (s *Service) Create(ctx context.Context, actorID string, input WriteInput) (View, error) {
	passwordHash, err := auth.HashPassword(input.Password, s.bcryptCost)
	if err != nil {
		return View{}, fmt.Errorf("hash temporary password: %w", err)
	}
	actor, err := data.UUID(actorID)
	if err != nil {
		return View{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create teacher: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	user, err := q.CreateManagedUser(ctx, db.CreateManagedUserParams{
		Email: input.Email, PasswordHash: passwordHash, Status: input.AccountStatus,
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	if err := q.AssignManagedUserRole(ctx, db.AssignManagedUserRoleParams{
		UserID: user.ID, Code: auth.RoleTeacher, AssignedBy: actor,
	}); err != nil {
		return View{}, fmt.Errorf("assign teacher role: %w", err)
	}
	profile, err := q.CreateTeacherProfile(ctx, db.CreateTeacherProfileParams{
		UserID: user.ID, TeacherCode: input.TeacherCode, FullName: input.FullName,
		Phone: data.Text(input.Phone), Specialization: data.Text(input.Specialization),
		Status: input.Status,
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	created, err := q.GetAdminTeacher(ctx, profile.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created teacher: %w", err)
	}
	view := viewFromGet(created)
	if err := audit.Write(ctx, q, actorID, "teacher.create", "teacher_profile", profile.ID, nil, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create teacher: %w", err)
	}
	return view, nil
}

func (s *Service) Get(ctx context.Context, id string) (View, error) {
	teacherID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrNotFound
	}
	row, err := s.queries.GetAdminTeacher(ctx, teacherID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get teacher: %w", err)
	}
	return viewFromGet(row), nil
}

func (s *Service) List(ctx context.Context, filter ListFilter) (pagination.Result[View], error) {
	classID, err := optionalListUUID(filter.ClassID)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	courseID, err := optionalListUUID(filter.CourseID)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	params := db.ListAdminTeachersParams{
		Search: strings.TrimSpace(filter.Search), Status: filter.Status,
		ClassID: classID, CourseID: courseID, Assignment: filter.Assignment,
		SortBy: filter.SortBy, SortOrder: filter.SortOrder,
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListAdminTeachers(ctx, params)
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list teachers: %w", err)
	}
	total, err := s.queries.CountAdminTeachers(ctx, db.CountAdminTeachersParams{
		Search: params.Search, Status: params.Status, ClassID: classID,
		CourseID: courseID, Assignment: params.Assignment,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count teachers: %w", err)
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

func (s *Service) Update(ctx context.Context, actorID, id string, input WriteInput) (View, error) {
	teacherID, err := data.UUID(id)
	if err != nil {
		return View{}, ErrNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update teacher: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetAdminTeacher(ctx, teacherID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get teacher for update: %w", err)
	}
	oldView := viewFromGet(existing)
	if _, err := q.UpdateManagedUser(ctx, db.UpdateManagedUserParams{
		ID: existing.UserID, Email: input.Email, Status: input.AccountStatus,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	if _, err := q.UpdateTeacherProfile(ctx, db.UpdateTeacherProfileParams{
		ID: teacherID, TeacherCode: input.TeacherCode, FullName: input.FullName,
		Phone: data.Text(input.Phone), Specialization: data.Text(input.Specialization),
		Status: input.Status,
	}); err != nil {
		return View{}, mapWriteError(err)
	}
	updated, err := q.GetAdminTeacher(ctx, teacherID)
	if err != nil {
		return View{}, fmt.Errorf("read updated teacher: %w", err)
	}
	view := viewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "teacher.update", "teacher_profile", teacherID, oldView, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update teacher: %w", err)
	}
	return view, nil
}

func mapWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		switch dberror.Constraint(err) {
		case "users_email_key":
			return ErrEmailConflict
		case "teacher_profiles_teacher_code_key":
			return ErrCodeConflict
		}
	}
	return err
}

func viewFromGet(row db.GetAdminTeacherRow) View {
	return View{
		ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
		Email: row.Email, AccountStatus: string(row.UserStatus),
		TeacherCode: row.TeacherCode, FullName: row.FullName,
		Phone: data.TextPointer(row.Phone), Specialization: data.TextPointer(row.Specialization),
		Status:    string(row.TeacherStatus),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func viewFromList(row db.ListAdminTeachersRow) View {
	return View{
		ID: data.UUIDString(row.ID), UserID: data.UUIDString(row.UserID),
		Email: row.Email, AccountStatus: string(row.UserStatus),
		TeacherCode: row.TeacherCode, FullName: row.FullName,
		Phone: data.TextPointer(row.Phone), Specialization: data.TextPointer(row.Specialization),
		Status:    string(row.TeacherStatus),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}
