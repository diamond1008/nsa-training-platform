package auth

import (
	"strings"
	"testing"
	"time"
)

const testSecret = "unit-test-secret-with-32-plus-chars!!"

func newTestService(t *testing.T, ttl time.Duration) *TokenService {
	t.Helper()
	svc, err := NewTokenService(testSecret, ttl)
	if err != nil {
		t.Fatalf("NewTokenService: %v", err)
	}
	return svc
}

func TestToken_IssueAndParseRoundTrip(t *testing.T) {
	svc := newTestService(t, 15*time.Minute)

	token, expiresAt, err := svc.Issue("user-123", "a@b.local", []string{"ADMIN", "TEACHER"})
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if token == "" || !expiresAt.After(time.Now()) {
		t.Fatalf("bad bundle: token=%q expiresAt=%v", token, expiresAt)
	}

	claims, err := svc.Parse(token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if claims.UserID != "user-123" || claims.Email != "a@b.local" {
		t.Errorf("claims = %+v", claims)
	}
	if len(claims.Roles) != 2 || claims.Roles[0] != "ADMIN" {
		t.Errorf("roles = %v", claims.Roles)
	}
}

func TestToken_RejectsWrongSecret(t *testing.T) {
	svc := newTestService(t, time.Minute)
	other := newTestService(t, time.Minute)
	other.secret = []byte("another-secret-also-32-plus-chars")

	token, _, _ := svc.Issue("u1", "a@b.local", nil)
	if _, err := other.Parse(token); err == nil {
		t.Error("token signed with a different secret must be rejected")
	}
}

func TestToken_RejectsGarbage(t *testing.T) {
	svc := newTestService(t, time.Minute)
	if _, err := svc.Parse("not-a-jwt"); err == nil {
		t.Error("garbage token must be rejected")
	}
	if _, err := svc.Parse(""); err == nil {
		t.Error("empty token must be rejected")
	}
}

func TestToken_RejectsExpired(t *testing.T) {
	// Build the service directly to allow an already-expired TTL (internal test).
	svc := &TokenService{secret: []byte(testSecret), ttl: -time.Minute, issuer: "nsa-training-platform"}
	token, _, err := svc.Issue("u1", "a@b.local", nil)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if _, err := svc.Parse(token); err == nil {
		t.Error("expired token must be rejected")
	}
}

func TestNewTokenService_Requires32ByteSecret(t *testing.T) {
	if _, err := NewTokenService("short", time.Minute); err == nil {
		t.Error("secret shorter than 32 bytes must be rejected")
	}
	if _, err := NewTokenService(strings.Repeat("x", 32), time.Minute); err != nil {
		t.Errorf("32-byte secret should be accepted: %v", err)
	}
}
