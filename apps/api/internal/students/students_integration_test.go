package students_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	studentmodule "github.com/diamond1008/nsa-training-platform/apps/api/internal/students"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestIntegration_GeneratedStudentCodesAndLifecycleHistory(t *testing.T) {
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

	prefix := fmt.Sprintf("P11-%X", time.Now().UnixNano())
	var actorID string
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, status, must_change_password)
		 VALUES ($1, 'not-used', 'active', FALSE) RETURNING id`,
		strings.ToLower(prefix)+"-admin@test.local",
	).Scan(&actorID); err != nil {
		t.Fatalf("insert actor: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE code = 'ADMIN'`, actorID,
	); err != nil {
		t.Fatalf("assign actor role: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(),
			`DELETE FROM audit_logs WHERE actor_user_id = $1 OR entity_id IN (
			   SELECT id FROM student_profiles WHERE user_id IN (
			     SELECT id FROM users WHERE email LIKE $2
			   )
			 )`, actorID, strings.ToLower(prefix)+"-%@test.local")
		_, _ = pool.Exec(context.Background(),
			`DELETE FROM student_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
			strings.ToLower(prefix)+"-%@test.local")
		_, _ = pool.Exec(context.Background(),
			`DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
			strings.ToLower(prefix)+"%@test.local")
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE email LIKE $1`, strings.ToLower(prefix)+"%@test.local")
	})

	service := studentmodule.NewService(pool, 10)
	students := make([]studentmodule.View, 2)
	errorsByIndex := make([]error, 2)
	var wg sync.WaitGroup
	for i := range students {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			students[index], errorsByIndex[index] = service.Create(ctx, actorID, studentmodule.WriteInput{
				Email:    strings.ToLower(fmt.Sprintf("%s-%d@test.local", prefix, index)),
				Password: "Passw0rd!123", AccountStatus: db.UserStatusActive,
				FullName: fmt.Sprintf("Phase 11 Student %d", index), Status: db.StudentStatusPending,
			})
		}(i)
	}
	wg.Wait()

	studentCodePattern := regexp.MustCompile(`^HV[0-9]{5,}$`)
	for i, createErr := range errorsByIndex {
		if createErr != nil {
			t.Fatalf("create student %d: %v", i, createErr)
		}
		if !studentCodePattern.MatchString(students[i].StudentCode) {
			t.Fatalf("unexpected generated code %q", students[i].StudentCode)
		}
	}
	if students[0].StudentCode == students[1].StudentCode {
		t.Fatalf("concurrent creates generated duplicate code %q", students[0].StudentCode)
	}

	update := studentmodule.WriteInput{
		Email: students[0].Email, AccountStatus: db.UserStatusActive,
		FullName: students[0].FullName, Status: db.StudentStatusActive,
	}
	if _, err := service.Update(ctx, actorID, students[0].ID, update); !errors.Is(err, studentmodule.ErrStatusReason) {
		t.Fatalf("status change without reason error = %v, want ErrStatusReason", err)
	}
	reason := "Đã xác nhận hồ sơ nhập học"
	update.StatusChangeReason = &reason
	updated, err := service.Update(ctx, actorID, students[0].ID, update)
	if err != nil {
		t.Fatalf("update lifecycle status: %v", err)
	}
	if updated.StudentCode != students[0].StudentCode {
		t.Fatalf("student code changed from %q to %q", students[0].StudentCode, updated.StudentCode)
	}
	history, err := service.StatusHistory(ctx, students[0].ID)
	if err != nil {
		t.Fatalf("get status history: %v", err)
	}
	if len(history) != 2 || history[0].FromStatus == nil || *history[0].FromStatus != "pending" || history[0].ToStatus != "active" {
		t.Fatalf("unexpected status history: %#v", history)
	}
}
