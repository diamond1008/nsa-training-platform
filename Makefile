# ==========================================================================
# NSA Training Platform — Canonical command set
# Requires: GNU Make 4.4+, Docker Desktop, Go 1.22+, Node 20+, Goose v3
# Works on Windows (cmd.exe), macOS, and Linux (sh).
# ==========================================================================

.DEFAULT_GOAL := help

# ---------- Shell / portability ----------
ifeq ($(OS),Windows_NT)
SHELL := cmd.exe
.SHELLFLAGS := /c
CP := copy
else
CP := cp
endif

# Load .env when present (never commit .env).
ifneq (,$(wildcard .env))
include .env
export
endif

# ---------- Variables ----------
GOOSE          ?= goose
MIGRATIONS_DIR ?= database/migrations
DB_URL         ?= $(DATABASE_URL)
API_DIR        := apps/api
WEB_DIR        := apps/web

.PHONY: help setup db-up db-down db-logs db-psql db-reset \
	migrate-up migrate-down migrate-status migrate-create \
	api-run api-test api-build api-vet \
	web-install web-dev web-test web-build check

# ---------- Help ----------
help: ## Show this help
	@echo NSA Training Platform - available commands
	@echo   setup            Copy .env.example to .env (first time only)
	@echo   db-up            Start PostgreSQL via Docker Compose
	@echo   db-down          Stop PostgreSQL
	@echo   db-logs          Tail PostgreSQL logs
	@echo   db-psql          Open psql shell inside the db container
	@echo   db-reset         Drop and recreate the local database (DESTRUCTIVE)
	@echo   migrate-up       Apply all pending Goose migrations
	@echo   migrate-down     Roll back the last migration
	@echo   migrate-status   Show migration status
	@echo   migrate-create   Create a new migration: make migrate-create name=add_x
	@echo   api-run          Run the Go API locally
	@echo   api-test         Run API tests
	@echo   api-build        Build the API binary
	@echo   api-vet          Run go vet
	@echo   web-install      Install web dependencies
	@echo   web-dev          Start the Vite dev server
	@echo   web-test         Run web unit tests
	@echo   web-build        Build the web app for production
	@echo   check            Run all available checks for the current phase

# ---------- First-time setup ----------
setup: ## Copy .env.example to .env if it does not exist
ifeq ($(wildcard .env),)
	$(CP) .env.example .env
	@echo Created .env - edit secrets before starting services
else
	@echo .env already exists - nothing to do
endif

# ---------- Database (Phase 1) ----------
db-up: ## Start PostgreSQL container
	docker compose up -d postgres

db-down: ## Stop all containers
	docker compose down

db-logs: ## Tail PostgreSQL logs
	docker compose logs -f postgres

db-psql: ## Open psql in the postgres container
	docker compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

db-reset: ## Remove containers AND the local data volume, then start fresh
	docker compose down -v
	docker compose up -d postgres

migrate-up: ## Apply all pending migrations
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_URL)" up

migrate-down: ## Roll back the last migration
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_URL)" down

migrate-status: ## Show migration status
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(DB_URL)" status

migrate-create: ## Create migration: make migrate-create name=add_users
	$(GOOSE) -dir $(MIGRATIONS_DIR) create $(name) sql

# ---------- API (Phase 2) ----------
api-run:
	cd $(API_DIR) && go run ./cmd/api

api-test:
	cd $(API_DIR) && go test ./...

api-build:
	cd $(API_DIR) && go build -o bin/api.exe ./cmd/api

api-vet:
	cd $(API_DIR) && go vet ./...

# ---------- Web (Phase 8) ----------
web-install:
	cd $(WEB_DIR) && npm install

web-dev:
	cd $(WEB_DIR) && npm run dev

web-test:
	cd $(WEB_DIR) && npm run test

web-build:
	cd $(WEB_DIR) && npm run build

# ---------- Quality gate ----------
check: ## Run checks available in the current phase
	@echo Running checks...
ifeq ($(wildcard $(API_DIR)/go.mod),)
	@echo API not initialized yet - skipped
else
	cd $(API_DIR) && go vet ./... && go test ./...
endif
ifeq ($(wildcard $(WEB_DIR)/package.json),)
	@echo Web app not initialized yet - skipped
else
	cd $(WEB_DIR) && npm run test -- --run && npm run build
endif
	@echo Checks finished.