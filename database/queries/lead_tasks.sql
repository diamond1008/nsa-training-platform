-- database/queries/lead_tasks.sql

-- name: CreateLeadTask :one
INSERT INTO lead_tasks (
  lead_id,
  assigned_to,
  title,
  description,
  due_at,
  created_by
) VALUES (
  $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetLeadTask :one
SELECT
  lt.*,
  l.full_name AS lead_name,
  l.phone AS lead_phone,
  u_assignee.email AS assigned_to_email,
  u_creator.email AS created_by_email
FROM lead_tasks lt
JOIN leads l ON l.id = lt.lead_id
JOIN users u_assignee ON u_assignee.id = lt.assigned_to
JOIN users u_creator ON u_creator.id = lt.created_by
WHERE lt.id = $1;

-- name: UpdateLeadTask :one
UPDATE lead_tasks
SET
  title = $2,
  description = $3,
  due_at = $4
WHERE id = $1
RETURNING *;

-- name: CompleteLeadTask :one
UPDATE lead_tasks
SET completed_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ListLeadTasksByLead :many
SELECT
  lt.*,
  u_assignee.email AS assigned_to_email,
  u_creator.email AS created_by_email
FROM lead_tasks lt
JOIN users u_assignee ON u_assignee.id = lt.assigned_to
JOIN users u_creator ON u_creator.id = lt.created_by
WHERE lt.lead_id = $1
ORDER BY
  CASE WHEN lt.completed_at IS NULL THEN 0 ELSE 1 END ASC,
  lt.due_at ASC,
  lt.created_at DESC;

-- name: ListLeadTasks :many
SELECT
  lt.*,
  l.full_name AS lead_name,
  l.phone AS lead_phone,
  u_assignee.email AS assigned_to_email,
  u_creator.email AS created_by_email
FROM lead_tasks lt
JOIN leads l ON l.id = lt.lead_id
JOIN users u_assignee ON u_assignee.id = lt.assigned_to
JOIN users u_creator ON u_creator.id = lt.created_by
WHERE (
  sqlc.narg(assigned_to)::uuid IS NULL
  OR lt.assigned_to = sqlc.narg(assigned_to)::uuid
)
AND (
  sqlc.narg(lead_id)::uuid IS NULL
  OR lt.lead_id = sqlc.narg(lead_id)::uuid
)
AND (
  sqlc.arg(filter_status)::text = 'all'
  OR (sqlc.arg(filter_status)::text = 'pending' AND lt.completed_at IS NULL)
  OR (sqlc.arg(filter_status)::text = 'completed' AND lt.completed_at IS NOT NULL)
  OR (sqlc.arg(filter_status)::text = 'overdue' AND lt.completed_at IS NULL AND lt.due_at < NOW())
  OR (sqlc.arg(filter_status)::text = 'today' AND lt.completed_at IS NULL AND DATE(lt.due_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'))
)
ORDER BY
  CASE WHEN lt.completed_at IS NULL THEN 0 ELSE 1 END ASC,
  lt.due_at ASC,
  lt.created_at DESC;

-- name: GetSaleDashboardStats :one
SELECT
  (SELECT COUNT(*)::bigint FROM leads WHERE assigned_to = sqlc.arg(user_id)::uuid) AS assigned_leads,
  (SELECT COUNT(*)::bigint FROM leads WHERE assigned_to = sqlc.arg(user_id)::uuid AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS new_leads_today,
  (SELECT COUNT(*)::bigint FROM lead_tasks WHERE assigned_to = sqlc.arg(user_id)::uuid AND completed_at IS NULL AND due_at < NOW()) AS overdue_tasks,
  (SELECT COUNT(*)::bigint FROM lead_tasks WHERE assigned_to = sqlc.arg(user_id)::uuid AND completed_at IS NULL AND DATE(due_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS today_tasks,
  (SELECT COUNT(*)::bigint FROM leads WHERE assigned_to = sqlc.arg(user_id)::uuid AND pipeline_status = 'da_dang_ky' AND DATE_TRUNC('month', converted_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS converted_this_month,
  (SELECT COUNT(*)::bigint FROM leads WHERE assigned_to = sqlc.arg(user_id)::uuid AND DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS total_this_month;
