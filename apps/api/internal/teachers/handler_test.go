package teachers

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/avatar"
)

func TestValidateWriteRejectsOversizedSpecialization(t *testing.T) {
	specialization := strings.Repeat("x", 201)
	_, message := validateWrite(writeRequest{
		Email:          "teacher@test.local",
		Password:       "Passw0rd!123",
		AccountStatus:  "active",
		TeacherCode:    "TCH-001",
		FullName:       "Test Teacher",
		Specialization: &specialization,
		Status:         "active",
	}, true)
	if message == "" {
		t.Fatal("oversized specialization must be rejected")
	}
}

func TestValidateWriteAcceptsValidTeacherAvatar(t *testing.T) {
	value := avatar.DataURLPrefix + base64.StdEncoding.EncodeToString([]byte("RIFF\x04\x00\x00\x00WEBP"))
	input, message := validateWrite(validTeacherWriteRequest(&value), true)
	if message != "" {
		t.Fatalf("valid avatar rejected: %s", message)
	}
	if input.AvatarURL == nil || *input.AvatarURL != value {
		t.Fatalf("avatar_url = %v, want normalized avatar", input.AvatarURL)
	}
}

func TestValidateWriteRejectsInvalidTeacherAvatar(t *testing.T) {
	value := "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
	_, message := validateWrite(validTeacherWriteRequest(&value), true)
	if message == "" {
		t.Fatal("non-WebP teacher avatar must be rejected")
	}
}

func TestAuditTeacherViewRedactsAvatar(t *testing.T) {
	value := "data:image/webp;base64,secret"
	view := auditTeacherView(View{AvatarURL: &value})
	if view.AvatarURL == nil || *view.AvatarURL != avatar.RedactedValue {
		t.Fatalf("audit avatar = %v, want redacted value", view.AvatarURL)
	}
	if value != "data:image/webp;base64,secret" {
		t.Fatal("audit redaction mutated the source view")
	}
}

func validTeacherWriteRequest(avatarURL *string) writeRequest {
	return writeRequest{
		Email:         "teacher@test.local",
		Password:      "Passw0rd!123",
		AccountStatus: "active",
		TeacherCode:   "TCH-001",
		FullName:      "Test Teacher",
		AvatarURL:     avatarURL,
		Status:        "active",
	}
}
