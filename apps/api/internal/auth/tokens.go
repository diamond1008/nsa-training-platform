package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessClaims carries the authenticated identity inside access tokens.
type AccessClaims struct {
	UserID string   `json:"sub"`
	Email  string   `json:"email"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}

// TokenService issues and validates short-lived JWT access tokens (HS256).
type TokenService struct {
	secret []byte
	ttl    time.Duration
	issuer string
}

// NewTokenService requires a secret of at least 32 bytes.
func NewTokenService(secret string, ttl time.Duration) (*TokenService, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("JWT access secret must be at least 32 bytes (got %d)", len(secret))
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("access token TTL must be positive")
	}
	return &TokenService{secret: []byte(secret), ttl: ttl, issuer: "nsa-training-platform"}, nil
}

// Issue creates a signed access token for the given identity.
func (s *TokenService) Issue(userID, email string, roles []string) (string, time.Time, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(s.ttl)
	claims := AccessClaims{
		UserID: userID,
		Email:  email,
		Roles:  roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    s.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}
	return token, expiresAt, nil
}

// Parse validates signature, expiry, and issuer, returning the claims.
func (s *TokenService) Parse(tokenString string) (*AccessClaims, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	}, jwt.WithIssuer(s.issuer), jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("invalid access token: %w", err)
	}
	return claims, nil
}

// ErrTokenExpired re-wraps jwt expiry errors for callers that care.
var ErrTokenExpired = errors.New("access token expired")

// IsTokenExpired reports whether err was caused by token expiry.
func IsTokenExpired(err error) bool {
	return errors.Is(err, jwt.ErrTokenExpired)
}
