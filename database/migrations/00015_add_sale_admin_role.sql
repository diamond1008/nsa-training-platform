-- +goose Up
INSERT INTO roles (code, name, description)
VALUES ('SALE_ADMIN', 'Sale Administrator', 'Manages admissions, assigns leads, approves orders, and views sales reports.')
ON CONFLICT (code) DO NOTHING;

-- +goose Down
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE code = 'SALE_ADMIN');
DELETE FROM roles WHERE code = 'SALE_ADMIN';
