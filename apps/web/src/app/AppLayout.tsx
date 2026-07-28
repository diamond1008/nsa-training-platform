import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { Icon } from "../components/icons";
import type { IconName } from "../components/icons";
import { Badge, Button } from "../components/ui";
import { useAuth } from "../features/auth/AuthContext";
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
  const sidebar = (
    <aside className="flex h-full w-[17rem] flex-col bg-navy text-white">
      <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold font-extrabold text-navy shadow-lg shadow-black/20">
          N
        </div>
        <div>
          <p className="font-bold tracking-tight">NSA Training</p>
          <p className="mt-0.5 text-[11px] text-white/55">Learning Management</p>
        </div>
      </div>
      <div className="px-4 pb-2 pt-5">
        <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Không gian làm việc
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5" aria-label="Điều hướng chính">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={["/admin", "/teacher", "/student"].includes(item.to)}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-navy shadow-sm"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-[11px] text-white/45">{user.email}</p>
          </div>
        </div>
        <Button
          variant="soft"
          className="h-9 w-full border-white/10 bg-white/10 text-white hover:bg-white/15"
          onClick={handleLogout}
        >
          <Icon name="logout" className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-gbg">
      <div className="hidden h-full shrink-0 lg:block">{sidebar}</div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-navy/55 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Đóng menu"
          />
          <div className="absolute inset-y-0 left-0 z-50 shadow-elevated">{sidebar}</div>
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
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-xl text-gtext hover:bg-gbg2 sm:flex"
              aria-label="Thông báo"
            >
              <Icon name="bell" className="h-[18px] w-[18px]" />
            </button>
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
