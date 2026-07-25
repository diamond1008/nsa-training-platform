// Package dberror classifies PostgreSQL integrity failures without exposing
// internal SQL messages to API clients.
package dberror

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

// PostgreSQL SQLSTATE codes used by the API.
const (
	UniqueViolation     = "23505"
	ForeignKeyViolation = "23503"
	CheckViolation      = "23514"
	RaiseException      = "P0001"
)

// IsCode reports whether err contains the given PostgreSQL SQLSTATE.
func IsCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}

// Constraint returns the failed constraint name, if PostgreSQL supplied one.
func Constraint(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

// IsCapacityViolation identifies either class-capacity trigger.
func IsCapacityViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == RaiseException &&
		(strings.Contains(pgErr.Message, "maximum capacity") ||
			strings.Contains(pgErr.Message, "current enrollment"))
}
