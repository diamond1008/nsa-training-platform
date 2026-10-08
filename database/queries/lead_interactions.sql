-- database/queries/lead_interactions.sql

-- name: CreateLeadInteraction :one
INSERT INTO lead_interactions (
  lead_id,
  channel,
  summary,
  outcome,
  created_by
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;

-- name: ListLeadInteractionsByLead :many
SELECT
  li.*,
  u.email AS created_by_email
FROM lead_interactions li
JOIN users u ON u.id = li.created_by
WHERE li.lead_id = $1
ORDER BY li.created_at DESC;
