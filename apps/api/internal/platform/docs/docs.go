// Package docs serves the OpenAPI specification and a Swagger UI page.
package docs

import (
	"net/http"
	"os"
)

// swaggerUIHTML loads Swagger UI assets from a CDN and points them at
// /openapi.yaml. Zero build tooling required; the containerized swagger-ui
// service (make swagger) remains available as an offline alternative.
const swaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NSA Training Platform — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({ url: "/openapi.yaml", dom_id: "#swagger-ui" });
    };
  </script>
</body>
</html>`

// Handler serves API documentation endpoints.
type Handler struct {
	openAPIPath string
}

// NewHandler creates a Handler reading the OpenAPI file from openAPIPath.
func NewHandler(openAPIPath string) *Handler {
	return &Handler{openAPIPath: openAPIPath}
}

// SwaggerUI serves the Swagger UI page at GET /docs.
func (h *Handler) SwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(swaggerUIHTML))
}

// OpenAPISpec serves the OpenAPI contract at GET /openapi.yaml.
// docs/openapi.yaml is the single source of truth for the API contract.
func (h *Handler) OpenAPISpec(w http.ResponseWriter, r *http.Request) {
	if _, err := os.Stat(h.openAPIPath); err != nil {
		http.Error(w, `{"error":{"code":"OPENAPI_NOT_FOUND","message":"OpenAPI spec not found"}}`,
			http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	http.ServeFile(w, r, h.openAPIPath)
}
