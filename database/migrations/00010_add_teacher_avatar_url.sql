-- +goose Up
ALTER TABLE teacher_profiles ADD COLUMN avatar_url TEXT;

-- +goose Down
ALTER TABLE teacher_profiles DROP COLUMN IF EXISTS avatar_url;
