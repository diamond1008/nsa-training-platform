package interactions

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/audit"
	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

type Service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		pool:    pool,
		queries: db.New(pool),
	}
}

func (s *Service) Create(ctx context.Context, actorID, leadIDValue string, input CreateInput) (View, error) {
	leadID, err := data.UUID(leadIDValue)
	if err != nil {
		return View{}, ErrLeadNotFound
	}
	actorUUID, err := data.UUID(actorID)
	if err != nil {
		return View{}, fmt.Errorf("invalid actor: %w", err)
	}

	summary := strings.TrimSpace(input.Summary)
	if summary == "" {
		return View{}, ErrSummaryRequired
	}

	if !isValidChannel(input.Channel) {
		return View{}, ErrInvalidChannel
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create interaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	// Verify lead exists
	if _, err := q.GetLead(ctx, leadID); errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrLeadNotFound
	} else if err != nil {
		return View{}, fmt.Errorf("verify lead: %w", err)
	}

	record, err := q.CreateLeadInteraction(ctx, db.CreateLeadInteractionParams{
		LeadID:    leadID,
		Channel:   input.Channel,
		Summary:   summary,
		Outcome:   data.Text(input.Outcome),
		CreatedBy: actorUUID,
	})
	if err != nil {
		return View{}, fmt.Errorf("create interaction: %w", err)
	}

	user, err := q.GetUserByID(ctx, actorUUID)
	var creatorEmail *string
	if err == nil {
		creatorEmail = &user.Email
	}

	view := View{
		ID:             data.UUIDString(record.ID),
		LeadID:         data.UUIDString(record.LeadID),
		Channel:        string(record.Channel),
		Summary:        record.Summary,
		Outcome:        data.TextPointer(record.Outcome),
		CreatedBy:      data.UUIDString(record.CreatedBy),
		CreatedByEmail: creatorEmail,
		CreatedAt:      record.CreatedAt.Time.UTC().Format(time.RFC3339),
	}

	if err := audit.Write(ctx, q, actorID, "lead_interaction.create", "lead_interaction", record.ID, nil, view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create interaction: %w", err)
	}

	return view, nil
}

func (s *Service) ListByLead(ctx context.Context, leadIDValue string) ([]View, error) {
	leadID, err := data.UUID(leadIDValue)
	if err != nil {
		return nil, ErrLeadNotFound
	}

	rows, err := s.queries.ListLeadInteractionsByLead(ctx, leadID)
	if err != nil {
		return nil, fmt.Errorf("list interactions: %w", err)
	}

	items := make([]View, 0, len(rows))
	for _, r := range rows {
		var email *string
		if r.CreatedByEmail != "" {
			email = &r.CreatedByEmail
		}
		items = append(items, View{
			ID:             data.UUIDString(r.ID),
			LeadID:         data.UUIDString(r.LeadID),
			Channel:        string(r.Channel),
			Summary:        r.Summary,
			Outcome:        data.TextPointer(r.Outcome),
			CreatedBy:      data.UUIDString(r.CreatedBy),
			CreatedByEmail: email,
			CreatedAt:      r.CreatedAt.Time.UTC().Format(time.RFC3339),
		})
	}

	return items, nil
}

func (s *Service) ListPipelineHistory(ctx context.Context, leadIDValue string) ([]PipelineHistoryView, error) {
	leadID, err := data.UUID(leadIDValue)
	if err != nil {
		return nil, ErrLeadNotFound
	}

	rows, err := s.queries.ListPipelineHistoryByLead(ctx, leadID)
	if err != nil {
		return nil, fmt.Errorf("list pipeline history: %w", err)
	}

	items := make([]PipelineHistoryView, 0, len(rows))
	for _, r := range rows {
		var oldStatus *string
		if r.OldStatus.Valid {
			s := string(r.OldStatus.LeadPipelineStatus)
			oldStatus = &s
		}
		var email *string
		if r.ChangedByEmail != "" {
			email = &r.ChangedByEmail
		}

		items = append(items, PipelineHistoryView{
			ID:             data.UUIDString(r.ID),
			LeadID:         data.UUIDString(r.LeadID),
			OldStatus:      oldStatus,
			NewStatus:      string(r.NewStatus),
			Reason:         data.TextPointer(r.Reason),
			ChangedBy:      data.UUIDString(r.ChangedBy),
			ChangedByEmail: email,
			ChangedAt:      r.ChangedAt.Time.UTC().Format(time.RFC3339),
		})
	}

	return items, nil
}

func isValidChannel(c db.InteractionChannel) bool {
	switch c {
	case db.InteractionChannelPhoneCall,
		db.InteractionChannelZalo,
		db.InteractionChannelFacebook,
		db.InteractionChannelEmail,
		db.InteractionChannelInPerson,
		db.InteractionChannelSms,
		db.InteractionChannelOther:
		return true
	default:
		return false
	}
}
