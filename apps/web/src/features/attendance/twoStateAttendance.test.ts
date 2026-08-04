import { describe, expect, it } from "vitest";

import {
  attendanceStatusForSave,
  legacyAttendanceLabel,
  projectAttendanceStatus,
} from "./twoStateAttendance";

describe("two-state attendance projection", () => {
  it.each([
    ["present", "present"],
    ["late", "present"],
    ["absent", "absent"],
    ["excused", "absent"],
    [null, "absent"],
  ] as const)("projects %s to %s", (source, expected) => {
    expect(projectAttendanceStatus(source)).toBe(expected);
  });

  it("preserves unchanged legacy values and exposes their historical labels", () => {
    expect(attendanceStatusForSave("late", "present")).toBe("late");
    expect(attendanceStatusForSave("excused", "absent")).toBe("excused");
    expect(legacyAttendanceLabel("late")).toBe("Dữ liệu cũ: Đi trễ");
    expect(legacyAttendanceLabel("excused")).toBe("Dữ liệu cũ: Vắng có phép");
  });

  it("replaces a legacy value only after an explicit opposite selection", () => {
    expect(attendanceStatusForSave("late", "absent")).toBe("absent");
    expect(attendanceStatusForSave("excused", "present")).toBe("present");
  });
});
