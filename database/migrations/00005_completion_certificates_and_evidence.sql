-- +goose Up

ALTER TABLE student_assessments
  ADD COLUMN evidence_url TEXT,
  ADD CONSTRAINT student_assessments_evidence_url_check CHECK (
    evidence_url IS NULL OR evidence_url ~ '^https?://'
  );

CREATE SEQUENCE certificate_number_seq AS BIGINT START WITH 1;

CREATE TABLE completion_decision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id UUID NOT NULL REFERENCES course_completions(id) ON DELETE CASCADE,
  status completion_status NOT NULL,
  attendance_pct NUMERIC(5,2) NOT NULL,
  required_competencies_met INTEGER NOT NULL,
  required_competencies_total INTEGER NOT NULL,
  note VARCHAR(1000) NOT NULL,
  decided_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT completion_decision_history_status_check CHECK (status IN ('approved', 'rejected')),
  CONSTRAINT completion_decision_history_note_check CHECK (btrim(note) <> '')
);

CREATE INDEX idx_completion_decision_history_completion_time
  ON completion_decision_history(completion_id, decided_at DESC, id DESC);

CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id UUID NOT NULL REFERENCES course_completions(id) ON DELETE RESTRICT,
  certificate_number VARCHAR(20) NOT NULL UNIQUE
    DEFAULT ('CC' || lpad(nextval('certificate_number_seq')::TEXT, 8, '0')),
  verification_code UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  revoke_reason VARCHAR(1000),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT certificates_revocation_check CHECK (
    (is_current AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL)
    OR
    (NOT is_current AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND btrim(revoke_reason) <> '')
  )
);

CREATE UNIQUE INDEX certificates_one_current_per_completion
  ON certificates(completion_id) WHERE is_current;
CREATE INDEX idx_certificates_verification ON certificates(verification_code);

-- +goose Down

DROP TABLE IF EXISTS certificates;
DROP SEQUENCE IF EXISTS certificate_number_seq;
DROP TABLE IF EXISTS completion_decision_history;
ALTER TABLE student_assessments DROP CONSTRAINT IF EXISTS student_assessments_evidence_url_check;
ALTER TABLE student_assessments DROP COLUMN IF EXISTS evidence_url;
