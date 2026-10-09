import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import {
  Badge,
  Button,
  Card,
  Drawer,
  ErrorBanner,
  Input,
  Modal,
  Select,
  SuccessBanner,
  Textarea,
} from "../../components/ui";
import { QueryState } from "../../components/data";
import { Icon } from "../../components/icons";
import { formatDateTime } from "../../lib/format";
import type { Role } from "../../lib/types";
import { useAuth } from "../auth/AuthContext";
import {
  usersApi,
  type CreateUserInput,
  type ManagedUser,
  type UpdateProfileInput,
  type UserListParams,
} from "./usersApi";

const ROLE_LABELS: Record<
  Role,
  { label: string; tone: "blue" | "green" | "red" | "gray" | "gold" | "navy" }
> = {
  ADMIN: { label: "Admin tổng", tone: "red" },
  ACADEMIC_ADMIN: { label: "Admin Đào tạo", tone: "navy" },
  SALE_ADMIN: { label: "Admin Tuyển sinh", tone: "gold" },
  SALE: { label: "Nhân viên Sale", tone: "blue" },
  TEACHER: { label: "Giảng viên", tone: "green" },
  STUDENT: { label: "Học viên", tone: "gray" },
};

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_LABELS[role] ?? { label: role, tone: "gray" };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge tone="green">Hoạt động</Badge>;
    case "suspended":
      return <Badge tone="red">Tạm khóa</Badge>;
    case "inactive":
      return <Badge tone="gray">Ngừng hoạt động</Badge>;
    default:
      return <Badge tone="gold">Chờ kích hoạt</Badge>;
  }
}

function getInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

interface UserManagementPageProps {
  mode?: "all" | "sale" | "academic";
}

export function UserManagementPage({ mode = "all" }: UserManagementPageProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isOnlyAcademic = Boolean(
    user?.roles.includes("ACADEMIC_ADMIN") && !user?.roles.includes("ADMIN"),
  );
  const isOnlySaleAdmin = Boolean(
    user?.roles.includes("SALE_ADMIN") && !user?.roles.includes("ADMIN"),
  );

  // Mode overrides / defaults
  const isSaleMode = mode === "sale" || isOnlySaleAdmin;
  const isAcademicMode = mode === "academic" || (!isSaleMode && isOnlyAcademic);

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>(isSaleMode ? "SALE" : "");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  // Slide-over Drawer state
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [drawerTab, setDrawerTab] = useState<"account" | "audit">("account");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Modals state (Actions triggered from Drawer or Header)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserInput>({
    email: "",
    password: "",
    role: isSaleMode ? "SALE" : isAcademicMode ? "TEACHER" : "SALE",
    full_name: "",
    phone: "",
    status: "active",
  });
  const [newStatus, setNewStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [statusReason, setStatusReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const queryParams: UserListParams = {
    search: search.trim() || undefined,
    role: selectedRole || (isSaleMode ? "SALE" : undefined),
    status: selectedStatus || undefined,
    page,
    per_page: 15,
  };

  const usersQuery = useQuery({
    queryKey: ["users", queryParams],
    queryFn: () => usersApi.list(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsCreateOpen(false);
      setCreateForm({
        email: "",
        password: "",
        role: isSaleMode ? "SALE" : isAcademicMode ? "TEACHER" : "SALE",
        full_name: "",
        phone: "",
        status: "active",
      });
      setActionSuccess(`Đã tạo thành công tài khoản cho ${created.email}`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Không thể tạo tài khoản");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { status: "active" | "suspended" | "inactive"; reason?: string };
    }) => usersApi.updateStatus(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(updated);
      setIsStatusModalOpen(false);
      setStatusReason("");
      setActionSuccess(
        `Đã cập nhật trạng thái tài khoản ${updated.email} sang "${updated.status}"`,
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProfileInput }) =>
      usersApi.updateProfile(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedUser(updated);
      setIsEditingProfile(false);
      setActionSuccess(`Đã cập nhật thông tin tài khoản ${updated.email}`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Không thể cập nhật thông tin");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { new_password: string; reason?: string } }) =>
      usersApi.resetPassword(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsResetModalOpen(false);
      setNewPassword("");
      setResetReason("");
      setActionSuccess("Đã đặt lại mật khẩu tạm thành công.");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Không thể đặt lại mật khẩu");
    },
  });

  // Audit log query for drawer
  const auditLogsQuery = useQuery({
    queryKey: ["userAuditLogs", selectedUser?.id],
    queryFn: () => usersApi.listAuditLogs(selectedUser!.id, 1, 50),
    enabled: Boolean(selectedUser?.id && drawerTab === "audit"),
  });

  // Page title & subtitle based on mode
  let pageTitle = "Quản lý Tài khoản & Phân quyền";
  let pageSubtitle = "Toàn bộ tài khoản người dùng trong hệ thống, phân quyền và kiểm toán bảo mật";
  if (isSaleMode) {
    pageTitle = "Đội ngũ Tuyển sinh";
    pageSubtitle = "Quản lý tài khoản nhân viên Sale, cấp quyền và theo dõi trạng thái hoạt động";
  } else if (isAcademicMode) {
    pageTitle = "Tài khoản Đào tạo";
    pageSubtitle = "Quản lý tài khoản Giảng viên và Học viên chính thức trong hệ thống";
  }

  // Available roles for filter & create
  const availableRoles: { value: Role; label: string }[] = isSaleMode
    ? [{ value: "SALE", label: "Nhân viên Sale" }]
    : isAcademicMode
      ? [
          { value: "TEACHER", label: "Giảng viên" },
          { value: "STUDENT", label: "Học viên" },
        ]
      : [
          { value: "ADMIN", label: "Admin tổng" },
          { value: "ACADEMIC_ADMIN", label: "Admin Đào tạo" },
          { value: "SALE_ADMIN", label: "Admin Tuyển sinh" },
          { value: "SALE", label: "Nhân viên Sale" },
          { value: "TEACHER", label: "Giảng viên" },
          { value: "STUDENT", label: "Học viên" },
        ];

  const handleRowClick = (u: ManagedUser) => {
    setSelectedUser(u);
    setDrawerTab("account");
    setIsEditingProfile(false);
    setEditFullName(u.full_name || "");
    setEditPhone(u.phone || "");
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateProfileMutation.mutate({
      id: selectedUser.id,
      data: {
        full_name: editFullName.trim(),
        phone: editPhone.trim(),
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notifications */}
      {actionSuccess && <SuccessBanner message={actionSuccess} />}
      {actionError && <ErrorBanner message={actionError} />}

      {/* Header Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-heading tracking-tight">{pageTitle}</h1>
            <p className="mt-1 text-sm text-gtext">{pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setActionError(null);
                setIsCreateOpen(true);
              }}
            >
              <Icon name="plus" className="h-4 w-4" />
              Thêm tài khoản mới
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Tìm kiếm"
            placeholder="Email, họ tên, mã số..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          {!isSaleMode && (
            <Select
              label="Vai trò"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">-- Tất cả vai trò --</option>
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Trạng thái"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="active">Đang hoạt động</option>
            <option value="suspended">Tạm khóa</option>
            <option value="inactive">Ngừng hoạt động</option>
          </Select>

          <div className="flex items-end">
            <Button
              variant="ghost"
              className="w-full h-11"
              onClick={() => {
                setSearch("");
                setSelectedRole(isSaleMode ? "SALE" : "");
                setSelectedStatus("");
                setPage(1);
              }}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden p-0">
        <QueryState
          loading={usersQuery.isLoading}
          error={usersQuery.error}
          empty={!usersQuery.data?.items || usersQuery.data.items.length === 0}
          emptyTitle="Chưa có tài khoản nào"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gborder/80 bg-gbg2 text-[11px] font-bold uppercase tracking-wider text-gtext">
                <tr>
                  <th className="px-5 py-3.5">Người dùng</th>
                  <th className="px-4 py-3.5">Mã đối tượng</th>
                  <th className="px-4 py-3.5">Vai trò</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Người tạo</th>
                  <th className="px-4 py-3.5">Ngày tạo</th>
                  <th className="px-5 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gborder/60 bg-white">
                {usersQuery.data?.items.map((u) => {
                  const initials = getInitials(u.full_name, u.email);
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => handleRowClick(u)}
                      className={clsx(
                        "group cursor-pointer border-l-4 transition-all duration-200",
                        isSelected
                          ? "border-l-[#0532e6] bg-blue-50/70 shadow-xs"
                          : "border-l-transparent hover:border-l-[#0532e6]/50 hover:bg-blue-50/40",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#001258] to-[#0532e6] text-xs font-bold text-white shadow-2xs transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-navy text-sm transition-colors duration-150 group-hover:text-[#0532e6]">
                              {u.full_name || "Chưa cập nhật tên"}
                            </p>
                            <p className="text-xs text-gtext">{u.email}</p>
                            {u.phone && <p className="text-[11px] text-gtext/80">SĐT: {u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.student_code ? (
                          <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs tabular-nums">
                            HV: {u.student_code}
                          </span>
                        ) : u.teacher_code ? (
                          <span className="font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs tabular-nums">
                            GV: {u.teacher_code}
                          </span>
                        ) : (
                          <span className="text-gtext">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <RoleBadge key={r} role={r} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3.5 text-gtext">{u.created_by_email || "Hệ thống"}</td>
                      <td className="px-4 py-3.5 text-gtext tabular-nums">
                        {formatDateTime(u.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gborder/80 bg-white px-2.5 py-1 text-xs font-semibold text-navy shadow-2xs transition-all duration-200 group-hover:scale-105 group-hover:border-[#0532e6] group-hover:bg-[#0532e6] group-hover:text-white group-hover:shadow-xs">
                          Chi tiết
                          <Icon
                            name="chevron-right"
                            className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {usersQuery.data && usersQuery.data.meta.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-gborder px-5 py-3 bg-white">
              <span className="text-xs text-gtext">
                Trang {usersQuery.data.meta.page} / {usersQuery.data.meta.total_pages} (Tổng{" "}
                {usersQuery.data.meta.total} tài khoản)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  disabled={page >= usersQuery.data.meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </QueryState>
      </Card>

      {/* Slide-over Drawer (Phong cách Microsoft 365 Admin Center) */}
      <Drawer open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} width="max-w-2xl">
        {selectedUser && (
          <div className="flex h-full flex-col bg-slate-50/50">
            {/* Top Navigation bar of Drawer */}
            <div className="flex shrink-0 items-center justify-between border-b border-gborder/60 bg-white/90 px-6 py-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-semibold text-gtext">
                <span className="text-gtext/80">Quản lý người dùng</span>
                <Icon name="chevron-right" className="h-3 w-3 text-gtext/60" />
                <span className="font-bold text-navy">
                  {selectedUser.full_name || selectedUser.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-gtext transition-all duration-300 hover:scale-110 hover:rotate-90 active:scale-95 hover:bg-slate-100 hover:text-navy"
                aria-label="Đóng"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Header Box (Microsoft 365 + Liquid Glass Style) */}
            <div className="shrink-0 border-b border-gborder/60 bg-white/95 px-6 pt-6 pb-4 backdrop-blur-md">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#001258] via-[#0532e6] to-[#001258] text-xl font-bold text-white shadow-lg ring-4 ring-blue-100/90 transition-all duration-300 hover:scale-105 hover:rotate-1">
                  {getInitials(selectedUser.full_name, selectedUser.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="truncate text-xl font-bold tracking-tight text-navy-heading">
                      {selectedUser.full_name || "Chưa cập nhật tên"}
                    </h2>
                    <StatusBadge status={selectedUser.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-gtext">{selectedUser.email}</p>
                  {selectedUser.phone && (
                    <p className="text-xs text-gtext">SĐT: {selectedUser.phone}</p>
                  )}

                  {/* Quick Action Links (Dạng ngang trực tiếp dưới thông tin như Microsoft 365) */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewPassword("");
                        setResetReason("");
                        setIsResetModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gborder bg-white px-2.5 py-1.5 text-xs font-semibold text-navy shadow-2xs transition-all duration-200 hover:scale-105 hover:border-[#0532e6] hover:bg-blue-50/50 hover:text-[#0532e6] hover:shadow-xs active:scale-95"
                    >
                      <Icon name="sparkles" className="h-3.5 w-3.5 text-[#0532e6]" />
                      Đặt lại mật khẩu
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewStatus(selectedUser.status === "active" ? "suspended" : "active");
                        setStatusReason("");
                        setIsStatusModalOpen(true);
                      }}
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-xs",
                        selectedUser.status === "active"
                          ? "border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300"
                          : "border-green-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-300",
                      )}
                    >
                      <Icon name="lock" className="h-3.5 w-3.5" />
                      {selectedUser.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gborder bg-white px-2.5 py-1.5 text-xs font-semibold text-navy shadow-2xs transition-all duration-200 hover:scale-105 hover:border-gborder/90 hover:bg-slate-50 hover:shadow-xs active:scale-95"
                    >
                      <Icon name="edit" className="h-3.5 w-3.5 text-slate-500" />
                      {isEditingProfile ? "Hủy sửa" : "Sửa thông tin"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Segmented Control Pill Tabs (Fluent / Apple Style) */}
              <div className="mt-5 inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setDrawerTab("account")}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                    drawerTab === "account"
                      ? "scale-[1.02] bg-white font-bold text-[#0532e6] shadow-sm"
                      : "text-slate-600 hover:bg-white/50 hover:text-navy",
                  )}
                >
                  <Icon name="user-check" className="h-3.5 w-3.5" />
                  Tài khoản & Phân quyền
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("audit")}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                    drawerTab === "audit"
                      ? "scale-[1.02] bg-white font-bold text-[#0532e6] shadow-sm"
                      : "text-slate-600 hover:bg-white/50 hover:text-navy",
                  )}
                >
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  Lịch sử & Kiểm toán
                </button>
              </div>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-slate-50/40 to-slate-100/20">
              {drawerTab === "account" ? (
                <>
                  {/* Inline Profile Editing Form */}
                  {isEditingProfile && (
                    <form
                      onSubmit={handleProfileSubmit}
                      className="animate-fade-in-up rounded-2xl border border-blue-200/90 bg-blue-50/60 p-5 shadow-xs backdrop-blur-md space-y-3.5 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between border-b border-blue-200/70 pb-2">
                        <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                          <Icon name="edit" className="h-4 w-4 text-[#0532e6]" />
                          Chỉnh sửa thông tin người dùng
                        </h3>
                        <span className="text-[11px] font-medium text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md">
                          Tự động ghi vết kiểm toán
                        </span>
                      </div>
                      <Input
                        label="Họ và tên"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                        placeholder="vd: Nguyễn Văn A"
                      />
                      <Input
                        label="Số điện thoại"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="vd: 0912345678"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 text-xs hover:bg-white/80"
                          onClick={() => setIsEditingProfile(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          className="h-8 text-xs shadow-xs hover:scale-105 active:scale-95 transition-transform"
                          loading={updateProfileMutation.isPending}
                        >
                          Lưu thay đổi
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Section 1: Thông tin phân quyền & Trạng thái */}
                  <div className="animate-fade-in-up animation-delay-75 rounded-2xl border border-white/90 bg-white/85 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 space-y-3.5">
                    <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#0532e6]">
                        <Icon name="user-check" className="h-3.5 w-3.5" />
                      </span>
                      Phân quyền & Trạng thái
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-gtext font-medium">Vai trò trong hệ thống:</span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {selectedUser.roles.map((r) => (
                            <RoleBadge key={r} role={r} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gtext font-medium">Trạng thái đăng nhập:</span>
                        <div className="mt-1.5">
                          <StatusBadge status={selectedUser.status} />
                        </div>
                      </div>
                      <div>
                        <span className="text-gtext font-medium">Mã định danh liên kết:</span>
                        <p className="mt-1 font-semibold text-navy">
                          {selectedUser.student_code ? (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono text-xs">
                              Học viên: {selectedUser.student_code}
                            </span>
                          ) : selectedUser.teacher_code ? (
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-mono text-xs">
                              Giảng viên: {selectedUser.teacher_code}
                            </span>
                          ) : (
                            <span className="text-gtext font-normal italic">
                              Không có (Nhân sự nội bộ)
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gtext font-medium">Bắt buộc đổi mật khẩu:</span>
                        <p className="mt-1 font-semibold text-navy">
                          {selectedUser.must_change_password ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-xs">
                              Có (Cần đổi khi đăng nhập)
                            </span>
                          ) : (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                              Không
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-gtext font-medium">Lần đăng nhập cuối:</span>
                        <p className="mt-1 font-semibold text-navy">
                          {selectedUser.last_login_at ? (
                            <span className="tabular-nums text-slate-800">
                              {formatDateTime(selectedUser.last_login_at)}
                            </span>
                          ) : (
                            <span className="text-gtext/80 italic font-normal">
                              Chưa từng đăng nhập
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Quản trị & Nguồn gốc */}
                  <div className="animate-fade-in-up animation-delay-150 rounded-2xl border border-white/90 bg-white/85 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 space-y-3.5">
                    <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#0532e6]">
                        <Icon name="info" className="h-3.5 w-3.5" />
                      </span>
                      Thông tin tạo & Quản trị
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-gtext font-medium">Người tạo tài khoản:</span>
                        <p className="mt-1 font-semibold text-navy">
                          {selectedUser.created_by_email || "Hệ thống (Seed/Admin)"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gtext font-medium">Ngày khởi tạo:</span>
                        <p className="mt-1 font-semibold text-navy tabular-nums">
                          {formatDateTime(selectedUser.created_at)}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-gtext font-medium">Cập nhật lần cuối:</span>
                        <p className="mt-1 font-semibold text-navy tabular-nums">
                          {formatDateTime(selectedUser.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Tab 2: Lịch sử & Kiểm toán (Audit Logs) */
                <div className="space-y-4">
                  <div className="animate-fade-in-up flex items-center justify-between border-b border-gborder/50 pb-2">
                    <h3 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#0532e6]">
                        <Icon name="clock" className="h-3.5 w-3.5" />
                      </span>
                      Nhật ký thay đổi tài khoản
                    </h3>
                    <span className="text-[11px] text-gtext">
                      Ghi nhận mọi thao tác tạo, sửa, reset pass
                    </span>
                  </div>

                  <QueryState
                    loading={auditLogsQuery.isLoading}
                    error={auditLogsQuery.error}
                    empty={!auditLogsQuery.data?.items || auditLogsQuery.data.items.length === 0}
                    emptyTitle="Chưa có lịch sử thay đổi"
                  >
                    <div className="relative ml-4 border-l-2 border-dashed border-[#0532e6]/25 space-y-6 py-2">
                      {auditLogsQuery.data?.items.map((log, index) => {
                        let actionTitle = log.action;
                        let badgeBg = "bg-blue-50 text-blue-700 border-blue-200";
                        if (log.action === "user.create") {
                          actionTitle = "👤 Khởi tạo tài khoản";
                          badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        } else if (log.action === "user.update_status") {
                          actionTitle = "🔒 Cập nhật trạng thái";
                          badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
                        } else if (log.action === "user.reset_password") {
                          actionTitle = "🔑 Đặt lại mật khẩu";
                          badgeBg = "bg-purple-50 text-purple-700 border-purple-200";
                        } else if (log.action === "user.update") {
                          actionTitle = "✏️ Chỉnh sửa thông tin";
                          badgeBg = "bg-blue-50 text-blue-700 border-blue-200";
                        }

                        const delayClass =
                          index === 0
                            ? "animation-delay-75"
                            : index === 1
                              ? "animation-delay-150"
                              : index === 2
                                ? "animation-delay-225"
                                : "animation-delay-300";

                        return (
                          <div
                            key={log.id}
                            className={clsx("animate-fade-in-up relative pl-6 text-xs", delayClass)}
                          >
                            {/* Animated Node Dot */}
                            {index === 0 ? (
                              <div className="absolute -left-[9px] top-1.5 flex h-4 w-4 items-center justify-center">
                                <span className="absolute h-full w-full animate-ping rounded-full bg-[#0532e6]/40 opacity-75"></span>
                                <span className="relative h-3 w-3 rounded-full border-2 border-white bg-[#0532e6] shadow-xs"></span>
                              </div>
                            ) : (
                              <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 shadow-2xs" />
                            )}

                            {/* Card Content with liquid glass polish */}
                            <div className="group rounded-2xl border border-white/90 bg-white/90 p-4 shadow-2xs backdrop-blur-md transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 hover:border-blue-200">
                              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-gborder/40 pb-2">
                                <span
                                  className={clsx(
                                    "inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold shadow-2xs",
                                    badgeBg,
                                  )}
                                >
                                  {actionTitle}
                                </span>
                                <span className="text-gtext tabular-nums text-[11px]">
                                  {formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <div className="mt-2.5 space-y-2 text-gtext">
                                <p className="flex items-center gap-1.5">
                                  <span>Người thực hiện:</span>
                                  <strong className="text-navy bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                                    {log.actor_name || log.actor_email}
                                  </strong>
                                </p>
                                {log.reason && (
                                  <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-amber-900 shadow-2xs">
                                    <span className="font-semibold">Lý do:</span>{" "}
                                    <em>"{log.reason}"</em>
                                  </p>
                                )}
                                {log.new_values && (
                                  <div className="mt-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gtext/80">
                                      Dữ liệu thay đổi (Diff JSON):
                                    </span>
                                    <pre className="mt-1 max-h-28 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[10px] text-emerald-400 shadow-inner">
                                      {JSON.stringify(log.new_values, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </QueryState>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal 1: Tạo tài khoản mới */}
      <Modal
        open={isCreateOpen}
        title="Thêm tài khoản người dùng"
        onClose={() => setIsCreateOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createForm);
          }}
          className="space-y-4"
        >
          <Input
            label="Email đăng nhập *"
            type="email"
            required
            placeholder="vd: nhanvien@congty.com"
            value={createForm.email}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
          />

          <Input
            label="Mật khẩu tạm thời *"
            type="text"
            required
            placeholder="Tối thiểu 8 ký tự"
            value={createForm.password}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên"
              placeholder="vd: Nguyễn Văn A"
              value={createForm.full_name ?? ""}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
            />

            <Input
              label="Số điện thoại"
              placeholder="vd: 0912345678"
              value={createForm.phone ?? ""}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Vai trò tài khoản *"
              value={createForm.role}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as Role }))}
            >
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>

            <Select
              label="Trạng thái khởi tạo *"
              value={createForm.status ?? "active"}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">Hoạt động ngay</option>
              <option value="suspended">Tạm khóa</option>
              <option value="pending">Chờ kích hoạt</option>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gborder">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={createMutation.isPending}>
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Đổi trạng thái tài khoản */}
      <Modal
        open={isStatusModalOpen}
        title="Thay đổi trạng thái tài khoản"
        onClose={() => setIsStatusModalOpen(false)}
      >
        {selectedUser && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateStatusMutation.mutate({
                id: selectedUser.id,
                data: { status: newStatus, reason: statusReason.trim() || undefined },
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-xl bg-gbg/60 p-3.5 border border-gborder text-sm">
              <p className="font-bold text-navy">{selectedUser.full_name || selectedUser.email}</p>
              <p className="text-xs text-gtext">{selectedUser.email}</p>
              <p className="mt-2 text-xs">
                Trạng thái hiện tại: <StatusBadge status={selectedUser.status} />
              </p>
            </div>

            <Select
              label="Trạng thái mới *"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as "active" | "suspended" | "inactive")}
            >
              <option value="active">Đang hoạt động (active)</option>
              <option value="suspended">Tạm khóa đăng nhập (suspended)</option>
              <option value="inactive">Ngừng hoạt động (inactive)</option>
            </Select>

            <Textarea
              label="Lý do thay đổi *"
              required
              placeholder="VD: Nhân viên nghỉ việc, yêu cầu tạm khóa bảo mật..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-gborder">
              <Button type="button" variant="ghost" onClick={() => setIsStatusModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={updateStatusMutation.isPending}>
                Lưu trạng thái
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Đặt lại mật khẩu */}
      <Modal
        open={isResetModalOpen}
        title="Đặt lại mật khẩu tài khoản"
        onClose={() => setIsResetModalOpen(false)}
      >
        {selectedUser && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetPasswordMutation.mutate({
                id: selectedUser.id,
                data: { new_password: newPassword, reason: resetReason.trim() || undefined },
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900">
              <p className="font-bold">Lưu ý bảo mật:</p>
              <p className="mt-1">
                Tài khoản sẽ bị đăng xuất khỏi tất cả thiết bị và người dùng sẽ được yêu cầu đổi mật
                khẩu mới trong lần đăng nhập đầu tiên.
              </p>
            </div>

            <Input
              label="Mật khẩu tạm thời mới *"
              type="text"
              required
              placeholder="Tối thiểu 8 ký tự"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Input
              label="Lý do đặt lại mật khẩu"
              placeholder="VD: Người dùng quên mật khẩu, yêu cầu cấp lại..."
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-gborder">
              <Button type="button" variant="ghost" onClick={() => setIsResetModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" loading={resetPasswordMutation.isPending}>
                Đặt lại mật khẩu
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
