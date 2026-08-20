package storage

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/config"
)

func TestMockStorage(t *testing.T) {
	s := NewMockStorage()
	if s.IsConfigured() {
		t.Fatal("expected mock storage not to be configured")
	}

	content := []byte("%PDF-1.4 test certificate content")
	url, err := s.UploadDiplomaPDF(context.Background(), "cert-123", "diploma.pdf", bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("unexpected upload error: %v", err)
	}
	if !strings.Contains(url, "diplomas/cert-123.pdf") {
		t.Fatalf("expected diploma url, got %s", url)
	}

	if err := s.DeleteDiplomaPDF(context.Background(), url); err != nil {
		t.Fatalf("unexpected delete error: %v", err)
	}
}

func TestNewStorageFallback(t *testing.T) {
	cfg := &config.Config{}
	s := NewStorage(cfg)
	if s == nil {
		t.Fatal("expected storage instance")
	}
	if s.IsConfigured() {
		t.Fatal("expected unconfigured storage when credentials missing")
	}
}
