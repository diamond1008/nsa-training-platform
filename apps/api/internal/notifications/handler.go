package notifications

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	userID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.List(r.Context(), userID, page, perPage)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) { h.change(w, r, true) }
func (h *Handler) Archive(w http.ResponseWriter, r *http.Request)  { h.change(w, r, false) }
func (h *Handler) change(w http.ResponseWriter, r *http.Request, read bool) {
	userID, _ := auth.UserIDFrom(r.Context())
	var (
		view View
		err  error
	)
	if read {
		view, err = h.service.MarkRead(r.Context(), userID, chi.URLParam(r, "notificationID"))
	} else {
		view, err = h.service.Archive(r.Context(), userID, chi.URLParam(r, "notificationID"))
	}
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}
func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, ErrNotFound) {
		response.Fail(w, http.StatusNotFound, "NOTIFICATION_NOT_FOUND", "Notification not found")
		return
	}
	response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
}
