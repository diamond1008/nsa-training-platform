// Package testscores implements configured course tests, score attempts, and corrections.
package testscores

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/notifications"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/audit"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/classhistory"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/dberror"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

var (
	ErrTestNotFound     = errors.New("course test not found")
	ErrAttemptNotFound  = errors.New("test attempt not found")
	ErrNotAssigned      = errors.New("teacher is not assigned to the class")
	ErrStudentNotActive = errors.New("student is not actively enrolled in the class")
	ErrTestConflict     = errors.New("test code, sequence, or final exam conflicts")
	ErrInvalidFinalRule = errors.New("final exam must be required with pass score 5")
)

type TestView struct {
	ID         string  `json:"id"`
	CourseID   string  `json:"course_id"`
	Code       string  `json:"code"`
	Title      string  `json:"title"`
	Kind       string  `json:"kind"`
	PassScore  float64 `json:"pass_score"`
	IsRequired bool    `json:"is_required"`
	SequenceNo int32   `json:"sequence_no"`
	IsActive   bool    `json:"is_active"`
}

type AttemptView struct {
	ID              string  `json:"id"`
	TestID          string  `json:"test_id"`
	ClassID         string  `json:"class_id"`
	ClassCode       string  `json:"class_code"`
	TestCode        string  `json:"test_code"`
	TestTitle       string  `json:"test_title"`
	Kind            string  `json:"kind"`
	AttemptNo       int32   `json:"attempt_no"`
	Score           float64 `json:"score"`
	PassScore       float64 `json:"pass_score"`
	Passed          bool    `json:"passed"`
	IsRequired      bool    `json:"is_required"`
	Note            *string `json:"note"`
	RecordedByEmail string  `json:"recorded_by_email"`
	TakenAt         string  `json:"taken_at"`
}

type TestResultView struct {
	Test      TestView      `json:"test"`
	Attempts  []AttemptView `json:"attempts"`
	Passed    bool          `json:"passed"`
	BestScore *float64      `json:"best_score"`
}

type CourseResultsView struct {
	CourseID   string           `json:"course_id"`
	CourseCode string           `json:"course_code"`
	CourseName string           `json:"course_name"`
	StudentID  string           `json:"student_id"`
	Tests      []TestResultView `json:"tests"`
}

type HistoryView struct {
	ID             string  `json:"id"`
	OldScore       float64 `json:"old_score"`
	NewScore       float64 `json:"new_score"`
	OldNote        *string `json:"old_note"`
	NewNote        *string `json:"new_note"`
	Reason         string  `json:"reason"`
	ChangedByEmail string  `json:"changed_by_email"`
	ChangedAt      string  `json:"changed_at"`
}

type TestInput struct {
	Code       string
	Title      string
	Kind       db.CourseTestKind
	PassScore  float64
	IsRequired bool
	SequenceNo int32
	IsActive   bool
}

type AttemptInput struct {
	Score   float64
	Note    *string
	TakenAt time.Time
}

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, queries: db.New(pool)} }

func (s *Service) ListTests(ctx context.Context, courseIDValue string) ([]TestView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return nil, ErrTestNotFound
	}
	rows, err := s.queries.ListCourseTests(ctx, courseID)
	if err != nil {
		return nil, fmt.Errorf("list course tests: %w", err)
	}
	items := make([]TestView, 0, len(rows))
	for _, row := range rows {
		items = append(items, testView(row))
	}
	return items, nil
}

func (s *Service) CreateTest(ctx context.Context, actorID, courseIDValue string, input TestInput) (TestView, error) {
	courseID, err := data.UUID(courseIDValue)
	if err != nil {
		return TestView{}, ErrTestNotFound
	}
	if err = validateTestInput(input); err != nil {
		return TestView{}, err
	}
	score, err := data.Numeric(input.PassScore)
	if err != nil {
		return TestView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return TestView{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	created, err := q.CreateCourseTest(ctx, db.CreateCourseTestParams{CourseID: courseID, Code: input.Code, Title: input.Title, Kind: input.Kind, PassScore: score, IsRequired: input.IsRequired, SequenceNo: input.SequenceNo, IsActive: input.IsActive})
	if err != nil {
		return TestView{}, mapWriteError(err)
	}
	view := testView(created)
	if err = audit.Write(ctx, q, actorID, "course_test.create", "course_test", created.ID, nil, view); err != nil {
		return TestView{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TestView{}, err
	}
	return view, nil
}

func (s *Service) UpdateTest(ctx context.Context, actorID, courseIDValue, testIDValue string, input TestInput) (TestView, error) {
	courseID, testID, err := parsePair(courseIDValue, testIDValue)
	if err != nil {
		return TestView{}, ErrTestNotFound
	}
	if err = validateTestInput(input); err != nil {
		return TestView{}, err
	}
	score, err := data.Numeric(input.PassScore)
	if err != nil {
		return TestView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return TestView{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	old, err := q.GetCourseTest(ctx, db.GetCourseTestParams{ID: testID, CourseID: courseID})
	if errors.Is(err, pgx.ErrNoRows) {
		return TestView{}, ErrTestNotFound
	}
	if err != nil {
		return TestView{}, err
	}
	updated, err := q.UpdateCourseTest(ctx, db.UpdateCourseTestParams{ID: testID, CourseID: courseID, Code: input.Code, Title: input.Title, Kind: input.Kind, PassScore: score, IsRequired: input.IsRequired, SequenceNo: input.SequenceNo, IsActive: input.IsActive})
	if err != nil {
		return TestView{}, mapWriteError(err)
	}
	view := testView(updated)
	if err = audit.Write(ctx, q, actorID, "course_test.update", "course_test", testID, testView(old), view); err != nil {
		return TestView{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return TestView{}, err
	}
	return view, nil
}

func (s *Service) TeacherResults(ctx context.Context, userID, classIDValue, studentIDValue string) (CourseResultsView, error) {
	classID, studentID, err := parsePair(classIDValue, studentIDValue)
	if err != nil {
		return CourseResultsView{}, ErrStudentNotActive
	}
	userUUID, err := data.UUID(userID)
	if err != nil {
		return CourseResultsView{}, ErrNotAssigned
	}
	assigned, err := s.queries.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{ClassID: classID, UserID: userUUID})
	if err != nil {
		return CourseResultsView{}, err
	}
	if !assigned {
		return CourseResultsView{}, ErrNotAssigned
	}
	contextRow, err := s.queries.GetTestScoreContext(ctx, db.GetTestScoreContextParams{ID: classID, ID_2: studentID})
	if errors.Is(err, pgx.ErrNoRows) {
		return CourseResultsView{}, ErrStudentNotActive
	}
	if err != nil {
		return CourseResultsView{}, err
	}
	view, err := s.results(ctx, contextRow.CourseID, studentID)
	if err != nil {
		return CourseResultsView{}, err
	}
	view.CourseCode = contextRow.CourseCode
	view.CourseName = contextRow.CourseName
	return view, nil
}

func (s *Service) StudentResults(ctx context.Context, userID string) ([]CourseResultsView, error) {
	uid, err := data.UUID(userID)
	if err != nil {
		return nil, ErrStudentNotActive
	}
	studentID, err := s.queries.GetStudentIDByUser(ctx, uid)
	if err != nil {
		return nil, ErrStudentNotActive
	}
	courses, err := s.queries.ListStudentTestCourses(ctx, uid)
	if err != nil {
		return nil, err
	}
	items := make([]CourseResultsView, 0, len(courses))
	for _, course := range courses {
		view, err := s.results(ctx, course.ID, studentID)
		if err != nil {
			return nil, err
		}
		view.CourseCode = course.Code
		view.CourseName = course.Name
		items = append(items, view)
	}
	return items, nil
}

func (s *Service) results(ctx context.Context, courseID, studentID pgtype.UUID) (CourseResultsView, error) {
	tests, err := s.queries.ListCourseTests(ctx, courseID)
	if err != nil {
		return CourseResultsView{}, err
	}
	attempts, err := s.queries.ListStudentTestAttempts(ctx, db.ListStudentTestAttemptsParams{CourseID: courseID, StudentID: studentID})
	if err != nil {
		return CourseResultsView{}, err
	}
	byTest := map[string][]AttemptView{}
	for _, row := range attempts {
		view := attemptView(row)
		key := data.UUIDString(row.TestID)
		byTest[key] = append(byTest[key], view)
	}
	items := make([]TestResultView, 0, len(tests))
	for _, test := range tests {
		if !test.IsActive {
			continue
		}
		tv := testView(test)
		testAttempts := byTest[tv.ID]
		var best *float64
		passed := false
		for _, attempt := range testAttempts {
			score := attempt.Score
			if best == nil || score > *best {
				v := score
				best = &v
			}
			if attempt.Passed {
				passed = true
			}
		}
		items = append(items, TestResultView{Test: tv, Attempts: testAttempts, Passed: passed, BestScore: best})
	}
	return CourseResultsView{CourseID: data.UUIDString(courseID), StudentID: data.UUIDString(studentID), Tests: items}, nil
}

func (s *Service) RecordAttempt(ctx context.Context, userID, classIDValue, studentIDValue, testIDValue string, input AttemptInput) (AttemptView, error) {
	classID, studentID, err := parsePair(classIDValue, studentIDValue)
	if err != nil {
		return AttemptView{}, ErrStudentNotActive
	}
	testID, err := data.UUID(testIDValue)
	if err != nil {
		return AttemptView{}, ErrTestNotFound
	}
	actor, err := data.UUID(userID)
	if err != nil {
		return AttemptView{}, ErrNotAssigned
	}
	score, err := data.Numeric(input.Score)
	if err != nil {
		return AttemptView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return AttemptView{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	assigned, err := q.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{ClassID: classID, UserID: actor})
	if err != nil {
		return AttemptView{}, err
	}
	if !assigned {
		return AttemptView{}, ErrNotAssigned
	}
	contextRow, err := q.GetTestScoreContext(ctx, db.GetTestScoreContextParams{ID: classID, ID_2: studentID})
	if errors.Is(err, pgx.ErrNoRows) || contextRow.EnrollmentStatus != db.EnrollmentStatusEnrolled {
		return AttemptView{}, ErrStudentNotActive
	}
	if err != nil {
		return AttemptView{}, err
	}
	test, err := q.GetCourseTestForUpdate(ctx, db.GetCourseTestForUpdateParams{ID: testID, CourseID: contextRow.CourseID})
	if errors.Is(err, pgx.ErrNoRows) || !test.IsActive {
		return AttemptView{}, ErrTestNotFound
	}
	if err != nil {
		return AttemptView{}, err
	}
	no, err := q.NextStudentTestAttemptNo(ctx, db.NextStudentTestAttemptNoParams{TestID: testID, StudentID: studentID})
	if err != nil {
		return AttemptView{}, err
	}
	taken := input.TakenAt
	if taken.IsZero() {
		taken = time.Now()
	}
	created, err := q.CreateStudentTestAttempt(ctx, db.CreateStudentTestAttemptParams{TestID: testID, CourseID: contextRow.CourseID, ClassID: classID, StudentID: studentID, AttemptNo: no, Score: score, Note: data.Text(input.Note), RecordedBy: actor, TakenAt: pgtype.Timestamptz{Time: taken, Valid: true}})
	if err != nil {
		return AttemptView{}, fmt.Errorf("create test attempt: %w", err)
	}
	view := attemptFromCreated(created, test, contextRow.ClassCode, userID)
	actionURL := "/student/danh-gia"
	if err = notifications.Create(ctx, q, contextRow.StudentUserID, "Có kết quả kiểm tra mới", test.Title+" · "+fmt.Sprintf("%.2f điểm", input.Score), "test_score", &actionURL); err != nil {
		return AttemptView{}, err
	}
	if err = classhistory.Write(ctx, q, userID, classID, "test_attempt_recorded", "student_test_attempt", created.ID, "Ghi nhận điểm kiểm tra", view); err != nil {
		return AttemptView{}, err
	}
	if err = audit.Write(ctx, q, userID, "test_attempt.create", "student_test_attempt", created.ID, nil, view); err != nil {
		return AttemptView{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return AttemptView{}, err
	}
	return view, nil
}

func (s *Service) CorrectAttempt(ctx context.Context, userID, attemptIDValue string, input AttemptInput, reason string, isAdmin bool) (AttemptView, error) {
	attemptID, err := data.UUID(attemptIDValue)
	if err != nil {
		return AttemptView{}, ErrAttemptNotFound
	}
	actor, err := data.UUID(userID)
	if err != nil {
		return AttemptView{}, ErrNotAssigned
	}
	score, err := data.Numeric(input.Score)
	if err != nil {
		return AttemptView{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return AttemptView{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	q := s.queries.WithTx(tx)
	old, err := q.GetStudentTestAttemptForUpdate(ctx, attemptID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AttemptView{}, ErrAttemptNotFound
	}
	if err != nil {
		return AttemptView{}, err
	}
	if !isAdmin {
		assigned, err := q.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{ClassID: old.ClassID, UserID: actor})
		if err != nil {
			return AttemptView{}, err
		}
		if !assigned {
			return AttemptView{}, ErrNotAssigned
		}
	}
	updated, err := q.UpdateStudentTestAttempt(ctx, db.UpdateStudentTestAttemptParams{ID: attemptID, Score: score, Note: data.Text(input.Note)})
	if err != nil {
		return AttemptView{}, err
	}
	_, err = q.CreateTestAttemptHistory(ctx, db.CreateTestAttemptHistoryParams{AttemptID: attemptID, OldScore: old.Score, NewScore: score, OldNote: old.Note, NewNote: data.Text(input.Note), Reason: reason, ChangedBy: actor})
	if err != nil {
		return AttemptView{}, err
	}
	view := AttemptView{ID: data.UUIDString(updated.ID), TestID: data.UUIDString(updated.TestID), ClassID: data.UUIDString(updated.ClassID), TestCode: old.TestCode, TestTitle: old.Title, Kind: string(old.Kind), AttemptNo: updated.AttemptNo, Score: input.Score, PassScore: data.NumericFloat(old.PassScore), Passed: isPassed(old.Kind, input.Score, data.NumericFloat(old.PassScore)), Note: data.TextPointer(updated.Note), TakenAt: updated.TakenAt.Time.UTC().Format(time.RFC3339Nano)}
	studentUserID, err := q.GetTestAttemptStudentUserID(ctx, attemptID)
	if err != nil {
		return AttemptView{}, err
	}
	actionURL := "/student/danh-gia"
	if err = notifications.Create(ctx, q, studentUserID, "Điểm kiểm tra đã được cập nhật", old.Title+" · "+fmt.Sprintf("%.2f điểm", input.Score), "test_score", &actionURL); err != nil {
		return AttemptView{}, err
	}
	if err = classhistory.Write(ctx, q, userID, old.ClassID, "test_attempt_corrected", "student_test_attempt", attemptID, reason, view); err != nil {
		return AttemptView{}, err
	}
	if err = audit.WriteWithReason(ctx, q, userID, "test_attempt.correct", "student_test_attempt", attemptID, map[string]any{"score": data.NumericFloat(old.Score), "note": data.TextPointer(old.Note)}, view, reason); err != nil {
		return AttemptView{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return AttemptView{}, err
	}
	return view, nil
}

func (s *Service) History(ctx context.Context, attemptIDValue string) ([]HistoryView, error) {
	id, err := data.UUID(attemptIDValue)
	if err != nil {
		return nil, ErrAttemptNotFound
	}
	rows, err := s.queries.ListTestAttemptHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	items := make([]HistoryView, 0, len(rows))
	for _, row := range rows {
		items = append(items, HistoryView{ID: data.UUIDString(row.ID), OldScore: data.NumericFloat(row.OldScore), NewScore: data.NumericFloat(row.NewScore), OldNote: data.TextPointer(row.OldNote), NewNote: data.TextPointer(row.NewNote), Reason: row.Reason, ChangedByEmail: row.ChangedByEmail, ChangedAt: row.ChangedAt.Time.UTC().Format(time.RFC3339Nano)})
	}
	return items, nil
}

func (s *Service) TeacherHistory(ctx context.Context, userID, attemptIDValue string) ([]HistoryView, error) {
	id, err := data.UUID(attemptIDValue)
	if err != nil {
		return nil, ErrAttemptNotFound
	}
	uid, err := data.UUID(userID)
	if err != nil {
		return nil, ErrNotAssigned
	}
	classID, err := s.queries.GetTestAttemptClassID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAttemptNotFound
	}
	if err != nil {
		return nil, err
	}
	assigned, err := s.queries.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{ClassID: classID, UserID: uid})
	if err != nil {
		return nil, err
	}
	if !assigned {
		return nil, ErrNotAssigned
	}
	return s.History(ctx, attemptIDValue)
}

func validateTestInput(input TestInput) error {
	if input.Kind == db.CourseTestKindFinalExam && (input.PassScore != 5 || !input.IsRequired) {
		return ErrInvalidFinalRule
	}
	return nil
}
func mapWriteError(err error) error {
	if dberror.IsCode(err, dberror.UniqueViolation) {
		return ErrTestConflict
	}
	return err
}
func parsePair(a, b string) (pgtype.UUID, pgtype.UUID, error) {
	x, e := data.UUID(a)
	if e != nil {
		return pgtype.UUID{}, pgtype.UUID{}, e
	}
	y, e := data.UUID(b)
	return x, y, e
}
func isPassed(kind db.CourseTestKind, score, pass float64) bool {
	if kind == db.CourseTestKindFinalExam {
		return score > pass
	}
	return score >= pass
}
func testView(row db.CourseTest) TestView {
	return TestView{ID: data.UUIDString(row.ID), CourseID: data.UUIDString(row.CourseID), Code: row.Code, Title: row.Title, Kind: string(row.Kind), PassScore: data.NumericFloat(row.PassScore), IsRequired: row.IsRequired, SequenceNo: row.SequenceNo, IsActive: row.IsActive}
}
func attemptView(row db.ListStudentTestAttemptsRow) AttemptView {
	score := data.NumericFloat(row.Score)
	pass := data.NumericFloat(row.PassScore)
	return AttemptView{ID: data.UUIDString(row.ID), TestID: data.UUIDString(row.TestID), ClassID: data.UUIDString(row.ClassID), ClassCode: row.ClassCode, TestCode: row.TestCode, TestTitle: row.TestTitle, Kind: string(row.Kind), AttemptNo: row.AttemptNo, Score: score, PassScore: pass, Passed: isPassed(row.Kind, score, pass), IsRequired: row.IsRequired, Note: data.TextPointer(row.Note), RecordedByEmail: row.RecordedByEmail, TakenAt: row.TakenAt.Time.UTC().Format(time.RFC3339Nano)}
}
func attemptFromCreated(row db.StudentTestAttempt, test db.CourseTest, classCode, email string) AttemptView {
	score := data.NumericFloat(row.Score)
	pass := data.NumericFloat(test.PassScore)
	return AttemptView{ID: data.UUIDString(row.ID), TestID: data.UUIDString(row.TestID), ClassID: data.UUIDString(row.ClassID), ClassCode: classCode, TestCode: test.Code, TestTitle: test.Title, Kind: string(test.Kind), AttemptNo: row.AttemptNo, Score: score, PassScore: pass, Passed: isPassed(test.Kind, score, pass), IsRequired: test.IsRequired, Note: data.TextPointer(row.Note), RecordedByEmail: email, TakenAt: row.TakenAt.Time.UTC().Format(time.RFC3339Nano)}
}
