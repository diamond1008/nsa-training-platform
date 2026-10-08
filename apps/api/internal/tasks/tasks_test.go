package tasks

import (
	"testing"
	"time"
)

func TestValidateTaskCreate(t *testing.T) {
	input := CreateInput{
		LeadID:     "lead-1",
		AssignedTo: "user-1",
		Title:      "Gọi lại khách hàng",
		DueAt:      time.Now().Add(24 * time.Hour),
	}

	if input.Title == "" {
		t.Error("title should not be empty")
	}
	if input.DueAt.IsZero() {
		t.Error("due_at should not be zero")
	}
}
