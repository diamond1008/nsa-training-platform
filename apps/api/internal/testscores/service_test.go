package testscores

import (
	"testing"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

func TestPassingRules(t *testing.T) {
	tests := []struct {
		name  string
		kind  db.CourseTestKind
		score float64
		pass  float64
		want  bool
	}{
		{name: "class test accepts threshold", kind: db.CourseTestKindClassTest, score: 5, pass: 5, want: true},
		{name: "class test rejects below threshold", kind: db.CourseTestKindClassTest, score: 4.99, pass: 5, want: false},
		{name: "final rejects exactly five", kind: db.CourseTestKindFinalExam, score: 5, pass: 5, want: false},
		{name: "final accepts above five", kind: db.CourseTestKindFinalExam, score: 5.01, pass: 5, want: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isPassed(test.kind, test.score, test.pass); got != test.want {
				t.Fatalf("isPassed() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestValidateFinalExamRule(t *testing.T) {
	valid := TestInput{Kind: db.CourseTestKindFinalExam, PassScore: 5, IsRequired: true}
	if err := validateTestInput(valid); err != nil {
		t.Fatalf("valid final exam returned %v", err)
	}
	for _, input := range []TestInput{
		{Kind: db.CourseTestKindFinalExam, PassScore: 5, IsRequired: false},
		{Kind: db.CourseTestKindFinalExam, PassScore: 5.01, IsRequired: true},
	} {
		if err := validateTestInput(input); err != ErrInvalidFinalRule {
			t.Fatalf("invalid final exam returned %v", err)
		}
	}
}
