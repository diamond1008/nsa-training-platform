import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { currentWeekStart, monthRange, WeekCalendar, weekRange } from "../../components/calendar";
import type { CalendarView, WeekCalendarEvent } from "../../components/calendar";
import {
  DataTable,
  QueryState,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "../../components/data";
import { Icon } from "../../components/icons";
import {
  Button,
  Card,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  SuccessBanner,
  Textarea,
} from "../../components/ui";
import { ApiRequestError } from "../../lib/apiClient";
import type { AttendanceStatus, ClassSession, CompetencyRating } from "../../lib/domainTypes";
import { formatDate, formatDateTime, statusLabel } from "../../lib/format";
import { teacherApi } from "./teacherApi";

const attendanceStatuses: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const ratings: CompetencyRating[] = [
  "not_assessed",
  "needs_improvement",
  "competent",
  "good",
  "excellent",
];
const errorText = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : "Không thể thực hiện thao tác. Vui lòng thử lại.";

function vietnamDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function attendanceEditState(session: ClassSession) {
  if (session.attendance_locked_at || session.status === "locked") {
    return { editable: false, label: "Đã khóa" };
  }
  if (session.status === "cancelled") {
    return { editable: false, label: "Đã hủy" };
  }
  const now = new Date();
  if (now < new Date(session.starts_at)) {
    return { editable: false, label: "Chưa đến giờ" };
  }
  if (vietnamDateKey(now) !== vietnamDateKey(session.starts_at)) {
    return { editable: false, label: "Đã hết ngày" };
  }
  return { editable: true, label: "Đang mở" };
}

export function TeacherDashboardPage() {
  const classes = useQuery({ queryKey: ["teacher", "classes"], queryFn: teacherApi.classes });
  const schedule = useQuery({
    queryKey: ["teacher", "schedule", "dashboard"],
    queryFn: () => teacherApi.schedule({ page: 1, per_page: 5, from: new Date().toISOString() }),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Không gian giảng viên"
        title="Chào ngày mới 👋"
        subtitle="Theo dõi lịch dạy, lớp phụ trách và hoàn thành các tác vụ trong ngày."
        actions={
          <Link to="/teacher/lich-day">
            <Button variant="accent">
              <Icon name="calendar" className="h-4 w-4" />
              Xem lịch dạy
            </Button>
          </Link>
        }
      />
      <QueryState
        loading={classes.isLoading || schedule.isLoading}
        error={classes.error || schedule.error}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Lớp phụ trách"
            value={classes.data?.length ?? 0}
            hint="Đang được phân công"
            icon="school"
          />
          <StatCard
            label="Buổi sắp tới"
            value={schedule.data?.meta.total ?? 0}
            hint="Trong lịch giảng dạy"
            icon="calendar"
            tone="blue"
          />
          <StatCard
            label="Học viên"
            value={classes.data?.reduce((sum, item) => sum + item.enrolled_students, 0) ?? 0}
            hint="Trong các lớp phụ trách"
            icon="users"
            tone="green"
          />
          <StatCard
            label="Tác vụ hôm nay"
            value="Điểm danh"
            hint="Có thể chỉnh sửa đến 00:00"
            icon="check"
            tone="gold"
          />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <SectionHeader
              title="Lịch dạy sắp tới"
              subtitle="Các buổi gần nhất theo giờ Việt Nam"
              action={
                <Link className="text-xs font-semibold text-gold-dark" to="/teacher/lich-day">
                  Xem toàn bộ →
                </Link>
              }
            />
            <div className="space-y-3">
              {schedule.data?.items.map((s) => (
                <Link
                  key={s.id}
                  to={`/teacher/diem-danh?session=${s.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-gborder p-3.5 transition hover:border-gold hover:bg-gold/[0.04]"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-navy text-white">
                    <span className="text-[10px] uppercase opacity-60">Ngày</span>
                    <b>
                      {new Intl.DateTimeFormat("vi-VN", {
                        day: "2-digit",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(s.starts_at))}
                    </b>
                  </div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{s.title}</b>
                    <p className="mt-1 truncate text-xs text-gtext">
                      {formatDateTime(s.starts_at)} · {s.class_code}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gtext">
                      <Icon name="location" className="h-3 w-3" />
                      {s.location_name ?? "Chưa xếp phòng"}
                    </p>
                  </div>
                  <Icon
                    name="chevron-right"
                    className="h-4 w-4 text-gtext transition group-hover:translate-x-1"
                  />
                </Link>
              ))}
              {!schedule.data?.items.length && (
                <p className="rounded-xl bg-gbg2 p-4 text-sm text-gtext">
                  Chưa có buổi dạy sắp tới.
                </p>
              )}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Lớp đang phụ trách" subtitle="Tổng quan sĩ số và trạng thái" />
            <div className="space-y-3">
              {classes.data?.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  to={`/teacher/lop-phu-trach/${c.id}`}
                  className="block rounded-xl border border-gborder p-3.5 transition hover:border-gold"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="block truncate text-sm">
                        {c.class_code} — {c.name}
                      </b>
                      <p className="mt-1 truncate text-xs text-gtext">{c.course_name}</p>
                    </div>
                    <StatusBadge value={c.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gtext">
                    <span>
                      {c.enrolled_students}/{c.maximum_students} học viên
                    </span>
                    <span>
                      {Math.round((c.enrolled_students / Math.max(c.maximum_students, 1)) * 100)}%
                      sĩ số
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gbg2">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{
                        width: `${Math.min(100, (c.enrolled_students / Math.max(c.maximum_students, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Link to="/teacher/diem-danh">
            <QuickAction
              title="Điểm danh nhanh"
              description="Mở danh sách và lưu trạng thái trong ngày."
              icon="check"
            />
          </Link>
          <Link to="/teacher/danh-gia">
            <QuickAction
              title="Đánh giá kỹ năng"
              description="Cập nhật năng lực thực hành của học viên."
              icon="award"
            />
          </Link>
          <Link to="/teacher/lop-phu-trach">
            <QuickAction
              title="Danh sách lớp"
              description="Xem sĩ số và hồ sơ học viên phụ trách."
              icon="users"
            />
          </Link>
        </div>
      </QueryState>
    </div>
  );
}

export function TeacherClassesPage() {
  const query = useQuery({ queryKey: ["teacher", "classes"], queryFn: teacherApi.classes });
  return (
    <div>
      <PageHeader
        title="Lớp học phụ trách"
        subtitle="Chỉ hiển thị các lớp bạn được phân công giảng dạy."
      />
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={!query.data?.length}
        emptyTitle="Bạn chưa được phân công lớp"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gold-dark">{c.course_code}</p>
                  <h2 className="mt-1 text-lg font-bold text-navy">{c.name}</h2>
                  <p className="text-sm text-gtext">{c.class_code}</p>
                </div>
                <StatusBadge value={c.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gtext">Sĩ số</p>
                  <b>
                    {c.enrolled_students}/{c.maximum_students}
                  </b>
                </div>
                <div>
                  <p className="text-xs text-gtext">Thời gian</p>
                  <b>
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </b>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Link className="flex-1" to={`/teacher/lop-phu-trach/${c.id}`}>
                  <Button className="w-full">Xem lớp</Button>
                </Link>
                <Link to="/teacher/diem-danh">
                  <Button variant="ghost">Điểm danh</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export function TeacherClassDetailPage() {
  const { classId = "" } = useParams();
  const query = useQuery({
    queryKey: ["teacher", "class", classId],
    queryFn: () => teacherApi.classDetail(classId),
    enabled: !!classId,
  });
  return (
    <div>
      <PageHeader
        title={
          query.data ? `${query.data.class.class_code} — ${query.data.class.name}` : "Chi tiết lớp"
        }
        subtitle={query.data?.class.course_name}
        actions={
          <Link to="/teacher/lop-phu-trach">
            <Button variant="ghost">← Danh sách lớp</Button>
          </Link>
        }
      />
      <QueryState loading={query.isLoading} error={query.error}>
        {query.data && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Học viên đang học"
                value={query.data.students.filter((s) => s.status === "enrolled").length}
              />
              <StatCard label="Tiêu chí kỹ năng" value={query.data.competencies.length} />
              <StatCard
                label="Trạng thái"
                value={<StatusBadge value={query.data.class.status} />}
              />
            </div>
            <Card className="p-0">
              <div className="border-b border-gborder px-5 py-4">
                <h2 className="font-bold text-navy">Danh sách học viên</h2>
              </div>
              <div className="divide-y divide-gborder">
                {query.data.students.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div>
                      <b className="text-navy">
                        {student.student_code} — {student.full_name}
                      </b>
                      <div className="mt-1">
                        <StatusBadge value={student.status} />
                      </div>
                    </div>
                    <Link
                      to={`/teacher/lop-phu-trach/${classId}/hoc-vien/${student.student_id}/danh-gia`}
                    >
                      <Button variant="ghost">Đánh giá kỹ năng</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

export function TeacherScheduleLegacyPage() {
  const query = useQuery({
    queryKey: ["teacher", "schedule"],
    queryFn: () => teacherApi.schedule({ page: 1, per_page: 100 }),
  });
  return (
    <div>
      <PageHeader
        title="Lịch giảng dạy"
        subtitle="Thời gian được hiển thị theo múi giờ Việt Nam."
      />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <DataTable
          items={query.data?.items ?? []}
          columns={[
            {
              header: "Thời gian",
              cell: (s) => (
                <div>
                  <b>{formatDateTime(s.starts_at)}</b>
                  <p className="text-xs text-gtext">đến {formatDateTime(s.ends_at)}</p>
                </div>
              ),
            },
            { header: "Lớp", cell: (s) => `${s.class_code} — ${s.class_name}` },
            { header: "Nội dung", cell: (s) => s.title },
            { header: "Địa điểm", cell: (s) => s.location_name ?? "Chưa xếp" },
            { header: "Trạng thái", cell: (s) => <StatusBadge value={s.status} /> },
            {
              header: "",
              cell: (s) => (
                <Link to={`/teacher/diem-danh?session=${s.id}`}>
                  <Button variant="ghost">Điểm danh</Button>
                </Link>
              ),
            },
          ]}
        />
      </QueryState>
    </div>
  );
}

export function TeacherSchedulePage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const range = calendarView === "week" ? weekRange(weekStart) : monthRange(weekStart);
  const query = useQuery({
    queryKey: ["teacher", "schedule", "calendar", calendarView, weekStart],
    queryFn: () => teacherApi.schedule({ page: 1, per_page: 100, from: range.from, to: range.to }),
  });
  const events: WeekCalendarEvent[] = (query.data?.items ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    subtitle: `${session.class_code} · ${session.location_name ?? "Chưa xếp phòng"}`,
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
        title="Lịch giảng dạy"
        subtitle="Bấm vào một buổi học để mở danh sách điểm danh. Thời gian hiển thị theo giờ Việt Nam."
      />
      <QueryState loading={query.isLoading} error={query.error}>
        <WeekCalendar
          events={events}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          view={calendarView}
          onViewChange={setCalendarView}
          onEventClick={(event) => navigate(`/teacher/diem-danh?session=${event.id}`)}
        />
      </QueryState>
    </div>
  );
}

export function AttendancePage() {
  const client = useQueryClient();
  const { search } = useLocation();
  const initial = new URLSearchParams(search).get("session") ?? "";
  const [sessionId, setSessionId] = useState(initial);
  const [records, setRecords] = useState<
    Record<string, { status: AttendanceStatus; note: string }>
  >({});
  const schedule = useQuery({
    queryKey: ["teacher", "schedule", "attendance"],
    queryFn: () => teacherApi.schedule({ page: 1, per_page: 100 }),
  });
  const roster = useQuery({
    queryKey: ["teacher", "attendance", sessionId],
    queryFn: () => teacherApi.attendance(sessionId),
    enabled: !!sessionId,
  });
  useEffect(() => {
    if (roster.data) {
      const next: typeof records = {};
      roster.data.items.forEach((item) => {
        next[item.student_id] = {
          status: item.attendance_status ?? "present",
          note: item.note ?? "",
        };
      });
      setRecords(next);
    }
  }, [roster.data]);
  const save = useMutation({
    mutationFn: () =>
      teacherApi.recordAttendance(
        sessionId,
        roster.data!.items.map((i) => ({
          student_id: i.student_id,
          status: records[i.student_id]?.status ?? "present",
          note: records[i.student_id]?.note || null,
        })),
      ),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["teacher", "attendance", sessionId] }),
  });
  const unrecorded = roster.data?.items.filter((i) => !i.attendance_id).length ?? 0;
  const editState = roster.data
    ? attendanceEditState(roster.data.session)
    : { editable: false, label: "Đang tải" };
  return (
    <div>
      <PageHeader
        title="Điểm danh"
        subtitle="Lưu và chỉnh sửa trong ngày. Sau 00:00 giờ Việt Nam, hệ thống tự ghi Vắng cho học viên chưa có kết quả rồi khóa dữ liệu."
      />
      <Card className="mb-5">
        <Select
          label="Chọn buổi học"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          <option value="">Chọn buổi cần điểm danh</option>
          {schedule.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {formatDateTime(s.starts_at)} · {s.class_code} · {s.title}
            </option>
          ))}
        </Select>
      </Card>
      {!sessionId ? (
        <Card>
          <p className="text-sm text-gtext">Chọn một buổi học để xem danh sách học viên.</p>
        </Card>
      ) : (
        <QueryState loading={roster.isLoading} error={roster.error}>
          {roster.data && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                <StatCard label="Tổng" value={roster.data.summary.total} />
                <StatCard label="Đã ghi" value={roster.data.summary.recorded} />
                <StatCard label="Chưa ghi" value={roster.data.summary.unrecorded} />
                <StatCard label="Trạng thái" value={editState.label} />
              </div>
              {save.error && <ErrorBanner message={errorText(save.error)} />}
              {save.isSuccess && !save.isPending && (
                <div className="mb-4">
                  <SuccessBanner message="Đã lưu điểm danh. Bạn vẫn có thể chỉnh sửa đến hết ngày." />
                </div>
              )}
              <Card className="p-0">
                <div className="divide-y divide-gborder">
                  {roster.data.items.map((item) => (
                    <div
                      key={item.student_id}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_180px_1fr]"
                    >
                      <div>
                        <b>
                          {item.student_code} — {item.full_name}
                        </b>
                        {item.attendance_id && <p className="text-xs text-gtext">Đã lưu</p>}
                      </div>
                      <Select
                        aria-label={`Trạng thái ${item.full_name}`}
                        label="Trạng thái"
                        disabled={!editState.editable}
                        value={records[item.student_id]?.status ?? "present"}
                        onChange={(e) =>
                          setRecords((old) => ({
                            ...old,
                            [item.student_id]: {
                              ...old[item.student_id],
                              status: e.target.value as AttendanceStatus,
                            },
                          }))
                        }
                      >
                        {attendanceStatuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Ghi chú"
                        disabled={!editState.editable}
                        value={records[item.student_id]?.note ?? ""}
                        onChange={(e) =>
                          setRecords((old) => ({
                            ...old,
                            [item.student_id]: { ...old[item.student_id], note: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </Card>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  disabled={!editState.editable}
                  onClick={() =>
                    setRecords(
                      Object.fromEntries(
                        roster.data!.items.map((i) => [
                          i.student_id,
                          { status: "present", note: records[i.student_id]?.note ?? "" },
                        ]),
                      ),
                    )
                  }
                >
                  Đánh dấu tất cả có mặt
                </Button>
                <Button
                  disabled={!editState.editable}
                  loading={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {!editState.editable
                    ? editState.label
                    : `Lưu điểm danh${unrecorded ? ` (${unrecorded} chưa ghi)` : ""}`}
                </Button>
              </div>
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}

export function AssessmentPage() {
  const { classId = "", studentId = "" } = useParams();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["teacher", "class", classId],
    queryFn: () => teacherApi.classDetail(classId),
    enabled: !!classId,
  });
  const history = useQuery({
    queryKey: ["teacher", "assessments", classId, studentId],
    queryFn: () => teacherApi.assessments(classId, studentId),
    enabled: !!classId && !!studentId,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overall, setOverall] = useState("");
  const [evidenceURL, setEvidenceURL] = useState("");
  const [ratingMap, setRatingMap] = useState<Record<string, CompetencyRating>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  useEffect(() => {
    if (detail.data && !editingId)
      setRatingMap(Object.fromEntries(detail.data.competencies.map((c) => [c.id, "not_assessed"])));
  }, [detail.data, editingId]);
  useEffect(() => {
    const draft = history.data?.items.find((item) => item.status === "draft");
    if (!draft) {
      setEditingId(null);
      setOverall("");
      setEvidenceURL("");
      setComments({});
      return;
    }
    setEditingId(draft.id);
    setOverall(draft.overall_comment ?? "");
    setEvidenceURL(draft.evidence_url ?? "");
    setRatingMap(
      Object.fromEntries(draft.items.map((item) => [item.competency_criterion_id, item.rating])),
    );
    setComments(
      Object.fromEntries(
        draft.items
          .filter((item) => item.comment)
          .map((item) => [item.competency_criterion_id, item.comment ?? ""]),
      ),
    );
  }, [history.data]);
  const student = detail.data?.students.find((s) => s.student_id === studentId);
  const assessmentBody = {
    session_id: null,
    overall_comment: overall || null,
    evidence_url: evidenceURL.trim() || null,
    items:
      detail.data?.competencies.map((c) => ({
        competency_criterion_id: c.id,
        rating: ratingMap[c.id] ?? ("not_assessed" as CompetencyRating),
        comment: comments[c.id] || null,
      })) ?? [],
  };
  const create = useMutation({
    mutationFn: () =>
      editingId
        ? teacherApi.updateAssessment(editingId, assessmentBody)
        : teacherApi.createAssessment(classId, studentId, assessmentBody),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["teacher", "assessments", classId, studentId] }),
  });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "submit" | "lock" }) =>
      action === "submit" ? teacherApi.submitAssessment(id) : teacherApi.lockAssessment(id),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["teacher", "assessments", classId, studentId] }),
  });
  return (
    <div>
      <PageHeader
        title={`Đánh giá kỹ năng${student ? ` — ${student.full_name}` : ""}`}
        subtitle={
          student
            ? `${student.student_code} · ${detail.data?.class.class_code}`
            : "Tạo đánh giá thực hành theo tiêu chí khóa học."
        }
        actions={
          <Link to={`/teacher/lop-phu-trach/${classId}`}>
            <Button variant="ghost">← Về lớp</Button>
          </Link>
        }
      />
      <QueryState
        loading={detail.isLoading || history.isLoading}
        error={detail.error || history.error}
      >
        {detail.data && (
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-navy">Phiếu đánh giá mới</h2>
              {create.error && <ErrorBanner message={errorText(create.error)} />}
              <div className="space-y-4">
                {detail.data.competencies.map((criterion) => (
                  <div key={criterion.id} className="rounded-xl border border-gborder p-4">
                    <div className="mb-3 flex justify-between gap-2">
                      <div>
                        <b>
                          {criterion.code} — {criterion.name}
                        </b>
                        {criterion.description && (
                          <p className="mt-1 text-xs text-gtext">{criterion.description}</p>
                        )}
                      </div>
                      {criterion.is_required && (
                        <span className="text-xs font-semibold text-error">Bắt buộc</span>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        label="Mức đánh giá"
                        value={ratingMap[criterion.id] ?? "not_assessed"}
                        onChange={(e) =>
                          setRatingMap((old) => ({
                            ...old,
                            [criterion.id]: e.target.value as CompetencyRating,
                          }))
                        }
                      >
                        {ratings.map((r) => (
                          <option key={r} value={r}>
                            {statusLabel(r)}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Nhận xét"
                        value={comments[criterion.id] ?? ""}
                        onChange={(e) =>
                          setComments((old) => ({ ...old, [criterion.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <Textarea
                  label="Nhận xét chung"
                  value={overall}
                  onChange={(e) => setOverall(e.target.value)}
                />
                <Input
                  type="url"
                  label="Liên kết minh chứng (tùy chọn)"
                  placeholder="https://drive.google.com/..."
                  value={evidenceURL}
                  onChange={(e) => setEvidenceURL(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button loading={create.isPending} onClick={() => create.mutate()}>
                    Lưu bản nháp
                  </Button>
                </div>
              </div>
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-bold text-navy">Lịch sử đánh giá</h2>
              {transition.error && <ErrorBanner message={errorText(transition.error)} />}
              <div className="space-y-3">
                {history.data?.items.map((a) => (
                  <div key={a.id} className="rounded-xl border border-gborder p-4">
                    <div className="flex justify-between">
                      <b>Lần #{a.assessment_no}</b>
                      <StatusBadge value={a.status} />
                    </div>
                    <p className="mt-2 text-sm text-gtext">
                      {a.overall_comment || "Không có nhận xét chung"}
                    </p>
                    {a.evidence_url && (
                      <a
                        className="mt-2 inline-flex text-xs font-semibold text-gold-dark hover:underline"
                        href={a.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem minh chứng ↗
                      </a>
                    )}
                    <p className="mt-2 text-xs text-gtext">
                      {
                        a.items.filter((i) => ["competent", "good", "excellent"].includes(i.rating))
                          .length
                      }
                      /{a.items.length} tiêu chí đạt
                    </p>
                    <div className="mt-3 flex gap-2">
                      {a.status === "draft" && (
                        <Button
                          loading={transition.isPending}
                          onClick={() => transition.mutate({ id: a.id, action: "submit" })}
                        >
                          Gửi đánh giá
                        </Button>
                      )}
                      {a.status === "submitted" && (
                        <Button
                          variant="accent"
                          loading={transition.isPending}
                          onClick={() => transition.mutate({ id: a.id, action: "lock" })}
                        >
                          Khóa kết quả
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!history.data?.items.length && (
                  <p className="text-sm text-gtext">Chưa có đánh giá.</p>
                )}
              </div>
            </Card>
          </div>
        )}
      </QueryState>
    </div>
  );
}

export function TeacherAssessmentLandingPage() {
  const classes = useQuery({ queryKey: ["teacher", "classes"], queryFn: teacherApi.classes });
  return (
    <div>
      <PageHeader
        title="Đánh giá kỹ năng"
        subtitle="Chọn lớp và học viên để tạo hoặc xem lịch sử đánh giá."
      />
      <QueryState loading={classes.isLoading} error={classes.error} empty={!classes.data?.length}>
        <div className="grid gap-4 md:grid-cols-2">
          {classes.data?.map((c) => (
            <Link key={c.id} to={`/teacher/lop-phu-trach/${c.id}`}>
              <Card className="hover:border-gold">
                <b>
                  {c.class_code} — {c.name}
                </b>
                <p className="mt-1 text-sm text-gtext">
                  {c.enrolled_students} học viên · Mở danh sách lớp để chọn học viên
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
