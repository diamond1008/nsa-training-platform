// Package health exposes liveness (/health) and readiness (/ready) endpoints.
package health

import (
	"context"
	"net/http"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
)

// Pinger checks database connectivity. *pgxpool.Pool satisfies it.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Handler serves the health endpoints.
type Handler struct {
	db Pinger
}

// NewHandler creates a Handler. db may be nil only if Ready is never called.
func NewHandler(db Pinger) *Handler {
	return &Handler{db: db}
}

// Health returns 200 when the process is alive. No dependency checks.
func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	response.OK(w, map[string]string{"status": "ok"})
}

// Ready returns 200 only when the database is reachable, otherwise 503.
func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Ping(r.Context()); err != nil {
		response.Fail(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Database is not reachable")
		return
	}
	response.OK(w, map[string]string{"status": "ready", "database": "up"})
}
