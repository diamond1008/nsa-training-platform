// Package auth implements authentication and authorization for the API.
package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

// Domain errors mapped to standard API error codes by the handler.
var (
	// ErrInvalidCredentials is the GENERIC failure for login (never reveals
	// whether the email exists, the password was wrong, or the account is suspended).
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrInvalidRefreshToken covers missing, unknown, expired, or revoked refresh tokens.
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	// ErrWrongCurrentPassword is returned when changing password with a wrong current one.
	ErrWrongCurrentPassword = errors.New("current password is incorrect")
	// ErrWeakPassword is returned when the new password violates policy.
	ErrWeakPassword = errors.New("new password does not meet requirements")
	// ErrUserNotFound is returned when the authenticated user no longer exists.
	ErrUserNotFound = errors.New("user not found")
)

// minPasswordLength is the MVP password policy (documented in docs/openapi.yaml).
const minPasswordLength = 8

// ProfileInfo is a lightweight reference to a student/teacher profile.
type ProfileInfo struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	FullName string `json:"full_name"`
}

// UserInfo describes the authenticated user for /auth/me and login responses.
type UserInfo struct {
	ID                 string       `json:"id"`
	Email              string       `json:"email"`
	Roles              []string     `json:"roles"`
	MustChangePassword bool         `json:"must_change_password"`
	StudentProfile     *ProfileInfo `json:"student_profile,omitempty"`
	TeacherProfile     *ProfileInfo `json:"teacher_profile,omitempty"`
}

// TokenBundle is the result of a successful login or refresh.
type TokenBundle struct {
	AccessToken        string    `json:"access_token"`
	TokenType          string    `json:"token_type"`
	AccessExpiresAt    time.Time `json:"access_expires_at"`
	RefreshToken       string    `json:"-"` // transported via HttpOnly cookie only
	RefreshExpiresAt   time.Time `json:"-"`
	MustChangePassword bool      `json:"must_change_password"`
	User               UserInfo  `json:"user"`
}

// Service contains the authentication use cases.
type Service struct {
	queries    *db.Queries
	tokens     *TokenService
	refreshTTL time.Duration
	bcryptCost int
	log        *slog.Logger
}

// NewService wires the authentication use cases.
func NewService(queries *db.Queries, tokens *TokenService, refreshTTLDays int, bcryptCost int, log *slog.Logger) (*Service, error) {
	if queries == nil || tokens == nil {
		return nil, errors.New("auth service requires queries and token service")
	}
	if refreshTTLDays <= 0 {
		return nil, errors.New("refresh TTL days must be positive")
	}
	if bcryptCost < bcrypt_minCost || bcryptCost > 14 {
		return nil, errors.New("bcrypt cost out of range")
	}
	return &Service{
		queries:    queries,
		tokens:     tokens,
		refreshTTL: time.Duration(refreshTTLDays) * 24 * time.Hour,
		bcryptCost: bcryptCost,
		log:        log,
	}, nil
}

const bcrypt_minCost = 10

// Login authenticates by email + password and issues a token bundle.
// All failure modes collapse into ErrInvalidCredentials (no user enumeration).
func (s *Service) Login(ctx context.Context, email, password string) (*TokenBundle, error) {
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("login lookup: %w", err)
	}
	if !CheckPassword(user.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}
	if user.Status != db.UserStatusActive {
		return nil, ErrInvalidCredentials
	}

	roles, err := s.queries.GetUserRoleCodes(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("login roles: %w", err)
	}

	bundle, err := s.issueBundle(ctx, user.ID, user.Email, roles, user.MustChangePassword)
	if err != nil {
		return nil, err
	}
	if err := s.queries.UpdateLastLogin(ctx, user.ID); err != nil {
		s.log.Warn("failed to update last_login_at", "error", err)
	}
	return bundle, nil
}

// Refresh validates and rotates a refresh token, issuing a new bundle.
// Presenting an already-revoked token revokes ALL tokens of that user (reuse detection).
func (s *Service) Refresh(ctx context.Context, presentedToken string) (*TokenBundle, error) {
	if presentedToken == "" {
		return nil, ErrInvalidRefreshToken
	}
	stored, err := s.queries.GetRefreshTokenByHash(ctx, HashRefreshToken(presentedToken))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("refresh lookup: %w", err)
	}

	if stored.RevokedAt.Valid {
		// Token reuse detected: kill the whole session family.
		if err := s.queries.RevokeAllRefreshTokensForUser(ctx, stored.UserID); err != nil {
			s.log.Error("failed to revoke token family after reuse", "error", err)
		}
		s.log.Warn("revoked refresh token presented; family revoked", "user_id", stored.UserID.String())
		return nil, ErrInvalidRefreshToken
	}
	if time.Now().UTC().After(stored.ExpiresAt.Time) {
		return nil, ErrInvalidRefreshToken
	}

	user, err := s.queries.GetUserByID(ctx, stored.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("refresh user: %w", err)
	}
	if user.Status != db.UserStatusActive {
		return nil, ErrInvalidRefreshToken
	}

	// Rotate: revoke the old token before issuing its replacement.
	if err := s.queries.RevokeRefreshToken(ctx, stored.ID); err != nil {
		return nil, fmt.Errorf("refresh rotate: %w", err)
	}

	roles, err := s.queries.GetUserRoleCodes(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("refresh roles: %w", err)
	}
	return s.issueBundle(ctx, user.ID, user.Email, roles, user.MustChangePassword)
}

// Logout revokes the presented refresh token. Idempotent by design.
func (s *Service) Logout(ctx context.Context, presentedToken string) error {
	if presentedToken == "" {
		return nil
	}
	stored, err := s.queries.GetRefreshTokenByHash(ctx, HashRefreshToken(presentedToken))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("logout lookup: %w", err)
	}
	return s.queries.RevokeRefreshToken(ctx, stored.ID)
}

// ChangePassword verifies the current password, sets the new one,
// clears must_change_password, and revokes ALL refresh tokens (force re-login).
func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	uid, err := parseUUID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	user, err := s.queries.GetUserByID(ctx, uid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("change password lookup: %w", err)
	}
	if !CheckPassword(user.PasswordHash, currentPassword) {
		return ErrWrongCurrentPassword
	}
	if len(newPassword) < minPasswordLength {
		return ErrWeakPassword
	}
	hash, err := HashPassword(newPassword, s.bcryptCost)
	if err != nil {
		return fmt.Errorf("hash new password: %w", err)
	}
	if err := s.queries.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{ID: uid, PasswordHash: hash}); err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if err := s.queries.RevokeAllRefreshTokensForUser(ctx, uid); err != nil {
		return fmt.Errorf("revoke tokens after password change: %w", err)
	}
	return nil
}

// Me returns the profile of the authenticated user.
func (s *Service) Me(ctx context.Context, userID string) (*UserInfo, error) {
	uid, err := parseUUID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}
	user, err := s.queries.GetUserByID(ctx, uid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("me lookup: %w", err)
	}
	roles, err := s.queries.GetUserRoleCodes(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("me roles: %w", err)
	}
	info := &UserInfo{
		ID:                 userID,
		Email:              user.Email,
		Roles:              roles,
		MustChangePassword: user.MustChangePassword,
	}
	s.attachProfiles(ctx, uid, info)
	return info, nil
}

// issueBundle creates the access token + persisted refresh token pair.
func (s *Service) issueBundle(ctx context.Context, userID pgtype.UUID, email string, roles []string, mustChangePassword bool) (*TokenBundle, error) {
	accessToken, accessExpiresAt, err := s.tokens.Issue(userID.String(), email, roles)
	if err != nil {
		return nil, err
	}
	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return nil, err
	}
	refreshExpiresAt := time.Now().UTC().Add(s.refreshTTL)
	_, err = s.queries.InsertRefreshToken(ctx, db.InsertRefreshTokenParams{
		UserID:    userID,
		TokenHash: HashRefreshToken(refreshToken),
		ExpiresAt: pgtype.Timestamptz{Time: refreshExpiresAt, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("persist refresh token: %w", err)
	}

	info := &UserInfo{
		ID:                 userID.String(),
		Email:              email,
		Roles:              roles,
		MustChangePassword: mustChangePassword,
	}
	s.attachProfiles(ctx, userID, info)

	return &TokenBundle{
		AccessToken:        accessToken,
		TokenType:          "Bearer",
		AccessExpiresAt:    accessExpiresAt,
		RefreshToken:       refreshToken,
		RefreshExpiresAt:   refreshExpiresAt,
		MustChangePassword: mustChangePassword,
		User:               *info,
	}, nil
}

// attachProfiles fills student/teacher profile references when they exist.
func (s *Service) attachProfiles(ctx context.Context, userID pgtype.UUID, info *UserInfo) {
	student, err := s.queries.GetStudentProfileByUserID(ctx, userID)
	if err == nil {
		info.StudentProfile = &ProfileInfo{ID: student.ID.String(), Code: student.StudentCode, FullName: student.FullName}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.log.Warn("failed to load student profile", "error", err)
	}
	teacher, err := s.queries.GetTeacherProfileByUserID(ctx, userID)
	if err == nil {
		info.TeacherProfile = &ProfileInfo{ID: teacher.ID.String(), Code: teacher.TeacherCode, FullName: teacher.FullName}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		s.log.Warn("failed to load teacher profile", "error", err)
	}
}

// parseUUID converts a string UUID into pgtype.UUID.
func parseUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	if err := u.Scan(s); err != nil {
		return pgtype.UUID{}, err
	}
	return u, nil
}
