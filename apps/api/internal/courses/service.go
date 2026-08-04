// Package courses implements administrator course-catalog management.
package courses

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
	ErrCourseNotFound    = errors.New("course not found")
	ErrModuleNotFound    = errors.New("course module not found")
	ErrCriterionNotFound = errors.New("competency criterion not found")
	ErrCourseConflict    = errors.New("course code already exists")
	ErrModuleConflict    = errors.New("course module code or sequence already exists")
	ErrCriterionConflict = errors.New("competency code or sequence already exists")
	ErrModuleCourse      = errors.New("module does not belong to course")
)

type CourseView struct {
	ID                   string  `json:"id"`
	Code                 string  `json:"code"`
	Name                 string  `json:"name"`
	Description          *string `json:"description"`
	TotalSessions        int32   `json:"total_sessions"`
	MinimumAttendancePct float64 `json:"minimum_attendance_pct"`
	Status               string  `json:"status"`
	CreatedAt            string  `json:"created_at"`
	UpdatedAt            string  `json:"updated_at"`
}

type ModuleView struct {
	ID              string  `json:"id"`
	CourseID        string  `json:"course_id"`
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	SequenceNo      int32   `json:"sequence_no"`
	PlannedSessions int32   `json:"planned_sessions"`
	Description     *string `json:"description"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type CriterionView struct {
	ID          string  `json:"id"`
	CourseID    string  `json:"course_id"`
	ModuleID    *string `json:"module_id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsRequired  bool    `json:"is_required"`
	SequenceNo  int32   `json:"sequence_no"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type CourseInput struct {
	Code                 string
	Name                 string
	Description          *string
	TotalSessions        int32
	MinimumAttendancePct float64
	Status               db.CourseStatus
}

type ModuleInput struct {
	Code            string
	Name            string
	SequenceNo      int32
	PlannedSessions int32
	Description     *string
}

type CriterionInput struct {
	ModuleID    *string
	Code        string
	Name        string
	Description *string
	IsRequired  bool
	SequenceNo  int32
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

type ListFilter struct {
	Search    string
	Status    string
	SortBy    string
	SortOrder string
	Page      int
	PerPage   int
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, queries: db.New(pool)}
}

func (s *Service) Create(ctx context.Context, actorID string, input CourseInput) (CourseView, error) {
	numeric, err := data.Numeric(input.MinimumAttendancePct)
	if err != nil {
		return CourseView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CourseView{}, fmt.Errorf("begin create course: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	course, err := q.CreateCourse(ctx, db.CreateCourseParams{
		Code: input.Code, Name: input.Name, Description: data.Text(input.Description),
		TotalSessions: input.TotalSessions, MinimumAttendancePct: numeric, Status: input.Status,
	})
	if err != nil {
		return CourseView{}, mapCourseWriteError(err)
	}
	view := courseView(course)
	if err := audit.Write(ctx, q, actorID, "course.create", "course", course.ID, nil, view); err != nil {
		return CourseView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CourseView{}, fmt.Errorf("commit create course: %w", err)
	}
	return view, nil
}

func (s *Service) Get(ctx context.Context, id string) (CourseView, error) {
	courseID, err := data.UUID(id)
	if err != nil {
		return CourseView{}, ErrCourseNotFound
	}
	course, err := s.queries.GetCourse(ctx, courseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CourseView{}, ErrCourseNotFound
	}
	if err != nil {
		return CourseView{}, fmt.Errorf("get course: %w", err)
	}
	return courseView(course), nil
}

func (s *Service) List(ctx context.Context, filter ListFilter) (pagination.Result[CourseView], error) {
	params := db.ListCoursesParams{
		Search: strings.TrimSpace(filter.Search), Status: filter.Status,
		SortBy: filter.SortBy, SortOrder: filter.SortOrder,
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListCourses(ctx, params)
	if err != nil {
		return pagination.Result[CourseView]{}, fmt.Errorf("list courses: %w", err)
	}
	total, err := s.queries.CountCourses(ctx, db.CountCoursesParams{Search: params.Search, Status: params.Status})
	if err != nil {
		return pagination.Result[CourseView]{}, fmt.Errorf("count courses: %w", err)
	}
	items := make([]CourseView, 0, len(rows))
	for _, row := range rows {
		items = append(items, courseView(row))
	}
	return pagination.New(items, filter.Page, filter.PerPage, total), nil
}

func (s *Service) Update(ctx context.Context, actorID, id string, input CourseInput) (CourseView, error) {
	courseID, err := data.UUID(id)
	if err != nil {
		return CourseView{}, ErrCourseNotFound
	}
	numeric, err := data.Numeric(input.MinimumAttendancePct)
	if err != nil {
		return CourseView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CourseView{}, fmt.Errorf("begin update course: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetCourse(ctx, courseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CourseView{}, ErrCourseNotFound
	}
	if err != nil {
		return CourseView{}, fmt.Errorf("get course for update: %w", err)
	}
	updated, err := q.UpdateCourse(ctx, db.UpdateCourseParams{
		ID: courseID, Code: input.Code, Name: input.Name,
		Description: data.Text(input.Description), TotalSessions: input.TotalSessions,
		MinimumAttendancePct: numeric, Status: input.Status,
	})
	if err != nil {
		return CourseView{}, mapCourseWriteError(err)
	}
	view := courseView(updated)
	if err := audit.Write(ctx, q, actorID, "course.update", "course", courseID, courseView(existing), view); err != nil {
		return CourseView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CourseView{}, fmt.Errorf("commit update course: %w", err)
	}
	return view, nil
}

func (s *Service) CreateModule(ctx context.Context, actorID, courseIDValue string, input ModuleInput) (ModuleView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return ModuleView{}, ErrCourseNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ModuleView{}, fmt.Errorf("begin create module: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	if _, err := q.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return ModuleView{}, ErrCourseNotFound
	} else if err != nil {
		return ModuleView{}, fmt.Errorf("get module course: %w", err)
	}
	module, err := q.CreateCourseModule(ctx, db.CreateCourseModuleParams{
		CourseID: courseID, Code: input.Code, Name: input.Name,
		SequenceNo: input.SequenceNo, PlannedSessions: input.PlannedSessions,
		Description: data.Text(input.Description),
	})
	if err != nil {
		return ModuleView{}, mapModuleWriteError(err)
	}
	view := moduleView(module)
	if err := audit.Write(ctx, q, actorID, "course_module.create", "course_module", module.ID, nil, view); err != nil {
		return ModuleView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ModuleView{}, fmt.Errorf("commit create module: %w", err)
	}
	return view, nil
}

func (s *Service) ListModules(ctx context.Context, courseIDValue string) ([]ModuleView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return nil, ErrCourseNotFound
	}
	if _, err := s.queries.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCourseNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get module course: %w", err)
	}
	rows, err := s.queries.ListCourseModules(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("list modules: %w", err)
	}
	items := make([]ModuleView, 0, len(rows))
	for _, row := range rows {
		items = append(items, moduleView(row))
	}
	return items, nil
}

func (s *Service) UpdateModule(ctx context.Context, actorID, courseIDValue, moduleIDValue string, input ModuleInput) (ModuleView, error) {
	courseID, moduleID, err := parsePair(courseIDValue, moduleIDValue)
	if err != nil {
		return ModuleView{}, ErrModuleNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ModuleView{}, fmt.Errorf("begin update module: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	params := db.GetCourseModuleParams{ID: moduleID, CourseID: courseID}
	existing, err := q.GetCourseModule(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return ModuleView{}, ErrModuleNotFound
	}
	if err != nil {
		return ModuleView{}, fmt.Errorf("get module for update: %w", err)
	}
	updated, err := q.UpdateCourseModule(ctx, db.UpdateCourseModuleParams{
		ID: moduleID, CourseID: courseID, Code: input.Code, Name: input.Name,
		SequenceNo: input.SequenceNo, PlannedSessions: input.PlannedSessions,
		Description: data.Text(input.Description),
	})
	if err != nil {
		return ModuleView{}, mapModuleWriteError(err)
	}
	view := moduleView(updated)
	if err := audit.Write(ctx, q, actorID, "course_module.update", "course_module", moduleID, moduleView(existing), view); err != nil {
		return ModuleView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ModuleView{}, fmt.Errorf("commit update module: %w", err)
	}
	return view, nil
}

func (s *Service) CreateCriterion(ctx context.Context, actorID, courseIDValue string, input CriterionInput) (CriterionView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return CriterionView{}, ErrCourseNotFound
	}
	moduleID, err := optionalUUID(input.ModuleID)
	if err != nil {
		return CriterionView{}, ErrModuleCourse
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CriterionView{}, fmt.Errorf("begin create criterion: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	if _, err := q.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return CriterionView{}, ErrCourseNotFound
	} else if err != nil {
		return CriterionView{}, fmt.Errorf("get criterion course: %w", err)
	}
	if moduleID.Valid {
		if _, err := q.GetCourseModule(ctx, db.GetCourseModuleParams{ID: moduleID, CourseID: courseID}); errors.Is(err, pgx.ErrNoRows) {
			return CriterionView{}, ErrModuleCourse
		} else if err != nil {
			return CriterionView{}, fmt.Errorf("validate criterion module: %w", err)
		}
	}
	criterion, err := q.CreateCompetencyCriterion(ctx, db.CreateCompetencyCriterionParams{
		CourseID: courseID, ModuleID: moduleID, Code: input.Code, Name: input.Name,
		Description: data.Text(input.Description), IsRequired: input.IsRequired, SequenceNo: input.SequenceNo,
	})
	if err != nil {
		return CriterionView{}, mapCriterionWriteError(err)
	}
	view := criterionView(criterion)
	if err := audit.Write(ctx, q, actorID, "competency_criterion.create", "competency_criterion", criterion.ID, nil, view); err != nil {
		return CriterionView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CriterionView{}, fmt.Errorf("commit create criterion: %w", err)
	}
	return view, nil
}

func (s *Service) ListCriteria(ctx context.Context, courseIDValue string) ([]CriterionView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return nil, ErrCourseNotFound
	}
	if _, err := s.queries.GetCourse(ctx, courseID); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCourseNotFound
	} else if err != nil {
		return nil, fmt.Errorf("get criterion course: %w", err)
	}
	rows, err := s.queries.ListCompetencyCriteria(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("list criteria: %w", err)
	}
	items := make([]CriterionView, 0, len(rows))
	for _, row := range rows {
		items = append(items, criterionView(row))
	}
	return items, nil
}

func (s *Service) UpdateCriterion(ctx context.Context, actorID, courseIDValue, criterionIDValue string, input CriterionInput) (CriterionView, error) {
	courseID, criterionID, err := parsePair(courseIDValue, criterionIDValue)
	if err != nil {
		return CriterionView{}, ErrCriterionNotFound
	}
	moduleID, err := optionalUUID(input.ModuleID)
	if err != nil {
		return CriterionView{}, ErrModuleCourse
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CriterionView{}, fmt.Errorf("begin update criterion: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	getParams := db.GetCompetencyCriterionParams{ID: criterionID, CourseID: courseID}
	existing, err := q.GetCompetencyCriterion(ctx, getParams)
	if errors.Is(err, pgx.ErrNoRows) {
		return CriterionView{}, ErrCriterionNotFound
	}
	if err != nil {
		return CriterionView{}, fmt.Errorf("get criterion for update: %w", err)
	}
	if moduleID.Valid {
		if _, err := q.GetCourseModule(ctx, db.GetCourseModuleParams{ID: moduleID, CourseID: courseID}); errors.Is(err, pgx.ErrNoRows) {
			return CriterionView{}, ErrModuleCourse
		} else if err != nil {
			return CriterionView{}, fmt.Errorf("validate criterion module: %w", err)
		}
	}
	updated, err := q.UpdateCompetencyCriterion(ctx, db.UpdateCompetencyCriterionParams{
		ID: criterionID, CourseID: courseID, ModuleID: moduleID,
		Code: input.Code, Name: input.Name, Description: data.Text(input.Description),
		IsRequired: input.IsRequired, SequenceNo: input.SequenceNo,
	})
	if err != nil {
		return CriterionView{}, mapCriterionWriteError(err)
	}
	view := criterionView(updated)
	if err := audit.Write(ctx, q, actorID, "competency_criterion.update", "competency_criterion", criterionID, criterionView(existing), view); err != nil {
		return CriterionView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CriterionView{}, fmt.Errorf("commit update criterion: %w", err)
	}
	return view, nil
}

func mapCourseWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrCourseConflict
	}
	return err
}

func mapModuleWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrModuleConflict
	}
	return err
}

func mapCriterionWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrCriterionConflict
	}
	if dberror.IsCode(err, dberror.ForeignKeyViolation) {
		return ErrModuleCourse
	}
	return err
}

func parsePair(first, second string) (pgtype.UUID, pgtype.UUID, error) {
	firstID, err := data.UUID(first)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	secondID, err := data.UUID(second)
	return firstID, secondID, err
}

func optionalUUID(value *string) (pgtype.UUID, error) {
	if value == nil || *value == "" {
		return pgtype.UUID{}, nil
	}
	return data.UUID(*value)
}

func courseView(row db.Course) CourseView {
	return CourseView{
		ID: data.UUIDString(row.ID), Code: row.Code, Name: row.Name,
		Description: data.TextPointer(row.Description), TotalSessions: row.TotalSessions,
		MinimumAttendancePct: data.NumericFloat(row.MinimumAttendancePct),
		Status:               string(row.Status),
		CreatedAt:            row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:            row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func moduleView(row db.CourseModule) ModuleView {
	return ModuleView{
		ID: data.UUIDString(row.ID), CourseID: data.UUIDString(row.CourseID),
		Code: row.Code, Name: row.Name, SequenceNo: row.SequenceNo,
		PlannedSessions: row.PlannedSessions, Description: data.TextPointer(row.Description),
		CreatedAt: row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}

func criterionView(row db.CompetencyCriterium) CriterionView {
	var moduleID *string
	if row.ModuleID.Valid {
		value := data.UUIDString(row.ModuleID)
		moduleID = &value
	}
	return CriterionView{
		ID: data.UUIDString(row.ID), CourseID: data.UUIDString(row.CourseID),
		ModuleID: moduleID, Code: row.Code, Name: row.Name,
		Description: data.TextPointer(row.Description), IsRequired: row.IsRequired,
		SequenceNo: row.SequenceNo,
		CreatedAt:  row.CreatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
		UpdatedAt:  row.UpdatedAt.Time.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"),
	}
}
