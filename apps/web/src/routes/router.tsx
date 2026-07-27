/** Route definitions with authentication and role guards. */
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import AppLayout from "../app/AppLayout";
import {
  AdminDashboard,
  ComingSoon,
  ForbiddenPage,
  NotFoundPage,
  StudentDashboard,
  TeacherDashboard,
} from "../app/pages";
import { FullPageLoading } from "../components/ui";
import { homePathFor, useAuth } from "../features/auth/AuthContext";
import ChangePasswordPage from "../features/auth/ChangePasswordPage";
import LoginPage from "../features/auth/LoginPage";
import type { Role } from "../lib/types";

/** Blocks everything until the silent refresh finishes; forces login when anonymous. */
function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageLoading />;
  if (status === "anonymous" || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // Accounts flagged must_change_password may only visit /doi-mat-khau.
  if (user.must_change_password && location.pathname !== "/doi-mat-khau") {
    return <Navigate to="/doi-mat-khau" replace />;
  }
  return children ?? <Outlet />;
}

/** Role gate INSIDE the authenticated area. Wrong role → 403 page. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return <ForbiddenPage />;
  return <>{children}</>;
}

/** /login is only for anonymous users; authenticated users go home. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageLoading />;
  if (status === "authenticated" && user) {
    return <Navigate to={user.must_change_password ? "/doi-mat-khau" : homePathFor(user)} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { status, user } = useAuth();
  if (status === "loading") return <FullPageLoading />;
  return <Navigate to={user ? homePathFor(user) : "/login"} replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect /> },
  {
    path: "/login",
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: "/doi-mat-khau",
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/admin",
            element: (
              <RequireRole role="ADMIN">
                <AdminDashboard />
              </RequireRole>
            ),
          },
          { path: "/admin/hoc-vien", element: <RequireRole role="ADMIN"><ComingSoon title="Học viên" /></RequireRole> },
          { path: "/admin/giang-vien", element: <RequireRole role="ADMIN"><ComingSoon title="Giảng viên" /></RequireRole> },
          { path: "/admin/khoa-hoc", element: <RequireRole role="ADMIN"><ComingSoon title="Khóa học" /></RequireRole> },
          { path: "/admin/lop-hoc", element: <RequireRole role="ADMIN"><ComingSoon title="Lớp học" /></RequireRole> },
          { path: "/admin/lich-hoc", element: <RequireRole role="ADMIN"><ComingSoon title="Lịch học" /></RequireRole> },
          {
            path: "/teacher",
            element: (
              <RequireRole role="TEACHER">
                <TeacherDashboard />
              </RequireRole>
            ),
          },
          { path: "/teacher/lop-phu-trach", element: <RequireRole role="TEACHER"><ComingSoon title="Lớp phụ trách" /></RequireRole> },
          { path: "/teacher/diem-danh", element: <RequireRole role="TEACHER"><ComingSoon title="Điểm danh" /></RequireRole> },
          { path: "/teacher/danh-gia", element: <RequireRole role="TEACHER"><ComingSoon title="Đánh giá kỹ năng" /></RequireRole> },
          { path: "/teacher/lich-day", element: <RequireRole role="TEACHER"><ComingSoon title="Lịch dạy" /></RequireRole> },
          {
            path: "/student",
            element: (
              <RequireRole role="STUDENT">
                <StudentDashboard />
              </RequireRole>
            ),
          },
          { path: "/student/lich-hoc", element: <RequireRole role="STUDENT"><ComingSoon title="Lịch học" /></RequireRole> },
          { path: "/student/diem-danh", element: <RequireRole role="STUDENT"><ComingSoon title="Điểm danh" /></RequireRole> },
          { path: "/student/danh-gia", element: <RequireRole role="STUDENT"><ComingSoon title="Đánh giá" /></RequireRole> },
          { path: "/student/tien-do", element: <RequireRole role="STUDENT"><ComingSoon title="Tiến độ học tập" /></RequireRole> },
        ],
      },
    ],
  },
  { path: "/403", element: <RequireAuth><ForbiddenPage /></RequireAuth> },
  { path: "*", element: <NotFoundPage /> },
]);