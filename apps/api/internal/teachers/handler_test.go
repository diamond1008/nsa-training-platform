package teachers

import (
	"strings"
	"testing"
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
