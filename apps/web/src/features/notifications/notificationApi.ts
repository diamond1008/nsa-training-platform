import { api } from "../../lib/apiClient";
import type { NotificationItem, NotificationList } from "../../lib/domainTypes";

export const notificationApi = {
  list: () => api<NotificationList>("/notifications?page=1&per_page=20"),
  markRead: (id: string) => api<NotificationItem>(`/notifications/${id}/read`, { method: "PUT" }),
  archive: (id: string) => api<NotificationItem>(`/notifications/${id}`, { method: "DELETE" }),
};
