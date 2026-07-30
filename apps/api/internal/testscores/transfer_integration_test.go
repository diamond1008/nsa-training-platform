package testscores_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestIntegration_SameCourseTransferKeepsScoresForCompletion(t *testing.T) {
	url := os.Getenv("NSA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("NSA_TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	prefix := fmt.Sprintf("P17%X", time.Now().UnixNano())
	defer cleanupTransferFixture(t, pool, prefix)

	var studentUserID, actorID, studentID, courseID, oldClassID, newClassID string
	for suffix, target := range map[string]*string{"student": &studentUserID, "actor": &actorID} {
		if err := pool.QueryRow(ctx, `INSERT INTO users (email,password_hash,status,must_change_password) VALUES ($1,'unused','active',FALSE) RETURNING id`,
			prefix+"-"+suffix+"@test.local").Scan(target); err != nil {
			t.Fatalf("insert %s user: %v", suffix, err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO student_profiles (user_id,student_code,full_name,status) VALUES ($1,$2,'Transfer Student','active') RETURNING id`,
		studentUserID, prefix+"-HV").Scan(&studentID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO courses (code,name,total_sessions,minimum_attendance_pct,status) VALUES ($1,'Transfer Course',2,80,'active') RETURNING id`, prefix+"-CO").Scan(&courseID); err != nil {
		t.Fatal(err)
	}
	for code, target := range map[string]*string{prefix + "-OLD": &oldClassID, prefix + "-NEW": &newClassID} {
		if err := pool.QueryRow(ctx, `INSERT INTO classes (course_id,class_code,name,start_date,end_date,maximum_students,status) VALUES ($1,$2,$2,CURRENT_DATE-30,CURRENT_DATE+30,20,'in_progress') RETURNING id`, courseID, code).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO class_enrollments (class_id,student_id,status,enrolled_at,ended_at,created_by) VALUES
		($1,$3,'transferred',NOW()-INTERVAL '20 days',NOW()-INTERVAL '5 days',$4),
		($2,$3,'enrolled',NOW()-INTERVAL '5 days',NULL,$4)`, oldClassID, newClassID, studentID, actorID); err != nil {
		t.Fatal(err)
	}

	var oldSessionID, newSessionID string
	if err := pool.QueryRow(ctx, `INSERT INTO class_sessions (class_id,course_id,title,starts_at,ends_at,status,created_by) VALUES ($1,$2,'Old session',NOW()-INTERVAL '10 days',NOW()-INTERVAL '10 days'+INTERVAL '2 hours','completed',$3) RETURNING id`, oldClassID, courseID, actorID).Scan(&oldSessionID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO class_sessions (class_id,course_id,title,starts_at,ends_at,status,created_by) VALUES ($1,$2,'New session',NOW()-INTERVAL '2 days',NOW()-INTERVAL '2 days'+INTERVAL '2 hours','completed',$3) RETURNING id`, newClassID, courseID, actorID).Scan(&newSessionID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO attendance_records (class_session_id,class_id,student_id,status,recorded_by) VALUES ($1,$2,$3,'present',$4),($5,$6,$3,'present',$4)`, oldSessionID, oldClassID, studentID, actorID, newSessionID, newClassID); err != nil {
		t.Fatal(err)
	}

	var classTestID, finalTestID string
	if err := pool.QueryRow(ctx, `INSERT INTO course_tests (course_id,code,title,kind,pass_score,is_required,sequence_no) VALUES ($1,$2,'Mandatory test','class_test',5,TRUE,1) RETURNING id`, courseID, prefix+"-T1").Scan(&classTestID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO course_tests (course_id,code,title,kind,pass_score,is_required,sequence_no) VALUES ($1,$2,'Final exam','final_exam',5,TRUE,2) RETURNING id`, courseID, prefix+"-FINAL").Scan(&finalTestID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO student_test_attempts (test_id,course_id,class_id,student_id,attempt_no,score,recorded_by) VALUES
		($1,$3,$4,$6,1,6,$7),($2,$3,$5,$6,1,6,$7)`, classTestID, finalTestID, courseID, oldClassID, newClassID, studentID, actorID); err != nil {
		t.Fatal(err)
	}

	queries := db.New(pool)
	studentUserUUID, _ := data.UUID(studentUserID)
	rows, err := queries.ListStudentProgressInputs(ctx, db.ListStudentProgressInputsParams{UserID: studentUserUUID})
	if err != nil || len(rows) != 1 {
		t.Fatalf("progress rows=%d err=%v", len(rows), err)
	}
	if rows[0].TestsPassed != 1 || rows[0].RequiredTests != 1 || data.NumericFloat(rows[0].FinalExamScore) != 6 {
		t.Fatalf("transfer-safe progress metrics = %+v", rows[0])
	}
	candidates, err := queries.ListCompletionCandidates(ctx, db.ListCompletionCandidatesParams{Search: prefix + "-HV", PageLimit: 10})
	if err != nil || len(candidates) != 1 || !candidates[0].IsEligible.Bool {
		t.Fatalf("completion candidates=%+v err=%v", candidates, err)
	}
	if candidates[0].ClassID.String() != newClassID {
		t.Fatalf("canonical class=%s want new class=%s", candidates[0].ClassID.String(), newClassID)
	}
}

func cleanupTransferFixture(t *testing.T, pool *pgxpool.Pool, prefix string) {
	t.Helper()
	ctx := context.Background()
	statements := []string{
		`DELETE FROM student_test_attempts WHERE course_id IN (SELECT id FROM courses WHERE code LIKE $1)`,
		`DELETE FROM course_tests WHERE course_id IN (SELECT id FROM courses WHERE code LIKE $1)`,
		`DELETE FROM attendance_records WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`,
		`DELETE FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`,
		`DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE class_code LIKE $1)`,
		`DELETE FROM classes WHERE class_code LIKE $1`,
		`DELETE FROM courses WHERE code LIKE $1`,
		`DELETE FROM student_profiles WHERE student_code LIKE $1`,
		`DELETE FROM users WHERE email LIKE $1`,
	}
	for i, statement := range statements {
		pattern := prefix + "%"
		if i == len(statements)-1 {
			pattern = prefix + "%@test.local"
		}
		if _, err := pool.Exec(ctx, statement, pattern); err != nil {
			t.Errorf("cleanup transfer fixture: %v", err)
		}
	}
}
