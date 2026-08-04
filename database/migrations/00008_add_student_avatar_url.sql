-- +goose Up
ALTER TABLE student_profiles ADD COLUMN avatar_url TEXT;

-- +goose Down
ALTER TABLE student_profiles DROP COLUMN IF EXISTS avatar_url;
