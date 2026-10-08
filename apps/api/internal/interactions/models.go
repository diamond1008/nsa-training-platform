package interactions

import (
	"errors"

	db "github.com/diamond1008/nsa-training-platform/database/generated"
)

var (
	ErrLeadNotFound    = errors.New("lead not found")
	ErrInvalidChannel  = errors.New("invalid interaction channel")
	ErrSummaryRequired = errors.New("summary is required")
)

type View struct {
	ID             string  `json:"id"`
	LeadID         string  `json:"lead_id"`
	Channel        string  `json:"channel"`
	Summary        string  `json:"summary"`
	Outcome        *string `json:"outcome"`
	CreatedBy      string  `json:"created_by"`
	CreatedByEmail *string `json:"created_by_email"`
	CreatedAt      string  `json:"created_at"`
}

type CreateInput struct {
	Channel db.InteractionChannel
	Summary string
	Outcome *string
}

type PipelineHistoryView struct {
	ID             string  `json:"id"`
	LeadID         string  `json:"lead_id"`
	OldStatus      *string `json:"old_status"`
	NewStatus      string  `json:"new_status"`
	Reason         *string `json:"reason"`
	ChangedBy      string  `json:"changed_by"`
	ChangedByEmail *string `json:"changed_by_email"`
	ChangedAt      string  `json:"changed_at"`
}
