import { useQuery } from "@tanstack/react-query";

import { QueryState, StatCard } from "../../components/data";
import { Card, PageHeader } from "../../components/ui";
import { saleApi } from "./saleApi";
import {
  formatVND,
  getSourceLabel,
  LeadPipelineBadge,
  PIPELINE_STATUS_OPTIONS,
} from "./saleShared";

export function SaleReportsPage() {
  const overviewQuery = useQuery({
    queryKey: ["sale", "dashboard", "overview"],
    queryFn: () => saleApi.getOverview(),
  });

  const revenueQuery = useQuery({
    queryKey: ["sale", "dashboard", "revenue"],
    queryFn: () => saleApi.getRevenueReport(),
  });

  const overview = overviewQuery.data;
  const revenue = revenueQuery.data;

  const summary = revenue?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo & Hiệu suất Tuyển sinh"
        eyebrow="Quản trị Doanh thu & Đội ngũ"
        subtitle="Thống kê tổng quan chuyển đổi Lead, doanh thu học phí theo tháng và hiệu suất làm việc của đội ngũ Sale."
      />

      {/* Summary KPI Cards */}
      <QueryState loading={revenueQuery.isLoading} error={revenueQuery.error} empty={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Doanh thu tháng này"
            value={formatVND(summary?.month_revenue ?? 0)}
            hint="Doanh thu từ các đơn đã thanh toán"
            icon="award"
            tone="green"
          />
          <StatCard
            label="Tổng doanh thu tích lũy"
            value={formatVND(summary?.total_revenue ?? 0)}
            hint="Toàn bộ doanh thu từ trước đến nay"
            icon="award"
            tone="brand"
          />
          <StatCard
            label="Đơn hàng tháng này"
            value={summary?.month_orders ?? 0}
            hint={`Đã thanh toán: ${summary?.month_paid_orders ?? 0} đơn`}
            icon="calendar"
            tone="navy"
          />
          <StatCard
            label="Tỷ lệ thanh toán tháng"
            value={
              summary?.month_orders
                ? `${Math.round(((summary.month_paid_orders ?? 0) / summary.month_orders) * 100)}%`
                : "100%"
            }
            hint="Tỷ lệ hoàn tất thanh toán"
            icon="clock"
            tone="blue"
          />
        </div>
      </QueryState>

      {/* Grid: Sale Performance & Pipeline Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Table: Performance by Sale Staff (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-heading">
                  Hiệu suất tư vấn theo Nhân viên
                </h2>
                <p className="text-xs text-gtext">
                  Số Lead được giao và tỷ lệ chuyển đổi thành công
                </p>
              </div>
            </div>

            <QueryState
              loading={overviewQuery.isLoading}
              error={overviewQuery.error}
              empty={!overview?.by_assignee || overview.by_assignee.length === 0}
              emptyTitle="Chưa có dữ liệu nhân viên"
            >
              <div className="overflow-x-auto rounded-xl border border-gborder/70">
                <table className="min-w-full divide-y divide-gborder text-left text-xs">
                  <thead className="bg-gbg2 text-[11px] font-bold uppercase tracking-wider text-gtext">
                    <tr>
                      <th className="px-4 py-3">Nhân viên Sale</th>
                      <th className="px-3 py-3 text-right">Lead được gán</th>
                      <th className="px-3 py-3 text-right">Đã chốt</th>
                      <th className="px-4 py-3 text-right">Tỷ lệ chốt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gborder/50 bg-white">
                    {overview?.by_assignee.map(
                      (staff: {
                        user_id: string;
                        email: string;
                        total_leads: number;
                        converted_leads: number;
                      }) => {
                        const rate =
                          staff.total_leads > 0
                            ? Math.round((staff.converted_leads / staff.total_leads) * 100)
                            : 0;

                        return (
                          <tr key={staff.user_id} className="hover:bg-gbg/40">
                            <td className="px-4 py-3 font-medium text-navy">{staff.email}</td>
                            <td className="px-3 py-3 text-right font-medium text-gtext tabular-nums">
                              {staff.total_leads}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                              {staff.converted_leads}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-navy tabular-nums">
                              {rate}%
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </Card>
        </div>

        {/* Status Distribution (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-navy-heading">
                Phân bổ Lead theo Trạng thái
              </h2>
              <p className="text-xs text-gtext">
                Tổng hợp số lượng khách hàng theo từng giai đoạn phễu
              </p>
            </div>

            <QueryState
              loading={overviewQuery.isLoading}
              error={overviewQuery.error}
              empty={!overview?.by_status}
              emptyTitle="Chưa có dữ liệu trạng thái"
            >
              <div className="space-y-2.5">
                {PIPELINE_STATUS_OPTIONS.map((opt) => {
                  const count = overview?.by_status[opt.value] ?? 0;
                  return (
                    <div
                      key={opt.value}
                      className="flex items-center justify-between rounded-xl bg-gbg/40 px-3.5 py-2.5 transition hover:bg-gbg"
                    >
                      <LeadPipelineBadge status={opt.value} />
                      <span className="text-sm font-bold text-navy tabular-nums">{count} Lead</span>
                    </div>
                  );
                })}
              </div>
            </QueryState>
          </Card>
        </div>
      </div>

      {/* Monthly Revenue & Revenue by Source */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Revenue (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-navy-heading">Doanh thu theo Tháng</h2>
              <p className="text-xs text-gtext">
                Chi tiết số đơn và doanh thu thu được theo từng tháng
              </p>
            </div>

            <QueryState
              loading={revenueQuery.isLoading}
              error={revenueQuery.error}
              empty={!revenue?.by_month || revenue.by_month.length === 0}
              emptyTitle="Chưa có dữ liệu doanh thu tháng"
            >
              <div className="overflow-x-auto rounded-xl border border-gborder/70">
                <table className="min-w-full divide-y divide-gborder text-left text-xs">
                  <thead className="bg-gbg2 text-[11px] font-bold uppercase tracking-wider text-gtext">
                    <tr>
                      <th className="px-4 py-3">Tháng</th>
                      <th className="px-3 py-3 text-right">Tổng đơn</th>
                      <th className="px-3 py-3 text-right">Đã thanh toán</th>
                      <th className="px-4 py-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gborder/50 bg-white">
                    {revenue?.by_month.map(
                      (m: {
                        month: string;
                        total_orders: number;
                        paid_orders: number;
                        total_revenue: number;
                      }) => (
                        <tr key={m.month} className="hover:bg-gbg/40">
                          <td className="px-4 py-3 font-semibold text-navy">{m.month}</td>
                          <td className="px-3 py-3 text-right font-medium text-gtext tabular-nums">
                            {m.total_orders}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                            {m.paid_orders}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-navy tabular-nums">
                            {formatVND(m.total_revenue)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </Card>
        </div>

        {/* Revenue by Source (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-navy-heading">
                Hiệu quả theo Nguồn khách hàng
              </h2>
              <p className="text-xs text-gtext">Doanh thu đóng góp từ từng nguồn tiếp cận</p>
            </div>

            <QueryState
              loading={revenueQuery.isLoading}
              error={revenueQuery.error}
              empty={!revenue?.by_source || revenue.by_source.length === 0}
              emptyTitle="Chưa có dữ liệu nguồn khách hàng"
            >
              <div className="overflow-x-auto rounded-xl border border-gborder/70">
                <table className="min-w-full divide-y divide-gborder text-left text-xs">
                  <thead className="bg-gbg2 text-[11px] font-bold uppercase tracking-wider text-gtext">
                    <tr>
                      <th className="px-4 py-3">Nguồn</th>
                      <th className="px-3 py-3 text-right">Đơn chốt</th>
                      <th className="px-4 py-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gborder/50 bg-white">
                    {revenue?.by_source.map(
                      (src: { source: string; total_orders: number; revenue: number }) => (
                        <tr key={src.source} className="hover:bg-gbg/40">
                          <td className="px-4 py-3 font-medium text-navy">
                            {getSourceLabel(src.source)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-gtext tabular-nums">
                            {src.total_orders}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                            {formatVND(src.revenue)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </Card>
        </div>
      </div>
    </div>
  );
}
