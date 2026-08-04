import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
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
    { to: "/admin/diem-danh", label: "Điểm danh", icon: "check" },
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
function navItemsFor(roles: Role[]) {
  if (roles.includes("ADMIN")) return NAV_BY_ROLE.ADMIN;
  if (roles.includes("TEACHER")) return NAV_BY_ROLE.TEACHER;
  return NAV_BY_ROLE.STUDENT;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosingMenu, setIsClosingMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [menuOpen]);

  const openMobileMenu = () => {
    setIsClosingMenu(false);
    setMenuOpen(true);
  };

  const closeMobileMenu = () => {
    if (isClosingMenu) return;
    setIsClosingMenu(true);
    setTimeout(() => {
      setMenuOpen(false);
      setIsClosingMenu(false);
    }, 240);
  };

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
  const displayName =
    user.teacher_profile?.full_name ?? user.student_profile?.full_name ?? user.email;
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
          "relative flex h-full flex-col text-navy transition-[width,background-color,border-color] duration-300 ease-in-out select-none z-30",
          mobile
            ? "w-[min(22rem,85vw)] sm:w-80 bg-white shadow-2xl rounded-r-3xl border-r border-gborder/40"
            : collapsed
              ? "w-[4.5rem] overflow-visible bg-gbg border-r border-transparent"
              : "w-[16rem] bg-[#F0F4F9] border-r border-gborder",
        )}
      >
        <div
          className={clsx(
            "flex h-[4.5rem] shrink-0 items-center justify-between border-b px-4 overflow-visible transition-colors duration-300",
            collapsed && !mobile ? "border-transparent" : "border-gborder/70",
          )}
        >
          {!collapsed || mobile ? (
            <>
              <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold font-extrabold text-navy shadow-xs">
                    N
                  </div>
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold tracking-tight text-navy">NSA Training</p>
                  <p className="text-[10px] text-gtext">Learning Platform</p>
                </div>
              </div>
              {mobile ? (
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy/75 hover:bg-gbg2 active:scale-90 active:bg-slate-200 transition-all"
                  aria-label="Đóng menu"
                >
                  <Icon name="close" className="h-5 w-5" />
                </button>
              ) : (
                <div className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-navy/80 transition-all duration-200 hover:bg-[#E9EEF6] active:scale-90 active:bg-[#D8E4F8] hover:text-navy motion-reduce:transition-none"
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
            <div className="relative group flex items-center">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-all duration-200 hover:bg-[#E9EEF6] active:scale-90 active:bg-[#D8E4F8] focus-visible:outline-none"
                aria-label="Mở rộng thanh điều hướng"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold font-extrabold text-navy shadow-xs group-hover:hidden">
                  N
                </div>
                <Icon
                  name="sidebar-expand"
                  className="h-5 w-5 text-navy hidden group-hover:block"
                />
              </button>
              <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                Mở rộng thanh điều hướng
              </div>
            </div>
          )}
        </div>

        <nav
          className="flex-1 space-y-1.5 pb-4 pt-3 px-3 overflow-visible"
          aria-label="Điều hướng chính"
        >
          {items.map((item) => (
            <div key={item.to} className="relative group">
              <NavLink
                to={item.to}
                end={["/admin", "/teacher", "/student"].includes(item.to)}
                onClick={() => {
                  if (mobile) closeMobileMenu();
                }}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center overflow-hidden rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.97] select-none",
                    collapsed && !mobile ? "w-11" : "w-full",
                    isActive
                      ? "bg-[#D3E3FD] text-[#041E49] font-bold shadow-xs ring-1 ring-blue-300/40"
                      : "text-navy/75 hover:bg-[#E9EEF6] hover:text-navy active:bg-[#D8E4F8]",
                  )
                }
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                  <Icon
                    name={item.icon}
                    className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
                  />
                </div>
                {(!collapsed || mobile) && <span className="truncate pr-3.5">{item.label}</span>}
              </NavLink>
              {collapsed && !mobile && (
                <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                  {item.label}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div
          className={clsx(
            "border-t p-3 space-y-1 overflow-visible transition-colors duration-300",
            collapsed && !mobile ? "border-transparent" : "border-gborder/70",
          )}
        >
          <div className="relative group">
            <div className="flex h-11 items-center overflow-hidden rounded-full transition-[width] duration-300 motion-reduce:transition-none">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/25 text-xs font-bold text-gold-dark cursor-pointer">
                  {initials}
                </div>
              </div>
              {(!collapsed || mobile) && (
                <div className="min-w-0 flex-1 truncate pr-3">
                  <p className="truncate text-xs font-semibold text-navy">{displayName}</p>
                  <p className="truncate text-[10px] text-gtext">{user.email}</p>
                </div>
              )}
            </div>
            {collapsed && !mobile && (
              <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                {displayName}
              </div>
            )}
          </div>

          <div className="relative group">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 w-full cursor-pointer items-center overflow-hidden rounded-full text-sm font-medium text-navy/75 transition-all duration-200 hover:bg-[#E9EEF6] hover:text-navy active:scale-[0.97] active:bg-red-50 active:text-red-700 select-none motion-reduce:transition-none"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                <Icon name="logout" className="h-5 w-5 shrink-0" />
              </div>
              {(!collapsed || mobile) && (
                <span className="truncate pr-3.5 font-medium">Đăng xuất</span>
              )}
            </button>
            {collapsed && !mobile && (
              <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap rounded-full bg-white text-navy font-medium text-xs px-3.5 py-1.5 shadow-elevated border border-gborder">
                Đăng xuất
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  };

  return (
    <div className="flex h-dvh w-full max-w-full overflow-hidden bg-gbg select-none">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Chuyển đến nội dung chính
      </a>
      <div className="hidden h-full shrink-0 lg:block z-30 relative overflow-visible">
        {renderSidebarContent(false)}
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden overflow-hidden touch-none">
          <button
            className={clsx(
              "absolute inset-0 bg-navy/60 backdrop-blur-sm touch-none overscroll-none",
              isClosingMenu ? "animate-backdrop-out" : "animate-backdrop-in",
            )}
            onClick={closeMobileMenu}
            onTouchMove={(e) => e.preventDefault()}
            aria-label="Đóng menu"
          />
          <div
            className={clsx(
              "absolute inset-y-0 left-0 z-50 shadow-2xl flex",
              isClosingMenu ? "animate-drawer-out" : "animate-drawer-in",
            )}
          >
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between lg:justify-end pb-3">
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gborder bg-white text-navy hover:bg-gbg2 active:scale-90 active:bg-slate-100 lg:hidden shadow-2xs transition-all"
                aria-label="Mở menu"
                onClick={openMobileMenu}
              >
                <Icon name="menu" />
              </button>
              <div className="relative">
                <button
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy/80 transition-all hover:bg-black/5 active:scale-90 active:bg-black/10 hover:text-navy"
                  aria-label="Thông báo"
                  aria-expanded={notificationsOpen}
                  onClick={() => setNotificationsOpen((value) => !value)}
                >
                  <Icon name="bell" className="h-5 w-5" />
                  {!!notifications.data?.unread && (
                    <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white shadow-2xs">
                      {Math.min(notifications.data.unread, 99)}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gborder bg-white shadow-elevated">
                    <div className="border-b border-gborder px-4 py-3">
                      <b className="text-sm text-navy">Thông báo</b>
                      <p className="text-xs text-gtext">
                        {notifications.data?.unread ?? 0} chưa đọc
                      </p>
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
                          <span className="block text-sm font-semibold text-navy">
                            {item.title}
                          </span>
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
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
