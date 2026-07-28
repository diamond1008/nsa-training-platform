import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Icon } from "./icons";
import { Badge, Button, Card, EmptyState } from "./ui";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;
export type CalendarView = "week" | "month";

export interface WeekCalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  startsAt: string;
  endsAt: string;
  tone?: "navy" | "gold" | "green" | "red" | "gray";
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
function eventPosition(event: WeekCalendarEvent) {
  const start = zonedParts(new Date(event.startsAt));
  const end = zonedParts(new Date(event.endsAt));
  const startMinutes = start.hour * 60 + start.minute;
  const rawEnd =
    vietnamDateKey(new Date(event.endsAt)) === vietnamDateKey(new Date(event.startsAt))
      ? end.hour * 60 + end.minute
      : END_HOUR * 60;
  const visibleStart = Math.max(START_HOUR * 60, startMinutes);
  const visibleEnd = Math.min(END_HOUR * 60, rawEnd);
  return {
    top: ((visibleStart - START_HOUR * 60) / 60) * HOUR_HEIGHT,
    height: Math.max(
      30,
      ((Math.max(visibleStart + 15, visibleEnd) - visibleStart) / 60) * HOUR_HEIGHT,
    ),
    hidden: rawEnd <= START_HOUR * 60 || startMinutes >= END_HOUR * 60,
  };
}

export function WeekCalendar({
  events,
  weekStart,
  onWeekStartChange,
  onEventClick,
  view = "week",
  onViewChange,
}: {
  events: WeekCalendarEvent[];
  weekStart: string;
  onWeekStartChange: (value: string) => void;
  onEventClick: (event: WeekCalendarEvent) => void;
  view?: CalendarView;
  onViewChange?: (value: CalendarView) => void;
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
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
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
                  className="flex w-full items-center gap-3 rounded-xl border border-gborder bg-white p-3 text-left transition hover:border-gold"
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
  const now = zonedParts(new Date());
  const calendarHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  const weekday = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, weekday: "short" });
  return (
    <div className="h-[calc(100dvh-16rem)] min-h-[34rem] overflow-auto">
      <div className="min-w-[900px]">
        <div className="sticky top-0 z-30 grid grid-cols-[64px_repeat(7,minmax(110px,1fr))] border-b border-gborder bg-white">
          <div />
          <>
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
          </>
        </div>
        <div className="relative bg-white" style={{ height: calendarHeight }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-gborder/80"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            >
              <span className="absolute -top-2.5 left-2 w-12 bg-white pr-2 text-right text-[10px] text-gtext">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
          ))}
          <div className="absolute bottom-0 left-16 right-0 top-0 grid grid-cols-7">
            {days.map((day) => (
              <div
                key={day}
                className={clsx(
                  "relative border-l border-gborder",
                  day === today && "bg-gold/[0.025]",
                )}
              >
                {day === today && now.hour >= START_HOUR && now.hour < END_HOUR && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-error"
                    style={{
                      top: ((now.hour * 60 + now.minute - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                    }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-error" />
                  </div>
                )}
                {events
                  .filter((e) => vietnamDateKey(new Date(e.startsAt)) === day)
                  .map((event) => {
                    const p = eventPosition(event);
                    if (p.hidden) return null;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        aria-label={`Mở ${event.title}`}
                        onClick={() => onEventClick(event)}
                        className={clsx(
                          "absolute left-1 right-1 z-10 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm transition",
                          toneClasses[event.tone ?? "navy"],
                        )}
                        style={{ top: p.top, height: p.height }}
                      >
                        <b className="block truncate">{event.title}</b>
                        <span className="block truncate text-[10px] opacity-75">
                          {time.format(new Date(event.startsAt))}–
                          {time.format(new Date(event.endsAt))}
                        </span>
                        {event.subtitle && p.height >= 54 && (
                          <span className="mt-0.5 block truncate text-[10px] opacity-75">
                            {event.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
                        "flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] font-semibold",
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
