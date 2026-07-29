/** Route definitions with authentication and role guards. */
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import AppLayout from "../app/AppLayout";
import { ForbiddenPage, NotFoundPage } from "../app/pages";
import {
  AdminDashboardPage,
  AdminOperationsPage,
  ClassDetailPage,
  ClassesPage,
  CoursesPage,
  ScheduleAdminPage,
  StudentsPage,
  TeachersPage,
} from "../features/admin/AdminPages";
import {
  AssessmentPage,
  AttendancePage,
  TeacherAssessmentLandingPage,
  TeacherClassDetailPage,
  TeacherClassesPage,
  TeacherDashboardPage,
  TeacherSchedulePage,
} from "../features/teacher/TeacherPages";
import {
  StudentAssessmentsPage,
  StudentAttendancePage,
  StudentCoursesPage,
  StudentDashboardPage,
  StudentProgressPage,
  StudentSchedulePage,
} from "../features/student/StudentPages";
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
    return (
      <Navigate to={user.must_change_password ? "/doi-mat-khau" : homePathFor(user)} replace />
    );
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
                <AdminDashboardPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/van-hanh",
            element: (
              <RequireRole role="ADMIN">
                <AdminOperationsPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/hoc-vien",
            element: (
              <RequireRole role="ADMIN">
                <StudentsPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/giang-vien",
            element: (
              <RequireRole role="ADMIN">
                <TeachersPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/khoa-hoc",
            element: (
              <RequireRole role="ADMIN">
                <CoursesPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/lop-hoc",
            element: (
              <RequireRole role="ADMIN">
                <ClassesPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/lop-hoc/:classId",
            element: (
              <RequireRole role="ADMIN">
                <ClassDetailPage />
              </RequireRole>
            ),
          },
          {
            path: "/admin/lich-hoc",
            element: (
              <RequireRole role="ADMIN">
                <ScheduleAdminPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher",
            element: (
              <RequireRole role="TEACHER">
                <TeacherDashboardPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/lop-phu-trach",
            element: (
              <RequireRole role="TEACHER">
                <TeacherClassesPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/lop-phu-trach/:classId",
            element: (
              <RequireRole role="TEACHER">
                <TeacherClassDetailPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/lop-phu-trach/:classId/hoc-vien/:studentId/danh-gia",
            element: (
              <RequireRole role="TEACHER">
                <AssessmentPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/diem-danh",
            element: (
              <RequireRole role="TEACHER">
                <AttendancePage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/danh-gia",
            element: (
              <RequireRole role="TEACHER">
                <TeacherAssessmentLandingPage />
              </RequireRole>
            ),
          },
          {
            path: "/teacher/lich-day",
            element: (
              <RequireRole role="TEACHER">
                <TeacherSchedulePage />
              </RequireRole>
            ),
          },
          {
            path: "/student",
            element: (
              <RequireRole role="STUDENT">
                <StudentDashboardPage />
              </RequireRole>
            ),
          },
          {
            path: "/student/khoa-hoc",
            element: (
              <RequireRole role="STUDENT">
                <StudentCoursesPage />
              </RequireRole>
            ),
          },
          {
            path: "/student/lich-hoc",
            element: (
              <RequireRole role="STUDENT">
                <StudentSchedulePage />
              </RequireRole>
            ),
          },
          {
            path: "/student/diem-danh",
            element: (
              <RequireRole role="STUDENT">
                <StudentAttendancePage />
              </RequireRole>
            ),
          },
          {
            path: "/student/danh-gia",
            element: (
              <RequireRole role="STUDENT">
                <StudentAssessmentsPage />
              </RequireRole>
            ),
          },
          {
            path: "/student/tien-do",
            element: (
              <RequireRole role="STUDENT">
                <StudentProgressPage />
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
  {
    path: "/403",
    element: (
      <RequireAuth>
        <ForbiddenPage />
      </RequireAuth>
    ),
  },
  { path: "*", element: <NotFoundPage /> },
]);
