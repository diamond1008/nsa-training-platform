package auth

import (
	"context"
	"net/http"
	"strings"

	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/response"
)

type contextKey string

const claimsContextKey contextKey = "auth.claims"

// Authenticate verifies the Bearer access token and stores claims in the context.
// Missing/invalid tokens get a generic 401 (no oracle about why).
func Authenticate(tokens *TokenService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
				return
			}
			claims, err := tokens.Parse(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid or expired access token")
				return
			}
			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole allows the request only when the claims contain at least one
// of the given role codes. Must run AFTER Authenticate.
func RequireRole(codes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFrom(r.Context())
			if !ok {
				response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
				return
			}
			if !claims.HasAnyRole(codes...) {
				response.Fail(w, http.StatusForbidden, "FORBIDDEN", "You do not have access to this resource")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClaimsFrom extracts access token claims from the request context.
func ClaimsFrom(ctx context.Context) (*AccessClaims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*AccessClaims)
	return claims, ok && claims != nil
}

// UserIDFrom returns the authenticated user's UUID string from the context.
func UserIDFrom(ctx context.Context) (string, bool) {
	claims, ok := ClaimsFrom(ctx)
	if !ok {
		return "", false
	}
	return claims.UserID, true
}

// HasAnyRole reports whether the claims contain at least one given role code.
func (c *AccessClaims) HasAnyRole(codes ...string) bool {
	for _, have := range c.Roles {
		for _, want := range codes {
			if have == want {
				return true
			}
		}
	}
	return false
}

// RequestIDFrom returns the chi request id for log correlation.
func RequestIDFrom(ctx context.Context) string {
	return chimw.GetReqID(ctx)
}
