-- database/queries/lead_pipeline_history.sql

-- name: CreatePipelineHistory :one
INSERT INTO lead_pipeline_history (
  lead_id,
  old_status,
  new_status,
  reason,
  changed_by
) VALUES (
  $1, $2, $3, $4, $5
)
RETURNING *;

-- name: ListPipelineHistoryByLead :many
SELECT
  lph.*,
  u.email AS changed_by_email
FROM lead_pipeline_history lph
JOIN users u ON u.id = lph.changed_by
WHERE lph.lead_id = $1
ORDER BY lph.changed_at DESC;
