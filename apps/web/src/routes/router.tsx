import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";

import AppLayout from "../app/AppLayout";
import { ForbiddenPage, NotFoundPage } from "../app/pages";
import { FullPageLoading } from "../components/ui";
import { homePathFor, useAuth } from "../features/auth/AuthContext";
import ChangePasswordPage from "../features/auth/ChangePasswordPage";
import LoginPage from "../features/auth/LoginPage";
import type { Role } from "../lib/types";

function lazyLoad<P extends object = Record<string, never>>(
  importFn: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  const Component = lazy(async () => {
    const module = await importFn();
    return { default: module[exportName] as ComponentType<P> };
  }) as unknown as ComponentType<P>;
  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={<FullPageLoading />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Admin pages lazy bundle
const AdminDashboardPage = lazyLoad(
  () => import("../features/admin/AdminPages"),
  "AdminDashboardPage",
);
const AdminOperationsPage = lazyLoad(
  () => import("../features/admin/AdminPages"),
  "AdminOperationsPage",
);
const ClassDetailPage = lazyLoad(() => import("../features/admin/AdminPages"), "ClassDetailPage");
const ClassesPage = lazyLoad(() => import("../features/admin/AdminPages"), "ClassesPage");
const CoursesPage = lazyLoad(() => import("../features/admin/AdminPages"), "CoursesPage");
const ScheduleAdminPage = lazyLoad(
  () => import("../features/admin/AdminPages"),
  "ScheduleAdminPage",
);
const StudentsPage = lazyLoad(() => import("../features/admin/AdminPages"), "StudentsPage");
const TeachersPage = lazyLoad(() => import("../features/admin/AdminPages"), "TeachersPage");
const AdminAttendancePage = lazyLoad(
  () => import("../features/admin/AdminAttendancePage"),
  "AdminAttendancePage",
);
const PersonProfilePage = lazyLoad<{ kind: "student" | "teacher" }>(
  () => import("../features/admin/PersonProfilePage"),
  "PersonProfilePage",
);

// Teacher pages lazy bundle
const TeacherAttendancePage = lazyLoad(
  () => import("../features/teacher/TeacherAttendancePage"),
  "TeacherAttendancePage",
);
const AssessmentPage = lazyLoad(() => import("../features/teacher/TeacherPages"), "AssessmentPage");
const TeacherAssessmentLandingPage = lazyLoad(
  () => import("../features/teacher/TeacherPages"),
  "TeacherAssessmentLandingPage",
);
const TeacherClassDetailPage = lazyLoad(
  () => import("../features/teacher/TeacherPages"),
  "TeacherClassDetailPage",
);
const TeacherClassesPage = lazyLoad(
  () => import("../features/teacher/TeacherPages"),
  "TeacherClassesPage",
);
const TeacherDashboardPage = lazyLoad(
  () => import("../features/teacher/TeacherPages"),
  "TeacherDashboardPage",
);
const TeacherSchedulePage = lazyLoad(
  () => import("../features/teacher/TeacherPages"),
  "TeacherSchedulePage",
);

// Student pages lazy bundle
const StudentAssessmentsPage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentAssessmentsPage",
);
const StudentAttendancePage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentAttendancePage",
);
const StudentCoursesPage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentCoursesPage",
);
const StudentDashboardPage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentDashboardPage",
);
const StudentProgressPage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentProgressPage",
);
const StudentSchedulePage = lazyLoad(
  () => import("../features/student/StudentPages"),
  "StudentSchedulePage",
);

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
            path: "/admin/hoc-vien/:personId",
            element: (
              <RequireRole role="ADMIN">
                <PersonProfilePage kind="student" />
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
            path: "/admin/giang-vien/:personId",
            element: (
              <RequireRole role="ADMIN">
                <PersonProfilePage kind="teacher" />
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
            path: "/admin/diem-danh",
            element: (
              <RequireRole role="ADMIN">
                <AdminAttendancePage />
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
                <TeacherAttendancePage />
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
          // Backward compatibility aliases
          { path: "/giang-vien", element: <Navigate to="/teacher" replace /> },
          {
            path: "/giang-vien/lop-phu-trach",
            element: <Navigate to="/teacher/lop-phu-trach" replace />,
          },
          { path: "/giang-vien/lich-day", element: <Navigate to="/teacher/lich-day" replace /> },
          { path: "/giang-vien/diem-danh", element: <Navigate to="/teacher/diem-danh" replace /> },
          { path: "/giang-vien/danh-gia", element: <Navigate to="/teacher/danh-gia" replace /> },
          {
            path: "/giang-vien/diem-kiem-tra",
            element: <Navigate to="/teacher/lop-phu-trach" replace />,
          },
          { path: "/hoc-vien", element: <Navigate to="/student" replace /> },
          { path: "/hoc-vien/khoa-hoc", element: <Navigate to="/student/khoa-hoc" replace /> },
          { path: "/hoc-vien/lich-hoc", element: <Navigate to="/student/lich-hoc" replace /> },
          { path: "/hoc-vien/diem-danh", element: <Navigate to="/student/diem-danh" replace /> },
          { path: "/hoc-vien/danh-gia", element: <Navigate to="/student/danh-gia" replace /> },
          { path: "/hoc-vien/tien-do", element: <Navigate to="/student/tien-do" replace /> },
          { path: "/hoc-vien/ho-so", element: <Navigate to="/student" replace /> },
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
