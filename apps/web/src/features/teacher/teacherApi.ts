import { api } from "../../lib/apiClient";
import type {
  ClassSession,
  Paginated,
  SessionAttendance,
  StudentAssessment,
  TeacherClassDetail,
  TrainingClass,
  CompetencyRating,
  CourseTestResults,
  TestAttempt,
} from "../../lib/domainTypes";
import { toQuery } from "../../lib/format";

export function normalizeCourseTestResults(result: CourseTestResults): CourseTestResults {
  return {
    ...result,
    tests: (result.tests ?? []).map((item) => ({
      ...item,
      attempts: item.attempts ?? [],
    })),
  };
}

export const teacherApi = {
  classes: () => api<TrainingClass[]>("/teacher/classes"),
  classDetail: (classId: string) => api<TeacherClassDetail>(`/teacher/classes/${classId}`),
  schedule: (
    params: {
      page?: number;
      per_page?: number;
      from?: string;
      to?: string;
      search?: string;
      status?: string;
      session_type?: string;
      attendance_state?: "locked" | "unlocked";
      class_id?: string;
      location_id?: string;
      sort_by?: string;
      sort_order?: "asc" | "desc";
    } = {},
  ) => api<Paginated<ClassSession>>(`/teacher/schedule${toQuery(params)}`),
  attendance: (sessionId: string) =>
    api<SessionAttendance>(`/teacher/sessions/${sessionId}/attendance`),
  recordAttendance: (
    sessionId: string,
    records: Array<{ student_id: string; status: string; note: string | null }>,
  ) =>
    api<{ items: unknown[]; count: number }>(`/teacher/sessions/${sessionId}/attendance`, {
      method: "POST",
      body: { records },
    }),
  assessments: (classId: string, studentId: string) =>
    api<Paginated<StudentAssessment>>(
      `/teacher/classes/${classId}/students/${studentId}/assessments?page=1&per_page=100`,
    ),
  createAssessment: (
    classId: string,
    studentId: string,
    body: {
      session_id: string | null;
      overall_comment: string | null;
      items: Array<{
        competency_criterion_id: string;
        rating: CompetencyRating;
        comment: string | null;
      }>;
    },
  ) =>
    api<StudentAssessment>(`/teacher/classes/${classId}/students/${studentId}/assessments`, {
      method: "POST",
      body,
    }),
  updateAssessment: (
    id: string,
    body: {
      session_id: string | null;
      overall_comment: string | null;
      items: Array<{
        competency_criterion_id: string;
        rating: CompetencyRating;
        comment: string | null;
      }>;
    },
  ) => api<StudentAssessment>(`/teacher/assessments/${id}`, { method: "PUT", body }),
  submitAssessment: (id: string) =>
    api<StudentAssessment>(`/teacher/assessments/${id}/submit`, { method: "POST" }),
  lockAssessment: (id: string) =>
    api<StudentAssessment>(`/teacher/assessments/${id}/lock`, { method: "POST" }),
  testResults: (classId: string, studentId: string) =>
    api<CourseTestResults>(`/teacher/classes/${classId}/students/${studentId}/test-results`).then(
      normalizeCourseTestResults,
    ),
  recordTestAttempt: (classId: string, studentId: string, testId: string, body: unknown) =>
    api<TestAttempt>(`/teacher/classes/${classId}/students/${studentId}/tests/${testId}/attempts`, {
      method: "POST",
      body,
    }),
  correctTestAttempt: (attemptId: string, body: unknown) =>
    api<TestAttempt>(`/teacher/test-attempts/${attemptId}`, { method: "PUT", body }),
};
