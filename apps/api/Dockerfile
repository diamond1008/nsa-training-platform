# ==========================================================================
# NSA Training Platform — API image
# Build from the REPOSITORY ROOT:
#   docker build -f apps/api/Dockerfile -t nsa-api .
# ==========================================================================

# ---------- Build stage ----------
FROM golang:1.26-alpine AS build
WORKDIR /src

# Download dependencies first for better layer caching.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

# Build the static binary.
COPY apps/api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# ---------- Runtime stage ----------
FROM alpine:3.21
RUN adduser -D -u 10001 appuser && apk add --no-cache ca-certificates tzdata

COPY --from=build /out/api /usr/local/bin/api
# OpenAPI contract served at /openapi.yaml (OPENAPI_PATH overrides).
COPY docs/openapi.yaml /app/docs/openapi.yaml

ENV APP_ENV=production \
    LOG_LEVEL=info \
    API_PORT=8080 \
    OPENAPI_PATH=/app/docs/openapi.yaml

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/api"]