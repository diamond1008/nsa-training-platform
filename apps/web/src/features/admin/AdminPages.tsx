import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import {
  currentWeekStart,
  inferTrainingSlot,
  monthRange,
  trainingSlotRange,
  vietnamDateKey,
  WeekCalendar,
  weekRange,
} from "../../components/calendar";
import type {
  CalendarStat,
  CalendarView,
  TrainingSlotKey,
  WeekCalendarEvent,
} from "../../components/calendar";
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
import type {
  AttendanceRosterItem,
  AttendanceStatus,
  ClassSession,
  CompletionCandidate,
  Course,
  CourseTest,
  Enrollment,
  EnrollmentTransfer,
  Paginated,
  Student,
  Teacher,
  TeacherAssignment,
  TrainingClass,
  TrainingLocation,
} from "../../lib/domainTypes";
import { formatDate, formatDateTime } from "../../lib/format";
import { adminApi } from "./adminApi";

function mutationMessage(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : "Không thể lưu dữ liệu. Vui lòng thử lại.";
}

export function AdminOperationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CompletionCandidate | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const summary = useQuery({
    queryKey: ["admin", "reports", "summary"],
    queryFn: () => adminApi.reportSummary(),
  });
  const candidates = useQuery({
    queryKey: ["admin", "completions"],
    queryFn: () => adminApi.completions({ page: 1, per_page: 100 }),
  });
  const decide = useMutation({
    mutationFn: () =>
      adminApi.decideCompletion(selected!.class_id, selected!.student_id, decision, note),
    onSuccess: () => {
      setSelected(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "completions"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "reports", "summary"] });
    },
  });
  const certificateAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "revoke" | "reissue" }) => {
      const reason = window.prompt(
        action === "reissue"
          ? "Hãy sửa thông tin nguồn trước. Nhập lý do thu hồi và cấp lại chứng nhận:"
          : "Nhập lý do thu hồi chứng nhận:",
      );
      if (!reason?.trim()) throw new Error("Cần nhập lý do");
      return action === "reissue"
        ? adminApi.reissueCertificate(id, reason.trim())
        : adminApi.revokeCertificate(id, reason.trim());
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "completions"] }),
  });
  const downloadCertificate = async (id: string, number: string) => {
    const blob = await adminApi.certificatePDF(id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${number}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const exportReport = useMutation({
    mutationFn: (kind: "attendance" | "competencies" | "classes" | "completions") =>
      adminApi.exportReport(kind).then((blob) => ({ blob, kind })),
    onSuccess: ({ blob, kind }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${kind}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const reports = [
    ["attendance", "Chuyên cần"],
    ["competencies", "Năng lực"],
    ["classes", "Lớp học"],
    ["completions", "Hoàn thành"],
  ] as const;
  return (
    <div>
      <PageHeader
        eyebrow="Điều hành đào tạo"
        title="Vận hành & báo cáo"
        subtitle="Theo dõi chỉ số, duyệt hoàn thành khóa học và xuất dữ liệu nghiệp vụ."
      />
      <QueryState loading={summary.isLoading} error={summary.error}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Học viên hoạt động" value={summary.data?.active_students ?? 0} />
          <StatCard label="Lớp đang mở" value={summary.data?.open_classes ?? 0} />
          <StatCard label="Buổi học sắp tới" value={summary.data?.upcoming_sessions ?? 0} />
          <StatCard label="Rủi ro chuyên cần" value={summary.data?.at_risk_students ?? 0} />
          <StatCard label="Đã duyệt hoàn thành" value={summary.data?.approved_completions ?? 0} />
          <StatCard label="Thông báo chưa đọc" value={summary.data?.pending_notifications ?? 0} />
        </div>
      </QueryState>

      <Card className="mt-6">
        <SectionHeader title="Xuất báo cáo CSV" subtitle="Dữ liệu UTF-8 mở trực tiếp bằng Excel." />
        <div className="flex flex-wrap gap-2">
          {reports.map(([kind, label]) => (
            <Button
              key={kind}
              variant="soft"
              loading={exportReport.isPending && exportReport.variables === kind}
              onClick={() => exportReport.mutate(kind)}
            >
              Xuất {label}
            </Button>
          ))}
        </div>
      </Card>

      <section className="mt-6">
        <SectionHeader
          title="Duyệt hoàn thành khóa học"
          subtitle="Chỉ được duyệt khi chuyên cần đạt 80%, đạt toàn bộ bài kiểm tra bắt buộc và điểm thi kết thúc trên 5."
        />
        {certificateAction.error && (
          <ErrorBanner message={mutationMessage(certificateAction.error)} />
        )}
        <QueryState
          loading={candidates.isLoading}
          error={candidates.error}
          empty={!candidates.data?.items.length}
        >
          <div className="space-y-3">
            {candidates.data?.items.map((item) => (
              <Card key={`${item.class_id}-${item.student_id}`}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-navy">
                        {item.student_code} — {item.student_name}
                      </h3>
                      <StatusBadge value={item.status} />
                    </div>
                    <p className="mt-1 text-sm text-gtext">
                      {item.class_code} · {item.course_name}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gtext">
                      <span>
                        Buổi học: {item.completed_sessions}/{item.total_sessions}
                      </span>
                      <span>Chuyên cần: {item.attendance_pct.toFixed(1)}%</span>
                      <span>
                        Năng lực: {item.required_competencies_met}/
                        {item.required_competencies_total}
                      </span>
                      <span>
                        Đánh giá: {item.completed_assessments}/{item.required_assessments}
                      </span>
                      <span>
                        Kiểm tra bắt buộc: {item.required_tests_passed}/{item.required_tests_total}
                      </span>
                      <span>
                        Thi kết thúc:{" "}
                        {item.final_exam_score == null
                          ? "Chưa có"
                          : item.final_exam_score.toFixed(2)}
                      </span>
                    </div>
                    {!!item.failure_reasons.length && (
                      <p className="mt-2 text-xs font-medium text-error">
                        {item.failure_reasons.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.current_certificate_id && item.current_certificate_number && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void downloadCertificate(
                              item.current_certificate_id!,
                              item.current_certificate_number!,
                            )
                          }
                        >
                          Tải {item.current_certificate_number}
                        </Button>
                        <Button
                          variant="soft"
                          loading={certificateAction.isPending}
                          onClick={() =>
                            certificateAction.mutate({
                              id: item.current_certificate_id!,
                              action: "reissue",
                            })
                          }
                        >
                          Sửa nguồn & cấp lại
                        </Button>
                        <Button
                          variant="ghost"
                          loading={certificateAction.isPending}
                          onClick={() =>
                            certificateAction.mutate({
                              id: item.current_certificate_id!,
                              action: "revoke",
                            })
                          }
                        >
                          Thu hồi
                        </Button>
                      </>
                    )}
                    <Button
                      variant={item.is_eligible ? "accent" : "soft"}
                      onClick={() => {
                        setSelected(item);
                        setDecision(item.is_eligible ? "approved" : "rejected");
                        setNote("");
                      }}
                    >
                      Xem xét hồ sơ
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </QueryState>
      </section>

      <Modal open={!!selected} title="Quyết định hoàn thành" onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gbg2 p-4">
              <b>
                {selected.student_code} — {selected.student_name}
              </b>
              <p className="mt-1 text-sm text-gtext">
                {selected.class_code} · {selected.course_name}
              </p>
            </div>
            {!selected.is_eligible && (
              <ErrorBanner
                message={`Hồ sơ chưa đủ điều kiện: ${selected.failure_reasons.join("; ")}`}
              />
            )}
            {decide.error && <ErrorBanner message={mutationMessage(decide.error)} />}
            <Select
              label="Quyết định"
              value={decision}
              onChange={(event) => setDecision(event.target.value as "approved" | "rejected")}
            >
              <option value="approved" disabled={!selected.is_eligible}>
                Phê duyệt và cấp chứng nhận
              </option>
              <option value="rejected">Từ chối / yêu cầu bổ sung</option>
            </Select>
            <Textarea
              label="Lý do quyết định"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Hủy
              </Button>
              <Button
                disabled={!note.trim() || (decision === "approved" && !selected.is_eligible)}
                loading={decide.isPending}
                onClick={() => decide.mutate()}
              >
                Lưu quyết định
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
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
  const [testsCourse, setTestsCourse] = useState<Course | null>(null);
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
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="soft" onClick={() => setTestsCourse(c)}>
                    Bài kiểm tra
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(c);
                      setOpen(true);
                    }}
                  >
                    Chỉnh sửa
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
      <Modal
        open={!!testsCourse}
        title={`Bài kiểm tra · ${testsCourse?.code ?? ""}`}
        onClose={() => setTestsCourse(null)}
      >
        {testsCourse && <CourseTestsPanel course={testsCourse} />}
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
    minimum_attendance_pct: 80,
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
          disabled
          label="Chuyên cần tối thiểu (%) · cố định"
          type="number"
          value={form.minimum_attendance_pct}
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

function CourseTestsPanel({ course }: { course: Course }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<CourseTest | null>(null);
  const [form, setForm] = useState({
    code: "KT01",
    title: "",
    kind: "class_test",
    pass_score: 5,
    is_required: true,
    sequence_no: 1,
    is_active: true,
  });
  const query = useQuery({
    queryKey: ["admin", "course-tests", course.id],
    queryFn: () => adminApi.courseTests(course.id),
  });
  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? adminApi.updateCourseTest(course.id, editing.id, form)
        : adminApi.createCourseTest(course.id, form),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "course-tests", course.id] });
      setEditing(null);
      setForm({
        code: `KT${String((query.data?.length ?? 0) + 2).padStart(2, "0")}`,
        title: "",
        kind: "class_test",
        pass_score: 5,
        is_required: true,
        sequence_no: (query.data?.length ?? 0) + 2,
        is_active: true,
      });
    },
  });
  const selectTest = (test: CourseTest) => {
    setEditing(test);
    setForm({
      code: test.code,
      title: test.title,
      kind: test.kind,
      pass_score: test.pass_score,
      is_required: test.is_required,
      sequence_no: test.sequence_no,
      is_active: test.is_active,
    });
  };
  const update = (key: string, value: string | number | boolean) =>
    setForm((old) => {
      const next = { ...old, [key]: value };
      if (key === "kind" && value === "final_exam") {
        next.pass_score = 5;
        next.is_required = true;
      }
      return next;
    });
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gbg2 p-4 text-sm text-gtext">
        Bài kiểm tra và thi kết thúc khóa được tổ chức trên giấy. Admin cấu hình đầu điểm; giảng
        viên nhập kết quả sau khi chấm. Mọi bài bắt buộc phải đạt và điểm thi kết thúc phải lớn hơn
        5.
      </div>
      <QueryState loading={query.isLoading} error={query.error}>
        <div className="space-y-2">
          {query.data?.map((test) => (
            <button
              key={test.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-gborder p-3 text-left hover:border-gold"
              onClick={() => selectTest(test)}
            >
              <span>
                <b>
                  {test.code} · {test.title}
                </b>
                <span className="mt-1 block text-xs text-gtext">
                  {test.kind === "final_exam"
                    ? "Thi kết thúc khóa · yêu cầu > 5"
                    : `Kiểm tra trong lớp · đạt từ ${test.pass_score}`}
                </span>
              </span>
              <StatusBadge value={test.is_active ? "active" : "inactive"} />
            </button>
          ))}
        </div>
      </QueryState>
      <form
        className="space-y-4 border-t border-gborder pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <h3 className="font-bold text-navy">
          {editing ? "Cập nhật bài kiểm tra" : "Thêm bài kiểm tra"}
        </h3>
        {mutation.error && <ErrorBanner message={mutationMessage(mutation.error)} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            required
            label="Mã"
            value={form.code}
            onChange={(e) => update("code", e.target.value)}
          />
          <Input
            required
            label="Tên bài"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
          />
          <Select label="Loại" value={form.kind} onChange={(e) => update("kind", e.target.value)}>
            <option value="class_test">Kiểm tra trong lớp</option>
            <option value="final_exam">Thi kết thúc khóa</option>
          </Select>
          <Input
            required
            min={0}
            max={10}
            step={0.01}
            disabled={form.kind === "final_exam"}
            type="number"
            label={form.kind === "final_exam" ? "Mốc điểm · phải trên 5" : "Điểm đạt từ"}
            value={form.pass_score}
            onChange={(e) => update("pass_score", Number(e.target.value))}
          />
          <Input
            required
            min={1}
            type="number"
            label="Thứ tự"
            value={form.sequence_no}
            onChange={(e) => update("sequence_no", Number(e.target.value))}
          />
          <Select
            label="Trạng thái"
            value={form.is_active ? "active" : "inactive"}
            onChange={(e) => update("is_active", e.target.value === "active")}
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
              Hủy sửa
            </Button>
          )}
          <Button type="submit" loading={mutation.isPending}>
            Lưu bài kiểm tra
          </Button>
        </div>
      </form>
    </div>
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
    change_reason: "",
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
      {initial ? (
        <Textarea
          required
          label="Lý do cập nhật"
          value={form.change_reason}
          onChange={(e) => update("change_reason", e.target.value)}
          placeholder="Ví dụ: Điều chỉnh sĩ số theo tình hình thực tế"
        />
      ) : null}
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
  const [enrollmentAction, setEnrollmentAction] = useState<Enrollment | null>(null);
  const [actionType, setActionType] = useState<"transfer" | "completed" | "withdrawn">("transfer");
  const [actionReason, setActionReason] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [assignmentToRemove, setAssignmentToRemove] = useState<TeacherAssignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
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
  const history = useQuery({
    queryKey: ["admin", "class", classId, "operation-history"],
    queryFn: () => adminApi.classHistory(classId),
    enabled: !!classId,
  });
  const transferTargets = useQuery({
    queryKey: ["admin", "classes", "transfer-targets", detail.data?.course_id],
    queryFn: () => adminApi.classes({ page: 1, per_page: 100, course_id: detail.data!.course_id }),
    enabled: Boolean(detail.data?.course_id),
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
    mutationFn: () => adminApi.removeAssignment(classId, assignmentToRemove!.id, removeReason),
    onSuccess: () => {
      setAssignmentToRemove(null);
      setRemoveReason("");
      void client.invalidateQueries({ queryKey: ["admin", "class", classId] });
    },
  });
  const enrollmentOperation = useMutation<Enrollment | EnrollmentTransfer, Error>({
    mutationFn: () => {
      if (!enrollmentAction) throw new Error("Chưa chọn học viên");
      return actionType === "transfer"
        ? adminApi.transferEnrollment(classId, enrollmentAction.id, targetClassId, actionReason)
        : adminApi.updateEnrollment(classId, enrollmentAction.id, actionType, actionReason);
    },
    onSuccess: () => {
      setEnrollmentAction(null);
      setActionReason("");
      setTargetClassId("");
      void client.invalidateQueries({ queryKey: ["admin", "class", classId] });
      void client.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <StatusBadge value={e.status} />
                    {e.status === "enrolled" ? (
                      <>
                        <Button
                          variant="soft"
                          onClick={() => {
                            setEnrollmentAction(e);
                            setActionType("transfer");
                          }}
                        >
                          Chuyển lớp
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEnrollmentAction(e);
                            setActionType("completed");
                          }}
                        >
                          Hoàn thành
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setEnrollmentAction(e);
                            setActionType("withdrawn");
                          }}
                        >
                          Rút lớp
                        </Button>
                      </>
                    ) : null}
                  </div>
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
                  <Button variant="danger" onClick={() => setAssignmentToRemove(a)}>
                    Gỡ
                  </Button>
                </div>
              ))}
            </div>
          </QueryState>
        </Card>
      </div>
      <Card className="mt-6">
        <SectionHeader
          title="Lịch sử vận hành"
          subtitle="Các thay đổi quan trọng được lưu lại để đối soát."
        />
        <QueryState
          loading={history.isLoading}
          error={history.error}
          empty={!history.data?.length}
          emptyTitle="Chưa có lịch sử vận hành"
        >
          <div className="divide-y divide-gborder">
            {history.data?.map((item) => (
              <div key={item.id} className="grid gap-2 py-4 sm:grid-cols-[180px_1fr_auto]">
                <div>
                  <p className="font-semibold text-navy">{operationEventLabel(item.event_type)}</p>
                  <p className="text-xs text-gtext">{formatDateTime(item.occurred_at)}</p>
                </div>
                <div className="text-sm text-gtext">
                  <p>{item.reason || "Thao tác khởi tạo dữ liệu"}</p>
                  {Object.keys(item.details ?? {}).length > 0 ? (
                    <p className="mt-1 text-xs text-gtext/80">{operationDetails(item.details)}</p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-navy">
                  {item.actor_email || "Hệ thống"}
                </span>
              </div>
            ))}
          </div>
        </QueryState>
      </Card>
      <Modal
        open={!!enrollmentAction}
        title={
          actionType === "transfer"
            ? "Chuyển học viên sang lớp khác"
            : actionType === "completed"
              ? "Xác nhận hoàn thành lớp"
              : "Xác nhận rút khỏi lớp"
        }
        onClose={() => {
          setEnrollmentAction(null);
          setActionReason("");
          setTargetClassId("");
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            enrollmentOperation.mutate();
          }}
        >
          {enrollmentAction ? (
            <div className="rounded-xl bg-gbg2 p-4 text-sm text-navy">
              <b>{enrollmentAction.student_code}</b> — {enrollmentAction.full_name}
            </div>
          ) : null}
          {actionType === "transfer" ? (
            <Select
              required
              label="Lớp tiếp nhận"
              value={targetClassId}
              onChange={(event) => setTargetClassId(event.target.value)}
            >
              <option value="">Chọn lớp cùng khóa học</option>
              {transferTargets.data?.items
                .filter(
                  (item) =>
                    item.id !== classId &&
                    ["planning", "open", "in_progress"].includes(item.status),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.class_code} — {item.name} ({item.enrolled_students}/
                    {item.maximum_students})
                  </option>
                ))}
            </Select>
          ) : null}
          <Textarea
            required
            label="Lý do"
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Nhập lý do để lưu vào lịch sử vận hành"
          />
          {enrollmentOperation.error ? (
            <ErrorBanner message={mutationMessage(enrollmentOperation.error)} />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEnrollmentAction(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              loading={enrollmentOperation.isPending}
              disabled={!actionReason.trim() || (actionType === "transfer" && !targetClassId)}
            >
              Xác nhận
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!assignmentToRemove}
        title="Gỡ phân công giảng viên"
        onClose={() => {
          setAssignmentToRemove(null);
          setRemoveReason("");
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            remove.mutate();
          }}
        >
          <p className="text-sm text-gtext">
            Phân công của <b className="text-navy">{assignmentToRemove?.full_name}</b> sẽ được gỡ
            khỏi lớp và lưu vào lịch sử.
          </p>
          <Textarea
            required
            label="Lý do"
            value={removeReason}
            onChange={(event) => setRemoveReason(event.target.value)}
          />
          {remove.error ? <ErrorBanner message={mutationMessage(remove.error)} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAssignmentToRemove(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={remove.isPending}
              disabled={!removeReason.trim()}
            >
              Gỡ phân công
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const operationEventLabels: Record<string, string> = {
  class_created: "Tạo lớp học",
  class_updated: "Cập nhật lớp học",
  student_enrolled: "Ghi danh học viên",
  enrollment_status_changed: "Cập nhật ghi danh",
  student_transferred_out: "Chuyển học viên đi",
  student_transferred_in: "Tiếp nhận học viên",
  teacher_assigned: "Phân công giảng viên",
  teacher_assignment_updated: "Cập nhật phân công",
  teacher_removed: "Gỡ phân công",
  session_created: "Tạo buổi học",
  session_updated: "Điều chỉnh buổi học",
  session_cancelled: "Hủy buổi học",
  attendance_corrected: "Hiệu chỉnh điểm danh",
};

function operationEventLabel(value: string) {
  return operationEventLabels[value] ?? value.replaceAll("_", " ");
}

function operationDetails(details: Record<string, unknown>) {
  if ("before" in details || "after" in details) {
    return "Đã lưu dữ liệu trước và sau thay đổi";
  }
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 4)
    .map(
      ([key, value]) =>
        `${key.replaceAll("_", " ")}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
    )
    .join(" · ");
}

export function ScheduleAdminPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [correctionItem, setCorrectionItem] = useState<AttendanceRosterItem | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>("present");
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
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
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => adminApi.updateSession(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin", "sessions"] });
      void client.invalidateQueries({ queryKey: ["admin", "class"] });
      setSelectedSession(null);
    },
  });
  const correctionMutation = useMutation({
    mutationFn: () =>
      adminApi.correctAttendance(correctionItem!.attendance_id!, {
        status: correctionStatus,
        note: correctionNote.trim() || null,
        reason: correctionReason,
      }),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["admin", "session-attendance", attendanceSessionId],
      });
      setCorrectionItem(null);
      setCorrectionReason("");
    },
  });
  const openCorrection = (item: AttendanceRosterItem) => {
    setCorrectionItem(item);
    setCorrectionStatus(item.attendance_status ?? "present");
    setCorrectionNote(item.note ?? "");
    setCorrectionReason("");
    correctionMutation.reset();
  };
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
  const now = Date.now();
  const calendarStats = [
    {
      label: "Sắp diễn ra",
      value: (query.data?.items ?? []).filter(
        (session) => session.status !== "cancelled" && new Date(session.starts_at).getTime() > now,
      ).length,
      tone: "navy",
    },
    {
      label: "Đã diễn ra",
      value: (query.data?.items ?? []).filter(
        (session) => session.status !== "cancelled" && new Date(session.ends_at).getTime() <= now,
      ).length,
      tone: "green",
    },
    {
      label: "Đã hủy",
      value: (query.data?.items ?? []).filter((session) => session.status === "cancelled").length,
      tone: "red",
    },
  ] satisfies CalendarStat[];
  return (
    <div>
      <PageHeader
        eyebrow="Điều phối đào tạo"
        title="Lịch học"
        subtitle="Lập lịch, theo dõi giảng viên và xem điểm danh trên một lịch thống nhất."
        actions={
          <>
            <Button variant="ghost" onClick={() => setLocationsOpen(true)}>
              Phòng / xưởng
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-4 w-4" />
              Tạo buổi học
            </Button>
          </>
        }
      />
      <QueryState loading={query.isLoading} error={query.error}>
        <WeekCalendar
          events={events}
          weekStart={calendarAnchor}
          onWeekStartChange={setCalendarAnchor}
          view={calendarView}
          onViewChange={setCalendarView}
          stats={calendarStats}
          onEventClick={(event) =>
            setSelectedSession(query.data?.items.find((item) => item.id === event.id) ?? null)
          }
        />
      </QueryState>
      <Modal open={open} title="Tạo buổi học" onClose={() => setOpen(false)}>
        <SessionForm
          key="new-session"
          classes={classes.data?.items ?? []}
          teachers={teachers.data?.items ?? []}
          locations={locations.data?.items ?? []}
          loading={mutation.isPending}
          error={mutation.error}
          onSubmit={(body) => mutation.mutate(body)}
        />
      </Modal>
      <Modal
        open={!!selectedSession}
        title={selectedSession?.title ?? "Chi tiết buổi học"}
        onClose={() => setSelectedSession(null)}
      >
        {selectedSession ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gbg2 p-4">
              <div className="text-sm text-gtext">
                <b className="text-navy">{selectedSession.class_code}</b>
                <span> · {formatDateTime(selectedSession.starts_at)}</span>
                <p>{selectedSession.location_name || "Chưa xếp phòng"}</p>
              </div>
              <Button
                variant="soft"
                onClick={() => {
                  setAttendanceSessionId(selectedSession.id);
                  setSelectedSession(null);
                }}
              >
                Xem điểm danh
              </Button>
            </div>
            {selectedSession.status === "locked" || selectedSession.attendance_locked_at ? (
              <div className="rounded-xl border border-gborder p-4 text-sm text-gtext">
                Buổi học đã được khóa sau ngày điểm danh. Bạn vẫn có thể xem tình trạng điểm danh
                nhưng không thể thay đổi lịch.
              </div>
            ) : (
              <SessionForm
                key={selectedSession.id}
                initial={selectedSession}
                classes={classes.data?.items ?? []}
                teachers={teachers.data?.items ?? []}
                locations={locations.data?.items ?? []}
                loading={updateMutation.isPending}
                error={updateMutation.error}
                onSubmit={(body) => updateMutation.mutate({ id: selectedSession.id, body })}
              />
            )}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={locationsOpen}
        title="Quản lý phòng và xưởng"
        onClose={() => setLocationsOpen(false)}
      >
        <LocationManager
          locations={locations.data?.items ?? []}
          loading={locations.isLoading}
          error={locations.error}
          onSaved={() => {
            void client.invalidateQueries({ queryKey: ["admin", "locations"] });
          }}
        />
      </Modal>
      <Modal
        open={!!attendanceSessionId}
        title={
          query.data?.items.find((item) => item.id === attendanceSessionId)?.title ??
          "Tình trạng điểm danh"
        }
        onClose={() => {
          setAttendanceSessionId("");
          setCorrectionItem(null);
        }}
      >
        <QueryState loading={attendance.isLoading} error={attendance.error}>
          {attendance.data && (
            <AttendanceRoster data={attendance.data} onCorrect={openCorrection} />
          )}
        </QueryState>
      </Modal>
      <Modal
        open={!!correctionItem}
        title="Hiệu chỉnh điểm danh"
        onClose={() => {
          setCorrectionItem(null);
          setCorrectionReason("");
        }}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            correctionMutation.mutate();
          }}
        >
          <div className="rounded-xl bg-gbg2 p-4 text-sm">
            <b className="text-navy">{correctionItem?.student_code}</b> —{" "}
            {correctionItem?.full_name}
            <p className="mt-1 text-xs text-gtext">
              Kết quả hiện tại: {correctionItem?.attendance_status ?? "Chưa ghi nhận"}
            </p>
          </div>
          <Select
            label="Trạng thái mới"
            value={correctionStatus}
            onChange={(event) => setCorrectionStatus(event.target.value as AttendanceStatus)}
          >
            <option value="present">Có mặt</option>
            <option value="late">Đi trễ</option>
            <option value="excused">Vắng có phép</option>
            <option value="absent">Vắng</option>
          </Select>
          <Textarea
            label="Ghi chú"
            value={correctionNote}
            onChange={(event) => setCorrectionNote(event.target.value)}
          />
          <Textarea
            required
            label="Lý do hiệu chỉnh"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            placeholder="Lý do sẽ được lưu vĩnh viễn trong nhật ký kiểm toán"
          />
          {correctionMutation.error ? (
            <ErrorBanner message={mutationMessage(correctionMutation.error)} />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCorrectionItem(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              loading={correctionMutation.isPending}
              disabled={!correctionReason.trim()}
            >
              Lưu hiệu chỉnh
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SessionForm({
  initial = null,
  classes,
  teachers,
  locations,
  loading,
  error,
  onSubmit,
}: {
  initial?: ClassSession | null;
  classes: TrainingClass[];
  teachers: Teacher[];
  locations: TrainingLocation[];
  loading: boolean;
  error: Error | null;
  onSubmit: (body: unknown) => void;
}) {
  const [form, setForm] = useState({
    class_id: initial?.class_id ?? "",
    teacher_id: initial?.teacher_id ?? "",
    location_id: initial?.location_id ?? "",
    title: initial?.title ?? "",
    session_type: initial?.session_type ?? "theory",
    session_date: initial?.starts_at
      ? vietnamDateKey(new Date(initial.starts_at))
      : vietnamDateKey(new Date()),
    slot: (initial ? inferTrainingSlot(initial.starts_at, initial.ends_at) : null) ?? "morning",
    status: initial?.status ?? "scheduled",
    change_reason: "",
  });
  const update = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  const body = useMemo(() => {
    const range = trainingSlotRange(form.session_date, form.slot as TrainingSlotKey);
    return {
      class_id: form.class_id,
      title: form.title,
      session_type: form.session_type,
      status: form.status,
      change_reason: form.change_reason,
      module_id: null,
      teacher_id: form.teacher_id || null,
      location_id: form.location_id || null,
      starts_at: range.startsAt,
      ends_at: range.endsAt,
    };
  }, [form]);
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
          label="Ngày học"
          type="date"
          value={form.session_date}
          onChange={(e) => update("session_date", e.target.value)}
        />
        <Select
          required
          label="Ca học"
          value={form.slot}
          onChange={(e) => update("slot", e.target.value)}
        >
          <option value="morning">Sáng · 08:00–12:00</option>
          <option value="afternoon">Chiều · 13:30–17:30</option>
          <option value="evening">Tối · 18:30–21:30</option>
        </Select>
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
      {initial ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Trạng thái"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="scheduled">Đã lên lịch</option>
            <option value="completed">Đã diễn ra</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          <Textarea
            required
            label="Lý do điều chỉnh"
            value={form.change_reason}
            onChange={(e) => update("change_reason", e.target.value)}
            placeholder="Đổi giờ, đổi phòng, hủy buổi…"
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {initial ? "Lưu thay đổi" : "Tạo buổi học"}
        </Button>
      </div>
    </form>
  );
}

function LocationManager({
  locations,
  loading,
  error,
  onSaved,
}: {
  locations: TrainingLocation[];
  loading: boolean;
  error: Error | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<TrainingLocation | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    location_type: "classroom",
    capacity: "",
    is_active: true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        capacity: form.capacity ? Number(form.capacity) : null,
      };
      return editing ? adminApi.updateLocation(editing.id, body) : adminApi.createLocation(body);
    },
    onSuccess: () => {
      setEditing(null);
      setForm({ code: "", name: "", location_type: "classroom", capacity: "", is_active: true });
      onSaved();
    },
  });
  const selectLocation = (location: TrainingLocation) => {
    setEditing(location);
    setForm({
      code: location.code,
      name: location.name,
      location_type: location.location_type,
      capacity: location.capacity ? String(location.capacity) : "",
      is_active: location.is_active,
    });
  };
  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-2xl border border-gborder p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            required
            label="Mã địa điểm"
            value={form.code}
            onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))}
          />
          <Input
            required
            label="Tên phòng / xưởng"
            value={form.name}
            onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))}
          />
          <Select
            label="Loại địa điểm"
            value={form.location_type}
            onChange={(event) => setForm((old) => ({ ...old, location_type: event.target.value }))}
          >
            <option value="classroom">Phòng học</option>
            <option value="workshop">Xưởng thực hành</option>
            <option value="lab">Phòng máy / phòng lab</option>
            <option value="other">Khác</option>
          </Select>
          <Input
            label="Sức chứa"
            type="number"
            min="1"
            value={form.capacity}
            onChange={(event) => setForm((old) => ({ ...old, capacity: event.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-navy">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((old) => ({ ...old, is_active: event.target.checked }))}
          />
          Cho phép xếp lịch tại địa điểm này
        </label>
        {save.error ? <ErrorBanner message={mutationMessage(save.error)} /> : null}
        <div className="flex justify-end gap-2">
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setForm({
                  code: "",
                  name: "",
                  location_type: "classroom",
                  capacity: "",
                  is_active: true,
                });
              }}
            >
              Tạo mới
            </Button>
          ) : null}
          <Button type="submit" loading={save.isPending}>
            {editing ? "Lưu địa điểm" : "Thêm địa điểm"}
          </Button>
        </div>
      </form>
      <QueryState loading={loading} error={error} empty={!locations.length}>
        <div className="space-y-2">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => selectLocation(location)}
              className="flex w-full items-center justify-between rounded-xl border border-gborder p-3 text-left transition hover:border-gold"
            >
              <span>
                <b className="text-navy">
                  {location.code} — {location.name}
                </b>
                <span className="block text-xs text-gtext">
                  {location.location_type} · {location.capacity || "Không giới hạn"} chỗ
                </span>
              </span>
              <StatusBadge value={location.is_active ? "active" : "inactive"} />
            </button>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
