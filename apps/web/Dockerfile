# ==========================================================================
# NSA Training Platform — Web (SPA) image
# Build from the REPOSITORY ROOT:
#   docker build -f apps/web/Dockerfile -t nsa-web .
# ==========================================================================

# ---------- Build stage ----------
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first for layer caching.
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the production bundle.
# VITE_API_BASE_URL is baked in at build time (override with --build-arg).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/web/ ./
RUN npm run build

# ---------- Runtime stage ----------
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Caddy runs in the foreground by default via its base image entrypoint.