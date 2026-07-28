import { api } from "../../lib/apiClient";
import type {
  ClassSession, Course, Enrollment, Paginated, Student, Teacher, TeacherAssignment,
  TrainingClass, TrainingLocation,
} from "../../lib/domainTypes";
import { toQuery } from "../../lib/format";

export interface ListParams { search?: string; status?: string; page?: number; per_page?: number }

export const adminApi = {
  students: (params: ListParams = {}) => api<Paginated<Student>>(`/admin/students${toQuery(params)}`),
  createStudent: (body: unknown) => api<Student>("/admin/students", { method: "POST", body }),
  updateStudent: (id: string, body: unknown) => api<Student>(`/admin/students/${id}`, { method: "PUT", body }),

  teachers: (params: ListParams = {}) => api<Paginated<Teacher>>(`/admin/teachers${toQuery(params)}`),
  createTeacher: (body: unknown) => api<Teacher>("/admin/teachers", { method: "POST", body }),
  updateTeacher: (id: string, body: unknown) => api<Teacher>(`/admin/teachers/${id}`, { method: "PUT", body }),

  courses: (params: ListParams = {}) => api<Paginated<Course>>(`/admin/courses${toQuery(params)}`),
  createCourse: (body: unknown) => api<Course>("/admin/courses", { method: "POST", body }),
  updateCourse: (id: string, body: unknown) => api<Course>(`/admin/courses/${id}`, { method: "PUT", body }),

  classes: (params: ListParams & { course_id?: string } = {}) => api<Paginated<TrainingClass>>(`/admin/classes${toQuery(params)}`),
  getClass: (id: string) => api<TrainingClass>(`/admin/classes/${id}`),
  createClass: (body: unknown) => api<TrainingClass>("/admin/classes", { method: "POST", body }),
  updateClass: (id: string, body: unknown) => api<TrainingClass>(`/admin/classes/${id}`, { method: "PUT", body }),
  enrollments: (classId: string) => api<Enrollment[]>(`/admin/classes/${classId}/enrollments`),
  enroll: (classId: string, studentId: string) => api<Enrollment>(`/admin/classes/${classId}/enrollments`, { method: "POST", body: { student_id: studentId } }),
  updateEnrollment: (classId: string, id: string, status: string) => api<Enrollment>(`/admin/classes/${classId}/enrollments/${id}`, { method: "PUT", body: { status } }),
  assignments: (classId: string) => api<TeacherAssignment[]>(`/admin/classes/${classId}/teacher-assignments`),
  assign: (classId: string, teacherId: string, assignmentRole: string) => api<TeacherAssignment>(`/admin/classes/${classId}/teacher-assignments`, { method: "POST", body: { teacher_id: teacherId, assignment_role: assignmentRole } }),
  removeAssignment: (classId: string, id: string) => api<{ message: string }>(`/admin/classes/${classId}/teacher-assignments/${id}`, { method: "DELETE" }),

  locations: (params: ListParams = {}) => api<Paginated<TrainingLocation>>(`/admin/locations${toQuery(params)}`),
  createLocation: (body: unknown) => api<TrainingLocation>("/admin/locations", { method: "POST", body }),
  sessions: (params: ListParams & { from?: string; to?: string; class_id?: string } = {}) => api<Paginated<ClassSession>>(`/admin/sessions${toQuery(params)}`),
  createSession: (body: unknown) => api<ClassSession>("/admin/sessions", { method: "POST", body }),
};
