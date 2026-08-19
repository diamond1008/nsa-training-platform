import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PersonProfilePage } from "./PersonProfilePage";
import { adminApi } from "./adminApi";

vi.mock("./adminApi", () => ({
  adminApi: {
    studentProfileSummary: vi.fn(),
    studentClassHistory: vi.fn(),
    studentSchedule: vi.fn(),
    teacherProfileSummary: vi.fn(),
    teacherClassHistory: vi.fn(),
    sessions: vi.fn(),
  },
}));

describe("PersonProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.studentProfileSummary).mockResolvedValue({
      profile: {
        id: "student-1",
        email: "student@nsa.local",
        account_status: "active",
        student_code: "KT000001",
        full_name: "Nguyễn Văn An",
        status: "active",
      },
      current_classes: 1,
      total_classes: 2,
      attendance_risk_classes: 0,
      upcoming_sessions: 3,
    });
    vi.mocked(adminApi.studentClassHistory).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 50, total: 0, total_pages: 0 },
    });
    vi.mocked(adminApi.studentSchedule).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
    });
    vi.mocked(adminApi.teacherProfileSummary).mockResolvedValue({
      profile: {
        id: "teacher-1",
        email: "teacher@nsa.local",
        account_status: "active",
        teacher_code: "GV000001",
        full_name: "Trần Minh Tâm",
        specialization: "Kỹ thuật ô tô",
        status: "active",
      },
      current_classes: 2,
      total_classes: 5,
      completed_sessions: 12,
      upcoming_sessions: 4,
    });
    vi.mocked(adminApi.teacherClassHistory).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 50, total: 0, total_pages: 0 },
    });
    vi.mocked(adminApi.sessions).mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 100, total: 0, total_pages: 0 },
    });
  });

  it("shows the core profile and exposes history and personal schedule tabs", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/admin/hoc-vien/student-1"]}>
          <Routes>
            <Route
              path="/admin/hoc-vien/:personId"
              element={<PersonProfilePage kind="student" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("Nguyễn Văn An")).not.toHaveLength(0);
    expect(screen.getByText("KT000001")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lớp hiện tại & lịch sử" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Lịch cá nhân" }));
    expect(await screen.findByRole("button", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuần trước" })).toBeInTheDocument();
  });

  it("renders a teacher profile with role-specific metrics", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/admin/giang-vien/teacher-1"]}>
          <Routes>
            <Route
              path="/admin/giang-vien/:personId"
              element={<PersonProfilePage kind="teacher" />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("GV000001")).toBeInTheDocument();
    expect(screen.getByText("Buổi đã giảng dạy")).toBeInTheDocument();
    expect(screen.getByText("Kỹ thuật ô tô")).toBeInTheDocument();
  });
});
