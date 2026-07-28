// Package data converts between public API values and pgx database values.
package data

import (
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// UUID parses a canonical UUID string for pgx.
func UUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, fmt.Errorf("invalid UUID: %w", err)
	}
	return id, nil
}

// UUIDString formats a valid pgx UUID.
func UUIDString(value pgtype.UUID) string {
	if !value.Valid {
		return ""
	}
	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		value.Bytes[0:4],
		value.Bytes[4:6],
		value.Bytes[6:8],
		value.Bytes[8:10],
		value.Bytes[10:16],
	)
}

// UUIDPointer converts a nullable pgx UUID into a JSON-friendly pointer.
func UUIDPointer(value pgtype.UUID) *string {
	if !value.Valid {
		return nil
	}
	formatted := UUIDString(value)
	return &formatted
}

// Text converts a nullable input string into pgtype.Text.
func Text(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

// TextPointer converts pgtype.Text to a JSON-friendly pointer.
func TextPointer(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

// Date parses a nullable YYYY-MM-DD value.
func Date(value *string) (pgtype.Date, error) {
	if value == nil || *value == "" {
		return pgtype.Date{}, nil
	}
	parsed, err := time.Parse("2006-01-02", *value)
	if err != nil {
		return pgtype.Date{}, fmt.Errorf("date must use YYYY-MM-DD")
	}
	return pgtype.Date{Time: parsed, Valid: true}, nil
}

// RequiredDate parses a required YYYY-MM-DD value.
func RequiredDate(value string) (pgtype.Date, error) {
	return Date(&value)
}

// DateString converts a nullable pgx date into a JSON-friendly pointer.
func DateString(value pgtype.Date) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.Format("2006-01-02")
	return &formatted
}

// Numeric stores a decimal value without binary floating point in SQL.
func Numeric(value float64) (pgtype.Numeric, error) {
	var numeric pgtype.Numeric
	if err := numeric.Scan(fmt.Sprintf("%.2f", value)); err != nil {
		return pgtype.Numeric{}, err
	}
	return numeric, nil
}

// NumericFloat converts a PostgreSQL numeric into a float64 response value.
func NumericFloat(value pgtype.Numeric) float64 {
	converted, err := value.Float64Value()
	if err != nil || !converted.Valid {
		return 0
	}
	return converted.Float64
}

// TimeString formats a nullable UTC timestamp.
func TimeString(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.UTC().Format(time.RFC3339Nano)
	return &formatted
}
