package tasks

import (
	"errors"
	"time"
)

var (
	ErrTaskNotFound       = errors.New("task not found")
	ErrLeadNotFound       = errors.New("lead not found")
	ErrUnauthorizedAccess = errors.New("unauthorized access to task")
	ErrTitleRequired      = errors.New("title is required")
	ErrDueAtRequired      = errors.New("due_at is required")
)

type View struct {
	ID              string  `json:"id"`
	LeadID          string  `json:"lead_id"`
	LeadName        *string `json:"lead_name,omitempty"`
	LeadPhone       *string `json:"lead_phone,omitempty"`
	AssignedTo      string  `json:"assigned_to"`
	AssignedToEmail *string `json:"assigned_to_email,omitempty"`
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	DueAt           string  `json:"due_at"`
	CompletedAt     *string `json:"completed_at"`
	CreatedBy       string  `json:"created_by"`
	CreatedByEmail  *string `json:"created_by_email,omitempty"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

type CreateInput struct {
	LeadID      string
	AssignedTo  string
	Title       string
	Description *string
	DueAt       time.Time
}

type UpdateInput struct {
	Title       string
	Description *string
	DueAt       time.Time
}

type ListFilter struct {
	AssignedTo   string
	LeadID       string
	FilterStatus string // "all", "pending", "completed", "overdue", "today"
}
