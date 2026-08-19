-- +goose Up

CREATE TABLE student_test_retake_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  course_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  target_attempt_no INTEGER NOT NULL,
  granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason VARCHAR(1000) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retake_permits_attempt_check CHECK (target_attempt_no >= 2),
  CONSTRAINT retake_permits_reason_check CHECK (btrim(reason) <> ''),
  CONSTRAINT retake_permits_test_fk FOREIGN KEY (test_id, course_id)
    REFERENCES course_tests(id, course_id) ON DELETE CASCADE,
  UNIQUE (test_id, student_id, target_attempt_no)
);

CREATE INDEX idx_test_retake_permits_lookup
  ON student_test_retake_permits(test_id, student_id, target_attempt_no);

-- +goose Down

DROP TABLE IF EXISTS student_test_retake_permits;
