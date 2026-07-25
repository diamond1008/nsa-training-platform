// Package schedules implements training locations, class sessions, and
// role-scoped schedule queries.
package schedules

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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
	ErrSessionNotFound      = errors.New("class session not found")
	ErrSessionLocked        = errors.New("class session is locked")
	ErrClassNotFound        = errors.New("class not found")
	ErrClassStatus          = errors.New("class status does not allow scheduling")
	ErrSessionOutsideClass  = errors.New("session is outside class date range")
	ErrModuleCourse         = errors.New("module does not belong to class course")
	ErrTeacherNotFound      = errors.New("teacher not found")
	ErrTeacherInactive      = errors.New("teacher is not active")
	ErrTeacherNotAssigned   = errors.New("teacher is not assigned to class")
	ErrLocationNotFound     = errors.New("training location not found")
	ErrLocationInactive     = errors.New("training location is inactive")
	ErrLocationCodeConflict = errors.New("training location code already exists")
	ErrClassConflict        = errors.New("class has an overlapping session")
	ErrTeacherConflict      = errors.New("teacher has an overlapping session")
	ErrLocationConflict     = errors.New("location has an overlapping session")
)

const presentationTimezone = "Asia/Ho_Chi_Minh"

type LocationView struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	LocationType string `json:"location_type"`
	Capacity     *int32 `json:"capacity"`
	IsActive     bool   `json:"is_active"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type SessionView struct {
	ID                 string  `json:"id"`
	ClassID            string  `json:"class_id"`
	ClassCode          string  `json:"class_code"`
	ClassName          string  `json:"class_name"`
	CourseID           string  `json:"course_id"`
	CourseCode         string  `json:"course_code"`
	CourseName         string  `json:"course_name"`
	ModuleID           *string `json:"module_id"`
	ModuleCode         *string `json:"module_code"`
	ModuleName         *string `json:"module_name"`
	TeacherID          *string `json:"teacher_id"`
	TeacherCode        *string `json:"teacher_code"`
	TeacherName        *string `json:"teacher_name"`
	LocationID         *string `json:"location_id"`
	LocationCode       *string `json:"location_code"`
	LocationName       *string `json:"location_name"`
	LocationType       *string `json:"location_type"`
	Title              string  `json:"title"`
	SessionType        string  `json:"session_type"`
	StartsAt           string  `json:"starts_at"`
	EndsAt             string  `json:"ends_at"`
	Status             string  `json:"status"`
	AttendanceLockedAt *string `json:"attendance_locked_at"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

type LocationInput struct {
	Code         string
	Name         string
	LocationType string
	Capacity     *int32
	IsActive     bool
}

type SessionInput struct {
	ClassID     string
	ModuleID    *string
	TeacherID   *string
	LocationID  *string
	Title       string
	SessionType db.SessionType
	StartsAt    time.Time
	EndsAt      time.Time
	Status      db.SessionStatus
}

type ListFilter struct {
	Search     string
	Status     string
	ClassID    string
	TeacherID  string
	LocationID string
	From       *time.Time
	To         *time.Time
	Page       int
	PerPage    int
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, queries: db.New(pool)}
}

func (s *Service) CreateLocation(ctx context.Context, actorID string, input LocationInput) (LocationView, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LocationView{}, fmt.Errorf("begin create location: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	location, err := q.CreateTrainingLocation(ctx, db.CreateTrainingLocationParams{
		Code: input.Code, Name: input.Name, LocationType: input.LocationType,
		Capacity: nullableInt4(input.Capacity), IsActive: input.IsActive,
	})
	if err != nil {
		return LocationView{}, mapLocationWriteError(err)
	}
	view := locationView(location)
	if err := audit.Write(ctx, q, actorID, "training_location.create", "training_location", location.ID, nil, view); err != nil {
		return LocationView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LocationView{}, fmt.Errorf("commit create location: %w", err)
	}
	return view, nil
}

func (s *Service) GetLocation(ctx context.Context, id string) (LocationView, error) {
	locationID, err := data.UUID(id)
	if err != nil {
		return LocationView{}, ErrLocationNotFound
	}
	location, err := s.queries.GetTrainingLocation(ctx, locationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return LocationView{}, ErrLocationNotFound
	}
	if err != nil {
		return LocationView{}, fmt.Errorf("get location: %w", err)
	}
	return locationView(location), nil
}

func (s *Service) ListLocations(ctx context.Context, search string, active *bool, page, perPage int) (pagination.Result[LocationView], error) {
	activeParam := pgtype.Bool{}
	if active != nil {
		activeParam = pgtype.Bool{Bool: *active, Valid: true}
	}
	params := db.ListTrainingLocationsParams{
		Search: strings.TrimSpace(search), IsActive: activeParam,
		PageOffset: int32((page - 1) * perPage), PageLimit: int32(perPage),
	}
	rows, err := s.queries.ListTrainingLocations(ctx, params)
	if err != nil {
		return pagination.Result[LocationView]{}, fmt.Errorf("list locations: %w", err)
	}
	total, err := s.queries.CountTrainingLocations(ctx, db.CountTrainingLocationsParams{
		Search: params.Search, IsActive: activeParam,
	})
	if err != nil {
		return pagination.Result[LocationView]{}, fmt.Errorf("count locations: %w", err)
	}
	items := make([]LocationView, 0, len(rows))
	for _, row := range rows {
		items = append(items, locationView(row))
	}
	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) UpdateLocation(ctx context.Context, actorID, id string, input LocationInput) (LocationView, error) {
	locationID, err := data.UUID(id)
	if err != nil {
		return LocationView{}, ErrLocationNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LocationView{}, fmt.Errorf("begin update location: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetTrainingLocation(ctx, locationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return LocationView{}, ErrLocationNotFound
	}
	if err != nil {
		return LocationView{}, fmt.Errorf("get location for update: %w", err)
	}
	updated, err := q.UpdateTrainingLocation(ctx, db.UpdateTrainingLocationParams{
		ID: locationID, Code: input.Code, Name: input.Name,
		LocationType: input.LocationType, Capacity: nullableInt4(input.Capacity),
		IsActive: input.IsActive,
	})
	if err != nil {
		return LocationView{}, mapLocationWriteError(err)
	}
	view := locationView(updated)
	if err := audit.Write(ctx, q, actorID, "training_location.update", "training_location", locationID, locationView(existing), view); err != nil {
		return LocationView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LocationView{}, fmt.Errorf("commit update location: %w", err)
	}
	return view, nil
}

func (s *Service) CreateSession(ctx context.Context, actorID string, input SessionInput) (SessionView, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionView{}, fmt.Errorf("begin create session: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	params, err := s.buildSessionParams(ctx, q, actorID, input)
	if err != nil {
		return SessionView{}, err
	}
	created, err := q.CreateClassSession(ctx, params)
	if err != nil {
		return SessionView{}, mapSessionWriteError(err)
	}
	row, err := q.GetClassSession(ctx, created.ID)
	if err != nil {
		return SessionView{}, fmt.Errorf("read created session: %w", err)
	}
	view := viewFromGet(row)
	if err := audit.Write(ctx, q, actorID, "class_session.create", "class_session", created.ID, nil, view); err != nil {
		return SessionView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SessionView{}, fmt.Errorf("commit create session: %w", err)
	}
	return view, nil
}

func (s *Service) GetSession(ctx context.Context, id string) (SessionView, error) {
	sessionID, err := data.UUID(id)
	if err != nil {
		return SessionView{}, ErrSessionNotFound
	}
	row, err := s.queries.GetClassSession(ctx, sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionView{}, ErrSessionNotFound
	}
	if err != nil {
		return SessionView{}, fmt.Errorf("get session: %w", err)
	}
	return viewFromGet(row), nil
}

func (s *Service) UpdateSession(ctx context.Context, actorID, id string, input SessionInput) (SessionView, error) {
	sessionID, err := data.UUID(id)
	if err != nil {
		return SessionView{}, ErrSessionNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionView{}, fmt.Errorf("begin update session: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	existing, err := q.GetClassSession(ctx, sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionView{}, ErrSessionNotFound
	}
	if err != nil {
		return SessionView{}, fmt.Errorf("get session for update: %w", err)
	}
	if existing.Status == db.SessionStatusLocked || existing.AttendanceLockedAt.Valid {
		return SessionView{}, ErrSessionLocked
	}
	createParams, err := s.buildSessionParams(ctx, q, actorID, input)
	if err != nil {
		return SessionView{}, err
	}
	if _, err := q.UpdateClassSession(ctx, db.UpdateClassSessionParams{
		ID: sessionID, ClassID: createParams.ClassID, CourseID: createParams.CourseID,
		ModuleID: createParams.ModuleID, TeacherID: createParams.TeacherID,
		LocationID: createParams.LocationID, Title: createParams.Title,
		SessionType: createParams.SessionType, StartsAt: createParams.StartsAt,
		EndsAt: createParams.EndsAt, Status: createParams.Status,
	}); err != nil {
		return SessionView{}, mapSessionWriteError(err)
	}
	updated, err := q.GetClassSession(ctx, sessionID)
	if err != nil {
		return SessionView{}, fmt.Errorf("read updated session: %w", err)
	}
	view := viewFromGet(updated)
	if err := audit.Write(ctx, q, actorID, "class_session.update", "class_session", sessionID, viewFromGet(existing), view); err != nil {
		return SessionView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SessionView{}, fmt.Errorf("commit update session: %w", err)
	}
	return view, nil
}

func (s *Service) ListAdmin(ctx context.Context, filter ListFilter) (pagination.Result[SessionView], error) {
	classID, err := optionalUUIDString(filter.ClassID)
	if err != nil {
		return pagination.Result[SessionView]{}, ErrClassNotFound
	}
	teacherID, err := optionalUUIDString(filter.TeacherID)
	if err != nil {
		return pagination.Result[SessionView]{}, ErrTeacherNotFound
	}
	locationID, err := optionalUUIDString(filter.LocationID)
	if err != nil {
		return pagination.Result[SessionView]{}, ErrLocationNotFound
	}
	fromTime, toTime := nullableTime(filter.From), nullableTime(filter.To)
	params := db.ListAdminSessionsParams{
		Search: strings.TrimSpace(filter.Search), Status: filter.Status,
		ClassID: classID, TeacherID: teacherID, LocationID: locationID,
		FromTime: fromTime, ToTime: toTime,
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListAdminSessions(ctx, params)
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("list admin sessions: %w", err)
	}
	total, err := s.queries.CountAdminSessions(ctx, db.CountAdminSessionsParams{
		Search: params.Search, Status: params.Status, ClassID: classID,
		TeacherID: teacherID, LocationID: locationID, FromTime: fromTime, ToTime: toTime,
	})
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("count admin sessions: %w", err)
	}
	items := make([]SessionView, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromAdmin(row))
	}
	return pagination.New(items, filter.Page, filter.PerPage, total), nil
}

func (s *Service) ListTeacher(ctx context.Context, userIDValue string, filter ListFilter) (pagination.Result[SessionView], error) {
	userID, err := data.UUID(userIDValue)
	if err != nil {
		return pagination.Result[SessionView]{}, ErrTeacherNotFound
	}
	params := db.ListTeacherScheduleParams{
		UserID: userID, FromTime: nullableTime(filter.From), ToTime: nullableTime(filter.To),
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListTeacherSchedule(ctx, params)
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("list teacher schedule: %w", err)
	}
	total, err := s.queries.CountTeacherSchedule(ctx, db.CountTeacherScheduleParams{
		UserID: userID, FromTime: params.FromTime, ToTime: params.ToTime,
	})
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("count teacher schedule: %w", err)
	}
	items := make([]SessionView, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromTeacher(row))
	}
	return pagination.New(items, filter.Page, filter.PerPage, total), nil
}

func (s *Service) ListStudent(ctx context.Context, userIDValue string, filter ListFilter) (pagination.Result[SessionView], error) {
	userID, err := data.UUID(userIDValue)
	if err != nil {
		return pagination.Result[SessionView]{}, ErrSessionNotFound
	}
	params := db.ListStudentScheduleParams{
		UserID: userID, FromTime: nullableTime(filter.From), ToTime: nullableTime(filter.To),
		PageOffset: int32((filter.Page - 1) * filter.PerPage), PageLimit: int32(filter.PerPage),
	}
	rows, err := s.queries.ListStudentSchedule(ctx, params)
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("list student schedule: %w", err)
	}
	total, err := s.queries.CountStudentSchedule(ctx, db.CountStudentScheduleParams{
		UserID: userID, FromTime: params.FromTime, ToTime: params.ToTime,
	})
	if err != nil {
		return pagination.Result[SessionView]{}, fmt.Errorf("count student schedule: %w", err)
	}
	items := make([]SessionView, 0, len(rows))
	for _, row := range rows {
		items = append(items, viewFromStudent(row))
	}
	return pagination.New(items, filter.Page, filter.PerPage, total), nil
}

func (s *Service) buildSessionParams(ctx context.Context, q *db.Queries, actorID string, input SessionInput) (db.CreateClassSessionParams, error) {
	classID, err := data.UUID(input.ClassID)
	if err != nil {
		return db.CreateClassSessionParams{}, ErrClassNotFound
	}
	classRow, err := q.GetAdminClass(ctx, classID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.CreateClassSessionParams{}, ErrClassNotFound
	}
	if err != nil {
		return db.CreateClassSessionParams{}, fmt.Errorf("get session class: %w", err)
	}
	if classRow.Status != db.ClassStatusPlanning && classRow.Status != db.ClassStatusOpen && classRow.Status != db.ClassStatusInProgress {
		return db.CreateClassSessionParams{}, ErrClassStatus
	}
	if !sessionWithinClassDates(input.StartsAt, input.EndsAt, classRow.StartDate, classRow.EndDate) {
		return db.CreateClassSessionParams{}, ErrSessionOutsideClass
	}
	moduleID, err := optionalUUID(input.ModuleID)
	if err != nil {
		return db.CreateClassSessionParams{}, ErrModuleCourse
	}
	if moduleID.Valid {
		if _, err := q.GetCourseModule(ctx, db.GetCourseModuleParams{
			ID: moduleID, CourseID: classRow.CourseID,
		}); errors.Is(err, pgx.ErrNoRows) {
			return db.CreateClassSessionParams{}, ErrModuleCourse
		} else if err != nil {
			return db.CreateClassSessionParams{}, fmt.Errorf("validate session module: %w", err)
		}
	}
	teacherID, err := optionalUUID(input.TeacherID)
	if err != nil {
		return db.CreateClassSessionParams{}, ErrTeacherNotFound
	}
	if teacherID.Valid {
		teacher, err := q.GetAdminTeacher(ctx, teacherID)
		if errors.Is(err, pgx.ErrNoRows) {
			return db.CreateClassSessionParams{}, ErrTeacherNotFound
		}
		if err != nil {
			return db.CreateClassSessionParams{}, fmt.Errorf("get session teacher: %w", err)
		}
		if teacher.TeacherStatus != db.TeacherStatusActive || teacher.UserStatus != db.UserStatusActive {
			return db.CreateClassSessionParams{}, ErrTeacherInactive
		}
		assigned, err := q.CheckTeacherProfileAssignedToClass(ctx, db.CheckTeacherProfileAssignedToClassParams{
			ClassID: classID, TeacherID: teacherID,
		})
		if err != nil {
			return db.CreateClassSessionParams{}, fmt.Errorf("check teacher assignment: %w", err)
		}
		if !assigned {
			return db.CreateClassSessionParams{}, ErrTeacherNotAssigned
		}
	}
	locationID, err := optionalUUID(input.LocationID)
	if err != nil {
		return db.CreateClassSessionParams{}, ErrLocationNotFound
	}
	if locationID.Valid {
		location, err := q.GetTrainingLocation(ctx, locationID)
		if errors.Is(err, pgx.ErrNoRows) {
			return db.CreateClassSessionParams{}, ErrLocationNotFound
		}
		if err != nil {
			return db.CreateClassSessionParams{}, fmt.Errorf("get session location: %w", err)
		}
		if !location.IsActive {
			return db.CreateClassSessionParams{}, ErrLocationInactive
		}
	}
	actor, err := data.UUID(actorID)
	if err != nil {
		return db.CreateClassSessionParams{}, err
	}
	return db.CreateClassSessionParams{
		ClassID: classID, CourseID: classRow.CourseID, ModuleID: moduleID,
		TeacherID: teacherID, LocationID: locationID, Title: input.Title,
		SessionType: input.SessionType,
		StartsAt:    pgtype.Timestamptz{Time: input.StartsAt.UTC(), Valid: true},
		EndsAt:      pgtype.Timestamptz{Time: input.EndsAt.UTC(), Valid: true},
		Status:      input.Status, CreatedBy: actor,
	}, nil
}

func mapLocationWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrLocationCodeConflict
	}
	return err
}

func mapSessionWriteError(err error) error {
	if dberror.IsCode(err, dberror.ExclusionViolation) {
		switch dberror.Constraint(err) {
		case "class_sessions_no_class_overlap":
			return ErrClassConflict
		case "class_sessions_no_teacher_overlap":
			return ErrTeacherConflict
		case "class_sessions_no_location_overlap":
			return ErrLocationConflict
		}
	}
	if dberror.IsCode(err, dberror.ForeignKeyViolation) {
		switch dberror.Constraint(err) {
		case "class_sessions_module_course_fk":
			return ErrModuleCourse
		case "class_sessions_teacher_assignment_fk":
			return ErrTeacherNotAssigned
		case "class_sessions_class_course_fk":
			return ErrClassNotFound
		default:
			return ErrLocationNotFound
		}
	}
	return err
}

func sessionWithinClassDates(startsAt, endsAt time.Time, classStart, classEnd pgtype.Date) bool {
	location, err := time.LoadLocation(presentationTimezone)
	if err != nil {
		location = time.FixedZone("Asia/Saigon", 7*60*60)
	}
	startDate := startsAt.In(location).Format("2006-01-02")
	endDate := endsAt.In(location).Format("2006-01-02")
	return startDate >= classStart.Time.Format("2006-01-02") &&
		endDate <= classEnd.Time.Format("2006-01-02")
}

func nullableInt4(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *value, Valid: true}
}

func nullableTime(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func optionalUUID(value *string) (pgtype.UUID, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return pgtype.UUID{}, nil
	}
	return data.UUID(strings.TrimSpace(*value))
}

func optionalUUIDString(value string) (pgtype.UUID, error) {
	if strings.TrimSpace(value) == "" {
		return pgtype.UUID{}, nil
	}
	return data.UUID(strings.TrimSpace(value))
}

func locationView(row db.TrainingLocation) LocationView {
	var capacity *int32
	if row.Capacity.Valid {
		value := row.Capacity.Int32
		capacity = &value
	}
	return LocationView{
		ID: data.UUIDString(row.ID), Code: row.Code, Name: row.Name,
		LocationType: row.LocationType, Capacity: capacity, IsActive: row.IsActive,
		CreatedAt: row.CreatedAt.Time.UTC().Format(time.RFC3339Nano),
		UpdatedAt: row.UpdatedAt.Time.UTC().Format(time.RFC3339Nano),
	}
}

func sessionView(
	id, classID pgtype.UUID, classCode, className string,
	courseID pgtype.UUID, courseCode, courseName string,
	moduleID pgtype.UUID, moduleCode, moduleName pgtype.Text,
	teacherID pgtype.UUID, teacherCode, teacherName pgtype.Text,
	locationID pgtype.UUID, locationCode, locationName, locationType pgtype.Text,
	title string, sessionType db.SessionType,
	startsAt, endsAt pgtype.Timestamptz, status db.SessionStatus,
	attendanceLockedAt, createdAt, updatedAt pgtype.Timestamptz,
) SessionView {
	return SessionView{
		ID: data.UUIDString(id), ClassID: data.UUIDString(classID),
		ClassCode: classCode, ClassName: className,
		CourseID: data.UUIDString(courseID), CourseCode: courseCode, CourseName: courseName,
		ModuleID: uuidPointer(moduleID), ModuleCode: data.TextPointer(moduleCode), ModuleName: data.TextPointer(moduleName),
		TeacherID: uuidPointer(teacherID), TeacherCode: data.TextPointer(teacherCode), TeacherName: data.TextPointer(teacherName),
		LocationID: uuidPointer(locationID), LocationCode: data.TextPointer(locationCode),
		LocationName: data.TextPointer(locationName), LocationType: data.TextPointer(locationType),
		Title: title, SessionType: string(sessionType),
		StartsAt: startsAt.Time.UTC().Format(time.RFC3339Nano),
		EndsAt:   endsAt.Time.UTC().Format(time.RFC3339Nano), Status: string(status),
		AttendanceLockedAt: data.TimeString(attendanceLockedAt),
		CreatedAt:          createdAt.Time.UTC().Format(time.RFC3339Nano),
		UpdatedAt:          updatedAt.Time.UTC().Format(time.RFC3339Nano),
	}
}

func viewFromGet(row db.GetClassSessionRow) SessionView {
	return sessionView(
		row.ID, row.ClassID, row.ClassCode, row.ClassName,
		row.CourseID, row.CourseCode, row.CourseName,
		row.ModuleID, row.ModuleCode, row.ModuleName,
		row.TeacherID, row.TeacherCode, row.TeacherName,
		row.LocationID, row.LocationCode, row.LocationName, row.LocationType,
		row.Title, row.SessionType, row.StartsAt, row.EndsAt, row.Status,
		row.AttendanceLockedAt, row.CreatedAt, row.UpdatedAt,
	)
}

func viewFromAdmin(row db.ListAdminSessionsRow) SessionView {
	return sessionView(
		row.ID, row.ClassID, row.ClassCode, row.ClassName,
		row.CourseID, row.CourseCode, row.CourseName,
		row.ModuleID, row.ModuleCode, row.ModuleName,
		row.TeacherID, row.TeacherCode, row.TeacherName,
		row.LocationID, row.LocationCode, row.LocationName, row.LocationType,
		row.Title, row.SessionType, row.StartsAt, row.EndsAt, row.Status,
		row.AttendanceLockedAt, row.CreatedAt, row.UpdatedAt,
	)
}

func viewFromStudent(row db.ListStudentScheduleRow) SessionView {
	return sessionView(
		row.ID, row.ClassID, row.ClassCode, row.ClassName,
		row.CourseID, row.CourseCode, row.CourseName,
		row.ModuleID, row.ModuleCode, row.ModuleName,
		row.TeacherID, row.TeacherCode, row.TeacherName,
		row.LocationID, row.LocationCode, row.LocationName, row.LocationType,
		row.Title, row.SessionType, row.StartsAt, row.EndsAt, row.Status,
		row.AttendanceLockedAt, row.CreatedAt, row.UpdatedAt,
	)
}

func viewFromTeacher(row db.ListTeacherScheduleRow) SessionView {
	return sessionView(
		row.ID, row.ClassID, row.ClassCode, row.ClassName,
		row.CourseID, row.CourseCode, row.CourseName,
		row.ModuleID, row.ModuleCode, row.ModuleName,
		row.TeacherID, textFromString(row.TeacherCode), textFromString(row.TeacherName),
		row.LocationID, row.LocationCode, row.LocationName, row.LocationType,
		row.Title, row.SessionType, row.StartsAt, row.EndsAt, row.Status,
		row.AttendanceLockedAt, row.CreatedAt, row.UpdatedAt,
	)
}

func textFromString(value string) pgtype.Text {
	return pgtype.Text{String: value, Valid: value != ""}
}

func uuidPointer(value pgtype.UUID) *string {
	if !value.Valid {
		return nil
	}
	formatted := data.UUIDString(value)
	return &formatted
}
