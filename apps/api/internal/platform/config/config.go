// Package config loads application configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the API.
type Config struct {
	// Env is one of: development, staging, production.
	Env string
	// HTTPPort the API listens on.
	HTTPPort int
	// DatabaseURL is the PostgreSQL connection string (required).
	DatabaseURL string
	// LogLevel: debug, info, warn, error.
	LogLevel string
	// CORSAllowedOrigins for the browser SPA.
	CORSAllowedOrigins []string
	// ShutdownTimeout bounds graceful HTTP shutdown.
	ShutdownTimeout time.Duration
	// OpenAPIPath points to docs/openapi.yaml served at /openapi.yaml.
	OpenAPIPath string
}

// Load reads configuration from environment variables.
// A local .env file is loaded when present (development convenience);
// real environment variables always take precedence over file values.
func Load() (*Config, error) {
	_ = godotenv.Load() // .env is optional; a missing file is not an error

	cfg := &Config{
		Env:                getEnv("APP_ENV", "development"),
		HTTPPort:           getEnvInt("API_PORT", 8080),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		LogLevel:           strings.ToLower(getEnv("LOG_LEVEL", "info")),
		CORSAllowedOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"}),
		ShutdownTimeout:    time.Duration(getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 10)) * time.Second,
		OpenAPIPath:        getEnv("OPENAPI_PATH", "../../docs/openapi.yaml"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	switch cfg.Env {
	case "development", "staging", "production":
	default:
		return nil, fmt.Errorf("APP_ENV must be development, staging, or production (got %q)", cfg.Env)
	}
	if cfg.HTTPPort <= 0 || cfg.HTTPPort > 65535 {
		return nil, fmt.Errorf("API_PORT must be between 1 and 65535 (got %d)", cfg.HTTPPort)
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvList(key string, fallback []string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}
