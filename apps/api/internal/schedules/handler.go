package schedules

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type locationRequest struct {
	Code         string `json:"code"`
	Name         string `json:"name"`
	LocationType string `json:"location_type"`
	Capacity     *int32 `json:"capacity"`
	IsActive     *bool  `json:"is_active"`
}

type sessionRequest struct {
	ClassID      string  `json:"class_id"`
	ModuleID     *string `json:"module_id"`
	TeacherID    *string `json:"teacher_id"`
	LocationID   *string `json:"location_id"`
	Title        string  `json:"title"`
	SessionType  string  `json:"session_type"`
	StartsAt     string  `json:"starts_at"`
	EndsAt       string  `json:"ends_at"`
	Status       string  `json:"status"`
	ChangeReason string  `json:"change_reason"`
}

func (h *Handler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeLocation(w, r, true)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.CreateLocation(r.Context(), actorID, input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, view)
}

func (h *Handler) GetLocation(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.GetLocation(r.Context(), chi.URLParam(r, "locationID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) ListLocations(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	var active *bool
	if raw := strings.TrimSpace(r.URL.Query().Get("is_active")); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "is_active must be true or false")
			return
		}
		active = &parsed
	}
	result, err := h.service.ListLocations(r.Context(), r.URL.Query().Get("search"), active, page, perPage)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeLocation(w, r, false)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateLocation(r.Context(), actorID, chi.URLParam(r, "locationID"), input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeSession(w, r, false)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.CreateSession(r.Context(), actorID, input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.Created(w, view)
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.GetSession(r.Context(), chi.URLParam(r, "sessionID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) ListAdminSessions(w http.ResponseWriter, r *http.Request) {
	filter, ok := parseListFilter(w, r, true)
	if !ok {
		return
	}
	result, err := h.service.ListAdmin(r.Context(), filter)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) UpdateSession(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeSession(w, r, true)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateSession(r.Context(), actorID, chi.URLParam(r, "sessionID"), input)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) TeacherSchedule(w http.ResponseWriter, r *http.Request) {
	filter, ok := parseListFilter(w, r, true)
	if !ok {
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.ListTeacher(r.Context(), userID, filter)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) StudentSchedule(w http.ResponseWriter, r *http.Request) {
	filter, ok := parseListFilter(w, r, false)
	if !ok {
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.ListStudent(r.Context(), userID, filter)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) AdminStudentSchedule(w http.ResponseWriter, r *http.Request) {
	filter, ok := parseListFilter(w, r, false)
	if !ok {
		return
	}
	result, err := h.service.ListAdminStudent(r.Context(), chi.URLParam(r, "studentID"), filter)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) decodeLocation(w http.ResponseWriter, r *http.Request, create bool) (LocationInput, bool) {
	var body locationRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return LocationInput{}, false
	}
	body.Code = strings.TrimSpace(body.Code)
	body.Name = strings.TrimSpace(body.Name)
	body.LocationType = strings.TrimSpace(body.LocationType)
	if body.Code == "" || len(body.Code) > 30 || body.Name == "" || len(body.Name) > 160 ||
		body.LocationType == "" || len(body.LocationType) > 40 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid location code, name, or type")
		return LocationInput{}, false
	}
	if body.Capacity != nil && *body.Capacity <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "capacity must be positive when provided")
		return LocationInput{}, false
	}
	active := true
	if body.IsActive != nil {
		active = *body.IsActive
	} else if !create {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "is_active is required for updates")
		return LocationInput{}, false
	}
	return LocationInput{
		Code: body.Code, Name: body.Name, LocationType: body.LocationType,
		Capacity: body.Capacity, IsActive: active,
	}, true
}

func (h *Handler) decodeSession(w http.ResponseWriter, r *http.Request, requireReason bool) (SessionInput, bool) {
	var body sessionRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return SessionInput{}, false
	}
	body.ClassID = strings.TrimSpace(body.ClassID)
	body.Title = strings.TrimSpace(body.Title)
	body.SessionType = strings.TrimSpace(body.SessionType)
	body.Status = strings.TrimSpace(body.Status)
	body.ChangeReason = strings.TrimSpace(body.ChangeReason)
	if body.ClassID == "" || body.Title == "" || len(body.Title) > 200 ||
		!validSessionType(body.SessionType) || !validSessionStatus(body.Status) ||
		(requireReason && (body.ChangeReason == "" || len(body.ChangeReason) > 500)) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid class, title, session_type, or status")
		return SessionInput{}, false
	}
	if _, err := data.UUID(body.ClassID); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "class_id must be a valid UUID")
		return SessionInput{}, false
	}
	for name, value := range map[string]*string{
		"module_id": body.ModuleID, "teacher_id": body.TeacherID, "location_id": body.LocationID,
	} {
		if value != nil && strings.TrimSpace(*value) != "" {
			if _, err := data.UUID(strings.TrimSpace(*value)); err != nil {
				response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", name+" must be a valid UUID or null")
				return SessionInput{}, false
			}
		}
	}
	startsAt, startErr := time.Parse(time.RFC3339, body.StartsAt)
	endsAt, endErr := time.Parse(time.RFC3339, body.EndsAt)
	if startErr != nil || endErr != nil || !endsAt.After(startsAt) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "starts_at and ends_at must be valid RFC3339 values with ends_at after starts_at")
		return SessionInput{}, false
	}
	return SessionInput{
		ClassID: body.ClassID, ModuleID: body.ModuleID, TeacherID: body.TeacherID,
		LocationID: body.LocationID, Title: body.Title,
		SessionType: db.SessionType(body.SessionType),
		StartsAt:    startsAt, EndsAt: endsAt, Status: db.SessionStatus(body.Status),
		ChangeReason: body.ChangeReason,
	}, true
}

func parseListFilter(w http.ResponseWriter, r *http.Request, admin bool) (ListFilter, bool) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return ListFilter{}, false
	}
	filter := ListFilter{Page: page, PerPage: perPage}
	if admin {
		filter.Search = r.URL.Query().Get("search")
		filter.Status = strings.TrimSpace(r.URL.Query().Get("status"))
		filter.SessionType = strings.TrimSpace(r.URL.Query().Get("session_type"))
		filter.AttendanceState = strings.TrimSpace(r.URL.Query().Get("attendance_state"))
		filter.ClassID = strings.TrimSpace(r.URL.Query().Get("class_id"))
		filter.TeacherID = strings.TrimSpace(r.URL.Query().Get("teacher_id"))
		filter.LocationID = strings.TrimSpace(r.URL.Query().Get("location_id"))
		if filter.Status != "" && !validAnySessionStatus(filter.Status) {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid session status")
			return ListFilter{}, false
		}
		if filter.SessionType != "" && !validSessionType(filter.SessionType) {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid session type")
			return ListFilter{}, false
		}
		if filter.AttendanceState != "" && filter.AttendanceState != "locked" && filter.AttendanceState != "unlocked" {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "attendance_state must be locked or unlocked")
			return ListFilter{}, false
		}
		sortBy, sortOrder, err := request.Sort(r, "starts_at", "starts_at", "title", "created_at")
		if err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return ListFilter{}, false
		}
		if strings.TrimSpace(r.URL.Query().Get("sort_order")) == "" {
			sortOrder = "asc"
		}
		filter.SortBy, filter.SortOrder = sortBy, sortOrder
		for name, value := range map[string]string{
			"class_id": filter.ClassID, "teacher_id": filter.TeacherID, "location_id": filter.LocationID,
		} {
			if value != "" {
				if _, err := data.UUID(value); err != nil {
					response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", name+" must be a valid UUID")
					return ListFilter{}, false
				}
			}
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("from")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "from must be RFC3339")
			return ListFilter{}, false
		}
		filter.From = &parsed
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("to")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "to must be RFC3339")
			return ListFilter{}, false
		}
		filter.To = &parsed
	}
	if filter.From != nil && filter.To != nil && !filter.To.After(*filter.From) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "to must be after from")
		return ListFilter{}, false
	}
	return filter, true
}

func validSessionType(value string) bool {
	switch db.SessionType(value) {
	case db.SessionTypeTheory, db.SessionTypeWorkshop, db.SessionTypeAssessment, db.SessionTypeOther:
		return true
	default:
		return false
	}
}

func validSessionStatus(value string) bool {
	switch db.SessionStatus(value) {
	case db.SessionStatusScheduled, db.SessionStatusCompleted, db.SessionStatusCancelled:
		return true
	default:
		return false
	}
}

func validAnySessionStatus(value string) bool {
	return validSessionStatus(value) || db.SessionStatus(value) == db.SessionStatusLocked
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrSessionNotFound):
		response.Fail(w, http.StatusNotFound, "SESSION_NOT_FOUND", "Class session not found")
	case errors.Is(err, ErrClassNotFound):
		response.Fail(w, http.StatusNotFound, "CLASS_NOT_FOUND", "Class not found")
	case errors.Is(err, ErrTeacherNotFound):
		response.Fail(w, http.StatusNotFound, "TEACHER_NOT_FOUND", "Teacher not found")
	case errors.Is(err, ErrStudentNotFound):
		response.Fail(w, http.StatusNotFound, "STUDENT_NOT_FOUND", "Student not found")
	case errors.Is(err, ErrLocationNotFound):
		response.Fail(w, http.StatusNotFound, "LOCATION_NOT_FOUND", "Training location not found")
	case errors.Is(err, ErrSessionLocked):
		response.Fail(w, http.StatusConflict, "SESSION_LOCKED", "Locked sessions cannot be changed")
	case errors.Is(err, ErrClassStatus):
		response.Fail(w, http.StatusConflict, "CLASS_STATUS_INVALID", "Class status does not allow scheduling")
	case errors.Is(err, ErrSessionOutsideClass):
		response.Fail(w, http.StatusConflict, "SESSION_OUTSIDE_CLASS_DATES", "Session must be within class dates in Asia/Ho_Chi_Minh")
	case errors.Is(err, ErrSessionTimeSlot):
		response.Fail(w, http.StatusConflict, "SESSION_TIME_SLOT_INVALID", "Session must use a fixed Vietnam training slot: 08:00-12:00, 13:30-17:30, or 18:30-21:30")
	case errors.Is(err, ErrModuleCourse):
		response.Fail(w, http.StatusBadRequest, "MODULE_COURSE_MISMATCH", "Module does not belong to the class course")
	case errors.Is(err, ErrTeacherInactive):
		response.Fail(w, http.StatusConflict, "TEACHER_INACTIVE", "Only active teachers can be scheduled")
	case errors.Is(err, ErrTeacherNotAssigned):
		response.Fail(w, http.StatusConflict, "TEACHER_NOT_ASSIGNED", "Teacher must be assigned to the class")
	case errors.Is(err, ErrLocationInactive):
		response.Fail(w, http.StatusConflict, "LOCATION_INACTIVE", "Only active locations can be scheduled")
	case errors.Is(err, ErrLocationCodeConflict):
		response.Fail(w, http.StatusConflict, "LOCATION_CODE_ALREADY_EXISTS", "Training location code already exists")
	case errors.Is(err, ErrClassConflict):
		response.Fail(w, http.StatusConflict, "CLASS_SCHEDULE_CONFLICT", "Class already has an overlapping session")
	case errors.Is(err, ErrTeacherConflict):
		response.Fail(w, http.StatusConflict, "TEACHER_SCHEDULE_CONFLICT", "Teacher already has an overlapping session")
	case errors.Is(err, ErrLocationConflict):
		response.Fail(w, http.StatusConflict, "LOCATION_SCHEDULE_CONFLICT", "Location already has an overlapping session")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
