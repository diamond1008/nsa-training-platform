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

	// JWTAccessSecret signs access tokens (required, min 32 bytes).
	JWTAccessSecret string
	// AccessTokenTTL is the access token lifetime.
	AccessTokenTTL time.Duration
	// RefreshTokenTTLDays is the refresh token lifetime in days.
	RefreshTokenTTLDays int
	// BcryptCost is the bcrypt work factor for password hashing.
	BcryptCost int
}

// Load reads configuration from environment variables.
// A local .env file is loaded when present (development convenience);
// real environment variables always take precedence over file values.
func Load() (*Config, error) {
	_ = godotenv.Load() // .env is optional; a missing file is not an error

	cfg := &Config{
		Env:                getEnv("APP_ENV", "development"),
		HTTPPort:           getEnvInt("API_PORT", getEnvInt("PORT", 8080)),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		LogLevel:           strings.ToLower(getEnv("LOG_LEVEL", "info")),
		CORSAllowedOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"}),
		ShutdownTimeout:    time.Duration(getEnvInt("SHUTDOWN_TIMEOUT_SECONDS", 10)) * time.Second,
		OpenAPIPath:        getEnv("OPENAPI_PATH", "/app/docs/openapi.yaml"),

		JWTAccessSecret:     strings.TrimSpace(os.Getenv("JWT_ACCESS_SECRET")),
		AccessTokenTTL:      time.Duration(getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTokenTTLDays: getEnvInt("REFRESH_TOKEN_TTL_DAYS", 30),
		BcryptCost:          getEnvInt("BCRYPT_COST", 10),
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
	if len(cfg.JWTAccessSecret) < 32 {
		return nil, fmt.Errorf("JWT_ACCESS_SECRET is required and must be at least 32 characters")
	}
	if cfg.Env == "production" {
		secret := strings.ToLower(cfg.JWTAccessSecret)
		if strings.Contains(secret, "change-me") || strings.Contains(secret, "replace-with") {
			return nil, fmt.Errorf("JWT_ACCESS_SECRET must not use a placeholder in production")
		}
		for _, origin := range cfg.CORSAllowedOrigins {
			if origin == "*" || strings.HasPrefix(origin, "http://") {
				return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS must contain only explicit HTTPS origins in production")
			}
		}
	}
	if cfg.RefreshTokenTTLDays <= 0 {
		return nil, fmt.Errorf("REFRESH_TOKEN_TTL_DAYS must be positive")
	}
	if cfg.BcryptCost < 10 || cfg.BcryptCost > 14 {
		return nil, fmt.Errorf("BCRYPT_COST must be between 10 and 14")
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
