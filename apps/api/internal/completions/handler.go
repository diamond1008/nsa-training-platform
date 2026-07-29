package completions

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/auth"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/request"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, log *slog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

type decisionRequest struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

type certificateActionRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, perPage, err := request.Page(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}
	result, err := h.service.List(r.Context(), strings.TrimSpace(r.URL.Query().Get("search")), page, perPage)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) Decide(w http.ResponseWriter, r *http.Request) {
	var body decisionRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	body.Status = strings.TrimSpace(body.Status)
	body.Note = strings.TrimSpace(body.Note)
	if body.Status != "approved" && body.Status != "rejected" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "status must be approved or rejected")
		return
	}
	if body.Note == "" || len([]rune(body.Note)) > 1000 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "note is required and must not exceed 1000 characters")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	result, err := h.service.Decide(r.Context(), actorID, chi.URLParam(r, "classID"), chi.URLParam(r, "studentID"), body.Status, body.Note)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, result)
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.History(r.Context(), chi.URLParam(r, "classID"), chi.URLParam(r, "studentID"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) StudentList(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	items, err := h.service.StudentCertificates(r.Context(), userID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, items)
}

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Verify(r.Context(), chi.URLParam(r, "verificationCode"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) StudentPDF(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.StudentCertificate(r.Context(), userID, chi.URLParam(r, "certificateID"))
	h.writePDF(w, r, view, err)
}

func (h *Handler) AdminPDF(w http.ResponseWriter, r *http.Request) {
	view, err := h.service.Certificate(r.Context(), chi.URLParam(r, "certificateID"))
	h.writePDF(w, r, view, err)
}

func (h *Handler) writePDF(w http.ResponseWriter, r *http.Request, view CertificateView, err error) {
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if !view.IsCurrent || view.RevokedAt != nil {
		h.writeError(w, r, ErrCertificateRevoked)
		return
	}
	payload, err := CertificatePDF(view)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.pdf"`, view.CertificateNumber))
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func (h *Handler) Revoke(w http.ResponseWriter, r *http.Request)  { h.certificateAction(w, r, false) }
func (h *Handler) Reissue(w http.ResponseWriter, r *http.Request) { h.certificateAction(w, r, true) }

func (h *Handler) certificateAction(w http.ResponseWriter, r *http.Request, reissue bool) {
	var body certificateActionRequest
	if err := request.DecodeJSON(w, r, &body); err != nil {
		response.Fail(w, http.StatusBadRequest, "INVALID_JSON", "Request body must be valid JSON")
		return
	}
	body.Reason = strings.TrimSpace(body.Reason)
	if body.Reason == "" || len([]rune(body.Reason)) > 1000 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "reason is required and must not exceed 1000 characters")
		return
	}
	actorID, _ := auth.UserIDFrom(r.Context())
	view, err := h.service.RevokeOrReissue(r.Context(), actorID, chi.URLParam(r, "certificateID"), body.Reason, reissue)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	response.OK(w, view)
}

func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.Fail(w, http.StatusNotFound, "COMPLETION_NOT_FOUND", "Completion candidate not found")
	case errors.Is(err, ErrNotEligible):
		response.Fail(w, http.StatusConflict, "COMPLETION_NOT_ELIGIBLE", "Completion requirements are not met")
	case errors.Is(err, ErrCertificateNotFound):
		response.Fail(w, http.StatusNotFound, "CERTIFICATE_NOT_FOUND", "Certificate not found")
	case errors.Is(err, ErrCertificateRevoked):
		response.Fail(w, http.StatusConflict, "CERTIFICATE_REVOKED", "Certificate has been revoked")
	default:
		response.InternalError(w, h.log, auth.RequestIDFrom(r.Context()), err)
	}
}
