package progress

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	classID := strings.TrimSpace(r.URL.Query().Get("class_id"))
	if classID != "" {
		if _, err := data.UUID(classID); err != nil {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "class_id must be a valid UUID")
			return
		}
	}
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.Dashboard(r.Context(), userID, classID)
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, view)
}
