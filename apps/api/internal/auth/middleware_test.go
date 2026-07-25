package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// contextWithClaims injects claims into a context for middleware tests.
func contextWithClaims(ctx context.Context, claims *AccessClaims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// okHandler records whether it was reached and echoes the claims user id.
func okHandler(reached *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*reached = true
		w.WriteHeader(http.StatusOK)
	})
}

func TestAuthenticate_NoHeader_Returns401(t *testing.T) {
	svc := newTestService(t, time.Minute)
	reached := false
	h := Authenticate(svc)(okHandler(&reached))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
	if reached {
		t.Error("handler must not be reached without a token")
	}
}

func TestAuthenticate_BadToken_Returns401(t *testing.T) {
	svc := newTestService(t, time.Minute)
	reached := false
	h := Authenticate(svc)(okHandler(&reached))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer garbage")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
	if reached {
		t.Error("handler must not be reached with a bad token")
	}
}

func TestAuthenticate_ValidToken_PassesClaims(t *testing.T) {
	svc := newTestService(t, time.Minute)
	token, _, _ := svc.Issue("user-1", "a@b.local", []string{"ADMIN"})

	var gotClaims *AccessClaims
	h := Authenticate(svc)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotClaims, _ = ClaimsFrom(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if gotClaims == nil || gotClaims.UserID != "user-1" {
		t.Errorf("claims not propagated: %+v", gotClaims)
	}
}

func TestRequireRole(t *testing.T) {
	newReq := func(roles []string) *http.Request {
		claims := &AccessClaims{UserID: "u1", Roles: roles}
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		return req.WithContext(contextWithClaims(req.Context(), claims))
	}

	cases := []struct {
		name     string
		roles    []string
		required []string
		want     int
	}{
		{"admin allowed", []string{"ADMIN"}, []string{"ADMIN"}, http.StatusOK},
		{"student forbidden from admin route", []string{"STUDENT"}, []string{"ADMIN"}, http.StatusForbidden},
		{"teacher in multi-role allowlist", []string{"TEACHER"}, []string{"ADMIN", "TEACHER"}, http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			reached := false
			h := RequireRole(tc.required...)(okHandler(&reached))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, newReq(tc.roles))
			if rec.Code != tc.want {
				t.Errorf("status = %d, want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestRequireRole_NoClaims_Returns401(t *testing.T) {
	reached := false
	h := RequireRole("ADMIN")(okHandler(&reached))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}
