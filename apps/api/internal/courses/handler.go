package courses

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
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

type courseRequest struct {
	Code                 string  `json:"code"`
	Name                 string  `json:"name"`
	Description          *string `json:"description"`
	TotalSessions        int32   `json:"total_sessions"`
	MinimumAttendancePct float64 `json:"minimum_attendance_pct"`
	Status               string  `json:"status"`
}

type moduleRequest struct {
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	SequenceNo      int32   `json:"sequence_no"`
	PlannedSessions int32   `json:"planned_sessions"`
	Description     *string `json:"description"`
}

type criterionRequest struct {
	ModuleID    *string `json:"module_id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsRequired  *bool   `json:"is_required"`
	SequenceNo  int32   `json:"sequence_no"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeCourse(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Create(r.Context(), actorID, input)
	h.writeCourse(w, r, view, err, true)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Get(r.Context(), chi.URLParam(r, "courseID"))
	h.writeCourse(w, r, view, err, false)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validCourseStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid course status")
		return
	}
	result, err := h.service.List(r.Context(), r.URL.Query().Get("search"), status, page, perPage)
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeCourse(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Update(r.Context(), actorID, chi.URLParam(r, "courseID"), input)
	h.writeCourse(w, r, view, err, false)
}

func (h *Handler) CreateModule(w http.ResponseWriter, r *http.Request) {
	var body moduleRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateModule(body)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.CreateModule(r.Context(), actorID, chi.URLParam(r, "courseID"), input)
	h.writeModule(w, r, view, err, true)
}

func (h *Handler) ListModules(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListModules(r.Context(), chi.URLParam(r, "courseID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) UpdateModule(w http.ResponseWriter, r *http.Request) {
	var body moduleRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateModule(body)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateModule(
		r.Context(), actorID, chi.URLParam(r, "courseID"), chi.URLParam(r, "moduleID"), input,
	)
	h.writeModule(w, r, view, err, false)
}

func (h *Handler) CreateCriterion(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeCriterion(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.CreateCriterion(r.Context(), actorID, chi.URLParam(r, "courseID"), input)
	h.writeCriterion(w, r, view, err, true)
}

func (h *Handler) ListCriteria(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListCriteria(r.Context(), chi.URLParam(r, "courseID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) UpdateCriterion(w http.ResponseWriter, r *http.Request) {
	input, ok := h.decodeCriterion(w, r)
	if !ok {
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.UpdateCriterion(
		r.Context(), actorID, chi.URLParam(r, "courseID"), chi.URLParam(r, "criterionID"), input,
	)
	h.writeCriterion(w, r, view, err, false)
}

func (h *Handler) decodeCourse(w http.ResponseWriter, r *http.Request) (CourseInput, bool) {
	var body courseRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return CourseInput{}, false
	}
	body.Code, body.Name, body.Status = strings.TrimSpace(body.Code), strings.TrimSpace(body.Name), strings.TrimSpace(body.Status)
	if body.Code == "" || len(body.Code) > 30 || body.Name == "" || len(body.Name) > 200 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "code and name are required and exceed allowed length")
		return CourseInput{}, false
	}
	if body.TotalSessions <= 0 || body.MinimumAttendancePct != 80 || !validCourseStatus(body.Status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "total_sessions must be positive, minimum_attendance_pct must be 80, and status must be valid")
		return CourseInput{}, false
	}
	return CourseInput{
		Code: body.Code, Name: body.Name, Description: body.Description,
		TotalSessions: body.TotalSessions, MinimumAttendancePct: body.MinimumAttendancePct,
		Status: db.CourseStatus(body.Status),
	}, true
}

func (h *Handler) decodeCriterion(w http.ResponseWriter, r *http.Request) (CriterionInput, bool) {
	var body criterionRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return CriterionInput{}, false
	}
	body.Code, body.Name = strings.TrimSpace(body.Code), strings.TrimSpace(body.Name)
	if body.Code == "" || len(body.Code) > 40 || body.Name == "" || len(body.Name) > 200 || body.SequenceNo <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid code, name, or sequence_no")
		return CriterionInput{}, false
	}
	required := true
	if body.IsRequired != nil {
		required = *body.IsRequired
	}
	return CriterionInput{
		ModuleID: body.ModuleID, Code: body.Code, Name: body.Name,
		Description: body.Description, IsRequired: required, SequenceNo: body.SequenceNo,
	}, true
}

func validateModule(body moduleRequest) (ModuleInput, string) {
	body.Code, body.Name = strings.TrimSpace(body.Code), strings.TrimSpace(body.Name)
	if body.Code == "" || len(body.Code) > 30 || body.Name == "" || len(body.Name) > 200 {
		return ModuleInput{}, "code and name are required and exceed allowed length"
	}
	if body.SequenceNo <= 0 || body.PlannedSessions <= 0 {
		return ModuleInput{}, "sequence_no and planned_sessions must be positive"
	}
	return ModuleInput{
		Code: body.Code, Name: body.Name, SequenceNo: body.SequenceNo,
		PlannedSessions: body.PlannedSessions, Description: body.Description,
	}, ""
}

func validCourseStatus(value string) bool {
	switch db.CourseStatus(value) {
	case db.CourseStatusDraft, db.CourseStatusActive, db.CourseStatusInactive, db.CourseStatusArchived:
		return true
	default:
		return false
	}
}

func (h *Handler) writeCourse(w http.ResponseWriter, r *http.Request, view CourseView, err error, created bool) {
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		response.Created(w, view)
	} else {
		response.OK(w, view)
	}
}

func (h *Handler) writeModule(w http.ResponseWriter, r *http.Request, view ModuleView, err error, created bool) {
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		response.Created(w, view)
	} else {
		response.OK(w, view)
	}
}

func (h *Handler) writeCriterion(w http.ResponseWriter, r *http.Request, view CriterionView, err error, created bool) {
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if created {
		response.Created(w, view)
	} else {
		response.OK(w, view)
	}
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrCourseNotFound):
		response.Fail(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found")
	case errors.Is(err, ErrModuleNotFound):
		response.Fail(w, http.StatusNotFound, "COURSE_MODULE_NOT_FOUND", "Course module not found")
	case errors.Is(err, ErrCriterionNotFound):
		response.Fail(w, http.StatusNotFound, "COMPETENCY_NOT_FOUND", "Competency criterion not found")
	case errors.Is(err, ErrCourseConflict):
		response.Fail(w, http.StatusConflict, "COURSE_CODE_ALREADY_EXISTS", "Course code already exists")
	case errors.Is(err, ErrModuleConflict):
		response.Fail(w, http.StatusConflict, "COURSE_MODULE_CONFLICT", "Module code or sequence already exists in this course")
	case errors.Is(err, ErrCriterionConflict):
		response.Fail(w, http.StatusConflict, "COMPETENCY_CONFLICT", "Competency code or sequence already exists in this course")
	case errors.Is(err, ErrModuleCourse):
		response.Fail(w, http.StatusBadRequest, "MODULE_COURSE_MISMATCH", "Module does not belong to the course")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
