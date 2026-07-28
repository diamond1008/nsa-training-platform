import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination, StatusBadge } from "./data";
import { ProgressBar } from "./ui";

describe("Phase 9 shared data components", () => {
  it("clamps progress values for accessible rendering", () => {
    render(<ProgressBar value={125} label="Tiến độ" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders localized status text", () => {
    render(<StatusBadge value="completed" />);
    expect(screen.getByText("Đã hoàn thành")).toBeInTheDocument();
  });

  it("moves to the requested page", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} onPage={onPage} />);
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(onPage).toHaveBeenCalledWith(3);
  });
});
