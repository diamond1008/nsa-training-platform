// Package audit records important business changes.
package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

// Write inserts one audit log through the supplied transaction-bound queries.
func Write(
	ctx context.Context,
	q *db.Queries,
	actorID string,
	action string,
	entityType string,
	entityID pgtype.UUID,
	oldValue any,
	newValue any,
) error {
	return WriteWithReason(ctx, q, actorID, action, entityType, entityID, oldValue, newValue, "")
}

// WriteWithReason inserts an audit log and preserves the operator's reason.
func WriteWithReason(
	ctx context.Context,
	q *db.Queries,
	actorID string,
	action string,
	entityType string,
	entityID pgtype.UUID,
	oldValue any,
	newValue any,
	reason string,
) error {
	actor, err := data.UUID(actorID)
	if err != nil {
		return fmt.Errorf("audit actor: %w", err)
	}
	oldJSON, err := marshalNullable(oldValue)
	if err != nil {
		return fmt.Errorf("audit old value: %w", err)
	}
	newJSON, err := marshalNullable(newValue)
	if err != nil {
		return fmt.Errorf("audit new value: %w", err)
	}
	if err := q.InsertAuditLog(ctx, db.InsertAuditLogParams{
		ActorUserID: actor,
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		OldValues:   oldJSON,
		NewValues:   newJSON,
		Reason:      nullableReason(reason),
	}); err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}

func nullableReason(reason string) pgtype.Text {
	if reason == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: reason, Valid: true}
}

func marshalNullable(value any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}
	return json.Marshal(value)
}
