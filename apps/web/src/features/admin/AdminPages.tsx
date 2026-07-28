import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { DataTable, Pagination, QueryState, StatCard, StatusBadge } from "../../components/data";
import { Button, Card, ErrorBanner, Input, Modal, PageHeader, Select, Textarea } from "../../components/ui";
import { ApiRequestError } from "../../lib/apiClient";
import type { Course, Paginated, Student, Teacher, TrainingClass } from "../../lib/domainTypes";
import { formatDate, formatDateTime } from "../../lib/format";
import { adminApi } from "./adminApi";

function mutationMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : "Không thể lưu dữ liệu. Vui lòng thử lại.";
}

function SearchFilters({ search, status, statusOptions, onSearch, onStatus }: {
  search: string; status: string; statusOptions: Array<[string, string]>;
  onSearch: (value: string) => void; onStatus: (value: string) => void;
}) {
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-gborder bg-white p-4 sm:grid-cols-[1fr_220px]">
      <Input label="Tìm kiếm" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Nhập mã, tên hoặc email…" />
      <Select label="Trạng thái" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">Tất cả</option>
        {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </div>
  );
}

export function AdminDashboardPage() {
  const students = useQuery({ queryKey: ["admin", "students", "count"], queryFn: () => adminApi.students({ page: 1, per_page: 1 }) });
  const teachers = useQuery({ queryKey: ["admin", "teachers", "count"], queryFn: () => adminApi.teachers({ page: 1, per_page: 1 }) });
  const courses = useQuery({ queryKey: ["admin", "courses", "count"], queryFn: () => adminApi.courses({ page: 1, per_page: 1 }) });
  const classes = useQuery({ queryKey: ["admin", "classes", "count"], queryFn: () => adminApi.classes({ page: 1, per_page: 1 }) });
  const loading = [students, teachers, courses, classes].some((q) => q.isLoading);
  const error = [students, teachers, courses, classes].find((q) => q.error)?.error;
  return (
    <div>
      <PageHeader title="Tổng quan Quản trị" subtitle="Theo dõi dữ liệu đào tạo và đi nhanh tới các nghiệp vụ chính." />
      <QueryState loading={loading} error={error}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Học viên" value={students.data?.meta.total ?? 0} />
          <StatCard label="Giảng viên" value={teachers.data?.meta.total ?? 0} />
          <StatCard label="Khóa học" value={courses.data?.meta.total ?? 0} />
          <StatCard label="Lớp học" value={classes.data?.meta.total ?? 0} />
        </div>
      </QueryState>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link to="/admin/hoc-vien"><Card className="h-full hover:border-gold"><h2 className="font-semibold text-navy">Quản lý học viên</h2><p className="mt-1 text-sm text-gtext">Tạo tài khoản và cập nhật hồ sơ.</p></Card></Link>
        <Link to="/admin/lop-hoc"><Card className="h-full hover:border-gold"><h2 className="font-semibold text-navy">Lớp học và phân công</h2><p className="mt-1 text-sm text-gtext">Ghi danh học viên, phân công giảng viên.</p></Card></Link>
        <Link to="/admin/lich-hoc"><Card className="h-full hover:border-gold"><h2 className="font-semibold text-navy">Lịch học</h2><p className="mt-1 text-sm text-gtext">Tạo buổi học và kiểm tra xung đột.</p></Card></Link>
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
  const query = useQuery<Paginated<Person>>({
    queryKey: ["admin", kind, page, search, status],
    queryFn: async () => {
      if (isStudent) return (await adminApi.students({ page, per_page: 10, search, status })) as Paginated<Person>;
      return (await adminApi.teachers({ page, per_page: 10, search, status })) as Paginated<Person>;
    },
  });
  const mutation = useMutation<Person, Error, { id?: string; body: unknown }>({
    mutationFn: async ({ id, body }) => {
      if (isStudent) return (await (id ? adminApi.updateStudent(id, body) : adminApi.createStudent(body))) as Person;
      return (await (id ? adminApi.updateTeacher(id, body) : adminApi.createTeacher(body))) as Person;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin", kind] }); setOpen(false); setEditing(null); },
  });
  const items = (query.data?.items ?? []) as Person[];
  const openCreate = () => { setEditing(null); mutation.reset(); setOpen(true); };
  const title = isStudent ? "Học viên" : "Giảng viên";
  return (
    <div>
      <PageHeader title={title} subtitle={`Quản lý tài khoản và hồ sơ ${title.toLowerCase()}.`} actions={<Button onClick={openCreate}>+ Thêm {title.toLowerCase()}</Button>} />
      <SearchFilters search={search} status={status} onSearch={(v) => { setSearch(v); setPage(1); }} onStatus={(v) => { setStatus(v); setPage(1); }} statusOptions={isStudent ? [["active", "Hoạt động"], ["pending", "Chờ xử lý"], ["completed", "Đã hoàn thành"], ["withdrawn", "Đã rút"]] : [["active", "Hoạt động"], ["inactive", "Không hoạt động"]]} />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.isLoading && items.length === 0}>
        <DataTable items={items} columns={[
          { header: "Mã", cell: (p) => <span className="font-semibold text-navy">{isStudent ? (p as Student).student_code : (p as Teacher).teacher_code}</span> },
          { header: "Họ tên", cell: (p) => p.full_name },
          { header: "Email", cell: (p) => p.email },
          { header: "Trạng thái", cell: (p) => <StatusBadge value={p.status} /> },
          { header: "", cell: (p) => <Button variant="ghost" onClick={() => { setEditing(p); mutation.reset(); setOpen(true); }}>Chỉnh sửa</Button> },
        ]} />
        <Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} />
      </QueryState>
      <Modal open={open} title={`${editing ? "Cập nhật" : "Thêm"} ${title.toLowerCase()}`} onClose={() => setOpen(false)}>
        <PersonForm kind={kind} initial={editing} loading={mutation.isPending} error={mutation.error} onSubmit={(body) => mutation.mutate({ id: editing?.id, body })} />
      </Modal>
    </div>
  );
}

function PersonForm({ kind, initial, loading, error, onSubmit }: { kind: PersonKind; initial: Person | null; loading: boolean; error: Error | null; onSubmit: (body: unknown) => void }) {
  const isStudent = kind === "student";
  const initialCode = initial ? (isStudent ? (initial as Student).student_code : (initial as Teacher).teacher_code) : "";
  const [form, setForm] = useState({ email: initial?.email ?? "", temporary_password: "", code: initialCode, full_name: initial?.full_name ?? "", phone: initial?.phone ?? "", extra: initial && !isStudent ? (initial as Teacher).specialization ?? "" : initial && isStudent ? (initial as Student).date_of_birth ?? "" : "", status: initial?.status ?? "active", account_status: initial?.account_status ?? "active" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const common = { email: form.email.trim(), account_status: form.account_status, full_name: form.full_name.trim(), phone: form.phone.trim() || null, status: form.status };
    const body = isStudent
      ? { ...common, student_code: form.code.trim(), date_of_birth: form.extra || null, enrolled_at: null, ...(initial ? {} : { temporary_password: form.temporary_password }) }
      : { ...common, teacher_code: form.code.trim(), specialization: form.extra.trim() || null, ...(initial ? {} : { temporary_password: form.temporary_password }) };
    onSubmit(body);
  };
  const update = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return <form className="space-y-4" onSubmit={submit}>
    {error ? <ErrorBanner message={mutationMessage(error)} /> : null}
    <div className="grid gap-4 sm:grid-cols-2"><Input required label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /><Input required label={isStudent ? "Mã học viên" : "Mã giảng viên"} value={form.code} onChange={(e) => update("code", e.target.value)} /></div>
    <Input required label="Họ và tên" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
    {!initial && <Input required minLength={8} label="Mật khẩu tạm thời" type="password" value={form.temporary_password} onChange={(e) => update("temporary_password", e.target.value)} />}
    <div className="grid gap-4 sm:grid-cols-2"><Input label="Điện thoại" value={form.phone} onChange={(e) => update("phone", e.target.value)} /><Input label={isStudent ? "Ngày sinh" : "Chuyên môn"} type={isStudent ? "date" : "text"} value={form.extra} onChange={(e) => update("extra", e.target.value)} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Select label="Trạng thái hồ sơ" value={form.status} onChange={(e) => update("status", e.target.value)}>{(isStudent ? ["pending", "active", "suspended", "completed", "withdrawn"] : ["active", "inactive"]).map((v) => <option key={v} value={v}>{v}</option>)}</Select><Select label="Trạng thái tài khoản" value={form.account_status} onChange={(e) => update("account_status", e.target.value)}>{["pending", "active", "suspended", "inactive"].map((v) => <option key={v} value={v}>{v}</option>)}</Select></div>
    <div className="flex justify-end"><Button type="submit" loading={loading}>Lưu thông tin</Button></div>
  </form>;
}

export function StudentsPage() { return <PersonDirectory kind="student" />; }
export function TeachersPage() { return <PersonDirectory kind="teacher" />; }

export function CoursesPage() {
  const client = useQueryClient(); const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [editing, setEditing] = useState<Course | null>(null); const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["admin", "courses", page, search, status], queryFn: () => adminApi.courses({ page, per_page: 10, search, status }) });
  const mutation = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => id ? adminApi.updateCourse(id, body) : adminApi.createCourse(body), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin", "courses"] }); setOpen(false); } });
  return <div><PageHeader title="Khóa học" subtitle="Quản lý chương trình và yêu cầu hoàn thành." actions={<Button onClick={() => { setEditing(null); setOpen(true); }}>+ Thêm khóa học</Button>} /><SearchFilters search={search} status={status} onSearch={setSearch} onStatus={setStatus} statusOptions={[["draft", "Bản nháp"], ["active", "Hoạt động"], ["inactive", "Không hoạt động"], ["archived", "Lưu trữ"]]} /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><DataTable items={query.data?.items ?? []} columns={[{ header: "Mã", cell: (c) => <b className="text-navy">{c.code}</b> }, { header: "Tên khóa học", cell: (c) => c.name }, { header: "Số buổi", cell: (c) => c.total_sessions }, { header: "Chuyên cần tối thiểu", cell: (c) => `${c.minimum_attendance_pct}%` }, { header: "Trạng thái", cell: (c) => <StatusBadge value={c.status} /> }, { header: "", cell: (c) => <Button variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>Chỉnh sửa</Button> }]} /><Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} /></QueryState><Modal open={open} title={`${editing ? "Cập nhật" : "Thêm"} khóa học`} onClose={() => setOpen(false)}><CourseForm initial={editing} loading={mutation.isPending} error={mutation.error} onSubmit={(body) => mutation.mutate({ id: editing?.id, body })} /></Modal></div>;
}

function CourseForm({ initial, loading, error, onSubmit }: { initial: Course | null; loading: boolean; error: Error | null; onSubmit: (body: unknown) => void }) {
  const [form, setForm] = useState({ code: initial?.code ?? "", name: initial?.name ?? "", description: initial?.description ?? "", total_sessions: initial?.total_sessions ?? 1, minimum_attendance_pct: initial?.minimum_attendance_pct ?? 80, status: initial?.status ?? "draft" }); const update = (k: string, v: string | number) => setForm((o) => ({ ...o, [k]: v }));
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, description: form.description || null }); }}>{error && <ErrorBanner message={mutationMessage(error)} />}<div className="grid gap-4 sm:grid-cols-2"><Input required label="Mã khóa học" value={form.code} onChange={(e) => update("code", e.target.value)} /><Input required label="Tên khóa học" value={form.name} onChange={(e) => update("name", e.target.value)} /></div><Textarea label="Mô tả" value={form.description} onChange={(e) => update("description", e.target.value)} /><div className="grid gap-4 sm:grid-cols-3"><Input required min={1} label="Tổng số buổi" type="number" value={form.total_sessions} onChange={(e) => update("total_sessions", Number(e.target.value))} /><Input required min={0} max={100} label="Chuyên cần tối thiểu (%)" type="number" value={form.minimum_attendance_pct} onChange={(e) => update("minimum_attendance_pct", Number(e.target.value))} /><Select label="Trạng thái" value={form.status} onChange={(e) => update("status", e.target.value)}>{["draft", "active", "inactive", "archived"].map((v) => <option key={v}>{v}</option>)}</Select></div><div className="flex justify-end"><Button type="submit" loading={loading}>Lưu khóa học</Button></div></form>;
}

export function ClassesPage() {
  const client = useQueryClient(); const [page, setPage] = useState(1); const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [editing, setEditing] = useState<TrainingClass | null>(null); const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["admin", "classes", page, search, status], queryFn: () => adminApi.classes({ page, per_page: 10, search, status }) }); const courses = useQuery({ queryKey: ["admin", "courses", "options"], queryFn: () => adminApi.courses({ page: 1, per_page: 100 }) });
  const mutation = useMutation({ mutationFn: ({ id, body }: { id?: string; body: unknown }) => id ? adminApi.updateClass(id, body) : adminApi.createClass(body), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin", "classes"] }); setOpen(false); } });
  return <div><PageHeader title="Lớp học" subtitle="Quản lý lớp, sĩ số, ghi danh và phân công." actions={<Button onClick={() => { setEditing(null); setOpen(true); }}>+ Tạo lớp</Button>} /><SearchFilters search={search} status={status} onSearch={setSearch} onStatus={setStatus} statusOptions={[["planning", "Chuẩn bị"], ["open", "Đang mở"], ["in_progress", "Đang diễn ra"], ["completed", "Hoàn thành"], ["cancelled", "Đã hủy"]]} /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><DataTable items={query.data?.items ?? []} columns={[{ header: "Lớp", cell: (c) => <div><b className="text-navy">{c.class_code}</b><div className="text-xs text-gtext">{c.name}</div></div> }, { header: "Khóa học", cell: (c) => `${c.course_code} — ${c.course_name}` }, { header: "Thời gian", cell: (c) => `${formatDate(c.start_date)} – ${formatDate(c.end_date)}` }, { header: "Sĩ số", cell: (c) => `${c.enrolled_students}/${c.maximum_students}` }, { header: "Trạng thái", cell: (c) => <StatusBadge value={c.status} /> }, { header: "", cell: (c) => <div className="flex gap-2"><Link to={`/admin/lop-hoc/${c.id}`}><Button variant="ghost">Chi tiết</Button></Link><Button variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>Sửa</Button></div> }]} /><Pagination page={page} totalPages={query.data?.meta.total_pages ?? 0} onPage={setPage} /></QueryState><Modal open={open} title={`${editing ? "Cập nhật" : "Tạo"} lớp học`} onClose={() => setOpen(false)}><ClassForm initial={editing} courses={courses.data?.items ?? []} loading={mutation.isPending} error={mutation.error} onSubmit={(body) => mutation.mutate({ id: editing?.id, body })} /></Modal></div>;
}

function ClassForm({ initial, courses, loading, error, onSubmit }: { initial: TrainingClass | null; courses: Course[]; loading: boolean; error: Error | null; onSubmit: (body: unknown) => void }) {
  const [form, setForm] = useState({ course_id: initial?.course_id ?? courses[0]?.id ?? "", class_code: initial?.class_code ?? "", name: initial?.name ?? "", start_date: initial?.start_date ?? "", end_date: initial?.end_date ?? "", maximum_students: initial?.maximum_students ?? 20, status: initial?.status ?? "planning" }); const update = (k: string, v: string | number) => setForm((o) => ({ ...o, [k]: v }));
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>{error && <ErrorBanner message={mutationMessage(error)} />}<Select required label="Khóa học" value={form.course_id} onChange={(e) => update("course_id", e.target.value)}><option value="">Chọn khóa học</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Select><div className="grid gap-4 sm:grid-cols-2"><Input required label="Mã lớp" value={form.class_code} onChange={(e) => update("class_code", e.target.value)} /><Input required label="Tên lớp" value={form.name} onChange={(e) => update("name", e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><Input required label="Ngày bắt đầu" type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} /><Input required label="Ngày kết thúc" type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><Input required min={1} label="Sĩ số tối đa" type="number" value={form.maximum_students} onChange={(e) => update("maximum_students", Number(e.target.value))} /><Select label="Trạng thái" value={form.status} onChange={(e) => update("status", e.target.value)}>{["planning", "open", "in_progress", "completed", "cancelled", "archived"].map((v) => <option key={v}>{v}</option>)}</Select></div><div className="flex justify-end"><Button type="submit" loading={loading}>Lưu lớp học</Button></div></form>;
}

export function ClassDetailPage() {
  const { classId = "" } = useParams(); const client = useQueryClient(); const [studentId, setStudentId] = useState(""); const [teacherId, setTeacherId] = useState(""); const [role, setRole] = useState("Giảng viên phụ trách");
  const detail = useQuery({ queryKey: ["admin", "class", classId], queryFn: () => adminApi.getClass(classId), enabled: !!classId }); const enrollments = useQuery({ queryKey: ["admin", "class", classId, "enrollments"], queryFn: () => adminApi.enrollments(classId), enabled: !!classId }); const assignments = useQuery({ queryKey: ["admin", "class", classId, "assignments"], queryFn: () => adminApi.assignments(classId), enabled: !!classId }); const students = useQuery({ queryKey: ["admin", "students", "options"], queryFn: () => adminApi.students({ page: 1, per_page: 100, status: "active" }) }); const teachers = useQuery({ queryKey: ["admin", "teachers", "options"], queryFn: () => adminApi.teachers({ page: 1, per_page: 100, status: "active" }) });
  const enroll = useMutation({ mutationFn: () => adminApi.enroll(classId, studentId), onSuccess: () => { setStudentId(""); void client.invalidateQueries({ queryKey: ["admin", "class", classId] }); } }); const assign = useMutation({ mutationFn: () => adminApi.assign(classId, teacherId, role), onSuccess: () => { setTeacherId(""); void client.invalidateQueries({ queryKey: ["admin", "class", classId, "assignments"] }); } }); const remove = useMutation({ mutationFn: (id: string) => adminApi.removeAssignment(classId, id), onSuccess: () => void client.invalidateQueries({ queryKey: ["admin", "class", classId, "assignments"] }) });
  return <div><PageHeader title={detail.data ? `${detail.data.class_code} — ${detail.data.name}` : "Chi tiết lớp"} subtitle={detail.data?.course_name} actions={<Link to="/admin/lop-hoc"><Button variant="ghost">← Danh sách lớp</Button></Link>} /><QueryState loading={detail.isLoading} error={detail.error}>{detail.data && <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Sĩ số" value={`${detail.data.enrolled_students}/${detail.data.maximum_students}`} /><StatCard label="Bắt đầu" value={formatDate(detail.data.start_date)} /><StatCard label="Trạng thái" value={<StatusBadge value={detail.data.status} />} /></div>}</QueryState><div className="grid gap-6 xl:grid-cols-2"><Card><h2 className="mb-4 text-lg font-bold text-navy">Ghi danh học viên</h2>{enroll.error && <ErrorBanner message={mutationMessage(enroll.error)} />}<div className="mb-4 flex gap-2"><Select label="Học viên" value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Chọn học viên</option>{students.data?.items.map((s) => <option key={s.id} value={s.id}>{s.student_code} — {s.full_name}</option>)}</Select><Button className="mt-6" disabled={!studentId} loading={enroll.isPending} onClick={() => enroll.mutate()}>Ghi danh</Button></div><QueryState loading={enrollments.isLoading} error={enrollments.error} empty={!enrollments.data?.length} emptyTitle="Lớp chưa có học viên"><div className="space-y-2">{enrollments.data?.map((e) => <div key={e.id} className="flex items-center justify-between rounded-lg border border-gborder p-3"><div><b>{e.student_code}</b><p className="text-sm text-gtext">{e.full_name}</p></div><StatusBadge value={e.status} /></div>)}</div></QueryState></Card><Card><h2 className="mb-4 text-lg font-bold text-navy">Phân công giảng viên</h2>{(assign.error || remove.error) && <ErrorBanner message={mutationMessage(assign.error || remove.error)} />}<div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select label="Giảng viên" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}><option value="">Chọn giảng viên</option>{teachers.data?.items.map((t) => <option key={t.id} value={t.id}>{t.teacher_code} — {t.full_name}</option>)}</Select><Input label="Vai trò" value={role} onChange={(e) => setRole(e.target.value)} /><Button className="mt-6" disabled={!teacherId || !role} loading={assign.isPending} onClick={() => assign.mutate()}>Phân công</Button></div><QueryState loading={assignments.isLoading} error={assignments.error} empty={!assignments.data?.length} emptyTitle="Chưa phân công giảng viên"><div className="space-y-2">{assignments.data?.map((a) => <div key={a.id} className="flex items-center justify-between rounded-lg border border-gborder p-3"><div><b>{a.teacher_code} — {a.full_name}</b><p className="text-sm text-gtext">{a.assignment_role}</p></div><Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(a.id)}>Gỡ</Button></div>)}</div></QueryState></Card></div></div>;
}

export function ScheduleAdminPage() {
  const client = useQueryClient(); const [open, setOpen] = useState(false); const query = useQuery({ queryKey: ["admin", "sessions"], queryFn: () => adminApi.sessions({ page: 1, per_page: 100 }) }); const classes = useQuery({ queryKey: ["admin", "classes", "options"], queryFn: () => adminApi.classes({ page: 1, per_page: 100 }) }); const teachers = useQuery({ queryKey: ["admin", "teachers", "options"], queryFn: () => adminApi.teachers({ page: 1, per_page: 100, status: "active" }) }); const locations = useQuery({ queryKey: ["admin", "locations", "options"], queryFn: () => adminApi.locations({ page: 1, per_page: 100 }) }); const mutation = useMutation({ mutationFn: adminApi.createSession, onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin", "sessions"] }); setOpen(false); } });
  return <div><PageHeader title="Lịch học" subtitle="Tạo và theo dõi buổi học theo giờ Việt Nam." actions={<Button onClick={() => setOpen(true)}>+ Tạo buổi học</Button>} /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><DataTable items={query.data?.items ?? []} columns={[{ header: "Thời gian", cell: (s) => <div><b>{formatDateTime(s.starts_at)}</b><div className="text-xs text-gtext">đến {formatDateTime(s.ends_at)}</div></div> }, { header: "Lớp", cell: (s) => `${s.class_code} — ${s.class_name}` }, { header: "Nội dung", cell: (s) => s.title }, { header: "Giảng viên", cell: (s) => s.teacher_name ?? "Chưa phân công" }, { header: "Địa điểm", cell: (s) => s.location_name ?? "Chưa xếp" }, { header: "Trạng thái", cell: (s) => <StatusBadge value={s.status} /> }]} /></QueryState><Modal open={open} title="Tạo buổi học" onClose={() => setOpen(false)}><SessionForm classes={classes.data?.items ?? []} teachers={teachers.data?.items ?? []} locations={locations.data?.items ?? []} loading={mutation.isPending} error={mutation.error} onSubmit={(body) => mutation.mutate(body)} /></Modal></div>;
}

function SessionForm({ classes, teachers, locations, loading, error, onSubmit }: { classes: TrainingClass[]; teachers: Teacher[]; locations: Array<{ id: string; code: string; name: string }>; loading: boolean; error: Error | null; onSubmit: (body: unknown) => void }) {
  const [form, setForm] = useState({ class_id: "", teacher_id: "", location_id: "", title: "", session_type: "theory", starts_at: "", ends_at: "", status: "scheduled" }); const update = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v })); const body = useMemo(() => ({ ...form, module_id: null, teacher_id: form.teacher_id || null, location_id: form.location_id || null, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "", ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "" }), [form]);
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(body); }}>{error && <ErrorBanner message={mutationMessage(error)} />}<Select required label="Lớp học" value={form.class_id} onChange={(e) => update("class_id", e.target.value)}><option value="">Chọn lớp</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.class_code} — {c.name}</option>)}</Select><Input required label="Tiêu đề buổi học" value={form.title} onChange={(e) => update("title", e.target.value)} /><div className="grid gap-4 sm:grid-cols-2"><Input required label="Bắt đầu" type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} /><Input required label="Kết thúc" type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-3"><Select label="Loại buổi" value={form.session_type} onChange={(e) => update("session_type", e.target.value)}>{["theory", "workshop", "assessment", "other"].map((v) => <option key={v}>{v}</option>)}</Select><Select label="Giảng viên" value={form.teacher_id} onChange={(e) => update("teacher_id", e.target.value)}><option value="">Chưa chọn</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.teacher_code} — {t.full_name}</option>)}</Select><Select label="Địa điểm" value={form.location_id} onChange={(e) => update("location_id", e.target.value)}><option value="">Chưa chọn</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}</Select></div><div className="flex justify-end"><Button type="submit" loading={loading}>Tạo buổi học</Button></div></form>;
}
