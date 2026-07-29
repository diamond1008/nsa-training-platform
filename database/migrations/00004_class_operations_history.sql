-- +goose Up

CREATE TABLE class_operation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  event_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id UUID,
  reason VARCHAR(500),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_operation_history_event_type_check CHECK (btrim(event_type) <> ''),
  CONSTRAINT class_operation_history_entity_type_check CHECK (btrim(entity_type) <> ''),
  CONSTRAINT class_operation_history_reason_check CHECK (reason IS NULL OR btrim(reason) <> '')
);

CREATE INDEX idx_class_operation_history_class_time
  ON class_operation_history(class_id, occurred_at DESC, id DESC);

-- +goose Down

DROP TABLE IF EXISTS class_operation_history;
