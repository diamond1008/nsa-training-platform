package auth

import "testing"

func TestGenerateRefreshToken_RandomAndURLEncoded(t *testing.T) {
	t1, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	t2, _ := GenerateRefreshToken()

	// 32 bytes base64url (no padding) = 43 chars.
	if len(t1) != 43 {
		t.Errorf("token length = %d, want 43", len(t1))
	}
	if t1 == t2 {
		t.Error("two generated tokens must never be equal")
	}
}

func TestHashRefreshToken_DeterministicSHA256Hex(t *testing.T) {
	h1 := HashRefreshToken("some-token")
	h2 := HashRefreshToken("some-token")
	if h1 != h2 {
		t.Error("hash must be deterministic for the same input")
	}
	if len(h1) != 64 { // SHA-256 hex
		t.Errorf("hash length = %d, want 64", len(h1))
	}
	if HashRefreshToken("other-token") == h1 {
		t.Error("different tokens must hash differently")
	}
}
