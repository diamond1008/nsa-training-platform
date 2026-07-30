import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  currentWeekStart,
  inferTrainingSlot,
  monthRange,
  trainingSlotRange,
  WeekCalendar,
  weekRange,
} from "./calendar";

describe("WeekCalendar", () => {
  it("calculates Monday and API range in Vietnam time", () => {
    expect(currentWeekStart(new Date("2026-07-29T03:00:00Z"))).toBe("2026-07-27");
    expect(weekRange("2026-07-27")).toEqual({
      from: "2026-07-26T17:00:00.000Z",
      to: "2026-08-02T17:00:00.000Z",
    });
    expect(monthRange("2026-07-27")).toEqual({
      from: "2026-06-30T17:00:00.000Z",
      to: "2026-07-31T17:00:00.000Z",
    });
  });

  it("infers the fixed Vietnam training slots", () => {
    expect(inferTrainingSlot("2026-07-28T01:00:00Z", "2026-07-28T05:00:00Z")).toBe("morning");
    expect(inferTrainingSlot("2026-07-28T06:30:00Z", "2026-07-28T10:30:00Z")).toBe("afternoon");
    expect(inferTrainingSlot("2026-07-28T11:30:00Z", "2026-07-28T14:30:00Z")).toBe("evening");
    expect(inferTrainingSlot("2026-07-28T06:00:00Z", "2026-07-28T10:00:00Z")).toBeNull();
  });

  it("builds RFC3339 timestamps from a date and fixed slot", () => {
    expect(trainingSlotRange("2026-08-03", "afternoon")).toEqual({
      startsAt: "2026-08-03T06:30:00.000Z",
      endsAt: "2026-08-03T10:30:00.000Z",
    });
  });

  it("opens the selected calendar event", () => {
    const onEventClick = vi.fn();
    render(
      <WeekCalendar
        weekStart="2026-07-27"
        onWeekStartChange={vi.fn()}
        onEventClick={onEventClick}
        events={[
          {
            id: "session-1",
            title: "Lý thuyết động cơ",
            subtitle: "SE1801",
            startsAt: "2026-07-28T06:30:00Z",
            endsAt: "2026-07-28T10:30:00Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mở Lý thuyết động cơ" }));
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
  });

  it("renders a compact three-slot week grid and role statistics", () => {
    render(
      <WeekCalendar
        events={[]}
        weekStart="2026-07-27"
        onWeekStartChange={vi.fn()}
        onEventClick={vi.fn()}
        stats={[
          { label: "Sắp học", value: 2, tone: "navy" },
          { label: "Đã tham gia", value: 7, tone: "green" },
          { label: "Vắng mặt", value: 1, tone: "red" },
        ]}
      />,
    );

    expect(screen.getByText("Sáng")).toBeInTheDocument();
    expect(screen.getByText("Chiều")).toBeInTheDocument();
    expect(screen.getByText("Tối")).toBeInTheDocument();
    expect(screen.getByText("08:00–12:00")).toBeInTheDocument();
    expect(screen.getByLabelText("2 buổi Sắp học")).toBeInTheDocument();
    expect(screen.getByLabelText("7 buổi Đã tham gia")).toBeInTheDocument();
    expect(screen.getByLabelText("1 buổi Vắng mặt")).toBeInTheDocument();
  });

  it("moves one week forward", () => {
    const onWeekStartChange = vi.fn();
    render(
      <WeekCalendar
        events={[]}
        weekStart="2026-07-27"
        onWeekStartChange={onWeekStartChange}
        onEventClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
    expect(onWeekStartChange).toHaveBeenCalledWith("2026-08-03");
  });

  it("keeps completed attendance events visibly green", () => {
    render(
      <WeekCalendar
        weekStart="2026-07-27"
        onWeekStartChange={vi.fn()}
        onEventClick={vi.fn()}
        events={[
          {
            id: "locked-session",
            title: "Buổi đã khóa",
            startsAt: "2026-07-28T01:00:00Z",
            endsAt: "2026-07-28T05:00:00Z",
            tone: "green",
          },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Mở Buổi đã khóa" })).toHaveClass(
      "bg-success",
      "text-white",
    );
  });

  it("switches between week and month views", () => {
    const onViewChange = vi.fn();
    render(
      <WeekCalendar
        events={[]}
        weekStart="2026-07-27"
        onWeekStartChange={vi.fn()}
        onEventClick={vi.fn()}
        onViewChange={onViewChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tháng" }));
    expect(onViewChange).toHaveBeenCalledWith("month");
  });
});
