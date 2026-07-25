package auth

import "testing"

func TestHashPassword_RoundTrip(t *testing.T) {
	hash, err := HashPassword("S3cure!pass", 10)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if hash == "S3cure!pass" {
		t.Fatal("hash must never equal the plaintext password")
	}
	if !CheckPassword(hash, "S3cure!pass") {
		t.Error("correct password should verify")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Error("wrong password must not verify")
	}
	if CheckPassword(hash, "") {
		t.Error("empty password must not verify")
	}
}

func TestHashPassword_UniqueSalts(t *testing.T) {
	h1, _ := HashPassword("same-password", 10)
	h2, _ := HashPassword("same-password", 10)
	if h1 == h2 {
		t.Error("two hashes of the same password must differ (random salt)")
	}
}
