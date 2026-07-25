// Package attendance implements session rosters, batch attendance recording,
// administrative corrections, locking, and Student self-service history.
package attendance

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
	ErrTeacherNotAssigned   = errors.New("teacher is not assigned to the class")
	ErrSessionCancelled     = errors.New("attendance is unavailable for a cancelled session")
	ErrSessionLocked        = errors.New("session attendance is locked")
	ErrSessionNotStarted    = errors.New("attendance cannot be finalized before the session starts")
	ErrStudentNotEnrolled   = errors.New("student is not actively enrolled in the session class")
	ErrDuplicateStudent     = errors.New("student appears more than once in the batch")
	ErrAttendanceExists     = errors.New("attendance already exists for the student and session")
	ErrAttendanceIncomplete = errors.New("every active student must have attendance before locking")
	ErrAttendanceNotFound   = errors.New("attendance record not found")
)

type BatchItemInput struct {
	StudentID string
	Status    db.AttendanceStatus
	Note      *string
}

type CorrectionInput struct {
	Status db.AttendanceStatus
	Note   *string
	Reason string
}

type SessionView struct {
	ID                 string  `json:"id"`
	ClassID            string  `json:"class_id"`
	ClassCode          string  `json:"class_code"`
	ClassName          string  `json:"class_name"`
	CourseID           string  `json:"course_id"`
	CourseCode         string  `json:"course_code"`
	CourseName         string  `json:"course_name"`
	Title              string  `json:"title"`
	StartsAt           string  `json:"starts_at"`
	EndsAt             string  `json:"ends_at"`
	Status             string  `json:"status"`
	AttendanceLockedAt *string `json:"attendance_locked_at"`
}

type RosterItemView struct {
	StudentID        string  `json:"student_id"`
	StudentCode      string  `json:"student_code"`
	FullName         string  `json:"full_name"`
	EnrollmentStatus string  `json:"enrollment_status"`
	AttendanceID     *string `json:"attendance_id"`
	AttendanceStatus *string `json:"attendance_status"`
	Note             *string `json:"note"`
	RecordedBy       *string `json:"recorded_by"`
	RecordedByEmail  *string `json:"recorded_by_email"`
	RecordedAt       *string `json:"recorded_at"`
	UpdatedAt        *string `json:"updated_at"`
}

type SessionSummary struct {
	Total      int `json:"total"`
	Recorded   int `json:"recorded"`
	Unrecorded int `json:"unrecorded"`
	Present    int `json:"present"`
	Absent     int `json:"absent"`
	Late       int `json:"late"`
	Excused    int `json:"excused"`
}

type SessionAttendanceView struct {
	Session SessionView      `json:"session"`
	Items   []RosterItemView `json:"items"`
	Summary SessionSummary   `json:"summary"`
}

type RecordView struct {
	ID             string  `json:"id"`
	ClassSessionID string  `json:"class_session_id"`
	ClassID        string  `json:"class_id"`
	StudentID      string  `json:"student_id"`
	StudentCode    string  `json:"student_code,omitempty"`
	FullName       string  `json:"full_name,omitempty"`
	Status         string  `json:"status"`
	Note           *string `json:"note"`
	RecordedBy     string  `json:"recorded_by"`
	RecordedAt     string  `json:"recorded_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type LockView struct {
	SessionID             string `json:"session_id"`
	Status                string `json:"status"`
	AttendanceLockedAt    string `json:"attendance_locked_at"`
	AttendanceRecordCount int64  `json:"attendance_record_count"`
}

type StudentHistoryView struct {
	ID             string  `json:"id"`
	ClassSessionID string  `json:"class_session_id"`
	ClassID        string  `json:"class_id"`
	ClassCode      string  `json:"class_code"`
	ClassName      string  `json:"class_name"`
	CourseID       string  `json:"course_id"`
	CourseCode     string  `json:"course_code"`
	CourseName     string  `json:"course_name"`
	SessionTitle   string  `json:"session_title"`
	StartsAt       string  `json:"starts_at"`
	EndsAt         string  `json:"ends_at"`
	Status         string  `json:"status"`
	Note           *string `json:"note"`
	RecordedAt     string  `json:"recorded_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type StudentSummaryView struct {
	ClassID          string  `json:"class_id"`
	ClassCode        string  `json:"class_code"`
	ClassName        string  `json:"class_name"`
	CourseID         string  `json:"course_id"`
	CourseCode       string  `json:"course_code"`
	CourseName       string  `json:"course_name"`
	RecordedSessions int32   `json:"recorded_sessions"`
	PresentSessions  int32   `json:"present_sessions"`
	AbsentSessions   int32   `json:"absent_sessions"`
	LateSessions     int32   `json:"late_sessions"`
	ExcusedSessions  int32   `json:"excused_sessions"`
	AttendancePct    float64 `json:"attendance_pct"`
}

type sessionSnapshot struct {
	ID                 pgtype.UUID
	ClassID            pgtype.UUID
	ClassCode          string
	ClassName          string
	CourseID           pgtype.UUID
	CourseCode         string
	CourseName         string
	Title              string
	StartsAt           pgtype.Timestamptz
	EndsAt             pgtype.Timestamptz
	Status             db.SessionStatus
	AttendanceLockedAt pgtype.Timestamptz
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	now     func() time.Time
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, queries: db.New(pool), now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) GetTeacherSession(ctx context.Context, userID, sessionID string) (SessionAttendanceView, error) {
	id, err := data.UUID(sessionID)
	if err != nil {
		return SessionAttendanceView{}, ErrSessionNotFound
	}
	row, err := s.queries.GetAttendanceSession(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionAttendanceView{}, ErrSessionNotFound
	}
	if err != nil {
		return SessionAttendanceView{}, fmt.Errorf("get attendance session: %w", err)
	}
	session := snapshotFromGet(row)
	if err := checkTeacherAssignment(ctx, s.queries, userID, session.ClassID); err != nil {
		return SessionAttendanceView{}, err
	}
	return s.sessionView(ctx, s.queries, session)
}

func (s *Service) GetAdminSession(ctx context.Context, sessionID string) (SessionAttendanceView, error) {
	id, err := data.UUID(sessionID)
	if err != nil {
		return SessionAttendanceView{}, ErrSessionNotFound
	}
	row, err := s.queries.GetAttendanceSession(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionAttendanceView{}, ErrSessionNotFound
	}
	if err != nil {
		return SessionAttendanceView{}, fmt.Errorf("get admin attendance session: %w", err)
	}
	return s.sessionView(ctx, s.queries, snapshotFromGet(row))
}

func (s *Service) RecordBatch(
	ctx context.Context,
	userID string,
	sessionID string,
	items []BatchItemInput,
) ([]RecordView, error) {
	sessionUUID, err := data.UUID(sessionID)
	if err != nil {
		return nil, ErrSessionNotFound
	}
	actorUUID, err := data.UUID(userID)
	if err != nil {
		return nil, ErrTeacherNotAssigned
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin attendance batch: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	row, err := q.GetAttendanceSessionForUpdate(ctx, sessionUUID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock attendance session: %w", err)
	}
	session := snapshotFromLocked(row)
	if err := checkTeacherAssignment(ctx, q, userID, session.ClassID); err != nil {
		return nil, err
	}
	if err := s.validateWritableSession(session); err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(items))
	created := make([]RecordView, 0, len(items))
	for _, item := range items {
		studentID, err := data.UUID(item.StudentID)
		if err != nil {
			return nil, ErrStudentNotEnrolled
		}
		canonicalID := data.UUIDString(studentID)
		if _, duplicate := seen[canonicalID]; duplicate {
			return nil, ErrDuplicateStudent
		}
		seen[canonicalID] = struct{}{}

		enrolled, err := q.CheckActiveEnrollment(ctx, db.CheckActiveEnrollmentParams{
			ClassID: session.ClassID, StudentID: studentID,
		})
		if err != nil {
			return nil, fmt.Errorf("check attendance enrollment: %w", err)
		}
		if !enrolled {
			return nil, ErrStudentNotEnrolled
		}
		record, err := q.CreateAttendanceRecord(ctx, db.CreateAttendanceRecordParams{
			ClassSessionID: session.ID,
			ClassID:        session.ClassID,
			StudentID:      studentID,
			Status:         item.Status,
			Note:           data.Text(item.Note),
			RecordedBy:     actorUUID,
		})
		if err != nil {
			return nil, mapAttendanceWriteError(err)
		}
		created = append(created, recordView(record))
	}
	if err := audit.Write(
		ctx, q, userID, "attendance.batch_record", "class_session",
		session.ID, nil, created,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit attendance batch: %w", err)
	}
	return created, nil
}

func (s *Service) Lock(ctx context.Context, userID, sessionID string) (LockView, error) {
	sessionUUID, err := data.UUID(sessionID)
	if err != nil {
		return LockView{}, ErrSessionNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LockView{}, fmt.Errorf("begin attendance lock: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	row, err := q.GetAttendanceSessionForUpdate(ctx, sessionUUID)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockView{}, ErrSessionNotFound
	}
	if err != nil {
		return LockView{}, fmt.Errorf("get session for attendance lock: %w", err)
	}
	session := snapshotFromLocked(row)
	if err := checkTeacherAssignment(ctx, q, userID, session.ClassID); err != nil {
		return LockView{}, err
	}
	if err := s.validateWritableSession(session); err != nil {
		return LockView{}, err
	}
	studentCount, err := q.CountActiveSessionStudents(ctx, session.ID)
	if err != nil {
		return LockView{}, fmt.Errorf("count attendance roster: %w", err)
	}
	recordCount, err := q.CountSessionAttendanceRecords(ctx, session.ID)
	if err != nil {
		return LockView{}, fmt.Errorf("count attendance records: %w", err)
	}
	if studentCount != recordCount {
		return LockView{}, ErrAttendanceIncomplete
	}
	locked, err := q.LockSessionAttendance(ctx, session.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return LockView{}, ErrSessionLocked
	}
	if err != nil {
		return LockView{}, fmt.Errorf("lock session attendance: %w", err)
	}
	view := LockView{
		SessionID:             data.UUIDString(locked.ID),
		Status:                string(locked.Status),
		AttendanceLockedAt:    timeValue(locked.AttendanceLockedAt),
		AttendanceRecordCount: recordCount,
	}
	if err := audit.Write(
		ctx, q, userID, "attendance.lock", "class_session",
		session.ID, sessionView(session), view,
	); err != nil {
		return LockView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LockView{}, fmt.Errorf("commit attendance lock: %w", err)
	}
	return view, nil
}

func (s *Service) Correct(
	ctx context.Context,
	adminUserID string,
	attendanceID string,
	input CorrectionInput,
) (RecordView, error) {
	id, err := data.UUID(attendanceID)
	if err != nil {
		return RecordView{}, ErrAttendanceNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return RecordView{}, fmt.Errorf("begin attendance correction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)

	existing, err := q.GetAttendanceRecordForUpdate(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return RecordView{}, ErrAttendanceNotFound
	}
	if err != nil {
		return RecordView{}, fmt.Errorf("get attendance for correction: %w", err)
	}
	updated, err := q.CorrectAttendanceRecord(ctx, db.CorrectAttendanceRecordParams{
		ID: id, Status: input.Status, Note: data.Text(input.Note),
	})
	if err != nil {
		return RecordView{}, fmt.Errorf("correct attendance: %w", err)
	}
	oldView := recordViewFromExisting(existing)
	newView := recordView(updated)
	newView.StudentCode = existing.StudentCode
	newView.FullName = existing.FullName
	if err := audit.WriteWithReason(
		ctx, q, adminUserID, "attendance.correct", "attendance_record",
		id, oldView, newView, input.Reason,
	); err != nil {
		return RecordView{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return RecordView{}, fmt.Errorf("commit attendance correction: %w", err)
	}
	return newView, nil
}

func (s *Service) StudentHistory(
	ctx context.Context,
	userID string,
	classID string,
	page int,
	perPage int,
) (pagination.Result[StudentHistoryView], error) {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return pagination.Result[StudentHistoryView]{}, fmt.Errorf("invalid student identity")
	}
	classUUID, err := optionalUUID(classID)
	if err != nil {
		return pagination.Result[StudentHistoryView]{}, err
	}
	params := db.ListStudentAttendanceParams{
		UserID: userUUID, ClassID: classUUID,
		PageOffset: int32((page - 1) * perPage), PageLimit: int32(perPage),
	}
	rows, err := s.queries.ListStudentAttendance(ctx, params)
	if err != nil {
		return pagination.Result[StudentHistoryView]{}, fmt.Errorf("list student attendance: %w", err)
	}
	total, err := s.queries.CountStudentAttendance(ctx, db.CountStudentAttendanceParams{
		UserID: userUUID, ClassID: classUUID,
	})
	if err != nil {
		return pagination.Result[StudentHistoryView]{}, fmt.Errorf("count student attendance: %w", err)
	}
	items := make([]StudentHistoryView, 0, len(rows))
	for _, row := range rows {
		items = append(items, StudentHistoryView{
			ID: data.UUIDString(row.ID), ClassSessionID: data.UUIDString(row.ClassSessionID),
			ClassID: data.UUIDString(row.ClassID), ClassCode: row.ClassCode, ClassName: row.ClassName,
			CourseID: data.UUIDString(row.CourseID), CourseCode: row.CourseCode, CourseName: row.CourseName,
			SessionTitle: row.SessionTitle, StartsAt: timeValue(row.StartsAt), EndsAt: timeValue(row.EndsAt),
			Status: string(row.Status), Note: data.TextPointer(row.Note),
			RecordedAt: timeValue(row.RecordedAt), UpdatedAt: timeValue(row.UpdatedAt),
		})
	}
	return pagination.New(items, page, perPage, total), nil
}

func (s *Service) StudentSummary(ctx context.Context, userID, classID string) ([]StudentSummaryView, error) {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid student identity")
	}
	classUUID, err := optionalUUID(classID)
	if err != nil {
		return nil, err
	}
	rows, err := s.queries.ListStudentAttendanceSummaries(ctx, db.ListStudentAttendanceSummariesParams{
		UserID: userUUID, ClassID: classUUID,
	})
	if err != nil {
		return nil, fmt.Errorf("list student attendance summaries: %w", err)
	}
	items := make([]StudentSummaryView, 0, len(rows))
	for _, row := range rows {
		items = append(items, StudentSummaryView{
			ClassID: data.UUIDString(row.ClassID), ClassCode: row.ClassCode, ClassName: row.ClassName,
			CourseID: data.UUIDString(row.CourseID), CourseCode: row.CourseCode, CourseName: row.CourseName,
			RecordedSessions: row.RecordedSessions, PresentSessions: row.PresentSessions,
			AbsentSessions: row.AbsentSessions, LateSessions: row.LateSessions,
			ExcusedSessions: row.ExcusedSessions, AttendancePct: data.NumericFloat(row.AttendancePct),
		})
	}
	return items, nil
}

func (s *Service) sessionView(
	ctx context.Context,
	q *db.Queries,
	session sessionSnapshot,
) (SessionAttendanceView, error) {
	rows, err := q.ListSessionAttendanceRoster(ctx, session.ID)
	if err != nil {
		return SessionAttendanceView{}, fmt.Errorf("list session attendance roster: %w", err)
	}
	items := make([]RosterItemView, 0, len(rows))
	summary := SessionSummary{Total: len(rows)}
	for _, row := range rows {
		item := rosterItemView(row)
		items = append(items, item)
		if item.AttendanceStatus == nil {
			summary.Unrecorded++
			continue
		}
		summary.Recorded++
		switch *item.AttendanceStatus {
		case string(db.AttendanceStatusPresent):
			summary.Present++
		case string(db.AttendanceStatusAbsent):
			summary.Absent++
		case string(db.AttendanceStatusLate):
			summary.Late++
		case string(db.AttendanceStatusExcused):
			summary.Excused++
		}
	}
	return SessionAttendanceView{Session: sessionView(session), Items: items, Summary: summary}, nil
}

func (s *Service) validateWritableSession(session sessionSnapshot) error {
	if session.Status == db.SessionStatusCancelled {
		return ErrSessionCancelled
	}
	if session.Status == db.SessionStatusLocked || session.AttendanceLockedAt.Valid {
		return ErrSessionLocked
	}
	if session.StartsAt.Valid && s.now().Before(session.StartsAt.Time) {
		return ErrSessionNotStarted
	}
	return nil
}

func checkTeacherAssignment(ctx context.Context, q *db.Queries, userID string, classID pgtype.UUID) error {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return ErrTeacherNotAssigned
	}
	assigned, err := q.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{
		ClassID: classID, UserID: userUUID,
	})
	if err != nil {
		return fmt.Errorf("check attendance teacher assignment: %w", err)
	}
	if !assigned {
		return ErrTeacherNotAssigned
	}
	return nil
}

func mapAttendanceWriteError(err error) error {
	switch {
	case dberror.IsCode(err, dberror.UniqueViolation):
		return ErrAttendanceExists
	case dberror.IsCode(err, dberror.ForeignKeyViolation):
		return ErrStudentNotEnrolled
	default:
		return fmt.Errorf("write attendance: %w", err)
	}
}

func snapshotFromGet(row db.GetAttendanceSessionRow) sessionSnapshot {
	return sessionSnapshot{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		Title: row.Title, StartsAt: row.StartsAt, EndsAt: row.EndsAt,
		Status: row.Status, AttendanceLockedAt: row.AttendanceLockedAt,
	}
}

func snapshotFromLocked(row db.GetAttendanceSessionForUpdateRow) sessionSnapshot {
	return sessionSnapshot{
		ID: row.ID, ClassID: row.ClassID, ClassCode: row.ClassCode, ClassName: row.ClassName,
		CourseID: row.CourseID, CourseCode: row.CourseCode, CourseName: row.CourseName,
		Title: row.Title, StartsAt: row.StartsAt, EndsAt: row.EndsAt,
		Status: row.Status, AttendanceLockedAt: row.AttendanceLockedAt,
	}
}

func sessionView(session sessionSnapshot) SessionView {
	return SessionView{
		ID: data.UUIDString(session.ID), ClassID: data.UUIDString(session.ClassID),
		ClassCode: session.ClassCode, ClassName: session.ClassName,
		CourseID: data.UUIDString(session.CourseID), CourseCode: session.CourseCode,
		CourseName: session.CourseName, Title: session.Title,
		StartsAt: timeValue(session.StartsAt), EndsAt: timeValue(session.EndsAt),
		Status: string(session.Status), AttendanceLockedAt: data.TimeString(session.AttendanceLockedAt),
	}
}

func rosterItemView(row db.ListSessionAttendanceRosterRow) RosterItemView {
	var attendanceID *string
	if row.AttendanceID.Valid {
		value := data.UUIDString(row.AttendanceID)
		attendanceID = &value
	}
	var status *string
	if row.AttendanceStatus.Valid {
		value := string(row.AttendanceStatus.AttendanceStatus)
		status = &value
	}
	var recordedBy *string
	if row.RecordedBy.Valid {
		value := data.UUIDString(row.RecordedBy)
		recordedBy = &value
	}
	return RosterItemView{
		StudentID: data.UUIDString(row.StudentID), StudentCode: row.StudentCode,
		FullName: row.FullName, EnrollmentStatus: string(row.EnrollmentStatus),
		AttendanceID: attendanceID, AttendanceStatus: status, Note: data.TextPointer(row.Note),
		RecordedBy: recordedBy, RecordedByEmail: data.TextPointer(row.RecordedByEmail),
		RecordedAt: data.TimeString(row.RecordedAt), UpdatedAt: data.TimeString(row.UpdatedAt),
	}
}

func recordView(record db.AttendanceRecord) RecordView {
	return RecordView{
		ID: data.UUIDString(record.ID), ClassSessionID: data.UUIDString(record.ClassSessionID),
		ClassID: data.UUIDString(record.ClassID), StudentID: data.UUIDString(record.StudentID),
		Status: string(record.Status), Note: data.TextPointer(record.Note),
		RecordedBy: data.UUIDString(record.RecordedBy), RecordedAt: timeValue(record.RecordedAt),
		UpdatedAt: timeValue(record.UpdatedAt),
	}
}

func recordViewFromExisting(row db.GetAttendanceRecordForUpdateRow) RecordView {
	return RecordView{
		ID: data.UUIDString(row.ID), ClassSessionID: data.UUIDString(row.ClassSessionID),
		ClassID: data.UUIDString(row.ClassID), StudentID: data.UUIDString(row.StudentID),
		StudentCode: row.StudentCode, FullName: row.FullName,
		Status: string(row.Status), Note: data.TextPointer(row.Note),
		RecordedBy: data.UUIDString(row.RecordedBy), RecordedAt: timeValue(row.RecordedAt),
		UpdatedAt: timeValue(row.UpdatedAt),
	}
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
