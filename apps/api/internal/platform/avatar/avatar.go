// Package avatar validates and redacts inline profile images shared by people modules.
package avatar

import (
	"encoding/base64"
	"strings"
)

const (
	MaxDecodedBytes = 256 << 10
	DataURLPrefix   = "data:image/webp;base64,"
	RedactedValue   = "[stored WebP image]"
)

// NormalizeWebPDataURL trims an optional image and accepts only small, signed WebP data URLs.
func NormalizeWebPDataURL(value *string) (*string, bool) {
	if value == nil {
		return nil, true
	}
	normalized := strings.TrimSpace(*value)
	if normalized == "" {
		return nil, true
	}
	if !strings.HasPrefix(normalized, DataURLPrefix) {
		return nil, false
	}
	encoded := strings.TrimPrefix(normalized, DataURLPrefix)
	if encoded == "" || base64.StdEncoding.DecodedLen(len(encoded)) > MaxDecodedBytes {
		return nil, false
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) < 12 || len(decoded) > MaxDecodedBytes {
		return nil, false
	}
	if string(decoded[:4]) != "RIFF" || string(decoded[8:12]) != "WEBP" {
		return nil, false
	}
	return &normalized, true
}

// Redact replaces a stored image payload before a profile is written to an audit log.
func Redact(value *string) *string {
	if value == nil {
		return nil
	}
	redacted := RedactedValue
	return &redacted
}
