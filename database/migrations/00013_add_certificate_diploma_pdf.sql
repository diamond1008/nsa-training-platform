-- +goose Up
ALTER TABLE certificates
  ADD COLUMN diploma_file_url TEXT,
  ADD COLUMN diploma_file_name VARCHAR(255),
  ADD COLUMN diploma_uploaded_at TIMESTAMPTZ,
  ADD COLUMN diploma_uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE certificates
  DROP COLUMN IF EXISTS diploma_uploaded_by,
  DROP COLUMN IF EXISTS diploma_uploaded_at,
  DROP COLUMN IF EXISTS diploma_file_name,
  DROP COLUMN IF EXISTS diploma_file_url;
