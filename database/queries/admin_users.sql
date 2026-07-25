-- Shared account-management queries used by the student and teacher modules.

-- name: CreateManagedUser :one
INSERT INTO users (email, password_hash, status, must_change_password)
VALUES ($1, $2, $3, TRUE)
RETURNING id, email, status, must_change_password, created_at, updated_at;

-- name: AssignManagedUserRole :exec
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT $1, id, $3
FROM roles
WHERE code = $2;

-- name: UpdateManagedUser :one
UPDATE users
SET email = $2, status = $3
WHERE id = $1
RETURNING id, email, status, must_change_password, created_at, updated_at;

-- name: InsertAuditLog :exec
INSERT INTO audit_logs (
  actor_user_id, action, entity_type, entity_id, old_values, new_values, reason
)
VALUES ($1, $2, $3, $4, $5, $6, $7);
