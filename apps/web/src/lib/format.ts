export const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  active: "Hoạt động",
  suspended: "Tạm khóa",
  inactive: "Không hoạt động",
  completed: "Đã hoàn thành",
  withdrawn: "Đã rút",
  transferred: "Đã chuyển lớp",
  draft: "Bản nháp",
  archived: "Lưu trữ",
  planning: "Đang chuẩn bị",
  open: "Đang mở",
  in_progress: "Đang diễn ra",
  cancelled: "Đã hủy",
  scheduled: "Đã lên lịch",
  locked: "Đã khóa",
  submitted: "Đã gửi",
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  excused: "Có phép",
  eligible: "Đủ điều kiện",
  not_assessed: "Chưa đánh giá",
  needs_improvement: "Cần cải thiện",
  competent: "Đạt",
  good: "Tốt",
  excellent: "Xuất sắc",
};

export function statusLabel(value: string): string {
  return statusLabels[value] ?? value;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function toQuery(params: object): string {
  const query = new URLSearchParams();
  Object.entries(params as Record<string, string | number | undefined | null>).forEach(
    ([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    },
  );
  const text = query.toString();
  return text ? `?${text}` : "";
}
