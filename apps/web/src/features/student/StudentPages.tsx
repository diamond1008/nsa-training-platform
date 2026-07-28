import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { currentWeekStart, WeekCalendar, weekRange } from "../../components/calendar";
import type { WeekCalendarEvent } from "../../components/calendar";
import { DataTable, Pagination, QueryState, StatCard, StatusBadge } from "../../components/data";
import { Card, Modal, PageHeader, ProgressBar, Select } from "../../components/ui";
import type { ClassSession } from "../../lib/domainTypes";
import { formatDateTime } from "../../lib/format";
import { studentApi } from "./studentApi";

export function StudentDashboardPage() {
  const progress = useQuery({ queryKey: ["student", "progress"], queryFn: () => studentApi.progress() });
  const schedule = useQuery({ queryKey: ["student", "schedule", "dashboard"], queryFn: () => studentApi.schedule({ page: 1, per_page: 3, from: new Date().toISOString() }) });
  const attendance = useQuery({ queryKey: ["student", "attendance", "summary"], queryFn: () => studentApi.attendanceSummary() });
  const averageAttendance = attendance.data?.items.length ? attendance.data.items.reduce((sum, item) => sum + item.attendance_pct, 0) / attendance.data.items.length : 0;
  return <div><PageHeader title="Tổng quan Học viên" subtitle="Lịch học, chuyên cần, kỹ năng và tiến độ của riêng bạn." /><QueryState loading={progress.isLoading || schedule.isLoading || attendance.isLoading} error={progress.error || schedule.error || attendance.error}><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Tiến độ trung bình" value={`${(progress.data?.summary.average_progress_pct ?? 0).toFixed(0)}%`} /><StatCard label="Chuyên cần" value={`${averageAttendance.toFixed(0)}%`} /><StatCard label="Lớp đủ điều kiện" value={`${progress.data?.summary.eligible_classes ?? 0}/${progress.data?.summary.classes ?? 0}`} /></div><div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]"><Card><h2 className="mb-4 font-bold text-navy">Tiến độ khóa học</h2><div className="space-y-5">{progress.data?.items.map((item) => <Link key={item.class_id} to="/student/tien-do" className="block"><div className="mb-2 flex justify-between gap-3"><div><b>{item.class_code} — {item.class_name}</b><p className="text-xs text-gtext">{item.course_name}</p></div><StatusBadge value={item.completion_status} /></div><ProgressBar value={item.overall_progress_pct} label="Hoàn thành" /></Link>)}</div></Card><Card><div className="mb-4 flex justify-between"><h2 className="font-bold text-navy">Lịch sắp tới</h2><Link className="text-sm font-semibold text-gold-dark" to="/student/lich-hoc">Xem tất cả</Link></div><div className="space-y-3">{schedule.data?.items.map((s) => <div key={s.id} className="rounded-xl border border-gborder p-3"><b>{formatDateTime(s.starts_at)}</b><p className="text-sm">{s.title}</p><p className="text-xs text-gtext">{s.class_code} · {s.location_name ?? "Chưa xếp phòng"}</p></div>)}</div></Card></div></QueryState></div>;
}

export function StudentCoursesPage() {
  const query = useQuery({ queryKey: ["student", "progress"], queryFn: () => studentApi.progress() });
  return <div><PageHeader title="Khóa học của tôi" subtitle="Thông tin lớp và chương trình đang theo học." /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><div className="grid gap-4 md:grid-cols-2">{query.data?.items.map((item) => <Card key={item.class_id}><div className="flex justify-between gap-3"><div><p className="text-xs font-semibold text-gold-dark">{item.course_code}</p><h2 className="mt-1 text-lg font-bold text-navy">{item.course_name}</h2><p className="text-sm text-gtext">{item.class_code} — {item.class_name}</p></div><StatusBadge value={item.class_status} /></div><div className="mt-5"><ProgressBar value={item.overall_progress_pct} label="Tiến độ tổng thể" /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gtext">Buổi học</p><b>{item.sessions.completed}/{item.sessions.required}</b></div><div><p className="text-xs text-gtext">Kỹ năng</p><b>{item.competencies.met}/{item.competencies.required}</b></div></div></Card>)}</div></QueryState></div>;
}

export function StudentScheduleLegacyPage() {
  const query = useQuery({ queryKey: ["student", "schedule"], queryFn: () => studentApi.schedule({ page: 1, per_page: 100 }) });
  return <div><PageHeader title="Lịch học" subtitle="Tất cả buổi học thuộc các lớp bạn đang theo học." /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><DataTable items={query.data?.items ?? []} columns={[{ header: "Thời gian", cell: (s) => <div><b>{formatDateTime(s.starts_at)}</b><p className="text-xs text-gtext">đến {formatDateTime(s.ends_at)}</p></div> }, { header: "Lớp", cell: (s) => `${s.class_code} — ${s.class_name}` }, { header: "Nội dung", cell: (s) => s.title }, { header: "Giảng viên", cell: (s) => s.teacher_name ?? "Chưa phân công" }, { header: "Địa điểm", cell: (s) => s.location_name ?? "Chưa xếp" }, { header: "Trạng thái", cell: (s) => <StatusBadge value={s.status} /> }]} /></QueryState></div>;
}

export function StudentSchedulePage() {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [selected, setSelected] = useState<ClassSession | null>(null);
  const range = weekRange(weekStart);
  const schedule = useQuery({
    queryKey: ["student", "schedule", "calendar", weekStart],
    queryFn: () => studentApi.schedule({ page: 1, per_page: 100, from: range.from, to: range.to }),
  });
  const attendance = useQuery({
    queryKey: ["student", "attendance", "calendar"],
    queryFn: () => studentApi.attendance({ page: 1, per_page: 100 }),
  });
  const attendanceFor = (sessionId: string) => attendance.data?.items.find((item) => item.class_session_id === sessionId);
  const events: WeekCalendarEvent[] = (schedule.data?.items ?? []).map((session) => {
    const record = attendanceFor(session.id);
    return {
      id: session.id,
      title: session.title,
      subtitle: `${session.class_code} · ${session.location_name ?? "Chưa xếp phòng"}`,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      tone: record?.status === "absent" ? "red" : record?.status === "late" ? "gold" : record?.status === "present" ? "green" : session.status === "cancelled" ? "gray" : "navy",
    };
  });
  const selectedAttendance = selected ? attendanceFor(selected.id) : undefined;
  const selectedFinished = selected ? new Date(selected.ends_at).getTime() <= Date.now() : false;
  return <div>
    <PageHeader title="Lịch học" subtitle="Bấm vào một buổi học để xem thông tin và trạng thái điểm danh của bạn." />
    <QueryState loading={schedule.isLoading} error={schedule.error}>
      <WeekCalendar events={events} weekStart={weekStart} onWeekStartChange={setWeekStart} onEventClick={(event) => setSelected((schedule.data?.items ?? []).find((item) => item.id === event.id) ?? null)} />
    </QueryState>
    <Modal open={!!selected} title={selected?.title ?? "Chi tiết buổi học"} onClose={() => setSelected(null)}>
      {selected && <div className="space-y-5">
        <div className="grid gap-4 rounded-xl bg-gbg2 p-4 sm:grid-cols-2">
          <div><p className="text-xs text-gtext">Thời gian</p><b>{formatDateTime(selected.starts_at)}</b><p className="text-sm text-gtext">đến {formatDateTime(selected.ends_at)}</p></div>
          <div><p className="text-xs text-gtext">Lớp học</p><b>{selected.class_code} — {selected.class_name}</b><p className="text-sm text-gtext">{selected.course_name}</p></div>
          <div><p className="text-xs text-gtext">Giảng viên</p><b>{selected.teacher_name ?? "Chưa phân công"}</b></div>
          <div><p className="text-xs text-gtext">Địa điểm</p><b>{selected.location_name ?? "Chưa xếp phòng"}</b></div>
        </div>
        <div className="rounded-xl border border-gborder p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gtext">Trạng thái điểm danh của bạn</p>
          <div className="mt-2">{attendance.isLoading ? <span className="text-sm text-gtext">Đang tải kết quả…</span> : selectedAttendance ? <StatusBadge value={selectedAttendance.status} /> : <span className="text-sm font-semibold text-gtext">{selectedFinished ? "Chưa có kết quả điểm danh" : "Buổi học chưa diễn ra"}</span>}</div>
          {selectedAttendance?.note && <p className="mt-3 text-sm text-gtext">Ghi chú: {selectedAttendance.note}</p>}
        </div>
      </div>}
    </Modal>
  </div>;
}

export function StudentAttendancePage() {
  const [page, setPage] = useState(1); const [classId, setClassId] = useState(""); const summary = useQuery({ queryKey: ["student", "attendance", "summary"], queryFn: () => studentApi.attendanceSummary() }); const history = useQuery({ queryKey: ["student", "attendance", page, classId], queryFn: () => studentApi.attendance({ page, per_page: 10, class_id: classId }) }); const selected = summary.data?.items.find((s) => s.class_id === classId);
  return <div><PageHeader title="Điểm danh của tôi" subtitle="Theo dõi tỷ lệ chuyên cần và lịch sử từng buổi học." /><div className="mb-4 max-w-sm"><Select label="Lọc theo lớp" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}><option value="">Tất cả lớp</option>{summary.data?.items.map((s) => <option key={s.class_id} value={s.class_id}>{s.class_code} — {s.class_name}</option>)}</Select></div><QueryState loading={summary.isLoading} error={summary.error}>{summary.data && <div className="mb-5 grid gap-3 sm:grid-cols-4"><StatCard label="Chuyên cần" value={`${(selected?.attendance_pct ?? (summary.data.items[0]?.attendance_pct ?? 0)).toFixed(0)}%`} /><StatCard label="Có mặt" value={selected?.present_sessions ?? summary.data.items.reduce((n, i) => n + i.present_sessions, 0)} /><StatCard label="Đi trễ" value={selected?.late_sessions ?? summary.data.items.reduce((n, i) => n + i.late_sessions, 0)} /><StatCard label="Vắng" value={selected?.absent_sessions ?? summary.data.items.reduce((n, i) => n + i.absent_sessions, 0)} /></div>}</QueryState><QueryState loading={history.isLoading} error={history.error} empty={!history.data?.items.length}><DataTable items={history.data?.items ?? []} columns={[{ header: "Thời gian", cell: (a) => formatDateTime(a.starts_at) }, { header: "Lớp", cell: (a) => `${a.class_code} — ${a.class_name}` }, { header: "Buổi học", cell: (a) => a.session_title }, { header: "Trạng thái", cell: (a) => <StatusBadge value={a.status} /> }, { header: "Ghi chú", cell: (a) => a.note || "—" }]} /><Pagination page={page} totalPages={history.data?.meta.total_pages ?? 0} onPage={setPage} /></QueryState></div>;
}

export function StudentAssessmentsPage() {
  const query = useQuery({ queryKey: ["student", "assessments"], queryFn: () => studentApi.assessments({ page: 1, per_page: 100 }) });
  return <div><PageHeader title="Kết quả kỹ năng" subtitle="Các đánh giá đã gửi hoặc khóa bởi giảng viên." /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><div className="space-y-4">{query.data?.items.map((a) => <Card key={a.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-gold-dark">{a.course_code} · Lần #{a.assessment_no}</p><h2 className="mt-1 text-lg font-bold text-navy">{a.class_code} — {a.class_name}</h2><p className="text-sm text-gtext">Giảng viên: {a.teacher_name}</p></div><StatusBadge value={a.status} /></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{a.items.map((item) => <div key={item.id} className="rounded-lg border border-gborder p-3"><div className="flex justify-between gap-2"><b className="text-sm">{item.criterion_code}</b><StatusBadge value={item.rating} /></div><p className="mt-1 text-sm">{item.criterion_name}</p>{item.comment && <p className="mt-2 text-xs text-gtext">{item.comment}</p>}</div>)}</div>{a.overall_comment && <div className="mt-4 rounded-lg bg-gbg2 p-3 text-sm"><b>Nhận xét chung:</b> {a.overall_comment}</div>}</Card>)}</div></QueryState></div>;
}

export function StudentProgressPage() {
  const query = useQuery({ queryKey: ["student", "progress"], queryFn: () => studentApi.progress() });
  return <div><PageHeader title="Tiến độ học tập" subtitle="Kết quả được tính từ buổi học, chuyên cần, kỹ năng và bài đánh giá." /><QueryState loading={query.isLoading} error={query.error} empty={!query.data?.items.length}><div className="mb-5 grid gap-4 sm:grid-cols-3"><StatCard label="Số lớp" value={query.data?.summary.classes ?? 0} /><StatCard label="Tiến độ trung bình" value={`${(query.data?.summary.average_progress_pct ?? 0).toFixed(0)}%`} /><StatCard label="Đủ điều kiện hoàn thành" value={query.data?.summary.eligible_classes ?? 0} /></div><div className="space-y-5">{query.data?.items.map((item) => <Card key={item.class_id}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-gold-dark">{item.course_code}</p><h2 className="text-lg font-bold text-navy">{item.course_name}</h2><p className="text-sm text-gtext">{item.class_code} — {item.class_name}</p></div><StatusBadge value={item.completion_status} /></div><div className="mt-5"><ProgressBar value={item.overall_progress_pct} label="Tiến độ tổng thể" /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><ProgressBar value={item.sessions.percent} label={`Buổi học ${item.sessions.completed}/${item.sessions.required}`} /><ProgressBar value={item.attendance.percent} label={`Chuyên cần (yêu cầu ${item.attendance.minimum_required_pct}%)`} /><ProgressBar value={item.competencies.percent} label={`Kỹ năng ${item.competencies.met}/${item.competencies.required}`} /><ProgressBar value={item.assessments.percent} label={`Đánh giá ${item.assessments.completed}/${item.assessments.required}`} /></div>{item.completion_status !== "eligible" && <p className="mt-4 rounded-lg bg-gold/10 p-3 text-sm text-gold-dark">Bạn cần hoàn thành tất cả yêu cầu trước khi đủ điều kiện kết thúc khóa học.</p>}</Card>)}</div></QueryState></div>;
}
