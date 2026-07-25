package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/attendance"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
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
			r, tokens, schedules.NewHandler(nil, log), attendance.NewHandler(nil, log),
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
		{"teacher blocked from student schedule", http.MethodGet, "/api/v1/student/schedule", teacherToken, http.StatusForbidden},
		{"student blocked from teacher attendance view", http.MethodGet, "/api/v1/teacher/sessions/11111111-1111-1111-1111-111111111111/attendance", studentToken, http.StatusForbidden},
		{"student blocked from attendance recording", http.MethodPost, "/api/v1/teacher/sessions/11111111-1111-1111-1111-111111111111/attendance", studentToken, http.StatusForbidden},
		{"student blocked from attendance lock", http.MethodPost, "/api/v1/teacher/sessions/11111111-1111-1111-1111-111111111111/attendance/lock", studentToken, http.StatusForbidden},
		{"teacher blocked from student attendance", http.MethodGet, "/api/v1/student/attendance", teacherToken, http.StatusForbidden},
		{"teacher blocked from student attendance summary", http.MethodGet, "/api/v1/student/attendance/summary", teacherToken, http.StatusForbidden},
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
