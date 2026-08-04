-- +goose Up

CREATE TABLE class_enrollment_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES class_enrollments(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_reason TEXT,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_enrollment_periods_dates_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT class_enrollment_periods_no_overlap
    EXCLUDE USING gist (
      enrollment_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamptz), '[)') WITH &&
    )
);

CREATE UNIQUE INDEX idx_class_enrollment_periods_one_open
  ON class_enrollment_periods(enrollment_id)
  WHERE ended_at IS NULL;

CREATE INDEX idx_class_enrollment_periods_temporal
  ON class_enrollment_periods(enrollment_id, started_at, ended_at);

INSERT INTO class_enrollment_periods (
  enrollment_id, started_at, ended_at, created_by, start_reason, end_reason
)
SELECT
  id, enrolled_at, ended_at, created_by,
  'Khởi tạo từ lịch sử ghi danh',
  CASE WHEN ended_at IS NULL THEN NULL ELSE 'Kết thúc trước khi theo dõi giai đoạn' END
FROM class_enrollments;

-- Direct fixture/seed inserts and the normal enrollment service both receive
-- their first temporal period without duplicating period-write logic.
-- +goose StatementBegin
CREATE FUNCTION create_initial_enrollment_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO class_enrollment_periods (
    enrollment_id, started_at, ended_at, created_by, start_reason
  ) VALUES (
    NEW.id, NEW.enrolled_at, NEW.ended_at, NEW.created_by, 'Ghi danh vào lớp'
  );
  RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER trg_class_enrollments_initial_period
AFTER INSERT ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION create_initial_enrollment_period();

-- +goose Down

DROP TRIGGER IF EXISTS trg_class_enrollments_initial_period ON class_enrollments;
DROP FUNCTION IF EXISTS create_initial_enrollment_period();
DROP TABLE IF EXISTS class_enrollment_periods;

