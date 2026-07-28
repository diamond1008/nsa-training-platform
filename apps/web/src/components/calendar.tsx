import { useMemo } from "react";

import { Button, Card } from "./ui";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 64;

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
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour"), minute: number("minute") };
}

export function vietnamDateKey(value: Date): string {
  const parts = zonedParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function currentWeekStart(now = new Date()): string {
  const today = vietnamDateKey(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addCalendarDays(today, -((weekday + 6) % 7));
}

export function weekRange(weekStart: string): { from: string; to: string } {
  return {
    from: new Date(`${weekStart}T00:00:00+07:00`).toISOString(),
    to: new Date(`${addCalendarDays(weekStart, 7)}T00:00:00+07:00`).toISOString(),
  };
}

const toneClasses: Record<NonNullable<WeekCalendarEvent["tone"]>, string> = {
  navy: "border-navy/30 bg-navy text-white hover:bg-navy/90",
  gold: "border-gold-dark/30 bg-gold/25 text-navy hover:bg-gold/35",
  green: "border-success/30 bg-success/15 text-success hover:bg-success/25",
  red: "border-error/30 bg-error/10 text-error hover:bg-error/20",
  gray: "border-gborder bg-gbg2 text-gtext hover:bg-gborder/60",
};

function dateAtNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+07:00`);
}

function weekTitle(days: string[]): string {
  const first = zonedParts(dateAtNoon(days[0]));
  const last = zonedParts(dateAtNoon(days[6]));
  if (first.year === last.year && first.month === last.month) return `Tháng ${first.month}, ${first.year}`;
  if (first.year === last.year) return `Tháng ${first.month} – Tháng ${last.month}, ${first.year}`;
  return `Tháng ${first.month}, ${first.year} – Tháng ${last.month}, ${last.year}`;
}

function eventPosition(event: WeekCalendarEvent) {
  const start = zonedParts(new Date(event.startsAt));
  const end = zonedParts(new Date(event.endsAt));
  const startMinutes = start.hour * 60 + start.minute;
  const rawEndMinutes = vietnamDateKey(new Date(event.endsAt)) === vietnamDateKey(new Date(event.startsAt))
    ? end.hour * 60 + end.minute
    : END_HOUR * 60;
  const visibleStart = Math.max(START_HOUR * 60, startMinutes);
  const visibleEnd = Math.min(END_HOUR * 60, rawEndMinutes);
  return {
    top: ((visibleStart - START_HOUR * 60) / 60) * HOUR_HEIGHT,
    height: Math.max(30, ((Math.max(visibleStart + 15, visibleEnd) - visibleStart) / 60) * HOUR_HEIGHT),
    hidden: rawEndMinutes <= START_HOUR * 60 || startMinutes >= END_HOUR * 60,
  };
}

export function WeekCalendar({ events, weekStart, onWeekStartChange, onEventClick }: {
  events: WeekCalendarEvent[];
  weekStart: string;
  onWeekStartChange: (value: string) => void;
  onEventClick: (event: WeekCalendarEvent) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index)), [weekStart]);
  const today = vietnamDateKey(new Date());
  const now = zonedParts(new Date());
  const calendarHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
  const timeFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, weekday: "short" });

  return (
    <Card className="flex h-[calc(100dvh-11rem)] min-h-[32rem] flex-col overflow-hidden p-0 md:h-[calc(100dvh-12rem)] md:min-h-0">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-gborder px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onWeekStartChange(currentWeekStart())}>Hôm nay</Button>
          <Button variant="ghost" aria-label="Tuần trước" onClick={() => onWeekStartChange(addCalendarDays(weekStart, -7))}>←</Button>
          <Button variant="ghost" aria-label="Tuần sau" onClick={() => onWeekStartChange(addCalendarDays(weekStart, 7))}>→</Button>
        </div>
        <h2 className="text-lg font-bold text-navy">{weekTitle(days)}</h2>
        <span className="rounded-full bg-gbg2 px-3 py-1 text-xs font-semibold text-gtext">GMT+07 · Tuần</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[900px]">
          <div className="sticky top-0 z-30 grid grid-cols-[64px_repeat(7,minmax(110px,1fr))] border-b border-gborder bg-white">
            <div className="flex items-end justify-center pb-2 text-[10px] text-gtext">GMT+07</div>
            {days.map((day) => {
              const date = zonedParts(dateAtNoon(day));
              const active = day === today;
              return <div key={day} className="border-l border-gborder py-2 text-center"><p className={`text-xs font-semibold uppercase ${active ? "text-gold-dark" : "text-gtext"}`}>{weekdayFormatter.format(dateAtNoon(day))}</p><div className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg ${active ? "bg-navy font-bold text-white" : "text-navy"}`}>{date.day}</div></div>;
            })}
          </div>

          <div className="relative bg-white" style={{ height: calendarHeight }}>
            {hours.map((hour) => <div key={hour} className="absolute left-0 right-0 border-t border-gborder" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}><span className="absolute -top-2.5 left-2 w-12 bg-white pr-2 text-right text-[10px] text-gtext">{String(hour).padStart(2, "0")}:00</span></div>)}
            <div className="absolute bottom-0 left-16 right-0 top-0 grid grid-cols-7">
              {days.map((day) => {
                const dayEvents = events.filter((event) => vietnamDateKey(new Date(event.startsAt)) === day);
                const showNow = day === today && now.hour >= START_HOUR && now.hour < END_HOUR;
                return <div key={day} className="relative border-l border-gborder">
                  {showNow && <div className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-error" style={{ top: ((now.hour * 60 + now.minute - START_HOUR * 60) / 60) * HOUR_HEIGHT }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-error" /></div>}
                  {dayEvents.map((event) => {
                    const position = eventPosition(event);
                    if (position.hidden) return null;
                    return <button key={event.id} type="button" title={`${event.title} · ${timeFormatter.format(new Date(event.startsAt))}–${timeFormatter.format(new Date(event.endsAt))}`} aria-label={`Mở ${event.title}`} onClick={() => onEventClick(event)} className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition ${toneClasses[event.tone ?? "navy"]}`} style={{ top: position.top, height: position.height }}><b className="block truncate">{event.title}</b><span className="block truncate text-[10px] opacity-80">{timeFormatter.format(new Date(event.startsAt))}–{timeFormatter.format(new Date(event.endsAt))}</span>{event.subtitle && position.height >= 54 && <span className="mt-0.5 block truncate text-[10px] opacity-80">{event.subtitle}</span>}</button>;
                  })}
                </div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
