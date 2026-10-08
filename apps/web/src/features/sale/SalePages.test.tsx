import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadPipelinePage } from "./LeadPipelinePage";
import { OrdersPage } from "./OrdersPage";
import { saleApi } from "./saleApi";
import { SaleDashboardPage } from "./SaleDashboardPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@nsa.local", roles: ["ADMIN"] },
    token: "mock-token",
    isAuthenticated: true,
    hasRole: (...roles: string[]) => roles.includes("ADMIN"),
  }),
}));

vi.mock("./saleApi", () => ({
  saleApi: {
    getMyStats: vi.fn(),
    listTasks: vi.fn(),
    listLeads: vi.fn(),
    completeTask: vi.fn(),
    listOrders: vi.fn(),
    listStaff: vi.fn(),
    createLead: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Sale feature pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SaleDashboardPage with KPIs and task lists", async () => {
    vi.mocked(saleApi.getMyStats).mockResolvedValue({
      assigned_leads: 12,
      new_leads_today: 4,
      overdue_tasks: 1,
      today_tasks: 3,
      converted_this_month: 2,
      total_this_month: 10,
      conversion_rate: 20,
    });
    vi.mocked(saleApi.listTasks).mockResolvedValue([
      {
        id: "task-1",
        lead_id: "lead-1",
        lead_name: "Nguyễn Văn Test",
        lead_phone: "0901234567",
        assigned_to: "user-1",
        title: "Gọi điện tư vấn khóa ô tô",
        due_at: "2026-10-07T12:00:00Z",
        completed_at: null,
        created_by: "user-1",
        created_at: "2026-10-07T08:00:00Z",
        updated_at: "2026-10-07T08:00:00Z",
      },
    ]);
    vi.mocked(saleApi.listLeads).mockResolvedValue({
      items: [
        {
          id: "lead-1",
          full_name: "Nguyễn Văn Test",
          phone: "0901234567",
          email: "test@gmail.com",
          source: "facebook",
          pipeline_status: "data_moi",
          created_by: "user-1",
          created_at: "2026-10-07T08:00:00Z",
          updated_at: "2026-10-07T08:00:00Z",
        },
      ],
      meta: {
        page: 1,
        per_page: 5,
        total: 1,
        total_pages: 1,
      },
    });

    renderWithClient(<SaleDashboardPage />);

    expect(screen.getByText("Tổng quan Tuyển sinh")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("Gọi điện tư vấn khóa ô tô")).toBeInTheDocument();
      expect(screen.getByText("Nguyễn Văn Test")).toBeInTheDocument();
    });
  });

  it("renders OrdersPage with filters and table data", async () => {
    vi.mocked(saleApi.listOrders).mockResolvedValue({
      items: [
        {
          id: "order-1",
          order_code: "ORD-20261007-0001",
          amount: 15000000,
          discount_amount: 1000000,
          final_amount: 14000000,
          status: "pending",
          course_name: "Kỹ thuật ô tô",
          class_code: "OTO-K01",
          student_name: "Trần Học Viên",
          student_code: "HV001",
          created_by: "user-1",
          created_at: "2026-10-07T09:00:00Z",
          updated_at: "2026-10-07T09:00:00Z",
        },
      ],
      meta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      },
    });

    renderWithClient(<OrdersPage />);

    expect(screen.getByText("Quản lý Đơn hàng & Phiếu thu")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("ORD-20261007-0001")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Trần Học Viên")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Kỹ thuật ô tô")[0]).toBeInTheDocument();
    });
  });

  it("renders LeadPipelinePage with search and lead listing", async () => {
    vi.mocked(saleApi.listStaff).mockResolvedValue([{ id: "staff-1", email: "sale1@nsa.local" }]);
    vi.mocked(saleApi.listLeads).mockResolvedValue({
      items: [
        {
          id: "lead-2",
          full_name: "Lê Minh Lead",
          phone: "0988776655",
          email: "leminh@gmail.com",
          source: "zalo",
          pipeline_status: "follow",
          created_by: "user-1",
          created_at: "2026-10-07T08:00:00Z",
          updated_at: "2026-10-07T08:00:00Z",
        },
      ],
      meta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      },
    });

    renderWithClient(<LeadPipelinePage />);

    expect(screen.getByText("Quản lý Lead Tuyển sinh")).toBeInTheDocument();
    expect(screen.getByText("Nhập từ Excel/CSV")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Lê Minh Lead")[0]).toBeInTheDocument();
      expect(screen.getAllByText("0988776655")[0]).toBeInTheDocument();
    });
  });
});
