package reports

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.Summary(r.Context())
	if err != nil {
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	kind := chi.URLParam(r, "reportKind")
	payload, err := h.service.Export(r.Context(), kind)
	if err != nil {
		if kind != "attendance" && kind != "competencies" && kind != "classes" && kind != "completions" {
			response.Fail(w, http.StatusNotFound, "REPORT_NOT_FOUND", "Report not found")
			return
		}
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+kind+`-`+time.Now().Format("20060102")+`.csv"`)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}
