// Package progress calculates deterministic course progress from configured
// sessions, attendance thresholds, required competencies, and assessment sessions.
package progress

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type SessionComponent struct {
	Completed int32   `json:"completed"`
	Required  int32   `json:"required"`
	Percent   float64 `json:"percent"`
}

type AttendanceComponent struct {
	Records            int32   `json:"records"`
	CountedRecords     int32   `json:"counted_records"`
	Attended           int32   `json:"attended"`
	Excused            int32   `json:"excused"`
	Percent            float64 `json:"percent"`
	MinimumRequiredPct float64 `json:"minimum_required_pct"`
	RequirementMet     bool    `json:"requirement_met"`
}

type CompetencyComponent struct {
	Met            int32   `json:"met"`
	Required       int32   `json:"required"`
	Percent        float64 `json:"percent"`
	RequirementMet bool    `json:"requirement_met"`
}

type AssessmentComponent struct {
	Completed      int32   `json:"completed"`
	Required       int32   `json:"required"`
	Percent        float64 `json:"percent"`
	RequirementMet bool    `json:"requirement_met"`
}

type TestComponent struct {
	Passed         int32   `json:"passed"`
	Required       int32   `json:"required"`
	Percent        float64 `json:"percent"`
	RequirementMet bool    `json:"requirement_met"`
}

type FinalExamComponent struct {
	Score          *float64 `json:"score"`
	RequiredScore  float64  `json:"required_score"`
	RequirementMet bool     `json:"requirement_met"`
}

type View struct {
	ClassID            string              `json:"class_id"`
	ClassCode          string              `json:"class_code"`
	ClassName          string              `json:"class_name"`
	ClassStatus        string              `json:"class_status"`
	EnrollmentStatus   string              `json:"enrollment_status"`
	CourseID           string              `json:"course_id"`
	CourseCode         string              `json:"course_code"`
	CourseName         string              `json:"course_name"`
	Sessions           SessionComponent    `json:"sessions"`
	Attendance         AttendanceComponent `json:"attendance"`
	Competencies       CompetencyComponent `json:"competencies"`
	Assessments        AssessmentComponent `json:"assessments"`
	Tests              TestComponent       `json:"tests"`
	FinalExam          FinalExamComponent  `json:"final_exam"`
	FailureReasons     []string            `json:"failure_reasons"`
	OverallProgressPct float64             `json:"overall_progress_pct"`
	CompletionStatus   string              `json:"completion_status"`
}

type DashboardSummary struct {
	Classes            int     `json:"classes"`
	EligibleClasses    int     `json:"eligible_classes"`
	AverageProgressPct float64 `json:"average_progress_pct"`
}

type Dashboard struct {
	Items   []View           `json:"items"`
	Summary DashboardSummary `json:"summary"`
}

type Service struct {
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{queries: db.New(pool)}
}

func (s *Service) Dashboard(ctx context.Context, userID, classIDValue string) (Dashboard, error) {
	userUUID, err := data.UUID(userID)
	if err != nil {
		return Dashboard{}, fmt.Errorf("invalid student identity")
	}
	classID, err := optionalUUID(classIDValue)
	if err != nil {
		return Dashboard{}, err
	}
	rows, err := s.queries.ListStudentProgressInputs(ctx, db.ListStudentProgressInputsParams{
		UserID: userUUID, ClassID: classID,
	})
	if err != nil {
		return Dashboard{}, fmt.Errorf("list student progress: %w", err)
	}
	items := make([]View, 0, len(rows))
	summary := DashboardSummary{Classes: len(rows)}
	totalProgress := 0.0
	for _, row := range rows {
		view := calculate(row)
		items = append(items, view)
		totalProgress += view.OverallProgressPct
		if view.CompletionStatus == string(db.CompletionStatusEligible) {
			summary.EligibleClasses++
		}
	}
	if len(items) > 0 {
		summary.AverageProgressPct = round2(totalProgress / float64(len(items)))
	}
	return Dashboard{Items: items, Summary: summary}, nil
}

func calculate(row db.ListStudentProgressInputsRow) View {
	sessionPct := ratioPct(row.CompletedSessions, row.TotalSessions)
	countedAttendance := row.AttendanceRecords - row.ExcusedSessions
	if countedAttendance < 0 {
		countedAttendance = 0
	}
	attendancePct := ratioPct(row.AttendedSessions, countedAttendance)
	minimumAttendance := data.NumericFloat(row.MinimumAttendancePct)
	attendanceMet := attendancePct >= minimumAttendance
	competencyPct := optionalRatioPct(row.CompetenciesMet, row.RequiredCompetencies)
	competenciesMet := row.CompetenciesMet >= row.RequiredCompetencies
	assessmentPct := optionalRatioPct(row.CompletedAssessments, row.RequiredAssessments)
	assessmentsMet := row.CompletedAssessments >= row.RequiredAssessments
	testPct := optionalRatioPct(row.TestsPassed, row.RequiredTests)
	testsMet := row.TestsPassed >= row.RequiredTests
	finalScore := numericPointer(row.FinalExamScore)
	finalMet := row.FinalExamCount == 1 && finalScore != nil && *finalScore > 5
	finalProgress := 0.0
	if finalScore != nil {
		finalProgress = thresholdProgress(*finalScore, 5.01)
	}

	components := []float64{thresholdProgress(attendancePct, minimumAttendance), testPct, finalProgress}
	total := 0.0
	for _, component := range components {
		total += component
	}
	overall := round2(total / float64(len(components)))
	completionStatus := db.CompletionStatusPending
	if attendanceMet && testsMet && finalMet {
		completionStatus = db.CompletionStatusEligible
	}
	if row.PersistedCompletionStatus.Valid {
		completionStatus = row.PersistedCompletionStatus.CompletionStatus
	}
	failureReasons := make([]string, 0, 3)
	if !attendanceMet {
		failureReasons = append(failureReasons, fmt.Sprintf("Chuyên cần %.2f%%, yêu cầu tối thiểu %.0f%%", attendancePct, minimumAttendance))
	}
	if !testsMet {
		failureReasons = append(failureReasons, fmt.Sprintf("Còn %d bài kiểm tra bắt buộc chưa đạt", row.RequiredTests-row.TestsPassed))
	}
	if finalScore == nil {
		failureReasons = append(failureReasons, "Chưa có điểm thi kết thúc khóa")
	} else if !finalMet {
		failureReasons = append(failureReasons, fmt.Sprintf("Điểm thi kết thúc %.2f, yêu cầu trên 5", *finalScore))
	}

	return View{
		ClassID: data.UUIDString(row.ClassID), ClassCode: row.ClassCode, ClassName: row.ClassName,
		ClassStatus: string(row.ClassStatus), EnrollmentStatus: string(row.EnrollmentStatus),
		CourseID: data.UUIDString(row.CourseID), CourseCode: row.CourseCode, CourseName: row.CourseName,
		Sessions: SessionComponent{
			Completed: row.CompletedSessions, Required: row.TotalSessions, Percent: sessionPct,
		},
		Attendance: AttendanceComponent{
			Records: row.AttendanceRecords, CountedRecords: countedAttendance,
			Attended: row.AttendedSessions, Excused: row.ExcusedSessions,
			Percent: attendancePct, MinimumRequiredPct: minimumAttendance, RequirementMet: attendanceMet,
		},
		Competencies: CompetencyComponent{
			Met: row.CompetenciesMet, Required: row.RequiredCompetencies,
			Percent: competencyPct, RequirementMet: competenciesMet,
		},
		Assessments: AssessmentComponent{
			Completed: row.CompletedAssessments, Required: row.RequiredAssessments,
			Percent: assessmentPct, RequirementMet: assessmentsMet,
		},
		Tests:          TestComponent{Passed: row.TestsPassed, Required: row.RequiredTests, Percent: testPct, RequirementMet: testsMet},
		FinalExam:      FinalExamComponent{Score: finalScore, RequiredScore: 5, RequirementMet: finalMet},
		FailureReasons: failureReasons, OverallProgressPct: overall, CompletionStatus: string(completionStatus),
	}
}

func numericPointer(value pgtype.Numeric) *float64 {
	if !value.Valid {
		return nil
	}
	v := data.NumericFloat(value)
	return &v
}

func ratioPct(numerator, denominator int32) float64 {
	if denominator <= 0 || numerator <= 0 {
		return 0
	}
	value := 100 * float64(numerator) / float64(denominator)
	if value > 100 {
		value = 100
	}
	return round2(value)
}

func optionalRatioPct(numerator, denominator int32) float64 {
	if denominator <= 0 {
		return 100
	}
	return ratioPct(numerator, denominator)
}

func thresholdProgress(actual, required float64) float64 {
	if required <= 0 {
		return 100
	}
	value := 100 * actual / required
	if value > 100 {
		value = 100
	}
	return round2(value)
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
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
