package auth

// Integration tests for the authentication flow against a REAL PostgreSQL
// database (nsa_training_test). Skipped automatically when
// NSA_TEST_DATABASE_URL is not set (e.g. plain `go test ./...`).
//
// Setup once:  make db-test-migrate
// Run:         make api-test-integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type integrationEnv struct {
	pool    *pgxpool.Pool
	router  http.Handler
	tokens  *TokenService
	queries *db.Queries
}

// setupIntegration connects to the test DB and builds the auth route stack.
func setupIntegration(t *testing.T) *integrationEnv {
	t.Helper()
	url := os.Getenv("NSA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("NSA_TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping test db: %v", err)
	}
	t.Cleanup(pool.Close)

	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	tokens, err := NewTokenService(testSecret, 15*time.Minute)
	if err != nil {
		t.Fatalf("token service: %v", err)
	}
	queries := db.New(pool)
	svc, err := NewService(queries, tokens, 30, 10, log)
	if err != nil {
		t.Fatalf("auth service: %v", err)
	}
	handler := NewHandler(svc, log, false)

	r := chi.NewRouter()
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login", handler.Login)
		r.Post("/refresh", handler.Refresh)
		r.Post("/logout", handler.Logout)
		r.Group(func(r chi.Router) {
			r.Use(Authenticate(tokens))
			r.Post("/change-password", handler.ChangePassword)
			r.Get("/me", handler.Me)
		})
	})

	return &integrationEnv{pool: pool, router: r, tokens: tokens, queries: queries}
}

// createTestUser inserts a unique active user with the STUDENT role.
func (e *integrationEnv) createTestUser(t *testing.T, password string) (email string) {
	t.Helper()
	email = fmt.Sprintf("it-%d@test.local", time.Now().UnixNano())
	hash, err := HashPassword(password, 10)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	ctx := context.Background()
	var userID string
	err = e.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, status, must_change_password)
		 VALUES ($1, $2, 'active', FALSE) RETURNING id`, email, hash).Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	_, err = e.pool.Exec(ctx,
		`INSERT INTO user_roles (user_id, role_id)
		 SELECT $1, id FROM roles WHERE code = 'STUDENT'`, userID)
	if err != nil {
		t.Fatalf("assign role: %v", err)
	}
	return email
}

func postJSON(t *testing.T, router http.Handler, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func refreshCookieFrom(rec *httptest.ResponseRecorder, t *testing.T) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == refreshCookieName {
			return c
		}
	}
	t.Fatal("refresh cookie not set")
	return nil
}

func decodeData(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var env response.Success
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode success envelope: %v (body=%s)", err, rec.Body.String())
	}
	data, ok := env.Data.(map[string]any)
	if !ok {
		t.Fatalf("data is not an object: %s", rec.Body.String())
	}
	return data
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var env response.Error
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode error envelope: %v (body=%s)", err, rec.Body.String())
	}
	return env.Error.Code
}

// ---------- Tests ----------

func TestIntegration_LoginSuccess(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "Passw0rd!123")

	rec := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "Passw0rd!123",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	data := decodeData(t, rec)
	if data["access_token"] == "" || data["token_type"] != "Bearer" {
		t.Errorf("missing access token: %v", data)
	}
	cookie := refreshCookieFrom(rec, t)
	if !cookie.HttpOnly {
		t.Error("refresh cookie must be HttpOnly")
	}
	user := data["user"].(map[string]any)
	if user["email"] != email {
		t.Errorf("user email = %v", user["email"])
	}
	roles := user["roles"].([]any)
	if len(roles) != 1 || roles[0] != "STUDENT" {
		t.Errorf("roles = %v", roles)
	}
}

func TestIntegration_LoginGenericErrorNoEnumeration(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "Passw0rd!123")

	wrongPass := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "wrong",
	})
	unknownEmail := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": "nobody@test.local", "password": "whatever",
	})

	for name, rec := range map[string]*httptest.ResponseRecorder{"wrong password": wrongPass, "unknown email": unknownEmail} {
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", name, rec.Code)
		}
		if code := errorCode(t, rec); code != "INVALID_CREDENTIALS" {
			t.Errorf("%s: code = %s, want INVALID_CREDENTIALS (generic, no enumeration)", name, code)
		}
	}
}

func TestIntegration_RefreshRotationAndReuseDetection(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "Passw0rd!123")

	login := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "Passw0rd!123",
	})
	oldCookie := refreshCookieFrom(login, t)

	// Rotate once: old -> new.
	refreshed := postJSON(t, env.router, "/api/v1/auth/refresh", nil, oldCookie)
	if refreshed.Code != http.StatusOK {
		t.Fatalf("refresh status = %d, body = %s", refreshed.Code, refreshed.Body.String())
	}
	newCookie := refreshCookieFrom(refreshed, t)
	if newCookie.Value == oldCookie.Value {
		t.Fatal("refresh token must rotate (new value)")
	}

	// Reuse the OLD token: rejected AND the whole family is revoked.
	reuse := postJSON(t, env.router, "/api/v1/auth/refresh", nil, oldCookie)
	if reuse.Code != http.StatusUnauthorized {
		t.Fatalf("reuse status = %d, want 401", reuse.Code)
	}
	if code := errorCode(t, reuse); code != "INVALID_REFRESH_TOKEN" {
		t.Errorf("reuse code = %s", code)
	}

	// The rotated token is also dead now (family revocation).
	afterReuse := postJSON(t, env.router, "/api/v1/auth/refresh", nil, newCookie)
	if afterReuse.Code != http.StatusUnauthorized {
		t.Fatalf("after reuse, rotated token status = %d, want 401 (family revoked)", afterReuse.Code)
	}
}

func TestIntegration_LogoutRevokesToken(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "Passw0rd!123")

	login := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "Passw0rd!123",
	})
	cookie := refreshCookieFrom(login, t)

	logout := postJSON(t, env.router, "/api/v1/auth/logout", nil, cookie)
	if logout.Code != http.StatusOK {
		t.Fatalf("logout status = %d", logout.Code)
	}

	refreshed := postJSON(t, env.router, "/api/v1/auth/refresh", nil, cookie)
	if refreshed.Code != http.StatusUnauthorized {
		t.Fatalf("refresh after logout = %d, want 401", refreshed.Code)
	}
}

func TestIntegration_ChangePasswordFlow(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "OldPassw0rd!")

	login := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "OldPassw0rd!",
	})
	data := decodeData(t, login)
	accessToken := data["access_token"].(string)
	cookie := refreshCookieFrom(login, t)

	// Wrong current password -> 400 WRONG_CURRENT_PASSWORD.
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password",
		bytes.NewReader([]byte(`{"current_password":"nope","new_password":"NewPassw0rd!"}`)))
	badReq.Header.Set("Content-Type", "application/json")
	badReq.Header.Set("Authorization", "Bearer "+accessToken)
	badRec := httptest.NewRecorder()
	env.router.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest || errorCode(t, badRec) != "WRONG_CURRENT_PASSWORD" {
		t.Errorf("wrong current: %d %s", badRec.Code, badRec.Body.String())
	}

	// Weak new password -> 400 WEAK_PASSWORD.
	weakReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password",
		bytes.NewReader([]byte(`{"current_password":"OldPassw0rd!","new_password":"short"}`)))
	weakReq.Header.Set("Content-Type", "application/json")
	weakReq.Header.Set("Authorization", "Bearer "+accessToken)
	weakRec := httptest.NewRecorder()
	env.router.ServeHTTP(weakRec, weakReq)
	if weakRec.Code != http.StatusBadRequest || errorCode(t, weakRec) != "WEAK_PASSWORD" {
		t.Errorf("weak new: %d %s", weakRec.Code, weakRec.Body.String())
	}

	// Correct change -> 200, then old refresh token is revoked.
	okReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/change-password",
		bytes.NewReader([]byte(`{"current_password":"OldPassw0rd!","new_password":"NewPassw0rd!"}`)))
	okReq.Header.Set("Content-Type", "application/json")
	okReq.Header.Set("Authorization", "Bearer "+accessToken)
	okRec := httptest.NewRecorder()
	env.router.ServeHTTP(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("change-password status = %d, body = %s", okRec.Code, okRec.Body.String())
	}

	refreshed := postJSON(t, env.router, "/api/v1/auth/refresh", nil, cookie)
	if refreshed.Code != http.StatusUnauthorized {
		t.Errorf("refresh after password change = %d, want 401 (all sessions revoked)", refreshed.Code)
	}

	// Login with the NEW password works.
	relogin := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "NewPassw0rd!",
	})
	if relogin.Code != http.StatusOK {
		t.Errorf("login with new password = %d, want 200", relogin.Code)
	}
}

func TestIntegration_Me(t *testing.T) {
	env := setupIntegration(t)
	email := env.createTestUser(t, "Passw0rd!123")

	login := postJSON(t, env.router, "/api/v1/auth/login", map[string]string{
		"email": email, "password": "Passw0rd!123",
	})
	data := decodeData(t, login)
	accessToken := data["access_token"].(string)

	// With token -> 200 with the same email.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	rec := httptest.NewRecorder()
	env.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("me status = %d", rec.Code)
	}
	me := decodeData(t, rec)
	if me["email"] != email {
		t.Errorf("me email = %v, want %s", me["email"], email)
	}

	// Without token -> 401.
	rec2 := httptest.NewRecorder()
	env.router.ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil))
	if rec2.Code != http.StatusUnauthorized {
		t.Errorf("me without token = %d, want 401", rec2.Code)
	}
}
