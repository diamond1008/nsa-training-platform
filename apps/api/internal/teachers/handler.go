package teachers

import (
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/avatar"
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

type writeRequest struct {
	Email          string  `json:"email"`
	Password       string  `json:"temporary_password,omitempty"`
	AccountStatus  string  `json:"account_status"`
	TeacherCode    string  `json:"teacher_code"`
	FullName       string  `json:"full_name"`
	AvatarURL      *string `json:"avatar_url"`
	Phone          *string `json:"phone"`
	Specialization *string `json:"specialization"`
	Status         string  `json:"status"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateWrite(body, true)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Create(r.Context(), actorID, input)
	h.writeResult(w, r, view, err, true)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Get(r.Context(), chi.URLParam(r, "teacherID"))
	h.writeResult(w, r, view, err, false)
}

func (h *Handler) ProfileSummary(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.ProfileSummary(r.Context(), chi.URLParam(r, "teacherID"))
	if errors.Is(err, ErrNotFound) {
		response.Fail(w, http.StatusNotFound, "TEACHER_NOT_FOUND", "Teacher not found")
		return
	}
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) ClassHistory(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	result, err := h.service.ClassHistory(r.Context(), chi.URLParam(r, "teacherID"), page, perPage)
	if errors.Is(err, ErrNotFound) {
		response.Fail(w, http.StatusNotFound, "TEACHER_NOT_FOUND", "Teacher not found")
		return
	}
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validTeacherStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid teacher status")
		return
	}
	for _, name := range []string{"class_id", "course_id"} {
		if value := strings.TrimSpace(r.URL.Query().Get(name)); value != "" {
			if _, err := data.UUID(value); err != nil {
				response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", name+" must be a valid UUID")
				return
			}
		}
	}
	assignment := strings.TrimSpace(r.URL.Query().Get("assignment"))
	if assignment != "" && assignment != "assigned" && assignment != "unassigned" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "assignment must be assigned or unassigned")
		return
	}
	sortBy, sortOrder, err := request.Sort(r, "created_at", "created_at", "full_name", "teacher_code")
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	result, err := h.service.List(r.Context(), ListFilter{
		Search: r.URL.Query().Get("search"), Status: status,
		ClassID: r.URL.Query().Get("class_id"), CourseID: r.URL.Query().Get("course_id"),
		Assignment: assignment, SortBy: sortBy, SortOrder: sortOrder, Page: page, PerPage: perPage,
	})
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var body writeRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	input, message := validateWrite(body, false)
	if message != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Update(r.Context(), actorID, chi.URLParam(r, "teacherID"), input)
	h.writeResult(w, r, view, err, false)
}

func (h *Handler) writeResult(w http.ResponseWriter, r *http.Request, view View, err error, created bool) {
	switch {
	case err == nil && created:
		response.Created(w, view)
	case err == nil:
		response.OK(w, view)
	case errors.Is(err, ErrNotFound):
		response.Fail(w, http.StatusNotFound, "TEACHER_NOT_FOUND", "Teacher not found")
	case errors.Is(err, ErrEmailConflict):
		response.Fail(w, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "Email already exists")
	case errors.Is(err, ErrCodeConflict):
		response.Fail(w, http.StatusConflict, "TEACHER_CODE_ALREADY_EXISTS", "Teacher code already exists")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}

func validateWrite(body writeRequest, create bool) (WriteInput, string) {
	body.Email = strings.ToLower(strings.TrimSpace(body.Email))
	body.TeacherCode = strings.TrimSpace(body.TeacherCode)
	body.FullName = strings.TrimSpace(body.FullName)
	body.AccountStatus = strings.TrimSpace(body.AccountStatus)
	body.Status = strings.TrimSpace(body.Status)
	var avatarOK bool
	body.AvatarURL, avatarOK = avatar.NormalizeWebPDataURL(body.AvatarURL)
	address, err := mail.ParseAddress(body.Email)
	if err != nil || address.Address != body.Email {
		return WriteInput{}, "A valid email is required"
	}
	if len(body.Email) > 320 {
		return WriteInput{}, "Email is too long"
	}
	if create && len(body.Password) < 8 {
		return WriteInput{}, "temporary_password must be at least 8 characters"
	}
	if !create && body.Password != "" {
		return WriteInput{}, "temporary_password cannot be changed through this endpoint"
	}
	if body.TeacherCode == "" || len(body.TeacherCode) > 30 {
		return WriteInput{}, "teacher_code is required and must be at most 30 characters"
	}
	if body.FullName == "" || len(body.FullName) > 160 {
		return WriteInput{}, "full_name is required and must be at most 160 characters"
	}
	if !avatarOK {
		return WriteInput{}, "avatar_url must be a WebP data URL no larger than 256 KiB"
	}
	if body.Phone != nil && len(*body.Phone) > 30 {
		return WriteInput{}, "phone must be at most 30 characters"
	}
	if body.Specialization != nil && len(*body.Specialization) > 200 {
		return WriteInput{}, "specialization must be at most 200 characters"
	}
	if !validUserStatus(body.AccountStatus) || !validTeacherStatus(body.Status) {
		return WriteInput{}, "Invalid account_status or teacher status"
	}
	return WriteInput{
		Email: body.Email, Password: body.Password,
		AccountStatus: db.UserStatus(body.AccountStatus),
		TeacherCode:   body.TeacherCode, FullName: body.FullName,
		AvatarURL: body.AvatarURL,
		Phone:     body.Phone, Specialization: body.Specialization,
		Status: db.TeacherStatus(body.Status),
	}, ""
}

func validUserStatus(value string) bool {
	switch db.UserStatus(value) {
	case db.UserStatusPending, db.UserStatusActive, db.UserStatusSuspended, db.UserStatusInactive:
		return true
	default:
		return false
	}
}

func validTeacherStatus(value string) bool {
	switch db.TeacherStatus(value) {
	case db.TeacherStatusActive, db.TeacherStatusInactive:
		return true
	default:
		return false
	}
}

func (h *Handler) WorkloadSummary(w http.ResponseWriter, r *http.Request) {
	teacherID := chi.URLParam(r, "teacherID")
	items, err := h.service.GetWorkloadSummary(r.Context(), teacherID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "Teacher not found")
			return
		}
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read teacher workload summary")
		return
	}
	response.OK(w, items)
}

func (h *Handler) AuditLogs(w http.ResponseWriter, r *http.Request) {
	teacherID := chi.URLParam(r, "teacherID")
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_PAGINATION", err.Error())
		return
	}
	result, err := h.service.GetAuditLogs(r.Context(), teacherID, page, perPage)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to read audit logs")
		return
	}
	response.OK(w, result)
}

type statusUpdateRequest struct {
	AccountStatus string `json:"account_status"`
	Reason        string `json:"reason"`
}

func (h *Handler) UpdateAccountStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFrom(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}
	teacherID := chi.URLParam(r, "teacherID")
	var body statusUpdateRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	view, err := h.service.UpdateAccountStatus(r.Context(), teacherID, body.AccountStatus, body.Reason, claims.UserID)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "Teacher not found")
		case err.Error() == "status change reason is required":
			response.Fail(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Status change reason is required")
		default:
			response.Fail(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		}
		return
	}
	response.OK(w, view)
}
