-- +goose Up

CREATE TYPE course_test_kind AS ENUM ('class_test', 'final_exam');

-- The center uses one fixed attendance threshold for every vocational course.
UPDATE courses SET minimum_attendance_pct = 80;
ALTER TABLE courses DROP CONSTRAINT courses_attendance_check;
ALTER TABLE courses ADD CONSTRAINT courses_attendance_check CHECK (minimum_attendance_pct = 80);

CREATE TABLE course_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  kind course_test_kind NOT NULL,
  pass_score NUMERIC(4,2) NOT NULL DEFAULT 5,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  sequence_no INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_tests_score_check CHECK (pass_score BETWEEN 0 AND 10),
  CONSTRAINT course_tests_sequence_check CHECK (sequence_no > 0),
  CONSTRAINT course_tests_final_rule_check CHECK (
    kind <> 'final_exam' OR (pass_score = 5 AND is_required)
  ),
  UNIQUE (course_id, code),
  UNIQUE (course_id, sequence_no),
  UNIQUE (id, course_id)
);

CREATE UNIQUE INDEX course_tests_one_active_final_exam
  ON course_tests(course_id) WHERE kind='final_exam' AND is_active;

CREATE TABLE student_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  course_id UUID NOT NULL,
  class_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
  attempt_no INTEGER NOT NULL,
  score NUMERIC(4,2) NOT NULL,
  note VARCHAR(1000),
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_test_attempts_score_check CHECK (score BETWEEN 0 AND 10),
  CONSTRAINT student_test_attempts_attempt_check CHECK (attempt_no > 0),
  CONSTRAINT student_test_attempts_test_fk FOREIGN KEY (test_id, course_id)
    REFERENCES course_tests(id, course_id) ON DELETE RESTRICT,
  CONSTRAINT student_test_attempts_class_fk FOREIGN KEY (class_id, course_id)
    REFERENCES classes(id, course_id) ON DELETE RESTRICT,
  UNIQUE (test_id, student_id, attempt_no)
);

CREATE INDEX idx_student_test_attempts_course_student
  ON student_test_attempts(course_id, student_id, test_id, attempt_no DESC);

CREATE TABLE test_attempt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES student_test_attempts(id) ON DELETE CASCADE,
  old_score NUMERIC(4,2) NOT NULL,
  new_score NUMERIC(4,2) NOT NULL,
  old_note VARCHAR(1000),
  new_note VARCHAR(1000),
  reason VARCHAR(1000) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT test_attempt_history_reason_check CHECK (btrim(reason) <> '')
);

CREATE INDEX idx_test_attempt_history_attempt_time
  ON test_attempt_history(attempt_id, changed_at DESC, id DESC);

ALTER TABLE course_completions
  ADD COLUMN course_id UUID,
  ADD COLUMN required_tests_passed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN required_tests_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN final_exam_score NUMERIC(4,2);

UPDATE course_completions cp
SET course_id = c.course_id
FROM classes c
WHERE c.id = cp.class_id;

ALTER TABLE course_completions
  ALTER COLUMN course_id SET NOT NULL,
  ADD CONSTRAINT course_completions_course_fk FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  ADD CONSTRAINT course_completions_test_metrics_check CHECK (
    required_tests_passed >= 0 AND required_tests_total >= 0
    AND required_tests_passed <= required_tests_total
    AND (final_exam_score IS NULL OR final_exam_score BETWEEN 0 AND 10)
  );

ALTER TABLE course_completions DROP CONSTRAINT course_completions_class_id_student_id_key;
ALTER TABLE course_completions ADD CONSTRAINT course_completions_student_course_key UNIQUE (student_id, course_id);

ALTER TABLE completion_decision_history
  ADD COLUMN required_tests_passed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN required_tests_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN final_exam_score NUMERIC(4,2),
  ADD CONSTRAINT completion_decision_history_test_metrics_check CHECK (
    required_tests_passed >= 0 AND required_tests_total >= 0
    AND required_tests_passed <= required_tests_total
    AND (final_exam_score IS NULL OR final_exam_score BETWEEN 0 AND 10)
  );

-- +goose Down

ALTER TABLE completion_decision_history DROP CONSTRAINT completion_decision_history_test_metrics_check;
ALTER TABLE completion_decision_history
  DROP COLUMN final_exam_score,
  DROP COLUMN required_tests_total,
  DROP COLUMN required_tests_passed;

ALTER TABLE course_completions DROP CONSTRAINT course_completions_student_course_key;
ALTER TABLE course_completions ADD CONSTRAINT course_completions_class_id_student_id_key UNIQUE (class_id, student_id);
ALTER TABLE course_completions DROP CONSTRAINT course_completions_test_metrics_check;
ALTER TABLE course_completions DROP CONSTRAINT course_completions_course_fk;
ALTER TABLE course_completions
  DROP COLUMN final_exam_score,
  DROP COLUMN required_tests_total,
  DROP COLUMN required_tests_passed,
  DROP COLUMN course_id;

DROP TABLE test_attempt_history;
DROP TABLE student_test_attempts;
DROP TABLE course_tests;
DROP TYPE course_test_kind;

ALTER TABLE courses DROP CONSTRAINT courses_attendance_check;
ALTER TABLE courses ADD CONSTRAINT courses_attendance_check CHECK (minimum_attendance_pct BETWEEN 0 AND 100);
