import { api, apiDownload } from "../../lib/apiClient";
import type {
  ClassSession,
  Certificate,
  Paginated,
  ProgressDashboard,
  StudentAssessment,
  StudentAttendanceHistoryItem,
  StudentAttendanceSummary,
  SessionAttendance,
  CourseTestResults,
} from "../../lib/domainTypes";
import { toQuery } from "../../lib/format";

export const studentApi = {
  schedule: (params: { page?: number; per_page?: number; from?: string; to?: string } = {}) =>
    api<Paginated<ClassSession>>(`/student/schedule${toQuery(params)}`),
  sessionAttendance: (sessionId: string) =>
    api<SessionAttendance>(`/student/sessions/${sessionId}/attendance`),
  attendance: (params: { page?: number; per_page?: number; class_id?: string } = {}) =>
    api<Paginated<StudentAttendanceHistoryItem>>(`/student/attendance${toQuery(params)}`),
  attendanceSummary: (classId?: string) =>
    api<{ items: StudentAttendanceSummary[] }>(
      `/student/attendance/summary${toQuery({ class_id: classId })}`,
    ),
  assessments: (params: { page?: number; per_page?: number; class_id?: string } = {}) =>
    api<Paginated<StudentAssessment>>(`/student/assessments${toQuery(params)}`),
  testResults: () => api<CourseTestResults[]>("/student/test-results"),
  progress: (classId?: string) =>
    api<ProgressDashboard>(`/student/progress${toQuery({ class_id: classId })}`),
  certificates: () => api<Certificate[]>("/student/certificates"),
  certificatePDF: (id: string) => apiDownload(`/student/certificates/${id}/pdf`),
};
