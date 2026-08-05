import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated, Teacher } from "../../lib/domainTypes";
import { TeachersPage } from "./AdminPages";
import { adminApi } from "./adminApi";

vi.mock("./adminApi", () => ({
  adminApi: {
    teachers: vi.fn(),
    courses: vi.fn(),
    classes: vi.fn(),
    updateTeacher: vi.fn(),
    createTeacher: vi.fn(),
  },
}));

const teacher: Teacher = {
  id: "teacher-1",
  email: "teacher@nsa.local",
  account_status: "active",
  teacher_code: "GV0001",
  full_name: "Nguyễn Văn An",
  avatar_url: "data:image/webp;base64,UklGRgQAAABXRUJQ",
  phone: "0900000000",
  specialization: "Điện ô tô",
  status: "active",
};

const emptyPage = (): Paginated<never> => ({
  items: [],
  meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
});

function renderPage() {
  vi.mocked(adminApi.teachers).mockResolvedValue({
    items: [teacher],
    meta: { page: 1, per_page: 10, total: 1, total_pages: 1 },
  });
  vi.mocked(adminApi.courses).mockResolvedValue(emptyPage());
  vi.mocked(adminApi.classes).mockResolvedValue(emptyPage());
  vi.mocked(adminApi.updateTeacher).mockResolvedValue(teacher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/giang-vien"]}>
        <TeachersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Teacher person directory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the shared identity columns in order and preserves an existing avatar on update", async () => {
    renderPage();
    await screen.findAllByText("GV0001");

    expect(screen.getAllByRole("link", { name: "GV0001" })[0]).toHaveAttribute(
      "href",
      "/admin/giang-vien/teacher-1",
    );

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers.slice(0, 4)).toEqual(["STT", "Mã", "Avatar", "Họ tên"]);
    expect(screen.getAllByRole("img", { name: "Nguyễn Văn An" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Chỉnh sửa" })[0]);
    expect(screen.getByText("Avatar giảng viên (Tự động nén WebP)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));

    await waitFor(() =>
      expect(adminApi.updateTeacher).toHaveBeenCalledWith(
        "teacher-1",
        expect.objectContaining({ avatar_url: teacher.avatar_url }),
      ),
    );
  });
});
