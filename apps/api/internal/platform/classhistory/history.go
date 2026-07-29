// Package classhistory records the operational timeline of a training class.
package classhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/diamond1008/nsa-training-platform/apps/api/internal/platform/data"
	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

// Write appends one immutable class-operation event inside the caller's transaction.
func Write(ctx context.Context, q *db.Queries, actorID string, classID pgtype.UUID,
	eventType, entityType string, entityID pgtype.UUID, reason string, details any) error {
	actor, err := data.UUID(actorID)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(details)
	if err != nil {
		return fmt.Errorf("marshal class operation details: %w", err)
	}
	var reasonValue *string
	if normalized := strings.TrimSpace(reason); normalized != "" {
		reasonValue = &normalized
	}
	if _, err := q.CreateClassOperationEvent(ctx, db.CreateClassOperationEventParams{
		ClassID: classID, EventType: eventType, EntityType: entityType,
		EntityID: entityID, Reason: data.Text(reasonValue), Details: payload,
		ActorUserID: actor,
	}); err != nil {
		return fmt.Errorf("write class operation history: %w", err)
	}
	return nil
}
