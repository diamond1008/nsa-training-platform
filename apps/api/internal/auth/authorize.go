package auth

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

// Role codes used across the API (mirror the roles table seed).
const (
	RoleAdmin   = "ADMIN"
	RoleTeacher = "TEACHER"
	RoleStudent = "STUDENT"
)

// IsSelf reports whether the authenticated user acts on their own account.
func IsSelf(claims *AccessClaims, userID string) bool {
	return claims != nil && claims.UserID == userID
}

// OwnsStudentProfile reports whether the student profile belongs to the
// authenticated user. Students may only access their own data.
func OwnsStudentProfile(ctx context.Context, q *db.Queries, claims *AccessClaims, studentProfileID pgtype.UUID) (bool, error) {
	if claims == nil {
		return false, nil
	}
	if claims.HasAnyRole(RoleAdmin) {
		return true, nil // administrators have approved management access
	}
	userID, err := parseUUID(claims.UserID)
	if err != nil {
		return false, nil
	}
	owns, err := q.CheckStudentProfileOwnership(ctx, db.CheckStudentProfileOwnershipParams{ID: studentProfileID, UserID: userID})
	if err != nil {
		return false, fmt.Errorf("check student ownership: %w", err)
	}
	return owns, nil
}

// IsAssignedTeacher reports whether the authenticated user is a teacher
// assigned to the given class. Teachers may only act on assigned classes.
func IsAssignedTeacher(ctx context.Context, q *db.Queries, claims *AccessClaims, classID pgtype.UUID) (bool, error) {
	if claims == nil {
		return false, nil
	}
	if claims.HasAnyRole(RoleAdmin) {
		return true, nil
	}
	if !claims.HasAnyRole(RoleTeacher) {
		return false, nil
	}
	userID, err := parseUUID(claims.UserID)
	if err != nil {
		return false, nil
	}
	assigned, err := q.CheckTeacherAssignedToClass(ctx, db.CheckTeacherAssignedToClassParams{ClassID: classID, UserID: userID})
	if err != nil {
		return false, fmt.Errorf("check teacher assignment: %w", err)
	}
	return assigned, nil
}
