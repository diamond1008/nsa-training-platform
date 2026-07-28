import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { currentWeekStart, monthRange, WeekCalendar, weekRange } from "../../components/calendar";
import type { CalendarView, WeekCalendarEvent } from "../../components/calendar";
import {
  AttendanceRoster,
  DataTable,
  Pagination,
  QueryState,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "../../components/data";
import { Icon } from "../../components/icons";
import {
  Button,
  Badge,
  Card,
  ErrorBanner,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../../components/ui";
import { ApiRequestError } from "../../lib/apiClient";
import type { Course, Paginated, Student, Teacher, TrainingClass } from "../../lib/domainTypes";
import { formatDate, formatDateTime } from "../../lib/format";
import { adminApi } from "./adminApi";

function mutationMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : "Không thể lưu dữ liệu. Vui lòng thử lại.";
}

function SearchFilters({
  search,
  status,
  statusOptions,
  onSearch,
  onStatus,
}: {
  search: string;
  status: string;
  statusOptions: Array<[string, string]>;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
}) {
  return (
    <div className="mb-5 grid gap-3 rounded-2xl border border-gborder bg-white p-4 shadow-card sm:grid-cols-[1fr_220px]">
      <Input
        label="Tìm kiếm"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Nhập mã, tên hoặc email…"
      />
      <Select label="Trạng thái" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">Tất cả</option>
        {statusOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function AdminDashboardPage() {
  const students = useQuery({
    queryKey: ["admin", "students", "count"],
    queryFn: () => adminApi.students({ page: 1, per_page: 1 }),
  });
  const teachers = useQuery({
    queryKey: ["admin", "teachers", "count"],
    queryFn: () => adminApi.teachers({ page: 1, per_page: 1 }),
  });
  const courses = useQuery({
    queryKey: ["admin", "courses", "count"],
    queryFn: () => adminApi.courses({ page: 1, per_page: 1 }),
  });
  const classes = useQuery({
    queryKey: ["admin", "classes", "count"],
    queryFn: () => adminApi.classes({ page: 1, per_page: 1 }),
  });
  const schedule = useQuery({
    queryKey: ["admin", "sessions", "dashboard"],
    queryFn: () => adminApi.sessions({ page: 1, per_page: 5, from: new Date().toISOString() }),
  });
  const loading = [students, teachers, courses, classes, schedule].some((q) => q.isLoading);
  const error = [students, teachers, courses, classes, schedule].find((q) => q.error)?.error;
  return (
    <div>
      <PageHeader
        eyebrow="Trung tâm điều hành"
        title="Tổng quan đào tạo"
        subtitle="Nắm bắt quy mô hệ thống, lịch vận hành và truy cập nhanh các nghiệp vụ quan trọng."
        actions={
          <Link to="/admin/lich-hoc">
            <Button variant="accent">
              <Icon name="plus" className="h-4 w-4" />
              Tạo buổi học
            </Button>
          </Link>
        }
      />
      <QueryState loading={loading} error={error}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Học viên"
            value={students.data?.meta.total ?? 0}
            hint="Hồ sơ trên hệ thống"
            icon="users"
          />
          <StatCard
            label="Giảng viên"
            value={teachers.data?.meta.total ?? 0}
            hint="Nguồn lực đào tạo"
            icon="teacher"
            tone="blue"
          />
          <StatCard
            label="Khóa học"
            value={courses.data?.meta.total ?? 0}
            hint="Chương trình đào tạo"
            icon="book"
            tone="gold"
          />
          <StatCard
            label="Lớp học"
            value={classes.data?.meta.total ?? 0}
            hint="Đang được quản lý"
            icon="school"
            tone="green"
          />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <Card>
            <SectionHeader
              title="Lịch đào tạo sắp tới"
              subtitle="5 buổi gần nhất trên toàn hệ thống"
              action={
                <Link className="text-xs font-semibold text-gold-dark" to="/admin/lich-hoc">
                  Xem lịch →
                </Link>
              }
            />
            <div className="space-y-2">
              {schedule.data?.items.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-gborder px-3.5 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                    <Icon name="calendar" className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{session.title}</b>
                    <p className="mt-0.5 truncate text-xs text-gtext">
                      {session.class_code} · {formatDateTime(session.starts_at)}
                    </p>
                  </div>
                  <StatusBadge value={session.status} />
                </div>
              ))}
              {!schedule.data?.items.length && (
                <p className="rounded-xl bg-gbg2 p-4 text-sm text-gtext">Chưa có lịch sắp tới.</p>
              )}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Tình trạng vận hành" subtitle="Tổng quan nhanh hôm nay" />
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-success-bg p-4">
                <div className="flex items-center gap-3">
                  <Icon name="check" className="h-5 w-5 text-success" />
                  <div>
                    <b className="text-sm">Hệ thống hoạt động</b>
                    <p className="text-xs text-gtext">API và dữ liệu sẵn sàng</p>
                  </div>
                </div>
                <Badge tone="green">Ổn định</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gold/10 p-4">
                <div className="flex items-center gap-3">
                  <Icon name="clock" className="h-5 w-5 text-gold-dark" />
                  <div>
                    <b className="text-sm">Buổi sắp tới</b>
                    <p className="text-xs text-gtext">Cần theo dõi lịch</p>
                  </div>
                </div>
                <b>{schedule.data?.meta.total ?? 0}</b>
              </div>
            </div>
          </Card>
        </div>
      </QueryState>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link to="/admin/hoc-vien">
          <QuickAction
            title="Quản lý học viên"
            description="Tạo tài khoản và cập nhật hồ sơ học viên."
            icon="users"
          />
        </Link>
        <Link to="/admin/lop-hoc">
          <QuickAction
            title="Lớp học & phân công"
            description="Ghi danh học viên và phân công giảng viên."
            icon="school"
          />
        </Link>
        <Link to="/admin/lich-hoc">
          <QuickAction
            title="Quản lý lịch học"
            description="Tạo buổi học, theo dõi điểm danh và xung đột."
            icon="calendar"
          />
        </Link>
      </div>
    </div>
  );
}

type PersonKind = "student" | "teacher";
type Person = Student | Teacher;

function PersonDirectory({ kind }: { kind: PersonKind }) {
  const isStudent = kind === "student";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [open, setOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const query = useQuery<Paginated<Person>>({
    queryKey: ["admin", kind, page, search, status],
    queryFn: async () => {
      if (isStudent)
        return (await adminApi.students({
          page,
          per_page: 10,
          search,
          status,
        })) as Paginated<Person>;
      return (await adminApi.teachers({ page, per_page: 10, search, status })) as Paginated<Person>;
    },
  });
  const mutation = useMutation<Person, Error, { id?: string; body: unknown }>({
    mutationFn: async ({ id, body }) => {
      if (isStudent)
        return (await (id
          ? adminApi.updateStudent(id, body)
          : adminApi.createStudent(body))) as Person;
      return (await (id
        ? adminApi.updateTeacher(id, body)
        : adminApi.createTeacher(body))) as Person;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", kind] });
      setOpen(false);
      setEditing(null);
    },
  });
  const importMutation = useMutation({
    mutationFn: async (file: File) => adminApi.importStudents(await file.text()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "students"] }),
  });
  const exportMutation = useMutation({
    mutationFn: () => adminApi.exportStudents({ search, status }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "danh-sach-hoc-vien.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const items = (query.data?.items ?? []) as Person[];
  const openCreate = () => {
    setEditing(null);
    mutation.reset();
    setOpen(true);
  };
  const title = isStudent ? "Học viên" : "Giảng viên";
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`Quản lý tài khoản và hồ sơ ${title.toLowerCase()}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {isStudent ? (
              <>
                <input
                  ref={importInput}
                  className="hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importMutation.mutate(file);
                    event.target.value = "";
                  }}
                />
                <Button variant="soft" onClick={() => importInput.current?.click()}>
                  Nhập CSV
                </Button>
                <Button
                  variant="soft"
                  loading={exportMutation.isPending}
                  onClick={() => exportMutation.mutate()}
                >
                  Xuất CSV
                </Button>
              </>
            ) : null}
            <Button onClick={openCreate}>
              <Icon name="plus" className="h-4 w-4" />
              Thêm {title.toLowerCase()}
            </Button>
          </div>
        }
      />
      <SearchFilters
        search={search}
        status={status}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        statusOptions={
          isStudent
            ? [
                ["active", "Hoạt động"],
                ["pending", "Chờ xử lý"],
                ["suspended", "Tạm nghỉ"],
                ["completed", "Đã hoàn thành"],
                ["withdrawn", "Đã rút"],
              ]
            : [
                ["active", "Hoạt động"],
                ["inactive", "Không hoạt động"],
              ]
        }
      />
      {isStudent && importMutation.data ? (
        <Card className="mb-5 border-emerald-200 bg-emerald-50 p-4 text-sm">
          Đã nhập <b>{importMutation.data.imported}</b> học viên; lỗi{" "}
          <b>{importMutation.data.failed}</b> dòng.
          {importMutation.data.errors.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700">
              {importMutation.data.errors.slice(0, 10).map((item) => (
                <li key={`${item.row}-${item.email ?? ""}`}>
                  Dòng {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
      {isStudent && importMutation.error ? (
        <div className="mb-5">
          <ErrorBanner message={mutationMessage(importMutation.error)} />
        </div>
      ) : null}
      {isStudent && exportMutation.error ? (
        <div className="mb-5">
          <ErrorBanner message={mutationMessage(exportMutation.error)} />
        </div>
      ) : null}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!query.isLoading && items.length === 0}
      >
        <DataTable
          items={items}
          columns={[
            {
              header: "Mã",
              cell: (p) => (
                <span className="font-semibold text-navy">
                  {isStudent ? (p as Student).student_code : (p as Teacher).teacher_code}
                </span>
              ),
            },
            { header: "Họ tên", cell: (p) => p.full_name },
            { header: "Email", cell: (p) => p.email },
            ...(isStudent
              ? [
                  {
                    header: "Liên hệ",
                    cell: (p: Person) => (p as Student).phone || "Chưa cập nhật",
                  },
                ]
              : []),
            { header: "Trạng thái", cell: (p) => <StatusBadge value={p.status} /> },
            {
              header: "",
              cell: (p) => (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(p);
                    mutation.reset();
                    setOpen(true);
                  }}
                >
                  Chỉnh sửa
                </Button>
              ),
            },
          ]}
        />
        <Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} />
      </QueryState>
      <Modal
        open={open}
        title={`${editing ? "Cập nhật" : "Thêm"} ${title.toLowerCase()}`}
        onClose={() => setOpen(false)}
      >
        <PersonForm
          kind={kind}
          initial={editing}
          loading={mutation.isPending}
          error={mutation.error}
          onSubmit={(body) => mutation.mutate({ id: editing?.id, body })}
        />
      </Modal>
    </div>
  );
}

function PersonForm({
  kind,
  initial,
  loading,
  error,
  onSubmit,
}: {
  kind: PersonKind;
  initial: Person | null;
  loading: boolean;
  error: Error | null;
  onSubmit: (body: unknown) => void;
}) {
  const isStudent = kind === "student";
  const initialCode = initial
    ? isStudent
      ? (initial as Student).student_code
      : (initial as Teacher).teacher_code
    : "";
  const [form, setForm] = useState({
    email: initial?.email ?? "",
    temporary_password: "",
    code: initialCode,
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    extra:
      initial && !isStudent
        ? ((initial as Teacher).specialization ?? "")
        : initial && isStudent
          ? ((initial as Student).date_of_birth ?? "")
          : "",
    status: initial?.status ?? "active",
    account_status: initial?.account_status ?? "active",
    enrolled_at: initial && isStudent ? ((initial as Student).enrolled_at ?? "") : "",
    gender: initial && isStudent ? ((initial as Student).gender ?? "") : "",
    address: initial && isStudent ? ((initial as Student).address ?? "") : "",
    emergency_contact_name:
      initial && isStudent ? ((initial as Student).emergency_contact_name ?? "") : "",
    emergency_contact_phone:
      initial && isStudent ? ((initial as Student).emergency_contact_phone ?? "") : "",
    status_change_reason: "",
  });
  const history = useQuery({
    queryKey: ["admin", "students", initial?.id, "status-history"],
    queryFn: () => adminApi.studentStatusHistory(initial!.id),
    enabled: isStudent && Boolean(initial?.id),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const common = {
      email: form.email.trim(),
      account_status: form.account_status,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      status: form.status,
    };
    const body = isStudent
      ? {
          ...common,
          date_of_birth: form.extra || null,
          enrolled_at: form.enrolled_at || null,
          gender: form.gender || null,
          address: form.address.trim() || null,
          emergency_contact_name: form.emergency_contact_name.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone.trim() || null,
          status_change_reason: form.status_change_reason.trim() || null,
          ...(initial ? {} : { temporary_password: form.temporary_password }),
        }
      : {
          ...common,
          teacher_code: form.code.trim(),
          specialization: form.extra.trim() || null,
          ...(initial ? {} : { temporary_password: form.temporary_password }),
        };
    onSubmit(body);
  };
  const update = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <form className="space-y-4" onSubmit={submit}>
      {error ? <ErrorBanner message={mutationMessage(error)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
        {isStudent ? (
          <Input
            label="Mã học viên"
            value={initial ? form.code : "Tự động tạo dạng HV00000001"}
            disabled
          />
        ) : (
          <Input
            required
            label="Mã giảng viên"
            value={form.code}
            onChange={(e) => update("code", e.target.value)}
          />
        )}
      </div>
      {isStudent ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Giới tính"
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">Chưa cập nhật</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
              <option value="unspecified">Không muốn cung cấp</option>
            </Select>
            <Input
              label="Ngày nhập học"
              type="date"
              value={form.enrolled_at}
              onChange={(e) => update("enrolled_at", e.target.value)}
            />
          </div>
          <Textarea
            label="Địa chỉ"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Người liên hệ khẩn cấp"
              value={form.emergency_contact_name}
              onChange={(e) => update("emergency_contact_name", e.target.value)}
            />
            <Input
              label="SĐT liên hệ khẩn cấp"
              value={form.emergency_contact_phone}
              onChange={(e) => update("emergency_contact_phone", e.target.value)}
            />
          </div>
        </>
      ) : null}
      <Input
        required
        label="Họ và tên"
        value={form.full_name}
        onChange={(e) => update("full_name", e.target.value)}
      />
      {!initial && (
        <Input
          required
          minLength={8}
          label="Mật khẩu tạm thời"
          type="password"
          value={form.temporary_password}
          onChange={(e) => update("temporary_password", e.target.value)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Điện thoại"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
        />
        <Input
          label={isStudent ? "Ngày sinh" : "Chuyên môn"}
          type={isStudent ? "date" : "text"}
          value={form.extra}
          onChange={(e) => update("extra", e.target.value)}
        />
      </div>
      {isStudent && initial && form.status !== initial.status ? (
        <Textarea
          required
          label="Lý do thay đổi trạng thái"
          value={form.status_change_reason}
          onChange={(e) => update("status_change_reason", e.target.value)}
          placeholder="Ví dụ: Học viên xin tạm nghỉ đến tháng 9"
        />
      ) : null}
      {isStudent && initial ? (
        <div className="rounded-2xl border border-gborder bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-navy">Lịch sử trạng thái</p>
          {history.isLoading ? <p className="text-sm text-muted">Đang tải…</p> : null}
          {history.error ? <ErrorBanner message="Không thể tải lịch sử trạng thái." /> : null}
          <div className="space-y-3">
            {(history.data ?? []).map((item) => (
              <div key={item.id} className="border-l-2 border-gold pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {item.from_status ? <StatusBadge value={item.from_status} /> : <Badge>Mới</Badge>}
                  <span aria-hidden="true">→</span>
                  <StatusBadge value={item.to_status} />
                </div>
                <p className="mt-1 text-navy">{item.reason}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(item.changed_at)} · {item.changed_by_email ?? "Hệ thống"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Trạng thái hồ sơ"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
        >
          {(isStudent
            ? ["pending", "active", "suspended", "completed", "withdrawn"]
            : ["active", "inactive"]
          ).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <Select
          label="Trạng thái tài khoản"
          value={form.account_status}
          onChange={(e) => update("account_status", e.target.value)}
        >
          {["pending", "active", "suspended", "inactive"].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Lưu thông tin
        </Button>
      </div>
    </form>
  );
}

export function StudentsPage() {
  return <PersonDirectory kind="student" />;
}
export function TeachersPage() {
  return <PersonDirectory kind="teacher" />;
}

export function CoursesPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "courses", page, search, status],
    queryFn: () => adminApi.courses({ page, per_page: 10, search, status }),
  });
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? adminApi.updateCourse(id, body) : adminApi.createCourse(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "courses"] });
      setOpen(false);
    },
  });
  return (
    <div>
      <PageHeader
        title="Khóa học"
        subtitle="Quản lý chương trình và yêu cầu hoàn thành."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Icon name="plus" className="h-4 w-4" /> Thêm khóa học
          </Button>
        }
      />
      <SearchFilters
        search={search}
        status={status}
        onSearch={setSearch}
        onStatus={setStatus}
        statusOptions={[
          ["draft", "Bản nháp"],
          ["active", "Hoạt động"],
          ["inactive", "Không hoạt động"],
          ["archived", "Lưu trữ"],
        ]}
      />
      <QueryState loading={query.isLoading} error={query.error}>
        <DataTable
          items={query.data?.items ?? []}
          columns={[
            { header: "Mã", cell: (c) => <b className="text-navy">{c.code}</b> },
            { header: "Tên khóa học", cell: (c) => c.name },
            { header: "Số buổi", cell: (c) => c.total_sessions },
            { header: "Chuyên cần tối thiểu", cell: (c) => `${c.minimum_attendance_pct}%` },
            { header: "Trạng thái", cell: (c) => <StatusBadge value={c.status} /> },
            {
              header: "",
              cell: (c) => (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
                  Chỉnh sửa
                </Button>
              ),
            },
          ]}
        />
        <Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} />
      </QueryState>
      <Modal
        open={open}
        title={`${editing ? "Cập nhật" : "Thêm"} khóa học`}
        onClose={() => setOpen(false)}
      >
        <CourseForm
          initial={editing}
          loading={mutation.isPending}
          error={mutation.error}
          onSubmit={(body) => mutation.mutate({ id: editing?.id, body })}
        />
      </Modal>
    </div>
  );
}

function CourseForm({
  initial,
  loading,
  error,
  onSubmit,
}: {
  initial: Course | null;
  loading: boolean;
  error: Error | null;
  onSubmit: (body: unknown) => void;
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    total_sessions: initial?.total_sessions ?? 1,
    minimum_attendance_pct: initial?.minimum_attendance_pct ?? 80,
    status: initial?.status ?? "draft",
  });
  const update = (k: string, v: string | number) => setForm((o) => ({ ...o, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, description: form.description || null });
      }}
    >
      {error && <ErrorBanner message={mutationMessage(error)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          label="Mã khóa học"
          value={form.code}
          onChange={(e) => update("code", e.target.value)}
        />
        <Input
          required
          label="Tên khóa học"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>
      <Textarea
        label="Mô tả"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          required
          min={1}
          label="Tổng số buổi"
          type="number"
          value={form.total_sessions}
          onChange={(e) => update("total_sessions", Number(e.target.value))}
        />
        <Input
          required
          min={0}
          max={100}
          label="Chuyên cần tối thiểu (%)"
          type="number"
          value={form.minimum_attendance_pct}
          onChange={(e) => update("minimum_attendance_pct", Number(e.target.value))}
        />
        <Select
          label="Trạng thái"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
        >
          {["draft", "active", "inactive", "archived"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Lưu khóa học
        </Button>
      </div>
    </form>
  );
}

export function ClassesPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<TrainingClass | null>(null);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "classes", page, search, status],
    queryFn: () => adminApi.classes({ page, per_page: 10, search, status }),
  });
  const courses = useQuery({
    queryKey: ["admin", "courses", "options"],
    queryFn: () => adminApi.courses({ page: 1, per_page: 100 }),
  });
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? adminApi.updateClass(id, body) : adminApi.createClass(body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "classes"] });
      setOpen(false);
    },
  });
  return (
    <div>
      <PageHeader
        title="Lớp học"
        subtitle="Quản lý lớp, sĩ số, ghi danh và phân công."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Icon name="plus" className="h-4 w-4" /> Tạo lớp
          </Button>
        }
      />
      <SearchFilters
        search={search}
        status={status}
        onSearch={setSearch}
        onStatus={setStatus}
        statusOptions={[
          ["planning", "Chuẩn bị"],
          ["open", "Đang mở"],
          ["in_progress", "Đang diễn ra"],
          ["completed", "Hoàn thành"],
          ["cancelled", "Đã hủy"],
        ]}
      />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <DataTable
          items={query.data?.items ?? []}
          columns={[
            {
              header: "Lớp",
              cell: (c) => (
                <div>
                  <b className="text-navy">{c.class_code}</b>
                  <div className="text-xs text-gtext">{c.name}</div>
                </div>
              ),
            },
            { header: "Khóa học", cell: (c) => `${c.course_code} — ${c.course_name}` },
            {
              header: "Thời gian",
              cell: (c) => `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`,
            },
            { header: "Sĩ số", cell: (c) => `${c.enrolled_students}/${c.maximum_students}` },
            { header: "Trạng thái", cell: (c) => <StatusBadge value={c.status} /> },
            {
              header: "",
              cell: (c) => (
                <div className="flex gap-2">
                  <Link to={`/admin/lop-hoc/${c.id}`}>
                    <Button variant="ghost">Chi tiết</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(c);
                      setOpen(true);
                    }}
                  >
                    Sửa
                  </Button>
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} />
      </QueryState>
      <Modal
        open={open}
        title={`${editing ? "Cập nhật" : "Tạo"} lớp học`}
        onClose={() => setOpen(false)}
      >
        <ClassForm
          initial={editing}
          courses={courses.data?.items ?? []}
          loading={mutation.isPending}
          error={mutation.error}
          onSubmit={(body) => mutation.mutate({ id: editing?.id, body })}
        />
      </Modal>
    </div>
  );
}

function ClassForm({
  initial,
  courses,
  loading,
  error,
  onSubmit,
}: {
  initial: TrainingClass | null;
  courses: Course[];
  loading: boolean;
  error: Error | null;
  onSubmit: (body: unknown) => void;
}) {
  const [form, setForm] = useState({
    course_id: initial?.course_id ?? courses[0]?.id ?? "",
    class_code: initial?.class_code ?? "",
    name: initial?.name ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    maximum_students: initial?.maximum_students ?? 20,
    status: initial?.status ?? "planning",
  });
  const update = (k: string, v: string | number) => setForm((o) => ({ ...o, [k]: v }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      {error && <ErrorBanner message={mutationMessage(error)} />}
      <Select
        required
        label="Khóa học"
        value={form.course_id}
        onChange={(e) => update("course_id", e.target.value)}
      >
        <option value="">Chọn khóa học</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          label="Mã lớp"
          value={form.class_code}
          onChange={(e) => update("class_code", e.target.value)}
        />
        <Input
          required
          label="Tên lớp"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          label="Ngày bắt đầu"
          type="date"
          value={form.start_date}
          onChange={(e) => update("start_date", e.target.value)}
        />
        <Input
          required
          label="Ngày kết thúc"
          type="date"
          value={form.end_date}
          onChange={(e) => update("end_date", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          min={1}
          label="Sĩ số tối đa"
          type="number"
          value={form.maximum_students}
          onChange={(e) => update("maximum_students", Number(e.target.value))}
        />
        <Select
          label="Trạng thái"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
        >
          {["planning", "open", "in_progress", "completed", "cancelled", "archived"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Lưu lớp học
        </Button>
      </div>
    </form>
  );
}

export function ClassDetailPage() {
  const { classId = "" } = useParams();
  const client = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [role, setRole] = useState("Giảng viên phụ trách");
  const detail = useQuery({
    queryKey: ["admin", "class", classId],
    queryFn: () => adminApi.getClass(classId),
    enabled: !!classId,
  });
  const enrollments = useQuery({
    queryKey: ["admin", "class", classId, "enrollments"],
    queryFn: () => adminApi.enrollments(classId),
    enabled: !!classId,
  });
  const assignments = useQuery({
    queryKey: ["admin", "class", classId, "assignments"],
    queryFn: () => adminApi.assignments(classId),
    enabled: !!classId,
  });
  const students = useQuery({
    queryKey: ["admin", "students", "options"],
    queryFn: () => adminApi.students({ page: 1, per_page: 100, status: "active" }),
  });
  const teachers = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: () => adminApi.teachers({ page: 1, per_page: 100, status: "active" }),
  });
  const enroll = useMutation({
    mutationFn: () => adminApi.enroll(classId, studentId),
    onSuccess: () => {
      setStudentId("");
      void client.invalidateQueries({ queryKey: ["admin", "class", classId] });
    },
  });
  const assign = useMutation({
    mutationFn: () => adminApi.assign(classId, teacherId, role),
    onSuccess: () => {
      setTeacherId("");
      void client.invalidateQueries({ queryKey: ["admin", "class", classId, "assignments"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.removeAssignment(classId, id),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["admin", "class", classId, "assignments"] }),
  });
  return (
    <div>
      <PageHeader
        title={detail.data ? `${detail.data.class_code} — ${detail.data.name}` : "Chi tiết lớp"}
        subtitle={detail.data?.course_name}
        actions={
          <Link to="/admin/lop-hoc">
            <Button variant="ghost">
              <Icon name="arrow-left" className="h-4 w-4" />
              Danh sách lớp
            </Button>
          </Link>
        }
      />
      <QueryState loading={detail.isLoading} error={detail.error}>
        {detail.data && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Sĩ số"
              value={`${detail.data.enrolled_students}/${detail.data.maximum_students}`}
            />
            <StatCard label="Bắt đầu" value={formatDate(detail.data.start_date)} />
            <StatCard label="Trạng thái" value={<StatusBadge value={detail.data.status} />} />
          </div>
        )}
      </QueryState>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold text-navy">Ghi danh học viên</h2>
          {enroll.error && <ErrorBanner message={mutationMessage(enroll.error)} />}
          <div className="mb-4 flex gap-2">
            <Select
              label="Học viên"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Chọn học viên</option>
              {students.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_code} — {s.full_name}
                </option>
              ))}
            </Select>
            <Button
              className="mt-6"
              disabled={!studentId}
              loading={enroll.isPending}
              onClick={() => enroll.mutate()}
            >
              Ghi danh
            </Button>
          </div>
          <QueryState
            loading={enrollments.isLoading}
            error={enrollments.error}
            empty={!enrollments.data?.length}
            emptyTitle="Lớp chưa có học viên"
          >
            <div className="space-y-2">
              {enrollments.data?.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-gborder p-3"
                >
                  <div>
                    <b>{e.student_code}</b>
                    <p className="text-sm text-gtext">{e.full_name}</p>
                  </div>
                  <StatusBadge value={e.status} />
                </div>
              ))}
            </div>
          </QueryState>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold text-navy">Phân công giảng viên</h2>
          {(assign.error || remove.error) && (
            <ErrorBanner message={mutationMessage(assign.error || remove.error)} />
          )}
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Select
              label="Giảng viên"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Chọn giảng viên</option>
              {teachers.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teacher_code} — {t.full_name}
                </option>
              ))}
            </Select>
            <Input label="Vai trò" value={role} onChange={(e) => setRole(e.target.value)} />
            <Button
              className="mt-6"
              disabled={!teacherId || !role}
              loading={assign.isPending}
              onClick={() => assign.mutate()}
            >
              Phân công
            </Button>
          </div>
          <QueryState
            loading={assignments.isLoading}
            error={assignments.error}
            empty={!assignments.data?.length}
            emptyTitle="Chưa phân công giảng viên"
          >
            <div className="space-y-2">
              {assignments.data?.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-gborder p-3"
                >
                  <div>
                    <b>
                      {a.teacher_code} — {a.full_name}
                    </b>
                    <p className="text-sm text-gtext">{a.assignment_role}</p>
                  </div>
                  <Button
                    variant="danger"
                    loading={remove.isPending}
                    onClick={() => remove.mutate(a.id)}
                  >
                    Gỡ
                  </Button>
                </div>
              ))}
            </div>
          </QueryState>
        </Card>
      </div>
    </div>
  );
}

export function ScheduleAdminPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [calendarAnchor, setCalendarAnchor] = useState(currentWeekStart);
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const calendarRange =
    calendarView === "week" ? weekRange(calendarAnchor) : monthRange(calendarAnchor);
  const query = useQuery({
    queryKey: ["admin", "sessions", "calendar", calendarView, calendarAnchor],
    queryFn: () =>
      adminApi.sessions({ page: 1, per_page: 100, from: calendarRange.from, to: calendarRange.to }),
  });
  const classes = useQuery({
    queryKey: ["admin", "classes", "options"],
    queryFn: () => adminApi.classes({ page: 1, per_page: 100 }),
  });
  const teachers = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: () => adminApi.teachers({ page: 1, per_page: 100, status: "active" }),
  });
  const locations = useQuery({
    queryKey: ["admin", "locations", "options"],
    queryFn: () => adminApi.locations({ page: 1, per_page: 100 }),
  });
  const attendance = useQuery({
    queryKey: ["admin", "session-attendance", attendanceSessionId],
    queryFn: () => adminApi.sessionAttendance(attendanceSessionId),
    enabled: !!attendanceSessionId,
  });
  const mutation = useMutation({
    mutationFn: adminApi.createSession,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "sessions"] });
      setOpen(false);
    },
  });
  const events: WeekCalendarEvent[] = (query.data?.items ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    subtitle: `${session.class_code} · ${session.teacher_name ?? "Chưa phân công"}`,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    tone:
      session.status === "cancelled"
        ? "red"
        : session.attendance_locked_at
          ? "green"
          : session.session_type === "assessment"
            ? "gold"
            : "navy",
  }));
  return (
    <div>
      <PageHeader
        eyebrow="Điều phối đào tạo"
        title="Lịch học"
        subtitle="Lập lịch, theo dõi giảng viên và xem điểm danh trên một lịch thống nhất."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Tạo buổi học
          </Button>
        }
      />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <WeekCalendar
          events={events}
          weekStart={calendarAnchor}
          onWeekStartChange={setCalendarAnchor}
          view={calendarView}
          onViewChange={setCalendarView}
          onEventClick={(event) => setAttendanceSessionId(event.id)}
        />
      </QueryState>
      <Modal open={open} title="Tạo buổi học" onClose={() => setOpen(false)}>
        <SessionForm
          classes={classes.data?.items ?? []}
          teachers={teachers.data?.items ?? []}
          locations={locations.data?.items ?? []}
          loading={mutation.isPending}
          error={mutation.error}
          onSubmit={(body) => mutation.mutate(body)}
        />
      </Modal>
      <Modal
        open={!!attendanceSessionId}
        title={
          query.data?.items.find((item) => item.id === attendanceSessionId)?.title ??
          "Tình trạng điểm danh"
        }
        onClose={() => setAttendanceSessionId("")}
      >
        <QueryState loading={attendance.isLoading} error={attendance.error}>
          {attendance.data && <AttendanceRoster data={attendance.data} />}
        </QueryState>
      </Modal>
    </div>
  );
}

function SessionForm({
  classes,
  teachers,
  locations,
  loading,
  error,
  onSubmit,
}: {
  classes: TrainingClass[];
  teachers: Teacher[];
  locations: Array<{ id: string; code: string; name: string }>;
  loading: boolean;
  error: Error | null;
  onSubmit: (body: unknown) => void;
}) {
  const [form, setForm] = useState({
    class_id: "",
    teacher_id: "",
    location_id: "",
    title: "",
    session_type: "theory",
    starts_at: "",
    ends_at: "",
    status: "scheduled",
  });
  const update = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  const body = useMemo(
    () => ({
      ...form,
      module_id: null,
      teacher_id: form.teacher_id || null,
      location_id: form.location_id || null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "",
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "",
    }),
    [form],
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(body);
      }}
    >
      {error && <ErrorBanner message={mutationMessage(error)} />}
      <Select
        required
        label="Lớp học"
        value={form.class_id}
        onChange={(e) => update("class_id", e.target.value)}
      >
        <option value="">Chọn lớp</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.class_code} — {c.name}
          </option>
        ))}
      </Select>
      <Input
        required
        label="Tiêu đề buổi học"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          required
          label="Bắt đầu"
          type="datetime-local"
          value={form.starts_at}
          onChange={(e) => update("starts_at", e.target.value)}
        />
        <Input
          required
          label="Kết thúc"
          type="datetime-local"
          value={form.ends_at}
          onChange={(e) => update("ends_at", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Loại buổi"
          value={form.session_type}
          onChange={(e) => update("session_type", e.target.value)}
        >
          {["theory", "workshop", "assessment", "other"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <Select
          label="Giảng viên"
          value={form.teacher_id}
          onChange={(e) => update("teacher_id", e.target.value)}
        >
          <option value="">Chưa chọn</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teacher_code} — {t.full_name}
            </option>
          ))}
        </Select>
        <Select
          label="Địa điểm"
          value={form.location_id}
          onChange={(e) => update("location_id", e.target.value)}
        >
          <option value="">Chưa chọn</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Tạo buổi học
        </Button>
      </div>
    </form>
  );
}
