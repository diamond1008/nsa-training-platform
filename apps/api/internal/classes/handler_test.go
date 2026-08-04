package classes

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestUpdateEnrollmentRejectsInvalidReenrollmentTimestamp(t *testing.T) {
	handler := NewHandler(nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	router := chi.NewRouter()
	router.Put("/classes/{classID}/enrollments/{enrollmentID}", handler.UpdateEnrollment)

	req := httptest.NewRequest(
		http.MethodPut,
		"/classes/11111111-1111-1111-1111-111111111111/enrollments/22222222-2222-2222-2222-222222222222",
		strings.NewReader(`{"status":"enrolled","reason":"Học viên quay lại học","effective_at":"tomorrow"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s, want 400", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "VALIDATION_ERROR") {
		t.Fatalf("body=%s, want validation error", rec.Body.String())
	}
}
