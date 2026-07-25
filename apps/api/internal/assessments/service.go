// Package assessments implements practical competency assessment history and
// the draft -> submitted -> locked lifecycle.
package assessments

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
	ErrAssessmentNotFound   = errors.New("assessment not found")
	ErrTeacherNotAssigned   = errors.New("teacher is not assigned to the class")
	ErrAssessmentOwner      = errors.New("only the assessing teacher may change this assessment")
	ErrStudentNotEnrolled   = errors.New("student is not actively enrolled in the class")
	ErrSessionMismatch      = errors.New("assessment session does not belong to the class and course")
	ErrCriterionMismatch    = errors.New("competency criterion does not belong to the course")
	ErrDuplicateCriterion   = errors.New("competency criterion appears more than once")
	ErrAssessmentState      = errors.New("assessment state does not allow this operation")
	ErrAssessmentIncomplete = errors.New("all required competencies must be rated before submission")
	ErrAssessmentConflict   = errors.New("assessment number already exists")
)

type ItemInput struct {
	CriterionID string
	Rating      db.CompetencyRating
	Comment     *string
}

type WriteInput struct {
	SessionID      *string
	OverallComment *string
	Items          []ItemInput
}

type ItemView struct {
	ID          string  `json:"id"`
	CriterionID string  `json:"competency_criterion_id"`
	Code        string  `json:"criterion_code"`
	Name        string  `json:"criterion_name"`
	IsRequired  bool    `json:"is_required"`
	SequenceNo  int32   `json:"sequence_no"`
	Rating      string  `json:"rating"`
	Comment     *string `json:"comment"`
	AssessedAt  *string `json:"assessed_at"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type View struct {
	ID             string     `json:"id"`
	ClassID        string     `json:"class_id"`
	ClassCode      string     `json:"class_code"`
	ClassName      string     `json:"class_name"`
	CourseID       string     `json:"course_id"`
	CourseCode     string     `json:"course_code"`
	CourseName     string     `json:"course_name"`
	StudentID      string     `json:"student_id"`
	StudentCode    string     `json:"student_code"`
	StudentName    string     `json:"student_name"`
	AssessedBy     string     `json:"assessed_by"`
	TeacherCode    string     `json:"teacher_code"`
	TeacherName    string     `json:"teacher_name"`
	SessionID      *string    `json:"session_id"`
	SessionTitle   *string    `json:"session_title"`
	AssessmentNo   int32      `json:"assessment_no"`
	Status         string     `json:"status"`
	OverallComment *string    `json:"overall_comment"`
	SubmittedAt    *string    `json:"submitted_at"`
	LockedAt       *string    `json:"locked_at"`
	Items          []ItemView `json:"items"`
	CreatedAt      string     `json:"created_at"`
	UpdatedAt      string     `json:"updated_at"`
}

type headerData struct {
	ID             pgtype.UUID
	ClassID        pgtype.UUID
	ClassCode      string
	ClassName      string
	CourseID       pgtype.UUID
	CourseCode     string
	CourseName     string
	StudentID      pgtype.UUID
	StudentCode    string
	StudentName    string
	AssessedBy     pgtype.UUID
	TeacherCode    string
	TeacherName    string
	SessionID      pgtype.UUID
	SessionTitle   pgtype.Text
	AssessmentNo   int32
	Status         db.AssessmentStatus
	OverallComment pgtype.Text
	SubmittedAt    pgtype.Timestamptz
	LockedAt       pgtype.Timestamptz
	CreatedAt      pgtype.Timestamptz
	UpdatedAt      pgtype.Timestamptz
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, queries: db.New(pool)}
}

func (s *Service) Create(
	ctx context.Context,
	userID string,
	classIDValue string,
	studentIDValue string,
	input WriteInput,
) (View, error) {
	classID, studentID, err := parsePair(classIDValue, studentIDValue)
	if err != nil {
		return View{}, ErrStudentNotEnrolled
	}
	userUUID, err := data.UUID(userID)
	if err != nil {
		return View{}, ErrTeacherNotAssigned
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create assessment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	enrollment, err := q.GetAssessmentEnrollmentForUpdate(ctx, db.GetAssessmentEnrollmentForUpdateParams{
		ClassID: classID, StudentID: studentID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrStudentNotEnrolled
	}
	if err != nil {
		return View{}, fmt.Errorf("get assessment enrollment: %w", err)
	}
	if enrollment.EnrollmentStatus != db.EnrollmentStatusEnrolled {
		return View{}, ErrStudentNotEnrolled
	}
	teacher, err := q.GetAssignedAssessmentTeacher(ctx, db.GetAssignedAssessmentTeacherParams{
		ClassID: classID, UserID: userUUID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrTeacherNotAssigned
	}
	if err != nil {
		return View{}, fmt.Errorf("get assigned assessment teacher: %w", err)
	}
	sessionID, err := validateSession(ctx, q, input.SessionID, classID, enrollment.CourseID)
	if err != nil {
		return View{}, err
	}
	validatedItems, err := validateItems(ctx, q, enrollment.CourseID, input.Items)
	if err != nil {
		return View{}, err
	}
	assessmentNo, err := q.GetNextAssessmentNumber(ctx, db.GetNextAssessmentNumberParams{
		ClassID: classID, StudentID: studentID,
	})
	if err != nil {
		return View{}, fmt.Errorf("get next assessment number: %w", err)
	}
	created, err := q.CreateStudentAssessment(ctx, db.CreateStudentAssessmentParams{
		ClassID: classID, CourseID: enrollment.CourseID, StudentID: studentID,
		AssessedBy: teacher.ID, SessionID: sessionID, AssessmentNo: assessmentNo,
		OverallComment: data.Text(input.OverallComment),
	})
	if err != nil {
		return View{}, mapWriteError(err)
	}
	if err := insertItems(ctx, q, created.ID, enrollment.CourseID, validatedItems); err != nil {
		return View{}, err
	}
	view, err := loadView(ctx, q, created.ID)
	if err != nil {
		return View{}, err
	}
	if err := audit.Write(ctx, q, userID, "assessment.create", "student_assessment", created.ID, nil, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create assessment: %w", err)
	}
	return view, nil
}

func (s *Service) Update(ctx context.Context, userID, assessmentIDValue string, input WriteInput) (View, error) {
	assessmentID, err := data.UUID(assessmentIDValue)
	if err != nil {
		return View{}, ErrAssessmentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update assessment: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	header, err := lockHeader(ctx, q, assessmentID)
	if err != nil {
		return View{}, err
	}
	if err := authorizeOwner(ctx, q, userID, header); err != nil {
		return View{}, err
	}
	if header.Status != db.AssessmentStatusDraft {
		return View{}, ErrAssessmentState
	}
	oldView, err := buildView(ctx, q, header)
	if err != nil {
		return View{}, err
	}
	sessionID, err := validateSession(ctx, q, input.SessionID, header.ClassID, header.CourseID)
	if err != nil {
		return View{}, err
	}
	validatedItems, err := validateItems(ctx, q, header.CourseID, input.Items)
	if err != nil {
		return View{}, err
	}
	if _, err := q.UpdateDraftAssessment(ctx, db.UpdateDraftAssessmentParams{
		ID: assessmentID, SessionID: sessionID, OverallComment: data.Text(input.OverallComment),
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return View{}, ErrAssessmentState
		}
		return View{}, fmt.Errorf("update draft assessment: %w", err)
	}
	if err := q.DeleteAssessmentItems(ctx, assessmentID); err != nil {
		return View{}, fmt.Errorf("replace assessment items: %w", err)
	}
	if err := insertItems(ctx, q, assessmentID, header.CourseID, validatedItems); err != nil {
		return View{}, err
	}
	view, err := loadView(ctx, q, assessmentID)
	if err != nil {
		return View{}, err
	}
	if err := audit.Write(ctx, q, userID, "assessment.update", "student_assessment", assessmentID, oldView, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update assessment: %w", err)
	}
	return view, nil
}

func (s *Service) Submit(ctx context.Context, userID, assessmentIDValue string) (View, error) {
	return s.transition(ctx, userID, assessmentIDValue, db.AssessmentStatusDraft, "assessment.submit")
}

func (s *Service) Lock(ctx context.Context, userID, assessmentIDValue string) (View, error) {
	return s.transition(ctx, userID, assessmentIDValue, db.AssessmentStatusSubmitted, "assessment.lock")
}

func (s *Service) transition(
	ctx context.Context,
	userID string,
	assessmentIDValue string,
	expected db.AssessmentStatus,
	action string,
) (View, error) {
	assessmentID, err := data.UUID(assessmentIDValue)
	if err != nil {
		return View{}, ErrAssessmentNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin assessment transition: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	header, err := lockHeader(ctx, q, assessmentID)
	if err != nil {
		return View{}, err
	}
	if err := authorizeOwner(ctx, q, userID, header); err != nil {
		return View{}, err
	}
	if header.Status != expected {
		return View{}, ErrAssessmentState
	}
	oldView, err := buildView(ctx, q, header)
	if err != nil {
		return View{}, err
	}
	if expected == db.AssessmentStatusDraft {
		missing, err := q.CountMissingRequiredAssessmentItems(ctx, db.CountMissingRequiredAssessmentItemsParams{
			CourseID: header.CourseID, AssessmentID: assessmentID,
		})
		if err != nil {
			return View{}, fmt.Errorf("check required assessment items: %w", err)
		}
		if missing > 0 {
			return View{}, ErrAssessmentIncomplete
		}
		if _, err := q.SubmitAssessment(ctx, assessmentID); err != nil {
			return View{}, fmt.Errorf("submit assessment: %w", err)
		}
	} else {
		if _, err := q.LockAssessment(ctx, assessmentID); err != nil {
			return View{}, fmt.Errorf("lock assessment: %w", err)
		}
	}
	view, err := loadView(ctx, q, assessmentID)
	if err != nil {
		return View{}, err
	}
	if err := audit.Write(ctx, q, userID, action, "student_assessment", assessmentID, oldView, view); err != nil {
		return View{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit assessment transition: %w", err)
	}
	return view, nil
}

func (s *Service) GetTeacher(ctx context.Context, userID, assessmentIDValue string) (View, error) {
	assessmentID, err := data.UUID(assessmentIDValue)
	if err != nil {
		return View{}, ErrAssessmentNotFound
	}
	row, err := s.queries.GetAssessmentHeader(ctx, assessmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrAssessmentNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get assessment: %w", err)
	}
	header := headerFromGet(row)
	if err := authorizeAssigned(ctx, s.queries, userID, header.ClassID); err != nil {
		return View{}, err
	}
	return buildView(ctx, s.queries, header)
}

func (s *Service) ListTeacher(
	ctx context.Context,
	userID string,
	classIDValue string,
	studentIDValue string,
	page int,
	perPage int,
) (pagination.Result[View], error) {
	classID, studentID, err := parsePair(classIDValue, studentIDValue)
	if err != nil {
		return pagination.Result[View]{}, ErrStudentNotEnrolled
	}
	if err := authorizeAssigned(ctx, s.queries, userID, classID); err != nil {
		return pagination.Result[View]{}, err
	}
	if _, err := s.queries.GetAssessmentEnrollmentForUpdate(ctx, db.GetAssessmentEnrollmentForUpdateParams{
		ClassID: classID, StudentID: studentID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return pagination.Result[View]{}, ErrStudentNotEnrolled
	} else if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("get assessment history enrollment: %w", err)
	}
	rows, err := s.queries.ListTeacherAssessmentHistory(ctx, db.ListTeacherAssessmentHistoryParams{
		ClassID: classID, StudentID: studentID,
		Offset: int32((page - 1) * perPage), Limit: int32(perPage),
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list teacher assessment history: %w", err)
	}
	total, err := s.queries.CountTeacherAssessmentHistory(ctx, db.CountTeacherAssessmentHistoryParams{
		ClassID: classID, StudentID: studentID,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count teacher assessment history: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		view, err := buildView(ctx, s.queries, headerFromTeacher(row))
		if err != nil {
			return pagination.Result[View]{}, err
		}
		items = append(items, view)
	}
	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) ListStudent(
	ctx context.Context,
	userID string,
	classIDValue string,
	page int,
	perPage int,
) (pagination.Result[View], error) {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("invalid student identity")
	}
	classID, err := optionalUUID(classIDValue)
	if err != nil {
		return pagination.Result[View]{}, err
	}
	rows, err := s.queries.ListStudentAssessmentHistory(ctx, db.ListStudentAssessmentHistoryParams{
		UserID: userUUID, ClassID: classID,
		PageOffset: int32((page - 1) * perPage), PageLimit: int32(perPage),
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("list student assessment history: %w", err)
	}
	total, err := s.queries.CountStudentAssessmentHistory(ctx, db.CountStudentAssessmentHistoryParams{
		UserID: userUUID, ClassID: classID,
	})
	if err != nil {
		return pagination.Result[View]{}, fmt.Errorf("count student assessment history: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		view, err := buildView(ctx, s.queries, headerFromStudent(row))
		if err != nil {
			return pagination.Result[View]{}, err
		}
		items = append(items, view)
	}
	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) GetStudent(ctx context.Context, userID, assessmentIDValue string) (View, error) {
	assessmentID, err := data.UUID(assessmentIDValue)
	if err != nil {
		return View{}, ErrAssessmentNotFound
	}
	userUUID, err := data.UUID(userID)
	if err != nil {
		return View{}, ErrAssessmentNotFound
	}
	row, err := s.queries.GetStudentAssessmentHeader(ctx, db.GetStudentAssessmentHeaderParams{
		ID: assessmentID, UserID: userUUID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrAssessmentNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get student assessment: %w", err)
	}
	return buildView(ctx, s.queries, headerFromStudentGet(row))
}

func validateSession(
	ctx context.Context,
	q *db.Queries,
	value *string,
	classID pgtype.UUID,
	courseID pgtype.UUID,
) (pgtype.UUID, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return pgtype.UUID{}, nil
	}
	sessionID, err := data.UUID(strings.TrimSpace(*value))
	if err != nil {
		return pgtype.UUID{}, ErrSessionMismatch
	}
	exists, err := q.CheckAssessmentSession(ctx, db.CheckAssessmentSessionParams{
		ID: sessionID, ClassID: classID, CourseID: courseID,
	})
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("check assessment session: %w", err)
	}
	if !exists {
		return pgtype.UUID{}, ErrSessionMismatch
	}
	return sessionID, nil
}

type validatedItem struct {
	CriterionID pgtype.UUID
	Rating      db.CompetencyRating
	Comment     *string
}

func validateItems(ctx context.Context, q *db.Queries, courseID pgtype.UUID, items []ItemInput) ([]validatedItem, error) {
	seen := make(map[string]struct{}, len(items))
	validated := make([]validatedItem, 0, len(items))
	for _, item := range items {
		criterionID, err := data.UUID(item.CriterionID)
		if err != nil {
			return nil, ErrCriterionMismatch
		}
		canonical := data.UUIDString(criterionID)
		if _, duplicate := seen[canonical]; duplicate {
			return nil, ErrDuplicateCriterion
		}
		seen[canonical] = struct{}{}
		if _, err := q.GetCompetencyCriterion(ctx, db.GetCompetencyCriterionParams{
			ID: criterionID, CourseID: courseID,
		}); errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCriterionMismatch
		} else if err != nil {
			return nil, fmt.Errorf("validate competency criterion: %w", err)
		}
		validated = append(validated, validatedItem{
			CriterionID: criterionID, Rating: item.Rating, Comment: item.Comment,
		})
	}
	return validated, nil
}

func insertItems(
	ctx context.Context,
	q *db.Queries,
	assessmentID pgtype.UUID,
	courseID pgtype.UUID,
	items []validatedItem,
) error {
	for _, item := range items {
		if _, err := q.CreateAssessmentItem(ctx, db.CreateAssessmentItemParams{
			AssessmentID: assessmentID, CourseID: courseID,
			CompetencyCriterionID: item.CriterionID, Rating: item.Rating,
			Comment: data.Text(item.Comment),
		}); err != nil {
			return mapWriteError(err)
		}
	}
	return nil
}

func loadView(ctx context.Context, q *db.Queries, assessmentID pgtype.UUID) (View, error) {
	row, err := q.GetAssessmentHeader(ctx, assessmentID)
	if err != nil {
		return View{}, fmt.Errorf("load assessment header: %w", err)
	}
	return buildView(ctx, q, headerFromGet(row))
}

func buildView(ctx context.Context, q *db.Queries, header headerData) (View, error) {
	rows, err := q.ListAssessmentItems(ctx, header.ID)
	if err != nil {
		return View{}, fmt.Errorf("list assessment items: %w", err)
	}
	items := make([]ItemView, 0, len(rows))
	for _, row := range rows {
		items = append(items, ItemView{
			ID: data.UUIDString(row.ID), CriterionID: data.UUIDString(row.CompetencyCriterionID),
			Code: row.CriterionCode, Name: row.CriterionName, IsRequired: row.IsRequired,
			SequenceNo: row.SequenceNo, Rating: string(row.Rating),
			Comment: data.TextPointer(row.Comment), AssessedAt: data.TimeString(row.AssessedAt),
			CreatedAt: timeValue(row.CreatedAt), UpdatedAt: timeValue(row.UpdatedAt),
		})
	}
	var sessionID *string
	if header.SessionID.Valid {
		value := data.UUIDString(header.SessionID)
		sessionID = &value
	}
	return View{
		ID: data.UUIDString(header.ID), ClassID: data.UUIDString(header.ClassID),
		ClassCode: header.ClassCode, ClassName: header.ClassName,
		CourseID: data.UUIDString(header.CourseID), CourseCode: header.CourseCode, CourseName: header.CourseName,
		StudentID: data.UUIDString(header.StudentID), StudentCode: header.StudentCode, StudentName: header.StudentName,
		AssessedBy: data.UUIDString(header.AssessedBy), TeacherCode: header.TeacherCode, TeacherName: header.TeacherName,
		SessionID: sessionID, SessionTitle: data.TextPointer(header.SessionTitle),
		AssessmentNo: header.AssessmentNo, Status: string(header.Status),
		OverallComment: data.TextPointer(header.OverallComment),
		SubmittedAt:    data.TimeString(header.SubmittedAt), LockedAt: data.TimeString(header.LockedAt),
		Items: items, CreatedAt: timeValue(header.CreatedAt), UpdatedAt: timeValue(header.UpdatedAt),
	}, nil
}

func lockHeader(ctx context.Context, q *db.Queries, assessmentID pgtype.UUID) (headerData, error) {
	row, err := q.GetAssessmentHeaderForUpdate(ctx, assessmentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return headerData{}, ErrAssessmentNotFound
	}
	if err != nil {
		return headerData{}, fmt.Errorf("lock assessment: %w", err)
	}
	return headerFromLocked(row), nil
}

func authorizeAssigned(ctx context.Context, q *db.Queries, userID string, classID pgtype.UUID) error {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return ErrTeacherNotAssigned
	}
	if _, err := q.GetAssignedAssessmentTeacher(ctx, db.GetAssignedAssessmentTeacherParams{
		ClassID: classID, UserID: userUUID,
	}); errors.Is(err, pgx.ErrNoRows) {
		return ErrTeacherNotAssigned
	} else if err != nil {
		return fmt.Errorf("authorize assessment teacher: %w", err)
	}
	return nil
}

func authorizeOwner(ctx context.Context, q *db.Queries, userID string, header headerData) error {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return ErrTeacherNotAssigned
	}
	teacher, err := q.GetAssignedAssessmentTeacher(ctx, db.GetAssignedAssessmentTeacherParams{
		ClassID: header.ClassID, UserID: userUUID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrTeacherNotAssigned
	}
	if err != nil {
		return fmt.Errorf("authorize assessment owner: %w", err)
	}
	if teacher.ID != header.AssessedBy {
		return ErrAssessmentOwner
	}
	return nil
}

func mapWriteError(err error) error {
	switch {
	case dberror.IsCode(err, dberror.UniqueViolation):
		return ErrAssessmentConflict
	case dberror.IsCode(err, dberror.ForeignKeyViolation):
		switch dberror.Constraint(err) {
		case "assessment_items_criterion_fk":
			return ErrCriterionMismatch
		case "student_assessments_session_fk":
			return ErrSessionMismatch
		case "student_assessments_enrollment_fk":
			return ErrStudentNotEnrolled
		default:
			return ErrTeacherNotAssigned
		}
	default:
		return fmt.Errorf("write assessment: %w", err)
	}
}

func parsePair(first, second string) (pgtype.UUID, pgtype.UUID, error) {
	firstID, err := data.UUID(first)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	secondID, err := data.UUID(second)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	return firstID, secondID, nil
}

func optionalUUID(value string) (pgtype.UUID, error) {
	if strings.TrimSpace(value) == "" {
		return pgtype.UUID{}, nil
	}
	id, err := data.UUID(value)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("class_id must be a valid UUID")
	}
	return id, nil
}

func timeValue(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339Nano)
}

func headerFromGet(row db.GetAssessmentHeaderRow) headerData {
	return headerData{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		StudentID: row.StudentID, StudentCode: row.StudentCode, StudentName: row.StudentName,
		AssessedBy: row.AssessedBy, TeacherCode: row.TeacherCode, TeacherName: row.TeacherName,
		SessionID: row.SessionID, SessionTitle: row.SessionTitle, AssessmentNo: row.AssessmentNo,
		Status: row.Status, OverallComment: row.OverallComment, SubmittedAt: row.SubmittedAt,
		LockedAt: row.LockedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func headerFromLocked(row db.GetAssessmentHeaderForUpdateRow) headerData {
	return headerData{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		StudentID: row.StudentID, StudentCode: row.StudentCode, StudentName: row.StudentName,
		AssessedBy: row.AssessedBy, TeacherCode: row.TeacherCode, TeacherName: row.TeacherName,
		SessionID: row.SessionID, SessionTitle: row.SessionTitle, AssessmentNo: row.AssessmentNo,
		Status: row.Status, OverallComment: row.OverallComment, SubmittedAt: row.SubmittedAt,
		LockedAt: row.LockedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func headerFromTeacher(row db.ListTeacherAssessmentHistoryRow) headerData {
	return headerData{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		StudentID: row.StudentID, StudentCode: row.StudentCode, StudentName: row.StudentName,
		AssessedBy: row.AssessedBy, TeacherCode: row.TeacherCode, TeacherName: row.TeacherName,
		SessionID: row.SessionID, SessionTitle: row.SessionTitle, AssessmentNo: row.AssessmentNo,
		Status: row.Status, OverallComment: row.OverallComment, SubmittedAt: row.SubmittedAt,
		LockedAt: row.LockedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func headerFromStudent(row db.ListStudentAssessmentHistoryRow) headerData {
	return headerData{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		StudentID: row.StudentID, StudentCode: row.StudentCode, StudentName: row.StudentName,
		AssessedBy: row.AssessedBy, TeacherCode: row.TeacherCode, TeacherName: row.TeacherName,
		SessionID: row.SessionID, SessionTitle: row.SessionTitle, AssessmentNo: row.AssessmentNo,
		Status: row.Status, OverallComment: row.OverallComment, SubmittedAt: row.SubmittedAt,
		LockedAt: row.LockedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}

func headerFromStudentGet(row db.GetStudentAssessmentHeaderRow) headerData {
	return headerData{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		StudentID: row.StudentID, StudentCode: row.StudentCode, StudentName: row.StudentName,
		AssessedBy: row.AssessedBy, TeacherCode: row.TeacherCode, TeacherName: row.TeacherName,
		SessionID: row.SessionID, SessionTitle: row.SessionTitle, AssessmentNo: row.AssessmentNo,
		Status: row.Status, OverallComment: row.OverallComment, SubmittedAt: row.SubmittedAt,
		LockedAt: row.LockedAt, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
}
