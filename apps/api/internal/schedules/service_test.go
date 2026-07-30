package schedules

import (
	"testing"
	"time"
)

func TestValidTrainingSlot(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		start string
		end   string
		valid bool
	}{
		{name: "morning", start: "2026-08-03T08:00:00+07:00", end: "2026-08-03T12:00:00+07:00", valid: true},
		{name: "afternoon", start: "2026-08-03T13:30:00+07:00", end: "2026-08-03T17:30:00+07:00", valid: true},
		{name: "evening", start: "2026-08-03T18:30:00+07:00", end: "2026-08-03T21:30:00+07:00", valid: true},
		{name: "equivalent UTC", start: "2026-08-03T01:00:00Z", end: "2026-08-03T05:00:00Z", valid: true},
		{name: "wrong start minute", start: "2026-08-03T08:15:00+07:00", end: "2026-08-03T12:00:00+07:00", valid: false},
		{name: "wrong end", start: "2026-08-03T08:00:00+07:00", end: "2026-08-03T11:30:00+07:00", valid: false},
		{name: "mixed slots", start: "2026-08-03T08:00:00+07:00", end: "2026-08-03T17:30:00+07:00", valid: false},
		{name: "cross day", start: "2026-08-03T18:30:00+07:00", end: "2026-08-04T21:30:00+07:00", valid: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			start, err := time.Parse(time.RFC3339, test.start)
			if err != nil {
				t.Fatalf("parse start: %v", err)
			}
			end, err := time.Parse(time.RFC3339, test.end)
			if err != nil {
				t.Fatalf("parse end: %v", err)
			}
			if got := validTrainingSlot(start, end); got != test.valid {
				t.Fatalf("validTrainingSlot() = %v, want %v", got, test.valid)
			}
		})
	}
}
