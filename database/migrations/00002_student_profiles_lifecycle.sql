-- +goose Up

CREATE SEQUENCE student_code_seq;

SELECT setval(
  'student_code_seq',
  GREATEST(
    COALESCE((
      SELECT MAX(substring(student_code FROM '^HV([0-9]+)$')::BIGINT)
      FROM student_profiles
      WHERE student_code ~ '^HV[0-9]+$'
    ), 0) + 1,
    1
  ),
  false
);

ALTER TABLE student_profiles
  ALTER COLUMN student_code SET DEFAULT (
    'HV' || lpad(nextval('student_code_seq')::TEXT, 5, '0')
  ),
  ADD COLUMN gender VARCHAR(20),
  ADD COLUMN address VARCHAR(500),
  ADD COLUMN emergency_contact_name VARCHAR(160),
  ADD COLUMN emergency_contact_phone VARCHAR(30),
  ADD CONSTRAINT student_profiles_gender_check CHECK (
    gender IS NULL OR gender IN ('male', 'female', 'other', 'unspecified')
  );

CREATE TABLE student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  from_status student_status,
  to_status student_status NOT NULL,
  reason VARCHAR(500) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_status_history_transition_check CHECK (
    from_status IS NULL OR from_status <> to_status
  )
);

CREATE INDEX idx_student_status_history_student_changed
  ON student_status_history(student_id, changed_at DESC, id DESC);

-- Preserve the initial lifecycle state of profiles that predate this migration.
INSERT INTO student_status_history (student_id, from_status, to_status, reason, changed_at)
SELECT id, NULL, status, 'Imported from existing profile', created_at
FROM student_profiles;

-- +goose Down

DROP TABLE IF EXISTS student_status_history;

ALTER TABLE student_profiles
  DROP CONSTRAINT IF EXISTS student_profiles_gender_check,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS gender,
  ALTER COLUMN student_code DROP DEFAULT;

DROP SEQUENCE IF EXISTS student_code_seq;
