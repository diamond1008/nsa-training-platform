import { api, apiCSV, apiDownload } from "../../lib/apiClient";
import type {
  ClassSession,
  CompletionCandidate,
  CompletionDecisionResult,
  Certificate,
  ClassOperationHistory,
  Course,
  CourseTest,
  Enrollment,
  EnrollmentTransfer,
  Paginated,
  ReportSummary,
  Student,
  StudentClassHistory,
  StudentProfileSummary,
  StudentStatusHistory,
  Teacher,
  TeacherClassHistory,
  TeacherProfileSummary,
  TeacherAssignment,
  TrainingClass,
  TrainingLocation,
  PersonAttendanceBreakdown,
  ClassSessionAttendanceItem,
  PersonAcademicSummary,
  PersonWorkloadSummary,
  AuditLogItem,
  TestRetakePermit,
} from "../../lib/domainTypes";
import { toQuery } from "../../lib/format";

export interface ListParams {
  search?: string;
  status?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export interface StudentListParams extends ListParams {
  class_id?: string;
  course_id?: string;
  attendance_risk?: "at_risk" | "on_track";
}

export interface TeacherListParams extends ListParams {
  class_id?: string;
  course_id?: string;
  assignment?: "assigned" | "unassigned";
}

export interface ClassListParams extends ListParams {
  course_id?: string;
  teacher_id?: string;
  capacity?: "available" | "full";
  from_date?: string;
  to_date?: string;
}

export interface SessionListParams extends ListParams {
  from?: string;
  to?: string;
  class_id?: string;
  teacher_id?: string;
  location_id?: string;
  session_type?: string;
  attendance_state?: "locked" | "unlocked";
}

export interface CompletionListParams extends ListParams {
  eligibility?: "eligible" | "ineligible";
  course_id?: string;
  class_id?: string;
}

export interface StudentImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; email?: string; message: string }>;
}

export const adminApi = {
  students: (params: StudentListParams = {}) =>
    api<Paginated<Student>>(`/admin/students${toQuery(params)}`),
  getStudent: (id: string) => api<Student>(`/admin/students/${id}`),
  createStudent: (body: unknown) => api<Student>("/admin/students", { method: "POST", body }),
  updateStudent: (id: string, body: unknown) =>
    api<Student>(`/admin/students/${id}`, { method: "PUT", body }),
  studentStatusHistory: (id: string) =>
    api<StudentStatusHistory[]>(`/admin/students/${id}/status-history`),
  studentProfileSummary: (id: string) =>
    api<StudentProfileSummary>(`/admin/students/${id}/profile-summary`),
  studentClassHistory: (id: string, params: Pick<ListParams, "page" | "per_page"> = {}) =>
    api<Paginated<StudentClassHistory>>(`/admin/students/${id}/class-history${toQuery(params)}`),
  studentSchedule: (
    id: string,
    params: Pick<SessionListParams, "from" | "to" | "page" | "per_page"> = {},
  ) => api<Paginated<ClassSession>>(`/admin/students/${id}/schedule${toQuery(params)}`),
  exportStudents: (params: StudentListParams = {}) =>
    apiDownload(`/admin/students/export${toQuery(params)}`),
  importStudents: (csv: string) => apiCSV<StudentImportResult>("/admin/students/import", csv),

  teachers: (params: TeacherListParams = {}) =>
    api<Paginated<Teacher>>(`/admin/teachers${toQuery(params)}`),
  getTeacher: (id: string) => api<Teacher>(`/admin/teachers/${id}`),
  createTeacher: (body: unknown) => api<Teacher>("/admin/teachers", { method: "POST", body }),
  updateTeacher: (id: string, body: unknown) =>
    api<Teacher>(`/admin/teachers/${id}`, { method: "PUT", body }),
  teacherProfileSummary: (id: string) =>
    api<TeacherProfileSummary>(`/admin/teachers/${id}/profile-summary`),
  teacherClassHistory: (id: string, params: Pick<ListParams, "page" | "per_page"> = {}) =>
    api<Paginated<TeacherClassHistory>>(`/admin/teachers/${id}/class-history${toQuery(params)}`),

  courses: (params: ListParams = {}) => api<Paginated<Course>>(`/admin/courses${toQuery(params)}`),
  getCourse: (id: string) => api<Course>(`/admin/courses/${id}`),
  createCourse: (body: unknown) => api<Course>("/admin/courses", { method: "POST", body }),
  updateCourse: (id: string, body: unknown) =>
    api<Course>(`/admin/courses/${id}`, { method: "PUT", body }),
  courseTests: (courseId: string) => api<CourseTest[]>(`/admin/courses/${courseId}/tests`),
  createCourseTest: (courseId: string, body: unknown) =>
    api<CourseTest>(`/admin/courses/${courseId}/tests`, { method: "POST", body }),
  updateCourseTest: (courseId: string, testId: string, body: unknown) =>
    api<CourseTest>(`/admin/courses/${courseId}/tests/${testId}`, { method: "PUT", body }),
  grantTestRetakePermit: (
    courseId: string,
    studentId: string,
    testId: string,
    targetAttemptNo: number,
    reason: string,
  ) =>
    api<TestRetakePermit>(
      `/admin/courses/${courseId}/students/${studentId}/tests/${testId}/grant-retake`,
      {
        method: "POST",
        body: { target_attempt_no: targetAttemptNo, reason },
      },
    ),

  classes: (params: ClassListParams = {}) =>
    api<Paginated<TrainingClass>>(`/admin/classes${toQuery(params)}`),
  getClass: (id: string) => api<TrainingClass>(`/admin/classes/${id}`),
  createClass: (body: unknown) => api<TrainingClass>("/admin/classes", { method: "POST", body }),
  updateClass: (id: string, body: unknown) =>
    api<TrainingClass>(`/admin/classes/${id}`, { method: "PUT", body }),
  classHistory: (id: string) =>
    api<ClassOperationHistory[]>(`/admin/classes/${id}/operation-history`),
  enrollments: (classId: string) => api<Enrollment[]>(`/admin/classes/${classId}/enrollments`),
  enroll: (classId: string, studentId: string, reason = "") =>
    api<Enrollment>(`/admin/classes/${classId}/enrollments`, {
      method: "POST",
      body: { student_id: studentId, reason },
    }),
  updateEnrollment: (
    classId: string,
    id: string,
    status: string,
    reason: string,
    effectiveAt?: string,
  ) =>
    api<Enrollment>(`/admin/classes/${classId}/enrollments/${id}`, {
      method: "PUT",
      body: { status, reason, ...(effectiveAt ? { effective_at: effectiveAt } : {}) },
    }),
  transferEnrollment: (classId: string, id: string, targetClassId: string, reason: string) =>
    api<EnrollmentTransfer>(`/admin/classes/${classId}/enrollments/${id}/transfer`, {
      method: "POST",
      body: { target_class_id: targetClassId, reason },
    }),
  assignments: (classId: string) =>
    api<TeacherAssignment[]>(`/admin/classes/${classId}/teacher-assignments`),
  assign: (classId: string, teacherId: string, assignmentRole: string, reason = "") =>
    api<TeacherAssignment>(`/admin/classes/${classId}/teacher-assignments`, {
      method: "POST",
      body: { teacher_id: teacherId, assignment_role: assignmentRole, reason },
    }),
  removeAssignment: (classId: string, id: string, reason: string) =>
    api<{ message: string }>(`/admin/classes/${classId}/teacher-assignments/${id}`, {
      method: "DELETE",
      body: { reason },
    }),

  locations: (params: ListParams = {}) =>
    api<Paginated<TrainingLocation>>(`/admin/locations${toQuery(params)}`),
  createLocation: (body: unknown) =>
    api<TrainingLocation>("/admin/locations", { method: "POST", body }),
  updateLocation: (id: string, body: unknown) =>
    api<TrainingLocation>(`/admin/locations/${id}`, { method: "PUT", body }),
  sessions: (params: SessionListParams = {}) =>
    api<Paginated<ClassSession>>(`/admin/sessions${toQuery(params)}`),
  createSession: (body: unknown) => api<ClassSession>("/admin/sessions", { method: "POST", body }),
  updateSession: (id: string, body: unknown) =>
    api<ClassSession>(`/admin/sessions/${id}`, { method: "PUT", body }),
  completions: (params: CompletionListParams = {}) =>
    api<Paginated<CompletionCandidate>>(`/admin/completions${toQuery(params)}`),
  decideCompletion: (classId: string, studentId: string, status: string, note: string) =>
    api<CompletionDecisionResult>(`/admin/completions/${classId}/${studentId}`, {
      method: "PUT",
      body: { status, note },
    }),
  certificatePDF: (id: string) => apiDownload(`/admin/certificates/${id}/pdf`),
  revokeCertificate: (id: string, reason: string) =>
    api<Certificate>(`/admin/certificates/${id}/revoke`, { method: "POST", body: { reason } }),
  reissueCertificate: (id: string, reason: string) =>
    api<Certificate>(`/admin/certificates/${id}/reissue`, { method: "POST", body: { reason } }),
  reportSummary: () => api<ReportSummary>("/admin/reports/summary"),
  exportReport: (kind: "attendance" | "competencies" | "classes" | "completions") =>
    apiDownload(`/admin/reports/${kind}.csv`),
  studentAttendanceBreakdown: (studentId: string) =>
    api<PersonAttendanceBreakdown[]>(`/admin/students/${studentId}/attendance-breakdown`),
  studentClassAttendance: (studentId: string, classId: string) =>
    api<ClassSessionAttendanceItem[]>(`/admin/students/${studentId}/classes/${classId}/attendance`),
  studentAcademicSummary: (studentId: string) =>
    api<PersonAcademicSummary[]>(`/admin/students/${studentId}/academic-summary`),
  personAuditLogs: (kind: "student" | "teacher", id: string, params: ListParams = {}) =>
    api<Paginated<AuditLogItem>>(`/admin/${kind}s/${id}/audit-logs${toQuery(params)}`),
  updateAccountStatus: (
    kind: "student" | "teacher",
    id: string,
    accountStatus: string,
    reason: string,
  ) =>
    api<Student | Teacher>(`/admin/${kind}s/${id}/account-status`, {
      method: "PATCH",
      body: { account_status: accountStatus, reason },
    }),
  teacherWorkloadSummary: (teacherId: string) =>
    api<PersonWorkloadSummary[]>(`/admin/teachers/${teacherId}/workload-summary`),
};
