import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AttendanceRoster, DataTable, Pagination, StatusBadge } from "./data";
import { ProgressBar } from "./ui";

describe("Phase 9 shared data components", () => {
  it("clamps progress values for accessible rendering", () => {
    render(<ProgressBar value={125} label="Tiến độ" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders localized status text", () => {
    render(<StatusBadge value="completed" />);
    expect(screen.getByText("Đã hoàn thành")).toBeInTheDocument();
  });

  it("moves to the requested page", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} onPage={onPage} />);
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("renders recorded and unrecorded classmates", () => {
    const onCorrect = vi.fn();
    render(
      <AttendanceRoster
        onCorrect={onCorrect}
        data={{
          session: {
            id: "session-1",
            class_id: "class-1",
            class_code: "SE1801",
            class_name: "SE1801",
            course_id: "course-1",
            course_code: "NSA",
            course_name: "NSA",
            title: "Lý thuyết",
            session_type: "theory",
            starts_at: "2026-07-28T06:00:00Z",
            ends_at: "2026-07-28T07:00:00Z",
            status: "scheduled",
          },
          items: [
            {
              student_id: "student-1",
              student_code: "HV001",
              full_name: "Nguyễn An",
              enrollment_status: "enrolled",
              attendance_id: "attendance-1",
              attendance_status: "present",
            },
            {
              student_id: "student-2",
              student_code: "HV002",
              full_name: "Trần Bình",
              enrollment_status: "enrolled",
            },
          ],
          summary: {
            total: 2,
            recorded: 1,
            unrecorded: 1,
            present: 1,
            absent: 0,
            late: 0,
            excused: 0,
          },
        }}
      />,
    );
    expect(screen.getByText(/Nguyễn An/)).toBeInTheDocument();
    expect(screen.getByText("Có mặt", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Chưa ghi nhận")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hiệu chỉnh" }));
    expect(onCorrect).toHaveBeenCalledWith(expect.objectContaining({ student_id: "student-1" }));
  });

  it("reports sortable column requests through semantic header buttons", () => {
    const onSort = vi.fn();
    render(
      <DataTable
        items={[{ id: "1", name: "Nguyễn An" }]}
        sort={{ key: "name", order: "asc" }}
        onSort={onSort}
        columns={[{ header: "Họ tên", sortKey: "name", cell: (item) => item.name }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp theo Họ tên" }));
    expect(onSort).toHaveBeenCalledWith("name", "desc");
    expect(screen.getByRole("columnheader", { name: /Họ tên/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
});
