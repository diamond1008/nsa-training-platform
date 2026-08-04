import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassSession, SessionAttendance } from "../../lib/domainTypes";
import { AdminAttendancePage } from "./AdminAttendancePage";
import { adminApi } from "./adminApi";
import { adminAttendanceApi } from "./adminAttendanceApi";

vi.mock("./adminApi", () => ({
  adminApi: { sessions: vi.fn(), classHistory: vi.fn() },
}));

vi.mock("./adminAttendanceApi", () => ({
  adminAttendanceApi: {
    getSessionAttendance: vi.fn(),
    correctAttendance: vi.fn(),
    correctStudentAttendance: vi.fn(),
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
  status: "locked",
  attendance_locked_at: "2026-08-05T00:00:00Z",
};

const roster: SessionAttendance = {
  session,
  summary: { total: 2, recorded: 1, unrecorded: 1, present: 1, late: 0, excused: 0, absent: 0 },
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

function renderPage() {
  vi.mocked(adminApi.sessions).mockResolvedValue({
    items: [session],
    meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
  });
  vi.mocked(adminApi.classHistory).mockResolvedValue([]);
  vi.mocked(adminAttendanceApi.getSessionAttendance).mockResolvedValue(roster);
  vi.mocked(adminAttendanceApi.correctAttendance).mockResolvedValue({
    id: "attendance-2",
    class_session_id: session.id,
    class_id: session.class_id,
    student_id: "student-2",
    status: "late",
    recorded_by: "admin-1",
    recorded_at: session.starts_at,
    updated_at: session.starts_at,
  });
  vi.mocked(adminAttendanceApi.correctStudentAttendance).mockResolvedValue({
    id: "attendance-1",
    class_session_id: session.id,
    class_id: session.class_id,
    student_id: "student-1",
    status: "excused",
    recorded_by: "admin-1",
    recorded_at: session.starts_at,
    updated_at: session.starts_at,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/diem-danh?session=session-1"]}>
        <AdminAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminAttendancePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers four roster filters and a two-state column layout", async () => {
    renderPage();
    const row = (await screen.findByText("Trần Minh Bình")).closest("tr")!;
    const filters = within(screen.getByLabelText("Lọc danh sách điểm danh"));

    for (const label of ["Tất cả", "Chưa ghi", "Có mặt", "Vắng"]) {
      expect(
        filters.getByRole("button", { name: new RegExp(`^${label}: \\d+$`) }),
      ).toBeInTheDocument();
    }
    expect(filters.queryByRole("button", { name: /^Đi trễ:/ })).not.toBeInTheDocument();
    expect(filters.queryByRole("button", { name: /^Vắng có phép:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Mã học viên" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Avatar" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tên học viên" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Trạng thái & Điều chỉnh" }),
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Vắng" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row).queryByRole("button", { name: "Đi trễ" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Vắng có phép" })).not.toBeInTheDocument();
  });

  it("prevents no-op corrections and requires a reason", async () => {
    renderPage();
    const row = (await screen.findByText("Lê Thu Hà")).closest("tr")!;
    expect(within(row).getByRole("button", { name: "Có mặt" })).toBeDisabled();

    fireEvent.click(within(row).getByRole("button", { name: "Vắng" }));
    const dialog = within(screen.getByRole("dialog", { name: "Xác nhận hiệu chỉnh" }));
    expect(dialog.getByText("Có mặt")).toBeInTheDocument();
    expect(dialog.getByText("Vắng")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Lưu hiệu chỉnh" })).toBeDisabled();
  });

  it("creates an audited record for a previously unrecorded student", async () => {
    renderPage();
    const row = (await screen.findByText("Trần Minh Bình")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Vắng" }));
    fireEvent.change(screen.getByLabelText("Lý do hiệu chỉnh"), {
      target: { value: "Học viên có đơn xin phép" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hiệu chỉnh" }));

    await waitFor(() =>
      expect(adminAttendanceApi.correctStudentAttendance).toHaveBeenCalledWith(
        "session-1",
        "student-1",
        expect.objectContaining({ status: "absent", reason: "Học viên có đơn xin phép" }),
      ),
    );
  });
});
