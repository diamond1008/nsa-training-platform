package config

import (
	"strings"
	"testing"
)

// clearEnv unsets every variable Load() reads so tests are hermetic.
func clearEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"APP_ENV", "API_PORT", "DATABASE_URL", "LOG_LEVEL",
		"CORS_ALLOWED_ORIGINS", "SHUTDOWN_TIMEOUT_SECONDS", "OPENAPI_PATH",
		"JWT_ACCESS_SECRET", "ACCESS_TOKEN_TTL_MINUTES", "REFRESH_TOKEN_TTL_DAYS", "BCRYPT_COST",
	} {
		t.Setenv(k, "")
	}
}

// setRequiredEnv sets the minimum variables for a successful Load().
func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://x:x@localhost:5432/x")
	t.Setenv("JWT_ACCESS_SECRET", "test-secret-that-is-long-enough-32+")
}

func TestLoad_RequiresDatabaseURL(t *testing.T) {
	clearEnv(t)
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DATABASE_URL") {
		t.Fatalf("expected DATABASE_URL error, got %v", err)
	}
}

func TestLoad_RequiresJWTSecret(t *testing.T) {
	clearEnv(t)
	t.Setenv("DATABASE_URL", "postgres://x:x@localhost:5432/x")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "JWT_ACCESS_SECRET") {
		t.Fatalf("expected JWT_ACCESS_SECRET error, got %v", err)
	}
}

func TestLoad_RejectsShortJWTSecret(t *testing.T) {
	clearEnv(t)
	t.Setenv("DATABASE_URL", "postgres://x:x@localhost:5432/x")
	t.Setenv("JWT_ACCESS_SECRET", "too-short")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "JWT_ACCESS_SECRET") {
		t.Fatalf("expected JWT_ACCESS_SECRET length error, got %v", err)
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearEnv(t)
	setRequiredEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Env != "development" {
		t.Errorf("Env = %q, want development", cfg.Env)
	}
	if cfg.HTTPPort != 8080 {
		t.Errorf("HTTPPort = %d, want 8080", cfg.HTTPPort)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want info", cfg.LogLevel)
	}
	if cfg.ShutdownTimeout.Seconds() != 10 {
		t.Errorf("ShutdownTimeout = %v, want 10s", cfg.ShutdownTimeout)
	}
	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:5173" {
		t.Errorf("CORSAllowedOrigins = %v", cfg.CORSAllowedOrigins)
	}
	if cfg.AccessTokenTTL.Minutes() != 15 {
		t.Errorf("AccessTokenTTL = %v, want 15m", cfg.AccessTokenTTL)
	}
	if cfg.RefreshTokenTTLDays != 30 {
		t.Errorf("RefreshTokenTTLDays = %d, want 30", cfg.RefreshTokenTTLDays)
	}
	if cfg.BcryptCost != 10 {
		t.Errorf("BcryptCost = %d, want 10", cfg.BcryptCost)
	}
}

func TestLoad_RejectsInvalidEnv(t *testing.T) {
	clearEnv(t)
	setRequiredEnv(t)
	t.Setenv("APP_ENV", "mars")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("expected APP_ENV error, got %v", err)
	}
}

func TestLoad_ParsesOverrides(t *testing.T) {
	clearEnv(t)
	setRequiredEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("API_PORT", "9090")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://a.example, https://b.example")
	t.Setenv("ACCESS_TOKEN_TTL_MINUTES", "30")
	t.Setenv("BCRYPT_COST", "12")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Env != "production" || cfg.HTTPPort != 9090 {
		t.Errorf("cfg = %+v", cfg)
	}
	if len(cfg.CORSAllowedOrigins) != 2 {
		t.Errorf("CORSAllowedOrigins = %v", cfg.CORSAllowedOrigins)
	}
	if cfg.AccessTokenTTL.Minutes() != 30 {
		t.Errorf("AccessTokenTTL = %v, want 30m", cfg.AccessTokenTTL)
	}
	if cfg.BcryptCost != 12 {
		t.Errorf("BcryptCost = %d, want 12", cfg.BcryptCost)
	}
}

func TestLoad_RejectsProductionPlaceholders(t *testing.T) {
	clearEnv(t)
	setRequiredEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://training.example.com")
	t.Setenv("JWT_ACCESS_SECRET", "change-me-access-secret-min-32-chars")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "placeholder") {
		t.Fatalf("expected production placeholder error, got %v", err)
	}
}

func TestLoad_RejectsInsecureProductionCORS(t *testing.T) {
	clearEnv(t)
	setRequiredEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://training.example.com")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "HTTPS") {
		t.Fatalf("expected production CORS error, got %v", err)
	}
}
