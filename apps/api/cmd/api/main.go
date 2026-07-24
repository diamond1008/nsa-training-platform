// Command api runs the NSA Training Platform HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/config"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/database"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/docs"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/health"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/logging"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/middleware"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "api:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log := logging.New(cfg.Env, cfg.LogLevel)
	slog.SetDefault(log)

	// Cancel on SIGINT/SIGTERM for graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	pool, err := database.Connect(connectCtx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer pool.Close()
	log.Info("connected to database")

	healthHandler := health.NewHandler(pool)
	docsHandler := docs.NewHandler(cfg.OpenAPIPath)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.RequestLog(log))
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Operational endpoints (unversioned by design).
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// API documentation (Swagger UI + the OpenAPI contract).
	r.Get("/docs", docsHandler.SwaggerUI)
	r.Get("/openapi.yaml", docsHandler.OpenAPISpec)

	// Business API mounts here from Phase 3+: r.Route("/api/v1", ...)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("api listening",
			"addr", srv.Addr,
			"env", cfg.Env,
			"docs_url", fmt.Sprintf("http://localhost:%d/docs", cfg.HTTPPort),
		)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		log.Info("shutdown signal received")
	case listenErr := <-errCh:
		if !errors.Is(listenErr, http.ErrServerClosed) {
			return fmt.Errorf("listen: %w", listenErr)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	log.Info("server stopped gracefully")
	return nil
}
