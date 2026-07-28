package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/assessments"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/attendance"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/classes"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/progress"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/schedules"
)

func TestScheduleViewerRoutesEnforceOwnRole(t *testing.T) {
	tokens, err := auth.NewTokenService("phase-5-test-secret-at-least-32-bytes", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	router := chi.NewRouter()
	router.Route("/api/v1", func(r chi.Router) {
		mountRoleRoutes(
			r, tokens, classes.NewHandler(nil, log), schedules.NewHandler(nil, log), attendance.NewHandler(nil, log),
			assessments.NewHandler(nil, log), progress.NewHandler(nil, log),
		)
	})
	teacherToken, _, _ := tokens.Issue(
		"22222222-2222-2222-2222-222222222222",
		"teacher@test.local",
		[]string{auth.RoleTeacher},
	)
	studentToken, _, _ := tokens.Issue(
		"33333333-3333-3333-3333-333333333333",
		"student@test.local",
		[]string{auth.RoleStudent},
	)

	cases := []struct {
		name   string
		method string
		path   string
		token  string
		want   int
	}{
		{"teacher schedule without auth", http.MethodGet, "/api/v1/teacher/schedule", "", http.StatusUnauthorized},
		{"student blocked from teacher schedule", http.MethodGet, "/api/v1/teacher/schedule", studentToken, http.StatusForbidden},
		{"student blocked from teacher classes", http.MethodGet, "/api/v1/teacher/classes", studentToken, http.StatusForbidden},
		{"student blocked from teacher class detail", http.MethodGet, "/api/v1/teacher/classes/11111111-1111-1111-1111-111111111111", studentToken, http.StatusForbidden},
		{"teacher blocked from student schedule", http.MethodGet, "/api/v1/student/schedule", teacherToken, http.StatusForbidden},
		{"student blocked from teacher attendance view", http.MethodGet, "/api/v1/teacher/sessions/11111111-1111-1111-1111-111111111111/attendance", studentToken, http.StatusForbidden},
		{"student blocked from attendance recording", http.MethodPost, "/api/v1/teacher/sessions/11111111-1111-1111-1111-111111111111/attendance", studentToken, http.StatusForbidden},
		{"teacher blocked from student attendance", http.MethodGet, "/api/v1/student/attendance", teacherToken, http.StatusForbidden},
		{"teacher blocked from student class attendance", http.MethodGet, "/api/v1/student/sessions/11111111-1111-1111-1111-111111111111/attendance", teacherToken, http.StatusForbidden},
		{"teacher blocked from student attendance summary", http.MethodGet, "/api/v1/student/attendance/summary", teacherToken, http.StatusForbidden},
		{"student blocked from assessment history", http.MethodGet, "/api/v1/teacher/classes/11111111-1111-1111-1111-111111111111/students/22222222-2222-2222-2222-222222222222/assessments", studentToken, http.StatusForbidden},
		{"student blocked from assessment creation", http.MethodPost, "/api/v1/teacher/classes/11111111-1111-1111-1111-111111111111/students/22222222-2222-2222-2222-222222222222/assessments", studentToken, http.StatusForbidden},
		{"student blocked from assessment detail", http.MethodGet, "/api/v1/teacher/assessments/11111111-1111-1111-1111-111111111111", studentToken, http.StatusForbidden},
		{"student blocked from assessment update", http.MethodPut, "/api/v1/teacher/assessments/11111111-1111-1111-1111-111111111111", studentToken, http.StatusForbidden},
		{"student blocked from assessment submit", http.MethodPost, "/api/v1/teacher/assessments/11111111-1111-1111-1111-111111111111/submit", studentToken, http.StatusForbidden},
		{"student blocked from assessment lock", http.MethodPost, "/api/v1/teacher/assessments/11111111-1111-1111-1111-111111111111/lock", studentToken, http.StatusForbidden},
		{"teacher blocked from student assessments", http.MethodGet, "/api/v1/student/assessments", teacherToken, http.StatusForbidden},
		{"teacher blocked from student assessment detail", http.MethodGet, "/api/v1/student/assessments/11111111-1111-1111-1111-111111111111", teacherToken, http.StatusForbidden},
		{"teacher blocked from student progress", http.MethodGet, "/api/v1/student/progress", teacherToken, http.StatusForbidden},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(test.method, test.path, nil)
			if test.token != "" {
				req.Header.Set("Authorization", "Bearer "+test.token)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != test.want {
				t.Errorf("status=%d, want %d", rec.Code, test.want)
			}
		})
	}
}
