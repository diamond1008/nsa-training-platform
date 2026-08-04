import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassSession, SessionAttendance } from "../../lib/domainTypes";
import { TeacherAttendancePage } from "./TeacherAttendancePage";
import { teacherApi } from "./teacherApi";

vi.mock("./teacherApi", () => ({
  teacherApi: {
    schedule: vi.fn(),
    attendance: vi.fn(),
    recordAttendance: vi.fn(),
  },
}));

const session: ClassSession = {
  id: "session-1",
  class_id: "class-1",
  class_code: "KT000001",
  class_name: "Kỹ thuật điện",
  course_id: "course-1",
  course_code: "KT01",
  course_name: "Kỹ thuật điện",
  teacher_id: "teacher-1",
  teacher_code: "GV001",
  teacher_name: "Nguyễn Văn An",
  location_id: "room-1",
  location_code: "X01",
  location_name: "Xưởng 01",
  title: "Thực hành an toàn điện",
  session_type: "workshop",
  starts_at: "2026-08-04T01:00:00.000Z",
  ends_at: "2026-08-04T05:00:00.000Z",
  status: "scheduled",
  attendance_locked_at: null,
};

const roster: SessionAttendance = {
  session,
  summary: {
    total: 2,
    recorded: 1,
    unrecorded: 1,
    present: 1,
    late: 0,
    excused: 0,
    absent: 0,
  },
  items: [
    {
      student_id: "student-1",
      student_code: "KT000001",
      full_name: "Trần Minh Bình",
      enrollment_status: "active",
      attendance_id: null,
      attendance_status: null,
      note: null,
    },
    {
      student_id: "student-2",
      student_code: "KT000002",
      full_name: "Lê Thu Hà",
      enrollment_status: "active",
      attendance_id: "attendance-2",
      attendance_status: "present",
      note: "",
    },
  ],
};

function renderPage(data: SessionAttendance = roster) {
  vi.mocked(teacherApi.schedule).mockResolvedValue({
    items: [data.session],
    meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
  });
  vi.mocked(teacherApi.attendance).mockResolvedValue(data);
  vi.mocked(teacherApi.recordAttendance).mockResolvedValue({ items: [], count: 2 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/teacher/diem-danh?session=session-1"]}>
        <TeacherAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TeacherAttendancePage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-04T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows a two-state column layout and defaults unrecorded learners to absent", async () => {
    renderPage();

    const row = (await screen.findByText("Trần Minh Bình")).closest("tr")!;
    const note = within(row).getByRole("textbox", { name: "Ghi chú cho Trần Minh Bình" });
    expect(note).toBeEnabled();
    expect(screen.getByRole("columnheader", { name: "Mã học viên" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Avatar" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tên học viên" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Trạng thái & Điều chỉnh" }),
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Có mặt" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(row).getByRole("button", { name: "Vắng" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row).queryByRole("button", { name: "Đi trễ" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Vắng có phép" })).not.toBeInTheDocument();
    expect(screen.getByText("1 thay đổi chưa lưu")).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Có mặt" }));
    fireEvent.click(screen.getByRole("button", { name: /Lưu 1 thay đổi/i }));
    await waitFor(() =>
      expect(teacherApi.recordAttendance).toHaveBeenCalledWith(
        "session-1",
        expect.arrayContaining([
          expect.objectContaining({ student_id: "student-1", status: "present" }),
        ]),
      ),
    );
  });

  it("saves the default absent state when the teacher does not mark presence", async () => {
    renderPage();
    await screen.findByText("Trần Minh Bình");

    fireEvent.click(screen.getByRole("button", { name: /Lưu 1 thay đổi/i }));
    await waitFor(() =>
      expect(teacherApi.recordAttendance).toHaveBeenCalledWith("session-1", [
        expect.objectContaining({ student_id: "student-1", status: "absent" }),
      ]),
    );
  });

  it("requires confirmation before marking everyone absent", async () => {
    renderPage();
    await screen.findByText("Trần Minh Bình");

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu tất cả Vắng" }));
    expect(screen.getByRole("dialog", { name: "Xác nhận vắng toàn bộ" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đánh dấu Vắng" }));
    expect(screen.getByText("2 thay đổi chưa lưu")).toBeInTheDocument();
  });

  it("is read-only after attendance is locked", async () => {
    renderPage({
      ...roster,
      session: { ...session, status: "locked", attendance_locked_at: "2026-08-05T00:00:00Z" },
    });

    const row = (await screen.findByText("Trần Minh Bình")).closest("tr")!;
    expect(within(row).getByRole("button", { name: "Có mặt" })).toBeDisabled();
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lưu .* thay đổi/i })).not.toBeInTheDocument();
  });
});
