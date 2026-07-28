-- +goose Up

ALTER TABLE student_profiles
  ALTER COLUMN student_code SET DEFAULT (
    'HV' || lpad(nextval('student_code_seq')::TEXT, 8, '0')
  );

-- Normalize codes previously generated with the five-digit format. Legacy
-- non-HV codes are intentionally preserved.
UPDATE student_profiles
SET student_code = 'HV' || lpad(substring(student_code FROM '^HV([0-9]+)$'), 8, '0')
WHERE student_code ~ '^HV[0-9]{1,7}$';

-- +goose Down

ALTER TABLE student_profiles
  ALTER COLUMN student_code SET DEFAULT (
    'HV' || lpad(nextval('student_code_seq')::TEXT, 5, '0')
  );
