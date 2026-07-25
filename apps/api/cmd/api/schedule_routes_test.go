package main

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

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
		mountScheduleViewerRoutes(r, tokens, schedules.NewHandler(nil, log))
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
		name  string
		path  string
		token string
		want  int
	}{
		{"teacher schedule without auth", "/api/v1/teacher/schedule", "", http.StatusUnauthorized},
		{"student blocked from teacher schedule", "/api/v1/teacher/schedule", studentToken, http.StatusForbidden},
		{"teacher blocked from student schedule", "/api/v1/student/schedule", teacherToken, http.StatusForbidden},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path, nil)
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
