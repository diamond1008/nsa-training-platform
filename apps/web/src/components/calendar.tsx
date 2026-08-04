import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Icon } from "./icons";
import { Badge, Button, Card, EmptyState, Modal } from "./ui";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
export type CalendarView = "week" | "month";
export type TrainingSlotKey = "morning" | "afternoon" | "evening";

export const TRAINING_SLOTS: ReadonlyArray<{
  key: TrainingSlotKey;
  label: string;
  timeLabel: string;
  startMinutes: number;
  endMinutes: number;
}> = [
  {
    key: "morning",
    label: "Sáng",
    timeLabel: "08:00–12:00",
    startMinutes: 8 * 60,
    endMinutes: 12 * 60,
  },
  {
    key: "afternoon",
    label: "Chiều",
    timeLabel: "13:30–17:30",
    startMinutes: 13 * 60 + 30,
    endMinutes: 17 * 60 + 30,
  },
  {
    key: "evening",
    label: "Tối",
    timeLabel: "18:30–21:30",
    startMinutes: 18 * 60 + 30,
    endMinutes: 21 * 60 + 30,
  },
];

export interface WeekCalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  startsAt: string;
  endsAt: string;
  tone?: "navy" | "gold" | "green" | "red" | "gray";
}
export interface CalendarStat {
  label: string;
  value: number;
  tone: "navy" | "gold" | "green" | "red" | "gray";
}
interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(value: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
  };
}
export function vietnamDateKey(value: Date) {
  const p = zonedParts(value);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
export function inferTrainingSlot(startsAt: string, endsAt: string): TrainingSlotKey | null {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (vietnamDateKey(startDate) !== vietnamDateKey(endDate)) return null;
  const start = zonedParts(startDate);
  const end = zonedParts(endDate);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  return (
    TRAINING_SLOTS.find(
      (slot) => slot.startMinutes === startMinutes && slot.endMinutes === endMinutes,
    )?.key ?? null
  );
}
export function trainingSlotRange(dateKey: string, slotKey: TrainingSlotKey) {
  const slot = TRAINING_SLOTS.find((item) => item.key === slotKey);
  if (!slot || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid training date or slot");
  }
  const localTimestamp = (minutes: number) => {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    return new Date(`${dateKey}T${hour}:${minute}:00+07:00`).toISOString();
  };
  return {
    startsAt: localTimestamp(slot.startMinutes),
    endsAt: localTimestamp(slot.endMinutes),
  };
}
export function addCalendarDays(dateKey: string, amount: number) {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function currentWeekStart(now = new Date()) {
  const today = vietnamDateKey(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addCalendarDays(today, -((weekday + 6) % 7));
}
export function weekRange(weekStart: string) {
  return {
    from: new Date(`${weekStart}T00:00:00+07:00`).toISOString(),
    to: new Date(`${addCalendarDays(weekStart, 7)}T00:00:00+07:00`).toISOString(),
  };
}
export function monthRange(anchor: string) {
  const [year, month] = anchor.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    from: new Date(`${start}T00:00:00+07:00`).toISOString(),
    to: new Date(`${next}T00:00:00+07:00`).toISOString(),
  };
}
function addMonths(anchor: string, amount: number) {
  const [y, m] = anchor.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + amount, 1));
  return date.toISOString().slice(0, 10);
}
function dateAtNoon(key: string) {
  return new Date(`${key}T12:00:00+07:00`);
}
function daysInMonth(anchor: string) {
  const [y, m] = anchor.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function monthGridDays(anchor: string) {
  const start = monthRange(anchor).from.slice(0, 10);
  const weekday = new Date(`${start}T00:00:00Z`).getUTCDay();
  const gridStart = addCalendarDays(start, -((weekday + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addCalendarDays(gridStart, i));
}
function titleFor(anchor: string, view: CalendarView) {
  if (view === "month") {
    const p = zonedParts(dateAtNoon(anchor));
    return `Tháng ${p.month}, ${p.year}`;
  }
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(anchor, i));
  const first = zonedParts(dateAtNoon(days[0]));
  const last = zonedParts(dateAtNoon(days[6]));
  if (first.year === last.year && first.month === last.month)
    return `Tháng ${first.month}, ${first.year}`;
  return first.year === last.year
    ? `Tháng ${first.month} – Tháng ${last.month}, ${first.year}`
    : `Tháng ${first.month}, ${first.year} – Tháng ${last.month}, ${last.year}`;
}
const toneClasses = {
  navy: "border-navy/20 bg-navy text-white hover:bg-navy-soft",
  gold: "border-gold/50 bg-gold/25 text-navy hover:bg-gold/40",
  green: "border-success bg-success text-white hover:bg-success/90",
  red: "border-error/20 bg-error-bg text-error hover:bg-error/15",
  gray: "border-gborder bg-gbg2 text-gtext hover:bg-gborder/60",
};
const toneDot = {
  navy: "bg-navy",
  gold: "bg-gold",
  green: "bg-success",
  red: "bg-error",
  gray: "bg-gtext",
};
export function WeekCalendar({
  events,
  weekStart,
  onWeekStartChange,
  onEventClick,
  view = "week",
  onViewChange,
  stats = [],
}: {
  events: WeekCalendarEvent[];
  weekStart: string;
  onWeekStartChange: (value: string) => void;
  onEventClick: (event: WeekCalendarEvent) => void;
  view?: CalendarView;
  onViewChange?: (value: CalendarView) => void;
  stats?: CalendarStat[];
}) {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const today = vietnamDateKey(new Date());
  const days = useMemo(
    () =>
      view === "week"
        ? Array.from({ length: 7 }, (_, i) => addCalendarDays(weekStart, i))
        : monthGridDays(weekStart),
    [view, weekStart],
  );
  const visibleMonth = weekStart.slice(0, 7);
  const navigate = (amount: number) =>
    onWeekStartChange(
      view === "week" ? addCalendarDays(weekStart, amount * 7) : addMonths(weekStart, amount),
    );
  const goToday = () =>
    onWeekStartChange(view === "week" ? currentWeekStart() : vietnamDateKey(new Date()));
  const switchView = (next: CalendarView) => {
    if (next === view) return;
    onWeekStartChange(next === "week" ? currentWeekStart(dateAtNoon(weekStart)) : weekStart);
    onViewChange?.(next);
  };
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gborder px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={goToday}>
            Hôm nay
          </Button>
          <Button
            variant="soft"
            className="h-9 w-9 px-0"
            aria-label={view === "week" ? "Tuần trước" : "Tháng trước"}
            onClick={() => navigate(-1)}
          >
            <Icon name="arrow-left" className="h-4 w-4" />
          </Button>
          <Button
            variant="soft"
            className="h-9 w-9 px-0"
            aria-label={view === "week" ? "Tuần sau" : "Tháng sau"}
            onClick={() => navigate(1)}
          >
            <Icon name="arrow-right" className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="order-first w-full text-center text-base font-bold text-navy sm:order-none sm:w-auto md:text-lg">
          {titleFor(weekStart, view)}
        </h2>
        <div className="flex rounded-xl bg-gbg2 p-1">
          {(["week", "month"] as CalendarView[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchView(value)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                view === value ? "bg-white text-navy shadow-sm" : "text-gtext hover:text-navy",
              )}
            >
              {value === "week" ? "Tuần" : "Tháng"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-gborder bg-gbg/70 px-4 py-2.5 text-[11px] text-gtext md:px-5">
        <span className="font-semibold">GMT+07</span>
        {[
          ["navy", "Buổi học"],
          ["gold", "Đánh giá"],
          ["green", "Đã điểm danh"],
          ["red", "Vắng / hủy"],
        ].map(([tone, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className={clsx("h-2 w-2 rounded-full", toneDot[tone as keyof typeof toneDot])} />
            {label}
          </span>
        ))}
      </div>
      {stats.length > 0 && (
        <div
          aria-label="Tổng quan lịch"
          className="flex flex-wrap gap-x-5 gap-y-2 border-b border-gborder px-4 py-3 text-sm md:px-5"
        >
          {stats.map((stat) => (
            <span
              key={stat.label}
              aria-label={`${stat.value} buổi ${stat.label}`}
              className="flex items-center gap-2 text-gtext"
            >
              <i className={clsx("h-3 w-3 rounded-full", toneDot[stat.tone])} />
              <span>
                <b className="text-navy">{stat.value}</b> buổi {stat.label}
              </span>
            </span>
          ))}
        </div>
      )}
      {mobile ? (
        <AgendaView
          events={events}
          days={view === "month" ? days.filter((d) => d.startsWith(visibleMonth)) : days}
          onEventClick={onEventClick}
        />
      ) : view === "week" ? (
        <WeekGrid events={events} days={days} today={today} onEventClick={onEventClick} />
      ) : (
        <MonthGrid
          events={events}
          days={days}
          today={today}
          visibleMonth={visibleMonth}
          onEventClick={onEventClick}
        />
      )}
    </Card>
  );
}

function AgendaView({
  events,
  days,
  onEventClick,
}: {
  events: WeekCalendarEvent[];
  days: string[];
  onEventClick: (event: WeekCalendarEvent) => void;
}) {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const activeDays = days.filter((day) =>
    events.some((event) => vietnamDateKey(new Date(event.startsAt)) === day),
  );
  if (!activeDays.length)
    return (
      <div className="p-4">
        <EmptyState
          title="Không có lịch trong khoảng này"
          hint="Chuyển tuần hoặc tháng để xem các buổi khác."
        />
      </div>
    );
  return (
    <div className="divide-y divide-gborder">
      {activeDays.map((day) => (
        <section key={day} className="p-4">
          <h3 className="mb-3 text-xs font-bold capitalize text-gtext">
            {formatter.format(dateAtNoon(day))}
          </h3>
          <div className="space-y-2">
            {events
              .filter((event) => vietnamDateKey(new Date(event.startsAt)) === day)
              .map((event) => (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Mở ${event.title}`}
                  onClick={() => onEventClick(event)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gborder bg-white p-3 text-left transition hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <i
                    className={clsx(
                      "h-10 w-1 shrink-0 rounded-full",
                      toneDot[event.tone ?? "navy"],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-navy">{event.title}</b>
                    <p className="mt-0.5 truncate text-xs text-gtext">{event.subtitle}</p>
                  </div>
                  <Badge tone="gray">{time.format(new Date(event.startsAt))}</Badge>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WeekGrid({
  events,
  days,
  today,
  onEventClick,
}: {
  events: WeekCalendarEvent[];
  days: string[];
  today: string;
  onEventClick: (event: WeekCalendarEvent) => void;
}) {
  const [overflowCell, setOverflowCell] = useState<{
    slot: (typeof TRAINING_SLOTS)[number];
    day: string;
    events: WeekCalendarEvent[];
  } | null>(null);
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const weekday = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, weekday: "short" });
  const eventPriority = (event: WeekCalendarEvent) => {
    switch (event.tone) {
      case "red":
        return 3;
      case "green":
        return 2;
      case "gray":
        return 1;
      default:
        return 0;
    }
  };
  const sortEvents = (items: WeekCalendarEvent[]) =>
    [...items].sort(
      (left, right) =>
        eventPriority(left) - eventPriority(right) ||
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
        left.title.localeCompare(right.title, "vi"),
    );
  return (
    <>
      <div className="overflow-x-auto bg-white">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[112px_repeat(7,minmax(112px,1fr))] border-b border-gborder bg-white">
            <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-gtext">
              Ca học
            </div>
            {days.map((day) => {
              const date = zonedParts(dateAtNoon(day));
              const active = day === today;
              return (
                <div
                  key={day}
                  className={clsx(
                    "border-l border-gborder py-2 text-center",
                    active && "bg-gold/5",
                  )}
                >
                  <p
                    className={clsx(
                      "text-[10px] font-bold uppercase",
                      active ? "text-gold-dark" : "text-gtext",
                    )}
                  >
                    {weekday.format(dateAtNoon(day))}
                  </p>
                  <div
                    className={clsx(
                      "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base",
                      active ? "bg-navy font-bold text-white" : "text-navy",
                    )}
                  >
                    {date.day}
                  </div>
                </div>
              );
            })}
          </div>
          {TRAINING_SLOTS.map((slot) => (
            <div
              key={slot.key}
              className="grid min-h-28 grid-cols-[112px_repeat(7,minmax(112px,1fr))] border-b border-gborder last:border-b-0"
            >
              <div className="flex flex-col items-center justify-center bg-gbg2/60 px-2 text-center">
                <b className="text-sm text-navy">{slot.label}</b>
                <span className="mt-1 text-[10px] text-gtext">{slot.timeLabel}</span>
              </div>
              {days.map((day) => {
                const slotEvents = sortEvents(
                  events.filter(
                    (event) =>
                      vietnamDateKey(new Date(event.startsAt)) === day &&
                      inferTrainingSlot(event.startsAt, event.endsAt) === slot.key,
                  ),
                );
                return (
                  <div
                    key={`${slot.key}-${day}`}
                    className={clsx(
                      "space-y-1.5 border-l border-gborder p-1.5",
                      day === today && "bg-gold/[0.025]",
                    )}
                  >
                    {slotEvents.slice(0, 2).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        aria-label={`Mở ${event.title}`}
                        onClick={() => onEventClick(event)}
                        className={clsx(
                          "w-full overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1",
                          toneClasses[event.tone ?? "navy"],
                        )}
                      >
                        <b className="block truncate">{event.title}</b>
                        <span className="block truncate text-[10px] opacity-75">
                          {time.format(new Date(event.startsAt))}–
                          {time.format(new Date(event.endsAt))}
                        </span>
                        {event.subtitle && (
                          <span className="mt-0.5 block truncate text-[10px] opacity-75">
                            {event.subtitle}
                          </span>
                        )}
                      </button>
                    ))}
                    {slotEvents.length > 2 ? (
                      <button
                        type="button"
                        aria-label={`+${slotEvents.length - 2} lớp khác`}
                        onClick={() => setOverflowCell({ slot, day, events: slotEvents })}
                        className="flex h-8 w-full touch-manipulation items-center justify-center rounded-lg border border-dashed border-gborder bg-gbg2/70 px-2 text-[11px] font-bold text-navy transition-[background-color,border-color] hover:border-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
                      >
                        +{slotEvents.length - 2} lớp khác
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <Modal
        open={overflowCell !== null}
        title={overflowCell ? `${overflowCell.events.length} lớp · ${overflowCell.slot.label}` : ""}
        onClose={() => setOverflowCell(null)}
      >
        <div className="space-y-2">
          {overflowCell?.events.map((event) => (
            <button
              key={event.id}
              type="button"
              aria-label={`Mở ${event.title}`}
              onClick={() => {
                setOverflowCell(null);
                onEventClick(event);
              }}
              className="flex w-full touch-manipulation items-center gap-3 rounded-xl border border-gborder bg-white p-3 text-left transition-[background-color,border-color,box-shadow] hover:border-gold hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
            >
              <i
                className={clsx("h-10 w-1 shrink-0 rounded-full", toneDot[event.tone ?? "navy"])}
              />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm text-navy">{event.title}</b>
                <span className="mt-0.5 block truncate text-xs text-gtext">
                  {event.subtitle || "Chưa có thông tin giảng viên / phòng"}
                </span>
              </span>
              <Badge tone="gray">
                {time.format(new Date(event.startsAt))}–{time.format(new Date(event.endsAt))}
              </Badge>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

function MonthGrid({
  events,
  days,
  today,
  visibleMonth,
  onEventClick,
}: {
  events: WeekCalendarEvent[];
  days: string[];
  today: string;
  visibleMonth: string;
  onEventClick: (event: WeekCalendarEvent) => void;
}) {
  const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-gborder bg-gbg2/70">
          {weekdays.map((day) => (
            <div
              key={day}
              className="border-l border-gborder px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gtext first:border-l-0"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((e) => vietnamDateKey(new Date(e.startsAt)) === day);
            const current = day.startsWith(visibleMonth);
            return (
              <div
                key={day}
                className={clsx(
                  "min-h-28 border-b border-l border-gborder p-2 first:border-l-0",
                  !current && "bg-gbg2/45 text-gtext",
                  day === today && "bg-gold/[0.06]",
                )}
              >
                <div
                  className={clsx(
                    "mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                    day === today ? "bg-navy text-white" : "text-navy",
                  )}
                >
                  {Number(day.slice(-2))}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      aria-label={`Mở ${event.title}`}
                      onClick={() => onEventClick(event)}
                      className={clsx(
                        "flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                        toneClasses[event.tone ?? "navy"],
                      )}
                    >
                      <i className={clsx("h-1.5 w-1.5 shrink-0 rounded-full bg-current")} />
                      <span className="truncate">{event.title}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="px-1 text-[10px] font-semibold text-gtext">
                      +{dayEvents.length - 3} buổi khác
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const calendarMonthDays = daysInMonth;
