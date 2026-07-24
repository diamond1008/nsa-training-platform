package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOK_EnvelopeShape(t *testing.T) {
	rec := httptest.NewRecorder()
	OK(rec, map[string]string{"status": "ok"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Fatalf("Content-Type = %q", ct)
	}

	var body Success
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Message != "Success" {
		t.Errorf("message = %q, want Success", body.Message)
	}
	data, ok := body.Data.(map[string]any)
	if !ok || data["status"] != "ok" {
		t.Errorf("data = %v", body.Data)
	}
}

func TestFail_EnvelopeShape(t *testing.T) {
	rec := httptest.NewRecorder()
	Fail(rec, http.StatusNotFound, "STUDENT_NOT_FOUND", "Student not found")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}

	var body Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Error.Code != "STUDENT_NOT_FOUND" {
		t.Errorf("code = %q", body.Error.Code)
	}
	if body.Error.Message != "Student not found" {
		t.Errorf("message = %q", body.Error.Message)
	}
	// details must be omitted when empty
	var raw map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	errMap := raw["error"].(map[string]any)
	if _, exists := errMap["details"]; exists {
		t.Errorf("details should be omitted, raw = %v", errMap)
	}
}

func TestFailDetails_IncludesDetails(t *testing.T) {
	rec := httptest.NewRecorder()
	FailDetails(rec, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid input",
		[]string{"email is required"})

	var body Error
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	details, ok := body.Error.Details.([]any)
	if !ok || len(details) != 1 || details[0] != "email is required" {
		t.Errorf("details = %v", body.Error.Details)
	}
}
