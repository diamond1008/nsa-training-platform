import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { currentWeekStart, monthRange, WeekCalendar, weekRange } from "../../components/calendar";
import type { CalendarStat, CalendarView, WeekCalendarEvent } from "../../components/calendar";
import {
  AttendanceRoster,
  DataTable,
  Pagination,
  QueryState,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "../../components/data";
import { Icon } from "../../components/icons";
import { Button, Card, Modal, PageHeader, ProgressBar, Select } from "../../components/ui";
import type { ClassSession } from "../../lib/domainTypes";
import { formatDateTime } from "../../lib/format";
import { studentApi } from "./studentApi";

export function StudentDashboardPage() {
  const progress = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () => studentApi.progress(),
  });
  const schedule = useQuery({
    queryKey: ["student", "schedule", "dashboard"],
    queryFn: () => studentApi.schedule({ page: 1, per_page: 3, from: new Date().toISOString() }),
  });
  const attendance = useQuery({
    queryKey: ["student", "attendance", "summary"],
    queryFn: () => studentApi.attendanceSummary(),
  });
  const averageAttendance = attendance.data?.items.length
    ? attendance.data.items.reduce((sum, item) => sum + item.attendance_pct, 0) /
      attendance.data.items.length
    : 0;
  return (
    <div>
      <PageHeader
        eyebrow="Không gian học tập"
        title="Hành trình của bạn"
        subtitle="Lịch học, chuyên cần và tiến độ đào tạo được cập nhật tại một nơi."
        actions={
          <Link to="/student/lich-hoc">
            <Button variant="accent">
              <Icon name="calendar" className="h-4 w-4" />
              Xem lịch học
            </Button>
          </Link>
        }
      />
      <QueryState
        loading={progress.isLoading || schedule.isLoading || attendance.isLoading}
        error={progress.error || schedule.error || attendance.error}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tiến độ trung bình"
            value={`${(progress.data?.summary.average_progress_pct ?? 0).toFixed(0)}%`}
            hint="Trên tất cả khóa học"
            icon="chart"
          />
          <StatCard
            label="Chuyên cần"
            value={`${averageAttendance.toFixed(0)}%`}
            hint="Có mặt và đi trễ"
            icon="check"
            tone="green"
          />
          <StatCard
            label="Lớp đủ điều kiện"
            value={`${progress.data?.summary.eligible_classes ?? 0}/${progress.data?.summary.classes ?? 0}`}
            hint="Theo quy định hoàn thành"
            icon="award"
            tone="gold"
          />
          <StatCard
            label="Buổi sắp tới"
            value={schedule.data?.meta.total ?? 0}
            hint="Trong lịch cá nhân"
            icon="calendar"
            tone="blue"
          />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <SectionHeader
              title="Tiến độ khóa học"
              subtitle="Tổng hợp chuyên cần, kỹ năng và đánh giá"
              action={
                <Link className="text-xs font-semibold text-gold-dark" to="/student/tien-do">
                  Chi tiết →
                </Link>
              }
            />
            <div className="space-y-5">
              {progress.data?.items.map((item) => (
                <Link
                  key={item.class_id}
                  to="/student/tien-do"
                  className="block rounded-xl border border-transparent p-2 transition hover:border-gborder hover:bg-gbg"
                >
                  <div className="mb-3 flex justify-between gap-3">
                    <div>
                      <b className="text-sm">
                        {item.class_code} — {item.class_name}
                      </b>
                      <p className="text-xs text-gtext">{item.course_name}</p>
                    </div>
                    <StatusBadge value={item.completion_status} />
                  </div>
                  <ProgressBar value={item.overall_progress_pct} label="Hoàn thành" />
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <SectionHeader
              title="Lịch sắp tới"
              subtitle="Các buổi học gần nhất"
              action={
                <Link className="text-xs font-semibold text-gold-dark" to="/student/lich-hoc">
                  Xem tất cả →
                </Link>
              }
            />
            <div className="space-y-3">
              {schedule.data?.items.map((s) => (
                <Link
                  to="/student/lich-hoc"
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-gborder p-3 transition hover:border-gold"
                >
                  <div className="flex shrink-0 items-center justify-center text-info">
                    <Icon name="clock" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{s.title}</b>
                    <p className="mt-0.5 truncate text-xs text-gtext">
                      {formatDateTime(s.starts_at)}
                    </p>
                    <p className="truncate text-[11px] text-gtext">
                      {s.class_code} · {s.location_name ?? "Chưa xếp phòng"}
                    </p>
                  </div>
                </Link>
              ))}
              {!schedule.data?.items.length && (
                <p className="rounded-xl bg-gbg2 p-4 text-sm text-gtext">
                  Chưa có lịch học sắp tới.
                </p>
              )}
            </div>
          </Card>
        </div>
      </QueryState>
    </div>
  );
}

export function StudentCoursesPage() {
  const query = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () => studentApi.progress(),
  });
  return (
    <div>
      <PageHeader
        title="Khóa học của tôi"
        subtitle="Thông tin lớp và chương trình đang theo học."
      />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <div className="grid gap-4 md:grid-cols-2">
          {query.data?.items.map((item) => (
            <Card key={item.class_id}>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gold-dark">{item.course_code}</p>
                  <h2 className="mt-1 text-lg font-bold text-navy">{item.course_name}</h2>
                  <p className="text-sm text-gtext">
                    {item.class_code} — {item.class_name}
                  </p>
                </div>
                <StatusBadge value={item.class_status} />
              </div>
              <div className="mt-5">
                <ProgressBar value={item.overall_progress_pct} label="Tiến độ tổng thể" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gtext">Buổi học</p>
                  <b>
                    {item.sessions.completed}/{item.sessions.required}
                  </b>
                </div>
                <div>
                  <p className="text-xs text-gtext">Kỹ năng</p>
                  <b>
                    {item.competencies.met}/{item.competencies.required}
                  </b>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export function StudentScheduleLegacyPage() {
  const query = useQuery({
    queryKey: ["student", "schedule"],
    queryFn: () => studentApi.schedule({ page: 1, per_page: 100 }),
  });
  return (
    <div>
      <PageHeader title="Lịch học" subtitle="Tất cả buổi học thuộc các lớp bạn đang theo học." />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <DataTable
          items={query.data?.items ?? []}
          columns={[
            {
              header: "Thời gian",
              className: "whitespace-nowrap min-w-[150px]",
              cell: (s) => (
                <div>
                  <b>{formatDateTime(s.starts_at)}</b>
                  <p className="text-xs text-gtext">đến {formatDateTime(s.ends_at)}</p>
                </div>
              ),
            },
            {
              header: "Lớp",
              className: "min-w-[180px]",
              cell: (s) => `${s.class_code} — ${s.class_name}`,
            },
            { header: "Nội dung", className: "min-w-[200px]", cell: (s) => s.title },
            {
              header: "Giảng viên",
              className: "whitespace-nowrap",
              cell: (s) => s.teacher_name ?? "Chưa phân công",
            },
            {
              header: "Địa điểm",
              className: "whitespace-nowrap",
              cell: (s) => s.location_name ?? "Chưa xếp",
            },
            {
              header: "Trạng thái",
              className: "whitespace-nowrap",
              cell: (s) => <StatusBadge value={s.status} />,
            },
          ]}
        />
      </QueryState>
    </div>
  );
}

export function StudentSchedulePage() {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [selected, setSelected] = useState<ClassSession | null>(null);
  const range = calendarView === "week" ? weekRange(weekStart) : monthRange(weekStart);
  const schedule = useQuery({
    queryKey: ["student", "schedule", "calendar", calendarView, weekStart],
    queryFn: () => studentApi.schedule({ page: 1, per_page: 100, from: range.from, to: range.to }),
  });
  const attendance = useQuery({
    queryKey: ["student", "attendance", "calendar"],
    queryFn: () => studentApi.attendance({ page: 1, per_page: 100 }),
  });
  const classAttendance = useQuery({
    queryKey: ["student", "session-attendance", selected?.id],
    queryFn: () => studentApi.sessionAttendance(selected!.id),
    enabled: !!selected,
  });
  const attendanceFor = (sessionId: string) =>
    attendance.data?.items.find((item) => item.class_session_id === sessionId);
  const events: WeekCalendarEvent[] = (schedule.data?.items ?? []).map((session) => {
    const record = attendanceFor(session.id);
    return {
      id: session.id,
      title: session.title,
      subtitle: `${session.class_code} · ${session.location_name ?? "Chưa xếp phòng"}`,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      tone:
        record?.status === "absent"
          ? "red"
          : record?.status === "late"
            ? "gold"
            : record?.status === "present"
              ? "green"
              : session.status === "cancelled"
                ? "gray"
                : "navy",
    };
  });
  const selectedAttendance = selected ? attendanceFor(selected.id) : undefined;
  const selectedFinished = selected ? new Date(selected.ends_at).getTime() <= Date.now() : false;
  const now = Date.now();
  const calendarStats = [
    {
      label: "Sắp học",
      value: (schedule.data?.items ?? []).filter(
        (session) => session.status !== "cancelled" && new Date(session.starts_at).getTime() > now,
      ).length,
      tone: "navy",
    },
    {
      label: "Đã tham gia",
      value: (schedule.data?.items ?? []).filter((session) => {
        const status = attendanceFor(session.id)?.status;
        return status === "present" || status === "late";
      }).length,
      tone: "green",
    },
    {
      label: "Vắng mặt",
      value: (schedule.data?.items ?? []).filter((session) => {
        const status = attendanceFor(session.id)?.status;
        return status === "absent" || status === "excused";
      }).length,
      tone: "red",
    },
  ] satisfies CalendarStat[];
  return (
    <div>
      <PageHeader
        title="Lịch học"
        subtitle="Bấm vào một buổi học để xem thông tin và tình trạng điểm danh của cả lớp."
      />
      <QueryState loading={schedule.isLoading} error={schedule.error}>
        <WeekCalendar
          events={events}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          view={calendarView}
          onViewChange={setCalendarView}
          stats={calendarStats}
          onEventClick={(event) =>
            setSelected((schedule.data?.items ?? []).find((item) => item.id === event.id) ?? null)
          }
        />
      </QueryState>
      <Modal
        open={!!selected}
        title={selected?.title ?? "Chi tiết buổi học"}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-4 rounded-xl bg-gbg2 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gtext">Thời gian</p>
                <b>{formatDateTime(selected.starts_at)}</b>
                <p className="text-sm text-gtext">đến {formatDateTime(selected.ends_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gtext">Lớp học</p>
                <b>
                  {selected.class_code} — {selected.class_name}
                </b>
                <p className="text-sm text-gtext">{selected.course_name}</p>
              </div>
              <div>
                <p className="text-xs text-gtext">Giảng viên</p>
                <b>{selected.teacher_name ?? "Chưa phân công"}</b>
              </div>
              <div>
                <p className="text-xs text-gtext">Địa điểm</p>
                <b>{selected.location_name ?? "Chưa xếp phòng"}</b>
              </div>
            </div>
            <div className="rounded-xl border border-gborder p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gtext">
                Trạng thái điểm danh của bạn
              </p>
              <div className="mt-2" data-testid="student-own-attendance-status">
                {attendance.isLoading ? (
                  <span className="text-sm text-gtext">Đang tải kết quả…</span>
                ) : selectedAttendance ? (
                  <StatusBadge value={selectedAttendance.status} />
                ) : (
                  <span className="text-sm font-semibold text-gtext">
                    {selectedFinished ? "Chưa có kết quả điểm danh" : "Buổi học chưa diễn ra"}
                  </span>
                )}
              </div>
              {selectedAttendance?.note && (
                <p className="mt-3 text-sm text-gtext">Ghi chú: {selectedAttendance.note}</p>
              )}
            </div>
            <div>
              <h3 className="mb-3 font-bold text-navy">Điểm danh của lớp</h3>
              <QueryState loading={classAttendance.isLoading} error={classAttendance.error}>
                {classAttendance.data && <AttendanceRoster data={classAttendance.data} />}
              </QueryState>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function StudentAttendancePage() {
  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState("");
  const summary = useQuery({
    queryKey: ["student", "attendance", "summary"],
    queryFn: () => studentApi.attendanceSummary(),
  });
  const history = useQuery({
    queryKey: ["student", "attendance", page, classId],
    queryFn: () => studentApi.attendance({ page, per_page: 10, class_id: classId }),
  });
  const selected = summary.data?.items.find((s) => s.class_id === classId);
  const summaryItems = summary.data?.items ?? [];
  const totals = summaryItems.reduce(
    (result, item) => ({
      present: result.present + item.present_sessions,
      late: result.late + item.late_sessions,
      absent: result.absent + item.absent_sessions,
      excused: result.excused + item.excused_sessions,
      recorded: result.recorded + item.recorded_sessions,
    }),
    { present: 0, late: 0, absent: 0, excused: 0, recorded: 0 },
  );
  const aggregateDenominator = totals.recorded - totals.excused;
  const displayAttendancePct =
    selected?.attendance_pct ??
    (aggregateDenominator > 0 ? (100 * (totals.present + totals.late)) / aggregateDenominator : 0);
  const atRisk = selected
    ? selected.is_at_risk
      ? [selected]
      : []
    : summaryItems.filter((s) => s.is_at_risk);
  return (
    <div>
      <PageHeader
        title="Điểm danh của tôi"
        subtitle="Theo dõi tỷ lệ chuyên cần và lịch sử từng buổi học."
      />
      <div className="mb-4 max-w-sm">
        <Select
          label="Lọc theo lớp"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả lớp</option>
          {summary.data?.items.map((s) => (
            <option key={s.class_id} value={s.class_id}>
              {s.class_code} — {s.class_name}
            </option>
          ))}
        </Select>
      </div>
      <QueryState loading={summary.isLoading} error={summary.error}>
        {summary.data && (
          <>
            {atRisk.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-error/20 bg-error-bg p-4 text-sm text-error">
                <b>Cảnh báo chuyên cần</b>
                <p className="mt-1">
                  {atRisk
                    .map(
                      (item) =>
                        `${item.class_code}: ${item.attendance_pct.toFixed(0)}% / yêu cầu ${item.minimum_attendance_pct.toFixed(0)}%`,
                    )
                    .join(" · ")}
                </p>
              </div>
            ) : null}
            <div className="mb-5 grid gap-3 sm:grid-cols-4">
              <StatCard label="Chuyên cần" value={`${displayAttendancePct.toFixed(0)}%`} />
              <StatCard label="Có mặt" value={selected?.present_sessions ?? totals.present} />
              <StatCard label="Đi trễ" value={selected?.late_sessions ?? totals.late} />
              <StatCard label="Vắng" value={selected?.absent_sessions ?? totals.absent} />
            </div>
          </>
        )}
      </QueryState>
      <QueryState
        loading={history.isLoading}
        error={history.error}
        empty={!history.data?.items.length}
      >
        <DataTable
          items={history.data?.items ?? []}
          columns={[
            {
              header: "Thời gian",
              className: "whitespace-nowrap min-w-[140px]",
              cell: (a) => formatDateTime(a.starts_at),
            },
            {
              header: "Lớp",
              className: "min-w-[180px]",
              cell: (a) => `${a.class_code} — ${a.class_name}`,
            },
            { header: "Buổi học", className: "min-w-[180px]", cell: (a) => a.session_title },
            {
              header: "Trạng thái",
              className: "whitespace-nowrap",
              cell: (a) => <StatusBadge value={a.status} />,
            },
            { header: "Ghi chú", cell: (a) => a.note || "—" },
          ]}
        />
        <Pagination page={page} totalPages={history.data?.meta.total_pages ?? 0} onPage={setPage} />
      </QueryState>
    </div>
  );
}

export function StudentAssessmentsPage() {
  const query = useQuery({
    queryKey: ["student", "assessments"],
    queryFn: () => studentApi.assessments({ page: 1, per_page: 100 }),
  });
  const scores = useQuery({
    queryKey: ["student", "test-results"],
    queryFn: studentApi.testResults,
  });
  return (
    <div>
      <PageHeader
        title="Kết quả học tập"
        subtitle="Bài kiểm tra được làm trên giấy; hệ thống chỉ hiển thị điểm do giảng viên nhập sau khi chấm."
      />
      <QueryState loading={scores.isLoading} error={scores.error}>
        <div className="mb-6 space-y-4">
          {scores.data?.map((course) => (
            <Card key={course.course_id}>
              <SectionHeader
                title={`${course.course_code} · ${course.course_name}`}
                subtitle="Hệ thống dùng kết quả thi chính thức (Lần 2 nếu có thi lại) để xét hoàn thành."
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {course.tests.map((result) => (
                  <div key={result.test.id} className="rounded-xl border border-gborder p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <b>
                          {result.test.code} · {result.test.title}
                        </b>
                        <p className="mt-1 text-xs text-gtext">
                          {result.test.kind === "final_exam"
                            ? "Thi kết thúc · yêu cầu trên 5"
                            : `Điểm đạt từ ${result.test.pass_score}`}
                        </p>
                      </div>
                      <StatusBadge value={result.passed ? "passed" : "pending"} />
                    </div>
                    <p className="mt-4 text-2xl font-bold text-navy">
                      {result.best_score == null ? "—" : result.best_score.toFixed(2)}
                    </p>
                    <p className="text-xs text-gtext">
                      Điểm chính thức · {result.attempts.length}/2 lần thi
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <div className="space-y-4">
          {query.data?.items.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gold-dark">
                    {a.course_code} · Lần #{a.assessment_no}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-navy">
                    {a.class_code} — {a.class_name}
                  </h2>
                  <p className="text-sm text-gtext">Giảng viên: {a.teacher_name}</p>
                </div>
                <StatusBadge value={a.status} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {a.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gborder p-3">
                    <div className="flex justify-between gap-2">
                      <b className="text-sm">{item.criterion_code}</b>
                      <StatusBadge value={item.rating} />
                    </div>
                    <p className="mt-1 text-sm">{item.criterion_name}</p>
                    {item.comment && <p className="mt-2 text-xs text-gtext">{item.comment}</p>}
                  </div>
                ))}
              </div>
              {a.overall_comment && (
                <div className="mt-4 rounded-lg bg-gbg2 p-3 text-sm">
                  <b>Nhận xét chung:</b> {a.overall_comment}
                </div>
              )}
              {a.evidence_url && (
                <a
                  className="mt-3 inline-flex text-sm font-semibold text-gold-dark hover:underline"
                  href={a.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Xem minh chứng đánh giá ↗
                </a>
              )}
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export function StudentProgressPage() {
  const query = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () => studentApi.progress(),
  });
  const certificates = useQuery({
    queryKey: ["student", "certificates"],
    queryFn: () => studentApi.certificates(),
  });
  const downloadCertificate = async (id: string, number: string) => {
    const blob = await studentApi.certificatePDF(id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${number}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader
        title="Tiến độ học tập"
        subtitle="Kết quả được tính từ buổi học, chuyên cần, kỹ năng và bài đánh giá."
      />
      <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard label="Số lớp" value={query.data?.summary.classes ?? 0} />
          <StatCard
            label="Tiến độ trung bình"
            value={`${(query.data?.summary.average_progress_pct ?? 0).toFixed(0)}%`}
          />
          <StatCard
            label="Đủ điều kiện hoàn thành"
            value={query.data?.summary.eligible_classes ?? 0}
          />
        </div>
        <div className="space-y-5">
          {query.data?.items.map((item) => (
            <Card key={item.class_id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gold-dark">{item.course_code}</p>
                  <h2 className="text-lg font-bold text-navy">{item.course_name}</h2>
                  <p className="text-sm text-gtext">
                    {item.class_code} — {item.class_name}
                  </p>
                </div>
                <StatusBadge value={item.completion_status} />
              </div>
              <div className="mt-5">
                <ProgressBar value={item.overall_progress_pct} label="Tiến độ tổng thể" />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ProgressBar
                  value={item.sessions.percent}
                  label={`Buổi học ${item.sessions.completed}/${item.sessions.required}`}
                />
                <ProgressBar
                  value={item.attendance.percent}
                  label={`Chuyên cần (yêu cầu ${item.attendance.minimum_required_pct}%)`}
                />
                <ProgressBar
                  value={item.competencies.percent}
                  label={`Kỹ năng ${item.competencies.met}/${item.competencies.required}`}
                />
                <ProgressBar
                  value={item.assessments.percent}
                  label={`Đánh giá ${item.assessments.completed}/${item.assessments.required}`}
                />
                <ProgressBar
                  value={item.tests.percent}
                  label={`Bài kiểm tra bắt buộc ${item.tests.passed}/${item.tests.required}`}
                />
                <ProgressBar
                  value={
                    item.final_exam.score == null
                      ? 0
                      : Math.min(100, (item.final_exam.score / 10) * 100)
                  }
                  label={`Thi kết thúc: ${item.final_exam.score == null ? "chưa có điểm" : `${item.final_exam.score.toFixed(2)} · yêu cầu > 5`}`}
                />
              </div>
              {!!item.failure_reasons.length && (
                <div className="mt-4 rounded-lg bg-gold/10 p-3 text-sm text-gold-dark">
                  <b>Điều kiện còn thiếu:</b>
                  <ul className="mt-1 list-disc pl-5">
                    {item.failure_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      </QueryState>
      {!!certificates.data?.length && (
        <section className="mt-6">
          <SectionHeader
            title="Chứng nhận của tôi"
            subtitle="Tải bản PDF hoặc dùng mã xác thực để đối chiếu."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {certificates.data.map((certificate) => (
              <Card key={certificate.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gold-dark">
                      {certificate.certificate_number}
                    </p>
                    <h3 className="mt-1 font-bold text-navy">{certificate.course_name}</h3>
                    <p className="text-sm text-gtext">{certificate.class_code}</p>
                  </div>
                  <StatusBadge value={certificate.is_current ? "active" : "revoked"} />
                </div>
                <p className="mt-4 break-all rounded-lg bg-gbg2 p-3 text-xs text-gtext">
                  Mã xác thực: {certificate.verification_code}
                </p>
                {certificate.is_current && (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void downloadCertificate(certificate.id, certificate.certificate_number)
                        }
                      >
                        Tải chứng nhận điện tử (PDF)
                      </Button>
                      {certificate.diploma_file_url && (
                        <a
                          href={certificate.diploma_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-lg bg-gold-dark px-4 py-2 text-sm font-semibold text-white hover:bg-gold"
                        >
                          📄 Tải bản scan bằng tốt nghiệp ↗
                        </a>
                      )}
                    </div>
                    {certificate.diploma_file_name && (
                      <p className="text-xs text-gtext">
                        Đã đính kèm bản scan chính thức:{" "}
                        <span className="font-medium text-navy">
                          {certificate.diploma_file_name}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
