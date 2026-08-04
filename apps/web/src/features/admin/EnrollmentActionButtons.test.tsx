import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Enrollment } from "../../lib/domainTypes";
import { EnrollmentActionButtons } from "./EnrollmentActionButtons";

const enrollment = (status: string): Enrollment => ({
  id: "enrollment-1",
  class_id: "class-1",
  student_id: "student-1",
  student_code: "KT000001",
  full_name: "Nguyễn Văn An",
  status,
  enrolled_at: "2026-08-01T01:00:00Z",
});

describe("EnrollmentActionButtons", () => {
  it("offers returning to class only for a withdrawn enrollment", () => {
    const onAction = vi.fn();
    const view = render(
      <EnrollmentActionButtons enrollment={enrollment("withdrawn")} onAction={onAction} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Đưa trở lại lớp" }));
    expect(onAction).toHaveBeenCalledWith("reenroll");

    view.rerender(
      <EnrollmentActionButtons enrollment={enrollment("completed")} onAction={onAction} />,
    );
    expect(screen.queryByRole("button", { name: "Đưa trở lại lớp" })).not.toBeInTheDocument();
  });
});
