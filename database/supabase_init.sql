-- Auto-generated Supabase database initialization script

-- ==================== 00001_baseline_schema.sql ====================


CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'inactive');
CREATE TYPE student_status AS ENUM ('pending', 'active', 'suspended', 'completed', 'withdrawn');
CREATE TYPE teacher_status AS ENUM ('active', 'inactive');
CREATE TYPE course_status AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE class_status AS ENUM ('planning', 'open', 'in_progress', 'completed', 'cancelled', 'archived');
CREATE TYPE enrollment_status AS ENUM ('enrolled', 'transferred', 'completed', 'withdrawn');
CREATE TYPE session_type AS ENUM ('theory', 'workshop', 'assessment', 'other');
CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'locked');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE assessment_status AS ENUM ('draft', 'submitted', 'locked');
CREATE TYPE competency_rating AS ENUM ('not_assessed', 'needs_improvement', 'competent', 'good', 'excellent');
CREATE TYPE completion_status AS ENUM ('pending', 'eligible', 'approved', 'rejected');
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE roles (
  id SMALLSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'pending',
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_ip INET,
  user_agent TEXT,
  CONSTRAINT refresh_tokens_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT refresh_tokens_revoked_check CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  student_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  date_of_birth DATE,
  status student_status NOT NULL DEFAULT 'pending',
  enrolled_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  teacher_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  specialization VARCHAR(200),
  status teacher_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  total_sessions INTEGER NOT NULL,
  minimum_attendance_pct NUMERIC(5,2) NOT NULL DEFAULT 80,
  status course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courses_total_sessions_check CHECK (total_sessions > 0),
  CONSTRAINT courses_attendance_check CHECK (minimum_attendance_pct BETWEEN 0 AND 100)
);

CREATE TABLE course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(200) NOT NULL,
  sequence_no INTEGER NOT NULL,
  planned_sessions INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_modules_sequence_check CHECK (sequence_no > 0),
  CONSTRAINT course_modules_sessions_check CHECK (planned_sessions > 0),
  UNIQUE (course_id, code),
  UNIQUE (course_id, sequence_no),
  UNIQUE (id, course_id)
);

CREATE TABLE competency_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id UUID,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  sequence_no INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT competency_criteria_sequence_check CHECK (sequence_no > 0),
  CONSTRAINT competency_criteria_module_fk
    FOREIGN KEY (module_id, course_id)
    REFERENCES course_modules(id, course_id)
    ON DELETE NO ACTION,
  UNIQUE (course_id, code),
  UNIQUE (course_id, sequence_no),
  UNIQUE (id, course_id)
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  class_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  maximum_students INTEGER NOT NULL,
  status class_status NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classes_dates_check CHECK (end_date >= start_date),
  CONSTRAINT classes_capacity_check CHECK (maximum_students > 0),
  UNIQUE (id, course_id)
);

CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
  status enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_enrollments_ended_check CHECK (ended_at IS NULL OR ended_at >= enrolled_at),
  CONSTRAINT class_enrollments_status_date_check CHECK (
    (status = 'enrolled' AND ended_at IS NULL)
    OR (status <> 'enrolled' AND ended_at IS NOT NULL)
  ),
  UNIQUE (class_id, student_id)
);

CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
  assignment_role VARCHAR(80) NOT NULL DEFAULT 'Instructor',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, teacher_id)
);

CREATE TABLE training_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  location_type VARCHAR(40) NOT NULL,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_locations_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);

CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  course_id UUID NOT NULL,
  module_id UUID,
  teacher_id UUID,
  location_id UUID REFERENCES training_locations(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  session_type session_type NOT NULL DEFAULT 'theory',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status session_status NOT NULL DEFAULT 'scheduled',
  attendance_locked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_sessions_time_check CHECK (ends_at > starts_at),
  CONSTRAINT class_sessions_lock_check CHECK (
    attendance_locked_at IS NULL OR attendance_locked_at >= starts_at
  ),
  CONSTRAINT class_sessions_class_course_fk
    FOREIGN KEY (class_id, course_id)
    REFERENCES classes(id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT class_sessions_module_course_fk
    FOREIGN KEY (module_id, course_id)
    REFERENCES course_modules(id, course_id)
    ON DELETE NO ACTION,
  CONSTRAINT class_sessions_teacher_assignment_fk
    FOREIGN KEY (class_id, teacher_id)
    REFERENCES teacher_assignments(class_id, teacher_id)
    ON DELETE NO ACTION,
  UNIQUE (id, class_id),
  UNIQUE (id, class_id, course_id)
);

-- Prevent overlapping non-cancelled sessions for the same class.
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_no_class_overlap
  EXCLUDE USING gist (
    class_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled'::session_status);

-- Prevent overlapping non-cancelled sessions for the same teacher.
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_no_teacher_overlap
  EXCLUDE USING gist (
    teacher_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled'::session_status AND teacher_id IS NOT NULL);

-- Prevent overlapping non-cancelled sessions for the same location.
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_no_location_overlap
  EXCLUDE USING gist (
    location_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled'::session_status AND location_id IS NOT NULL);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id UUID NOT NULL,
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status attendance_status NOT NULL,
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_session_class_fk
    FOREIGN KEY (class_session_id, class_id)
    REFERENCES class_sessions(id, class_id)
    ON DELETE CASCADE,
  CONSTRAINT attendance_enrollment_fk
    FOREIGN KEY (class_id, student_id)
    REFERENCES class_enrollments(class_id, student_id)
    ON DELETE RESTRICT,
  UNIQUE (class_session_id, student_id)
);

CREATE TABLE student_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  course_id UUID NOT NULL,
  student_id UUID NOT NULL,
  assessed_by UUID NOT NULL,
  session_id UUID,
  assessment_no INTEGER NOT NULL DEFAULT 1,
  status assessment_status NOT NULL DEFAULT 'draft',
  overall_comment TEXT,
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_assessments_number_check CHECK (assessment_no > 0),
  CONSTRAINT student_assessments_status_check CHECK (
    (status = 'draft' AND submitted_at IS NULL AND locked_at IS NULL)
    OR (status = 'submitted' AND submitted_at IS NOT NULL AND locked_at IS NULL)
    OR (status = 'locked' AND submitted_at IS NOT NULL AND locked_at IS NOT NULL)
  ),
  CONSTRAINT student_assessments_timestamp_check CHECK (
    (submitted_at IS NULL OR submitted_at >= created_at)
    AND (locked_at IS NULL OR locked_at >= submitted_at)
  ),
  CONSTRAINT student_assessments_class_course_fk
    FOREIGN KEY (class_id, course_id)
    REFERENCES classes(id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT student_assessments_enrollment_fk
    FOREIGN KEY (class_id, student_id)
    REFERENCES class_enrollments(class_id, student_id)
    ON DELETE RESTRICT,
  CONSTRAINT student_assessments_teacher_assignment_fk
    FOREIGN KEY (class_id, assessed_by)
    REFERENCES teacher_assignments(class_id, teacher_id)
    ON DELETE NO ACTION,
  CONSTRAINT student_assessments_session_fk
    FOREIGN KEY (session_id, class_id, course_id)
    REFERENCES class_sessions(id, class_id, course_id)
    ON DELETE NO ACTION,
  UNIQUE (class_id, student_id, assessment_no),
  UNIQUE (id, course_id)
);

CREATE TABLE assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL,
  course_id UUID NOT NULL,
  competency_criterion_id UUID NOT NULL,
  rating competency_rating NOT NULL DEFAULT 'not_assessed',
  comment TEXT,
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_items_assessment_fk
    FOREIGN KEY (assessment_id, course_id)
    REFERENCES student_assessments(id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT assessment_items_criterion_fk
    FOREIGN KEY (competency_criterion_id, course_id)
    REFERENCES competency_criteria(id, course_id)
    ON DELETE RESTRICT,
  UNIQUE (assessment_id, competency_criterion_id)
);

CREATE TABLE course_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  attendance_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  required_competencies_met INTEGER NOT NULL DEFAULT 0,
  required_competencies_total INTEGER NOT NULL DEFAULT 0,
  status completion_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_completions_enrollment_fk
    FOREIGN KEY (class_id, student_id)
    REFERENCES class_enrollments(class_id, student_id)
    ON DELETE RESTRICT,
  CONSTRAINT course_completions_attendance_check CHECK (attendance_pct BETWEEN 0 AND 100),
  CONSTRAINT course_completions_competency_check CHECK (
    required_competencies_met >= 0
    AND required_competencies_total >= 0
    AND required_competencies_met <= required_competencies_total
  ),
  CONSTRAINT course_completions_review_check CHECK (
    (status IN ('pending', 'eligible') AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  UNIQUE (class_id, student_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(60) NOT NULL DEFAULT 'general',
  status notification_status NOT NULL DEFAULT 'unread',
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_read_check CHECK (status <> 'read' OR read_at IS NOT NULL)
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  request_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce class capacity safely under concurrent enrollment attempts.
CREATE OR REPLACE FUNCTION enforce_class_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity INTEGER;
  v_enrolled_count INTEGER;
BEGIN
  IF NEW.status <> 'enrolled'::enrollment_status THEN
    RETURN NEW;
  END IF;

  SELECT maximum_students
  INTO v_capacity
  FROM classes
  WHERE id = NEW.class_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'Class % does not exist', NEW.class_id;
  END IF;

  SELECT COUNT(*)
  INTO v_enrolled_count
  FROM class_enrollments
  WHERE class_id = NEW.class_id
    AND status = 'enrolled'::enrollment_status
    AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF v_enrolled_count >= v_capacity THEN
    RAISE EXCEPTION 'Class % has reached its maximum capacity of % students', NEW.class_id, v_capacity;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_capacity_reduction_below_enrollment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enrolled_count INTEGER;
BEGIN
  IF NEW.maximum_students = OLD.maximum_students THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_enrolled_count
  FROM class_enrollments
  WHERE class_id = NEW.id
    AND status = 'enrolled'::enrollment_status;

  IF NEW.maximum_students < v_enrolled_count THEN
    RAISE EXCEPTION 'Maximum students (%) cannot be lower than current enrollment (%)',
      NEW.maximum_students, v_enrolled_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_class_enrollments_capacity
BEFORE INSERT OR UPDATE OF class_id, status ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION enforce_class_capacity();

CREATE TRIGGER trg_classes_capacity_reduction
BEFORE UPDATE OF maximum_students ON classes
FOR EACH ROW EXECUTE FUNCTION prevent_capacity_reduction_below_enrollment();

-- Frequently used indexes. Unique constraints already create their own indexes.
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_refresh_tokens_active_user_expiry
  ON refresh_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_student_profiles_status ON student_profiles(status);
CREATE INDEX idx_teacher_profiles_status ON teacher_profiles(status);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_classes_course_status ON classes(course_id, status);
CREATE INDEX idx_classes_date_range ON classes(start_date, end_date);
CREATE INDEX idx_class_enrollments_student_status ON class_enrollments(student_id, status);
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_class_sessions_class_start ON class_sessions(class_id, starts_at);
CREATE INDEX idx_class_sessions_teacher_start ON class_sessions(teacher_id, starts_at)
  WHERE teacher_id IS NOT NULL;
CREATE INDEX idx_class_sessions_location_start ON class_sessions(location_id, starts_at)
  WHERE location_id IS NOT NULL;
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_student_assessments_student_class ON student_assessments(student_id, class_id);
CREATE INDEX idx_student_assessments_assessed_by ON student_assessments(assessed_by);
CREATE INDEX idx_assessment_items_criterion_id ON assessment_items(competency_criterion_id);
CREATE INDEX idx_course_completions_status ON course_completions(status);
CREATE INDEX idx_notifications_user_status_created
  ON notifications(user_id, status, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_old_values_gin ON audit_logs USING gin(old_values);
CREATE INDEX idx_audit_logs_new_values_gin ON audit_logs USING gin(new_values);

-- Keep updated_at values consistent.
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_student_profiles_updated_at
BEFORE UPDATE ON student_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teacher_profiles_updated_at
BEFORE UPDATE ON teacher_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_course_modules_updated_at
BEFORE UPDATE ON course_modules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_competency_criteria_updated_at
BEFORE UPDATE ON competency_criteria
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_enrollments_updated_at
BEFORE UPDATE ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teacher_assignments_updated_at
BEFORE UPDATE ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_training_locations_updated_at
BEFORE UPDATE ON training_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_sessions_updated_at
BEFORE UPDATE ON class_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_student_assessments_updated_at
BEFORE UPDATE ON student_assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assessment_items_updated_at
BEFORE UPDATE ON assessment_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_course_completions_updated_at
BEFORE UPDATE ON course_completions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default roles (reference data, safe for all environments).
INSERT INTO roles (code, name, description)
VALUES
  ('ADMIN', 'Administrator', 'Manages students, teachers, courses, classes, schedules, and completion approvals.'),
  ('TEACHER', 'Teacher', 'Views assigned classes, records attendance, and assesses practical competencies.'),
  ('STUDENT', 'Student', 'Views personal schedules, attendance, assessments, and learning progress.')
ON CONFLICT (code) DO NOTHING;



-- ==================== 00002_student_profiles_lifecycle.sql ====================


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



-- ==================== 00003_expand_student_code_format.sql ====================


ALTER TABLE student_profiles
  ALTER COLUMN student_code SET DEFAULT (
    'HV' || lpad(nextval('student_code_seq')::TEXT, 8, '0')
  );

-- Normalize codes previously generated with the five-digit format. Legacy
-- non-HV codes are intentionally preserved.
UPDATE student_profiles
SET student_code = 'HV' || lpad(substring(student_code FROM '^HV([0-9]+)$'), 8, '0')
WHERE student_code ~ '^HV[0-9]{1,7}$';



-- ==================== 00004_class_operations_history.sql ====================


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



-- ==================== 00005_completion_certificates_and_evidence.sql ====================


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



-- ==================== 00006_tests_scores_and_completion_rules.sql ====================


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



-- ==================== 00007_fixed_training_slots.sql ====================


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



-- ==================== 00008_add_student_avatar_url.sql ====================

ALTER TABLE student_profiles ADD COLUMN avatar_url TEXT;



-- ==================== 00009_add_enrollment_periods.sql ====================


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

CREATE TRIGGER trg_class_enrollments_initial_period
AFTER INSERT ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION create_initial_enrollment_period();



-- ==================== 00010_add_teacher_avatar_url.sql ====================

ALTER TABLE teacher_profiles ADD COLUMN avatar_url TEXT;



-- ==================== 00011_add_teacher_assignment_periods.sql ====================


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

CREATE TRIGGER trg_teacher_assignments_initial_period
AFTER INSERT ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION create_initial_teacher_assignment_period();



-- ==================== 00012_add_test_retake_permits.sql ====================


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



-- ==================== database/seeds/dev.sql ====================
-- ==========================================================================
-- DEV-ONLY seed data — NSA Training Platform
-- NEVER run this in staging/production. All accounts are fake demo accounts.
--
-- Demo password for ALL accounts below:  NsaDemo@123   (bcrypt cost 10)
-- Change passwords immediately if this database is ever shared.
--
-- Apply with:  make db-seed
-- ==========================================================================

BEGIN;

-- ---------- Demo users (fixed UUIDs keep re-runs idempotent) ----------
INSERT INTO users (id, email, password_hash, status, must_change_password) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@nsa.local',   '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('22222222-2222-2222-2222-222222222222', 'teacher@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE),
  ('33333333-3333-3333-3333-333333333333', 'student@nsa.local', '$2a$10$GsxiaGCj4KByEhya9W2DKuBXIXe2rFCEPSqwArzcHJkRes85Q2AQe', 'active', FALSE)
ON CONFLICT (email) DO NOTHING;

-- ---------- Role assignments (resolved by code, not hardcoded ids) ----------
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'ADMIN'
WHERE u.email = 'admin@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'TEACHER'
WHERE u.email = 'teacher@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'STUDENT'
WHERE u.email = 'student@nsa.local'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ---------- Demo profiles ----------
INSERT INTO teacher_profiles (user_id, teacher_code, full_name, specialization, status)
SELECT id, 'TCH-DEMO-001', 'Demo Teacher', 'Automotive Electrical Systems', 'active'
FROM users WHERE email = 'teacher@nsa.local'
ON CONFLICT (teacher_code) DO NOTHING;

INSERT INTO student_profiles (user_id, full_name, status, enrolled_at)
SELECT id, 'Demo Student', 'active', CURRENT_DATE
FROM users u
WHERE u.email = 'student@nsa.local'
  AND NOT EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id = u.id);

INSERT INTO student_status_history (student_id, from_status, to_status, reason)
SELECT sp.id, NULL, sp.status, 'Khởi tạo dữ liệu demo'
FROM student_profiles sp
JOIN users u ON u.id = sp.user_id AND u.email = 'student@nsa.local'
WHERE NOT EXISTS (
  SELECT 1 FROM student_status_history ssh WHERE ssh.student_id = sp.id
);

COMMIT;

