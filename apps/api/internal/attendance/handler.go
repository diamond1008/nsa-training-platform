package attendance

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

const (
	maxBatchSize   = 200
	maxNoteRunes   = 1000
	maxReasonRunes = 500
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type batchRequest struct {
	Records []batchRecordRequest `json:"records"`
}

type batchRecordRequest struct {
	StudentID string  `json:"student_id"`
	Status    string  `json:"status"`
	Note      *string `json:"note"`
}

type correctionRequest struct {
	Status string  `json:"status"`
	Note   *string `json:"note"`
	Reason string  `json:"reason"`
}

func (h *Handler) TeacherSession(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.GetTeacherSession(r.Context(), userID, chi.URLParam(r, "sessionID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) AdminSession(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.GetAdminSession(r.Context(), chi.URLParam(r, "sessionID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) RecordBatch(w http.ResponseWriter, r *http.Request) {
	var body batchRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	if len(body.Records) == 0 || len(body.Records) > maxBatchSize {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "records must contain between 1 and 200 items")
		return
	}
	items := make([]BatchItemInput, 0, len(body.Records))
	for index, item := range body.Records {
		studentID := strings.TrimSpace(item.StudentID)
		if _, err := data.UUID(studentID); err != nil {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid attendance record", map[string]any{
				"index": index, "field": "student_id", "message": "student_id must be a valid UUID",
			})
			return
		}
		status, ok := attendanceStatus(item.Status)
		if !ok {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid attendance record", map[string]any{
				"index": index, "field": "status", "message": "status must be present, absent, late, or excused",
			})
			return
		}
		note, ok := normalizeOptional(item.Note, maxNoteRunes)
		if !ok {
			response.FailDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid attendance record", map[string]any{
				"index": index, "field": "note", "message": "note must not exceed 1000 characters",
			})
			return
		}
		items = append(items, BatchItemInput{StudentID: studentID, Status: status, Note: note})
	}
	userID, _ := auth.UserIDFrom(r.Context())
	records, err := h.service.RecordBatch(r.Context(), userID, chi.URLParam(r, "sessionID"), items)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, map[string]any{"items": records, "count": len(records)})
}

func (h *Handler) Lock(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Lock(r.Context(), userID, chi.URLParam(r, "sessionID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) Correct(w http.ResponseWriter, r *http.Request) {
	var body correctionRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	status, ok := attendanceStatus(body.Status)
	if !ok {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "status must be present, absent, late, or excused")
		return
	}
	note, ok := normalizeOptional(body.Note, maxNoteRunes)
	if !ok {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "note must not exceed 1000 characters")
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" || len([]rune(reason)) > maxReasonRunes {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "reason is required and must not exceed 500 characters")
		return
	}
	adminID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Correct(r.Context(), adminID, chi.URLParam(r, "attendanceID"), CorrectionInput{
		Status: status, Note: note, Reason: reason,
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) StudentHistory(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	if classID != "" {
		if _, err := data.UUID(classID); err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "class_id must be a valid UUID")
			return
		}
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.StudentHistory(r.Context(), userID, classID, page, perPage)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) StudentSummary(w http.ResponseWriter, r *http.Request) {
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	if classID != "" {
		if _, err := data.UUID(classID); err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "class_id must be a valid UUID")
			return
		}
	}
	userID, _ := auth.UserIDFrom(r.Context())
	items, err := h.service.StudentSummary(r.Context(), userID, classID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, map[string]any{"items": items})
}

func attendanceStatus(value string) (db.AttendanceStatus, bool) {
	switch db.AttendanceStatus(strings.ToLower(strings.TrimSpace(value))) {
	case db.AttendanceStatusPresent:
		return db.AttendanceStatusPresent, true
	case db.AttendanceStatusAbsent:
		return db.AttendanceStatusAbsent, true
	case db.AttendanceStatusLate:
		return db.AttendanceStatusLate, true
	case db.AttendanceStatusExcused:
		return db.AttendanceStatusExcused, true
	default:
		return "", false
	}
}

func normalizeOptional(value *string, maxRunes int) (*string, bool) {
	if value == nil {
		return nil, true
	}
	normalized := strings.TrimSpace(*value)
	if len([]rune(normalized)) > maxRunes {
		return nil, false
	}
	if normalized == "" {
		return nil, true
	}
	return &normalized, true
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrSessionNotFound):
		response.Fail(w, http.StatusNotFound, "SESSION_NOT_FOUND", "Class session not found")
	case errors.Is(err, ErrAttendanceNotFound):
		response.Fail(w, http.StatusNotFound, "ATTENDANCE_NOT_FOUND", "Attendance record not found")
	case errors.Is(err, ErrTeacherNotAssigned):
		response.Fail(w, http.StatusForbidden, "TEACHER_NOT_ASSIGNED", "Teacher is not assigned to this class")
	case errors.Is(err, ErrSessionCancelled):
		response.Fail(w, http.StatusConflict, "SESSION_CANCELLED", "Attendance is unavailable for a cancelled session")
	case errors.Is(err, ErrSessionLocked):
		response.Fail(w, http.StatusConflict, "ATTENDANCE_LOCKED", "Session attendance is locked")
	case errors.Is(err, ErrSessionNotStarted):
		response.Fail(w, http.StatusConflict, "SESSION_NOT_STARTED", "Attendance cannot be finalized before the session starts")
	case errors.Is(err, ErrStudentNotEnrolled):
		response.Fail(w, http.StatusUnprocessableEntity, "STUDENT_NOT_ENROLLED", "Student is not actively enrolled in the session class")
	case errors.Is(err, ErrDuplicateStudent):
		response.Fail(w, http.StatusBadRequest, "DUPLICATE_STUDENT", "A student appears more than once in the batch")
	case errors.Is(err, ErrAttendanceExists):
		response.Fail(w, http.StatusConflict, "ATTENDANCE_ALREADY_EXISTS", "Attendance already exists for the student and session")
	case errors.Is(err, ErrAttendanceIncomplete):
		response.Fail(w, http.StatusConflict, "ATTENDANCE_INCOMPLETE", "Every active student must have attendance before locking")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
