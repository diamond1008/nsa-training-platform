-- +goose Up

CREATE TABLE teacher_assignment_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_reason TEXT,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_assignment_periods_dates_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT teacher_assignment_periods_no_overlap
    EXCLUDE USING gist (
      assignment_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamptz), '[)') WITH &&
    )
);

CREATE UNIQUE INDEX idx_teacher_assignment_periods_one_open
  ON teacher_assignment_periods(assignment_id)
  WHERE ended_at IS NULL;

CREATE INDEX idx_teacher_assignment_periods_temporal
  ON teacher_assignment_periods(assignment_id, started_at, ended_at);

INSERT INTO teacher_assignment_periods (
  assignment_id, started_at, created_by, start_reason
)
SELECT id, assigned_at, assigned_by, 'Khởi tạo từ phân công hiện có'
FROM teacher_assignments;

-- +goose StatementBegin
CREATE FUNCTION create_initial_teacher_assignment_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO teacher_assignment_periods (
    assignment_id, started_at, created_by, start_reason
  ) VALUES (
    NEW.id, NEW.assigned_at, NEW.assigned_by, 'Phân công giảng viên'
  );
  RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER trg_teacher_assignments_initial_period
AFTER INSERT ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION create_initial_teacher_assignment_period();

-- +goose Down

DROP TRIGGER IF EXISTS trg_teacher_assignments_initial_period ON teacher_assignments;
DROP FUNCTION IF EXISTS create_initial_teacher_assignment_period();
DROP TABLE IF EXISTS teacher_assignment_periods;
