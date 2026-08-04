import type { AttendanceStatus } from "../../lib/domainTypes";

export type RollCallStatus = Extract<AttendanceStatus, "present" | "absent">;

export const rollCallOptions: Array<{
  value: RollCallStatus;
  label: string;
  active: string;
  idle: string;
}> = [
  {
    value: "present",
    label: "Có mặt",
    active: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
  },
  {
    value: "absent",
    label: "Vắng",
    active: "border-red-600 bg-red-600 text-white shadow-sm",
    idle: "border-red-200 bg-red-50 text-red-700 hover:border-red-400",
  },
];

export function projectAttendanceStatus(
  status: AttendanceStatus | null | undefined,
): RollCallStatus {
  return status === "present" || status === "late" ? "present" : "absent";
}

export function attendanceStatusForSave(
  original: AttendanceStatus | null | undefined,
  selected: RollCallStatus,
): AttendanceStatus {
  if (
    (original === "late" || original === "excused") &&
    projectAttendanceStatus(original) === selected
  ) {
    return original;
  }
  return selected;
}

export function legacyAttendanceLabel(status: AttendanceStatus | null | undefined) {
  if (status === "late") return "Dữ liệu cũ: Đi trễ";
  if (status === "excused") return "Dữ liệu cũ: Vắng có phép";
  return null;
}

export function studentInitials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase("vi"))
    .join("");
}
