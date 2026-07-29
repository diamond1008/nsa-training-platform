export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface Student {
  id: string;
  email: string;
  account_status: string;
  student_code: string;
  full_name: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  status: string;
  enrolled_at?: string | null;
}

export interface StudentStatusHistory {
  id: string;
  student_id: string;
  from_status?: string | null;
  to_status: string;
  reason: string;
  changed_by?: string | null;
  changed_by_email?: string | null;
  changed_at: string;
}

export interface Teacher {
  id: string;
  email: string;
  account_status: string;
  teacher_code: string;
  full_name: string;
  phone?: string | null;
  specialization?: string | null;
  status: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  total_sessions: number;
  minimum_attendance_pct: number;
  status: string;
}

export interface TrainingClass {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  class_code: string;
  name: string;
  start_date: string;
  end_date: string;
  maximum_students: number;
  enrolled_students: number;
  status: string;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  student_code: string;
  full_name: string;
  status: string;
  enrolled_at: string;
  ended_at?: string | null;
}

export interface EnrollmentTransfer {
  source: Enrollment;
  target: Enrollment;
}

export interface ClassOperationHistory {
  id: string;
  class_id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  reason?: string | null;
  details: Record<string, unknown>;
  actor_user_id?: string | null;
  actor_email?: string | null;
  occurred_at: string;
}

export interface TeacherAssignment {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_code: string;
  full_name: string;
  assignment_role: string;
  assigned_at: string;
}

export interface CompetencyCriterion {
  id: string;
  course_id: string;
  module_id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  is_required: boolean;
  sequence_no: number;
}

export interface TeacherClassDetail {
  class: TrainingClass;
  students: Enrollment[];
  competencies: CompetencyCriterion[];
}

export interface TrainingLocation {
  id: string;
  code: string;
  name: string;
  location_type: string;
  capacity?: number | null;
  is_active: boolean;
}

export interface ClassSession {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  course_id: string;
  course_code: string;
  course_name: string;
  module_id?: string | null;
  teacher_id?: string | null;
  teacher_code?: string | null;
  teacher_name?: string | null;
  location_id?: string | null;
  location_code?: string | null;
  location_name?: string | null;
  title: string;
  session_type: string;
  starts_at: string;
  ends_at: string;
  status: string;
  attendance_locked_at?: string | null;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRosterItem {
  student_id: string;
  student_code: string;
  full_name: string;
  enrollment_status: string;
  attendance_id?: string | null;
  attendance_status?: AttendanceStatus | null;
  note?: string | null;
  recorded_by?: string | null;
  recorded_by_email?: string | null;
  recorded_at?: string | null;
  updated_at?: string | null;
}

export interface SessionAttendance {
  session: ClassSession;
  items: AttendanceRosterItem[];
  summary: {
    total: number;
    recorded: number;
    unrecorded: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
}

export interface StudentAttendanceHistoryItem {
  id: string;
  class_session_id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  course_code: string;
  course_name: string;
  session_title: string;
  starts_at: string;
  ends_at: string;
  status: AttendanceStatus;
  note?: string | null;
}

export interface StudentAttendanceSummary {
  class_id: string;
  class_code: string;
  class_name: string;
  course_code: string;
  course_name: string;
  recorded_sessions: number;
  present_sessions: number;
  absent_sessions: number;
  late_sessions: number;
  excused_sessions: number;
  attendance_pct: number;
  minimum_attendance_pct: number;
  is_at_risk: boolean;
}

export type CompetencyRating =
  "not_assessed" | "needs_improvement" | "competent" | "good" | "excellent";

export interface AssessmentItem {
  id: string;
  competency_criterion_id: string;
  criterion_code: string;
  criterion_name: string;
  is_required: boolean;
  sequence_no: number;
  rating: CompetencyRating;
  comment?: string | null;
}

export interface StudentAssessment {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  course_code: string;
  course_name: string;
  student_id: string;
  student_code: string;
  student_name: string;
  teacher_code: string;
  teacher_name: string;
  session_id?: string | null;
  session_title?: string | null;
  assessment_no: number;
  status: string;
  overall_comment?: string | null;
  evidence_url?: string | null;
  submitted_at?: string | null;
  locked_at?: string | null;
  items: AssessmentItem[];
}

export interface StudentProgress {
  class_id: string;
  class_code: string;
  class_name: string;
  class_status: string;
  enrollment_status: string;
  course_code: string;
  course_name: string;
  sessions: { completed: number; required: number; percent: number };
  attendance: {
    records: number;
    attended: number;
    excused: number;
    percent: number;
    minimum_required_pct: number;
    requirement_met: boolean;
  };
  competencies: { met: number; required: number; percent: number; requirement_met: boolean };
  assessments: { completed: number; required: number; percent: number; requirement_met: boolean };
  overall_progress_pct: number;
  completion_status: string;
}

export interface ProgressDashboard {
  items: StudentProgress[];
  summary: { classes: number; eligible_classes: number; average_progress_pct: number };
}

export interface CompletionCandidate {
  class_id: string;
  class_code: string;
  class_name: string;
  student_id: string;
  student_code: string;
  student_name: string;
  course_code: string;
  course_name: string;
  completed_sessions: number;
  total_sessions: number;
  attendance_pct: number;
  minimum_attendance_pct: number;
  required_competencies_met: number;
  required_competencies_total: number;
  completed_assessments: number;
  required_assessments: number;
  is_eligible: boolean;
  status: string;
  review_note?: string | null;
  reviewed_at?: string | null;
}

export interface Certificate {
  id: string;
  completion_id: string;
  certificate_number: string;
  verification_code: string;
  class_code: string;
  class_name: string;
  course_code: string;
  course_name: string;
  student_code: string;
  student_name: string;
  issued_at: string;
  is_current: boolean;
  revoked_at?: string | null;
  revoke_reason?: string | null;
}

export interface CompletionDecisionResult {
  candidate: CompletionCandidate;
  certificate?: Certificate | null;
}

export interface ReportSummary {
  active_students: number;
  open_classes: number;
  upcoming_sessions: number;
  at_risk_students: number;
  approved_completions: number;
  pending_notifications: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  action_url?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationList {
  items: NotificationItem[];
  meta: PaginationMeta;
  unread: number;
}
