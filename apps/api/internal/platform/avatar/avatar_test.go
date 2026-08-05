package avatar

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestNormalizeWebPDataURL(t *testing.T) {
	validBytes := []byte("RIFF\x04\x00\x00\x00WEBP")
	valid := DataURLPrefix + base64.StdEncoding.EncodeToString(validBytes)

	tests := []struct {
		name  string
		value *string
		want  *string
		ok    bool
	}{
		{name: "missing", value: nil, want: nil, ok: true},
		{name: "blank", value: stringPointer("  "), want: nil, ok: true},
		{name: "valid WebP", value: stringPointer("  " + valid + "  "), want: stringPointer(valid), ok: true},
		{name: "wrong media type", value: stringPointer("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), ok: false},
		{name: "malformed base64", value: stringPointer(DataURLPrefix + "not-base64"), ok: false},
		{name: "wrong file signature", value: stringPointer(DataURLPrefix + base64.StdEncoding.EncodeToString([]byte("not a webp image"))), ok: false},
		{name: "too large", value: stringPointer(DataURLPrefix + base64.StdEncoding.EncodeToString([]byte("RIFF"+strings.Repeat("x", MaxDecodedBytes)))), ok: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := NormalizeWebPDataURL(tt.value)
			if ok != tt.ok {
				t.Fatalf("NormalizeWebPDataURL() ok = %v, want %v", ok, tt.ok)
			}
			if !sameStringPointer(got, tt.want) {
				t.Fatalf("NormalizeWebPDataURL() = %v, want %v", pointerText(got), pointerText(tt.want))
			}
		})
	}
}

func TestRedact(t *testing.T) {
	if Redact(nil) != nil {
		t.Fatal("Redact(nil) must remain nil")
	}
	original := "data:image/webp;base64,secret"
	redacted := Redact(&original)
	if redacted == nil || *redacted != RedactedValue {
		t.Fatalf("Redact() = %v, want %q", pointerText(redacted), RedactedValue)
	}
	if original != "data:image/webp;base64,secret" {
		t.Fatal("Redact() mutated its input")
	}
}

func stringPointer(value string) *string { return &value }

func sameStringPointer(left, right *string) bool {
	if left == nil || right == nil {
		return left == right
	}
	return *left == *right
}

func pointerText(value *string) string {
	if value == nil {
		return "<nil>"
	}
	return *value
}
