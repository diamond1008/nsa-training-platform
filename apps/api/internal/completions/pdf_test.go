package completions

import (
	"bytes"
	"testing"
)

func TestCertificatePDF(t *testing.T) {
	payload, err := CertificatePDF(CertificateView{
		CertificateNumber: "CC00000001",
		VerificationCode:  "11111111-1111-1111-1111-111111111111",
		StudentCode:       "HV00000001",
		StudentName:       "Nguyễn Văn An",
		ClassCode:         "KT01",
		CourseCode:        "KT-CNC",
		CourseName:        "Kỹ thuật CNC",
		IssuedAt:          "2026-07-29T00:00:00Z",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(payload) < 1000 || !bytes.HasPrefix(payload, []byte("%PDF")) {
		t.Fatalf("expected a non-empty PDF, got %d bytes", len(payload))
	}
}
