import { api, apiCSV, apiDownload } from "../../lib/apiClient";
import type {
  AttendanceStatus,
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
  SessionAttendance,
  Student,
  StudentStatusHistory,
  Teacher,
  TeacherAssignment,
  TrainingClass,
  TrainingLocation,
} from "../../lib/domainTypes";
import { toQuery } from "../../lib/format";

export interface ListParams {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface StudentImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; email?: string; message: string }>;
}

export const adminApi = {
  students: (params: ListParams = {}) =>
    api<Paginated<Student>>(`/admin/students${toQuery(params)}`),
  createStudent: (body: unknown) => api<Student>("/admin/students", { method: "POST", body }),
  updateStudent: (id: string, body: unknown) =>
    api<Student>(`/admin/students/${id}`, { method: "PUT", body }),
  studentStatusHistory: (id: string) =>
    api<StudentStatusHistory[]>(`/admin/students/${id}/status-history`),
  exportStudents: (params: Pick<ListParams, "search" | "status"> = {}) =>
    apiDownload(`/admin/students/export${toQuery(params)}`),
  importStudents: (csv: string) => apiCSV<StudentImportResult>("/admin/students/import", csv),

  teachers: (params: ListParams = {}) =>
    api<Paginated<Teacher>>(`/admin/teachers${toQuery(params)}`),
  createTeacher: (body: unknown) => api<Teacher>("/admin/teachers", { method: "POST", body }),
  updateTeacher: (id: string, body: unknown) =>
    api<Teacher>(`/admin/teachers/${id}`, { method: "PUT", body }),

  courses: (params: ListParams = {}) => api<Paginated<Course>>(`/admin/courses${toQuery(params)}`),
  createCourse: (body: unknown) => api<Course>("/admin/courses", { method: "POST", body }),
  updateCourse: (id: string, body: unknown) =>
    api<Course>(`/admin/courses/${id}`, { method: "PUT", body }),
  courseTests: (courseId: string) => api<CourseTest[]>(`/admin/courses/${courseId}/tests`),
  createCourseTest: (courseId: string, body: unknown) =>
    api<CourseTest>(`/admin/courses/${courseId}/tests`, { method: "POST", body }),
  updateCourseTest: (courseId: string, testId: string, body: unknown) =>
    api<CourseTest>(`/admin/courses/${courseId}/tests/${testId}`, { method: "PUT", body }),

  classes: (params: ListParams & { course_id?: string } = {}) =>
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
  updateEnrollment: (classId: string, id: string, status: string, reason: string) =>
    api<Enrollment>(`/admin/classes/${classId}/enrollments/${id}`, {
      method: "PUT",
      body: { status, reason },
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
  sessions: (params: ListParams & { from?: string; to?: string; class_id?: string } = {}) =>
    api<Paginated<ClassSession>>(`/admin/sessions${toQuery(params)}`),
  sessionAttendance: (sessionId: string) =>
    api<SessionAttendance>(`/admin/sessions/${sessionId}/attendance`),
  correctAttendance: (
    attendanceId: string,
    body: { status: AttendanceStatus; note: string | null; reason: string },
  ) => api(`/admin/attendance/${attendanceId}`, { method: "PUT", body }),
  createSession: (body: unknown) => api<ClassSession>("/admin/sessions", { method: "POST", body }),
  updateSession: (id: string, body: unknown) =>
    api<ClassSession>(`/admin/sessions/${id}`, { method: "PUT", body }),
  completions: (params: ListParams = {}) =>
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
};
