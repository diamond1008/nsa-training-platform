package students_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestIntegration_AttendanceRiskRespectsCourseScope(t *testing.T) {
	url := os.Getenv("NSA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("NSA_TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	t.Cleanup(pool.Close)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin fixture transaction: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	var userID, studentID, courseOnTrackID, courseAtRiskID, classOnTrackID, classAtRiskID pgtype.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO users (email,password_hash,status,must_change_password)
		 VALUES ('risk-scope-' || gen_random_uuid() || '@test.local','not-used','active',FALSE)
		 RETURNING id`,
	).Scan(&userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO student_profiles (user_id,student_code,full_name,status)
		 VALUES ($1,'RISK-' || substr(gen_random_uuid()::text,1,8),'Risk Scope Student','active')
		 RETURNING id`, userID,
	).Scan(&studentID); err != nil {
		t.Fatalf("insert student: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO courses (code,name,total_sessions,minimum_attendance_pct,status)
		 VALUES ('ON-' || substr(gen_random_uuid()::text,1,8),'On-track course',2,80,'active') RETURNING id`,
	).Scan(&courseOnTrackID); err != nil {
		t.Fatalf("insert on-track course: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO courses (code,name,total_sessions,minimum_attendance_pct,status)
		 VALUES ('RISK-' || substr(gen_random_uuid()::text,1,8),'At-risk course',2,80,'active') RETURNING id`,
	).Scan(&courseAtRiskID); err != nil {
		t.Fatalf("insert at-risk course: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO classes (course_id,class_code,name,start_date,end_date,maximum_students,status)
		 VALUES ($1,'ON-' || substr(gen_random_uuid()::text,1,8),'On-track class',CURRENT_DATE-30,CURRENT_DATE+30,10,'in_progress') RETURNING id`, courseOnTrackID,
	).Scan(&classOnTrackID); err != nil {
		t.Fatalf("insert on-track class: %v", err)
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO classes (course_id,class_code,name,start_date,end_date,maximum_students,status)
		 VALUES ($1,'RISK-' || substr(gen_random_uuid()::text,1,8),'At-risk class',CURRENT_DATE-30,CURRENT_DATE+30,10,'in_progress') RETURNING id`, courseAtRiskID,
	).Scan(&classAtRiskID); err != nil {
		t.Fatalf("insert at-risk class: %v", err)
	}
	for _, classID := range []pgtype.UUID{classOnTrackID, classAtRiskID} {
		if _, err := tx.Exec(ctx,
			`INSERT INTO class_enrollments (class_id,student_id,created_by,enrolled_at)
			 VALUES ($1,$2,$3,NOW()-INTERVAL '30 days')`, classID, studentID, userID,
		); err != nil {
			t.Fatalf("insert enrollment: %v", err)
		}
	}

	insertAttendance := func(classID, courseID pgtype.UUID, status string, dayOffset int) {
		t.Helper()
		var sessionID pgtype.UUID
		if err := tx.QueryRow(ctx,
			`INSERT INTO class_sessions (
			   class_id,course_id,title,session_type,starts_at,ends_at,status,created_by
			 ) VALUES (
			   $1,$2,'Risk scope session','theory',
			   (((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + $3::int + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
			   (((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + $3::int + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'),
			   'completed',$4
			 ) RETURNING id`, classID, courseID, dayOffset, userID,
		).Scan(&sessionID); err != nil {
			t.Fatalf("insert session: %v", err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO attendance_records (class_session_id,class_id,student_id,status,recorded_by)
			 VALUES ($1,$2,$3,$4,$5)`, sessionID, classID, studentID, status, userID,
		); err != nil {
			t.Fatalf("insert attendance: %v", err)
		}
	}
	insertAttendance(classOnTrackID, courseOnTrackID, "present", -2)
	insertAttendance(classAtRiskID, courseAtRiskID, "absent", -1)

	queries := db.New(tx)
	base := db.ListAdminStudentsParams{
		Search: "Risk Scope Student", Status: "active", SortBy: "created_at", SortOrder: "desc",
		PageLimit: 20,
	}
	base.CourseID, base.AttendanceRisk = courseOnTrackID, "at_risk"
	rows, err := queries.ListAdminStudents(ctx, base)
	if err != nil {
		t.Fatalf("list on-track course as at-risk: %v", err)
	}
	if len(rows) != 0 {
		t.Fatalf("risk from another course leaked into on-track course: %+v", rows)
	}
	base.AttendanceRisk = "on_track"
	rows, err = queries.ListAdminStudents(ctx, base)
	if err != nil || len(rows) != 1 {
		t.Fatalf("on-track course rows=%d err=%v", len(rows), err)
	}
	base.CourseID, base.AttendanceRisk = courseAtRiskID, "at_risk"
	rows, err = queries.ListAdminStudents(ctx, base)
	if err != nil || len(rows) != 1 {
		t.Fatalf("at-risk course rows=%d err=%v", len(rows), err)
	}
}
