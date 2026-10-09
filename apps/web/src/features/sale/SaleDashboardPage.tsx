import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";

import { QueryState, StatCard } from "../../components/data";
import { Icon } from "../../components/icons";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { Lead } from "../../lib/domainTypes";
import { formatDate, formatDateTime } from "../../lib/format";
import { saleApi } from "./saleApi";
import { formatVND, LeadPipelineBadge } from "./saleShared";

export function SaleDashboardPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isSaleAdmin = hasRole("ADMIN", "SALE_ADMIN");

  const statsQuery = useQuery({
    queryKey: ["sale", "dashboard", "my-stats"],
    queryFn: () => saleApi.getMyStats(),
  });

  const tasksQuery = useQuery({
    queryKey: ["sale", "tasks", "pending"],
    queryFn: () => saleApi.listTasks({ status: "pending" }),
  });

  const leadsQuery = useQuery({
    queryKey: ["sale", "leads", "recent"],
    queryFn: () =>
      saleApi.listLeads({
        page: 1,
        per_page: 5,
        sort_by: "created_at",
        sort_order: "desc",
      }),
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => saleApi.completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sale", "dashboard", "my-stats"] });
    },
  });

  const stats = statsQuery.data;
  const tasks = tasksQuery.data ?? [];
  const recentLeads = leadsQuery.data?.items ?? [];

  const monthRevenue = isSaleAdmin ? (stats?.team_month_revenue ?? 0) : (stats?.month_revenue ?? 0);
  const revenueLabel = isSaleAdmin ? "Doanh số phòng Sale tháng" : "Doanh số cá nhân tháng";
  const revenueHint = isSaleAdmin
    ? "Tổng tiền toàn phòng chốt trong tháng"
    : "Tổng tiền bạn đã chốt trong tháng";

  const now = new Date();
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan Tuyển sinh"
        eyebrow="Bàn làm việc Tư vấn"
        subtitle="Theo dõi tiến độ chăm sóc khách hàng, nhắc việc hôm nay và các Lead mới được giao."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/sale/leads">
              <Button variant="primary">
                <Icon name="users" className="h-4 w-4" />
                Danh sách Lead
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats Cards */}
      <QueryState loading={statsQuery.isLoading} error={statsQuery.error} empty={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={revenueLabel}
            value={formatVND(monthRevenue)}
            hint={revenueHint}
            icon="shopping-bag"
            tone="green"
          />
          <StatCard
            label="Số lượng chốt trong tháng"
            value={stats?.converted_this_month ?? 0}
            hint={`${stats?.converted_this_month ?? 0} Lead đã đăng ký thành công`}
            icon="award"
            tone="navy"
          />
          <StatCard
            label="Lead được gán"
            value={stats?.assigned_leads ?? 0}
            hint="Tổng số Lead đang phụ trách"
            icon="users"
            tone="blue"
          />
          <StatCard
            label="Lead mới hôm nay"
            value={stats?.new_leads_today ?? 0}
            hint="Cần liên hệ sớm"
            icon="clock"
            tone="blue"
          />
        </div>
      </QueryState>

      {/* Two Column Layout: Tasks & Recent Leads */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Tasks Today & Overdue (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-heading">Nhắc việc cần xử lý</h2>
                <p className="text-xs text-gtext">
                  Các cuộc hẹn, lịch gọi lại và công việc chưa hoàn tất
                </p>
              </div>
              <Badge tone="navy">{sortedTasks.length} việc</Badge>
            </div>

            <QueryState
              loading={tasksQuery.isLoading}
              error={tasksQuery.error}
              empty={sortedTasks.length === 0}
              emptyTitle="Không có việc cần xử lý"
            >
              <div className="divide-y divide-gborder/70 overflow-hidden rounded-xl border border-gborder/70 bg-white">
                {sortedTasks.map((task) => {
                  const dueDate = new Date(task.due_at);
                  const isOverdue = dueDate < now;
                  const isToday = dueDate.toDateString() === now.toDateString();

                  return (
                    <div
                      key={task.id}
                      className={clsx(
                        "flex flex-col gap-2 p-3.5 transition sm:flex-row sm:items-center sm:justify-between",
                        isOverdue && "bg-rose-50/50 hover:bg-rose-50",
                        isToday && !isOverdue && "bg-amber-50/40 hover:bg-amber-50",
                        !isOverdue && !isToday && "hover:bg-gbg/60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-navy text-sm">{task.title}</span>
                          {isOverdue && <Badge tone="red">Quá hạn</Badge>}
                          {isToday && !isOverdue && <Badge tone="gold">Hôm nay</Badge>}
                        </div>
                        {task.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gtext">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gtext">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="clock" className="h-3.5 w-3.5 text-gtext/80" />
                            {formatDateTime(task.due_at)}
                          </span>
                          {task.lead_name && (
                            <Link
                              to={`/sale/leads/${task.lead_id}`}
                              className="font-medium text-navy hover:text-[#0532e6] hover:underline"
                            >
                              Lead: {task.lead_name}
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                        <Button
                          variant="ghost"
                          className="h-8 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          loading={
                            completeTaskMutation.isPending &&
                            completeTaskMutation.variables === task.id
                          }
                          onClick={() => completeTaskMutation.mutate(task.id)}
                        >
                          <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />
                          Hoàn thành
                        </Button>
                        <Link to={`/sale/leads/${task.lead_id}`}>
                          <Button variant="soft" className="h-8 px-2 text-xs">
                            <Icon name="chevron-right" className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </QueryState>
          </Card>
        </div>

        {/* Right Column: Recent Leads (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-heading">Lead mới nhất</h2>
                <p className="text-xs text-gtext">Danh sách Lead được giao gần đây</p>
              </div>
              <Link
                to="/sale/leads"
                className="text-xs font-semibold text-navy hover:text-[#0532e6] hover:underline"
              >
                Xem tất cả →
              </Link>
            </div>

            <QueryState
              loading={leadsQuery.isLoading}
              error={leadsQuery.error}
              empty={recentLeads.length === 0}
              emptyTitle="Chưa có Lead nào"
            >
              <div className="divide-y divide-gborder/70 rounded-xl border border-gborder/70 bg-white">
                {recentLeads.map((lead: Lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3.5 transition hover:bg-gbg/60"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <Link
                        to={`/sale/leads/${lead.id}`}
                        className="block font-semibold text-navy text-sm hover:text-[#0532e6] hover:underline truncate"
                      >
                        {lead.full_name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gtext">
                        <span>{lead.phone || "Chưa có SĐT"}</span>
                        <span>•</span>
                        <span>{formatDate(lead.created_at)}</span>
                      </div>
                      {lead.interested_course_name && (
                        <p className="mt-1 line-clamp-1 text-xs text-navy/80">
                          Khóa: {lead.interested_course_name}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <LeadPipelineBadge status={lead.pipeline_status} />
                      <Link to={`/sale/leads/${lead.id}`}>
                        <Button variant="ghost" className="h-7 px-2 text-xs">
                          Xem chi tiết
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </QueryState>
          </Card>
        </div>
      </div>
    </div>
  );
}
