package attendance

import (
	"testing"
	"time"
)

func TestVietnamStartOfDay(t *testing.T) {
	input := time.Date(2026, time.July, 28, 16, 59, 59, 0, time.UTC)
	want := time.Date(2026, time.July, 27, 17, 0, 0, 0, time.UTC)
	if got := vietnamStartOfDay(input); !got.Equal(want) {
		t.Fatalf("vietnamStartOfDay() = %s, want %s", got, want)
	}

	input = time.Date(2026, time.July, 28, 17, 0, 0, 0, time.UTC)
	want = time.Date(2026, time.July, 28, 17, 0, 0, 0, time.UTC)
	if got := vietnamStartOfDay(input); !got.Equal(want) {
		t.Fatalf("next Vietnam day start = %s, want %s", got, want)
	}
}
