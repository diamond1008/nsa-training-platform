import { api } from "../../lib/apiClient";
import type { AttendanceRecord, SessionAttendance } from "../../lib/domainTypes";

export interface AttendanceCorrectionPayload {
  status: "present" | "absent" | "late" | "excused";
  note?: string | null;
  reason: string;
}

export const adminAttendanceApi = {
  getSessionAttendance: (sessionId: string) =>
    api<SessionAttendance>(`/admin/sessions/${sessionId}/attendance`),

  correctAttendance: (attendanceId: string, payload: AttendanceCorrectionPayload) =>
    api<AttendanceRecord>(`/admin/attendance/${attendanceId}`, {
      method: "PUT",
      body: payload,
    }),

  correctStudentAttendance: (
    sessionId: string,
    studentId: string,
    payload: AttendanceCorrectionPayload,
  ) =>
    api<AttendanceRecord>(`/admin/sessions/${sessionId}/students/${studentId}/attendance`, {
      method: "POST",
      body: payload,
    }),
};
