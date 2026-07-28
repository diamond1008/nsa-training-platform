import type { ReactNode } from "react";
import { ApiRequestError } from "../lib/apiClient";
import { Badge, Button, Card, EmptyState, ErrorBanner, Spinner } from "./ui";
import { statusLabel } from "../lib/format";

export function QueryState({ loading, error, empty, emptyTitle = "Chưa có dữ liệu", children }: {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  emptyTitle?: string;
  children: ReactNode;
}) {
  if (loading) return <Card className="flex min-h-40 items-center justify-center"><Spinner /></Card>;
  if (error) {
    const message = error instanceof ApiRequestError ? error.message : "Không tải được dữ liệu. Vui lòng thử lại.";
    return <ErrorBanner message={message} />;
  }
  if (empty) return <EmptyState title={emptyTitle} hint="Thử thay đổi bộ lọc hoặc tạo dữ liệu mới." />;
  return <>{children}</>;
}

export function StatusBadge({ value }: { value: string }) {
  const tone = ["active", "present", "completed", "eligible", "excellent", "good", "competent"].includes(value)
    ? "green"
    : ["absent", "cancelled", "suspended", "needs_improvement"].includes(value)
      ? "red"
      : ["scheduled", "in_progress", "open", "late", "submitted"].includes(value)
        ? "gold"
        : "gray";
  return <Badge tone={tone}>{statusLabel(value)}</Badge>;
}

export interface Column<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({ items, columns }: { items: T[]; columns: Column<T>[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gborder text-left text-sm">
          <thead className="bg-gbg2 text-xs uppercase tracking-wide text-gtext">
            <tr>{columns.map((column) => <th key={column.header} className={`px-4 py-3 font-semibold ${column.className ?? ""}`}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gborder bg-white">
            {items.map((item) => <tr key={item.id} className="hover:bg-gbg/70">{columns.map((column) => <td key={column.header} className={`px-4 py-3 align-middle ${column.className ?? ""}`}>{column.cell(item)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trang trước</Button>
      <span className="text-sm text-gtext">Trang {page}/{totalPages}</span>
      <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Trang sau</Button>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <Card><p className="text-xs font-medium uppercase tracking-wide text-gtext">{label}</p><p className="mt-2 text-3xl font-bold text-navy">{value}</p>{hint && <p className="mt-1 text-xs text-gtext">{hint}</p>}</Card>;
}
