// Package notifications implements authenticated in-app notifications.
package notifications

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/pagination"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

var ErrNotFound = errors.New("notification not found")

type View struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Message   string  `json:"message"`
	Type      string  `json:"type"`
	Status    string  `json:"status"`
	ActionURL *string `json:"action_url"`
	ReadAt    *string `json:"read_at"`
	CreatedAt string  `json:"created_at"`
}

type ListView struct {
	Items  []View          `json:"items"`
	Meta   pagination.Meta `json:"meta"`
	Unread int64           `json:"unread"`
}

type Service struct{ queries *db.Queries }

func NewService(pool *pgxpool.Pool) *Service { return &Service{queries: db.New(pool)} }

func Create(ctx context.Context, q *db.Queries, userID pgtype.UUID, title, message, kind string, actionURL *string) error {
	_, err := q.CreateNotification(ctx, db.CreateNotificationParams{
		UserID: userID, Title: title, Message: message, Type: kind, ActionUrl: data.Text(actionURL),
	})
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}

func CreateForClass(ctx context.Context, q *db.Queries, classID pgtype.UUID, title, message, kind string, actionURL *string) error {
	recipients, err := q.ListClassNotificationRecipients(ctx, classID)
	if err != nil {
		return fmt.Errorf("list class notification recipients: %w", err)
	}
	for _, userID := range recipients {
		if err := Create(ctx, q, userID, title, message, kind, actionURL); err != nil {
			return err
		}
	}
	return nil
}

func CreateForAdmins(ctx context.Context, q *db.Queries, title, message, kind string, actionURL *string) error {
	recipients, err := q.ListAdminNotificationRecipients(ctx)
	if err != nil {
		return fmt.Errorf("list admin notification recipients: %w", err)
	}
	for _, userID := range recipients {
		if err := Create(ctx, q, userID, title, message, kind, actionURL); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) List(ctx context.Context, userID string, page, perPage int) (ListView, error) {
	uid, err := data.UUID(userID)
	if err != nil {
		return ListView{}, ErrNotFound
	}
	rows, err := s.queries.ListUserNotifications(ctx, db.ListUserNotificationsParams{UserID: uid, Offset: int32((page - 1) * perPage), Limit: int32(perPage)})
	if err != nil {
		return ListView{}, fmt.Errorf("list notifications: %w", err)
	}
	total, err := s.queries.CountUserNotifications(ctx, uid)
	if err != nil {
		return ListView{}, fmt.Errorf("count notifications: %w", err)
	}
	unread, err := s.queries.CountUnreadNotifications(ctx, uid)
	if err != nil {
		return ListView{}, fmt.Errorf("count unread notifications: %w", err)
	}
	items := make([]View, 0, len(rows))
	for _, row := range rows {
		items = append(items, view(row))
	}
	return ListView{Items: items, Meta: pagination.New(items, page, perPage, total).Meta, Unread: unread}, nil
}

func (s *Service) MarkRead(ctx context.Context, userID, id string) (View, error) {
	return s.change(ctx, userID, id, true)
}
func (s *Service) Archive(ctx context.Context, userID, id string) (View, error) {
	return s.change(ctx, userID, id, false)
}
func (s *Service) change(ctx context.Context, userID, id string, read bool) (View, error) {
	uid, err := data.UUID(userID)
	if err != nil {
		return View{}, ErrNotFound
	}
	nid, err := data.UUID(id)
	if err != nil {
		return View{}, ErrNotFound
	}
	var row db.Notification
	if read {
		row, err = s.queries.MarkNotificationRead(ctx, db.MarkNotificationReadParams{ID: nid, UserID: uid})
	} else {
		row, err = s.queries.ArchiveNotification(ctx, db.ArchiveNotificationParams{ID: nid, UserID: uid})
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("update notification: %w", err)
	}
	return view(row), nil
}

func view(row db.Notification) View {
	var readAt *string
	if row.ReadAt.Valid {
		v := row.ReadAt.Time.UTC().Format(time.RFC3339Nano)
		readAt = &v
	}
	return View{ID: data.UUIDString(row.ID), Title: row.Title, Message: row.Message, Type: row.Type,
		Status: string(row.Status), ActionURL: data.TextPointer(row.ActionUrl), ReadAt: readAt,
		CreatedAt: row.CreatedAt.Time.UTC().Format(time.RFC3339Nano)}
}
