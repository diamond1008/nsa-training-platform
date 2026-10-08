package interactions

import (
	"errors"
	"log/slog"
	"net/http"

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

type interactionCreateRequest struct {
	Channel string  `json:"channel"`
	Summary string  `json:"summary"`
	Outcome *string `json:"outcome"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	leadID := chi.URLParam(r, "leadID")
	actorID, _ := auth.UserIDFrom(r.Context())

	var body interactionCreateRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}

	if body.Summary == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "summary is required")
		return
	}

	channel := db.InteractionChannel(body.Channel)
	if !isValidChannel(channel) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid interaction channel")
		return
	}

	view, err := h.service.Create(r.Context(), actorID, leadID, CreateInput{
		Channel: channel,
		Summary: body.Summary,
		Outcome: body.Outcome,
	})
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	response.Created(w, view)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	leadID := chi.URLParam(r, "leadID")
	items, err := h.service.ListByLead(r.Context(), leadID)
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	response.OK(w, items)
}

func (h *Handler) PipelineHistory(w http.ResponseWriter, r *http.Request) {
	leadID := chi.URLParam(r, "leadID")
	items, err := h.service.ListPipelineHistory(r.Context(), leadID)
	if err != nil {
		h.handleError(w, r, err)
		return
	}

	response.OK(w, items)
}

func (h *Handler) handleError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrLeadNotFound):
		response.Fail(w, http.StatusNotFound, "LEAD_NOT_FOUND", "Lead not found")
	case errors.Is(err, ErrSummaryRequired):
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "summary is required")
	case errors.Is(err, ErrInvalidChannel):
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid interaction channel")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
