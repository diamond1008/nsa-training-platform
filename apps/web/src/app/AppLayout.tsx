import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
import { Badge, Button } from "../components/ui";
import { useAuth } from "../features/auth/AuthContext";
import { notificationApi } from "../features/notifications/notificationApi";
import { formatDateTime } from "../lib/format";
import type { Role } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: "/admin", label: "Tổng quan", icon: "home" },
    { to: "/admin/hoc-vien", label: "Học viên", icon: "users" },
    { to: "/admin/giang-vien", label: "Giảng viên", icon: "teacher" },
    { to: "/admin/khoa-hoc", label: "Khóa học", icon: "book" },
    { to: "/admin/lop-hoc", label: "Lớp học", icon: "school" },
    { to: "/admin/lich-hoc", label: "Lịch học", icon: "calendar" },
    { to: "/admin/van-hanh", label: "Vận hành & báo cáo", icon: "chart" },
  ],
  TEACHER: [
    { to: "/teacher", label: "Tổng quan", icon: "home" },
    { to: "/teacher/lop-phu-trach", label: "Lớp phụ trách", icon: "school" },
    { to: "/teacher/diem-danh", label: "Điểm danh", icon: "check" },
    { to: "/teacher/danh-gia", label: "Đánh giá kỹ năng", icon: "award" },
    { to: "/teacher/lich-day", label: "Lịch dạy", icon: "calendar" },
  ],
  STUDENT: [
    { to: "/student", label: "Tổng quan", icon: "home" },
    { to: "/student/khoa-hoc", label: "Khóa học của tôi", icon: "book" },
    { to: "/student/lich-hoc", label: "Lịch học", icon: "calendar" },
    { to: "/student/diem-danh", label: "Điểm danh", icon: "check" },
    { to: "/student/danh-gia", label: "Đánh giá", icon: "award" },
    { to: "/student/tien-do", label: "Tiến độ học tập", icon: "chart" },
  ],
};
const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giảng viên",
  STUDENT: "Học viên",
};

function navItemsFor(roles: Role[]) {
  if (roles.includes("ADMIN")) return NAV_BY_ROLE.ADMIN;
  if (roles.includes("TEACHER")) return NAV_BY_ROLE.TEACHER;
  return NAV_BY_ROLE.STUDENT;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list(),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  if (!user) return null;

  const items = navItemsFor(user.roles);
  const primaryRole: Role = user.roles.includes("ADMIN")
    ? "ADMIN"
    : user.roles.includes("TEACHER")
      ? "TEACHER"
      : "STUDENT";
  const displayName =
    user.teacher_profile?.full_name ?? user.student_profile?.full_name ?? user.email;
  const activeLabel =
    [...items]
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      ?.label ?? "NSA Training";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const renderSidebarContent = (mobile = false) => {
    const collapsed = mobile ? false : isCollapsed;
    return (
      <aside
        className={clsx(
          "relative flex h-full flex-col border-r border-gborder bg-[#F0F4F9] text-navy transition-[width] duration-300 ease-in-out select-none z-30",
          collapsed ? "w-[4.5rem] overflow-visible" : "w-[16rem]",
        )}
      >
        <div
          className={clsx(
            "flex h-[4.5rem] shrink-0 items-center border-b border-gborder/70 px-4",
            collapsed ? "justify-center overflow-visible" : "justify-between gap-2",
          )}
        >
          {!collapsed || mobile ? (
            <>
              <div className="flex items-center gap-2.5 truncate">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold font-extrabold text-navy shadow-xs">
                  N
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold tracking-tight text-navy">NSA Training</p>
                  <p className="text-[10px] text-gtext">Learning Platform</p>
                </div>
              </div>
              {!mobile && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy/80 hover:bg-[#E9EEF6] hover:text-navy transition-all duration-200"
                    aria-label="Thu nhỏ thanh điều hướng"
                  >
                    <Icon name="sidebar" className="h-5 w-5 group-hover:hidden" />
                    <Icon name="sidebar-collapse" className="h-5 w-5 hidden group-hover:block" />
                  </button>
                  <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                    Thu nhỏ thanh điều hướng
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy/80 hover:bg-[#E9EEF6] hover:text-navy transition-all duration-200"
                aria-label="Mở rộng thanh điều hướng"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold font-extrabold text-navy shadow-xs group-hover:hidden">
                  N
                </div>
                <Icon name="sidebar-expand" className="h-5 w-5 hidden group-hover:block" />
              </button>
              <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                Mở rộng thanh điều hướng
              </div>
            </div>
          )}
        </div>

        <nav
          className={clsx(
            "flex-1 space-y-1.5 pb-4 pt-2",
            collapsed ? "px-2 overflow-visible" : "px-3 overflow-y-auto",
          )}
          aria-label="Điều hướng chính"
        >
          {items.map((item) => (
            <div key={item.to} className="relative group">
              <NavLink
                to={item.to}
                end={["/admin", "/teacher", "/student"].includes(item.to)}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center rounded-full text-sm font-medium transition-all duration-200",
                    collapsed ? "h-11 w-11 justify-center mx-auto" : "h-11 px-4 gap-3.5",
                    isActive
                      ? "bg-[#D3E3FD] text-[#041E49] font-bold shadow-xs"
                      : "text-navy/75 hover:bg-[#E9EEF6] hover:text-navy",
                  )
                }
              >
                <Icon
                  name={item.icon}
                  className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
                />
                {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
              </NavLink>
              {collapsed && !mobile && (
                <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                  {item.label}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-gborder/70 p-3">
          {!collapsed || mobile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/25 text-xs font-bold text-gold-dark">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-navy">{displayName}</p>
                  <p className="truncate text-[10px] text-gtext">{user.email}</p>
                </div>
              </div>
              <Button
                variant="soft"
                className="h-9.5 w-full justify-center gap-2 rounded-full border-gborder/80 bg-white text-navy hover:bg-[#E9EEF6] hover:text-navy font-medium shadow-2xs"
                onClick={handleLogout}
              >
                <Icon name="logout" className="h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="relative group">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/25 text-xs font-bold text-gold-dark cursor-pointer">
                  {initials}
                </div>
                <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                  {displayName}
                </div>
              </div>
              <div className="relative group">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-navy/70 hover:bg-[#E9EEF6] hover:text-navy transition-colors"
                  aria-label="Đăng xuất"
                >
                  <Icon name="logout" className="h-4.5 w-4.5" />
                </button>
                <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                  Đăng xuất
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-gbg">
      <div className="hidden h-full shrink-0 lg:block z-30 relative overflow-visible">
        {renderSidebarContent(false)}
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Đóng menu"
          />
          <div className="absolute inset-y-0 left-0 z-50 shadow-elevated">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-gborder bg-white/95 px-4 backdrop-blur md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gborder text-navy hover:bg-gbg2 lg:hidden"
              aria-label="Mở menu"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gtext">
                NSA Training Platform
              </p>
              <p className="truncate text-sm font-semibold text-navy md:text-base">{activeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden sm:block">
              <button
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gtext hover:bg-gbg2"
                aria-label="Thông báo"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
                {!!notifications.data?.unread && (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
                    {Math.min(notifications.data.unread, 99)}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gborder bg-white shadow-elevated">
                  <div className="border-b border-gborder px-4 py-3">
                    <b className="text-sm text-navy">Thông báo</b>
                    <p className="text-xs text-gtext">{notifications.data?.unread ?? 0} chưa đọc</p>
                  </div>
                  <div className="max-h-[26rem] overflow-y-auto">
                    {notifications.data?.items.map((item) => (
                      <button
                        key={item.id}
                        className={clsx(
                          "block w-full border-b border-gborder/70 px-4 py-3 text-left hover:bg-gbg2",
                          item.status === "unread" && "bg-gold/5",
                        )}
                        onClick={() => {
                          if (item.status === "unread") markRead.mutate(item.id);
                          setNotificationsOpen(false);
                          if (item.action_url?.startsWith("/")) navigate(item.action_url);
                        }}
                      >
                        <span className="block text-sm font-semibold text-navy">{item.title}</span>
                        <span className="mt-1 block text-xs text-gtext">{item.message}</span>
                        <span className="mt-1 block text-[10px] text-gtext">
                          {formatDateTime(item.created_at)}
                        </span>
                      </button>
                    ))}
                    {!notifications.data?.items.length && (
                      <p className="p-6 text-center text-sm text-gtext">Chưa có thông báo.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden h-8 w-px bg-gborder sm:block" />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-40 truncate text-xs font-semibold text-navy">{displayName}</p>
              <Badge tone="gold">{ROLE_LABEL[primaryRole]}</Badge>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
