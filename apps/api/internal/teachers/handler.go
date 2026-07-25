package teachers

import (
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
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

type writeRequest struct {
	Email          string  `json:"email"`
	Password       string  `json:"temporary_password,omitempty"`
	AccountStatus  string  `json:"account_status"`
	TeacherCode    string  `json:"teacher_code"`
	FullName       string  `json:"full_name"`
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
	result, err := h.service.List(r.Context(), r.URL.Query().Get("search"), status, page, perPage)
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
		Phone: body.Phone, Specialization: body.Specialization,
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
