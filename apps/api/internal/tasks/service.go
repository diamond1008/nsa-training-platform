package tasks

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

func (s *Service) Create(ctx context.Context, actorID string, input CreateInput) (View, error) {
	leadID, err := data.UUID(input.LeadID)
	if err != nil {
		return View{}, ErrLeadNotFound
	}
	assigneeUUID, err := data.UUID(input.AssignedTo)
	if err != nil {
		return View{}, fmt.Errorf("invalid assignee ID: %w", err)
	}
	actorUUID, err := data.UUID(actorID)
	if err != nil {
		return View{}, fmt.Errorf("invalid actor ID: %w", err)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return View{}, ErrTitleRequired
	}
	if input.DueAt.IsZero() {
		return View{}, ErrDueAtRequired
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin create task: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	// Verify lead exists
	if _, err := q.GetLead(ctx, leadID); errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrLeadNotFound
	} else if err != nil {
		return View{}, fmt.Errorf("verify lead: %w", err)
	}

	record, err := q.CreateLeadTask(ctx, db.CreateLeadTaskParams{
		LeadID:      leadID,
		AssignedTo:  assigneeUUID,
		Title:       title,
		Description: data.Text(input.Description),
		DueAt:       pgtype.Timestamptz{Time: input.DueAt.UTC(), Valid: true},
		CreatedBy:   actorUUID,
	})
	if err != nil {
		return View{}, err
	}

	taskRow, err := q.GetLeadTask(ctx, record.ID)
	if err != nil {
		return View{}, fmt.Errorf("read created task: %w", err)
	}

	view := viewFromTaskRow(taskRow)
	if err := audit.Write(ctx, q, actorID, "lead_task.create", "lead_task", record.ID, nil, view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit create task: %w", err)
	}

	return view, nil
}

func (s *Service) Update(ctx context.Context, actorID string, isAdmin bool, taskIDValue string, input UpdateInput) (View, error) {
	taskID, err := data.UUID(taskIDValue)
	if err != nil {
		return View{}, ErrTaskNotFound
	}

	existing, err := s.queries.GetLeadTask(ctx, taskID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrTaskNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get task: %w", err)
	}

	if !isAdmin && data.UUIDString(existing.AssignedTo) != actorID {
		return View{}, ErrUnauthorizedAccess
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return View{}, ErrTitleRequired
	}
	if input.DueAt.IsZero() {
		return View{}, ErrDueAtRequired
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin update task: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	_, err = q.UpdateLeadTask(ctx, db.UpdateLeadTaskParams{
		ID:          taskID,
		Title:       title,
		Description: data.Text(input.Description),
		DueAt:       pgtype.Timestamptz{Time: input.DueAt.UTC(), Valid: true},
	})
	if err != nil {
		return View{}, err
	}

	updated, err := q.GetLeadTask(ctx, taskID)
	if err != nil {
		return View{}, fmt.Errorf("read updated task: %w", err)
	}

	view := viewFromTaskRow(updated)
	if err := audit.Write(ctx, q, actorID, "lead_task.update", "lead_task", taskID, viewFromTaskRow(existing), view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit update task: %w", err)
	}

	return view, nil
}

func (s *Service) Complete(ctx context.Context, actorID string, isAdmin bool, taskIDValue string) (View, error) {
	taskID, err := data.UUID(taskIDValue)
	if err != nil {
		return View{}, ErrTaskNotFound
	}

	existing, err := s.queries.GetLeadTask(ctx, taskID)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrTaskNotFound
	}
	if err != nil {
		return View{}, fmt.Errorf("get task: %w", err)
	}

	if !isAdmin && data.UUIDString(existing.AssignedTo) != actorID {
		return View{}, ErrUnauthorizedAccess
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return View{}, fmt.Errorf("begin complete task: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	q := s.queries.WithTx(tx)

	_, err = q.CompleteLeadTask(ctx, taskID)
	if err != nil {
		return View{}, err
	}

	updated, err := q.GetLeadTask(ctx, taskID)
	if err != nil {
		return View{}, fmt.Errorf("read completed task: %w", err)
	}

	view := viewFromTaskRow(updated)
	if err := audit.Write(ctx, q, actorID, "lead_task.complete", "lead_task", taskID, viewFromTaskRow(existing), view); err != nil {
		return View{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return View{}, fmt.Errorf("commit complete task: %w", err)
	}

	return view, nil
}

func (s *Service) List(ctx context.Context, actorID string, isAdmin bool, filter ListFilter) ([]View, error) {
	var assignedTo pgtype.UUID
	if !isAdmin {
		actorUUID, err := data.UUID(actorID)
		if err != nil {
			return nil, fmt.Errorf("invalid actor: %w", err)
		}
		assignedTo = actorUUID
	} else if filter.AssignedTo != "" {
		parsed, err := data.UUID(filter.AssignedTo)
		if err == nil {
			assignedTo = parsed
		}
	}

	var leadID pgtype.UUID
	if filter.LeadID != "" {
		parsed, err := data.UUID(filter.LeadID)
		if err == nil {
			leadID = parsed
		}
	}

	filterStatus := strings.ToLower(strings.TrimSpace(filter.FilterStatus))
	if filterStatus == "" {
		filterStatus = "all"
	}

	rows, err := s.queries.ListLeadTasks(ctx, db.ListLeadTasksParams{
		AssignedTo:   assignedTo,
		LeadID:       leadID,
		FilterStatus: filterStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}

	items := make([]View, 0, len(rows))
	for _, r := range rows {
		items = append(items, viewFromListRow(r))
	}
	return items, nil
}

func (s *Service) ListByLead(ctx context.Context, leadIDValue string) ([]View, error) {
	leadID, err := data.UUID(leadIDValue)
	if err != nil {
		return nil, ErrLeadNotFound
	}

	rows, err := s.queries.ListLeadTasksByLead(ctx, leadID)
	if err != nil {
		return nil, fmt.Errorf("list tasks by lead: %w", err)
	}

	items := make([]View, 0, len(rows))
	for _, r := range rows {
		var completedAt *string
		if r.CompletedAt.Valid {
			s := r.CompletedAt.Time.UTC().Format(time.RFC3339)
			completedAt = &s
		}
		var assigneeEmail *string
		if r.AssignedToEmail != "" {
			assigneeEmail = &r.AssignedToEmail
		}
		var creatorEmail *string
		if r.CreatedByEmail != "" {
			creatorEmail = &r.CreatedByEmail
		}

		items = append(items, View{
			ID:              data.UUIDString(r.ID),
			LeadID:          data.UUIDString(r.LeadID),
			AssignedTo:      data.UUIDString(r.AssignedTo),
			AssignedToEmail: assigneeEmail,
			Title:           r.Title,
			Description:     data.TextPointer(r.Description),
			DueAt:           r.DueAt.Time.UTC().Format(time.RFC3339),
			CompletedAt:     completedAt,
			CreatedBy:       data.UUIDString(r.CreatedBy),
			CreatedByEmail:  creatorEmail,
			CreatedAt:       r.CreatedAt.Time.UTC().Format(time.RFC3339),
			UpdatedAt:       r.UpdatedAt.Time.UTC().Format(time.RFC3339),
		})
	}
	return items, nil
}

func viewFromTaskRow(r db.GetLeadTaskRow) View {
	var completedAt *string
	if r.CompletedAt.Valid {
		s := r.CompletedAt.Time.UTC().Format(time.RFC3339)
		completedAt = &s
	}
	var assigneeEmail *string
	if r.AssignedToEmail != "" {
		assigneeEmail = &r.AssignedToEmail
	}
	var creatorEmail *string
	if r.CreatedByEmail != "" {
		creatorEmail = &r.CreatedByEmail
	}

	return View{
		ID:              data.UUIDString(r.ID),
		LeadID:          data.UUIDString(r.LeadID),
		LeadName:        stringPtr(r.LeadName),
		LeadPhone:       data.TextPointer(r.LeadPhone),
		AssignedTo:      data.UUIDString(r.AssignedTo),
		AssignedToEmail: assigneeEmail,
		Title:           r.Title,
		Description:     data.TextPointer(r.Description),
		DueAt:           r.DueAt.Time.UTC().Format(time.RFC3339),
		CompletedAt:     completedAt,
		CreatedBy:       data.UUIDString(r.CreatedBy),
		CreatedByEmail:  creatorEmail,
		CreatedAt:       r.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:       r.UpdatedAt.Time.UTC().Format(time.RFC3339),
	}
}

func viewFromListRow(r db.ListLeadTasksRow) View {
	var completedAt *string
	if r.CompletedAt.Valid {
		s := r.CompletedAt.Time.UTC().Format(time.RFC3339)
		completedAt = &s
	}
	var assigneeEmail *string
	if r.AssignedToEmail != "" {
		assigneeEmail = &r.AssignedToEmail
	}
	var creatorEmail *string
	if r.CreatedByEmail != "" {
		creatorEmail = &r.CreatedByEmail
	}

	return View{
		ID:              data.UUIDString(r.ID),
		LeadID:          data.UUIDString(r.LeadID),
		LeadName:        stringPtr(r.LeadName),
		LeadPhone:       data.TextPointer(r.LeadPhone),
		AssignedTo:      data.UUIDString(r.AssignedTo),
		AssignedToEmail: assigneeEmail,
		Title:           r.Title,
		Description:     data.TextPointer(r.Description),
		DueAt:           r.DueAt.Time.UTC().Format(time.RFC3339),
		CompletedAt:     completedAt,
		CreatedBy:       data.UUIDString(r.CreatedBy),
		CreatedByEmail:  creatorEmail,
		CreatedAt:       r.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:       r.UpdatedAt.Time.UTC().Format(time.RFC3339),
	}
}

func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
