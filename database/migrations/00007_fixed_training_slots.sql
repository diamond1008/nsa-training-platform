-- +goose Up

-- Off-slot sessions are intentionally discarded so every active and historical
-- calendar row follows one center-wide timetable. Preserve assessment results by
-- removing only their optional link to an off-slot session first.
UPDATE student_assessments
SET session_id = NULL
WHERE session_id IN (
  SELECT id
  FROM class_sessions
  WHERE NOT (
    (starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date =
      (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    AND (
      ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '08:00'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '12:00')
      OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '13:30'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '17:30')
      OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '18:30'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '21:30')
    )
  )
);

DELETE FROM class_sessions
WHERE NOT (
  (starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date =
    (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  AND (
    ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '08:00'
      AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '12:00')
    OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '13:30'
      AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '17:30')
    OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '18:30'
      AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '21:30')
  )
);

ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_training_slot_check CHECK (
    (starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date =
      (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    AND (
      ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '08:00'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '12:00')
      OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '13:30'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '17:30')
      OR ((starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '18:30'
        AND (ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time = TIME '21:30')
    )
  );

-- +goose Down

-- Deleted off-slot sessions cannot be reconstructed safely.
ALTER TABLE class_sessions DROP CONSTRAINT class_sessions_training_slot_check;
