/** Authenticated shell: sidebar navigation + top bar, role-aware. */
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { Badge, Button } from "../components/ui";
import { useAuth } from "../features/auth/AuthContext";
import type { Role } from "../lib/types";

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: "/admin", label: "Tổng quan" },
    { to: "/admin/hoc-vien", label: "Học viên" },
    { to: "/admin/giang-vien", label: "Giảng viên" },
    { to: "/admin/khoa-hoc", label: "Khóa học" },
    { to: "/admin/lop-hoc", label: "Lớp học" },
    { to: "/admin/lich-hoc", label: "Lịch học" },
  ],
  TEACHER: [
    { to: "/teacher", label: "Tổng quan" },
    { to: "/teacher/lop-phu-trach", label: "Lớp phụ trách" },
    { to: "/teacher/diem-danh", label: "Điểm danh" },
    { to: "/teacher/danh-gia", label: "Đánh giá kỹ năng" },
    { to: "/teacher/lich-day", label: "Lịch dạy" },
  ],
  STUDENT: [
    { to: "/student", label: "Tổng quan" },
    { to: "/student/lich-hoc", label: "Lịch học" },
    { to: "/student/diem-danh", label: "Điểm danh" },
    { to: "/student/danh-gia", label: "Đánh giá" },
    { to: "/student/tien-do", label: "Tiến độ học tập" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giảng viên",
  STUDENT: "Học viên",
};

function navItemsFor(roles: Role[]): NavItem[] {
  if (roles.includes("ADMIN")) return NAV_BY_ROLE.ADMIN;
  if (roles.includes("TEACHER")) return NAV_BY_ROLE.TEACHER;
  return NAV_BY_ROLE.STUDENT;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null; // guarded upstream

  const items = navItemsFor(user.roles);
  const primaryRole = user.roles.includes("ADMIN") ? "ADMIN" : user.roles.includes("TEACHER") ? "TEACHER" : "STUDENT";
  const displayName = user.teacher_profile?.full_name ?? user.student_profile?.full_name ?? user.email;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-gborder bg-white">
      <div className="border-b border-gborder px-5 py-4">
        <p className="text-lg font-bold text-navy">NSA Training Platform</p>
        <p className="mt-0.5 text-xs text-gtext">Hệ thống Quản lý Đào tạo</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin" || item.to === "/teacher" || item.to === "/student"}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              clsx(
                "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-navy text-white" : "text-gtext hover:bg-gbg2 hover:text-navy",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gborder px-5 py-4">
        <p className="truncate text-sm font-semibold text-navy">{displayName}</p>
        <div className="mt-1 flex items-center justify-between">
          <Badge tone="gold">{ROLE_LABEL[primaryRole]}</Badge>
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={handleLogout}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-gbg">
      {/* Desktop sidebar */}
      <div className="hidden md:block md:shrink-0">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 z-50">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (64px per Figma) */}
        <header className="flex h-16 items-center justify-between border-b border-gborder bg-white px-4 md:px-6">
          <button
            className="rounded-lg p-2 hover:bg-gbg2 md:hidden"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
          >
            <span className="block h-0.5 w-5 bg-navy" />
            <span className="mt-1 block h-0.5 w-5 bg-navy" />
            <span className="mt-1 block h-0.5 w-5 bg-navy" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gtext sm:block">{user.email}</span>
            <Badge tone="navy">{ROLE_LABEL[primaryRole]}</Badge>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}