import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { currentWeekStart, WeekCalendar, weekRange } from "./calendar";

describe("WeekCalendar", () => {
  it("calculates Monday and API range in Vietnam time", () => {
    expect(currentWeekStart(new Date("2026-07-29T03:00:00Z"))).toBe("2026-07-27");
    expect(weekRange("2026-07-27")).toEqual({
      from: "2026-07-26T17:00:00.000Z",
      to: "2026-08-02T17:00:00.000Z",
    });
  });

  it("opens the selected calendar event", () => {
    const onEventClick = vi.fn();
    render(<WeekCalendar
      weekStart="2026-07-27"
      onWeekStartChange={vi.fn()}
      onEventClick={onEventClick}
      events={[{
        id: "session-1",
        title: "Lý thuyết động cơ",
        subtitle: "SE1801",
        startsAt: "2026-07-28T06:00:00Z",
        endsAt: "2026-07-28T10:00:00Z",
      }]}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Mở Lý thuyết động cơ" }));
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1" }));
  });

  it("moves one week forward", () => {
    const onWeekStartChange = vi.fn();
    render(<WeekCalendar events={[]} weekStart="2026-07-27" onWeekStartChange={onWeekStartChange} onEventClick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tuần sau" }));
    expect(onWeekStartChange).toHaveBeenCalledWith("2026-08-03");
  });
});
