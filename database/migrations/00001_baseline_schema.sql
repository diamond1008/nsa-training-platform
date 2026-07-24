-- NSA Training Management and Student Portal
-- Baseline schema v1.2 (reviewed) — PostgreSQL 15+
-- Source: NSA_Training_Portal_PostgreSQL_v1.2.sql (converted to Goose migration)

-- +goose Up

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

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
-- +goose StatementEnd

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
-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose StatementBegin
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
-- +goose StatementEnd

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

-- +goose Down

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS course_completions CASCADE;
DROP TABLE IF EXISTS assessment_items CASCADE;
DROP TABLE IF EXISTS student_assessments CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS teacher_assignments CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS training_locations CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS competency_criteria CASCADE;
DROP TABLE IF EXISTS course_modules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS teacher_profiles CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

DROP FUNCTION IF EXISTS enforce_class_capacity();
DROP FUNCTION IF EXISTS prevent_capacity_reduction_below_enrollment();
DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS completion_status;
DROP TYPE IF EXISTS competency_rating;
DROP TYPE IF EXISTS assessment_status;
DROP TYPE IF EXISTS attendance_status;
DROP TYPE IF EXISTS session_status;
DROP TYPE IF EXISTS session_type;
DROP TYPE IF EXISTS enrollment_status;
DROP TYPE IF EXISTS class_status;
DROP TYPE IF EXISTS course_status;
DROP TYPE IF EXISTS teacher_status;
DROP TYPE IF EXISTS student_status;
DROP TYPE IF EXISTS user_status;

DROP EXTENSION IF EXISTS btree_gist;
DROP EXTENSION IF EXISTS citext;